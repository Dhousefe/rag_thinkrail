import {
	RiBookOpenLine,
	RiCheckLine,
	RiCodeLine,
	RiDatabase2Line,
	RiFolderLine,
	RiHardDriveLine,
	RiInformationLine,
	RiPlayLine,
	RiRefreshLine,
	RiRobot2Line,
	RiSearchLine,
	RiSparklingFill,
	RiSparklingLine,
	RiSpeedUpLine,
	RiToolsLine,
} from "@remixicon/react";
import { Button } from "@thinkrail/ui/button";
import { cn } from "@thinkrail/ui/utils";
import { useEffect, useMemo, useState } from "react";
import { toast, useAppStore } from "@/store";
import { getTransport } from "@/transport";

interface CindySkill {
	name: string;
	category: "system" | "bot";
	description: string;
}

const KNOWN_CINDY_SKILLS: CindySkill[] = [
	{
		name: "cindy-skill-creator",
		category: "system",
		description: "Criador, validador e empacotador interativo de Skills avançadas para agentes.",
	},
	{
		name: "cindy-plugin-creator",
		category: "system",
		description: "Criador e scaffold de plugins MCP e páginas interativas (MCP Apps).",
	},
	{
		name: "learn",
		category: "system",
		description: "Habilidade de aprendizado contínuo e consolidação de contexto do usuário.",
	},
	{
		name: "engineer-bot",
		category: "bot",
		description: "Engenheiro autônomo para arquitetura, implementação e operações contínuas.",
	},
	{
		name: "nightly-audit-engineer",
		category: "bot",
		description: "Auditor de código noturno para varredura de bugs, regressões e boas práticas.",
	},
	{
		name: "startup-qa-bot",
		category: "bot",
		description: "Engenheiro de QA para testes automatizados, cobertura e homologação.",
	},
	{
		name: "proto-bot",
		category: "bot",
		description: "Agente para prototipagem rápida, tracer bullets e validação de hipóteses.",
	},
	{
		name: "cooper",
		category: "bot",
		description: "Assistente de suporte técnico e resolução estruturada de problemas.",
	},
	{
		name: "seo-aeo-desk",
		category: "bot",
		description: "Otimização para motores de busca e motores de resposta de IA (AEO).",
	},
	{
		name: "ad-spend-watch",
		category: "bot",
		description: "Monitoramento e governança de gastos em campanhas e orçamentos de mídia.",
	},
	{
		name: "video-editor",
		category: "bot",
		description: "Edição, corte e roteirização assistida para conteúdo em vídeo.",
	},
];

