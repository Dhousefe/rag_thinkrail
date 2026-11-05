import type { HermesVectorNode } from "@thinkrail/contracts";
import {
	RiAddLine,
	RiArrowDownLine,
	RiArrowDownSLine,
	RiArrowLeftLine,
	RiArrowRightLine,
	RiArrowUpLine,
	RiArrowUpSLine,
	RiChatQuoteLine,
	RiCloseLine,
	RiCpuLine,
	RiEyeLine,
	RiEyeOffLine,
	RiFileCodeLine,
	RiFileCopyLine,
	RiFocus3Line,
	RiNodeTree,
	RiPauseLine,
	RiPlayLine,
	RiRefreshLine,
	RiRobot2Line,
	RiSearchLine,
	RiSubtractLine,
} from "@remixicon/react";
import { Button } from "@thinkrail/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { selectWorkspaceById, selectWorkspaceChatTab, toast, useAppStore } from "@/store";
import { getTransport } from "@/transport";
import { openChatInTab, startChatInTab } from "./openChat";
import { openFileInTab } from "./openTabs";
import { OrbitCameraController } from "./neural-core/cameraController";
import { NeuralCoreEngine } from "./neural-core/neuralEngine";
import { useNeuralCoreState } from "./neural-core/useNeuralCoreState";

function getModuleClasses(moduleName?: string): { border: string; text: string; dot: string } {
	switch (moduleName) {
		case "apps/web":
			return { border: "border-feedback-info", text: "text-feedback-info", dot: "bg-feedback-info" };
		case "packages/server":
			return { border: "border-primary", text: "text-primary", dot: "bg-primary" };
		case "contracts":
			return { border: "border-feedback-warning", text: "text-feedback-warning", dot: "bg-feedback-warning" };
		case "packages/ui":
			return { border: "border-feedback-success", text: "text-feedback-success", dot: "bg-feedback-success" };
		case "scripts":
			return { border: "border-feedback-error", text: "text-feedback-error", dot: "bg-feedback-error" };
		default:
			return { border: "border-border-default", text: "text-text-muted", dot: "bg-text-muted" };
	}
}

