import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

const CINDY_ROOT = "D:\\Cindy\\cindy";
const SYSTEM_SKILLS_DIR = join(CINDY_ROOT, "apps", "desktop", "resources", "system-skills");
const BOT_PACKAGES_DIR = join(CINDY_ROOT, "apps", "desktop", "resources", "bot-packages");
const TARGET_SKILLS_DIR = join(homedir(), ".agents", "skills");

console.log("============================================================");
console.log(" [Cindy -> ThinkRail] Sincronização de Skills e Bots");
console.log("============================================================");
console.log(` Origem System Skills: ${SYSTEM_SKILLS_DIR}`);
console.log(` Origem Bot Packages : ${BOT_PACKAGES_DIR}`);
console.log(` Destino Skills Pi   : ${TARGET_SKILLS_DIR}`);
console.log("============================================================\n");

if (!existsSync(TARGET_SKILLS_DIR)) {
	mkdirSync(TARGET_SKILLS_DIR, { recursive: true });
}

let syncedCount = 0;

// 1. Sincronizar system-skills
if (existsSync(SYSTEM_SKILLS_DIR)) {
	const items = readdirSync(SYSTEM_SKILLS_DIR);
	for (const item of items) {
		const itemPath = join(SYSTEM_SKILLS_DIR, item);
		if (statSync(itemPath).isDirectory() && existsSync(join(itemPath, "SKILL.md"))) {
			const dest = join(TARGET_SKILLS_DIR, item);
			cpSync(itemPath, dest, { recursive: true });
			console.log(` [skill] Sincronizado: ${item} -> ${dest}`);
			syncedCount++;
		}
	}
}

// 2. Sincronizar bot-packages (versões mais recentes)
if (existsSync(BOT_PACKAGES_DIR)) {
	const bots = readdirSync(BOT_PACKAGES_DIR);
	for (const bot of bots) {
		const botPath = join(BOT_PACKAGES_DIR, bot);
		if (!statSync(botPath).isDirectory()) continue;

		// Procurar pasta de versão (ex: 0.5.2)
		const versions = readdirSync(botPath).filter((v) =>
			statSync(join(botPath, v)).isDirectory(),
		);
		if (versions.length === 0) continue;
		const latestVersion = versions.sort().pop()!;
		const skillsSubdir = join(botPath, latestVersion, "skills");

		if (existsSync(skillsSubdir)) {
			const skillFolders = readdirSync(skillsSubdir);
			for (const sf of skillFolders) {
				const sfPath = join(skillsSubdir, sf);
				if (statSync(sfPath).isDirectory() && existsSync(join(sfPath, "SKILL.md"))) {
					const dest = join(TARGET_SKILLS_DIR, sf);
					cpSync(sfPath, dest, { recursive: true });
					console.log(` [bot-skill] Sincronizado: ${sf} -> ${dest}`);
					syncedCount++;
				}
			}
		}
	}
}

console.log(`\n[OK] Concluído! Total de ${syncedCount} skills/bots do Cindy disponíveis no ThinkRail.`);
