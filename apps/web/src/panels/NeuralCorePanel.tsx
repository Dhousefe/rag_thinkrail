import {
	RiAddLine,
	RiArrowDownLine,
	RiArrowDownSLine,
	RiArrowLeftLine,
	RiArrowRightLine,
	RiArrowUpLine,
	RiArrowUpSLine,
	RiChatQuoteLine,
	RiCheckDoubleLine,
	RiCloseLine,
	RiCpuLine,
	RiDatabase2Line,
	RiDownloadCloud2Line,
	RiEditLine,
	RiEyeLine,
	RiEyeOffLine,
	RiFileCodeLine,
	RiFileCopyLine,
	RiFocus3Line,
	RiLoader4Line,
	RiNodeTree,
	RiPauseLine,
	RiPlayLine,
	RiRefreshLine,
	RiRobot2Line,
	RiSearchLine,
	RiStackLine,
	RiSubtractLine,
} from "@remixicon/react";
import type {
	HermesChunkItem,
	HermesClassStatsResult,
	HermesVectorNode,
} from "@thinkrail/contracts";
import { Button } from "@thinkrail/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { selectWorkspaceById, selectWorkspaceChatTab, toast, useAppStore } from "@/store";
import { getTransport } from "@/transport";
import { projectRelativePath } from "../lib";
import { OrbitCameraController } from "./neural-core/cameraController";
import {
	NeuralCoreChunksView,
	NeuralCoreNodeOverview,
	NeuralCoreSearchBox,
} from "./neural-core/components";
import { NeuralCoreEngine } from "./neural-core/neuralEngine";
import { resolvePivotNode } from "./neural-core/resolvePivotNode";
import { useNeuralCoreState } from "./neural-core/useNeuralCoreState";
import { openChatInTab, startChatInTab } from "./openChat";
import { openFileInTab } from "./openTabs";

function getModuleClasses(moduleName?: string): { border: string; text: string; dot: string } {
	switch (moduleName) {
		case "apps/web":
			return {
				border: "border-feedback-info",
				text: "text-feedback-info",
				dot: "bg-feedback-info",
			};
		case "packages/server":
			return { border: "border-primary", text: "text-primary", dot: "bg-primary" };
		case "contracts":
			return {
				border: "border-feedback-warning",
				text: "text-feedback-warning",
				dot: "bg-feedback-warning",
			};
		case "packages/ui":
			return {
				border: "border-feedback-success",
				text: "text-feedback-success",
				dot: "bg-feedback-success",
			};
		case "scripts":
			return {
				border: "border-feedback-error",
				text: "text-feedback-error",
				dot: "bg-feedback-error",
			};
		default:
			return { border: "border-border-default", text: "text-text-muted", dot: "bg-text-muted" };
	}
}

