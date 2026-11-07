import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type {
	JinaEngineMode,
	JinaIntegrityTestResult,
	JinaRestartInput,
	JinaServerInfo,
	JinaServerStatus,
	JinaStartInput,
	JinaStopInput,
} from "@thinkrail/contracts";

/** Buffer circular para logs recentes do servidor Jina (máximo 300 linhas) */
class CircularLogBuffer {
	private lines: string[] = [];
	private readonly capacity: number;

	constructor(capacity = 300) {
		this.capacity = capacity;
	}

	push(line: string) {
		const timestamp = new Date().toISOString().substring(11, 19);
		const formatted = `[${timestamp}] ${line.trimEnd()}`;
		this.lines.push(formatted);
		if (this.lines.length > this.capacity) {
			this.lines.shift();
		}
	}

	getLines(limit?: number): string[] {
		if (!limit || limit >= this.lines.length) {
			return [...this.lines];
		}
		return this.lines.slice(-limit);
	}

	clear() {
		this.lines = [];
	}

	get count(): number {
		return this.lines.length;
	}
}

export class JinaServerManager {
	private static instance: JinaServerManager | null = null;

	private status: JinaServerStatus = "stopped";
	private port = 9085;
	private mode: JinaEngineMode = "hybrid";
	private process: ChildProcess | null = null;
	private startTime = 0;
	private totalRequests = 0;
	private errorCount = 0;
	private lastLatencyMs: number | undefined;
	private statusMessage = "Servidor Jina parado.";
	private activeEngine = "Detectando...";
	private isGpuActive = false;
	private autoStartEnabled = true;
	private healthInterval: ReturnType<typeof setInterval> | null = null;
	private isHealthChecking = false;
	private isStarting = false;
	private isStopping = false;
	private readonly logs = new CircularLogBuffer(300);

	private constructor() {
		if (process.env.NODE_ENV !== "test") {
			this.startHeartbeatWatcher();
		}
	}

	public static getInstance(): JinaServerManager {
		if (!JinaServerManager.instance) {
			JinaServerManager.instance = new JinaServerManager();
		}
		return JinaServerManager.instance;
	}

	public static resetInstanceForTesting(): void {
		if (JinaServerManager.instance) {
			JinaServerManager.instance.dispose();
			JinaServerManager.instance = null;
		}
	}

	public get baseUrl(): string {
		return `http://127.0.0.1:${this.port}`;
	}

	public getInfo(): JinaServerInfo {
		const uptimeMs =
			this.status === "running" && this.startTime > 0 ? Date.now() - this.startTime : 0;
		return {
			status: this.status,
			port: this.port,
			baseUrl: this.baseUrl,
			activeEngine: this.activeEngine,
			isGpuActive: this.isGpuActive,
			pid: this.process?.pid,
			uptimeMs,
			lastLatencyMs: this.lastLatencyMs,
			totalRequests: this.totalRequests,
			errorCount: this.errorCount,
			statusMessage: this.statusMessage,
			autoStartEnabled: this.autoStartEnabled,
			mode: this.mode,
			model: "jina-embeddings-v2-base-code",
		};
	}

	public getLogs(limit = 100): { logs: string[]; totalLines: number } {
		return {
			logs: this.logs.getLines(limit),
			totalLines: this.logs.count,
		};
	}

	public logMessage(msg: string) {
		this.logs.push(msg);
	}

	public startHeartbeatWatcher() {
		if (this.healthInterval) return;
		this.healthInterval = setInterval(async () => {
			if (this.isHealthChecking || this.isStarting || this.isStopping) return;
			this.isHealthChecking = true;
			try {
				const isAlive = await this.checkHealth();
				if (!isAlive && this.autoStartEnabled && !this.isStarting && this.status !== "stopped") {
					// Auto-heal se o servidor caiu durante uso ativo
					this.logs.push("[AUTO-HEAL] Detectada queda do servidor Jina. Recuperando...");
					void this.start();
				}
			} catch {
				// Ignora erros no heartbeat em silêncio
			} finally {
				this.isHealthChecking = false;
			}
		}, 3000);
	}

