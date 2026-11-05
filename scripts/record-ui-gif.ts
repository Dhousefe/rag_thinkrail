#!/usr/bin/env bun
/**
 * Wrapper TypeScript para o motor de gravação de tela em GIF do ThinkRail.
 * Integração nativa do project-gif para inspeção visual multimodal por IA.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const RECORDER_SCRIPT = join(__dirname, "visual-recorder", "record_gif.py");

export interface RecordUiGifOptions {
	duration?: number | undefined;
	fps?: number | undefined;
	output?: string | undefined;
	delay?: number | undefined;
	area?: string | undefined; // left,top,width,height
	center?: string | undefined; // width,height
	maxColors?: number | undefined;
	openMockup?: string | undefined; // Caminho para um arquivo .html de mockup a abrir antes de gravar
	openUrl?: string | undefined; // URL web a abrir antes de gravar (ex: http://localhost:24242/...)
}

export interface RecordUiGifResult {
	success: boolean;
	path?: string | undefined;
	relativePath?: string | undefined;
	frames?: number | undefined;
	durationSeconds?: number | undefined;
	fps?: number | undefined;
	sizeKb?: number | undefined;
	dimensions?: { width: number; height: number } | undefined;
	error?: string | undefined;
}

export async function recordUiGif(
	options: RecordUiGifOptions = {},
): Promise<RecordUiGifResult> {
	if (!existsSync(RECORDER_SCRIPT)) {
		throw new Error(`Script de gravação não encontrado em: ${RECORDER_SCRIPT}`);
	}

	const defaultOutDir = join(REPO_ROOT, ".thinkrail", "context", "visual-reviews");
	if (!existsSync(defaultOutDir)) {
		mkdirSync(defaultOutDir, { recursive: true });
	}

	// Se foi solicitado abrir uma URL web antes da gravação
	if (options.openUrl) {
		const targetUrl = options.openUrl;
		if (process.platform === "win32") {
			spawn("cmd.exe", ["/c", "start", "", targetUrl], { detached: true, stdio: "ignore" });
		} else if (process.platform === "darwin") {
			spawn("open", [targetUrl], { detached: true, stdio: "ignore" });
		} else {
			spawn("xdg-open", [targetUrl], { detached: true, stdio: "ignore" });
		}
		// Delay adequado para carregamento da página e WebGL/WebGPU
		options.delay = Math.max(options.delay ?? 1.5, 2.5);
	}

	// Se foi solicitado abrir um mockup HTML antes da gravação
	if (options.openMockup && existsSync(options.openMockup)) {
		const fullMockupPath = resolve(options.openMockup);
		if (process.platform === "win32") {
			spawn("cmd.exe", ["/c", "start", "", fullMockupPath], { detached: true, stdio: "ignore" });
		} else if (process.platform === "darwin") {
			spawn("open", [fullMockupPath], { detached: true, stdio: "ignore" });
		} else {
			spawn("xdg-open", [fullMockupPath], { detached: true, stdio: "ignore" });
		}
		// Aumenta o delay inicial para dar tempo do navegador focar e renderizar
		options.delay = Math.max(options.delay ?? 0.8, 1.2);
	}

	const args = [RECORDER_SCRIPT];
	if (options.duration !== undefined) args.push("--duration", String(options.duration));
	if (options.fps !== undefined) args.push("--fps", String(options.fps));
	if (options.output) args.push("--output", options.output);
	if (options.delay !== undefined) args.push("--delay", String(options.delay));
	if (options.area) args.push("--area", options.area);
	if (options.center) args.push("--center", options.center);
	if (options.maxColors !== undefined) args.push("--max-colors", String(options.maxColors));

	return new Promise<RecordUiGifResult>((resolvePromise, rejectPromise) => {
		const pythonCmd = process.env.PYTHON || "python";
		const proc = spawn(pythonCmd, args, {
			cwd: REPO_ROOT,
			env: process.env,
		});

		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString("utf8");
		});

		proc.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString("utf8");
		});

		proc.on("close", (code) => {
			if (code !== 0 && !stdout.trim()) {
				rejectPromise(
					new Error(`Processo python falhou com código ${code}: ${stderr.trim()}`),
				);
				return;
			}

			try {
				// Extrai o último bloco JSON do stdout (caso haja algum warning)
				const jsonMatch = stdout.match(/\{[\s\S]*\}/);
				if (!jsonMatch) {
					rejectPromise(new Error(`Saída inesperada do gravador: ${stdout}` + (stderr ? ` (stderr: ${stderr})` : "")));
					return;
				}
				const result = JSON.parse(jsonMatch[0]) as RecordUiGifResult;
				resolvePromise(result);
			} catch (err) {
				rejectPromise(new Error(`Erro ao interpretar saída JSON: ${err}. Raw: ${stdout}`));
			}
		});

		proc.on("error", (err) => {
			rejectPromise(new Error(`Falha ao disparar python: ${err.message}`));
		});
	});
}

// Modo CLI direto
if (import.meta.main) {
	const parseArg = (key: string): string | undefined => {
		const prefix = `--${key}=`;
		const found = process.argv.find((a) => a.startsWith(prefix));
		if (found) return found.slice(prefix.length);
		const idx = process.argv.indexOf(`--${key}`);
		if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
		return undefined;
	};

	const duration = parseArg("duration") ? Number(parseArg("duration")) : 2.5;
	const fps = parseArg("fps") ? Number(parseArg("fps")) : 15;
	const output = parseArg("output");
	const delay = parseArg("delay") ? Number(parseArg("delay")) : 0.5;
	const area = parseArg("area");
	const center = parseArg("center");
	const mockup = parseArg("mockup");
	const url = parseArg("url");

	recordUiGif({
		duration,
		fps,
		output,
		delay,
		area,
		center,
		openMockup: mockup,
		openUrl: url,
	})
		.then((res) => {
			console.log(JSON.stringify(res, null, 2));
		})
		.catch((err) => {
			console.error(JSON.stringify({ success: false, error: String(err) }));
			process.exit(1);
		});
}
