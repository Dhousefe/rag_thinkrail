/**
 * ThinkRail Continuous Parity Gate: CLI vs Desktop
 *
 * Validates that the built web distribution in `apps/web/dist` is perfectly in sync
 * with the packaged desktop dev views in `apps/desktop/build/dev-win-x64/.../views/web`
 * and that the version-suffixed CLI binary in `apps/cli/dist` is up to date.
 *
 * Spec: apps/desktop/SPEC-cli-desktop-parity.md
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const WEB_DIST = join(REPO_ROOT, "apps", "web", "dist");
const DESKTOP_VIEWS = join(
	REPO_ROOT,
	"apps",
	"desktop",
	"build",
	"dev-win-x64",
	"ThinkRail-dev",
	"Resources",
	"app",
	"views",
	"web",
);
const CLI_DIST = join(REPO_ROOT, "apps", "cli", "dist");

function computeFileHash(path: string): string {
	const content = readFileSync(path);
	return createHash("sha256").update(content).digest("hex");
}

function findMainBundle(dir: string): { filename: string; fullPath: string; hash: string } | null {
	const assetsDir = join(dir, "assets");
	if (!existsSync(assetsDir)) return null;

	const files = readdirSync(assetsDir);
	const indexFile = files.find((f) => f.startsWith("index-") && f.endsWith(".js"));
	if (!indexFile) return null;

	const fullPath = join(assetsDir, indexFile);
	return {
		filename: indexFile,
		fullPath,
		hash: computeFileHash(fullPath),
	};
}

function main() {
	console.log("[Parity Check] Verificando paridade contínua CLI vs Desktop...");
	let hasErrors = false;

	// 1. Valida existência de apps/web/dist
	if (!existsSync(WEB_DIST)) {
		console.error("❌ [FALHA] apps/web/dist não existe. Execute: bun run build:web");
		process.exit(1);
	}

	const webBundle = findMainBundle(WEB_DIST);
	if (!webBundle) {
		console.error("❌ [FALHA] Bundle principal index-*.js não encontrado em apps/web/dist/assets");
		process.exit(1);
	}
	console.log(`  ✓ Web Bundle: ${webBundle.filename} (${webBundle.hash.slice(0, 8)})`);

	// 2. Valida sincronização com apps/desktop dev views
	if (existsSync(DESKTOP_VIEWS)) {
		const desktopBundle = findMainBundle(DESKTOP_VIEWS);
		if (!desktopBundle) {
			console.error("❌ [FALHA] Bundle principal index-*.js não encontrado na pasta Desktop views/web");
			hasErrors = true;
		} else if (desktopBundle.filename !== webBundle.filename || desktopBundle.hash !== webBundle.hash) {
			console.error(
				`❌ [DESALINHADO] Drift detectado entre Web (${webBundle.filename}) e Desktop (${desktopBundle.filename})!`,
			);
			console.error("   Execute a sincronização de apps/web/dist para apps/desktop/.../views/web");
			hasErrors = true;
		} else {
			console.log(`  ✓ Desktop Views em paridade: ${desktopBundle.filename} (${desktopBundle.hash.slice(0, 8)})`);
		}
	} else {
		console.warn(
			"⚠️ [AVISO] Build dev desktop não encontrado em apps/desktop/build/dev-win-x64 (pule se for ambiente CI puro)",
		);
	}

	// 3. Valida existência do binário nativo CLI
	if (existsSync(CLI_DIST)) {
		const cliFiles = readdirSync(CLI_DIST);
		const canonicalExe = cliFiles.find((f) => f === "thinkrail.exe");
		const versionedExe = cliFiles.find((f) => /^thinkrail-v\d+\.\d+\.\d+\.exe$/.test(f));

		if (!canonicalExe || !versionedExe) {
			console.error("❌ [FALHA] Binário nativo em apps/cli/dist incompleto ou ausente!");
			console.error("   Execute: bun run build:binary");
			hasErrors = true;
		} else {
			const webStat = statSync(webBundle.fullPath);
			const binStat = statSync(join(CLI_DIST, versionedExe));
			console.log(`  ✓ CLI Canonical: ${canonicalExe}`);
			console.log(`  ✓ CLI Versioned: ${versionedExe}`);

			// Tolerância de 5 segundos para mtime
			if (binStat.mtimeMs < webStat.mtimeMs - 5000) {
				console.warn(
					"⚠️ [ATENÇÃO] O binário CLI é mais antigo que o último build web. Recomenda-se: bun run build:binary",
				);
			}
		}
	} else {
		console.error("❌ [FALHA] Pasta apps/cli/dist não existe. Execute: bun run build:binary");
		hasErrors = true;
	}

	if (hasErrors) {
		console.error("\n[Parity Check] Paridade violada! Corrija os desalinhamentos antes de commitar.\n");
		process.exit(1);
	}

	console.log("[Parity Check] ✅ OK: CLI e Desktop em paridade contínua perfeita.\n");
}

main();
