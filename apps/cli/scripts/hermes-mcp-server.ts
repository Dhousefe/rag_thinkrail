/**
 * Hermes RAG MCP Server para ThinkRail
 * ---------------------------------------------------------------------------
 * Servidor MCP nativo em TypeScript de alta performance executado com Bun.
 * Integração direta com SQLite (bun:sqlite) e bancos do Hermes (~/.hermes/projects).
 * Fornece ferramentas completas de RAG com resposta em milissegundos.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { Database } from "bun:sqlite";

const userHome = process.env.USERPROFILE || homedir();
const hermesHome = join(userHome, ".hermes");
const projectsDir = join(hermesHome, "projects");

// Garantir que a pasta de projetos exista (cross-OS): cria de forma idempotente no startup
try {
	mkdirSync(projectsDir, { recursive: true });
} catch (e) {
	console.error("[hermes-mcp] erro ao criar projects dir:", (e as Error).message);
}
const activeProjectsFile = join(hermesHome, "active_projects.json");
const agentSkillsDir = join(userHome, ".agents", "skills");
const disabledSkillsDir = join(userHome, ".agents", "disabled_skills");

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id: number | string;
	method: string;
	params?: any;
}

function sendResponse(id: number | string | null, result: any, isError = false) {
	const payload: any = {
		jsonrpc: "2.0",
		id,
	};
	if (isError) {
		payload.error = result;
	} else {
		payload.result = result;
	}
	process.stdout.write(JSON.stringify(payload) + "\n");
}

function getActiveSlugs(): string[] {
	if (existsSync(activeProjectsFile)) {
		try {
			const data = JSON.parse(readFileSync(activeProjectsFile, "utf8"));
			if (Array.isArray(data.activeSlugs) && data.activeSlugs.length > 0) {
				return data.activeSlugs;
			}
		} catch {}
	}
	return ["project-thinkrail"];
}

function getAvailableProjects(): Array<{ slug: string; path: string; hasDb: boolean; sizeKb: number }> {
	if (!existsSync(projectsDir)) return [];
	try {
		const entries = readdirSync(projectsDir, { withFileTypes: true });
		return entries
			.filter((e) => e.isDirectory())
			.map((e) => {
				const slug = e.name;
				const dbPath = join(projectsDir, slug, "hermes.db");
				const hasDb = existsSync(dbPath);
				let sizeKb = 0;
				if (hasDb) {
					try {
						sizeKb = Math.round(statSync(dbPath).size / 1024);
					} catch {}
				}
				return { slug, path: join(projectsDir, slug), hasDb, sizeKb };
			});
	} catch {
		return [];
	}
}

interface SearchHit {
	project: string;
	score: number;
	path: string;
	startLine?: number;
	endLine?: number;
	qualifiedName: string;
	signature: string;
	content: string;
}

// Busca de código com FTS5 e RRF multi-projeto (com suporte a filtro de cluster/nó L2)
function handleCodeSearch(query: string, limit = 10, clusterId?: string): string {
	const slugs = getActiveSlugs();
	const cleanQuery = query.trim().replace(/["\*\^\:\(\)]/g, " ").trim();
	const terms = cleanQuery.split(/\s+/).filter(Boolean);
	const ftsQuery = terms.length > 0 ? terms.map((t) => `"${t}"`).join(" AND ") : cleanQuery;

	const clusterPatterns: Record<string, string> = {
		"web-ui": "%apps/web%",
		"cli-host": "%apps/cli%",
		"desktop": "%apps/desktop%",
		"server-engine": "%packages/server%",
		"contracts": "%packages/contracts%",
		"renderers": "%packages/resource-renderers%",
		"ui-kit": "%packages/ui%",
		"shared-utils": "%packages/shared%",
		"locales": "%packages/locales%",
		"e2e-tests": "%e2e%",
		"root": "%",
	};

	const filterPattern = clusterId ? (clusterPatterns[clusterId.toLowerCase()] || `%${clusterId}%`) : null;

	const allHits: SearchHit[] = [];

	for (const slug of slugs) {
		const dbPath = join(projectsDir, slug, "hermes.db");
		if (!existsSync(dbPath)) continue;

		try {
			const db = new Database(dbPath, { readonly: true });
			let rows: any[] = [];

			try {
				if (filterPattern) {
					rows = db
						.query(
							`SELECT c.path, c.start_line, c.end_line, c.content, c.qualified_name, c.signature, rank
               FROM l2j_chunk_fts fts
               JOIN l2j_chunks c ON fts.rowid = c.rowid
               WHERE l2j_chunk_fts MATCH ? AND (c.path LIKE ? OR replace(c.path, '\\', '/') LIKE ?)
               ORDER BY rank
               LIMIT ?`,
						)
						.all(ftsQuery, filterPattern, filterPattern, limit * 2);
				} else {
					rows = db
						.query(
							`SELECT c.path, c.start_line, c.end_line, c.content, c.qualified_name, c.signature, rank
               FROM l2j_chunk_fts fts
               JOIN l2j_chunks c ON fts.rowid = c.rowid
               WHERE l2j_chunk_fts MATCH ?
               ORDER BY rank
               LIMIT ?`,
						)
						.all(ftsQuery, limit * 2);
				}
			} catch {
				// Fallback via LIKE direto em l2j_chunks
				const likePattern = `%${terms[0] || query}%`;
				if (filterPattern) {
					rows = db
						.query(
							`SELECT c.path, c.start_line, c.end_line, c.content, c.qualified_name, c.signature, -1.0 as rank
               FROM l2j_chunks c
               WHERE (c.content LIKE ? OR c.qualified_name LIKE ?) AND (c.path LIKE ? OR replace(c.path, '\\', '/') LIKE ?)
               LIMIT ?`,
						)
						.all(likePattern, likePattern, filterPattern, filterPattern, limit);
				} else {
					rows = db
						.query(
							`SELECT c.path, c.start_line, c.end_line, c.content, c.qualified_name, c.signature, -1.0 as rank
               FROM l2j_chunks c
               WHERE c.content LIKE ? OR c.qualified_name LIKE ?
               LIMIT ?`,
						)
						.all(likePattern, likePattern, limit);
				}
			}

			rows.forEach((r, idx) => {
				const rrfScore = 1.0 / (60 + (idx + 1));
				allHits.push({
					project: slug,
					score: rrfScore,
					path: r.path || "",
					startLine: r.start_line,
					endLine: r.end_line,
					qualifiedName: r.qualified_name || "",
					signature: r.signature || "",
					content: r.content || "",
				});
			});

			db.close();
		} catch (err) {
			process.stderr.write(`[Hermes-MCP-WARN] Erro ao pesquisar no projeto ${slug}: ${err}\n`);
		}
	}

	if (allHits.length === 0) {
		return `Nenhum código encontrado para: "${query}" nos projetos ativos (${slugs.join(", ")}).`;
	}

	allHits.sort((a, b) => b.score - a.score);
	const selected = allHits.slice(0, limit);

	const lines: string[] = [
		`Resultados de code_search multi-projeto para "${query}" (${selected.length} de ${slugs.length} projetos ativos):`,
		"",
	];

	selected.forEach((h, idx) => {
		lines.push(`#${idx + 1} score=${h.score.toFixed(4)} [${h.project}] ${h.path}:${h.startLine ?? "?"}`);
		lines.push(`   ${h.qualifiedName} :: ${h.signature}`);
		const preview = h.content
			.split("\n")
			.slice(0, 15)
			.map((l) => `   ${l}`)
			.join("\n");
		lines.push(preview);
		lines.push("");
	});

	return lines.join("\n").trimEnd();
}

// Árvore esqueleto da AST sem carregar corpos de métodos
function handleAstSkeletonTree(targetPath: string, project?: string): string {
	const slugs = project ? [project] : getActiveSlugs();
	const lines: string[] = [];

	for (const slug of slugs) {
		const dbPath = join(projectsDir, slug, "hermes.db");
		if (!existsSync(dbPath)) continue;

		try {
			const db = new Database(dbPath, { readonly: true });
			const cleanPath = targetPath.replace(/^.*[\\/]/, "");
			const symbols = db
				.query(
					`SELECT s.kind, s.qualified_name, s.signature, s.start_line, s.end_line, f.path as file_path
           FROM l2j_symbols s
           JOIN l2j_files f ON s.file_id = f.id
           WHERE f.path LIKE ? OR s.qualified_name LIKE ?
           ORDER BY f.path, s.start_line
           LIMIT 100`,
				)
				.all(`%${cleanPath}%`, `%${cleanPath}%`) as any[];

		if (symbols.length > 0) {
				lines.push(`[${slug}] Estrutura AST para: ${targetPath}`);
				let currentFile = "";
				for (const sym of symbols) {
					if (sym.file_path !== currentFile) {
						currentFile = sym.file_path;
						lines.push(`\n📄 ${currentFile}:`);
					}
					lines.push(`   ${sym.kind} ${sym.qualified_name} (L${sym.start_line}-L${sym.end_line})`);
					if (sym.signature) {
						lines.push(`     sig: ${sym.signature}`);
					}
				}
			}
			db.close();
		} catch (err) {
			lines.push(`[${slug}] Erro ao ler AST: ${err}`);
		}
	}

	if (lines.length === 0) {
		return `Nenhum símbolo AST encontrado para o caminho "${targetPath}".`;
	}

	return lines.join("\n");
}

// Predição de contexto (callers, callees e dependências)
function handleAstPredictContext(target: string, project?: string): string {
	const slugs = project ? [project] : getActiveSlugs();
	const lines: string[] = [];

	for (const slug of slugs) {
		const dbPath = join(projectsDir, slug, "hermes.db");
		if (!existsSync(dbPath)) continue;

		try {
			const db = new Database(dbPath, { readonly: true });
			const cleanTarget = target.trim();

			const deps = db
				.query(
					`SELECT s1.qualified_name as caller, s2.qualified_name as callee, d.dep_kind
           FROM l2j_symbol_deps d
           JOIN l2j_symbols s1 ON d.from_symbol_id = s1.id
           JOIN l2j_symbols s2 ON d.to_symbol_id = s2.id
           WHERE s1.qualified_name LIKE ? OR s2.qualified_name LIKE ?
           LIMIT 30`,
				)
				.all(`%${cleanTarget}%`, `%${cleanTarget}%`) as any[];

			if (deps.length > 0) {
				lines.push(`[${slug}] Grafo de Dependências para: ${target}`);
				for (const d of deps) {
					lines.push(`   - ${d.caller} --(${d.dep_kind})--> ${d.callee}`);
				}
			}
			db.close();
		} catch (err) {
			lines.push(`[${slug}] Erro ao predizer contexto: ${err}`);
		}
	}

	if (lines.length === 0) {
		return `Nenhum caller ou callee registrado no grafo para "${target}".`;
	}

	return lines.join("\n");
}

// L0: Visão Global ultracompacta (< 250 tokens)
function handleGetProjectL0Index(project?: string): string {
	const slugs = project ? [project] : getActiveSlugs();
	const lines: string[] = ["=== L0: MAPA ESTRUTURAL DE CLUSTERS ==="];

	for (const slug of slugs) {
		const dbPath = join(projectsDir, slug, "hermes.db");
		if (!existsSync(dbPath)) continue;

		try {
			const db = new Database(dbPath, { readonly: true });
			const files = db.query("SELECT path FROM l2j_files").all() as { path: string }[];
			const clusterMap: Record<string, { desc: string; count: number }> = {};

			for (const f of files) {
				const norm = f.path.split("\\").join("/");
				let cid = "root";
				let desc = "Configurações, scripts e documentações raiz";

				if (norm.includes("apps/web")) {
					cid = "web-ui";
					desc = "Interface React 19, componentes de chat, layout e visualizações";
				} else if (norm.includes("apps/cli")) {
					cid = "cli-host";
					desc = "Launcher CLI, servidor MCP Hermes e scripts operacionais";
				} else if (norm.includes("apps/desktop")) {
					cid = "desktop";
					desc = "Empacotamento e container desktop Electron/Tauri";
				} else if (norm.includes("packages/server")) {
					cid = "server-engine";
					desc = "Host do Pi harness, endpoints RPC e orquestração de sessões";
				} else if (norm.includes("packages/contracts")) {
					cid = "contracts";
					desc = "Definições de tipos, DTOs e wire contracts compartilhados";
				} else if (norm.includes("packages/resource-renderers")) {
					cid = "renderers";
					desc = "Cards e renderizadores visuais de ferramentas ricas";
				} else if (norm.includes("packages/ui")) {
					cid = "ui-kit";
					desc = "Primitivas de design system baseadas em Radix/Tailwind";
				} else if (norm.includes("packages/shared")) {
					cid = "shared-utils";
					desc = "Utilitários compartilhados, logging e helpers de runtime";
				} else if (norm.includes("packages/locales")) {
					cid = "locales";
					desc = "Catálogos e internacionalização i18n";
				} else if (norm.includes("e2e")) {
					cid = "e2e-tests";
					desc = "Suítes de testes de integração, regressão e workflows";
				}

				const entry = clusterMap[cid];
				if (!entry) {
					clusterMap[cid] = { desc, count: 1 };
				} else {
					entry.count++;
				}
			}

			lines.push(`\n[Projeto: ${slug}]`);
			for (const [cid, info] of Object.entries(clusterMap)) {
				lines.push(`• [${cid}] (${info.count} arquivos): ${info.desc}`);
			}
			db.close();
		} catch (err) {
			lines.push(`[${slug}] Erro ao gerar L0: ${err}`);
		}
	}

	lines.push("\nInstrução L0: Chame expand_graph_node(cluster_id) para explorar um domínio específico em L1.");
	return lines.join("\n");
}

// L1: Expansão de Cluster / Sub-grafo (300 - 800 tokens)
function handleExpandGraphNode(clusterId: string, project?: string): string {
	const slugs = project ? [project] : getActiveSlugs();
	const cleanId = clusterId.trim().toLowerCase();
	const lines: string[] = [`=== L1: EXPANSÃO DO CLUSTER [${clusterId}] ===`];

	const clusterPatterns: Record<string, string> = {
		"web-ui": "%apps/web%",
		"cli-host": "%apps/cli%",
		"desktop": "%apps/desktop%",
		"server-engine": "%packages/server%",
		"contracts": "%packages/contracts%",
		"renderers": "%packages/resource-renderers%",
		"ui-kit": "%packages/ui%",
		"shared-utils": "%packages/shared%",
		"locales": "%packages/locales%",
		"e2e-tests": "%e2e%",
		"root": "%",
	};

	const pattern = clusterPatterns[cleanId] || `%${cleanId}%`;

	for (const slug of slugs) {
		const dbPath = join(projectsDir, slug, "hermes.db");
		if (!existsSync(dbPath)) continue;

		try {
			const db = new Database(dbPath, { readonly: true });
			const symbols = db
				.query(
					`SELECT s.kind, s.qualified_name, s.signature, s.start_line, s.end_line, f.path as file_path
           FROM l2j_symbols s
           JOIN l2j_files f ON s.file_id = f.id
           WHERE (f.path LIKE ? OR replace(f.path, '\\', '/') LIKE ?)
           ORDER BY f.path, s.start_line
           LIMIT 40`,
				)
				.all(pattern, pattern) as any[];

			if (symbols.length > 0) {
				lines.push(`\n[${slug}] Símbolos e Contratos Principais em ${clusterId}:`);
				let currentFile = "";
				for (const sym of symbols) {
					const relPath = sym.file_path.split("\\").join("/");
					if (relPath !== currentFile) {
						currentFile = relPath;
						lines.push(`\n📁 ${currentFile}:`);
					}
					lines.push(`  - ${sym.kind} ${sym.qualified_name} (L${sym.start_line}-L${sym.end_line})`);
					if (sym.signature) {
						lines.push(`    sig: ${sym.signature}`);
					}
				}
			} else {
				lines.push(`[${slug}] Nenhum símbolo encontrado para o cluster '${clusterId}'.`);
			}
			db.close();
		} catch (err) {
			lines.push(`[${slug}] Erro ao expandir nó: ${err}`);
		}
	}

	lines.push("\nInstrução L1: Chame code_search com escopo do símbolo ou nó desejado para obter L2.");
	return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Gestão de Skills (compatibilidade nativa com FindSkillsTool do Hermes e ThinkRail)
// ---------------------------------------------------------------------------

interface SkillRepoResult {
	fullName: string;
	description: string;
	stars: number;
	url: string;
	topics: string[];
	source: string;
	installCmd: string;
	installs: number;
}

async function handleFindSkills(query: string, limit = 10, minStars = 50): Promise<string> {
	const cleanQuery = query.trim();
	if (!cleanQuery) return "Erro: parâmetro 'query' obrigatório.";

	const results: SkillRepoResult[] = [];

	// Fonte 1: skills.sh registry
	try {
		const encQuery = encodeURIComponent(cleanQuery);
		const res = await fetch(`https://skills.sh/api/v1/skills/search?q=${encQuery}&limit=${limit}`, {
			headers: { Accept: "application/json", "User-Agent": "hermes-mcp/3.0" },
			signal: AbortSignal.timeout(10000),
		});
		if (res.ok) {
			const data: any = await res.json();
			const items = Array.isArray(data) ? data : data?.skills || data?.results || [];
			for (const item of items) {
				if (item.isDuplicate === true || item.isDuplicate === "true") continue;
				const name = item.name || item.slug;
				if (!name) continue;
				const installs = Number(item.installs) || 0;
				results.push({
					fullName: item.source || name,
					description: item.description || name,
					stars: Math.floor(installs / 10),
					url: `https://skills.sh/${item.id || item.slug || ""}`,
					topics: [],
					source: "skills.sh",
					installCmd: item.installUrl ? `npx skills add ${item.installUrl}` : "",
					installs,
				});
			}
		}
	} catch {}

	// Fonte 2: GitHub Search API
	try {
		const encQuery = encodeURIComponent(`${cleanQuery} stars:>${minStars}`);
		const headers: Record<string, string> = {
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "hermes-mcp/3.0",
		};
		const ghToken = process.env.GITHUB_TOKEN;
		if (ghToken) headers.Authorization = `token ${ghToken}`;

		const res = await fetch(`https://api.github.com/search/repositories?q=${encQuery}&sort=stars&order=desc&per_page=${limit}`, {
			headers,
			signal: AbortSignal.timeout(12000),
		});
		if (res.ok) {
			const data: any = await res.json();
			const items = data.items || [];
			for (const item of items) {
				results.push({
					fullName: item.full_name,
					description: item.description || "",
					stars: item.stargazers_count || 0,
					url: item.html_url,
					topics: Array.isArray(item.topics) ? item.topics.slice(0, 8) : [],
					source: "github",
					installCmd: `git clone ${item.html_url}`,
					installs: 0,
				});
			}
		}
	} catch {}

	// Deduplicação e ordenação por estrelas
	const seen = new Set<string>();
	const deduped: SkillRepoResult[] = [];
	for (const r of results) {
		const key = r.fullName.toLowerCase();
		if (!seen.has(key) && r.stars >= minStars) {
			seen.add(key);
			deduped.push(r);
		}
	}
	deduped.sort((a, b) => b.stars - a.stars);
	const finalResults = deduped.slice(0, limit);

	if (finalResults.length === 0) {
		return `Nenhum resultado com ★${minStars}+ para: "${cleanQuery}". Tente reduzir min_stars ou usar termos mais amplos.`;
	}

	const lines: string[] = [
		`🔍 Resultados para "${cleanQuery}" (${finalResults.length} repos/skills ordenados por ★):`,
		"",
	];

	const hot = finalResults.filter((r) => r.stars >= 10000);
	if (hot.length > 0) {
		lines.push("🔥 ALTAMENTE RECOMENDADOS (★10K+ — referência da comunidade):");
		hot.forEach((r) => {
			lines.push(`  • ${r.fullName} (★${r.stars.toLocaleString()})${r.installs > 0 ? ` | ${r.installs} installs` : ""}`);
			if (r.description) lines.push(`    ${r.description.slice(0, 120)}`);
			lines.push(`    URL: ${r.url}`);
			lines.push(`    Comando Hermes: install_skill(repo_url="${r.url}")`);
			lines.push("");
		});
	}

	const recommended = finalResults.filter((r) => r.stars >= 1000 && r.stars < 10000);
	if (recommended.length > 0) {
		lines.push("⭐ RECOMENDADOS (★1K-10K — validados pela comunidade):");
		recommended.forEach((r) => {
			lines.push(`  • ${r.fullName} (★${r.stars.toLocaleString()})${r.installs > 0 ? ` | ${r.installs} installs` : ""}`);
			if (r.description) lines.push(`    ${r.description.slice(0, 120)}`);
			lines.push(`    URL: ${r.url}`);
			lines.push(`    Comando Hermes: install_skill(repo_url="${r.url}")`);
			lines.push("");
		});
	}

	const standard = finalResults.filter((r) => r.stars < 1000);
	if (standard.length > 0) {
		lines.push("👍 OUTRAS SKILLS E REPOSITÓRIOS RELEVANTES:");
		standard.forEach((r) => {
			lines.push(`  • ${r.fullName} (★${r.stars})${r.installs > 0 ? ` | ${r.installs} installs` : ""}`);
			if (r.description) lines.push(`    ${r.description.slice(0, 120)}`);
			lines.push(`    URL: ${r.url}`);
			lines.push("");
		});
	}

	return lines.join("\n").trimEnd();
}

function findSkillDirsRecursively(dir: string, depth = 0, maxDepth = 4): string[] {
	if (depth > maxDepth || !existsSync(dir)) return [];
	const results: string[] = [];
	try {
		const entries = readdirSync(dir, { withFileTypes: true });
		const hasSkillMd = entries.some((e) => e.isFile() && e.name.toLowerCase() === "skill.md");
		if (hasSkillMd) {
			results.push(dir);
		}
		for (const e of entries) {
			if (e.isDirectory() && !e.name.startsWith(".")) {
				results.push(...findSkillDirsRecursively(join(dir, e.name), depth + 1, maxDepth));
			}
		}
	} catch {}
	return results;
}

function generateAutoSkillMd(cloneDir: string, skillName: string, repoUrl: string): string {
	let description = `Integration and tooling for ${skillName} cloned from ${repoUrl}`;
	let readmeContent = "";

	try {
		const files = readdirSync(cloneDir);
		const readmeName = files.find((f) => /^readme(\.(md|markdown|txt))?$/i.test(f));
		if (readmeName) {
			readmeContent = readFileSync(join(cloneDir, readmeName), "utf8").trim();
			const firstLines = readmeContent
				.split("\n")
				.map((l) => l.trim())
				.filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("[") && !l.startsWith("!"))
				.slice(0, 3)
				.join(" ");
			if (firstLines) {
				description = firstLines.slice(0, 200).replace(/"/g, "'");
			}
		}
	} catch {}

	let detectedStack = "Generic CLI / Script repository";
	let usageHint = "Examine repo files or run main script via bash/python.";

	try {
		const files = readdirSync(cloneDir);
		if (files.includes("pyproject.toml") || files.includes("requirements.txt") || files.includes("setup.py")) {
			detectedStack = "Python";
			usageHint = "Use Python/pip/uv to execute package tools, scripts or import the module.";
		} else if (files.includes("package.json")) {
			detectedStack = "Node.js / Bun / TypeScript";
			usageHint = "Use bun/npm to run scripts, CLI commands or import modules.";
		} else if (files.includes("Cargo.toml")) {
			detectedStack = "Rust";
			usageHint = "Compile or run using cargo run/build.";
		}
	} catch {}

	const excerpt = readmeContent ? readmeContent.slice(0, 1500) : "No README provided.";

	return [
		"---",
		`name: ${skillName}`,
		`description: ${description}`,
		"---",
		"",
		`# ${skillName}`,
		"",
		`Automated Skill scaffolded by ThinkRail/Hermes from [${repoUrl}](${repoUrl}).`,
		"",
		"## Environment & Stack",
		`- **Type**: ${detectedStack}`,
		`- **Repository URL**: ${repoUrl}`,
		`- **Local Path**: Resolved via skill folder`,
		"",
		"## How to Use this Skill",
		usageHint,
		"",
		"Whenever interacting with this tool:",
		"1. Inspect the source repository files in this skill directory using bash/read tools.",
		"2. Run scripts or CLI commands directly in the skill folder when needed.",
		"",
		"## Repository Overview (README Excerpt)",
		"```markdown",
		excerpt,
		"```",
		"",
	].join("\n");
}

// Instalar skill clonando repositório para ~/.agents/skills/
function handleInstallSkill(repoUrl: string, skillName?: string): string {
	const cleanUrl = repoUrl.trim().replace(/\/+$/, "");
	if (!cleanUrl) return "Erro: parâmetro 'repo_url' obrigatório.";

	const rawName = cleanUrl.split("/").pop()?.replace(/\.git$/, "") || `skill_${Date.now()}`;
	const safeRepoName = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
	const tmpCloneDir = join(userHome, `.hermes_clone_tmp_${safeRepoName}_${Date.now()}`);

	try {
		// Clone shallow com timeout
		const cloneProc = Bun.spawnSync(["git", "clone", "--depth", "1", cleanUrl, tmpCloneDir], {
			timeout: 60000,
		});
		if (!cloneProc.success) {
			const errText = cloneProc.stderr.toString("utf-8");
			return `Erro ao clonar repositório ${cleanUrl}: ${errText}`;
		}

		// Localizar pastas que contêm SKILL.md
		const skillDirs = findSkillDirsRecursively(tmpCloneDir);
		let targetDir = tmpCloneDir;
		let isAutoScaffolded = false;

		if (skillDirs.length > 0 && skillDirs[0]) {
			targetDir = skillDirs[0];
			const reqSkill = skillName?.trim();
			if (reqSkill) {
				const matched = skillDirs.find((d) => basename(d).toLowerCase().includes(reqSkill.toLowerCase()));
				if (matched) targetDir = matched;
			}
		} else {
			// Auto-scaffolding: cria SKILL.md diretamente no repositório clonado
			isAutoScaffolded = true;
			const effectiveName = (skillName?.trim() || safeRepoName).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
			const scaffoldedContent = generateAutoSkillMd(tmpCloneDir, effectiveName, cleanUrl);
			writeFileSync(join(tmpCloneDir, "SKILL.md"), scaffoldedContent, "utf8");
		}

		const reqSkill = skillName?.trim();
		const finalSkillName = (reqSkill || (isAutoScaffolded ? safeRepoName : basename(targetDir)))
			.toLowerCase()
			.replace(/[^a-z0-9_-]/g, "-");

		if (!existsSync(agentSkillsDir)) {
			mkdirSync(agentSkillsDir, { recursive: true });
		}
		const destPath = join(agentSkillsDir, finalSkillName);

		if (existsSync(destPath)) {
			rmSync(tmpCloneDir, { recursive: true, force: true });
			return `A skill '${finalSkillName}' já está instalada em ${destPath}. Para reinstalar, remova ou desative primeiro.`;
		}

		// Copia para ~/.agents/skills/
		cpSync(targetDir, destPath, { recursive: true });
		rmSync(tmpCloneDir, { recursive: true, force: true });

		const messages = [
			`✅ Skill '${finalSkillName}' instalada com sucesso no ThinkRail!`,
			`📂 Diretório: ${destPath}`,
			`Origem: ${cleanUrl}`,
		];

		if (isAutoScaffolded) {
			messages.push("✨ O repositório não possuía SKILL.md prévio. Um SKILL.md inteligente com documentação, stack detectada e instruções operacionais foi gerado automaticamente!");
		}

		messages.push("A skill está agora ativa e disponível imediatamente nas conversas do Pi/ThinkRail.");

		return messages.join("\n");
	} catch (err: any) {
		if (existsSync(tmpCloneDir)) {
			rmSync(tmpCloneDir, { recursive: true, force: true });
		}
		return `Falha ao instalar skill: ${err.message}`;
	}
}

// Gerenciar skills do ThinkRail (listar, ativar, desativar, remover)
function handleManageSkills(action: string, skillName?: string): string {
	if (!existsSync(agentSkillsDir)) {
		mkdirSync(agentSkillsDir, { recursive: true });
	}
	if (!existsSync(disabledSkillsDir)) {
		mkdirSync(disabledSkillsDir, { recursive: true });
	}

	switch (action) {
		case "list": {
			const activeEntries = readdirSync(agentSkillsDir, { withFileTypes: true })
				.filter((e) => e.isDirectory() && existsSync(join(agentSkillsDir, e.name, "SKILL.md")))
				.map((e) => ({ name: e.name, active: true, path: join(agentSkillsDir, e.name) }));

			const disabledEntries = readdirSync(disabledSkillsDir, { withFileTypes: true })
				.filter((e) => e.isDirectory() && existsSync(join(disabledSkillsDir, e.name, "SKILL.md")))
				.map((e) => ({ name: e.name, active: false, path: join(disabledSkillsDir, e.name) }));

			const all = [...activeEntries, ...disabledEntries].sort((a, b) => a.name.localeCompare(b.name));

			if (all.length === 0) {
				return "Nenhuma skill encontrada em ~/.agents/skills/";
			}

			const lines = [
				`Skills do ThinkRail (${all.length} encontradas, ${activeEntries.length} ativas):`,
				"",
			];
			all.forEach((s, idx) => {
				const statusTag = s.active ? "[🟢 ATIVA]" : "[⚪ DESATIVADA]";
				lines.push(`${idx + 1}. ${statusTag} ${s.name}`);
			});
			lines.push("");
			lines.push("Use action='disable' para desativar, action='enable' para ativar, ou action='remove' para excluir.");
			return lines.join("\n");
		}

		case "disable": {
			if (!skillName) return "Parâmetro 'skill_name' obrigatório para desativar.";
			const currentPath = join(agentSkillsDir, skillName);
			if (!existsSync(currentPath)) {
				return `Skill '${skillName}' não encontrada em ~/.agents/skills/ (talvez já esteja desativada).`;
			}
			const destPath = join(disabledSkillsDir, skillName);
			if (existsSync(destPath)) rmSync(destPath, { recursive: true, force: true });
			renameSync(currentPath, destPath);
			return `Skill '${skillName}' foi DESATIVADA com sucesso. Ela não será mais carregada pelo Pi.`;
		}

		case "enable": {
			if (!skillName) return "Parâmetro 'skill_name' obrigatório para ativar.";
			const currentPath = join(disabledSkillsDir, skillName);
			if (!existsSync(currentPath)) {
				return `Skill '${skillName}' não encontrada em ~/.agents/disabled_skills/ (talvez já esteja ativa).`;
			}
			const destPath = join(agentSkillsDir, skillName);
			if (existsSync(destPath)) rmSync(destPath, { recursive: true, force: true });
			renameSync(currentPath, destPath);
			return `Skill '${skillName}' foi ATIVADA com sucesso no ThinkRail.`;
		}

		case "remove": {
			if (!skillName) return "Parâmetro 'skill_name' obrigatório para remover.";
			const activePath = join(agentSkillsDir, skillName);
			const disabledPath = join(disabledSkillsDir, skillName);
			if (existsSync(activePath)) {
				rmSync(activePath, { recursive: true, force: true });
				return `Skill '${skillName}' removida com sucesso de ~/.agents/skills/.`;
			} else if (existsSync(disabledPath)) {
				rmSync(disabledPath, { recursive: true, force: true });
				return `Skill '${skillName}' removida com sucesso de ~/.agents/disabled_skills/.`;
			}
			return `Skill '${skillName}' não encontrada para remoção.`;
		}

		default:
			return `Ação desconhecida '${action}'. Use: list | enable | disable | remove`;
	}
}

// Gerenciador de projetos do Hermes
function handleProjectManager(action: string, slug?: string): string {
	switch (action) {
		case "list": {
			const available = getAvailableProjects();
			const active = new Set(getActiveSlugs());
			const lines = [`Projetos Hermes disponíveis (${available.length}):`, ""];
			available.forEach((p, idx) => {
				const isActive = active.has(p.slug) ? " [sessão ativa]" : "";
				const dbInfo = p.hasDb ? `[DB ok, ${p.sizeKb} KB]` : "[SEM DB]";
				lines.push(`${idx + 1}. ${p.slug} ${dbInfo}${isActive}`);
			});
			return lines.join("\n");
		}
		case "activate": {
			if (!slug) return "Parâmetro 'slug' obrigatório para ativar.";
			const active = getActiveSlugs();
			if (!active.includes(slug)) {
				active.push(slug);
				writeFileSync(activeProjectsFile, JSON.stringify({ activeSlugs: active }, null, 2));
				return `Projeto '${slug}' ativado com sucesso no RAG.`;
			}
			return `Projeto '${slug}' já estava ativo.`;
		}
		case "deactivate": {
			if (!slug) return "Parâmetro 'slug' obrigatório para desativar.";
			const active = getActiveSlugs().filter((s) => s !== slug);
			writeFileSync(activeProjectsFile, JSON.stringify({ activeSlugs: active }, null, 2));
			return `Projeto '${slug}' desativado do RAG.`;
		}
		default:
			return `Ação desconhecida '${action}'. Use: list | activate | deactivate`;
	}
}

// Handler para upsert de chunk via MCP
function handleUpsertChunk(params: any): string {
	try {
		const project = (params.project || getActiveSlugs()[0] || "project-thinkrail").toString();
		const chunkId = (params.chunk_id || params.chunkId || params.id || "").toString();
		if (!chunkId) return "Erro: parâmetro 'chunk_id' obrigatório.";

		const projectDir = join(projectsDir, project);
		try { mkdirSync(projectDir, { recursive: true }); } catch {}
		const dbPath = join(projectDir, "hermes.db");

		const db = new Database(dbPath);
		db.run("PRAGMA journal_mode = WAL;");
		db.run("PRAGMA synchronous = NORMAL;");

		// Garante tabelas mínimas
		db.run(`CREATE TABLE IF NOT EXISTS l2j_files (
			id TEXT PRIMARY KEY,
			project_name TEXT NOT NULL,
			path TEXT NOT NULL,
			sha256 TEXT NOT NULL,
			mtime_ms INTEGER NOT NULL,
			indexed_at INTEGER NOT NULL
		);`);

		db.run(`CREATE TABLE IF NOT EXISTS l2j_chunks (
			id TEXT PRIMARY KEY,
			file_id TEXT NOT NULL,
			symbol_id TEXT,
			project_name TEXT NOT NULL,
			path TEXT NOT NULL,
			chunk_kind TEXT NOT NULL,
			package_name TEXT,
			qualified_name TEXT NOT NULL,
			signature TEXT,
			content TEXT NOT NULL,
			keywords TEXT,
			start_line INTEGER,
			end_line INTEGER,
			token_estimate INTEGER,
			embedding_model TEXT,
			embedding_dim INTEGER,
			created_at INTEGER NOT NULL
		);`);

		db.run(`CREATE TABLE IF NOT EXISTS l2j_embeddings_cache (
			rowid INTEGER PRIMARY KEY,
			cache_key TEXT,
			model TEXT,
			dim INTEGER,
			vector_blob BLOB,
			created_at INTEGER
		);`);

		db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS l2j_chunk_fts USING fts5(
			chunk_id UNINDEXED,
			project_name UNINDEXED,
			file_id UNINDEXED,
			path UNINDEXED,
			qualified_name,
			signature,
			content,
			keywords,
			tokenize = 'porter unicode61'
		);`);

		const meta = params.metadata || {};
		const filePath = (meta.path || meta.file || meta.filePath || "").toString();
		const content = (params.content || params.text || "").toString();
		const qualifiedName = (meta.qualified_name || meta.qualifiedName || meta.symbol || "").toString();
		const signature = (meta.signature || "").toString();
		const startLine = meta.start_line || meta.startLine || null;
		const endLine = meta.end_line || meta.endLine || null;
		const tokenEstimate = meta.token_estimate || Math.max(1, Math.ceil(content.length / 4));
		const chunkKind = (params.chunk_kind || meta.chunk_kind || "code").toString();
		const now = Date.now();

		// Determina file_id como sha256(project|path) para compatibilidade com reindex
		const fileIdSeed = `${project}|${filePath}`;
		const fileId = createHash("sha256").update(fileIdSeed).digest("hex");
		const fileSha = createHash("sha256").update(content || filePath).digest("hex");

		// Inserir/atualizar l2j_files (registro leve)
		db.run(
			`INSERT OR REPLACE INTO l2j_files(id, project_name, path, sha256, mtime_ms, indexed_at)
			 VALUES (?, ?, ?, ?, ?, ?);`,
			[fileId, project, filePath || "", fileSha, now, now],
		);

		// Remove qualquer chunk FTS pré-existente com mesmo id
		try { db.run("DELETE FROM l2j_chunk_fts WHERE chunk_id = ?;", chunkId); } catch {}
		try { db.run("DELETE FROM l2j_chunks WHERE id = ?;", chunkId); } catch {}

		// Insere o chunk principal
		db.run(
			`INSERT OR REPLACE INTO l2j_chunks(id, file_id, symbol_id, project_name, path, chunk_kind, package_name, qualified_name, signature, content, keywords, start_line, end_line, token_estimate, embedding_model, embedding_dim, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
			[
				chunkId,
				fileId,
				null,
				project,
				filePath || "",
				chunkKind,
				"",
				qualifiedName || filePath || chunkId,
				signature || "",
				content || "",
				"",
				startLine,
				endLine,
				tokenEstimate,
				(params.embedding_model || "jina-embeddings-v2-base-code"),
				(params.embedding && Array.isArray(params.embedding)) ? params.embedding.length : (params.embedding_dim || 0),
				now,
			],
		);

		// Atualiza FTS
		db.run(
			`INSERT INTO l2j_chunk_fts(chunk_id, project_name, file_id, path, qualified_name, signature, content, keywords)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
			[chunkId, project, fileId, filePath || "", qualifiedName || filePath || "", signature || "", content || "", ""],
		);

		// Se embedding fornecido, insere em l2j_embeddings_cache
		if (params.embedding && Array.isArray(params.embedding) && params.embedding.length > 0) {
			try {
				const f32 = new Float32Array(params.embedding);
				const blob = Buffer.from(f32.buffer);
				// Use INSERT OR REPLACE para evitar UNIQUE constraint failures em cache_key
				db.run(
					`INSERT OR REPLACE INTO l2j_embeddings_cache(cache_key, model, dim, vector_blob, created_at) VALUES (?, ?, ?, ?, ?);`,
					[chunkId, params.embedding_model || "jina-embeddings-v2-base-code", f32.length, blob, now],
				);
			} catch (e) {
				// Não falha a operação principal de upsert de chunk se o blob falhar
				console.error("[hermes-mcp] embedding insert failed:", e);
			}
		}

		db.close();
		return `ok: upserted ${chunkId}`;
	} catch (err: any) {
		return `error: ${err?.message || err}`;
	}
}

// Definição das ferramentas MCP
const TOOLS = [
	{
		name: "get_project_l0_index",
		description: "CAMADA L0: Visão global ultra-compacta (< 250 tokens) de clusters e domínios do projeto para contenção de tokens.",
		inputSchema: {
			type: "object",
			properties: {
				project: { type: "string", description: "Slug do projeto (opcional, busca nos ativos se omitido)." },
			},
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "expand_graph_node",
		description: "CAMADA L1: Expande um cluster/sub-grafo específico (300-800 tokens) com assinaturas AST e interfaces.",
		inputSchema: {
			type: "object",
			properties: {
				cluster_id: { type: "string", description: "ID do cluster identificado em L0 (ex: 'web-ui', 'server-engine', 'contracts')." },
				project: { type: "string", description: "Slug do projeto (opcional)." },
			},
			required: ["cluster_id"],
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "code_search",
		description: "CAMADA L2: Busca semântica + FTS5 + RRF cirúrgica, com suporte opcional a cluster_id para contenção estrita de tokens.",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string", description: "Termo de busca, método, classe ou padrão arquitetural." },
				limit: { type: "number", description: "Limite de resultados (padrão 10)." },
				cluster_id: { type: "string", description: "Filtro de cluster L0 (ex: 'web-ui', 'server-engine', 'contracts') para isolamento estrito de contexto." },
			},
			required: ["query"],
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "ast_skeleton_tree",
		description: "Retorna a estrutura arquitetural compacta (classes, métodos, assinaturas) de um arquivo ou caminho sem carregar corpos de métodos.",
		inputSchema: {
			type: "object",
			properties: {
				target_path: { type: "string", description: "Caminho ou nome do arquivo para inspecionar a AST." },
				project: { type: "string", description: "Slug do projeto (opcional, busca nos ativos se omitido)." },
			},
			required: ["target_path"],
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "ast_predict_context",
		description: "Identifica callers (quem chama) e callees (quem é chamado) de um símbolo ou arquivo no grafo de dependências.",
		inputSchema: {
			type: "object",
			properties: {
				target: { type: "string", description: "Nome do método, classe ou símbolo para prever o contexto." },
				project: { type: "string", description: "Slug do projeto (opcional)." },
			},
			required: ["target"],
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "hermes_project_manager",
		description: "Gerencia os projetos registrados no Hermes RAG (listar, ativar, desativar).",
		inputSchema: {
			type: "object",
			properties: {
				action: { type: "string", enum: ["list", "activate", "deactivate"], description: "Ação a executar." },
				slug: { type: "string", description: "Slug do projeto para ativar/desativar." },
			},
			required: ["action"],
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "find_skills",
		description: "Busca skills e repositórios relevantes por estrelas e installs no GitHub e skills.sh para o ThinkRail/Hermes.",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string", description: "Termo de busca, stack ou tópico (ex: git workflow, prisma, react testing, devops)." },
				limit: { type: "number", description: "Número máximo de resultados (padrão 10)." },
				min_stars: { type: "number", description: "Filtro de estrelas mínimas no GitHub (padrão 50)." },
			},
			required: ["query"],
		},
		annotations: { readOnlyHint: true },
	},
	{
		name: "install_skill",
		description: "Instala uma Agent Skill no ThinkRail clonando repositório GitHub e copiando o SKILL.md para ~/.agents/skills/.",
		inputSchema: {
			type: "object",
			properties: {
				repo_url: { type: "string", description: "URL do repositório GitHub da skill (ex: https://github.com/owner/repo)." },
				skill_name: { type: "string", description: "Nome da subpasta da skill (opcional, detecta automaticamente o SKILL.md)." },
			},
			required: ["repo_url"],
		},
	},
	{
		name: "manage_skills",
		description: "Gerencia skills no ThinkRail: listar com status (ativas/desativadas), ativar, desativar ou remover.",
		inputSchema: {
			type: "object",
			properties: {
				action: { type: "string", enum: ["list", "enable", "disable", "remove"], description: "Ação a executar." },
				skill_name: { type: "string", description: "Nome da skill para ativar, desativar ou remover." },
			},
			required: ["action"],
		},
	},
	// escrita: upsert_chunk aceita { project, chunk_id, embedding, metadata, content }
	{
		name: "upsert_chunk",
		description: "Escreve um chunk + embedding no Hermes DB (l2j_chunks + l2j_embeddings_cache) via MCP.",
		inputSchema: {
			type: "object",
			properties: {
				project: { type: "string" },
				chunk_id: { type: "string" },
				embedding: { type: "array", items: { type: "number" } },
				metadata: { type: "object" },
				content: { type: "string" },
			},
			required: ["chunk_id"],
		},
	},
];

// Loop JSON-RPC STDIO
let buffer = "";
process.stdin.setEncoding("utf-8");

process.stdin.on("data", (chunk: string) => {
	buffer += chunk;
	const lines = buffer.split("\n");
	buffer = lines.pop() || "";

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) continue;

		try {
			const req = JSON.parse(line) as JsonRpcRequest;
			handleMessage(req);
		} catch (err) {
			process.stderr.write(`[Hermes-MCP-ERROR] Falha ao processar linha: ${err}\n`);
		}
	}
});

function handleMessage(req: JsonRpcRequest) {
	switch (req.method) {
		case "initialize":
			sendResponse(req.id, {
				protocolVersion: "2024-11-05",
				capabilities: {
					tools: {},
				},
				serverInfo: {
					name: "hermes-rag",
					version: "3.0.0-native",
				},
			});
			break;

		case "notifications/initialized":
			// Handshake concluído
			break;

		case "ping":
			sendResponse(req.id, {});
			break;

		case "tools/list":
			sendResponse(req.id, {
				tools: TOOLS,
			});
			break;

		case "tools/call": {
			const toolName = req.params?.name;
			const args = req.params?.arguments || {};

			// Fast-path: upsert_chunk is a write operation; handle it directly and return immediately
			if (toolName === "upsert_chunk") {
				try {
					const res = handleUpsertChunk(args.arguments || args);
					sendResponse(req.id, { content: [{ type: "text", text: res }], isError: false });
				} catch (e: any) {
					sendResponse(req.id, { content: [{ type: "text", text: `Erro ao executar upsert_chunk: ${e?.message || e}` }], isError: true });
				}
				return;
			}

			(async () => {
				try {
					let resultText = "";
					if (toolName === "get_project_l0_index") {
						resultText = handleGetProjectL0Index(args.project);
					} else if (toolName === "expand_graph_node") {
						resultText = handleExpandGraphNode(args.cluster_id || "", args.project);
					} else if (toolName === "code_search") {
						resultText = handleCodeSearch(args.query || "", args.limit || 10, args.cluster_id);
					} else if (toolName === "ast_skeleton_tree") {
						resultText = handleAstSkeletonTree(args.target_path || "", args.project);
					} else if (toolName === "ast_predict_context") {
						resultText = handleAstPredictContext(args.target || "", args.project);
					} else if (toolName === "hermes_project_manager") {
						resultText = handleProjectManager(args.action || "list", args.slug);
					} else if (toolName === "find_skills") {
						resultText = await handleFindSkills(args.query || "", args.limit || 10, args.min_stars ?? 50);
					} else if (toolName === "install_skill") {
						resultText = handleInstallSkill(args.repo_url || "", args.skill_name);
					} else if (toolName === "manage_skills") {
						resultText = handleManageSkills(args.action || "list", args.skill_name);
					} else {
						sendResponse(
							req.id,
							{
								code: -32601,
								message: `Ferramenta '${toolName}' não encontrada.`,
							},
							true,
						);
						return;
					}

					sendResponse(req.id, {
						content: [{ type: "text", text: resultText }],
						isError: false,
					});
				} catch (callErr: any) {
					sendResponse(req.id, {
						content: [{ type: "text", text: `Erro ao executar ferramenta: ${callErr?.message || callErr}` }],
						isError: true,
					});
				}
			})();
			break;
		}

		default:
			if (req.id !== undefined && req.id !== null) {
				sendResponse(
					req.id,
					{
						code: -32601,
						message: `Método '${req.method}' não suportado.`,
					},
					true,
				);
			}
			break;
	}
}

process.stderr.write(`[Hermes-MCP-Native] Servidor inicializado e ouvindo via STDIO\n`);
