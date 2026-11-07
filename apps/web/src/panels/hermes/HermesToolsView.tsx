import { RiCheckDoubleLine, RiCloseCircleLine, RiSearchLine, RiToolsLine } from "@remixicon/react";
import { Button } from "@thinkrail/ui/button";
import { Switch } from "@thinkrail/ui/switch";
import { cn } from "@thinkrail/ui/utils";
import { useMemo, useState } from "react";
import {
	DEFAULT_HERMES_TOOLS,
	type HermesToolCategory,
	type HermesToolDefinition,
	toast,
	useAppStore,
} from "@/store";
import { SegmentedControl } from "../SegmentedControl";

const CATEGORY_LABELS: Record<HermesToolCategory, string> = {
	rag: "RAG & Indexação",
	analysis: "Análise & AST",
	workflow: "Workflows & Tickets",
	delegation: "Delegação & Background",
	skills: "Skills & Ecossistema",
	diagnostic: "Diagnóstico",
};

export function HermesToolsView() {
	const hermesManagement = useAppStore((s) => s.hermesManagement);
	const toggleHermesTool = useAppStore((s) => s.toggleHermesTool);
	const setHermesAllTools = useAppStore((s) => s.setHermesAllTools);

	const [filterCategory, setFilterCategory] = useState<"all" | HermesToolCategory>("all");
	const [searchQuery, setSearchQuery] = useState("");

	const toolsWithState: HermesToolDefinition[] = useMemo(() => {
		return DEFAULT_HERMES_TOOLS.map((tool) => ({
			...tool,
			enabled: hermesManagement.toolToggles[tool.id] ?? true,
		}));
	}, [hermesManagement.toolToggles]);

	const filteredTools = useMemo(() => {
		return toolsWithState.filter((tool) => {
			if (filterCategory !== "all" && tool.category !== filterCategory) return false;
			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase().trim();
				return (
					tool.name.toLowerCase().includes(query) ||
					tool.id.toLowerCase().includes(query) ||
					tool.description.toLowerCase().includes(query)
				);
			}
			return true;
		});
	}, [toolsWithState, filterCategory, searchQuery]);

	const activeCount = useMemo(() => {
		return toolsWithState.filter((t) => t.enabled).length;
	}, [toolsWithState]);

	const handleToggle = (tool: HermesToolDefinition, checked: boolean) => {
		toggleHermesTool(tool.id, checked);
		if (checked) {
			toast.info(`Ferramenta "${tool.name}" ativada.`);
		} else {
			toast.info(`Ferramenta "${tool.name}" desativada.`);
		}
	};

	return (
		<div className="flex flex-col gap-16">
			{/* Cabeçalho de Ferramentas e Ações em Lote */}
			<div className="flex flex-wrap items-center justify-between gap-12 rounded-lg border border-border-default bg-control-bg p-16 shadow-xs">
				<div className="flex items-center gap-12">
					<div className="flex size-36 items-center justify-center rounded-md bg-primary-subtle text-primary">
						<RiToolsLine className="size-20" />
					</div>
					<div>
						<h3 className="tr-text-ui text-text-default">Catálogo de Ferramentas MCP Hermes</h3>
						<p className="tr-text-metadata text-text-muted">
							{activeCount} de {toolsWithState.length} ferramentas ativas no ambiente
						</p>
					</div>
				</div>

				<div className="flex items-center gap-8">
					<Button
						size="s"
						variant="outline"
						onClick={() => {
							setHermesAllTools(true);
							toast.success("Todas as ferramentas Hermes ativadas.");
						}}
						className="gap-4"
					>
						<RiCheckDoubleLine className="size-14 text-feedback-success" />
						Ativar Todas
					</Button>
					<Button
						size="s"
						variant="outline"
						onClick={() => {
							setHermesAllTools(false);
							toast.info("Todas as ferramentas Hermes desativadas.");
						}}
						className="gap-4"
					>
						<RiCloseCircleLine className="size-14 text-feedback-error" />
						Desativar Todas
					</Button>
				</div>
			</div>

			{/* Barra de Filtro e Busca com SegmentedControl */}
			<div className="flex flex-wrap items-center justify-between gap-12">
				<div className="relative flex-1 min-w-[200px]">
					<RiSearchLine className="absolute left-10 top-1/2 -translate-y-1/2 size-14 text-text-muted" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Buscar ferramenta por nome, ID ou funcionalidade..."
						className="w-full h-32 rounded-sm border border-border-default bg-control-bg pl-24 pr-12 tr-text-metadata text-text-default outline-none focus:border-control-border-active"
					/>
				</div>

				<div className="shrink-0 overflow-x-auto">
					<SegmentedControl
						name="hermes-tool-category-filter"
						label="Filtrar ferramentas por categoria"
						options={[
							{ id: "all", label: `Todas (${toolsWithState.length})` },
							{ id: "rag", label: "RAG" },
							{ id: "analysis", label: "Análise AST" },
							{ id: "workflow", label: "Workflows" },
							{ id: "delegation", label: "Delegação" },
							{ id: "skills", label: "Skills" },
							{ id: "diagnostic", label: "Diagnóstico" },
						]}
						value={filterCategory}
						onSelect={setFilterCategory}
					/>
				</div>
			</div>

			{/* Lista de Ferramentas com Lechs */}
			<div className="flex flex-col gap-8">
				{filteredTools.map((tool) => (
					<div
						key={tool.id}
						className={cn(
							"flex items-start justify-between gap-16 rounded-lg border p-12 transition-all shadow-2xs",
							tool.enabled
								? "border-border-default bg-control-bg hover:border-border-muted"
								: "border-border-default bg-control-bg opacity-60",
						)}
					>
						<div className="flex flex-col gap-6 min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-6">
								<span className="tr-text-emphasis text-text-default">{tool.name}</span>
								<span className="rounded-md border border-border-default bg-container-workspace-bg px-6 py-2 tr-code-text text-text-muted">
									{tool.id}
								</span>
								<span className="rounded-md border border-primary bg-primary-subtle px-6 py-2 tr-text-metadata text-primary capitalize">
									{CATEGORY_LABELS[tool.category]}
								</span>
								{tool.readOnly ? (
									<span className="rounded-md border border-border-default bg-container-workspace-bg px-6 py-2 tr-text-metadata text-text-muted">
										Somente Leitura
									</span>
								) : (
									<span className="rounded-md border border-feedback-warning bg-feedback-warning-subtle px-6 py-2 tr-text-metadata text-feedback-warning">
										Modifica Estado
									</span>
								)}
							</div>
							<p className="tr-text-metadata text-text-muted leading-relaxed">{tool.description}</p>
						</div>

						{/* Lech / Switch de Ativação Individual */}
						<div className="flex flex-col items-end gap-4 shrink-0 pt-2">
							<Switch
								label={`Ativar ${tool.name}`}
								checked={tool.enabled}
								onCheckedChange={(checked) => handleToggle(tool, checked)}
								testId={`switch-tool-${tool.id}`}
							/>
							<span className={cn(
								"tr-text-metadata",
								tool.enabled ? "text-feedback-success" : "text-text-muted"
							)}>
								{tool.enabled ? "Ativa" : "Desativada"}
							</span>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
