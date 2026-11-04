import type { HermesVectorNode } from "@thinkrail/contracts";
import {
	RiChatQuoteLine,
	RiCloseLine,
	RiFileCodeLine,
	RiFileCopyLine,
	RiFocus3Line,
	RiRobot2Line,
	RiSearchLine,
} from "@remixicon/react";
import { Button } from "@thinkrail/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { selectWorkspaceChatTab, toast, useAppStore } from "@/store";
import { getTransport } from "@/transport";
import { openChatInTab, startChatInTab } from "./openChat";
import { openFileInTab } from "./openTabs";
import { OrbitCameraController } from "./neural-core/cameraController";
import { NeuralCoreEngine } from "./neural-core/neuralEngine";
import { useNeuralCoreState } from "./neural-core/useNeuralCoreState";

export function NeuralCorePanel() {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const engineRef = useRef<NeuralCoreEngine | null>(null);
	const cameraRef = useRef<OrbitCameraController | null>(null);

	const { state, pulseKey } = useNeuralCoreState();
	const [manualQuery, setManualQuery] = useState("");

	// Estado da Projeção de Vetores RAG
	const [vectorNodes, setVectorNodes] = useState<HermesVectorNode[]>([]);
	const [totalChunks, setTotalChunks] = useState(0);
	const [inspectedNode, setInspectedNode] = useState<HermesVectorNode | null>(null);
	const [selectedNode, setSelectedNode] = useState<HermesVectorNode | null>(null);

	// Carregamento dos vetores do banco SQLite hermes.db
	const currentProjectRef = useRef<string | undefined>(undefined);

	const loadVectorGraph = useCallback(async (projectSlug?: string) => {
		try {
			const res = await getTransport().request("hermes.getVectorGraph", {
				limit: 120,
				projectSlug,
			});
			if (res && Array.isArray(res.nodes)) {
				setVectorNodes(res.nodes);
				setTotalChunks(res.totalChunks);
				currentProjectRef.current = res.projectSlug || projectSlug;
				if (engineRef.current) {
					engineRef.current.setVectorGraphData(res.nodes, res.edges);
				}
			}
		} catch (err) {
			console.warn("[NeuralCorePanel] Erro ao carregar grafo vetorial:", err);
		}
	}, []);

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
		});
		cameraRef.current = camera;

		// Vincula o loop a 60 FPS com o tween suave da câmera (fly-to)
		engine.onBeforeRenderFrame = () => {
			camera.updateTween();
			engine.cameraOrbit.theta = camera.theta;
			engine.cameraOrbit.phi = camera.phi;
			engine.cameraOrbit.distance = camera.distance;
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

	// Reage dinamicamente a ativação de projetos do Hermes MCP
	useEffect(() => {
		if (state.activeRagProject && state.activeRagProject !== currentProjectRef.current) {
			void loadVectorGraph(state.activeRagProject);
		}
	}, [state.activeRagProject, loadVectorGraph]);

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

	// Foco Automático do Provider: centraliza a câmera 3D no símbolo inspecionado pela IA
	useEffect(() => {
		if (!effectiveQuery || vectorNodes.length === 0) return;
		const q = effectiveQuery.toLowerCase();
		const matchedNode = vectorNodes.find((n) => {
			const p = (n.path || "").toLowerCase();
			const qn = (n.qualifiedName || "").toLowerCase();
			const rel = (n.relPath || "").toLowerCase();
			return p.includes(q) || qn.includes(q) || rel.includes(q);
		});
		if (matchedNode && cameraRef.current) {
			cameraRef.current.focusPosition(matchedNode.position, 2.5);
			setInspectedNode(matchedNode);
		}
	}, [effectiveQuery, vectorNodes]);

	// Ações Rápidas de Produtividade para o Provider e Desenvolvedor
	const handleOpenFile = (node: HermesVectorNode) => {
		const wsId = useAppStore.getState().activeWorkspaceId;
		if (wsId && node.path) {
			void openFileInTab(wsId, node.path, "keep");
			toast.success("Arquivo aberto no editor", node.relPath);
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

	const handleFocusNode = (node: HermesVectorNode) => {
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

	return (
		<div className="relative flex h-full w-full min-h-0 flex-col overflow-hidden bg-container-workspace-bg text-text-default">
			{/* Canvas WebGPU / 3D Scene Desimpedido */}
			<canvas
				ref={canvasRef}
				onPointerMove={handlePointerMove}
				onClick={handleCanvasClick}
				className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
			/>

			{/* Topo Limpo: Exibe APENAS quando houver busca RAG do Provider ou manual */}
			{effectiveQuery && (
				<div className="relative z-10 flex items-center justify-between p-16 pointer-events-none">
					<div className="flex items-center gap-8 rounded-lg border border-border-default bg-container-elevated-bg px-12 py-6 shadow-md backdrop-blur-md animate-pulse pointer-events-auto">
						<RiSearchLine className="size-14 text-feedback-warning" />
						<span className="tr-text-emphasis text-feedback-warning uppercase">
							{state.activeRagToolName || "RAG SCAN"}:
						</span>
						<span className="rounded bg-control-bg px-6 py-2 tr-code-text text-primary max-w-[280px] truncate">
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
				</div>
			)}

			{/* Painel Fixo Inferior: Compacto, com Scroll Interno e Ações do Provider */}
			<div className="relative z-20 mt-auto p-16 pointer-events-none">
				<div className="mx-auto max-w-[960px] pointer-events-auto rounded-lg border border-border-default bg-container-elevated-bg p-12 shadow-2xl backdrop-blur-md transition-all">
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
								Passe o mouse ou clique em qualquer classe ou método para inspecionar e interagir
							</span>
							<div className="flex items-center gap-8">
								<span>[Scroll: Zoom -/+]</span>
								<span>·</span>
								<span>{totalChunks.toLocaleString()} chunks RAG</span>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
