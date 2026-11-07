import {
	RiCpuLine,
	RiFlashlightLine,
	RiPlayLine,
	RiPulseLine,
	RiRefreshLine,
	RiStopLine,
	RiTerminalBoxLine,
} from "@remixicon/react";
import type {
	JinaEngineMode,
	JinaIntegrityTestResult,
	JinaServerInfo,
} from "@thinkrail/contracts";
import { Button } from "@thinkrail/ui/button";
import { cn } from "@thinkrail/ui/utils";
import { useEffect, useState } from "react";
import { toast } from "@/store";
import { getTransport } from "@/transport";

export function JinaServerManagerCard() {
	const [info, setInfo] = useState<JinaServerInfo | null>(null);
	const [actionRunning, setActionRunning] = useState<string | null>(null);
	const [integrityResult, setIntegrityResult] = useState<JinaIntegrityTestResult | null>(null);
	const [logs, setLogs] = useState<string[]>([]);
	const [showLogs, setShowLogs] = useState(false);

	const refreshStatus = async (quiet = true) => {
		try {
			const res = await getTransport().request("jina.getStatus", {});
			setInfo(res);
		} catch (err) {
			if (!quiet) {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error(`Falha ao obter status do Jina: ${msg}`);
			}
		}
	};

	const fetchLogs = async () => {
		try {
			const res = await getTransport().request("jina.getLogs", { limit: 100 });
			setLogs(res.logs);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Falha ao carregar logs: ${msg}`);
		}
	};

	useEffect(() => {
		void refreshStatus(true);
		const interval = setInterval(() => {
			void refreshStatus(true);
		}, 3000);
		return () => clearInterval(interval);
	}, []);

	useEffect(() => {
		if (showLogs) {
			void fetchLogs();
			const interval = setInterval(() => {
				void fetchLogs();
			}, 2000);
			return () => clearInterval(interval);
		}
		return undefined;
	}, [showLogs]);

	const handleStart = async (mode?: JinaEngineMode) => {
		setActionRunning("start");
		try {
			const updated = await getTransport().request("jina.start", {
				mode,
			});
			setInfo(updated);
			toast.success("Servidor Jina iniciado com sucesso!");
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Erro ao iniciar servidor Jina: ${msg}`);
		} finally {
			setActionRunning(null);
		}
	};

	const handleStop = async () => {
		setActionRunning("stop");
		try {
			const updated = await getTransport().request("jina.stop", { force: true });
			setInfo(updated);
			toast.success("Servidor Jina finalizado.");
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Erro ao parar servidor Jina: ${msg}`);
		} finally {
			setActionRunning(null);
		}
	};

	const handleRestart = async (mode?: JinaEngineMode) => {
		setActionRunning("restart");
		try {
			const updated = await getTransport().request("jina.restart", { mode });
			setInfo(updated);
			toast.success("Servidor Jina reiniciado com sucesso!");
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Erro ao reiniciar servidor Jina: ${msg}`);
		} finally {
			setActionRunning(null);
		}
	};

	const handleTestIntegrity = async () => {
		setActionRunning("integrity");
		try {
			const res = await getTransport().request("jina.testIntegrity", {});
			setIntegrityResult(res);
			if (res.success) {
				toast.success(
					`Teste OK: ${res.dimensions}d gerado em ${res.latencyMs}ms (${res.provider})!`,
				);
			} else {
				toast.error(`Falha no teste: ${res.error}`);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Erro no teste de integridade: ${msg}`);
		} finally {
			setActionRunning(null);
		}
	};

	const isRunning = info?.status === "running";
	const isStarting = info?.status === "starting" || actionRunning === "start";

	return (
		<div className="flex flex-col gap-12 rounded-lg border border-border-default bg-control-bg p-16 shadow-xs">
			{/* Cabeçalho */}
			<div className="flex flex-wrap items-center justify-between gap-12 border-b border-border-default pb-12">
				<div className="flex items-center gap-12">
					<div className="flex size-36 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary">
						<RiCpuLine className="size-20" />
					</div>
					<div>
						<div className="flex items-center gap-8">
							<h3 className="tr-text-ui text-text-default">
								Servidor Local de Embeddings Jina
							</h3>
							<span
								className={cn(
									"inline-flex items-center gap-4 rounded-full px-8 py-2 tr-text-metadata border",
									isRunning
										? "bg-feedback-success-subtle text-feedback-success border-feedback-success"
										: isStarting
											? "bg-feedback-warning-subtle text-feedback-warning border-feedback-warning animate-pulse"
											: "bg-container-workspace-bg text-text-muted border-border-default",
								)}
							>
								<span
									className={cn(
										"size-6 rounded-full",
										isRunning
											? "bg-feedback-success"
											: isStarting
												? "bg-feedback-warning"
												: "bg-text-subtle",
									)}
								/>
								{isRunning
									? `Online (${info?.lastLatencyMs ?? 0}ms)`
									: isStarting
										? "Iniciando..."
										: "Offline"}
							</span>
						</div>
						<p className="tr-text-metadata text-text-muted">
							Vetorização densa 768d para busca semântica RAG (jina-embeddings-v2-base-code)
						</p>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-8">
					{isRunning ? (
						<>
							<Button
								size="s"
								variant="outline"
								disabled={!!actionRunning}
								onClick={() => handleRestart()}
								className="gap-4"
							>
								<RiRefreshLine
									className={cn("size-14", actionRunning === "restart" && "animate-spin")}
								/>
								Reiniciar
							</Button>
							<Button
								size="s"
								variant="outline"
								disabled={!!actionRunning}
								onClick={handleStop}
								className="gap-4 text-feedback-error hover:border-feedback-error hover:bg-feedback-error-subtle"
							>
								<RiStopLine className="size-14" />
								Desligar
							</Button>
						</>
					) : (
						<Button
							size="s"
							variant="primary"
							disabled={!!actionRunning}
							onClick={() => handleStart()}
							className="gap-4"
						>
							<RiPlayLine
								className={cn("size-14", actionRunning === "start" && "animate-spin")}
							/>
							{isStarting ? "Iniciando..." : "Ligar Servidor"}
						</Button>
					)}

					<Button
						size="s"
						variant="outline"
						disabled={!isRunning || actionRunning === "integrity"}
						onClick={handleTestIntegrity}
						className="gap-4"
					>
						<RiFlashlightLine
							className={cn("size-14", actionRunning === "integrity" && "animate-pulse")}
						/>
						{actionRunning === "integrity" ? "Testando..." : "Testar Vetor"}
					</Button>

					<Button
						size="s"
						variant="ghost"
						onClick={() => setShowLogs((v) => !v)}
						className={cn("gap-4", showLogs && "bg-control-bg-selected text-primary")}
					>
						<RiTerminalBoxLine className="size-14" />
						{showLogs ? "Ocultar Logs" : "Ver Logs"}
					</Button>
				</div>
			</div>

			{/* Grid de Informações de Hardware e Execução */}
			<div className="grid grid-cols-1 gap-12 sm:grid-cols-4">
				<div className="flex flex-col gap-4 rounded-lg border border-border-default bg-container-workspace-bg p-12 shadow-2xs">
					<span className="tr-text-metadata text-text-muted flex items-center gap-4">
						<RiCpuLine className="size-14 text-primary" /> Motor & Hardware
					</span>
					<span className="tr-text-emphasis text-text-default truncate">
						{info?.activeEngine || "Não detectado"}
					</span>
					<span className="tr-text-metadata text-text-muted">
						{info?.isGpuActive ? "Aceleração GPU Ativa" : "Execução CPU Nativa"}
					</span>
				</div>

				<div className="flex flex-col gap-4 rounded-lg border border-border-default bg-container-workspace-bg p-12 shadow-2xs">
					<span className="tr-text-metadata text-text-muted flex items-center gap-4">
						<RiPulseLine className="size-14 text-primary" /> Porta & Endpoint
					</span>
					<span className="tr-code-text text-text-default">
						127.0.0.1:{info?.port ?? 9085}
					</span>
					<span className="tr-text-metadata text-text-muted truncate">
						{info?.baseUrl ? `${info.baseUrl}/health` : "Inativo"}
					</span>
				</div>

				<div className="flex flex-col gap-4 rounded-lg border border-border-default bg-container-workspace-bg p-12 shadow-2xs">
					<span className="tr-text-metadata text-text-muted">Processo (PID)</span>
					<span className="tr-code-text text-text-default">
						{info?.pid ? `PID: ${info.pid}` : "Desacoplado"}
					</span>
					<span className="tr-text-metadata text-text-muted">
						{info?.uptimeMs ? `Uptime: ${Math.round(info.uptimeMs / 1000)}s` : "Parado"}
					</span>
				</div>

				<div className="flex flex-col gap-4 rounded-lg border border-border-default bg-container-workspace-bg p-12 shadow-2xs">
					<span className="tr-text-metadata text-text-muted">Erros / Quedas</span>
					<span className="tr-text-ui text-text-default">
						{info?.errorCount ?? 0} ocorrência(s)
					</span>
					<span className="tr-text-metadata text-text-muted truncate">
						{info?.statusMessage || "Nenhum erro registrado"}
					</span>
				</div>
			</div>

			{/* Resultado do Teste de Integridade */}
			{integrityResult && (
				<div className="flex items-center justify-between rounded border border-border-default bg-container-elevated-bg p-8 tr-text-metadata">
					<div className="flex items-center gap-8">
						<span
							className={cn(
								"size-8 rounded-full",
								integrityResult.success ? "bg-feedback-success" : "bg-feedback-error",
							)}
						/>
						<span className="tr-text-emphasis text-text-default">
							Teste de Integridade ({integrityResult.dimensions}d):
						</span>
						<span className="text-text-muted">
							{integrityResult.success
								? `Inferência em ${integrityResult.latencyMs}ms via ${integrityResult.provider} (Normalizado L2: ${integrityResult.isNormalized ? "Sim" : "Não"})`
								: `Falhou: ${integrityResult.error}`}
						</span>
					</div>
					<Button size="s" variant="ghost" onClick={() => setIntegrityResult(null)}>
						Fechar
					</Button>
				</div>
			)}

			{/* Terminal de Logs ao Vivo */}
			{showLogs && (
				<div className="flex flex-col gap-6 rounded border border-border-default bg-container-elevated-bg p-12">
					<div className="flex items-center justify-between">
						<span className="tr-text-emphasis text-text-default flex items-center gap-6">
							<RiTerminalBoxLine className="size-16 text-primary" />
							Console de Logs do Servidor Jina ({logs.length} linhas recentes)
						</span>
						<Button size="s" variant="ghost" onClick={fetchLogs}>
							<RiRefreshLine className="size-14 mr-4" />
							Atualizar Logs
						</Button>
					</div>
					<div className="max-h-64 overflow-y-auto rounded bg-container-workspace-bg p-8 tr-text-metadata text-text-muted space-y-2 select-text border border-border-default">
						{logs.length === 0 ? (
							<div className="text-text-subtle italic">Nenhum log gravado ainda.</div>
						) : (
							logs.map((line, idx) => (
								<div key={idx} className="whitespace-pre-wrap break-all leading-relaxed">
									{line}
								</div>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}
