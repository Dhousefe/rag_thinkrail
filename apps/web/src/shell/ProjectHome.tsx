import { useT } from "@thinkrail/locales/react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@thinkrail/ui/resizable";
import { useState } from "react";
import { QuietScrollArea } from "../components/QuietScrollArea";
import { HermesMcpPanel } from "../panels/HermesMcpPanel";
import { ProjectTree } from "../panels/ProjectTree";
import { WelcomePanel } from "../panels/WelcomePanel";
import { selectOnboardingActive, useAppStore } from "../store";
import {
	AuxiliaryPaneHeader,
	AuxiliaryPaneHideButton,
	AuxiliaryRail,
	AuxiliaryRailToolButton,
	type AuxiliaryRailToolEntry,
	DEFAULT_LAYOUT_PRESET_ID,
	resolveLayoutPreset,
} from "./layout";
import type { CollapsibleRegion } from "./useCollapsibleRegion";

export const PROJECT_HOME_PROJECTS_REGION_ID = "welcome-left";
const PROJECT_HOME_AUTOSAVE_ID = "thinkrail-shell-welcome";
const PROJECTS_PANE_ID = "project-home-projects";
const PROJECTS_RAIL_ENTRY_KEY = "projects";
const HERMES_RAIL_ENTRY_KEY = "hermes-mcp";
const PROJECTS_PANE_DEFAULT_PERCENT =
	resolveLayoutPreset(DEFAULT_LAYOUT_PRESET_ID, []).left.width * 100;
const PROJECTS_PANE_MIN_PERCENT = 12;
const WELCOME_MIN_PERCENT = 40;

export function ProjectHome({ projects }: { projects: CollapsibleRegion<HTMLDivElement> }) {
	const {
		collapsed,
		contentRef,
		onCollapse,
		onDragging,
		onExpand,
		panelRef,
		railRef,
		regionRef,
		toggle,
	} = projects;
	const t = useT();
	const onboarding = useAppStore(selectOnboardingActive);
	const [activeTool, setActiveTool] = useState<"projects" | "hermes-mcp">("projects");

	const projectsEntry: AuxiliaryRailToolEntry = {
		key: PROJECTS_RAIL_ENTRY_KEY,
		region: "left",
		kind: "tool",
		groupId: null,
		tool: "projects",
		tab: null,
		selected: activeTool === "projects",
		expanded: !collapsed && activeTool === "projects",
	};

	const hermesEntry: AuxiliaryRailToolEntry = {
		key: HERMES_RAIL_ENTRY_KEY,
		region: "left",
		kind: "tool",
		groupId: null,
		tool: "hermes-mcp",
		tab: null,
		selected: activeTool === "hermes-mcp",
		expanded: !collapsed && activeTool === "hermes-mcp",
	};

	const handleToolActivate = (tool: "projects" | "hermes-mcp") => {
		if (collapsed) {
			setActiveTool(tool);
			toggle();
		} else if (activeTool === tool) {
			toggle();
		} else {
			setActiveTool(tool);
		}
	};

	return (
		<div
			data-testid="welcome-shell-layout"
			data-left-collapsed={collapsed}
			data-onboarding={onboarding || undefined}
			className="flex h-full min-h-0 min-w-0"
		>
			{onboarding ? null : (
				<AuxiliaryRail
					region="left"
					entries={[projectsEntry, hermesEntry]}
					renderEntry={(entry, control) => (
						<AuxiliaryRailToolButton
							ref={entry.key === PROJECTS_RAIL_ENTRY_KEY ? railRef : undefined}
							entry={entry as AuxiliaryRailToolEntry}
							controls={PROJECTS_PANE_ID}
							control={control}
							onActivate={() =>
								handleToolActivate(
									(entry as AuxiliaryRailToolEntry).tool as "projects" | "hermes-mcp",
								)
							}
						/>
					)}
				/>
			)}
			<ResizablePanelGroup
				direction="horizontal"
				autoSaveId={PROJECT_HOME_AUTOSAVE_ID}
				className="min-h-0 min-w-0 flex-1"
			>
				{onboarding ? null : (
					<>
						<ResizablePanel
							ref={panelRef}
							id="left"
							order={1}
							defaultSize={PROJECTS_PANE_DEFAULT_PERCENT}
							minSize={PROJECTS_PANE_MIN_PERCENT}
							collapsedSize={0}
							collapsible
							onCollapse={onCollapse}
							onExpand={onExpand}
						>
							<section
								ref={regionRef}
								id={PROJECTS_PANE_ID}
								aria-label={
									activeTool === "hermes-mcp"
										? t("workbench.tool.hermesMcp")
										: activeTool === "cindy"
										? t("workbench.tool.cindy")
										: t("shell.projectHome.projects")
								}
								aria-hidden={collapsed || undefined}
								inert={collapsed ? true : undefined}
								className="flex h-full min-h-0 flex-col bg-container-sidebar-bg"
							>
								<AuxiliaryPaneHeader
									title={
										activeTool === "hermes-mcp"
											? t("workbench.tool.hermesMcp")
											: activeTool === "cindy"
											? t("workbench.tool.cindy")
											: t("shell.projectHome.projects")
									}
									actions={
										<AuxiliaryPaneHideButton
											testId="side-group-fold"
											controls={PROJECTS_PANE_ID}
											onClick={toggle}
										/>
									}
								/>
								<div
									ref={contentRef}
									tabIndex={-1}
									className="flex min-h-0 flex-1 flex-col outline-none"
								>
									<QuietScrollArea
										data-testid="left-nav"
										className="min-h-0 flex-1"
										viewportClassName="p-panel-inset"
									>
										{activeTool === "hermes-mcp" ? (
											<HermesMcpPanel />
										) : activeTool === "cindy" ? (
											<CindyPanel />
										) : (
											<ProjectTree />
										)}
									</QuietScrollArea>
								</div>
							</section>
						</ResizablePanel>
						<ResizableHandle
							direction="horizontal"
							data-testid="resize-left"
							aria-hidden={collapsed}
							tabIndex={collapsed ? -1 : 0}
							onDragging={onDragging}
							{...(collapsed ? { className: "hidden" } : {})}
						/>
					</>
				)}
				<ResizablePanel
					id="welcome"
					order={2}
					defaultSize={100 - PROJECTS_PANE_DEFAULT_PERCENT}
					minSize={WELCOME_MIN_PERCENT}
				>
					<div className="h-full min-h-0 bg-container-content-bg">
						<WelcomePanel />
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	);
}