export function NeuralCorePanel() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const engineRef = useRef<NeuralCoreEngine | null>(null);
	const cameraRef = useRef<OrbitCameraController | null>(null);

	const { state, pulseKey } = useNeuralCoreState();
	const [manualQuery, setManualQuery] = useState("");
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [isPaused, setIsPaused] = useState(false);
	const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(false);
	const [isBottomPanelCompletelyHidden, setIsBottomPanelCompletelyHidden] = useState(false);

	// Estado da Projeção de Vetores RAG
	const [vectorNodes, setVectorNodes] = useState<HermesVectorNode[]>([]);
	const [vectorEdges, setVectorEdges] = useState<any[]>([]);
	const [totalChunks, setTotalChunks] = useState(0);
	const [inspectedNode, setInspectedNode] = useState<HermesVectorNode | null>(null);
	const [selectedNode, setSelectedNode] = useState<HermesVectorNode | null>(null);
	const [projectedLabels, setProjectedLabels] = useState<any[]>([]);
	const [selectedModules, setSelectedModules] = useState<string[]>([]);

	// Sincronização e Reatividade com Projetos Ativos do Hermes RAG
	const activeProjectSlugs = useAppStore(
		(s) => s.hermesManagement.activeProjectSlugs,
	);
	const activeProjectSlug = useAppStore(
		(s) => s.hermesManagement.activeProjectSlug,
	);

	// Carregamento dos vetores do banco SQLite hermes.db
	const loadVectorGraph = useCallback(async () => {
		try {
			const res = await getTransport().request("hermes.getVectorGraph", {
				limit: 140,
			});
			if (res && Array.isArray(res.nodes)) {
				setVectorNodes(res.nodes);
				setVectorEdges(res.edges || []);
				setTotalChunks(res.totalChunks);
				if (engineRef.current) {
					engineRef.current.setVectorGraphData(res.nodes, res.edges || []);
				}
			}
		} catch (err) {
			console.warn("[NeuralCorePanel] Erro ao carregar grafo vetorial:", err);
		}
	}, []);

	// Recarrega automaticamente a representação gráfica quando projetos RAG do Hermes forem ativados/desativados
	useEffect(() => {
		void loadVectorGraph();
	}, [activeProjectSlugs, activeProjectSlug, loadVectorGraph]);

	// Inicialização do Motor WebGPU Geométrico
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const engine = new NeuralCoreEngine(canvas);
		engineRef.current = engine;

		const camera = new OrbitCameraController(canvas, () => {
			engine.cameraOrbit.theta = camera.theta;
			engine.cameraOrbit.phi = camera.phi;
			engine.cameraOrbit.distance = camera.distance;
			engine.cameraOrbit.target = [camera.target[0], camera.target[1], camera.target[2]];
		});
		cameraRef.current = camera;

		// Sincroniza callback de pausa dinâmica
		engine.onPauseChange = (paused) => {
			setIsPaused(paused);
		};

		// Vincula o loop a 60 FPS com o tween suave da câmera (fly-to) e sincronização de labels
		let labelTicker = 0;
		engine.onBeforeRenderFrame = () => {
			camera.updateTween();
			engine.cameraOrbit.theta = camera.theta;
			engine.cameraOrbit.phi = camera.phi;
			engine.cameraOrbit.distance = camera.distance;
			engine.cameraOrbit.target = [camera.target[0], camera.target[1], camera.target[2]];

			labelTicker++;
			if (labelTicker % 3 === 0) {
				setProjectedLabels(engine.getProjectedNodeLabels(10));
			}
		};

		engine.init().then(() => {
			engine.start();
			void loadVectorGraph();
		});

		const handleResize = () => {
			const rect = canvas.getBoundingClientRect();
			const dpr = window.devicePixelRatio || 1;
			canvas.width = Math.max(100, Math.floor(rect.width * dpr));
			canvas.height = Math.max(100, Math.floor(rect.height * dpr));
		};

		handleResize();
		const ro = new ResizeObserver(handleResize);
		ro.observe(canvas);

		return () => {
			ro.disconnect();
			engine.stop();
		};
	}, [loadVectorGraph]);

	// Reage a mudanças de telemetria do ThinkRail
	useEffect(() => {
		if (engineRef.current) {
			engineRef.current.setActivity(state.activity, state.intensity);
		}
	}, [state.activity, state.intensity]);

	// Atualiza busca RAG do Hermes MCP no motor (dispara movimento dinâmico e feixes Graphify)
	const effectiveQuery = useMemo(() => {
		return manualQuery.trim() || state.activeRagQuery?.trim() || null;
	}, [manualQuery, state.activeRagQuery]);

	useEffect(() => {
		if (engineRef.current) {
			engineRef.current.setRagSearch(effectiveQuery);
		}
	}, [effectiveQuery]);

	// Shockwave disparado por evento MCP / terminal
	useEffect(() => {
		if (pulseKey > 0 && engineRef.current) {
			engineRef.current.triggerShockwave();
		}
	}, [pulseKey]);

	const matchedNodesCount = useMemo(() => {
		if (!effectiveQuery) return 0;
		const q = effectiveQuery.toLowerCase();
		return vectorNodes.filter((n) => {
			const p = (n.path || "").toLowerCase();
			const qn = (n.qualifiedName || "").toLowerCase();
			const rel = (n.relPath || "").toLowerCase();
			return p.includes(q) || qn.includes(q) || rel.includes(q);
		}).length;
	}, [effectiveQuery, vectorNodes]);

	// Foco Automático do Provider / MCP: centraliza a câmera 3D no símbolo inspecionado e dá vida ao polígono
	useEffect(() => {
		if (!effectiveQuery || vectorNodes.length === 0) return;
		const q = effectiveQuery.toLowerCase();
		const matchedNode = vectorNodes.find((n) => {
			const p = (n.path || "").toLowerCase();
			const qn = (n.qualifiedName || "").toLowerCase();
			const rel = (n.relPath || "").toLowerCase();
			return p.includes(q) || qn.includes(q) || rel.includes(q);
		});
		if (matchedNode) {
			if (engineRef.current) {
				engineRef.current.triggerMcpSearchTarget(matchedNode.id);
			}
			setIsPaused(true);
			if (cameraRef.current) {
				cameraRef.current.focusPosition(matchedNode.position, 2.5);
			}
			setInspectedNode(matchedNode);
		}
	}, [effectiveQuery, vectorNodes]);

	// Ações Rápidas de Produtividade para o Provider e Desenvolvedor
	const handleOpenFile = async (node: HermesVectorNode) => {
		if (!node.path) return;
		const store = useAppStore.getState();
		const currentWsId = store.activeWorkspaceId;
		const currentWs = currentWsId ? selectWorkspaceById(store, currentWsId) : null;

		// 1. Normaliza caminhos
		const normNodePath = node.path.replace(/\\/g, "/");
		const normCurrentRoot = (currentWs?.worktreePath || "").replace(/\\/g, "/");

		// Se o arquivo estiver dentro do workspace ativo atualmente
		if (currentWs && normCurrentRoot && normNodePath.startsWith(normCurrentRoot)) {
			await openFileInTab(currentWs.id, node.path, "keep");
			toast.success("Arquivo aberto no editor", node.relPath);
			return;
		}

		// 2. Busca entre todos os workspaces abertos no ThinkRail se algum corresponde à raiz do arquivo
		let matchedWs: any = null;
		for (const wsList of Object.values(store.workspaces)) {
			for (const ws of wsList) {
				const wsRoot = (ws.worktreePath || "").replace(/\\/g, "/");
				if (wsRoot && normNodePath.startsWith(wsRoot)) {
					matchedWs = ws;
					break;
				}
			}
			if (matchedWs) break;
		}

		if (matchedWs) {
			store.activateWorkspaceFromRoute({ id: matchedWs.id, projectId: matchedWs.projectId });
			await openFileInTab(matchedWs.id, node.path, "keep");
			toast.success(`Chaveado para projeto [${node.projectSlug || matchedWs.projectId}]`, node.relPath);
			return;
		}

		// 3. Se o projeto RAG não estiver aberto em nenhum workspace atual, abre o projeto via project.open
		if (node.projectRoot) {
			try {
				const openRes = await getTransport().request("project.open", { path: node.projectRoot });
				if (openRes && (openRes as any).project) {
					const openedProject = (openRes as any).project;
					const updatedStore = useAppStore.getState();
					const projectWorkspaces = updatedStore.workspaces[openedProject.id] || [];
					const targetWs = projectWorkspaces[0];
					if (targetWs) {
						updatedStore.activateWorkspaceFromRoute({ id: targetWs.id, projectId: targetWs.projectId });
					await openFileInTab(targetWs.id, node.path, "keep");
						toast.success(`Projeto [${node.projectSlug}] aberto no ThinkRail`, node.relPath);
						return;
					}
				}
			} catch (openErr) {
				console.warn("[NeuralCorePanel] project.open falhou:", openErr);
			}
		}

		// 4. Fallback seguro
		if (currentWsId) {
			try {
				await openFileInTab(currentWsId, node.path, "keep");
				toast.success("Arquivo aberto no editor", node.relPath);
			} catch {
				void navigator.clipboard.writeText(node.path);
				toast.info(`Caminho copiado (${node.projectSlug || "externo"})`, node.path);
			}
		}
	};

	const handleInjectContext = (node: HermesVectorNode) => {
		const store = useAppStore.getState();
		const wsId = store.activeWorkspaceId;
		if (!wsId) return;
		const chatTab = selectWorkspaceChatTab(store, wsId);
		if (chatTab) {
			const methodsList = (node.methods || []).map((m: any) => `  - ${m.name}()`).join("\n");
			const snippet = `\n[Contexto Neural Core]: ${node.relPath}\nSímbolo: ${node.qualifiedName} (${node.language || "code"})\n${methodsList ? `Métodos AST:\n${methodsList}\n` : ""}\`\`\`\n${node.contentSnippet}\n\`\`\`\n`;
			const prev = store.sessions[chatTab.sessionId]?.draft || "";
			store.setChatDraft(chatTab.sessionId, prev + snippet);
			toast.success("Contexto AST Injetado no Chat", `${node.relPath} pronto no prompt`);
		} else {
			toast.info("Nenhuma conversa aberta", "Abra ou inicie um chat");
		}
	};

	const handleAskAgent = (node: HermesVectorNode) => {
		const store = useAppStore.getState();
		const wsId = store.activeWorkspaceId;
		if (!wsId) return;
		const chatTab = selectWorkspaceChatTab(store, wsId);
		const text = `Por favor, analise a arquitetura e os métodos de ${node.qualifiedName} (${node.relPath}).`;
		if (chatTab) {
			void openChatInTab(wsId, chatTab.sessionId);
			store.appendUserMessage(chatTab.sessionId, text);
			void getTransport().request("session.prompt", { sessionId: chatTab.sessionId, text });
			toast.success("Pergunta enviada ao Agente", node.qualifiedName);
		} else {
			void startChatInTab(wsId, { prompt: text });
			toast.success("Sessão criada com análise", node.qualifiedName);
		}
	};

	// Módulos disponíveis e contagens para a legenda Graphify
	const availableModules = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const n of vectorNodes) {
			const m = n.module || "core";
			counts[m] = (counts[m] || 0) + 1;
		}
		return Object.entries(counts).map(([name, count]) => ({
			name,
			count,
			classes: getModuleClasses(name),
		}));
	}, [vectorNodes]);

	// Aplica filtro de módulos no motor 3D
	const handleToggleModule = (modName: string) => {
		setSelectedModules((prev) => {
			const next = prev.includes(modName)
				? prev.filter((m) => m !== modName)
				: [...prev, modName];
			if (engineRef.current) {
				engineRef.current.setVisibleModules(next);
			}
			return next;
		});
	};

	const handleSelectAllModules = () => {
		setSelectedModules([]);
		if (engineRef.current) {
			engineRef.current.setVisibleModules([]);
		}
	};

	// Resultados da Busca com Autocomplete (estilo Graphify search-results)
	const searchMatches = useMemo(() => {
		if (!manualQuery.trim()) return [];
		const q = manualQuery.toLowerCase().trim();
		return vectorNodes
			.filter((n) => {
				const p = (n.path || "").toLowerCase();
				const qn = (n.qualifiedName || "").toLowerCase();
				const rel = (n.relPath || "").toLowerCase();
				const hasMethod = (n.methods || []).some((m) =>
					m.name.toLowerCase().includes(q),
				);
				return p.includes(q) || qn.includes(q) || rel.includes(q) || hasMethod;
			})
			.slice(0, 10);
	}, [manualQuery, vectorNodes]);

	// Ações de Câmera (Graphify navigation controls)
	const handleZoomIn = () => {
		cameraRef.current?.zoomIn();
	};

	const handleZoomOut = () => {
		cameraRef.current?.zoomOut();
	};

	const handlePanLeft = () => {
		cameraRef.current?.panLeft();
	};

	const handlePanRight = () => {
		cameraRef.current?.panRight();
	};

	const handlePanUp = () => {
		cameraRef.current?.panUp();
	};

	const handlePanDown = () => {
		cameraRef.current?.panDown();
	};

	const handlePcbTopView = () => {
		cameraRef.current?.setPcbTopView();
		toast.info("Visão Zenital PCB Ativada", "Plano de circuito impresso de nós");
	};

	const handleResetView = () => {
		cameraRef.current?.reset();
		setSelectedNode(null);
		setInspectedNode(null);
		toast.info("Visão centralizada", "Câmera retornou à posição panorâmica inicial");
	};

	const handleTogglePause = () => {
		setIsPaused((p) => {
			const next = !p;
			engineRef.current?.togglePause(next);
			return next;
		});
	};

	const handleFocusNode = (node: HermesVectorNode) => {
		setSelectedNode(node);
		setInspectedNode(node);
		if (engineRef.current) {
			engineRef.current.triggerMcpSearchTarget(node.id);
		}
		setIsPaused(true);
		if (cameraRef.current) {
			cameraRef.current.focusPosition(node.position, 2.2);
		}
	};

	const handleCopyPath = (node: HermesVectorNode) => {
		void navigator.clipboard.writeText(node.path);
		toast.success("Caminho copiado", node.relPath);
	};

	// Detecção de nó sob coordenadas do mouse
	const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
		if (!engineRef.current || !canvasRef.current) return;
		const rect = canvasRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const nodeIdx = engineRef.current.findNodeUnderScreenCoord(x, y, 22);
		engineRef.current.setHighlightedNode(nodeIdx);

		if (nodeIdx !== null && vectorNodes[nodeIdx]) {
			setInspectedNode(vectorNodes[nodeIdx]);
		} else if (!selectedNode) {
			setInspectedNode(null);
		}
	};

	const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
		if (!engineRef.current || !canvasRef.current) return;
		const rect = canvasRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const nodeIdx = engineRef.current.findNodeUnderScreenCoord(x, y, 24);
		if (nodeIdx !== null && vectorNodes[nodeIdx]) {
			const n = vectorNodes[nodeIdx]!;
			setSelectedNode(n);
			setInspectedNode(n);
			handleFocusNode(n);
		}
	};

	// Nó ativo para exibição no painel fixo inferior (hover tem prioridade momentânea sobre clique)
	const activeNode = inspectedNode || selectedNode;

	// Conexões Vizinhos 1-Hop (Graphify Connected Nodes)
	const activeNeighbors = useMemo(() => {
		if (!activeNode || vectorNodes.length === 0) return [];
		const activeIdx = vectorNodes.findIndex((n) => n.id === activeNode.id);
		if (activeIdx === -1) return [];

		const neighborIndices = new Set<number>();
		for (const edge of vectorEdges) {
			if (edge.source === activeIdx) neighborIndices.add(edge.target);
			else if (edge.target === activeIdx) neighborIndices.add(edge.source);
		}

		return Array.from(neighborIndices)
			.map((idx) => vectorNodes[idx])
			.filter(Boolean) as HermesVectorNode[];
	}, [activeNode, vectorNodes, vectorEdges]);

	return (
		<div className="relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-container-workspace-bg text-text-default">
			{/* Canvas WebGPU / 3D Scene Desimpedido */}
			<canvas
				ref={canvasRef}
				onPointerMove={handlePointerMove}
				onClick={handleCanvasClick}
				className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
			/>

			{/* Rótulos Inteligentes Projetados em 2D sobre o Canvas (Graphify style) */}
			<div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
				{projectedLabels.map((item) => {
					const modStyle = getModuleClasses(item.module);
					return (
						<div
							key={item.id}
							style={{
								left: `${Math.round(item.x)}px`,
								top: `${Math.round(item.y - 18)}px`,
							}}
							className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 rounded border px-6 py-2 backdrop-blur-md transition-all select-none ${
								item.isSearchingTarget
									? "bg-container-elevated-bg border-feedback-warning shadow-xl scale-125 z-40 opacity-100 ring-2 ring-feedback-warning animate-pulse text-feedback-warning"
									: item.isHovered
										? "bg-container-elevated-bg border-primary shadow-lg scale-110 z-30 opacity-100 ring-1 ring-primary"
										: item.isMatched
											? "bg-container-elevated-bg border-feedback-warning shadow-md scale-105 z-20 opacity-95 text-feedback-warning"
											: `bg-container-elevated-bg ${modStyle.border} shadow-sm opacity-85 z-10 text-text-default`
							}`}
						>
							<span className={`size-6 rounded-full shrink-0 ${modStyle.dot}`} />
							<span className="tr-code-text leading-none whitespace-nowrap">
								{item.label}
							</span>
							{item.isSearchingTarget ? (
								<span className="tr-code-text rounded bg-feedback-warning text-container-workspace-bg tr-text-emphasis px-4 py-2 leading-none">
									⚡ ALVO MCP
								</span>
							) : item.methodsCount > 0 ? (
								<span className="tr-text-metadata text-text-muted leading-none rounded bg-control-bg px-4 py-2">
									{item.methodsCount}
								</span>
							) : null}
						</div>
					);
				})}
			</div>

			{/* Barra Flutuante de Controles de Navegação (Graphify HUD) */}
			<div className="relative z-20 flex items-center justify-between p-12 pointer-events-none">
				{/* Busca RAG Ativa do Hermes */}
				{effectiveQuery ? (
					<div className="flex items-center gap-8 rounded-lg border border-border-default bg-container-elevated-bg px-12 py-6 shadow-md backdrop-blur-md animate-pulse pointer-events-auto">
						<RiSearchLine className="size-14 text-feedback-warning" />
						<span className="tr-text-emphasis text-feedback-warning uppercase">
							{state.activeRagToolName || "RAG SCAN"}:
						</span>
						<span className="rounded bg-control-bg px-6 py-2 tr-code-text text-primary max-w-[260px] truncate">
							{effectiveQuery}
						</span>
						<span className="tr-text-metadata text-text-muted">
							({matchedNodesCount} nós iluminados)
						</span>
						{manualQuery && (
							<button
								type="button"
								onClick={() => setManualQuery("")}
								className="tr-text-metadata text-text-muted hover:text-text-default ml-4 p-2"
								title="Limpar busca"
							>
								<RiCloseLine className="size-12" />
							</button>
						)}
					</div>
				) : (
					<div className="hidden sm:flex items-center gap-6 rounded-md border border-border-default bg-container-elevated-bg px-8 py-4 tr-text-metadata text-text-muted backdrop-blur-md">
						<RiNodeTree className="size-12 text-primary" />
						<span>{vectorNodes.length} nós indexados</span>
						<span>·</span>
						<span>{vectorEdges.length} conexões</span>
					</div>
				)}

				{/* Controles Rápidos de Câmera, Navegação e Modo PCB (Graphify HUD) */}
				<div className="flex items-center gap-4 rounded-lg border border-border-default bg-container-elevated-bg p-4 shadow-lg backdrop-blur-md pointer-events-auto ml-auto">
					{/* Navegação Direcional Pan */}
					<button
						type="button"
						className="size-28 flex items-center justify-center rounded p-0 text-text-muted hover:text-text-default hover:bg-control-bg transition-colors"
						onClick={handlePanLeft}
						title="Navegar para a Esquerda (Pan Esquerda)"
						aria-label="Pan Esquerda"
					>
						<RiArrowLeftLine className="size-14" />
					</button>

					<button
						type="button"
						className="size-28 flex items-center justify-center rounded p-0 text-text-muted hover:text-text-default hover:bg-control-bg transition-colors"
						onClick={handlePanRight}
						title="Navegar para a Direita (Pan Direita)"
						aria-label="Pan Direita"
					>
						<RiArrowRightLine className="size-14" />
					</button>

					<button
						type="button"
						className="size-28 flex items-center justify-center rounded p-0 text-text-muted hover:text-text-default hover:bg-control-bg transition-colors"
						onClick={handlePanUp}
						title="Navegar para Cima (Pan Cima)"
						aria-label="Pan Cima"
					>
						<RiArrowUpLine className="size-14" />
					</button>

					<button
						type="button"
						className="size-28 flex items-center justify-center rounded p-0 text-text-muted hover:text-text-default hover:bg-control-bg transition-colors"
						onClick={handlePanDown}
						title="Navegar para Baixo (Pan Baixo)"
						aria-label="Pan Baixo"
					>
						<RiArrowDownLine className="size-14" />
					</button>

					<div className="h-14 w-[1px] bg-border-default mx-2" />

					{/* Visão Zenital de Placa PCB / Litografia de Chip */}
					<button
						type="button"
						className="size-28 flex items-center justify-center rounded p-0 text-text-muted hover:text-primary hover:bg-control-bg transition-colors"
						onClick={handlePcbTopView}
						title="Visão Zenital de Placa PCB (Plano de Circuito / Chip Lithography)"
						aria-label="Visão Zenital PCB"
					>
						<RiCpuLine className="size-14" />
					</button>

					<button
						type="button"
						className="size-28 flex items-center justify-center rounded p-0 text-text-muted hover:text-text-default hover:bg-control-bg transition-colors"
						onClick={handleZoomIn}
						title="Zoom In (+)"
						aria-label="Zoom In"
					>
						<RiAddLine className="size-14" />
					</button>

					<button
						type="button"
						className="size-28 flex items-center justify-center rounded p-0 text-text-muted hover:text-text-default hover:bg-control-bg transition-colors"
						onClick={handleZoomOut}
						title="Zoom Out (-)"
						aria-label="Zoom Out"
					>
						<RiSubtractLine className="size-14" />
					</button>

					<button
						type="button"
						className="size-28 flex items-center justify-center rounded p-0 text-text-muted hover:text-text-default hover:bg-control-bg transition-colors"
						onClick={handleResetView}
						title="Centralizar Visão / Reset (Fit View)"
						aria-label="Centralizar Visão"
					>
						<RiRefreshLine className="size-14" />
					</button>

					<div className="h-14 w-[1px] bg-border-default mx-2" />

					<button
						type="button"
						className={`size-28 flex items-center justify-center rounded p-0 transition-colors ${
							isPaused
								? "bg-feedback-warning text-container-workspace-bg tr-text-emphasis"
								: "text-text-muted hover:text-text-default hover:bg-control-bg"
						}`}
						onClick={handleTogglePause}
						title={isPaused ? "Retomar Rotação Dinâmica" : "Pausar Rotação (Congelar Grafo)"}
						aria-label="Pausar ou Retomar Rotação"
					>
						{isPaused ? <RiPlayLine className="size-14" /> : <RiPauseLine className="size-14" />}
					</button>

					<div className="h-14 w-[1px] bg-border-default mx-2" />

					{/* Alternar Ocultamento Completo da Caixa Inferior */}
					<button
						type="button"
						className={`size-28 flex items-center justify-center rounded p-0 transition-colors ${
							isBottomPanelCompletelyHidden
								? "bg-primary text-text-on-primary shadow-sm"
								: "text-text-muted hover:text-text-default hover:bg-control-bg"
						}`}
						onClick={() => setIsBottomPanelCompletelyHidden((h) => !h)}
						title={isBottomPanelCompletelyHidden ? "Exibir Caixa de Informações Inferior" : "Esconder Completamente a Caixa Inferior (Modo Tela Cheia 3D)"}
						aria-label="Esconder ou Exibir Caixa de Informações Inferior"
					>
						{isBottomPanelCompletelyHidden ? <RiEyeLine className="size-14" /> : <RiEyeOffLine className="size-14" />}
					</button>
				</div>
			</div>

			{/* Painel Inferior de Informações (Alternável: Expandido / Recolhido / Oculto) */}
			{!isBottomPanelCompletelyHidden && (
			<div className="relative z-20 mt-auto p-12 pointer-events-none">
				{isBottomPanelCollapsed ? (
					/* Barra Compacta Minimizada (Visual Zen 3D) */
					<div className="mx-auto max-w-[1080px] pointer-events-auto rounded-lg border border-border-default bg-container-elevated-bg px-12 py-6 shadow-xl backdrop-blur-md transition-all flex items-center justify-between gap-8">
						<div className="flex items-center gap-8 min-w-0">
							<button
								type="button"
								onClick={() => setIsBottomPanelCollapsed(false)}
								className="flex items-center gap-4 rounded bg-control-bg px-8 py-4 tr-text-ui text-text-default hover:text-primary transition-colors cursor-pointer"
								title="Expandir Caixa de Informações"
							>
								<RiArrowUpSLine className="size-14 text-primary" />
								<span>Mostrar Informações</span>
							</button>

							{activeNode && (
								<div className="flex items-center gap-6 min-w-0 truncate">
									<span className="size-6 rounded-full bg-primary shrink-0" />
									<span className="tr-code-text text-primary truncate max-w-[280px]">
										{activeNode.qualifiedName || activeNode.relPath}
									</span>
									<span className="tr-text-metadata text-text-muted truncate hidden sm:inline">
										({activeNode.module})
									</span>
								</div>
							)}
						</div>

						<div className="flex items-center gap-8 tr-text-metadata text-text-muted select-none shrink-0">
							<span className="hidden sm:inline">[Botão Direito / Shift+Drag: Pan]</span>
							<span className="hidden sm:inline">·</span>
							<span>{totalChunks.toLocaleString()} chunks RAG</span>
							<button
								type="button"
								onClick={() => setIsBottomPanelCompletelyHidden(true)}
								className="size-24 flex items-center justify-center rounded p-0 text-text-muted hover:text-text-default hover:bg-control-bg transition-colors"
								title="Ocultar Completamente a Caixa de Informações"
							>
								<RiEyeOffLine className="size-12" />
							</button>
						</div>
					</div>
				) : (
					/* Caixa de Informações Completa Expandida (Graphify Dashboard) */
					<div className="mx-auto max-w-[1080px] pointer-events-auto rounded-lg border border-border-default bg-container-elevated-bg p-12 shadow-2xl backdrop-blur-md transition-all flex flex-col gap-8">
						{/* Barra de Busca com Autocomplete e Filtro de Comunidades */}
						<div className="flex flex-wrap items-center justify-between gap-8 border-b border-border-default pb-8">
							{/* Input de Busca com Dropdown Inteligente */}
							<div className="relative flex-1 min-w-[240px] max-w-[420px]">
								<div className="flex items-center gap-6 rounded border border-border-default bg-container-workspace-bg px-8 py-4 focus-within:border-primary transition-colors">
									<RiSearchLine className="size-14 text-text-muted shrink-0" />
									<input
										type="text"
										value={manualQuery}
										onChange={(e) => {
											setManualQuery(e.target.value);
											setIsSearchOpen(true);
										}}
										onFocus={() => setIsSearchOpen(true)}
										placeholder="Buscar classe, arquivo ou método (Fly to)..."
										className="bg-transparent tr-code-text text-text-default placeholder:text-text-muted outline-none w-full"
									/>
									{manualQuery && (
										<button
											type="button"
											onClick={() => setManualQuery("")}
											className="text-text-muted hover:text-text-default p-2"
										>
											<RiCloseLine className="size-12" />
										</button>
									)}
								</div>

								{/* Dropdown de Resultados da Busca (Graphify Search Results) */}
								{isSearchOpen && searchMatches.length > 0 && (
									<div className="absolute bottom-full left-0 right-0 mb-4 max-h-[220px] overflow-y-auto rounded-md border border-border-default bg-container-elevated-bg p-4 shadow-xl z-50 flex flex-col gap-2">
										{searchMatches.map((n) => {
											const modStyle = getModuleClasses(n.module);
											return (
												<div
													key={n.id}
													onClick={() => {
														handleFocusNode(n);
														setIsSearchOpen(false);
													}}
													className={`flex items-center justify-between rounded px-8 py-4 hover:bg-control-bg cursor-pointer transition-colors group border-l-2 ${modStyle.border}`}
												>
													<div className="flex items-center gap-6 min-w-0">
														<span className="tr-code-text text-text-default group-hover:text-primary truncate">
															{n.qualifiedName || n.relPath}
														</span>
														<span className="tr-text-metadata text-text-muted truncate hidden sm:inline">
															{n.module}
														</span>
													</div>
													<RiArrowRightLine className="size-12 text-text-muted group-hover:text-primary shrink-0" />
												</div>
											);
										})}
									</div>
								)}
							</div>

							{/* Legenda de Módulos / Comunidades com Filtros Interativos e Botão Ocultar */}
							<div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-2">
								<button
									type="button"
									onClick={handleSelectAllModules}
									className={`rounded px-6 py-2 tr-text-ui transition-colors ${
										selectedModules.length === 0
											? "bg-primary text-text-on-primary"
											: "bg-control-bg text-text-muted hover:text-text-default"
									}`}
								>
									Todos ({vectorNodes.length})
								</button>

								{availableModules.map((m) => {
									const isActive = selectedModules.includes(m.name);
									return (
										<button
											key={m.name}
											type="button"
											onClick={() => handleToggleModule(m.name)}
											className={`flex items-center gap-4 rounded border px-6 py-2 tr-code-text shrink-0 transition-colors ${
												isActive
													? "bg-container-workspace-bg border-primary text-text-default shadow-sm"
													: "border-border-default text-text-muted hover:text-text-default"
											}`}
										>
											<span className={`size-6 rounded-full shrink-0 ${m.classes.dot}`} />
											<span>{m.name}</span>
											<span className="tr-text-metadata text-text-muted">({m.count})</span>
										</button>
									);
								})}

								{/* Botão para Esconder a Caixa de Informações */}
								<div className="flex items-center gap-2 ml-auto shrink-0">
									<button
										type="button"
										onClick={() => setIsBottomPanelCompletelyHidden(true)}
										className="size-28 flex items-center justify-center rounded p-0 text-text-muted hover:text-text-default hover:bg-control-bg transition-colors"
										title="Ocultar Completamente (Visual Tela Cheia 3D)"
										aria-label="Ocultar Completamente Caixa de Informações"
									>
										<RiEyeOffLine className="size-14" />
									</button>

									<button
										type="button"
										onClick={() => setIsBottomPanelCollapsed(true)}
										className="size-28 flex items-center justify-center rounded p-0 text-text-muted hover:text-text-default hover:bg-control-bg transition-colors"
										title="Recolher Caixa de Informações"
										aria-label="Recolher Caixa de Informações"
									>
										<RiArrowDownSLine className="size-16" />
									</button>
								</div>
							</div>
						</div>

					{/* Conteúdo do Nó em Foco / Selecionado */}
					{activeNode ? (
						<div className="flex flex-col gap-8">
							{/* Linha Principal: Identificação do Nó e Botões de Ação */}
							<div className="flex flex-wrap items-center justify-between gap-8 border-b border-border-default pb-8">
								<div className="flex items-center gap-8 min-w-0">
									<span className="rounded bg-control-bg px-6 py-2 tr-code-text text-primary uppercase">
										{activeNode.language || "code"}
									</span>
									<span className="tr-text-emphasis text-primary truncate max-w-[340px]">
										{activeNode.qualifiedName || activeNode.relPath}
									</span>
									<span className="tr-code-text text-text-muted truncate max-w-[220px] hidden sm:inline">
										{activeNode.relPath}
									</span>
								</div>

								{/* Ações Operacionais Compactas */}
								<div className="flex items-center gap-4">
									<Button
										size="s"
										variant="primary"
										className="gap-4 tr-text-ui px-8"
										onClick={() => handleOpenFile(activeNode)}
									>
										<RiFileCodeLine className="size-12" />
										Abrir
									</Button>

									<Button
										size="s"
										variant="outline"
										className="gap-4 tr-text-ui px-8 border-border-default"
										onClick={() => handleInjectContext(activeNode)}
									>
										<RiChatQuoteLine className="size-12 text-feedback-info" />
										Injetar Chat
									</Button>

									<Button
										size="s"
										variant="outline"
										className="gap-4 tr-text-ui px-8 border-border-default"
										onClick={() => handleAskAgent(activeNode)}
									>
										<RiRobot2Line className="size-12 text-feedback-warning" />
										Analisar
									</Button>

									<Button
										size="s"
										variant="ghost"
										className="gap-4 tr-text-ui px-6"
										onClick={() => handleFocusNode(activeNode)}
									>
										<RiFocus3Line className="size-12 text-primary" />
										Focar
									</Button>

									<Button
										size="s"
										variant="ghost"
										className="gap-4 tr-text-ui px-6"
										onClick={() => handleCopyPath(activeNode)}
									>
										<RiFileCopyLine className="size-12 text-text-muted" />
									</Button>

									{selectedNode && (
										<button
											type="button"
											onClick={() => setSelectedNode(null)}
											className="rounded p-2 text-text-muted hover:text-text-default ml-2"
											title="Desmarcar seleção fixa"
										>
											<RiCloseLine className="size-14" />
										</button>
									)}
								</div>
							</div>

							{/* Vizinhos Conectados 1-Hop (Graphify Connected Nodes) */}
							{activeNeighbors.length > 0 && (
								<div className="flex items-center gap-8 overflow-x-auto py-2 no-scrollbar border-t border-border-default pt-6">
									<span className="tr-text-metadata text-text-muted shrink-0 select-none flex items-center gap-4">
										<RiNodeTree className="size-12 text-primary" />
										Vizinhos Conectados ({activeNeighbors.length}):
									</span>
									<div className="flex items-center gap-4">
										{activeNeighbors.map((nb) => {
											const nbStyle = getModuleClasses(nb.module);
											return (
												<button
													key={nb.id}
													type="button"
													onClick={() => handleFocusNode(nb)}
													className={`flex items-center gap-4 rounded border border-border-default bg-container-workspace-bg px-6 py-2 tr-code-text text-text-default hover:border-primary shrink-0 transition-colors border-l-2 ${nbStyle.border}`}
													title={`Focar em ${nb.qualifiedName || nb.relPath}`}
												>
													<span>{nb.qualifiedName || nb.relPath}</span>
												</button>
											);
										})}
									</div>
								</div>
							)}

							{/* Sub-Órbitas: Métodos e Funções Filhos da Classe com Scroll Horizontal */}
							{activeNode.methods && activeNode.methods.length > 0 && (
								<div className="flex items-center gap-8 overflow-x-auto py-2 no-scrollbar">
									<span className="tr-text-metadata text-text-muted shrink-0 select-none">
										Sub-Órbitas ({activeNode.methods.length}):
									</span>
									<div className="flex items-center gap-4">
										{activeNode.methods.map((m: any) => (
											<span
												key={m.id}
												className="rounded bg-container-workspace-bg border border-border-default px-6 py-2 tr-code-text text-text-default hover:border-primary cursor-pointer shrink-0 transition-colors"
												title={m.signature || m.name}
												onClick={() => setManualQuery(m.name)}
											>
												• {m.name}()
											</span>
										))}
									</div>
								</div>
							)}

							{/* Snippet de Código Compacto com Scroll */}
							{activeNode.contentSnippet && (
								<div className="max-h-[56px] overflow-y-auto rounded bg-container-workspace-bg p-6 border border-border-default">
									<pre className="tr-code-text text-text-muted whitespace-pre-wrap select-text">
										{activeNode.contentSnippet}
									</pre>
								</div>
							)}
						</div>
					) : (
						<div className="flex items-center justify-between tr-text-metadata text-text-muted select-none px-4">
							<span className="flex items-center gap-6">
								<RiFocus3Line className="size-12 text-primary" />
								Passe o mouse ou clique em qualquer nó para inspecionar conexões e métodos
							</span>
							<div className="flex items-center gap-8">
								<span>[Botão Direito / Shift+Drag: Pan]</span>
								<span>·</span>
								<span>[Scroll: Zoom]</span>
								<span>·</span>
								<span>{totalChunks.toLocaleString()} chunks RAG</span>
							</div>
						</div>
					)}
				</div>
				)}
			</div>
			)}
		</div>
	);
}
