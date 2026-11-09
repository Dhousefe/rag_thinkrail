import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { brandWindowsExecutable } from "../apps/desktop/src/windowsExecutableIdentity";

const germesPath = resolve("apps/cli/dist/germes.exe");
const iconPath = resolve("apps/cli/dist/instalador/Logo.ico");

console.log(`Carregando germes.exe: ${germesPath}`);
const exeData = readFileSync(germesPath);

console.log(`Carregando Logo.ico: ${iconPath}`);
const iconData = readFileSync(iconPath);

const identity = {
	companyName: "Dhousefe",
	productName: "Hermes Agent Runtime & MCP Engine",
	copyright: "(C) 2026 Dhousefe. All rights reserved.",
	fileVersion: "3.0.0.0",
	fileVersionParts: [3, 0, 0, 0] as [number, number, number, number],
};

console.log("Injetando Logo.ico e VERSIONINFO Dhousefe no germes.exe...");
const brandedData = brandWindowsExecutable(exeData, iconData, identity, "germes.exe");

writeFileSync(germesPath, brandedData);
console.log(`[V] germes.exe atualizado com sucesso! Novo tamanho: ${brandedData.length} bytes`);