	public stopHeartbeatWatcher(): void {
		if (this.healthInterval) {
			clearInterval(this.healthInterval);
			this.healthInterval = null;
		}
	}

	/**
	 * Encerra o monitoramento em background e quaisquer processos filhos gerenciados.
	 */
	public dispose(): void {
		this.stopHeartbeatWatcher();
		this.autoStartEnabled = false;
		if (this.process) {
			try {
				this.process.kill("SIGTERM");
			} catch {
				// Processo já encerrado
			}
			this.process = null;
		}
		this.status = "stopped";
		this.startTime = 0;
	}

	/**
	 * Localiza o script Python api_embeddings.py e o interpretador adequado do venv sem depender de bat.
	 * Respeita variáveis de ambiente (HERMES_HOME, JINA_EMBEDDINGS_DIR) ou diretórios relativos ao projeto.
	 */
	private resolveScriptAndPython(): {
		scriptPath: string;
		pythonPath: string;
		workingDir: string;
	} | null {
		const envDir =
			process.env.HERMES_HOME || process.env.HERMES_PATH || process.env.JINA_EMBEDDINGS_DIR;
		const home = homedir();
		const cwd = process.cwd();

		const candidateDirs: string[] = [];
		if (envDir) {
			candidateDirs.push(resolve(envDir));
		}

		// Diretórios relativos ao repositório ou diretórios irmãos usuais
		candidateDirs.push(
			resolve(cwd, "hermes"),
			resolve(cwd, "hermes-3.0"),
			resolve(cwd, "..", "hermes"),
			resolve(cwd, "..", "hermes-3.0"),
			resolve(cwd, "..", "..", "hermes"),
			resolve(cwd, "..", "..", "hermes-3.0"),
			resolve(home, ".hermes"),
			resolve(home, ".hermes", "hermes-3.0"),
		);

		for (const baseDir of candidateDirs) {
			const scriptPath = join(baseDir, "api_embeddings.py");
			if (existsSync(scriptPath)) {
				const venvPyWin = join(baseDir, "jina-env", "Scripts", "python.exe");
				const venvPyNix = join(baseDir, "jina-env", "bin", "python");
				let pythonPath = "python";
				if (existsSync(venvPyWin)) {
					pythonPath = venvPyWin;
				} else if (existsSync(venvPyNix)) {
					pythonPath = venvPyNix;
				}
				return { scriptPath, pythonPath, workingDir: baseDir };
			}
		}
		return null;
	}

	/**
	 * Testa conectividade /health com timeout curto de 1500ms.
	 */
	public async checkHealth(): Promise<boolean> {
		const start = Date.now();
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 1500);
			const res = await fetch(`${this.baseUrl}/health`, {
				method: "GET",
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
			this.lastLatencyMs = Date.now() - start;

			if (res.ok) {
				const data = (await res.json().catch(() => ({}))) as {
					provider?: string;
					gpu?: boolean;
					runtime?: string;
				};
				this.status = "running";
				this.isGpuActive = !!data.gpu;
				this.activeEngine = data.provider || (data.gpu ? "DirectML (AMD RX 580)" : "CPU Runtime");
				this.statusMessage = `Online (${this.lastLatencyMs}ms) via ${this.activeEngine}`;
				if (this.startTime === 0) {
					this.startTime = Date.now();
				}
				return true;
			}
			this.status = "error";
			this.statusMessage = `HTTP ${res.status}: ${res.statusText}`;
			return false;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (this.status === "running") {
				this.errorCount++;
				this.logs.push(`[HEARTBEAT-FAIL] Conexão perdida: ${msg}`);
			}
			if (this.status !== "starting") {
				this.status = "stopped";
				this.statusMessage = "Servidor Jina inacessível na porta 9085.";
				this.startTime = 0;
			}
			return false;
		}
	}

