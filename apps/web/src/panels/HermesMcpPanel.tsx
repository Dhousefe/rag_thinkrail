import {
	RiCheckLine,
	RiCloseLine,
	RiDatabase2Line,
	RiDeleteBinLine,
	RiHistoryLine,
	RiPlugLine,
	RiRefreshLine,
	RiServerLine,
	RiSpeedUpLine,
	RiTimeLine,
	RiToolsLine,
} from "@remixicon/react";
import type { HermesConnectionStatus } from "@thinkrail/contracts";
import { Button } from "@thinkrail/ui/button";
import { cn } from "@thinkrail/ui/utils";
import { useMemo, useState } from "react";
import { deriveMcpServerRows, selectActiveWorkspace, toast, useAppStore } from "@/store";
import { getTransport } from "@/transport";
import { HermesIndexingBar } from "./hermes/HermesIndexingBar";
import { HermesProjectsView } from "./hermes/HermesProjectsView";
import { HermesToolsView } from "./hermes/HermesToolsView";

export function HermesMcpPanel() {
	const activeWorkspace = useAppStore(selectActiveWorkspace);
	const workspaceId = activeWorkspace?.id ?? null;
	const mcpProjection = useAppStore((s) => (workspaceId ? s.mcpByWorkspace[workspaceId] : null));
	const telemetry = useAppStore((s) => s.mcpTelemetry);
	const clearMcpTelemetry = useAppStore((s) => s.clearMcpTelemetry);
	const hermesManagement = useAppStore((s) => s.hermesManagement);

	const [testingPing, setTestingPing] = useState(false);
	const [connectionDiagnosis, setConnectionDiagnosis] = useState<HermesConnectionStatus | null>(null);
	const [panelTab, setPanelTab] = useState<"projects" | "tools" | "telemetry">("projects");
	const [activeTelemetryFilter, setActiveTelemetryFilter] = useState<"hermes" | "all">("hermes");

	const rows = useMemo(() => {
		return deriveMcpServerRows(mcpProjection ?? undefined, Date.now());
	}, [mcpProjection]);

	// Find Hermes server in MCP configurations
	const hermesServer = useMemo(() => {
		return rows.find((r) => r.summary.name.toLowerCase().includes("hermes"));
	}, [rows]);

	// Metrics filtered
	const metrics = useMemo(() => {
		if (activeTelemetryFilter === "all") return telemetry.metrics;
		return telemetry.metrics.filter(
			(m) =>
				m.server.toLowerCase().includes("hermes") ||
				m.toolName.toLowerCase().includes("hermes") ||
				m.tool.toLowerCase().includes("hermes"),
		);
	}, [telemetry.metrics, activeTelemetryFilter]);

	// Calculated stats
	const stats = useMemo(() => {
		const total = metrics.length;
		if (total === 0) {
			return { total: 0, avgLatency: 0, successCount: 0, errorCount: 0, successRate: 100 };
		}
		let sumLatency = 0;
		let latencyCount = 0;
		let errors = 0;

		for (const m of metrics) {
			if (typeof m.durationMs === "number") {
				sumLatency += m.durationMs;
				latencyCount++;
			}
			if (m.isError || m.status === "error") {
				errors++;
			}
		}

		const avgLatency = latencyCount > 0 ? Math.round(sumLatency / latencyCount) : 0;
		const successCount = total - errors;
		const successRate = Math.round((successCount / total) * 100);

		return {
			total,
			avgLatency,
			successCount,
			errorCount: errors,
			successRate,
		};
	}, [metrics]);

	const handleTestPing = async () => {
		if (!workspaceId) return;
		setTestingPing(true);
		try {
			const status = await getTransport().request("hermes.testConnection", {
				workspaceId,
			});
			setConnectionDiagnosis(status);

			if (status.overallSuccess) {
				toast.success(
					`Conexão OK! Jina (${status.jinaLatencyMs ?? 0}ms), MCP (${status.mcpLatencyMs ?? 0}ms) e ${status.activeProjectsCount} projeto(s) ativo(s) no RAG.`,
				);
			} else if (!status.jinaActive) {
				toast.error(`Servidor Jina Embeddings offline na porta 9085: ${status.jinaStatusText}`);
			} else if (!status.mcpConnected) {
				toast.error(`Servidor Hermes MCP inacessível: ${status.mcpStatusText}`);
			} else {
				toast.warning(
					`Serviços online, porém algum projeto ativo não possui banco de dados pronto para RAG.`,
				);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Falha no teste de conexão Hermes: ${msg}`);
		} finally {
			setTestingPing(false);
		}
	};

	const formatTimestamp = (ts: number) => {
		const d = new Date(ts);
		return d.toLocaleTimeString([], {
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			fractionalSecondDigits: 3,
		});
	};

	const activeToolsCount = useMemo(() => {
		return Object.values(hermesManagement.toolToggles).filter(Boolean).length;
	}, [hermesManagement.toolToggles]);

	return (
		<div className="flex h-full min-h-0 w-full flex-col gap-16 overflow-y-auto p-16">
			{/* Top Header & Server Status Card */}
			<div className="flex flex-col gap-12 rounded-lg border border-border-default bg-control-bg p-16 shadow-xs">
				<div className="flex flex-wrap items-center justify-between gap-12">
					<div className="flex items-center gap-8">
						<div className="flex size-36 items-center justify-center rounded-md bg-feedback-info-subtle text-primary">
							<RiPlugLine className="size-20" />
						</div>
						<div>
							<h2 className="tr-text-ui text-text-default">Integração Hermes MCP</h2>
							<p className="tr-text-metadata text-text-muted">
								Gerenciamento de projetos RAG, controle individual de ferramentas e telemetria
							</p>
						</div>
					</div>

					<div className="flex items-center gap-8">
						<Button
							size="s"
							variant="outline"
							disabled={testingPing || !workspaceId}
							onClick={handleTestPing}
						>
							<RiRefreshLine className={cn("size-14 mr-4", testingPing && "animate-spin")} />
							{testingPing ? "Testando..." : "Testar Conexão"}
						</Button>
					</div>
				</div>

				{/* Server details */}
				<div className="grid grid-cols-1 gap-12 sm:grid-cols-3 pt-8 border-t border-border-default">
					<div className="flex flex-col gap-2">
						<span className="tr-text-metadata text-text-muted">Status do Servidor Hermes</span>
						<div className="flex items-center gap-6">
							<span
								className={cn(
									"size-8 rounded-full",
									hermesServer?.state === "connected"
										? "bg-feedback-success"
										: hermesServer?.state === "starting"
											? "bg-primary animate-pulse"
											: hermesServer?.state === "failed"
												? "bg-feedback-error"
												: "bg-text-subtle",
								)}
							/>
							<span className="tr-text-metadata text-text-default capitalize">
								{hermesServer ? hermesServer.state : "Configurado / Ativo"}
							</span>
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<span className="tr-text-metadata text-text-muted">Projetos Hermes</span>
						<span className="tr-text-metadata text-text-default">
							{hermesManagement.projects.length} cadastrados
						</span>
					</div>

					<div className="flex flex-col gap-2">
						<span className="tr-text-metadata text-text-muted">Ferramentas Ativas</span>
						<span className="tr-text-metadata text-text-default">
							{activeToolsCount} ativadas no host
						</span>
					</div>
				</div>

				{/* Card Detalhado de Diagnóstico de Conexão (Jina + Servidor MCP + Multi-Projetos) */}
				{connectionDiagnosis && (
					<div className="mt-4 flex flex-col gap-8 rounded-md border border-border-default bg-container-workspace-bg p-12">
						<div className="flex items-center justify-between">
							<span className="tr-text-emphasis text-text-default flex items-center gap-6">
								<RiServerLine className="size-16 text-primary" />
								Diagnóstico de Conexão em Tempo Real
							</span>
							<span className="tr-text-metadata text-text-muted">
								{formatTimestamp(connectionDiagnosis.timestamp)}
							</span>
						</div>

						<div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
							{/* Status Jina */}
							<div className="flex items-start gap-8 rounded border border-border-default bg-container-elevated-bg p-8">
								<div className={cn("size-8 mt-4 rounded-full shrink-0", connectionDiagnosis.jinaActive ? "bg-feedback-success" : "bg-feedback-error")} />
								<div className="flex flex-col gap-2 min-w-0">
									<div className="flex items-center gap-6">
										<span className="tr-text-emphasis text-text-default">Jina Embeddings</span>
										{connectionDiagnosis.jinaLatencyMs !== undefined && (
											<span className="tr-text-metadata text-text-muted">{connectionDiagnosis.jinaLatencyMs}ms</span>
										)}
									</div>
									<span className="tr-text-metadata text-text-muted break-all">
										{connectionDiagnosis.jinaStatusText}
									</span>
								</div>
							</div>

							{/* Status Servidor MCP */}
							<div className="flex items-start gap-8 rounded border border-border-default bg-container-elevated-bg p-8">
								<div className={cn("size-8 mt-4 rounded-full shrink-0", connectionDiagnosis.mcpConnected ? "bg-feedback-success" : "bg-feedback-error")} />
								<div className="flex flex-col gap-2 min-w-0">
									<div className="flex items-center gap-6">
										<span className="tr-text-emphasis text-text-default">Servidor Hermes MCP</span>
										{connectionDiagnosis.mcpLatencyMs !== undefined && (
											<span className="tr-text-metadata text-text-muted">{connectionDiagnosis.mcpLatencyMs}ms</span>
										)}
									</div>
									<span className="tr-text-metadata text-text-muted break-all">
										{connectionDiagnosis.mcpStatusText}
									</span>
								</div>
							</div>
						</div>

						{/* Status dos Projetos Ativos no RAG */}
						<div className="flex flex-col gap-4 mt-4 pt-8 border-t border-border-default">
							<span className="tr-text-emphasis text-text-default">
								Projetos Ativos no RAG Multi-Projeto ({connectionDiagnosis.activeProjectsCount}):
							</span>
							<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
								{connectionDiagnosis.activeProjects.map((p) => (
									<div key={p.slug} className="flex items-center justify-between rounded border border-border-default bg-container-elevated-bg p-6 tr-text-metadata">
										<div className="flex items-center gap-6 min-w-0 flex-1">
											<span className={cn("size-6 rounded-full shrink-0", p.status === "ok" ? "bg-feedback-success" : "bg-feedback-error")} />
											<span className="tr-text-emphasis text-text-default truncate">{p.slug}</span>
										</div>
										<div className="flex items-center gap-6 text-text-muted shrink-0">
											{p.dbSizeFormatted && <span>{p.dbSizeFormatted}</span>}
											{p.chunksCount !== undefined && (
												<span className="rounded bg-feedback-info-subtle px-4 text-primary tr-text-metadata">
													{p.chunksCount.toLocaleString()} chunks
												</span>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Abas Internas: Projetos, Ferramentas & Lechs, Telemetria */}
			<div className="flex items-center gap-8 border-b border-border-default pb-4">
				<button
					type="button"
					data-testid="hermes-tab-projects"
					className={cn(
						"flex items-center gap-6 rounded-md px-12 py-6 tr-text-ui transition-colors",
						panelTab === "projects"
							? "bg-control-bg-selected text-primary shadow-xs"
							: "text-text-muted hover:bg-control-bg-hovered hover:text-text-default",
					)}
					onClick={() => setPanelTab("projects")}
				>
					<RiDatabase2Line className="size-16" />
					Projetos Hermes ({hermesManagement.projects.length})
				</button>

				<button
					type="button"
					data-testid="hermes-tab-tools"
					className={cn(
						"flex items-center gap-6 rounded-md px-12 py-6 tr-text-ui transition-colors",
						panelTab === "tools"
							? "bg-control-bg-selected text-primary shadow-xs"
							: "text-text-muted hover:bg-control-bg-hovered hover:text-text-default",
					)}
					onClick={() => setPanelTab("tools")}
				>
					<RiToolsLine className="size-16" />
					Ferramentas & Lechs ({activeToolsCount})
				</button>

				<button
					type="button"
					data-testid="hermes-tab-telemetry"
					className={cn(
						"flex items-center gap-6 rounded-md px-12 py-6 tr-text-ui transition-colors",
						panelTab === "telemetry"
							? "bg-control-bg-selected text-primary shadow-xs"
							: "text-text-muted hover:bg-control-bg-hovered hover:text-text-default",
					)}
					onClick={() => setPanelTab("telemetry")}
				>
					<RiSpeedUpLine className="size-16" />
					Telemetria & Latência ({stats.total})
				</button>
			</div>

			{/* Conteúdo da Aba Selecionada */}
			{panelTab !== "projects" && (
				<HermesIndexingBar progress={hermesManagement.indexingProgress} />
			)}

			{panelTab === "projects" && <HermesProjectsView />}

			{panelTab === "tools" && <HermesToolsView />}

			{panelTab === "telemetry" && (
				<div className="flex flex-col gap-16">
					{/* Telemetry Stats Summary */}
					<div className="grid grid-cols-2 gap-12 sm:grid-cols-4">
						<div className="flex flex-col gap-4 rounded-md border border-border-default bg-control-bg p-12">
							<div className="flex items-center justify-between text-text-muted">
								<span className="tr-text-metadata">Total Chamadas</span>
								<RiHistoryLine className="size-16" />
							</div>
							<span className="tr-text-ui text-text-default">{stats.total}</span>
						</div>

						<div className="flex flex-col gap-4 rounded-md border border-border-default bg-control-bg p-12">
							<div className="flex items-center justify-between text-text-muted">
								<span className="tr-text-metadata">Latência Média</span>
								<RiSpeedUpLine className="size-16 text-primary" />
							</div>
							<span className="tr-text-ui text-text-default">
								{stats.avgLatency} <span className="tr-text-metadata text-text-muted">ms</span>
							</span>
						</div>

						<div className="flex flex-col gap-4 rounded-md border border-border-default bg-control-bg p-12">
							<div className="flex items-center justify-between text-text-muted">
								<span className="tr-text-metadata">Sucesso</span>
								<RiCheckLine className="size-16 text-feedback-success" />
							</div>
							<span className="tr-text-ui text-feedback-success">{stats.successCount}</span>
						</div>

						<div className="flex flex-col gap-4 rounded-md border border-border-default bg-control-bg p-12">
							<div className="flex items-center justify-between text-text-muted">
								<span className="tr-text-metadata">Erros</span>
								<RiCloseLine className="size-16 text-feedback-error" />
							</div>
							<span className="tr-text-ui text-feedback-error">{stats.errorCount}</span>
						</div>
					</div>

					{/* Call History Table */}
					<div className="flex flex-1 min-h-[300px] flex-col rounded-lg border border-border-default bg-control-bg overflow-hidden">
						<div className="flex items-center justify-between border-b border-border-default px-16 py-8 bg-control-bg-hovered">
							<div className="flex items-center gap-12">
								<h3 className="tr-text-ui text-text-default">Histórico de Chamadas e Latência</h3>
								<div className="flex rounded-md bg-control-bg p-2">
									<button
										type="button"
										className={cn(
											"rounded px-8 py-2 tr-text-metadata transition-colors",
											activeTelemetryFilter === "hermes"
												? "bg-control-bg-hovered text-text-default shadow-xs"
												: "text-text-muted hover:text-text-default",
										)}
										onClick={() => setActiveTelemetryFilter("hermes")}
									>
										Hermes MCP
									</button>
									<button
										type="button"
										className={cn(
											"rounded px-8 py-2 tr-text-metadata transition-colors",
											activeTelemetryFilter === "all"
												? "bg-control-bg-hovered text-text-default shadow-xs"
												: "text-text-muted hover:text-text-default",
										)}
										onClick={() => setActiveTelemetryFilter("all")}
									>
										Todos Servidores
									</button>
								</div>
							</div>

							{metrics.length > 0 && (
								<Button
									size="s"
									variant="ghost"
									onClick={() => clearMcpTelemetry()}
									className="text-text-muted hover:text-feedback-error"
								>
									<RiDeleteBinLine className="size-14 mr-4" />
									Limpar Histórico
								</Button>
							)}
						</div>

						{metrics.length === 0 ? (
							<div className="flex flex-1 flex-col items-center justify-center p-24 text-center text-text-muted">
								<RiTimeLine className="size-32 mb-8 text-text-subtle" />
								<span className="tr-text-ui">Nenhuma chamada registrada até o momento</span>
								<span className="tr-text-metadata text-text-muted max-w-sm mt-4">
									As chamadas de ferramentas executadas pelo agente serão registradas aqui em tempo
									real com sua latência exata em ms.
								</span>
							</div>
						) : (
							<div className="flex-1 overflow-x-auto overflow-y-auto">
								<table className="w-full border-collapse tr-text-metadata text-left">
									<thead className="sticky top-0 bg-control-bg border-b border-border-default">
										<tr className="text-text-muted">
											<th className="px-12 py-8">Horário</th>
											<th className="px-12 py-8">Servidor</th>
											<th className="px-12 py-8">Ferramenta</th>
											<th className="px-12 py-8">Status</th>
											<th className="px-12 py-8 text-right">Latência (ms)</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border-default">
										{metrics.map((m) => (
											<tr key={m.id} className="hover:bg-control-bg-hovered transition-colors">
												<td className="px-12 py-8 text-text-muted">
													{formatTimestamp(m.startedAt)}
												</td>
												<td className="px-12 py-8 text-text-default">
													<span className="rounded bg-control-bg-hovered px-6 py-2">
														{m.server}
													</span>
												</td>
												<td className="px-12 py-8 text-text-default">
													<div className="flex flex-col">
														<span className="tr-text-emphasis">{m.tool}</span>
														<span className="text-text-muted truncate max-w-xs">{m.toolName}</span>
													</div>
												</td>
												<td className="px-12 py-8">
													{m.status === "running" ? (
														<span className="inline-flex items-center gap-4 text-primary">
															<span className="size-6 rounded-full bg-primary animate-ping" />
															Executando
														</span>
													) : m.isError || m.status === "error" ? (
														<span className="inline-flex items-center gap-4 text-feedback-error">
															<RiCloseLine className="size-14" />
															Erro
														</span>
													) : (
														<span className="inline-flex items-center gap-4 text-feedback-success">
															<RiCheckLine className="size-14" />
															OK
														</span>
													)}
												</td>
												<td className="px-12 py-8 text-right text-text-default">
													{typeof m.durationMs === "number" ? (
														<span
															className={cn(
																m.durationMs > 1000
																	? "text-feedback-warning"
																	: m.durationMs > 3000
																		? "text-feedback-error"
																		: "text-text-default",
															)}
														>
															{m.durationMs} ms
														</span>
													) : (
														<span className="text-text-muted">...</span>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
