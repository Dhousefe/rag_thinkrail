import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import {
	canonicalizeProjectPath,
	ensureHermesDatabaseSchema,
	ensureHermesEnvironment,
	ensureHermesProjectForPath,
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
		const variedPath = dummyDir.replace(/\\/g, "/") + "/";
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
});
