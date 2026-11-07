import { version } from "@thinkrail/shared/version";

export function targetsWindows(target?: string): boolean {
	return target ? target.includes("windows") : process.platform === "win32";
}

export function binaryArtifactName(target?: string): string {
	const base = target ? `thinkrail-${target.replace(/^bun-/, "")}` : "thinkrail";
	const versionSuffix = version ? `-v${version}` : "";
	return targetsWindows(target) ? `${base}${versionSuffix}.exe` : `${base}${versionSuffix}`;
}