export function NeuralCorePanel() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const engineRef = useRef<NeuralCoreEngine | null>(null);
	const cameraRef = useRef<OrbitCameraController | null>(null);
	const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
	const hasDraggedRef = useRef<boolean>(false);

	const { state, pulseKey } = useNeuralCoreState();
	const [manualQuery, setManualQuery] = useState("");
	const [isPaused, setIsPaused] = useState(false);
	const [showPcbLines, setShowPcbLines] = useState(true);
	const [isBottomPanelCollapsed, setIsBottomPanelCollapsed] = useState(false);
	const [isBottomPanelCompletelyHidden, setIsBottomPanelCompletelyHidden] = useState(false);
	const [remoteSearchMatches, setRemoteSearchMatches] = useState<HermesVectorNode[]>([]);
	const [isSearchingRemote, setIsSearchingRemote] = useState(false);
	const [activeChatPivotNode, setActiveChatPivotNode] = useState<HermesVectorNode | null>(null);
	const lastChatPivotNodeIdRef = useRef<string | null>(null);

	// Chunks Registrados para a Classe e Busca
	const [nodeChunks, setNodeChunks] = useState<HermesChunkItem[]>([]);
	const [isLoadingNodeChunks, setIsLoadingNodeChunks] = useState(false);
	const [searchChunks, setSearchChunks] = useState<HermesChunkItem[]>([]);
	const [activeInfoTab, setActiveInfoTab] = useState<"details" | "chunks">("details");

	// Estado da Projeção de Vetores RAG
	const [vectorNodes, setVectorNodes] = useState<HermesVectorNode[]>([]);
	const [vectorEdges, setVectorEdges] = useState<any[]>([]);
	const [totalChunks, setTotalChunks] = useState(0);
	const [inspectedNode, setInspectedNode] = useState<HermesVectorNode | null>(null);
	const [selectedNode, setSelectedNode] = useState<HermesVectorNode | null>(null);
	const [projectedLabels, setProjectedLabels] = useState<any[]>([]);
	const [selectedModules, setSelectedModules] = useState<string[]>([]);

	// Estatísticas de Classes e Arquivos dos Projetos Ativos
	const [classStats, setClassStats] = useState<HermesClassStatsResult | null>(null);
	const [isLoadingStats, setIsLoadingStats] = useState(false);

	// Batch Loader (Carregador em Lote Progressivo)
	const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>("all");
	const [, setBatchOffset] = useState(0);
	const batchOffsetRef = useRef(0);
	const [hasMoreBatches, setHasMoreBatches] = useState(false);
	const [totalAvailableNodes, setTotalAvailableNodes] = useState(0);
	const [totalClassesCount, setTotalClassesCount] = useState(0);
	const [totalFilesCount, setTotalFilesCount] = useState(0);
	const [isLoadingBatch, setIsLoadingBatch] = useState(false);
	const [isAutoStreaming, setIsAutoStreaming] = useState(false);
	const autoStreamingRef = useRef(false);

	// Sincronização e Reatividade com Projetos Ativos do Hermes RAG
	const activeProjectSlugs = useAppStore((s) => s.hermesManagement.activeProjectSlugs);
	const activeProjectSlug = useAppStore((s) => s.hermesManagement.activeProjectSlug);

	// Consulta de estatísticas detalhadas de classes e arquivos
	const loadClassStats = useCallback(async () => {
		setIsLoadingStats(true);
		try {
			const stats = await getTransport().request("hermes.getClassStats", {});
			setClassStats(stats);
			if (stats?.totals) {
				setTotalClassesCount(stats.totals.totalClasses);
				setTotalFilesCount(stats.totals.totalFiles);
			}
		} catch (err) {
			console.warn("[NeuralCorePanel] Erro ao carregar estatísticas de classes:", err);
		} finally {
			setIsLoadingStats(false);
		}
	}, []);

	// Carregamento dos vetores do banco SQLite hermes.db com suporte a lote (Batch Loader)
	const loadVectorGraph = useCallback(
		async (reset = true, overrideSlug?: string) => {
			try {
				setIsLoadingBatch(true);
				const currentOffset = reset ? 0 : batchOffsetRef.current;
				const targetSlug =
					overrideSlug !== undefined
						? overrideSlug === "all"
							? undefined
							: overrideSlug
						: selectedProjectFilter === "all"
							? undefined
							: selectedProjectFilter;

				// Lotes otimizados de 350 nós (anteriormente 180) para carregamento 2x mais rápido
				// sem travar a thread de renderização WebGPU/WebGL
				const res = await getTransport().request("hermes.getVectorGraph", {
					limit: 350,
					offset: currentOffset,
					batchSize: 350,
					includeAllClasses: true,
					projectSlug: targetSlug,
				});
				if (res && Array.isArray(res.nodes)) {
					if (reset) {
						setVectorNodes(res.nodes);
						setVectorEdges(res.edges || []);
						const nextOffset = res.nodes.length;
						batchOffsetRef.current = nextOffset;
						setBatchOffset(nextOffset);
						if (engineRef.current) {
							engineRef.current.setVectorGraphData(res.nodes, res.edges || []);
						}
					} else {
						// Merge de nós preservando IDs únicos e remapeando arestas
						setVectorNodes((prev) => {
							const existing = new Set(prev.map((n) => n.id || n.path));
							const fresh = res.nodes.filter((n) => !existing.has(n.id || n.path));
							return [...prev, ...fresh];
						});
						setVectorEdges((prev) => [...prev, ...(res.edges || [])]);
						const nextOffset = batchOffsetRef.current + res.nodes.length;
						batchOffsetRef.current = nextOffset;
						setBatchOffset(nextOffset);
						if (engineRef.current) {
							engineRef.current.appendVectorGraphData(res.nodes, res.edges || []);
						}
					}
					setTotalChunks(res.totalChunks);
					setHasMoreBatches(Boolean(res.hasMore));
					setTotalAvailableNodes(res.totalAvailableNodes || res.totalChunks);
					if (res.totalClasses) setTotalClassesCount(res.totalClasses);
					if (res.totalFiles) setTotalFilesCount(res.totalFiles);
				}
			} catch (err) {
				console.warn("[NeuralCorePanel] Erro ao carregar grafo vetorial:", err);
			} finally {
				setIsLoadingBatch(false);
			}
		},
		[selectedProjectFilter],
	);

	// Mudança de filtro de projeto
	const handleSelectProjectFilter = useCallback(
		async (slug: string) => {
			setSelectedProjectFilter(slug);
			batchOffsetRef.current = 0;
			setBatchOffset(0);
			setIsAutoStreaming(false);
			autoStreamingRef.current = false;
			await loadVectorGraph(true, slug);
		},
		[loadVectorGraph],
	);

	// Carrega o próximo lote de classes
	const handleLoadNextBatch = useCallback(async () => {
		if (isLoadingBatch || !hasMoreBatches) return;
		await loadVectorGraph(false);
	}, [isLoadingBatch, hasMoreBatches, loadVectorGraph]);

	// Streaming automático em lote até 100% ou cancelamento manual
	const handleToggleAutoStreaming = useCallback(() => {
		if (isAutoStreaming) {
			autoStreamingRef.current = false;
			setIsAutoStreaming(false);
			toast.info("Streaming de lotes pausado", `${vectorNodes.length} classes carregadas`);
		} else {
			autoStreamingRef.current = true;
			setIsAutoStreaming(true);
			toast.info("Carregando todas as classes", "Streaming progressivo em lote iniciado...");
		}
	}, [isAutoStreaming, vectorNodes.length]);

	// Loop do streaming contínuo em lotes com pausa controlada
	useEffect(() => {
		if (!isAutoStreaming) return;
		if (!hasMoreBatches) {
			setIsAutoStreaming(false);
			autoStreamingRef.current = false;
			toast.success("Todas as classes carregadas", `${vectorNodes.length} nós na cena 3D`);
			return;
		}

		let isCancelled = false;
		const timer = setTimeout(async () => {
			if (!autoStreamingRef.current || isCancelled) return;
			await handleLoadNextBatch();
		}, 180); // Intervalo reduzido de 450ms para 180ms para resposta rápida do streaming

		return () => {
			isCancelled = true;
			clearTimeout(timer);
		};
	}, [isAutoStreaming, hasMoreBatches, handleLoadNextBatch, vectorNodes.length]);

	// Recarrega automaticamente a representação gráfica e stats quando projetos RAG forem ativados/desativados
	useEffect(() => {
		void loadClassStats();
		void loadVectorGraph(true);
	}, [activeProjectSlugs, activeProjectSlug]);

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

	// Sincroniza polígono selecionado com o motor 3D (realce de conexões e esmaecimento de nós alheios)
	useEffect(() => {
		if (!engineRef.current) return;
		if (!selectedNode) {
			engineRef.current.setSelectedNode(null);
		} else {
			const idx = vectorNodes.findIndex((n) => n.id === selectedNode.id);
			engineRef.current.setSelectedNode(idx !== -1 ? idx : null);
		}
	}, [selectedNode, vectorNodes]);

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

	// Foco Automático do Chat / MCP em Tempo Real:
	// Aciona animação de pulso e movimento suave de foco da câmera APENAS quando a Rotação Dinâmica estiver ativada (!isPaused)
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

			// Somente anima o movimento de foco e centraliza a câmera se a rotação dinâmica estiver ATIVADA
			if (!isPaused && cameraRef.current) {
				cameraRef.current.focusPosition(matchedNode.position, 2.3);
			}

			setInspectedNode(matchedNode);
		}
	}, [effectiveQuery, vectorNodes, isPaused]);

	// Foco e Seleção Dinâmica em Tempo Real nas ferramentas do Chat (Read, Edit, Write, AST, RAG):
	// Interage ativamente mesmo com a Rotação Dinâmica ativada (!isPaused) ou pausada,
	// voando a câmera suavemente para a classe manipulada e destacando seus métodos e conexões.
	// Ao mudar de classe, desfaz o foco anterior e foca a nova classe alvo com transição animada.
	useEffect(() => {
		if (!state.activeChatTool || !state.activeChatFilePath) return;

		let isCancelled = false;
		const filePath = state.activeChatFilePath;
		const pivotClass = state.activeChatPivotClass;

		// 1. Tenta resolver entre os nós já carregados no plano 3D
		const pivot = resolvePivotNode(filePath, vectorNodes, pivotClass);

		const applySelection = (targetNode: HermesVectorNode) => {
			if (isCancelled) return;
			lastChatPivotNodeIdRef.current = targetNode.id;
			setActiveChatPivotNode(targetNode);
			setSelectedNode(targetNode);
			setInspectedNode(targetNode);

			if (engineRef.current) {
				// Dispara pulso de vida no polígono sem forçar a pausa da rotação dinâmica
				engineRef.current.triggerMcpSearchTarget(targetNode.id, false);
				const idx = vectorNodes.findIndex((n) => n.id === targetNode.id);
				if (idx !== -1) {
					engineRef.current.setSelectedNode(idx);
				}
			}

			if (cameraRef.current) {
				// Transição suave e orgânica da câmera via interpolação lerp
				cameraRef.current.focusPosition(targetNode.position, 2.2);
			}
		};

		if (pivot) {
			applySelection(pivot);
		} else {
			// 2. Se o nó ainda não estiver no lote local da cena, busca no SQLite do Hermes RAG
			const targetSlug = selectedProjectFilter === "all" ? undefined : selectedProjectFilter;

			void getTransport()
				.request("hermes.searchGraphNodes", {
					query: filePath,
					projectSlug: targetSlug,
					limit: 1,
				})
				.then((res) => {
					if (isCancelled) return;
					if (res && Array.isArray(res.nodes) && res.nodes.length > 0) {
						const injectedNode = res.nodes[0]!;
						setVectorNodes((prev) => {
							if (prev.some((n) => n.id === injectedNode.id)) return prev;
							const updated = [...prev, injectedNode];
							if (engineRef.current) {
								engineRef.current.appendVectorGraphData([injectedNode], []);
							}
							return updated;
						});
						applySelection(injectedNode);
					}
				})
				.catch((err) => {
					console.warn("[NeuralCorePanel] Erro ao buscar nó do chat no banco RAG:", err);
				});
		}

		return () => {
			isCancelled = true;
		};
	}, [
		state.activeChatTool,
		state.activeChatFilePath,
		state.activeChatPivotClass,
		vectorNodes,
		selectedProjectFilter,
	]);

	// Ações Rápidas de Produtividade para o Provider e Desenvolvedor
	const handleOpenFile = async (node: HermesVectorNode) => {
		if (!node.path) return;
		const store = useAppStore.getState();
		const currentWsId = store.activeWorkspaceId;
		const currentWs = currentWsId ? selectWorkspaceById(store, currentWsId) : null;

		// 1. Resolução ultrarrápida no workspace atual (0ms)
		const currentRelPath = projectRelativePath(node.path, currentWs?.worktreePath) || node.relPath;
		const isInsideCurrentWs =
			Boolean(currentWs) &&
			Boolean(currentRelPath) &&
			!currentRelPath.startsWith("..") &&
			!currentRelPath.includes(":");

		if (currentWs && isInsideCurrentWs) {
			// Revela imediatamente na árvore de arquivos sem esperar RPC
			store.revealInFiles(currentWs.id, currentRelPath);
			void openFileInTab(currentWs.id, node.path, "keep");
			toast.success("Arquivo aberto no editor", node.relPath || currentRelPath);
			return;
		}

		// 2. Busca rápida entre os outros workspaces já abertos no ThinkRail
		for (const wsList of Object.values(store.workspaces)) {
			for (const ws of wsList) {
				if (ws.id === currentWsId) continue;
				const rel = projectRelativePath(node.path, ws.worktreePath);
				if (rel && !rel.startsWith("..") && !rel.includes(":")) {
					store.activateWorkspaceFromRoute({ id: ws.id, projectId: ws.projectId });
					store.revealInFiles(ws.id, rel);
					void openFileInTab(ws.id, node.path, "keep");
					toast.success(
						`Chaveado para projeto [${node.projectSlug || ws.projectId}]`,
						node.relPath || rel,
					);
					return;
				}
			}
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
						updatedStore.activateWorkspaceFromRoute({
							id: targetWs.id,
							projectId: targetWs.projectId,
						});
						const targetRel = projectRelativePath(node.path, targetWs.worktreePath) || node.relPath;
						updatedStore.revealInFiles(targetWs.id, targetRel);
						void openFileInTab(targetWs.id, node.path, "keep");
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
				if (currentRelPath) {
					store.revealInFiles(currentWsId, currentRelPath);
				}
				void openFileInTab(currentWsId, node.path, "keep");
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
			const next = prev.includes(modName) ? prev.filter((m) => m !== modName) : [...prev, modName];
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
	// Combina nós locais da cena 3D com resultados remotos do SQLite sob demanda
	const searchMatches = useMemo(() => {
		if (!manualQuery.trim()) return [];
		const q = manualQuery.toLowerCase().trim();
		const localMatches = vectorNodes.filter((n) => {
			const p = (n.path || "").toLowerCase();
			const qn = (n.qualifiedName || "").toLowerCase();
			const rel = (n.relPath || "").toLowerCase();
			const snippet = (n.contentSnippet || "").toLowerCase();
			const mod = (n.module || "").toLowerCase();
			const kind = (n.chunkKind || "").toLowerCase();
			const hasMethod = (n.methods || []).some(
				(m) =>
					m.name.toLowerCase().includes(q) ||
					(m.signature || "").toLowerCase().includes(q) ||
					(m.contentSnippet || "").toLowerCase().includes(q),
			);
			return (
				p.includes(q) ||
				qn.includes(q) ||
				rel.includes(q) ||
				snippet.includes(q) ||
				mod.includes(q) ||
				kind.includes(q) ||
				hasMethod
			);
		});

		// Adiciona nós remotos encontrados sem duplicar id
		const seen = new Set(localMatches.map((m) => m.id));
		const merged = [...localMatches];
		for (const rem of remoteSearchMatches) {
			if (!seen.has(rem.id)) {
				merged.push(rem);
				seen.add(rem.id);
			}
		}
		// Retorna até 80 itens correspondentes para garantir visualização completa com scroll fluido
		return merged.slice(0, 80);
	}, [manualQuery, vectorNodes, remoteSearchMatches]);

	// Busca dinâmica no SQLite do Hermes RAG quando o usuário digita (nós e chunks)
	useEffect(() => {
		const q = manualQuery.trim();
		if (!q) {
			setRemoteSearchMatches([]);
			setSearchChunks([]);
			return;
		}

		const timer = setTimeout(async () => {
			setIsSearchingRemote(true);
			try {
				const [nodeRes, chunkRes] = await Promise.all([
					getTransport().request("hermes.searchGraphNodes", {
						query: q,
						limit: 60,
					}),
					getTransport().request("hermes.getNodeChunks", {
						path: q,
						limit: 60,
					}),
				]);
				if (nodeRes && Array.isArray(nodeRes.nodes)) {
					setRemoteSearchMatches(nodeRes.nodes);
				}
				// Mescla os chunks diretos com os chunks encontrados pela busca do hermes
				const combinedChunks: HermesChunkItem[] = [];
				const seenChunkIds = new Set<string>();

				if (nodeRes && Array.isArray((nodeRes as any).chunks)) {
					for (const c of (nodeRes as any).chunks) {
						if (!seenChunkIds.has(c.id)) {
							seenChunkIds.add(c.id);
							combinedChunks.push(c);
						}
					}
				}
				if (chunkRes && Array.isArray(chunkRes.chunks)) {
					for (const c of chunkRes.chunks) {
						if (!seenChunkIds.has(c.id)) {
							seenChunkIds.add(c.id);
							combinedChunks.push(c);
						}
					}
				}
				setSearchChunks(combinedChunks);
			} catch (err) {
				console.warn("[NeuralCorePanel] Erro na busca remota de nós e chunks:", err);
			} finally {
				setIsSearchingRemote(false);
			}
		}, 180);

		return () => clearTimeout(timer);
	}, [manualQuery]);

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

	const handleTogglePcbLines = () => {
		setShowPcbLines((prev) => {
			const next = !prev;
			engineRef.current?.setShowPcbLines(next);
			if (next) {
				toast.info("Trilhas PCB Visíveis", "Trilhas ortogonais de circuito Manhattan ativadas");
			} else {
				toast.info("Trilhas PCB Ocultadas", "Cena desobstruída: polígonos e nós em foco total");
			}
			return next;
		});
	};

	const handleFitAll = useCallback(() => {
		if (vectorNodes.length > 0) {
			const positions = vectorNodes.map((n) => n.position);
			cameraRef.current?.fitBounds(positions);
			toast.info("Enquadramento Global (Fit All)", "Todos os nós ajustados no campo de visão");
		} else {
			cameraRef.current?.reset();
		}
	}, [vectorNodes]);

	const handleDeselectNode = useCallback((restoreCamera: boolean = true) => {
		setSelectedNode(null);
		setInspectedNode(null);
		if (engineRef.current) {
			engineRef.current.setHighlightedNode(null);
			engineRef.current.triggerMcpSearchTarget(null);
			engineRef.current.setSelectedNode(null);
		}
		if (restoreCamera && cameraRef.current) {
			const restored = cameraRef.current.restoreCameraSnapshot();
			if (restored) {
				toast.info("Câmera restaurada", "Retornou à visão anterior à seleção");
			}
		}
	}, []);

	const handleDeselectClick = useCallback(() => {
		handleDeselectNode(true);
	}, [handleDeselectNode]);

	const handleResetView = () => {
		cameraRef.current?.reset();
		handleDeselectNode();
		toast.info("Visão centralizada", "Câmera retornou à posição panorâmica inicial");
	};

	const handleTogglePause = () => {
		setIsPaused((p) => {
			const next = !p;
			engineRef.current?.togglePause(next);
			return next;
		});
	};

	// Atalhos de Teclado Globais do Neural Core (F: Fit All, R: Reset, +/-: Zoom, Espaço: Pausar/Girar)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
				return;
			}

			if (e.key === "f" || e.key === "F") {
				e.preventDefault();
				handleFitAll();
			} else if (e.key === "Escape") {
				e.preventDefault();
				handleDeselectNode(true);
			} else if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey) {
				e.preventDefault();
				cameraRef.current?.clearCameraSnapshot();
				handleResetView();
			} else if (e.key === "+" || e.key === "=") {
				e.preventDefault();
				handleZoomIn();
			} else if (e.key === "-" || e.key === "_") {
				e.preventDefault();
				handleZoomOut();
			} else if (e.key === " " && !e.repeat) {
				e.preventDefault();
				handleTogglePause();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleFitAll]);

	const handleFocusNode = (node: HermesVectorNode) => {
		// Se o nó ainda não estiver na cena 3D atual, adiciona-o dinamicamente
		setVectorNodes((prev) => {
			if (prev.some((n) => n.id === node.id)) return prev;
			const next = [...prev, node];
			if (engineRef.current) {
				engineRef.current.setVectorGraphData(next, vectorEdges);
			}
			return next;
		});

		// Salva o snapshot da câmera antes de focar no nó para permitir restauração ao desselecionar
		if (!selectedNode && cameraRef.current) {
			cameraRef.current.saveCameraSnapshot();
		}

		setSelectedNode(node);
		setInspectedNode(node);
		if (engineRef.current) {
			engineRef.current.triggerMcpSearchTarget(node.id);
			const nodeIdx = engineRef.current.vectorNodes.findIndex((n) => n.id === node.id);
			if (nodeIdx !== -1) {
				engineRef.current.setSelectedNode(nodeIdx);
			}
		}
		// Não altera isPaused: o controle de rotação é exclusivo do usuário
		if (cameraRef.current) {
			cameraRef.current.focusPosition(node.position, 2.2);
		}

		// Revela e abre a classe selecionada imediatamente na aba Files do editor
		void handleOpenFile(node);
	};

	const handleCopyPath = (node: HermesVectorNode) => {
		void navigator.clipboard.writeText(node.path);
		toast.success("Caminho copiado", node.relPath);
	};

	// Detecção de nó sob coordenadas do mouse com tolerância estrita a partir do polígono
	const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
		pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
		hasDraggedRef.current = false;
	};

	const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
		if (pointerDownPosRef.current) {
			const dx = e.clientX - pointerDownPosRef.current.x;
			const dy = e.clientY - pointerDownPosRef.current.y;
			if (Math.hypot(dx, dy) > 5) {
				hasDraggedRef.current = true;
			}
		}
	};

	const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
		if (pointerDownPosRef.current) {
			const dx = e.clientX - pointerDownPosRef.current.x;
			const dy = e.clientY - pointerDownPosRef.current.y;
			if (Math.hypot(dx, dy) > 5) {
				hasDraggedRef.current = true;
			}
		}

		if (!engineRef.current || !canvasRef.current) return;
		const rect = canvasRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		// Registra posição do cursor para projeção de nomes por raio seguro
		engineRef.current.setCursorScreenCoord(x, y);

		// Tolerância ampla ajustada para capturar o corpo do polígono com extrema precisão
		const nodeIdx = engineRef.current.findNodeUnderScreenCoord(x, y, 22);
		engineRef.current.setHighlightedNode(nodeIdx);
		if (canvasRef.current) {
			canvasRef.current.style.cursor = nodeIdx !== null ? "pointer" : "default";
		}

		if (nodeIdx !== null && vectorNodes[nodeIdx]) {
			setInspectedNode(vectorNodes[nodeIdx]);
		} else if (!selectedNode) {
			setInspectedNode(null);
		}
	};

	const handlePointerLeave = () => {
		if (canvasRef.current) {
			canvasRef.current.style.cursor = "default";
		}
		if (engineRef.current) {
			engineRef.current.setCursorScreenCoord(null, null);
			engineRef.current.setHighlightedNode(null);
		}
		if (!selectedNode) {
			setInspectedNode(null);
		}
	};

	const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
		// Se o usuário estava arrastando para virar a câmera ou dar pan, nunca cancela nem altera a seleção!
		const wasDragging =
			hasDraggedRef.current || (cameraRef.current ? cameraRef.current.wasJustDragging() : false);

		hasDraggedRef.current = false;
		pointerDownPosRef.current = null;

		if (wasDragging) {
			return;
		}

		if (!engineRef.current || !canvasRef.current) return;
		const rect = canvasRef.current.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;

		const nodeIdx = engineRef.current.findNodeUnderScreenCoord(x, y, 26);
		if (nodeIdx !== null && vectorNodes[nodeIdx]) {
			const n = vectorNodes[nodeIdx]!;
			setSelectedNode(n);
			setInspectedNode(n);
			handleFocusNode(n);
		} else {
			// Clicou no espaço vazio da cena 3D -> desmarca seleção e restaura câmera suavemente
			handleDeselectNode(true);
		}
	};

	// Nó ativo para exibição no painel fixo inferior (hover tem prioridade momentânea sobre clique)
	const activeNode = inspectedNode || selectedNode;

	// Carrega todos os chunks gravados no banco SQLite para a classe/nó ativo
	const loadNodeChunks = useCallback(async (node: HermesVectorNode) => {
		setIsLoadingNodeChunks(true);
		try {
			const res = await getTransport().request("hermes.getNodeChunks", {
				nodeId: node.id,
				path: node.path || node.relPath,
				limit: 150,
			});
			if (res && Array.isArray(res.chunks)) {
				setNodeChunks(res.chunks);
			} else {
				setNodeChunks([]);
			}
		} catch (err) {
			console.warn("[NeuralCorePanel] Erro ao carregar chunks da classe:", err);
			setNodeChunks([]);
		} finally {
			setIsLoadingNodeChunks(false);
		}
	}, []);

	useEffect(() => {
		if (activeNode) {
			void loadNodeChunks(activeNode);
		} else {
			setNodeChunks([]);
		}
	}, [activeNode?.id, activeNode?.path, loadNodeChunks]);

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
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
				onPointerMove={handlePointerMove}
				onPointerLeave={handlePointerLeave}
				onClick={handleCanvasClick}
				className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
			/>

			{/* Rótulos Inteligentes Projetados em 2D sobre o Canvas com Repulsão Magnética */}
			<div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
				{projectedLabels.map((item) => {
					const modStyle = getModuleClasses(item.module);
					const isNodeSelected = selectedNode?.id === item.id || item.isSelected;
					return (
						<div
							key={item.id}
							style={{
								left: `${Math.round(item.x)}px`,
								top: `${Math.round(item.y)}px`,
							}}
							className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 rounded border px-6 py-2 backdrop-blur-md transition-all select-none pointer-events-auto ${
								isNodeSelected
									? "bg-container-elevated-bg border-primary shadow-xl scale-110 z-40 opacity-100 ring-2 ring-primary text-text-default"
									: item.isHovered
										? "bg-container-elevated-bg border-primary shadow-lg scale-105 z-30 opacity-100 ring-1 ring-primary text-text-default"
										: item.isMatched
											? "bg-container-elevated-bg border-feedback-warning shadow-md scale-105 z-20 opacity-95 text-feedback-warning"
											: `bg-container-elevated-bg ${modStyle.border} shadow-sm opacity-85 z-10 text-text-default hover:opacity-100 hover:border-primary`
							}`}
						>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									const targetNode = vectorNodes.find((n) => n.id === item.id);
									if (targetNode) {
										handleFocusNode(targetNode);
									}
								}}
								onPointerEnter={() => {
									const targetNode = vectorNodes.find((n) => n.id === item.id);
									if (targetNode) {
										setInspectedNode(targetNode);
										const idx = vectorNodes.findIndex((n) => n.id === item.id);
										engineRef.current?.setHighlightedNode(idx !== -1 ? idx : item.index);
									}
								}}
								onPointerLeave={() => {
									engineRef.current?.setHighlightedNode(null);
									if (!selectedNode) {
										setInspectedNode(null);
									}
								}}
								className="flex items-center gap-4 bg-transparent border-none p-0 cursor-pointer text-inherit outline-none"
								title={
									isNodeSelected
										? `Polígono selecionado (${item.label})`
										: `Clique para focar em ${item.label}`
								}
							>
								<span className={`size-6 rounded-full shrink-0 ${modStyle.dot}`} />
								<span className="tr-code-text leading-none whitespace-nowrap">{item.label}</span>
								{item.methodsCount > 0 && !isNodeSelected && (
									<span className="tr-text-metadata text-text-muted leading-none rounded bg-control-bg px-4 py-2">
										{item.methodsCount}
									</span>
								)}
							</button>
							{isNodeSelected && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										handleDeselectNode();
									}}
									className="size-16 flex items-center justify-center rounded-full bg-control-bg text-text-muted hover:text-text-default hover:bg-container-workspace-bg transition-colors p-0 cursor-pointer shrink-0"
									title="Remover seleção"
									aria-label="Remover seleção"
								>
									<RiCloseLine className="size-12" />
								</button>
							)}
						</div>
					);
				})}
			</div>

			{/* Barra Flutuante de Controles de Navegação (Graphify HUD) */}
			<div className="relative z-20 flex items-center justify-between p-12 pointer-events-none">
				{/* Ferramenta Ativa do Chat (Read / Edit) com Foco na Classe Pivô */}
				{state.activeChatTool ? (
					<div
						className={`flex items-center gap-8 rounded-lg border bg-container-elevated-bg px-12 py-6 shadow-md backdrop-blur-md pointer-events-auto transition-colors ${
							state.activeChatTool === "edit" ? "border-feedback-warning" : "border-primary"
						}`}
					>
						{state.activeChatTool === "edit" ? (
							<RiEditLine className="size-14 text-feedback-warning animate-pulse" />
						) : (
							<RiFileCodeLine className="size-14 text-primary animate-pulse" />
						)}
						<span
							className={`tr-text-emphasis uppercase ${
								state.activeChatTool === "edit" ? "text-feedback-warning" : "text-primary"
							}`}
						>
							CHAT {state.activeChatTool}:
						</span>
						<button
							type="button"
							className="rounded bg-control-bg px-6 py-2 tr-code-text text-text-default max-w-[260px] truncate cursor-pointer hover:text-primary transition-colors text-left"
							onClick={() => {
								if (activeChatPivotNode && cameraRef.current) {
									cameraRef.current.focusPosition(activeChatPivotNode.position, 2.3);
									setInspectedNode(activeChatPivotNode);
								}
							}}
							title={`Classe/Arquivo pivô: ${activeChatPivotNode?.qualifiedName || state.activeChatPivotClass || state.activeChatFilePath}`}
						>
							{activeChatPivotNode?.qualifiedName ||
								state.activeChatPivotClass ||
								state.activeChatFilePath}
						</button>
						<span
							className={`tr-text-metadata px-4 py-2 rounded bg-control-bg flex items-center gap-2 ${
								!isPaused ? "text-primary" : "text-feedback-success"
							}`}
							title={
								!isPaused
									? "Foco dinâmico com rotação ativa em tempo real"
									: "Foco dinâmico fixado (rotação pausada)"
							}
						>
							<span
								className={`size-6 rounded-full shrink-0 ${
									!isPaused ? "bg-primary animate-ping" : "bg-feedback-success"
								}`}
							/>
							<span>{!isPaused ? "FOCO DINÂMICO ATIVO" : "SELEÇÃO FIXADA"}</span>
						</span>
					</div>
				) : effectiveQuery ? (
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
					<div className="flex flex-wrap items-center gap-6 rounded-lg border border-border-default bg-container-elevated-bg px-8 py-4 tr-text-metadata text-text-muted backdrop-blur-md shadow-md pointer-events-auto">
						{/* Seletor de Escopo de Projeto Ativo */}
						{classStats?.projects && classStats.projects.length > 1 && (
							<div className="flex items-center gap-4 pr-4 border-r border-border-default">
								<select
									value={selectedProjectFilter}
									onChange={(e) => void handleSelectProjectFilter(e.target.value)}
									className="bg-control-bg rounded border border-border-default px-6 py-2 tr-code-text text-text-default outline-none cursor-pointer hover:border-primary transition-colors"
									title="Filtrar classes e grafos por projeto ativo"
								>
									<option value="all">Todos os Projetos ({classStats.projects.length})</option>
									{classStats.projects.map((p) => (
										<option key={p.slug} value={p.slug}>
											{p.name} ({p.totalClasses} classes)
										</option>
									))}
								</select>
							</div>
						)}

						{/* Indicador de Classes e Arquivos por Projeto Ativo */}
						<div
							className="flex items-center gap-4 cursor-help"
							title={
								classStats?.projects
									? classStats.projects
											.map(
												(p) =>
													`[${p.name}]: ${p.totalClasses} classes, ${p.totalInterfaces} interfaces, ${p.totalFiles} arquivos`,
											)
											.join("\n")
									: "Projetos ativos indexados no Hermes RAG"
							}
						>
							<RiNodeTree
								className={`size-14 text-primary ${isLoadingStats ? "animate-spin" : ""}`}
							/>
							<span className="tr-text-emphasis text-text-default">
								{vectorNodes.length}
								{totalClassesCount > 0 && ` / ${totalClassesCount}`} classes
							</span>
							{totalClassesCount > 0 && (
								<span className="rounded bg-control-bg px-4 py-2 text-primary tr-text-emphasis">
									{Math.min(
										100,
										Math.round((vectorNodes.length / Math.max(1, totalClassesCount)) * 100),
									)}
									%
								</span>
							)}
						</div>

						<span className="text-border-default">·</span>

						{/* Contagem de Arquivos Únicos */}
						<div className="flex items-center gap-4 hidden md:flex">
							<RiFileCodeLine className="size-12 text-feedback-info" />
							<span>
								{totalFilesCount > 0
									? `${totalFilesCount} arquivos`
									: `${vectorNodes.length} arquivos`}
							</span>
						</div>

						<span className="text-border-default hidden md:inline">·</span>

						{/* Arestas de Conexão e Nós Estruturais */}
						<span
							className="hidden sm:inline"
							title={
								totalAvailableNodes > 0
									? `${vectorEdges.length} conexões · ${totalAvailableNodes.toLocaleString()} nós estruturais elegíveis`
									: `${vectorEdges.length} conexões`
							}
						>
							{vectorEdges.length} conexões
						</span>

						{/* Controles do Batch Loader (Carregamento em Lote) */}
						{hasMoreBatches ? (
							<div className="flex items-center gap-4 ml-2 pl-2 border-l border-border-default">
								<button
									type="button"
									disabled={isLoadingBatch || isAutoStreaming}
									onClick={handleLoadNextBatch}
									className="flex items-center gap-4 rounded bg-control-bg px-6 py-2 text-text-default hover:bg-control-bg hover:text-primary transition-colors disabled:opacity-50"
									title="Carregar mais 350 classes no plano 3D"
								>
									{isLoadingBatch && !isAutoStreaming ? (
										<RiLoader4Line className="size-12 animate-spin text-primary" />
									) : (
										<RiStackLine className="size-12 text-primary" />
									)}
									<span className="tr-text-emphasis">+180</span>
								</button>

								<button
									type="button"
									onClick={handleToggleAutoStreaming}
									className={`flex items-center gap-4 rounded px-6 py-2 transition-colors ${
										isAutoStreaming
											? "bg-primary text-text-on-primary animate-pulse"
											: "bg-control-bg text-primary hover:bg-control-bg"
									}`}
									title={
										isAutoStreaming
											? "Pausar carregamento automático"
											: "Carregar todas as classes e arquivos disponíveis"
									}
								>
									{isAutoStreaming ? (
										<RiPauseLine className="size-12" />
									) : (
										<RiDownloadCloud2Line className="size-12" />
									)}
									<span className="tr-text-emphasis">
										{isAutoStreaming ? "Pausar Lotes" : "Todas as Classes"}
									</span>
								</button>
							</div>
						) : (
							<div className="flex items-center gap-4 ml-2 pl-2 border-l border-border-default text-feedback-success">
								<RiCheckDoubleLine className="size-12" />
								<span className="tr-text-emphasis">100% Carregado</span>
							</div>
						)}
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

					{/* Toggle Mostrar/Esconder Linhas de Circuito Impresso PCB */}
					<button
						type="button"
						className={`size-28 flex items-center justify-center rounded p-0 transition-colors ${
							showPcbLines
								? "text-primary hover:bg-control-bg"
								: "text-text-muted hover:text-text-default hover:bg-control-bg opacity-50"
						}`}
						onClick={handleTogglePcbLines}
						title={
							showPcbLines
								? "Ocultar Trilhas de PCB (Desobstruir visualização de polígonos)"
								: "Mostrar Trilhas de PCB (Exibir conexões Manhattan e vias de cobre)"
						}
						aria-label="Alternar Trilhas PCB"
					>
						{showPcbLines ? (
							<RiNodeTree className="size-14" />
						) : (
							<RiEyeOffLine className="size-14" />
						)}
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
						className="size-28 flex items-center justify-center rounded p-0 text-text-muted hover:text-primary hover:bg-control-bg transition-colors"
						onClick={handleFitAll}
						title="Enquadrar Todos os Nós (Fit All - Tecla F)"
						aria-label="Enquadrar Todos os Nós"
					>
						<RiFocus3Line className="size-14" />
					</button>

					<button
						type="button"
						className="size-28 flex items-center justify-center rounded p-0 text-text-muted hover:text-text-default hover:bg-control-bg transition-colors"
						onClick={handleResetView}
						title="Centralizar Visão Inicial (Reset - Tecla R)"
						aria-label="Centralizar Visão Inicial"
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
						title={
							isBottomPanelCompletelyHidden
								? "Exibir Caixa de Informações Inferior"
								: "Esconder Completamente a Caixa Inferior (Modo Tela Cheia 3D)"
						}
						aria-label="Esconder ou Exibir Caixa de Informações Inferior"
					>
						{isBottomPanelCompletelyHidden ? (
							<RiEyeLine className="size-14" />
						) : (
							<RiEyeOffLine className="size-14" />
						)}
					</button>
				</div>
			</div>

			{/* Painel Inferior de Informações (Exibido apenas quando houver um polígono clicado/selecionado) */}
			{Boolean(selectedNode) && !isBottomPanelCompletelyHidden && (
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
										<button
											type="button"
											onClick={handleDeselectClick}
											className="size-18 flex items-center justify-center rounded-full bg-control-bg text-text-muted hover:text-text-default hover:bg-control-bg transition-colors p-0 cursor-pointer shrink-0"
											title="Remover seleção do polígono"
											aria-label="Remover seleção"
										>
											<RiCloseLine className="size-12" />
										</button>
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
						<div className="mx-auto max-w-[1080px] pointer-events-auto rounded-lg border border-border-default bg-container-elevated-bg p-12 shadow-2xl backdrop-blur-md transition-all flex flex-col gap-8 max-h-[58vh] min-h-0 overflow-visible">
							{/* Barra de Busca com Autocomplete e Filtro de Comunidades */}
							<div className="flex flex-wrap items-center justify-between gap-8 border-b border-border-default pb-8 shrink-0">
								{/* Caixa de Busca com Dropdown Particionado (Nós e Chunks) */}
								<NeuralCoreSearchBox
									query={manualQuery}
									onQueryChange={setManualQuery}
									isSearchingRemote={isSearchingRemote}
									searchMatches={searchMatches}
									searchChunks={searchChunks}
									onSelectNode={handleFocusNode}
									onSelectChunk={(chunk) => {
										const matchedNode = vectorNodes.find(
											(n) =>
												n.path === chunk.path ||
												n.relPath === chunk.relPath ||
												(chunk.path && n.path && n.path.endsWith(chunk.path)) ||
												(n.relPath && chunk.relPath && n.relPath.endsWith(chunk.relPath)),
										);
										if (matchedNode) {
											handleFocusNode(matchedNode);
										} else if (chunk.path || chunk.relPath) {
											// Se o nó ainda não estiver na cena, pesquisa dinamicamente para injetar e focar
											const targetPath = chunk.path || chunk.relPath || "";
											void getTransport()
												.request("hermes.searchGraphNodes", {
													query: chunk.qualifiedName || targetPath,
													limit: 1,
												})
												.then((res) => {
													if (res && res.nodes && res.nodes[0]) {
														handleFocusNode(res.nodes[0]);
													}
												});
										}
										setActiveInfoTab("chunks");
									}}
									getModuleClasses={getModuleClasses}
								/>

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
								<div className="flex flex-col gap-8 min-h-0 flex-1 overflow-hidden">
									{/* Linha Principal: Identificação do Nó e Botões de Ação */}
									<div className="flex flex-wrap items-center justify-between gap-8 border-b border-border-default pb-8 shrink-0">
										<div className="flex flex-wrap items-center gap-6 min-w-0 flex-1">
											<span className="rounded bg-control-bg px-6 py-2 tr-code-text text-primary uppercase">
												{activeNode.language || "code"}
											</span>
											<span className="tr-text-emphasis text-primary truncate max-w-[340px]">
												{activeNode.qualifiedName || activeNode.relPath}
											</span>
											<button
												type="button"
												onClick={handleDeselectClick}
												className="size-20 flex items-center justify-center rounded-full bg-control-bg text-text-muted hover:text-text-default hover:bg-control-bg transition-colors p-0 cursor-pointer shrink-0"
												title="Remover seleção do polígono"
												aria-label="Remover seleção"
											>
												<RiCloseLine className="size-14" />
											</button>
											<span className="tr-code-text text-text-muted truncate max-w-[220px] hidden sm:inline">
												{activeNode.relPath}
											</span>
										</div>

										{/* Ações Operacionais Compactas */}
										<div className="flex flex-wrap items-center gap-4 shrink-0">
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
													onClick={handleDeselectClick}
													className="rounded p-2 text-text-muted hover:text-text-default ml-2 cursor-pointer"
													title="Desmarcar seleção fixa"
												>
													<RiCloseLine className="size-14" />
												</button>
											)}
										</div>
									</div>

									{/* Barra de Seleção de Abas do Nó: Visão Geral vs Chunks Registrados */}
									<div className="flex flex-wrap items-center gap-6 border-b border-border-default pb-4 shrink-0">
										<button
											type="button"
											onClick={() => setActiveInfoTab("details")}
											className={`flex items-center gap-4 px-8 py-2 rounded tr-text-ui transition-colors cursor-pointer ${
												activeInfoTab === "details"
													? "bg-primary text-text-on-primary shadow-xs tr-text-emphasis"
													: "text-text-muted hover:text-text-default hover:bg-control-bg"
											}`}
										>
											<RiNodeTree className="size-12" />
											<span>Visão Geral e Conexões</span>
										</button>

										<button
											type="button"
											onClick={() => setActiveInfoTab("chunks")}
											className={`flex items-center gap-4 px-8 py-2 rounded tr-text-ui transition-colors cursor-pointer ${
												activeInfoTab === "chunks"
													? "bg-primary text-text-on-primary shadow-xs tr-text-emphasis"
													: "text-text-muted hover:text-text-default hover:bg-control-bg"
											}`}
										>
											<RiDatabase2Line className="size-12" />
											<span>Chunks Registrados ({nodeChunks.length})</span>
											{isLoadingNodeChunks && (
												<RiRefreshLine className="size-12 animate-spin text-feedback-warning" />
											)}
										</button>
									</div>

									{/* Área de Conteúdo Scrollável com Scroll Nativo Desimpedido */}
									<div className="overflow-y-auto min-h-0 flex-1 pr-2 flex flex-col gap-8">
										{activeInfoTab === "details" ? (
											<NeuralCoreNodeOverview
												activeNode={activeNode}
												activeNeighbors={activeNeighbors}
												onFocusNeighbor={handleFocusNode}
												onSelectMethodQuery={setManualQuery}
												getModuleClasses={getModuleClasses}
											/>
										) : (
											<NeuralCoreChunksView chunks={nodeChunks} isLoading={isLoadingNodeChunks} />
										)}
									</div>
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