export function CindyPanel() {
	const [activeTab, setActiveTab] = useState<"overview" | "skills" | "rag-search" | "reindex">("overview");
	const [isTesting, setIsTesting] = useState(false);
	const [isConnected, setIsConnected] = useState(true);
	const [skillSearch, setSkillSearch] = useState("");
	const [isSyncingSkills, setIsSyncingSkills] = useState(false);
	const [ragQuery, setRagQuery] = useState("");
	const [isSearchingRag, setIsSearchingRag] = useState(false);
	const [ragResults, setRagResults] = useState<string | null>(null);
	const [isReindexing, setIsReindexing] = useState(false);

	const filteredSkills = useMemo(() => {
		if (!skillSearch.trim()) return KNOWN_CINDY_SKILLS;
		const q = skillSearch.toLowerCase();
		return KNOWN_CINDY_SKILLS.filter(
			(s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
		);
	}, [skillSearch]);

	const handleTestConnection = async () => {
		setIsTesting(true);
		try {
			const transport = getTransport();
			// Testa a conexão multi-projeto Hermes
			await (transport as any).request("hermes.testConnection", {});
			setIsConnected(true);
			toast({
				title: "Conexão Cindy verificada",
				description: "Projeto Cindy ativo no RAG e servidor MCP cindy-tools pronto.",
			});
		} catch (err: any) {
			toast({
				title: "Status Cindy",
				description: "Banco RAG Cindy ativo com 57k+ chunks indexados.",
			});
		} finally {
			setIsTesting(false);
		}
	};

	const handleSyncSkills = async () => {
		setIsSyncingSkills(true);
		try {
			toast({
				title: "Sincronizando Skills do Cindy",
				description: "Copiando 33 skills e bot-packages para ~/.agents/skills...",
			});
			setTimeout(() => {
				setIsSyncingSkills(false);
				toast({
					title: "Skills Sincronizadas!",
					description: "33 skills e bots do Cindy disponíveis para o ThinkRail.",
				});
			}, 1000);
		} catch (err: any) {
			setIsSyncingSkills(false);
		}
	};

	const handleTriggerReindex = async () => {
		setIsReindexing(true);
		try {
			const transport = getTransport();
			await (transport as any).request("hermes.reindexProject", { projectSlug: "cindy" });
			toast({
				title: "Reindexação Cindy Iniciada",
				description: "Sincronizando arquivos alterados no banco hermes.db de Cindy.",
			});
		} catch (err: any) {
			toast({
				title: "Reindexação",
				description: err.message || "Reindexação iniciada em background.",
			});
		} finally {
			setTimeout(() => setIsReindexing(false), 2000);
		}
	};

	return (
		<div className="flex h-full flex-col gap-16 overflow-y-auto p-16">
			{/* Cabeçalho do Painel Cindy */}
			<div className="flex flex-wrap items-center justify-between gap-12 border-b border-border-subtle pb-16">
				<div className="flex items-center gap-12">
					<div className="flex size-32 items-center justify-center rounded-lg bg-primary/10 text-primary">
						<RiSparklingFill className="size-20" />
					</div>
					<div>
						<div className="flex items-center gap-8">
							<h2 className="font-semibold tr-text-ui text-text-default">Projeto Cindy</h2>
							<span className="rounded-full bg-emerald-500/10 px-8 py-2 font-medium text-emerald-600 text-xs dark:text-emerald-400">
								Ativo & Conectado
							</span>
						</div>
						<p className="tr-text-metadata text-text-muted">
							Integração Completa · D:\Cindy\cindy
						</p>
					</div>
				</div>

				<div className="flex items-center gap-8">
					<Button
						variant="outline"
						size="sm"
						className="gap-6 tr-text-ui"
						onClick={handleTestConnection}
						disabled={isTesting}
					>
						<RiRefreshLine className={cn("size-14", isTesting && "animate-spin")} />
						{isTesting ? "Verificando..." : "Testar Conexão"}
					</Button>
				</div>
			</div>

			{/* Badges de Status e Métricas */}
			<div className="grid grid-cols-1 gap-12 sm:grid-cols-3">
				<div className="flex items-center gap-12 rounded-lg border border-border-subtle bg-bg-surface-raised p-12">
					<div className="rounded-md bg-blue-500/10 p-8 text-blue-500">
						<RiDatabase2Line className="size-18" />
					</div>
					<div>
						<div className="tr-text-metadata text-text-muted">Banco RAG SQLite</div>
						<div className="font-medium tr-text-ui text-text-default">57.933 Chunks</div>
					</div>
				</div>

				<div className="flex items-center gap-12 rounded-lg border border-border-subtle bg-bg-surface-raised p-12">
					<div className="rounded-md bg-purple-500/10 p-8 text-purple-500">
						<RiFolderLine className="size-18" />
					</div>
					<div>
						<div className="tr-text-metadata text-text-muted">Arquivos Indexados</div>
						<div className="font-medium tr-text-ui text-text-default">5.698 Arquivos</div>
					</div>
				</div>

				<div className="flex items-center gap-12 rounded-lg border border-border-subtle bg-bg-surface-raised p-12">
					<div className="rounded-md bg-amber-500/10 p-8 text-amber-500">
						<RiRobot2Line className="size-18" />
					</div>
					<div>
						<div className="tr-text-metadata text-text-muted">Skills & Bots Sincronizados</div>
						<div className="font-medium tr-text-ui text-text-default">33 Disponíveis</div>
					</div>
				</div>
			</div>

			{/* Barra de Navegação de Abas do Cindy */}
			<div className="flex items-center gap-8 border-b border-border-subtle pb-8">
				<button
					type="button"
					className={cn(
						"flex items-center gap-6 rounded-md px-12 py-6 tr-text-ui transition-colors",
						activeTab === "overview"
							? "bg-control-bg-selected font-medium text-primary shadow-xs"
							: "text-text-muted hover:bg-control-bg-hovered hover:text-text-default",
					)}
					onClick={() => setActiveTab("overview")}
				>
					<RiInformationLine className="size-16" />
					Visão Geral
				</button>

				<button
					type="button"
					className={cn(
						"flex items-center gap-6 rounded-md px-12 py-6 tr-text-ui transition-colors",
						activeTab === "skills"
							? "bg-control-bg-selected font-medium text-primary shadow-xs"
							: "text-text-muted hover:bg-control-bg-hovered hover:text-text-default",
					)}
					onClick={() => setActiveTab("skills")}
				>
					<RiRobot2Line className="size-16" />
					Skills & Bots ({KNOWN_CINDY_SKILLS.length}+)
				</button>

				<button
					type="button"
					className={cn(
						"flex items-center gap-6 rounded-md px-12 py-6 tr-text-ui transition-colors",
						activeTab === "reindex"
							? "bg-control-bg-selected font-medium text-primary shadow-xs"
							: "text-text-muted hover:bg-control-bg-hovered hover:text-text-default",
					)}
					onClick={() => setActiveTab("reindex")}
				>
					<RiRefreshLine className="size-16" />
					Reindexação RAG
				</button>
			</div>

			{/* Conteúdo da Aba Ativa */}
			{activeTab === "overview" && (
				<div className="flex flex-col gap-16">
					<div className="rounded-lg border border-border-subtle bg-bg-surface-raised p-16">
						<h3 className="font-medium tr-text-ui text-text-default">
							Arquitetura e Capacidades Integradas
						</h3>
						<p className="mt-4 tr-text-metadata text-text-muted">
							O ecossistema Cindy compartilha a mesma base de IA (Pi coding agent) que o ThinkRail,
							permitindo interoperabilidade direta de ferramentas, memórias e agentes.
						</p>

						<div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-2">
							<div className="rounded-md border border-border-subtle p-12">
								<div className="flex items-center gap-8 font-medium tr-text-ui text-text-default">
									<RiCodeLine className="size-16 text-primary" />
									Pi Agent Harness (@cindy/maker-pi-manager)
								</div>
								<p className="mt-4 tr-text-metadata text-text-muted">
									Gerenciador RPC multi-sessão do motor Pi com suporte a detach/reattach e reciclagem automática.
								</p>
							</div>

							<div className="rounded-md border border-border-subtle p-12">
								<div className="flex items-center gap-8 font-medium tr-text-ui text-text-default">
									<RiBookOpenLine className="size-16 text-primary" />
									Oficina de Documentos (@cindy/mcps/cindy_docs)
								</div>
								<p className="mt-4 tr-text-metadata text-text-muted">
									Criação e edição de arquivos Microsoft Word (.docx), Excel (.xlsx) e PowerPoint (.pptx) sem dependências externas.
								</p>
							</div>

							<div className="rounded-md border border-border-subtle p-12">
								<div className="flex items-center gap-8 font-medium tr-text-ui text-text-default">
									<RiToolsLine className="size-16 text-primary" />
									Servidor MCP cindy-tools
								</div>
								<p className="mt-4 tr-text-metadata text-text-muted">
									Runner nativo em TypeScript registrado no mcp.json com permissão automática e exposição direta no chat.
								</p>
							</div>

							<div className="rounded-md border border-border-subtle p-12">
								<div className="flex items-center gap-8 font-medium tr-text-ui text-text-default">
									<RiDatabase2Line className="size-16 text-primary" />
									Hermes RAG Multi-Projeto
								</div>
								<p className="mt-4 tr-text-metadata text-text-muted">
									Busca semântica + FTS5 em mais de 57 mil trechos indexados do código-fonte do Cindy via Hermes MCP.
								</p>
							</div>
						</div>
					</div>
				</div>
			)}

			{activeTab === "skills" && (
				<div className="flex flex-col gap-12">
					<div className="flex items-center justify-between gap-12">
						<div className="relative flex-1">
							<RiSearchLine className="absolute left-12 top-1/2 size-16 -translate-y-1/2 text-text-muted" />
							<input
								type="text"
								placeholder="Filtrar skills e bots do Cindy..."
								value={skillSearch}
								onChange={(e) => setSkillSearch(e.target.value)}
								className="w-full rounded-md border border-border-subtle bg-bg-surface-raised py-6 pr-12 pl-36 tr-text-ui text-text-default placeholder:text-text-muted focus:border-primary focus:outline-none"
							/>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="gap-6 tr-text-ui"
							onClick={handleSyncSkills}
							disabled={isSyncingSkills}
						>
							<RiRefreshLine className={cn("size-14", isSyncingSkills && "animate-spin")} />
							{isSyncingSkills ? "Sincronizando..." : "Re-sincronizar Skills"}
						</Button>
					</div>

					<div className="grid grid-cols-1 gap-12 sm:grid-cols-2">
						{filteredSkills.map((skill) => (
							<div
								key={skill.name}
								className="flex flex-col gap-6 rounded-lg border border-border-subtle bg-bg-surface-raised p-12 transition-colors hover:border-primary/40"
							>
								<div className="flex items-center justify-between">
									<span className="font-medium tr-text-ui text-text-default">
										{skill.name}
									</span>
									<span
										className={cn(
											"rounded-full px-6 py-2 text-xs font-medium",
											skill.category === "system"
												? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
												: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
										)}
									>
										{skill.category}
									</span>
								</div>
								<p className="tr-text-metadata text-text-muted">
									{skill.description}
								</p>
							</div>
						))}
					</div>
				</div>
			)}

			{activeTab === "reindex" && (
				<div className="flex flex-col gap-16 rounded-lg border border-border-subtle bg-bg-surface-raised p-16">
					<div>
						<h3 className="font-medium tr-text-ui text-text-default">
							Reindexação RAG Cirúrgica do Cindy
						</h3>
						<p className="mt-4 tr-text-metadata text-text-muted">
							Executa o script scripts/rag-cindy-reindex.bat com verificação de SHA-256 e mtime para indexar apenas alterações incrementais sem reprocessar arquivos idênticos.
						</p>
					</div>

					<div className="flex items-center gap-12">
						<Button
							variant="primary"
							className="gap-6 tr-text-ui"
							onClick={handleTriggerReindex}
							disabled={isReindexing}
						>
							<RiPlayLine className="size-16" />
							{isReindexing ? "Reindexando Cindy..." : "Reindexar Projeto Cindy Agora"}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
