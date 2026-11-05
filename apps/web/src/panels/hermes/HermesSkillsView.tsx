import {
	RiCheckLine,
	RiCompass3Line,
	RiDeleteBinLine,
	RiDownload2Line,
	RiExternalLinkLine,
	RiFileTextLine,
	RiFolderCheckLine,
	RiFolderLine,
	RiRefreshLine,
	RiSearchLine,
	RiStarLine,
} from "@remixicon/react";
import type {
	HermesFindSkillsResult,
	HermesInstalledSkill,
	HermesSkillRepoResult,
} from "@thinkrail/contracts";
import { Button } from "@thinkrail/ui/button";
import { Switch } from "@thinkrail/ui/switch";
import { cn } from "@thinkrail/ui/utils";
import { useEffect, useState } from "react";
import { selectActiveWorkspace, toast, useAppStore } from "@/store";
import { getTransport } from "@/transport";
import { openFileInTab } from "../openTabs";
import { SegmentedControl } from "../SegmentedControl";

export function HermesSkillsView() {
	const activeWorkspace = useAppStore(selectActiveWorkspace);
	const workspaceId = activeWorkspace?.id ?? null;
	const [subTab, setSubTab] = useState<"find" | "installed">("find");
	const [searchQuery, setSearchQuery] = useState("");
	const [minStars, setMinStars] = useState<number>(50);
	const [isSearching, setIsSearching] = useState(false);
	const [searchResults, setSearchResults] = useState<HermesSkillRepoResult[]>([]);
	const [installedSkills, setInstalledSkills] = useState<HermesInstalledSkill[]>([]);
	const [isLoadingInstalled, setIsLoadingInstalled] = useState(false);
	const [installingRepo, setInstallingRepo] = useState<string | null>(null);
	const [actioningSkill, setActioningSkill] = useState<string | null>(null);

	const loadInstalledSkills = async (quiet = false) => {
		try {
			setIsLoadingInstalled(true);
			const res = await getTransport().request("hermes.manageSkills", {
				action: "list",
			});
			if (res.success) {
				setInstalledSkills(res.skills || []);
			} else if (!quiet) {
				toast.error(res.message || "Falha ao carregar skills instaladas");
			}
		} catch (err) {
			if (!quiet) {
				toast.error(`Erro ao listar skills: ${err instanceof Error ? err.message : String(err)}`);
			}
		} finally {
			setIsLoadingInstalled(false);
		}
	};

	useEffect(() => {
		void loadInstalledSkills(true);
	}, []);

	const handleSearch = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!searchQuery.trim()) {
			toast.info("Digite um termo para buscar skills.");
			return;
		}

		try {
			setIsSearching(true);
			const res: HermesFindSkillsResult = await getTransport().request("hermes.findSkills", {
				query: searchQuery.trim(),
				limit: 12,
				minStars,
			});
			setSearchResults(res.results || []);
			if (!res.results || res.results.length === 0) {
				toast.info("Nenhuma skill encontrada para este termo.");
			}
		} catch (err) {
			toast.error(`Erro na busca de skills: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setIsSearching(false);
		}
	};

	const handleInstall = async (repoUrl: string, skillName?: string) => {
		try {
			setInstallingRepo(repoUrl);
			const res = await getTransport().request("hermes.installSkill", {
				repoUrl,
				skillName,
			});
			if (res.success) {
				toast.success(res.message || `Skill instalada com sucesso!`);
				void loadInstalledSkills(true);
			} else {
				toast.error(res.message || "Falha na instalação da skill.");
			}
		} catch (err) {
			toast.error(`Erro ao instalar: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setInstallingRepo(null);
		}
	};

	const handleToggleActive = async (skill: HermesInstalledSkill, active: boolean) => {
		try {
			setActioningSkill(skill.name);
			const res = await getTransport().request("hermes.manageSkills", {
				action: active ? "enable" : "disable",
				skillName: skill.name,
			});
			if (res.success) {
				toast.success(res.message);
				setInstalledSkills((prev) =>
					prev.map((s) => (s.name === skill.name ? { ...s, active } : s)),
				);
			} else {
				toast.error(res.message);
			}
		} catch (err) {
			toast.error(`Erro ao atualizar skill: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setActioningSkill(null);
		}
	};

	const handleRemoveSkill = async (skill: HermesInstalledSkill) => {
		if (!confirm(`Deseja realmente remover a skill "${skill.name}"?`)) return;
		try {
			setActioningSkill(skill.name);
			const res = await getTransport().request("hermes.manageSkills", {
				action: "remove",
				skillName: skill.name,
			});
			if (res.success) {
				toast.success(res.message);
				setInstalledSkills((prev) => prev.filter((s) => s.name !== skill.name));
			} else {
				toast.error(res.message);
			}
		} catch (err) {
			toast.error(`Erro ao remover skill: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			setActioningSkill(null);
		}
	};

	return (
		<div className="flex flex-col gap-16">
			{/* Cabeçalho da Visão de Skills */}
			<div className="flex flex-wrap items-center justify-between gap-12 rounded-lg border border-border-default bg-control-bg p-16 shadow-xs">
				<div className="flex items-center gap-12">
					<div className="flex size-36 items-center justify-center rounded-md bg-primary-subtle text-primary">
						<RiCompass3Line className="size-20" />
					</div>
					<div>
						<h3 className="tr-text-ui text-text-default">Hub de Skills & Extensões Hermes</h3>
						<p className="tr-text-metadata text-text-muted">
							Descubra skills abertas no GitHub/skills.sh ou gerencie suas skills locais (~/.agents/skills/)
						</p>
					</div>
				</div>

				<div className="flex items-center gap-8">
					<SegmentedControl
						name="hermes-skills-subtab"
						label="Subaba de Skills"
						options={[
							{ id: "find", label: "Explorar (Find Skills)" },
							{ id: "installed", label: `Instaladas (${installedSkills.length})` },
						]}
						value={subTab}
						onSelect={(val) => setSubTab(val as "find" | "installed")}
					/>
					<Button
						size="s"
						onClick={() => loadInstalledSkills()}
						loading={isLoadingInstalled}
						tooltip="Recarregar status local"
					>
						<RiRefreshLine className="size-14" />
					</Button>
				</div>
			</div>

			{/* CONTEÚDO: BUSCA (FIND SKILLS) */}
			{subTab === "find" && (
				<div className="flex flex-col gap-16">
					{/* Barra de Busca e Filtro */}
					<form
						onSubmit={handleSearch}
						className="flex flex-wrap items-center gap-12 rounded-lg border border-border-default bg-container-workspace-bg p-12 shadow-xs"
					>
						<div className="relative flex-1 min-w-[240px]">
							<RiSearchLine className="pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 size-16 text-text-muted" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Buscar por tópico ou stack (ex: git workflow, prisma, react testing, devops)..."
								className="w-full rounded-md border border-border-default bg-control-bg pl-24 pr-12 py-6 tr-text-ui text-text-default placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>

						<div className="flex items-center gap-8 shrink-0">
							<span className="tr-text-metadata text-text-muted">Estrelas mínimas:</span>
							<select
								value={minStars}
								onChange={(e) => setMinStars(Number(e.target.value))}
								className="rounded-md border border-border-default bg-control-bg px-8 py-6 tr-text-ui text-text-default focus:border-primary focus:outline-none"
							>
								<option value={10}>10+ ★</option>
								<option value={50}>50+ ★ (Padrão)</option>
								<option value={200}>200+ ★</option>
								<option value={500}>500+ ★</option>
							</select>

							<Button
								type="submit"
								variant="primary"
								loading={isSearching}
								disabled={!searchQuery.trim()}
							>
								<RiSearchLine className="size-16" />
								<span>Buscar Skills</span>
							</Button>
						</div>
					</form>

					{/* Resultados de Busca */}
					{searchResults.length > 0 ? (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-12">
							{searchResults.map((item) => {
								const alreadyInstalled = installedSkills.some(
									(s) => s.name === item.fullName.split("/").pop() || s.path.includes(item.fullName),
								);
								const isInstalling = installingRepo === item.url;

								return (
									<div
										key={item.url}
										className="flex flex-col justify-between rounded-lg border border-border-default bg-container-workspace-bg p-12 hover:border-border-default transition-colors shadow-xs gap-12"
									>
										<div className="flex flex-col gap-6">
											<div className="flex items-center justify-between gap-8">
												<a
													href={item.url}
													target="_blank"
													rel="noreferrer"
													className="tr-text-emphasis text-text-default hover:text-primary flex items-center gap-4 truncate"
												>
													<span className="truncate">{item.fullName}</span>
													<RiExternalLinkLine className="size-12 shrink-0 opacity-60" />
												</a>

												<div className="flex items-center gap-6 shrink-0">
													<span className="flex items-center gap-2 rounded bg-feedback-info-subtle px-6 py-2 tr-text-metadata text-primary">
														<RiStarLine className="size-12" />
														{item.stars.toLocaleString()}
													</span>
												</div>
											</div>

											<p className="tr-text-metadata text-text-muted line-clamp-2 leading-relaxed">
												{item.description || "Sem descrição informada pelo repositório."}
											</p>

											{item.topics && item.topics.length > 0 && (
												<div className="flex flex-wrap gap-4 pt-4">
													{item.topics.slice(0, 4).map((t) => (
														<span
															key={t}
															className="rounded-full border border-border-default bg-control-bg px-6 py-2 tr-text-metadata text-text-muted"
														>
															{t}
														</span>
													))}
												</div>
											)}
										</div>

										<div className="flex items-center justify-between border-t border-border-default pt-8">
											<span className="tr-text-metadata text-text-muted truncate max-w-[200px]">
												Fonte: {item.source}
											</span>

											{alreadyInstalled ? (
												<span className="flex items-center gap-4 text-feedback-success tr-text-metadata">
													<RiCheckLine className="size-14" />
													Já instalada
												</span>
											) : (
												<Button
													size="s"
													loading={isInstalling}
													onClick={() => handleInstall(item.url)}
												>
													<RiDownload2Line className="size-14" />
													<span>Instalar Skill</span>
												</Button>
											)}
										</div>
									</div>
								);
							})}
						</div>
					) : (
						<div className="flex flex-col items-center justify-center p-24 rounded-lg border border-dashed border-border-default text-center gap-12 bg-control-bg">
							<RiCompass3Line className="size-36 text-text-muted" />
							<div className="flex flex-col gap-4 max-w-md">
								<span className="tr-text-emphasis text-text-default">
									Nenhuma busca realizada ainda
								</span>
								<span className="tr-text-metadata text-text-muted">
									Digite uma palavra-chave no campo acima para pesquisar Agent Skills abertas compatíveis com o ecossistema ThinkRail e Pi.
								</span>
							</div>
						</div>
					)}
				</div>
			)}

			{/* CONTEÚDO: SKILLS INSTALADAS LOCALMENTE */}
			{subTab === "installed" && (
				<div className="flex flex-col gap-12">
					{installedSkills.length === 0 ? (
						<div className="flex flex-col items-center justify-center p-24 rounded-lg border border-dashed border-border-default text-center gap-12 bg-control-bg">
							<RiFolderCheckLine className="size-36 text-text-muted" />
							<div className="flex flex-col gap-4 max-w-md">
								<span className="tr-text-emphasis text-text-default">
									Nenhuma skill instalada em ~/.agents/skills/
								</span>
								<span className="tr-text-metadata text-text-muted">
									Use a aba "Explorar" para descobrir e instalar skills com um único clique.
								</span>
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-8">
							{installedSkills.map((skill) => {
								const isProcessing = actioningSkill === skill.name;
								return (
									<div
										key={skill.name}
										className={cn(
											"flex items-start justify-between gap-16 rounded-md border p-12 transition-colors",
											skill.active
												? "border-border-default bg-control-bg hover:border-border-default"
												: "border-border-default bg-control-bg opacity-65",
										)}
									>
										<div className="flex flex-col gap-4 min-w-0 flex-1">
											<div className="flex items-center gap-8">
												<span className="tr-text-emphasis text-text-default">
													{skill.name}
												</span>
												{skill.folderName && (
													<span className="flex items-center gap-2 rounded bg-container-header-bg px-6 py-2 tr-text-metadata text-text-subtle border border-border-default">
														<RiFolderLine className="size-12 opacity-70" />
														<span>{skill.folderName}</span>
													</span>
												)}
												<span
													className={cn(
														"rounded-full px-6 py-2 tr-text-metadata",
														skill.active
															? "bg-feedback-success text-text-on-primary"
															: "bg-border-default text-text-muted",
													)}
												>
													{skill.active ? "ATIVA" : "DESATIVADA"}
												</span>
											</div>
											<p className="tr-text-metadata text-text-muted leading-relaxed">
												{skill.description || "Skill carregada em ~/.agents/skills/"}
											</p>
											<div className="flex items-center gap-12 pt-2">
												<span className="tr-text-metadata text-text-muted truncate max-w-sm">
													{skill.path}
												</span>
												{skill.skillMdPath && (
													<button
														type="button"
														onClick={() => {
															if (workspaceId && skill.skillMdPath) {
																void openFileInTab(workspaceId, skill.skillMdPath, "keep");
															} else {
																toast.info(`Caminho: ${skill.skillMdPath}`);
															}
														}}
														className="inline-flex items-center gap-4 tr-text-metadata text-primary hover:underline transition-all cursor-pointer"
														title="Abrir arquivo SKILL.md no editor"
													>
														<RiFileTextLine className="size-13 shrink-0" />
														<span>Ver SKILL.md</span>
													</button>
												)}
											</div>
										</div>

										<div className="flex items-center gap-12 shrink-0 pt-4">
											<Switch
												label={`Ativar ou desativar skill ${skill.name}`}
												checked={skill.active}
												disabled={isProcessing}
												onCheckedChange={(checked) =>
													handleToggleActive(skill, checked)
												}
											/>
											<Button
												size="s"
												disabled={isProcessing}
												onClick={() => handleRemoveSkill(skill)}
												tooltip="Remover skill"
											>
												<RiDeleteBinLine className="size-14" />
											</Button>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