	/**
	 * Inicia o servidor Jina de forma totalmente transparente e desacoplada de janelas do Windows.
	 */
	public async start(input?: JinaStartInput): Promise<JinaServerInfo> {
		if (this.isStarting) return this.getInfo();
		if (input?.port) this.port = input.port;
		if (input?.mode) this.mode = input.mode;

		// Se já estiver respondendo, anexa ao servidor ativo
		if (await this.checkHealth()) {
			this.logs.push(`[ATTACH] Servidor Jina já ativo e respondendo na porta ${this.port}.`);
			return this.getInfo();
		}

		this.isStarting = true;
		this.status = "starting";
		this.statusMessage = "Iniciando processo do Servidor Jina...";
		this.logs.push(
			`[START] Iniciando Jina Embeddings na porta ${this.port} (modo: ${this.mode})...`,
		);

		const resolved = this.resolveScriptAndPython();
		if (!resolved) {
			this.status = "error";
			this.statusMessage =
				"api_embeddings.py não localizado nos diretórios configurados do Hermes.";
			this.logs.push(`[ERRO] ${this.statusMessage}`);
			this.isStarting = false;
			return this.getInfo();
		}

		try {
			const env = {
				...process.env,
				PYTHONUNBUFFERED: "1",
				EMBEDDINGS_PORT: String(this.port),
			};

			// Spawna o interpretador Python diretamente sem criar janelas visíveis nem invocar .bat
			const child = spawn(resolved.pythonPath, [resolved.scriptPath], {
				cwd: resolved.workingDir,
				env,
				stdio: ["ignore", "pipe", "pipe"],
				windowsHide: true,
			});

			this.process = child;
			this.logs.push(
				`[SPAWN] Processo PID ${child.pid} iniciado com executável: ${resolved.pythonPath}`,
			);

			child.stdout?.on("data", (chunk: Buffer) => {
				const text = chunk.toString("utf8");
				for (const line of text.split(/\r?\n/)) {
					if (line.trim()) this.logs.push(`[OUT] ${line}`);
				}
			});

			child.stderr?.on("data", (chunk: Buffer) => {
				const text = chunk.toString("utf8");
				for (const line of text.split(/\r?\n/)) {
					if (line.trim()) this.logs.push(`[ERR] ${line}`);
				}
			});

			child.on("exit", (code, signal) => {
				this.logs.push(`[EXIT] Processo encerrado com código ${code}, sinal ${signal}`);
				if (this.process === child) {
					this.process = null;
					this.status = "stopped";
					this.startTime = 0;
				}
			});

			// Aguarda até o servidor responder no endpoint /health (até 8 segundos)
			for (let i = 0; i < 16; i++) {
				await new Promise((r) => setTimeout(r, 500));
				if (await this.checkHealth()) {
					this.logs.push("[READY] Servidor Jina online e pronto para receber inferências!");
					this.isStarting = false;
					return this.getInfo();
				}
			}

			this.statusMessage = "Servidor iniciado, mas timeout ao aguardar health-check inicial.";
			this.logs.push(`[WARN] ${this.statusMessage}`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.status = "error";
			this.statusMessage = `Falha ao iniciar processo: ${msg}`;
			this.logs.push(`[EXCEPTION] ${this.statusMessage}`);
		} finally {
			this.isStarting = false;
		}

		return this.getInfo();
	}

	/**
	 * Para o servidor graciosamente ou com força se solicitado.
	 */
	public async stop(input?: JinaStopInput): Promise<JinaServerInfo> {
		this.isStopping = true;
		this.autoStartEnabled = false;
		this.logs.push("[STOP] Encerrando o Servidor Jina Embeddings...");

		if (this.process) {
			try {
				if (input?.force) {
					this.process.kill("SIGKILL");
				} else {
					this.process.kill("SIGTERM");
				}
			} catch (err) {
				this.logs.push(`[KILL-ERR] ${err}`);
			}
			this.process = null;
		}

		// Se houver um processo órfão escutando na porta 9085, tentar matar no Windows se for force
		if (input?.force && process.platform === "win32") {
			try {
				spawn(
					"cmd.exe",
					[
						"/c",
						`for /f "tokens=5" %a in ('netstat -aon ^| findstr :${this.port}') do taskkill /F /PID %a`,
					],
					{
						stdio: "ignore",
						windowsHide: true,
					},
				);
			} catch {}
		}

		this.status = "stopped";
		this.startTime = 0;
		this.statusMessage = "Servidor Jina desligado pelo usuário.";
		this.isStopping = false;
		return this.getInfo();
	}

	/**
	 * Reinicia o servidor Jina a quente.
	 */
	public async restart(input?: JinaRestartInput): Promise<JinaServerInfo> {
		this.logs.push("[RESTART] Reiniciando Servidor Jina...");
		await this.stop({ force: true });
		await new Promise((r) => setTimeout(r, 800));
		this.autoStartEnabled = true;
		return this.start({ mode: input?.mode });
	}

	/**
	 * Executa teste de integridade em tempo real gerando embedding de 768 dimensões.
	 * Valida norma euclidiana L2 e tempo de resposta.
	 */
	public async testIntegrity(): Promise<JinaIntegrityTestResult> {
		const timestamp = Date.now();
		const start = Date.now();
		const sampleText = "export function ping(): boolean { return true; }";

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 6000);

			const res = await fetch(`${this.baseUrl}/api/embeddings`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ texts: [sampleText] }),
				signal: controller.signal,
			});
			clearTimeout(timeoutId);

			const latencyMs = Date.now() - start;
			this.lastLatencyMs = latencyMs;

			if (!res.ok) {
				return {
					success: false,
					latencyMs,
					dimensions: 0,
					isNormalized: false,
					error: `HTTP ${res.status}: ${res.statusText}`,
					provider: this.activeEngine,
					gpu: this.isGpuActive,
					timestamp,
				};
			}

			const data = (await res.json()) as { embeddings?: number[][] };
			const vector = data.embeddings?.[0];

			if (!vector || !Array.isArray(vector)) {
				return {
					success: false,
					latencyMs,
					dimensions: 0,
					isNormalized: false,
					error: "Estrutura JSON inválida: 'embeddings' vazio",
					provider: this.activeEngine,
					gpu: this.isGpuActive,
					timestamp,
				};
			}

			const dimensions = vector.length;
			// Cálculo de Norma L2: sqrt(sum(v_i^2))
			const sumSq = vector.reduce((acc, v) => acc + v * v, 0);
			const normValue = Math.sqrt(sumSq);
			const isNormalized = Math.abs(normValue - 1.0) < 0.08;

			this.totalRequests++;
			this.logs.push(
				`[INTEGRITY-OK] Vetor ${dimensions}d gerado em ${latencyMs}ms (Norma L2: ${normValue.toFixed(4)}, GPU: ${this.isGpuActive ? "Sim" : "Não"})`,
			);

			return {
				success: dimensions === 768 && isNormalized,
				latencyMs,
				dimensions,
				isNormalized,
				normValue,
				sampleDotProduct: normValue * normValue,
				provider: this.activeEngine,
				gpu: this.isGpuActive,
				timestamp,
			};
		} catch (err) {
			const latencyMs = Date.now() - start;
			const msg = err instanceof Error ? err.message : String(err);
			this.logs.push(`[INTEGRITY-FAIL] Falha no teste de integridade: ${msg}`);
			return {
				success: false,
				latencyMs,
				dimensions: 0,
				isNormalized: false,
				error: msg,
				provider: this.activeEngine,
				gpu: this.isGpuActive,
				timestamp,
			};
		}
	}
}
