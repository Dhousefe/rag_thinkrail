import {
	RiAddLine,
	RiAlertLine,
	RiCheckLine,
	RiDatabase2Line,
	RiDeleteBin6Line,
	RiFileCopyLine,
	RiFolder2Line,
	RiInformationLine,
	RiPlayCircleLine,
	RiRefreshLine,
	RiSearchLine,
} from "@remixicon/react";
import type { HermesProjectInfo } from "@thinkrail/contracts";
import { Button } from "@thinkrail/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@thinkrail/ui/dialog";
import { cn } from "@thinkrail/ui/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast, useAppStore } from "@/store";
import { getTransport } from "@/transport";
import { HermesIndexingBar } from "./HermesIndexingBar";

export function HermesProjectsView() {
	const hermesManagement = useAppStore((s) => s.hermesManagement);
	const setHermesProjects = useAppStore((s) => s.setHermesProjects);
	const setHermesLoading = useAppStore((s) => s.setHermesLoading);
	const setHermesError = useAppStore((s) => s.setHermesError);
	const setHermesActiveProjectSlugs = useAppStore((s) => s.setHermesActiveProjectSlugs);
	const startHermesIndexing = useAppStore((s) => s.startHermesIndexing);
	const setHermesIndexingProgress = useAppStore((s) => s.setHermesIndexingProgress);
	const finishHermesIndexing = useAppStore((s) => s.finishHermesIndexing);

	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState<"all" | "withDb" | "active">("all");

	// Modals
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [newProjectName, setNewProjectName] = useState("");
	const [newProjectSlug, setNewProjectSlug] = useState("");
	const [newProjectPath, setNewProjectPath] = useState("");
	const [creating, setCreating] = useState(false);

	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [projectToDelete, setProjectToDelete] = useState<HermesProjectInfo | null>(null);
	const [confirmSlugInput, setConfirmSlugInput] = useState("");
	const [deleting, setDeleting] = useState(false);

	const [infoModalOpen, setInfoModalOpen] = useState(false);
	const [infoProject, setInfoProject] = useState<HermesProjectInfo | null>(null);

	const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

	// Carregamento de projetos via transporte WebSocket
	const loadProjects = useCallback(async () => {
		setHermesLoading(true);
		try {
			const [result, activeResult] = await Promise.all([
				getTransport().request("hermes.listProjects", {}),
				getTransport().request("hermes.getActiveProjects", {}).catch(() => ({ activeSlugs: ["project-thinkrail"] })),
			]);
			setHermesProjects(result.projects, result.hermesHome);
			if (Array.isArray(activeResult.activeSlugs)) {
				setHermesActiveProjectSlugs(activeResult.activeSlugs);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			setHermesError(msg);
			toast.error(`Falha ao carregar projetos Hermes: ${msg}`);
		}
	}, [setHermesLoading, setHermesProjects, setHermesActiveProjectSlugs, setHermesError]);

	// Polling em tempo real do progresso real da reindexação vindo do backend/ThinkRail
	const pollIndexingProgress = useCallback(async () => {
		try {
			const progress = await getTransport().request("hermes.getIndexingProgress", {});
			if (progress) {
				setHermesIndexingProgress(progress);
				if (
					progress.status === "completed" ||
					(!progress.isIndexing && progress.percentage >= 100)
				) {
					if (progress.projectSlug) {
						finishHermesIndexing(progress.projectSlug);
					}
					void loadProjects();
				}
			}
		} catch {}
	}, [setHermesIndexingProgress, finishHermesIndexing, loadProjects]);

	// Loop contínuo: 400ms enquanto indexa, 2000ms em idle (detecta disparos do ThinkRail em background)
	useEffect(() => {
		const intervalMs = hermesManagement.indexingProgress.isIndexing ? 400 : 2000;
		const timer = setInterval(() => {
			void pollIndexingProgress();
		}, intervalMs);
		return () => clearInterval(timer);
	}, [hermesManagement.indexingProgress.isIndexing, pollIndexingProgress]);

	useEffect(() => {
		void loadProjects();
	}, [loadProjects]);

	const activeSlugs = useMemo(() => {
		return hermesManagement.activeProjectSlugs && hermesManagement.activeProjectSlugs.length > 0
			? hermesManagement.activeProjectSlugs
			: hermesManagement.activeProjectSlug
				? [hermesManagement.activeProjectSlug]
				: ["project-thinkrail"];
	}, [hermesManagement.activeProjectSlugs, hermesManagement.activeProjectSlug]);

	const handleToggleProjectActive = async (slug: string) => {
		const isCurrentlyActive = activeSlugs.includes(slug);
		let nextSlugs: string[];
		if (isCurrentlyActive) {
			if (activeSlugs.length <= 1) {
				toast.error("Pelo menos um projeto deve permanecer ativo para o RAG.");
				return;
			}
			nextSlugs = activeSlugs.filter((s) => s !== slug);
		} else {
			nextSlugs = [...activeSlugs, slug];
		}

		setHermesActiveProjectSlugs(nextSlugs);
		try {
			await getTransport().request("hermes.setActiveProjects", { slugs: nextSlugs });
			if (isCurrentlyActive) {
				toast.success(`Projeto "${slug}" desativado. Agora ${nextSlugs.length} ativo(s) no RAG.`);
			} else {
				toast.success(`Projeto "${slug}" ativado! Agora ${nextSlugs.length} projetos ativos para busca cruzada.`);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Falha ao persistir projetos ativos: ${msg}`);
		}
	};

	const handleCopyPath = (path: string, slug: string) => {
		void navigator.clipboard.writeText(path);
		setCopiedSlug(slug);
		toast.success("Caminho copiado para a área de transferência.");
		setTimeout(() => setCopiedSlug(null), 2000);
	};

	const handleCreateProject = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newProjectSlug.trim() || !newProjectPath.trim()) {
			toast.error("Preencha o slug e o caminho do projeto.");
			return;
		}
		const formattedSlug = newProjectSlug
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9-_]/g, "-");
		setCreating(true);
		try {
			await getTransport().request("hermes.createProject", {
				slug: formattedSlug,
				name: newProjectName.trim() || formattedSlug,
				path: newProjectPath.trim(),
			});
			toast.success(`Projeto Hermes "${formattedSlug}" criado com sucesso.`);
			setCreateModalOpen(false);
			setNewProjectName("");
			setNewProjectSlug("");
			setNewProjectPath("");
			await loadProjects();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Erro ao criar projeto Hermes: ${msg}`);
		} finally {
			setCreating(false);
		}
	};

	const handleDeleteProject = async () => {
		if (!projectToDelete || confirmSlugInput.trim() !== projectToDelete.slug) {
			toast.error("Digite o identificador exato para autorizar a remoção.");
			return;
		}
		setDeleting(true);
		try {
			await getTransport().request("hermes.deleteProject", {
				slug: projectToDelete.slug,
			});
			toast.success(`Projeto "${projectToDelete.slug}" removido com sucesso.`);
			setDeleteModalOpen(false);
			setProjectToDelete(null);
			setConfirmSlugInput("");
			await loadProjects();
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Erro ao remover projeto Hermes: ${msg}`);
		} finally {
			setDeleting(false);
		}
	};

	const handleStartReindex = async (project: HermesProjectInfo) => {
		if (hermesManagement.indexingProgress.isIndexing) {
			toast.error("Já existe uma indexação em andamento no Hermes.");
			return;
		}

		startHermesIndexing(project.slug, 100);

		try {
			void getTransport().request("hermes.reindexProject", {
				slug: project.slug,
				path: project.path,
			}).then(() => {
				void loadProjects();
			}).catch((err) => {
				const msg = err instanceof Error ? err.message : String(err);
				toast.error(`Falha no processo de reindexação: ${msg}`);
			});
			toast.success(`Indexação iniciada para o projeto "${project.slug}".`);
			// Dispara primeiro poll imediato
			setTimeout(() => void pollIndexingProgress(), 150);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			toast.error(`Falha ao disparar reindexação: ${msg}`);
		}
	};

	// Filtros de busca e status
	const filteredProjects = useMemo(() => {
		return hermesManagement.projects.filter((p) => {
			const matchesQuery =
				!searchQuery.trim() ||
				p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
				p.path.toLowerCase().includes(searchQuery.toLowerCase());

			if (!matchesQuery) return false;
			if (filterStatus === "withDb") return p.hasDb;
			if (filterStatus === "active") return activeSlugs.includes(p.slug);
			return true;
		});
	}, [hermesManagement.projects, searchQuery, filterStatus, activeSlugs]);

	// Estatísticas de resumo
	const stats = useMemo(() => {
		const total = hermesManagement.projects.length;
		const withDb = hermesManagement.projects.filter((p) => p.hasDb).length;
		const active = activeSlugs.length;
		return { total, withDb, active };
	}, [hermesManagement.projects, activeSlugs]);

	return (
		<div className="space-y-4 min-w-0 max-w-full overflow-hidden">
			{/* Barra de Progresso Preditiva durante reindexação */}
			<HermesIndexingBar progress={hermesManagement.indexingProgress} />

			{/* Cabeçalho e Ações */}
			<div className="flex flex-wrap items-center justify-between gap-8 min-w-0">
				<div className="min-w-0 flex-1">
					<h3 className="tr-text-emphasis text-text-default truncate">Projetos Hermes RAG</h3>
					<p className="tr-text-metadata text-text-muted truncate">
						Gerencie e indexe bases de código no subsistema AST e vetorial SQLite.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-6 shrink-0">
					<Button
						size="s"
						variant="outline"
						onClick={() => void loadProjects()}
						disabled={hermesManagement.isLoading}
						tooltip="Atualizar lista de projetos do disco"
					>
						<RiRefreshLine
							className={cn("size-14", hermesManagement.isLoading && "animate-spin")}
						/>
						Atualizar
					</Button>
					<Button size="s" variant="primary" onClick={() => setCreateModalOpen(true)}>
						<RiAddLine className="size-14" />
						Novo Projeto
					</Button>
				</div>
			</div>

			{/* Barra de Métricas Rápidas */}
			<div className="grid grid-cols-1 gap-8 sm:grid-cols-3 min-w-0 max-w-full">
				<button
					type="button"
					onClick={() => setFilterStatus("all")}
					className={cn(
						"flex flex-col items-center justify-center p-2 rounded-md border text-center transition-colors cursor-pointer",
						filterStatus === "all"
							? "border-primary bg-container-elevated-bg"
							: "border-border-default bg-container-workspace-bg hover:bg-container-elevated-bg",
					)}
				>
					<span className="tr-text-emphasis text-text-default">{stats.total}</span>
					<span className="tr-text-metadata text-text-muted">Total de Projetos</span>
				</button>
				<button
					type="button"
					onClick={() => setFilterStatus("withDb")}
					className={cn(
						"flex flex-col items-center justify-center p-2 rounded-md border text-center transition-colors cursor-pointer",
						filterStatus === "withDb"
							? "border-primary bg-container-elevated-bg"
							: "border-border-default bg-container-workspace-bg hover:bg-container-elevated-bg",
					)}
				>
					<span className="tr-text-emphasis text-feedback-success">{stats.withDb}</span>
					<span className="tr-text-metadata text-text-muted">Com Banco SQLite</span>
				</button>
				<button
					type="button"
					onClick={() => setFilterStatus("active")}
					className={cn(
						"flex flex-col items-center justify-center p-2 rounded-md border text-center transition-colors cursor-pointer",
						filterStatus === "active"
							? "border-primary bg-container-elevated-bg"
							: "border-border-default bg-container-workspace-bg hover:bg-container-elevated-bg",
					)}
				>
					<span className="tr-text-emphasis text-primary">{stats.active}</span>
					<span className="tr-text-metadata text-text-muted">Ativos no RAG</span>
				</button>
			</div>

			{/* Banner de RAG Multi-Projeto */}
			<div className="flex items-center justify-between rounded-md border border-border-default bg-feedback-info-subtle p-4 gap-2">
				<div className="flex items-center gap-2 min-w-0 flex-1">
					<RiDatabase2Line className="size-16 text-primary shrink-0" />
					<div className="flex flex-col">
						<span className="tr-text-emphasis text-text-default">
							RAG Multi-Projeto Ativo ({activeSlugs.length} selecionado{activeSlugs.length > 1 ? "s" : ""})
						</span>
						<span className="tr-text-metadata text-text-muted">
							A busca semântica (code_search) pesquisa simultaneamente em: {activeSlugs.join(", ")}
						</span>
					</div>
				</div>
			</div>

			{/* Barra de Busca */}
			<div className="relative">
				<RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2 size-14 text-text-muted" />
				<input
					type="text"
					placeholder="Buscar projetos por nome, slug ou diretório..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="w-full rounded-md border border-border-default bg-container-workspace-bg pl-12 pr-4 py-2 tr-text-ui text-text-default placeholder:text-text-muted focus:outline-none focus:border-primary"
				/>
			</div>

			{/* Lista de Projetos */}
			<div className="space-y-4">
				{filteredProjects.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-md border border-border-default bg-container-elevated-bg p-8 text-center">
						<RiFolder2Line className="size-24 text-text-muted mb-2" />
						<p className="tr-text-emphasis text-text-default">Nenhum projeto encontrado</p>
						<p className="tr-text-metadata text-text-muted mt-2">
							{searchQuery
								? "Nenhum resultado corresponde aos termos da pesquisa."
								: "Nenhum projeto cadastrado em ~/.hermes/projects."}
						</p>
					</div>
				) : (
					filteredProjects.map((project) => {
						const isActive = activeSlugs.includes(project.slug);
						const isIndexing =
							hermesManagement.indexingProgress.isIndexing &&
							hermesManagement.indexingProgress.projectSlug === project.slug;

						return (
							<div
								key={project.slug}
								className={cn(
									"rounded-md border p-12 transition-all bg-container-elevated-bg space-y-8 min-w-0 max-w-full overflow-hidden",
									isActive
										? "border-primary ring-1 ring-primary"
										: "border-border-default hover:border-border-muted",
								)}
							>
								{/* Cabeçalho do Card */}
								<div className="flex flex-wrap items-start justify-between gap-8 min-w-0">
									<div className="space-y-4 min-w-0 flex-1">
										<div className="flex items-center gap-6 flex-wrap min-w-0">
											<span className="tr-text-emphasis text-text-default truncate">
												{project.name}
											</span>
											<span className="rounded px-2 py-0 tr-text-metadata border border-border-default bg-container-workspace-bg text-text-muted">
												{project.slug}
											</span>
											{isActive && (
												<span className="rounded px-2 py-0 tr-text-metadata bg-primary text-text-default">
													✓ Ativo no RAG
												</span>
											)}
										</div>
									</div>

									{/* Badges de Status do DB e Sessão */}
									<div className="flex flex-wrap items-center gap-4 shrink-0">
										{project.hasDb ? (
											<span className="flex items-center gap-2 rounded px-2 py-0 tr-text-metadata border border-feedback-success text-feedback-success bg-container-workspace-bg">
												<RiDatabase2Line className="size-12" />
												{project.dbSizeFormatted ?? "DB ok"}
											</span>
										) : (
											<span className="flex items-center gap-2 rounded px-2 py-0 tr-text-metadata border border-feedback-warning text-feedback-warning bg-container-workspace-bg">
												<RiAlertLine className="size-12" />
												Sem DB
											</span>
										)}
										{project.hasActiveSession && (
											<span className="flex items-center gap-2 rounded px-2 py-0 tr-text-metadata border border-primary text-primary bg-container-workspace-bg">
												<RiCheckLine className="size-12" />
												Sessão Ativa
											</span>
										)}
									</div>
								</div>

								{/* Caminho do Workspace com Botão Copiar */}
								<div className="flex flex-wrap items-center justify-between rounded bg-container-workspace-bg px-8 py-4 border border-border-default gap-6 min-w-0">
									<div className="flex items-center gap-6 min-w-0 flex-1">
										<RiFolder2Line className="size-14 text-text-muted shrink-0" />
										<span className="tr-code-text text-text-muted truncate min-w-0">{project.path}</span>
									</div>
									<Button
										size="s"
										variant="ghost"
										className="shrink-0"
										onClick={() => handleCopyPath(project.path, project.slug)}
										tooltip="Copiar caminho do projeto"
									>
										{copiedSlug === project.slug ? (
											<RiCheckLine className="size-12 text-feedback-success" />
										) : (
											<RiFileCopyLine className="size-12" />
										)}
									</Button>
								</div>

								{/* Ações do Card */}
								<div className="flex flex-wrap items-center justify-between gap-8 pt-8 border-t border-border-default min-w-0">
									<div className="flex flex-wrap items-center gap-6 min-w-0">
										<Button
											size="s"
											variant={isActive ? "primary" : "outline"}
											onClick={() => void handleToggleProjectActive(project.slug)}
											tooltip={isActive ? "Clique para desativar este projeto do RAG" : "Ativar este projeto no RAG multi-projeto"}
											className="shrink-0"
										>
											<RiCheckLine className={cn("size-12 mr-4", !isActive && "opacity-40")} />
											{isActive ? "Ativo no RAG" : "Ativar no RAG"}
										</Button>
										<Button
											size="s"
											variant="ghost"
											onClick={() => {
												setInfoProject(project);
												setInfoModalOpen(true);
											}}
											tooltip="Ver arquivos e diagnóstico do projeto"
											className="shrink-0"
										>
											<RiInformationLine className="size-12" />
											Detalhes
										</Button>
									</div>

									<div className="flex flex-wrap items-center gap-6 shrink-0">
										<Button
											size="s"
											variant="outline"
											onClick={() => void handleStartReindex(project)}
											disabled={hermesManagement.indexingProgress.isIndexing}
											className="shrink-0"
										>
											{isIndexing ? (
												<RiRefreshLine className="size-12 animate-spin" />
											) : (
												<RiPlayCircleLine className="size-12" />
											)}
											{isIndexing ? "Indexando..." : "Reindexar"}
										</Button>
										<Button
											size="s"
											variant="ghost"
											className="text-feedback-error hover:text-feedback-error shrink-0"
											onClick={() => {
												setProjectToDelete(project);
												setConfirmSlugInput("");
												setDeleteModalOpen(true);
											}}
											tooltip="Excluir projeto do Hermes"
										>
											<RiDeleteBin6Line className="size-12" />
										</Button>
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>

			{/* Dialog de Criação de Projeto */}
			<Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Registrar Novo Projeto Hermes</DialogTitle>
						<DialogDescription>
							Cadastre uma nova base de código no gerenciador do Hermes para indexação semântica
							RAG.
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={(e) => void handleCreateProject(e)} className="space-y-4 py-2">
						<div className="space-y-2">
							<label htmlFor="hermes-project-name" className="tr-text-metadata text-text-default">
								Nome de Exibição
							</label>
							<input
								id="hermes-project-name"
								type="text"
								placeholder="Ex: BrProject 2026"
								value={newProjectName}
								onChange={(e) => {
									setNewProjectName(e.target.value);
									if (!newProjectSlug) {
										setNewProjectSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "-"));
									}
								}}
								className="w-full rounded border border-border-default bg-container-workspace-bg px-4 py-2 tr-text-ui text-text-default focus:outline-none focus:border-primary"
							/>
						</div>
						<div className="space-y-2">
							<label htmlFor="hermes-project-slug" className="tr-text-metadata text-text-default">
								Slug / Identificador (Pasta em ~/.hermes/projects)
							</label>
							<input
								id="hermes-project-slug"
								type="text"
								placeholder="Ex: brproject-2026"
								value={newProjectSlug}
								onChange={(e) => setNewProjectSlug(e.target.value)}
								className="w-full rounded border border-border-default bg-container-workspace-bg px-4 py-2 tr-code-text text-text-default focus:outline-none focus:border-primary"
							/>
						</div>
						<div className="space-y-2">
							<label htmlFor="hermes-project-path" className="tr-text-metadata text-text-default">
								Caminho Absoluto do Workspace / Código-Fonte
							</label>
							<input
								id="hermes-project-path"
								type="text"
								placeholder="Ex: D:\Brproject3.0\BrProject-2026"
								value={newProjectPath}
								onChange={(e) => setNewProjectPath(e.target.value)}
								className="w-full rounded border border-border-default bg-container-workspace-bg px-4 py-2 tr-code-text text-text-default focus:outline-none focus:border-primary"
							/>
						</div>
						<DialogFooter className="gap-2 pt-2">
							<Button type="button" variant="ghost" onClick={() => setCreateModalOpen(false)}>
								Cancelar
							</Button>
							<Button type="submit" variant="primary" disabled={creating}>
								{creating ? "Criando..." : "Registrar Projeto"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Dialog de Exclusão Segura de Projeto */}
			<Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<div className="flex items-center gap-2 text-feedback-error">
							<RiAlertLine className="size-24" />
							<DialogTitle>Confirmar Exclusão de Projeto Hermes</DialogTitle>
						</div>
						<DialogDescription>
							Esta ação removerá o diretório do projeto em ~/.hermes/projects, incluindo o banco
							SQLite hermes.db e os índices de busca semântica.
						</DialogDescription>
					</DialogHeader>
					{projectToDelete && (
						<div className="space-y-4 py-2">
							<div className="rounded bg-container-workspace-bg p-4 border border-border-default text-text-muted tr-text-metadata space-y-2">
								<p>
									Projeto:&nbsp;
									<strong className="text-text-default">{projectToDelete.name}</strong>
								</p>
								<p>
									Slug:&nbsp;
									<code className="tr-code-text text-text-default">{projectToDelete.slug}</code>
								</p>
							</div>
							<div className="space-y-2">
								<label htmlFor="hermes-confirm-slug" className="tr-text-metadata text-text-default">
									Para confirmar, digite exatamente:&nbsp;
									<code className="tr-code-text text-feedback-error">{projectToDelete.slug}</code>
								</label>
								<input
									id="hermes-confirm-slug"
									type="text"
									placeholder="Digite o slug do projeto"
									value={confirmSlugInput}
									onChange={(e) => setConfirmSlugInput(e.target.value)}
									className="w-full rounded border border-feedback-error bg-container-workspace-bg px-4 py-2 tr-code-text text-text-default focus:outline-none"
								/>
							</div>
						</div>
					)}
					<DialogFooter className="gap-2">
						<Button type="button" variant="ghost" onClick={() => setDeleteModalOpen(false)}>
							Cancelar
						</Button>
						<Button
							type="button"
							variant="primary"
							className="bg-feedback-error text-text-on-primary hover:bg-feedback-error"
							disabled={
								deleting || !projectToDelete || confirmSlugInput.trim() !== projectToDelete.slug
							}
							onClick={() => void handleDeleteProject()}
						>
							{deleting ? "Removendo..." : "Excluir Definitivamente"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Dialog de Informações / Diagnóstico do Projeto (hermes-tools :info_projeto) */}
			<Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<div className="flex items-center gap-2">
							<RiInformationLine className="size-20 text-primary" />
							<DialogTitle>Diagnóstico do Projeto Hermes</DialogTitle>
						</div>
						<DialogDescription>
							Informações detalhadas sobre a estrutura de arquivos e índices em ~/.hermes/projects.
						</DialogDescription>
					</DialogHeader>
					{infoProject && (
						<div className="space-y-4 py-2">
							<div className="space-y-2 rounded border border-border-default bg-container-workspace-bg p-4 tr-text-metadata">
								<div>
									<span className="text-text-muted">Slug: </span>
									<span className="tr-code-text text-text-default">{infoProject.slug}</span>
								</div>
								<div>
									<span className="text-text-muted">Diretório Hermes: </span>
									<span className="tr-code-text text-text-default break-all">
										{infoProject.projectDir}
									</span>
								</div>
								<div>
									<span className="text-text-muted">Workspace Root: </span>
									<span className="tr-code-text text-text-default break-all">
										{infoProject.path}
									</span>
								</div>
								<div>
									<span className="text-text-muted">Banco SQLite hermes.db: </span>
									{infoProject.hasDb ? (
										<span className="text-feedback-success tr-text-emphasis">
											Presente ({infoProject.dbSizeFormatted})
										</span>
									) : (
										<span className="text-feedback-warning tr-text-emphasis">Não encontrado</span>
									)}
								</div>
								<div>
									<span className="text-text-muted">Sessão Ativa: </span>
									<span
										className={
											infoProject.hasActiveSession
												? "text-primary tr-text-emphasis"
												: "text-text-muted"
										}
									>
										{infoProject.hasActiveSession ? "Presente (session_working.json)" : "Ausente"}
									</span>
								</div>
								<div>
									<span className="text-text-muted">VectorStore Legado: </span>
									<span
										className={
											infoProject.hasVectorsJson
												? "text-primary tr-text-emphasis"
												: "text-text-muted"
										}
									>
										{infoProject.hasVectorsJson ? "Presente (vectors.json)" : "Ausente"}
									</span>
								</div>
							</div>

							<div>
								<h4 className="tr-text-emphasis text-text-default mb-2">
									Arquivos no Projeto ({infoProject.files.length})
								</h4>
								<div className="rounded border border-border-default bg-container-workspace-bg p-2 max-h-36 overflow-y-auto tr-code-text space-y-2">
									{infoProject.files.map((file) => (
										<div key={file} className="text-text-muted flex items-center gap-2">
											<RiFolder2Line className="size-12 shrink-0" />
											<span className="truncate">{file}</span>
										</div>
									))}
								</div>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setInfoModalOpen(false)}>
							Fechar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
