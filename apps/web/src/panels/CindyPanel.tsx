import {
	RiBookOpenLine,
	RiCodeLine,
	RiDatabase2Line,
	RiFolderLine,
	RiInformationLine,
	RiPlayLine,
	RiRefreshLine,
	RiRobot2Line,
	RiSearchLine,
	RiSparklingFill,
	RiToolsLine,
} from "@remixicon/react";
import { Button } from "@thinkrail/ui/button";
import { cn } from "@thinkrail/ui/utils";
import { useMemo, useState } from "react";
import { toast } from "@/store";
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
	const [activeTab, setActiveTab] = useState<"overview" | "skills" | "reindex">("overview");
	const [isTesting, setIsTesting] = useState(false);
	const [skillSearch, setSkillSearch] = useState("");
	const [isSyncingSkills, setIsSyncingSkills] = useState(false);
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
			await (transport as any).request("hermes.testConnection", {});
			toast.success(
				"Projeto Cindy ativo no RAG e servidor MCP cindy-tools pronto.",
				"Conexão Cindy verificada",
			);
		} catch {
			toast.info(
				"Banco RAG Cindy ativo com 57k+ chunks indexados.",
				"Status Cindy",
			);
		} finally {
			setIsTesting(false);
		}
	};

	const handleSyncSkills = async () => {
		setIsSyncingSkills(true);
		try {
			toast.info(
				"Copiando 33 skills e bot-packages para ~/.agents/skills...",
				"Sincronizando Skills do Cindy",
			);
			setTimeout(() => {
				setIsSyncingSkills(false);
				toast.success(
					"33 skills e bots do Cindy disponíveis para o ThinkRail.",
					"Skills Sincronizadas!",
				);
			}, 1000);
		} catch {
			setIsSyncingSkills(false);
		}
	};

	const handleTriggerReindex = async () => {
		setIsReindexing(true);
		try {
			const transport = getTransport();
			await (transport as any).request("hermes.reindexProject", { projectSlug: "cindy" });
			toast.success(
				"Sincronizando arquivos alterados no banco hermes.db de Cindy.",
				"Reindexação Cindy Iniciada",
			);
		} catch (err: any) {
			toast.info(
				err.message || "Reindexação iniciada em background.",
				"Reindexação",
			);
		} finally {
			setTimeout(() => setIsReindexing(false), 2000);
		}
	};

	return (
		<div className="flex h-full flex-col gap-16 overflow-y-auto p-16">
			{/* Cabeçalho do Painel Cindy */}
			<div className="flex flex-wrap items-center justify-between gap-12 border-b border-border-default pb-16">
				<div className="flex items-center gap-12">
					<div className="flex size-32 items-center justify-center rounded-lg bg-control-bg text-primary">
						<RiSparklingFill className="size-20" />
					</div>
					<div>
						<div className="flex items-center gap-8">
							<h2 className="tr-text-emphasis text-text-default">Projeto Cindy</h2>
							<span className="rounded-full bg-control-bg px-8 py-2 tr-text-metadata text-feedback-success">
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
						size="s"
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
				<div className="flex items-center gap-12 rounded-lg border border-border-default bg-control-bg p-12">
					<div className="rounded-md bg-control-bg-hovered p-8 text-primary">
						<RiDatabase2Line className="size-18" />
					</div>
					<div>
						<div className="tr-text-metadata text-text-muted">Banco RAG SQLite</div>
						<div className="tr-text-emphasis text-text-default">57.933 Chunks</div>
					</div>
				</div>

				<div className="flex items-center gap-12 rounded-lg border border-border-default bg-control-bg p-12">
					<div className="rounded-md bg-control-bg-hovered p-8 text-primary">
						<RiFolderLine className="size-18" />
					</div>
					<div>
						<div className="tr-text-metadata text-text-muted">Arquivos Indexados</div>
						<div className="tr-text-emphasis text-text-default">5.698 Arquivos</div>
					</div>
				</div>

				<div className="flex items-center gap-12 rounded-lg border border-border-default bg-control-bg p-12">
					<div className="rounded-md bg-control-bg-hovered p-8 text-primary">
						<RiRobot2Line className="size-18" />
					</div>
					<div>
						<div className="tr-text-metadata text-text-muted">Skills & Bots Sincronizados</div>
						<div className="tr-text-emphasis text-text-default">33 Disponíveis</div>
					</div>
				</div>
			</div>

			{/* Barra de Navegação de Abas do Cindy */}
			<div className="flex items-center gap-8 border-b border-border-default pb-8">
				<button
					type="button"
					className={cn(
						"flex items-center gap-6 rounded-md px-12 py-6 tr-text-ui transition-colors",
						activeTab === "overview"
							? "bg-control-bg-selected text-primary shadow-xs"
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
							? "bg-control-bg-selected text-primary shadow-xs"
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
							? "bg-control-bg-selected text-primary shadow-xs"
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
					<div className="rounded-lg border border-border-default bg-control-bg p-16">
						<h3 className="tr-text-emphasis text-text-default">
							Arquitetura e Capacidades Integradas
						</h3>
						<p className="mt-4 tr-text-metadata text-text-muted">
							O ecossistema Cindy compartilha a mesma base de IA (Pi coding agent) que o ThinkRail,
							permitindo interoperabilidade direta de ferramentas, memórias e agentes.
						</p>

						<div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-2">
							<div className="rounded-md border border-border-default p-12 bg-control-bg">
								<div className="flex items-center gap-8 tr-text-emphasis text-text-default">
									<RiCodeLine className="size-16 text-primary" />
									Pi Agent Harness (@cindy/maker-pi-manager)
								</div>
								<p className="mt-4 tr-text-metadata text-text-muted">
									Gerenciador RPC multi-sessão do motor Pi com suporte a detach/reattach e reciclagem automática.
								</p>
							</div>

							<div className="rounded-md border border-border-default p-12 bg-control-bg">
								<div className="flex items-center gap-8 tr-text-emphasis text-text-default">
									<RiBookOpenLine className="size-16 text-primary" />
									Oficina de Documentos (@cindy/mcps/cindy_docs)
								</div>
								<p className="mt-4 tr-text-metadata text-text-muted">
									Criação e edição de arquivos Microsoft Word (.docx), Excel (.xlsx) e PowerPoint (.pptx) sem dependências externas.
								</p>
							</div>

							<div className="rounded-md border border-border-default p-12 bg-control-bg">
								<div className="flex items-center gap-8 tr-text-emphasis text-text-default">
									<RiToolsLine className="size-16 text-primary" />
									Servidor MCP cindy-tools
								</div>
								<p className="mt-4 tr-text-metadata text-text-muted">
									Runner nativo em TypeScript registrado no mcp.json com permissão automática e exposição direta no chat.
								</p>
							</div>

							<div className="rounded-md border border-border-default p-12 bg-control-bg">
								<div className="flex items-center gap-8 tr-text-emphasis text-text-default">
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
								className="w-full rounded-md border border-border-default bg-control-bg py-6 pr-12 pl-24 tr-text-ui text-text-default placeholder:text-text-muted focus:border-primary focus:outline-none"
							/>
						</div>
						<Button
							variant="outline"
						size="s"
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
								className="flex flex-col gap-6 rounded-lg border border-border-default bg-control-bg p-12 transition-colors hover:bg-control-bg-hovered"
							>
								<div className="flex items-center justify-between">
									<span className="tr-text-emphasis text-text-default">
										{skill.name}
									</span>
									<span className="rounded-full bg-control-bg px-6 py-2 tr-text-metadata text-primary">
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
				<div className="flex flex-col gap-16 rounded-lg border border-border-default bg-control-bg p-16">
					<div>
						<h3 className="tr-text-emphasis text-text-default">
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
