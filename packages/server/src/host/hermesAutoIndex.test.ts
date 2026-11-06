import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	canonicalizeProjectPath,
	ensureHermesDatabaseSchema,
	ensureHermesEnvironment,
	ensureHermesProjectForPath,
	getHermesClassStats,
	getHermesVectorGraph,
	listHermesProjects,
} from "./hermes";

describe("Hermes RAG Auto-Index e Portabilidade", () => {
	let testHermesHome: string;
	let originalHermesHome: string | undefined;

	beforeEach(() => {
		originalHermesHome = process.env.HERMES_HOME;
		testHermesHome = join(
			tmpdir(),
			`hermes-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		);
		process.env.HERMES_HOME = testHermesHome;
	});

	afterEach(() => {
		if (originalHermesHome !== undefined) {
			process.env.HERMES_HOME = originalHermesHome;
		} else {
			delete process.env.HERMES_HOME;
		}
		if (existsSync(testHermesHome)) {
			try {
				rmSync(testHermesHome, { recursive: true, force: true });
			} catch {}
		}
	});

	it("UC-01: Bootstrap autônomo em nova máquina cria diretórios base e active_projects.json", () => {
		expect(existsSync(testHermesHome)).toBe(false);

		const env = ensureHermesEnvironment();
		expect(env.hermesHome).toBe(testHermesHome);
		expect(existsSync(env.projectsDir)).toBe(true);
		expect(existsSync(env.binDir)).toBe(true);
		expect(existsSync(join(testHermesHome, "logs"))).toBe(true);
		expect(existsSync(join(testHermesHome, "cache"))).toBe(true);

		const activeFile = join(testHermesHome, "active_projects.json");
		expect(existsSync(activeFile)).toBe(true);
		const activeData = JSON.parse(readFileSync(activeFile, "utf8"));
		expect(Array.isArray(activeData.activeSlugs)).toBe(true);
	});

	it("UC-02: Canonicalização de caminhos normaliza barras, case de unidade e trailing slash", () => {
		const p1 = canonicalizeProjectPath("C:\\Projetos\\MeuApp\\");
		const p2 = canonicalizeProjectPath("c:/Projetos/MeuApp");
		const p3 = canonicalizeProjectPath("C:/Projetos/MeuApp/");

		expect(p1).toBe(p2);
		expect(p2).toBe(p3);
		expect(p1.endsWith("/")).toBe(false);
		expect(p1.startsWith("c:/")).toBe(true);
	});

	it("UC-03: Idempotência estrita: registrar mesmo caminho não duplica projetos", async () => {
		const dummyDir = join(testHermesHome, "dummy-source-app");
		mkdirSync(dummyDir, { recursive: true });

		// Primeiro registro
		const res1 = await ensureHermesProjectForPath({
			path: dummyDir,
			name: "Dummy App",
			autoIndex: false,
		});
		expect(res1.isNewlyCreated).toBe(true);
		expect(res1.slug).toBe("dummy-app");

		// Segundo registro com formatação diferente do caminho
		const variedPath = `${dummyDir.replace(/\\/g, "/")}/`;
		const res2 = await ensureHermesProjectForPath({
			path: variedPath,
			name: "Dummy App Alternate",
			autoIndex: false,
		});
		expect(res2.isNewlyCreated).toBe(false);
		expect(res2.slug).toBe(res1.slug);

		// Garante que só existe 1 projeto na lista
		const list = listHermesProjects();
		const matched = list.projects.filter((p) => p.slug === res1.slug);
		expect(matched.length).toBe(1);
	});

	it("UC-04: Resolução de colisão de slugs para caminhos distintos", async () => {
		const dirA = join(testHermesHome, "apps", "frontend");
		const dirB = join(testHermesHome, "services", "frontend");
		mkdirSync(dirA, { recursive: true });
		mkdirSync(dirB, { recursive: true });

		const resA = await ensureHermesProjectForPath({
			path: dirA,
			name: "Frontend",
			autoIndex: false,
		});
		const resB = await ensureHermesProjectForPath({
			path: dirB,
			name: "Frontend",
			autoIndex: false,
		});

		expect(resA.slug).toBe("frontend");
		expect(resB.slug).toBe("frontend-2");
		expect(resA.slug).not.toBe(resB.slug);
	});

	it("UC-05: Concorrência atômica: chamadas simultâneas não corrompem nem duplicam", async () => {
		const targetDir = join(testHermesHome, "concurrent-repo");
		mkdirSync(targetDir, { recursive: true });

		// Dispara 5 chamadas simultâneas
		const results = await Promise.all([
			ensureHermesProjectForPath({ path: targetDir, autoIndex: false }),
			ensureHermesProjectForPath({ path: targetDir, autoIndex: false }),
			ensureHermesProjectForPath({ path: targetDir, autoIndex: false }),
			ensureHermesProjectForPath({ path: targetDir, autoIndex: false }),
			ensureHermesProjectForPath({ path: targetDir, autoIndex: false }),
		]);

		// Todos devem apontar para o mesmo slug
		const firstSlug = results[0]?.slug;
		for (const r of results) {
			expect(r.slug).toBe(firstSlug);
		}

		const list = listHermesProjects();
		const matched = list.projects.filter((p) => p.slug === firstSlug);
		expect(matched.length).toBe(1);
	});

	it("UC-06: Criação autônoma do schema SQLite Hermes e FTS5", () => {
		const dbPath = join(testHermesHome, "test-schema", "hermes.db");
		expect(existsSync(dbPath)).toBe(false);

		ensureHermesDatabaseSchema(dbPath, "test-schema");
		expect(existsSync(dbPath)).toBe(true);

		const db = new Database(dbPath, { readonly: true });
		// Verifica se as tabelas existem
		const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{
			name: string;
		}>;
		const names = tables.map((t) => t.name);

		expect(names).toContain("l2j_files");
		expect(names).toContain("l2j_symbols");
		expect(names).toContain("l2j_chunks");
		expect(names).toContain("l2j_chunk_fts");
		db.close();
	});

	it("UC-07: getHermesVectorGraph suporta embeddings de dimensões arbitrárias (384D, 768D) sem RangeError", async () => {
		const projDir = join(testHermesHome, "sample-multi-dim");
		mkdirSync(projDir, { recursive: true });

		const reg = await ensureHermesProjectForPath({
			path: projDir,
			name: "Multi Dim App",
			autoIndex: false,
		});

		const dbPath = join(testHermesHome, "projects", reg.slug, "hermes.db");
		const db = new Database(dbPath);

		// Insere chunk e embeddings de 384 dimensões (1536 bytes) - simulando caso Cindy
		db.run(
			"CREATE TABLE IF NOT EXISTS l2j_embeddings_cache (rowid INTEGER PRIMARY KEY, cache_key TEXT, model TEXT, dim INTEGER, vector_blob BLOB, created_at INTEGER);",
		);
		db.run(`
			INSERT INTO l2j_chunks (id, file_id, project_name, path, qualified_name, chunk_kind, content, token_estimate, created_at)
			VALUES ('c1', 'f1', '${reg.slug}', 'src/Service.ts', 'Service', 'class', 'class Service {}', 100, 1000);
		`);
		const f32_384 = new Float32Array(384);
		for (let i = 0; i < 384; i++) f32_384[i] = Math.sin(i);
		const blob384 = new Uint8Array(f32_384.buffer);

		db.run(
			"INSERT INTO l2j_embeddings_cache (rowid, cache_key, model, dim, vector_blob, created_at) VALUES (1, 'k1', 'm1', 384, ?, 1000)",
			[blob384],
		);
		db.close();

		// Executa getHermesVectorGraph e assegura que não lança RangeError e retorna o nó
		const result = await getHermesVectorGraph({ projectSlug: reg.slug });
		expect(result.nodes.length).toBe(1);
		expect(result.nodes[0]?.chunkKind).toBe("class");
		expect(result.nodes[0]?.position).toBeDefined();
		expect(result.nodes[0]?.position.length).toBe(3);
	});

	it("UC-08: getHermesClassStats conta classes, interfaces, arquivos e estruturas com precisão", async () => {
		const projDir = join(testHermesHome, "sample-stats-app");
		mkdirSync(projDir, { recursive: true });

		const reg = await ensureHermesProjectForPath({
			path: projDir,
			name: "Stats App",
			autoIndex: false,
		});

		const dbPath = join(testHermesHome, "projects", reg.slug, "hermes.db");
		const db = new Database(dbPath);

		db.run(`
			INSERT INTO l2j_chunks (id, file_id, project_name, path, qualified_name, chunk_kind, content, created_at) VALUES
			('c1', 'f1', '${reg.slug}', 'src/Service.ts', 'Service', 'class', 'class Service {}', 1000),
			('c2', 'f2', '${reg.slug}', 'src/Controller.ts', 'Controller', 'class_skeleton', 'class Controller skeleton', 1000),
			('c3', 'f3', '${reg.slug}', 'src/Model.ts', 'IModel', 'interface', 'interface IModel {}', 1000),
			('c4', 'f4', '${reg.slug}', 'src/Component.tsx', 'MyComponent', 'component', 'export const MyComponent = () => <div />', 1000),
			('c5', 'f5', '${reg.slug}', 'src/Helper.ts', 'Helper', 'function', 'export function helper() {}', 1000),
			('c6', 'f6', '${reg.slug}', 'src/Type.ts', 'Config', 'type', 'export type Config = { api: string }', 1000),
			('c7', 'f7', '${reg.slug}', 'src/Struct.kt', 'Data', 'struct', 'struct Data(val x: Int)', 1000);
		`);
		db.close();

		const stats = await getHermesClassStats({ projectSlug: reg.slug });
		expect(stats.projects.length).toBe(1);

		const projStats = stats.projects[0];
		expect(projStats?.slug).toBe(reg.slug);
		expect(projStats?.hasDb).toBe(true);

		// 1 'class' + 1 'class_skeleton' + 1 'struct' = 3 totalClasses
		expect(projStats?.totalClasses).toBe(3);
		// 1 'interface'
		expect(projStats?.totalInterfaces).toBe(1);
		// 1 'component'
		expect(projStats?.totalComponents).toBe(1);
		// 1 'type'
		expect(projStats?.totalTypes).toBe(1);
		// 1 'function'
		expect(projStats?.totalFunctions).toBe(1);
		// 7 arquivos distintos
		expect(projStats?.totalFiles).toBe(7);
		// 7 chunks totais
		expect(projStats?.totalChunks).toBe(7);

		expect(stats.totals.totalClasses).toBe(3);
		expect(stats.totals.totalFiles).toBe(7);
	});

	it("UC-09: getHermesVectorGraph suporta paginação em lote (batch) e class_skeleton", async () => {
		const projDir = join(testHermesHome, "sample-batch-app");
		mkdirSync(projDir, { recursive: true });

		const reg = await ensureHermesProjectForPath({
			path: projDir,
			name: "Batch App",
			autoIndex: false,
		});

		const dbPath = join(testHermesHome, "projects", reg.slug, "hermes.db");
		const db = new Database(dbPath);

		// Insere 5 chunks de class_skeleton
		for (let i = 1; i <= 5; i++) {
			db.run(`
				INSERT INTO l2j_chunks (id, file_id, project_name, path, qualified_name, chunk_kind, content, created_at)
				VALUES ('cs${i}', 'f${i}', '${reg.slug}', 'src/Module${i}.ts', 'Module${i}', 'class_skeleton', 'class Module${i} skeleton', 1000)
			`);
		}
		db.close();

		// Lote 1: offset 0, batchSize 3 -> deve retornar 3 nós
		const batch1 = await getHermesVectorGraph({
			projectSlug: reg.slug,
			offset: 0,
			batchSize: 3,
			includeAllClasses: true,
		});
		expect(batch1.nodes.length).toBe(3);
		expect(batch1.hasMore).toBe(true);
		expect(batch1.totalAvailableNodes).toBe(5);
		expect(batch1.totalClasses).toBe(5); // class_skeleton conta como classe
		expect(batch1.nodes[0]?.chunkKind).toBe("class_skeleton");

		// Lote 2: offset 3, batchSize 3 -> deve retornar os 2 restantes
		const batch2 = await getHermesVectorGraph({
			projectSlug: reg.slug,
			offset: 3,
			batchSize: 3,
			includeAllClasses: true,
		});
		expect(batch2.nodes.length).toBe(2);
		expect(batch2.hasMore).toBe(false);
		expect(batch2.offset).toBe(3);
		expect(batch2.limit).toBe(3);
	});
});
