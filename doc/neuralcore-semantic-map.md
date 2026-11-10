NeuralCore — Mapa Semântico (inicial)

Resumo
- Localização: apps/web/src/panels/neural-core
- Objetivo: mapa de módulos, funções, pontos de integração e dependências para gerar uma base semântica RAG.
- Entrega: este documento (doc/neuralcore-semantic-map.md) contém o inventário inicial e próximos passos.

Visão geral e pontos de entrada
- NeuralCore é uma visualização / motor 3D integrado ao painel apps/web/src/panels/NeuralCorePanel.tsx.
- Entrada principal de runtime: NeuralCorePanel -> cria NeuralCoreEngine (neuralEngine.ts) e OrbitCameraController (cameraController.ts) e consome componentes React em ./components.
- O grafo vetorial (vector graph) é carregado do Hermes RAG via transport RPCs (hermes.getVectorGraph, hermes.searchGraphNodes, hermes.getNodeChunks, hermes.getClassStats).

Arquivos principais (inventário)
- apps/web/src/panels/neural-core/
  - neuralEngine.ts — NeuralCoreEngine (classe principal do motor 3D), renderização WebGPU/Canvas2D, gerenciamento de nós/arestas, telemetria, camera orbit, upload de buffers e métodos de interação (setVectorGraphData, appendVectorGraphData, setRagSearch, findNodeUnderScreenCoord, getProjectedNodeLabels, ...).
  - geometry.ts — cole��o de geradores de formas/mesh (createTesseractWireframe, createIcosahedronWireframe, createToolNodeSatellites, computeNodeRelations, computeSemanticFingerprint, etc.). Exporta tipos GeometryMeshData, GeometryShapeType, VectorNode/Input e utilitários para construir os meshes do grafo.
  - cameraController.ts — OrbitCameraController: controles de câmera, fitBounds, focusPosition, snapshots.
  - resolvePivotNode.ts — lógica para resolver um "pivot" (classe/arquivo alvo) entre nós carregados.
  - useNeuralCoreState.ts — estado reativo (telemetria, query RAG, pulseKey) conectado ao store da aplicação.
  - shaders.wgsl.ts — código WGSL utilizado pelo pipeline WebGPU.
  - types.ts — tipos locais (NeuralActivityState, NeuralTelemetryState, etc.).
  - components/* — UI: NeuralCoreSearchBox, NeuralCoreChunksView, NeuralCoreChunksView, NeuralCoreFingerprintCard, NeuralCoreNodeOverview e outros pequenos componentes de HUD e lista.
  - *.test.ts / *.test.tsx — testes unitários cobrindo fingerprint, resolvePivotNode, cameraController e components.

Símbolos exportados e responsabilidades (alto nível)
- NeuralCoreEngine (class) — gestão da cena 3D, buffers WebGPU, interações do usuário, reconciliação com os vetores RAG.
- Funções de geometry.ts — construção de formas e cálculos auxiliares (orbital placement, relações entre nós, fingerprint semântica).
- OrbitCameraController — API pública para controlar/focar/restaurar a câmera.
- Components React — UI para busca, inspeção de chunks (contexto RAG) e auditoria de impressão digital semântica.

Dependências internas e integrações
- RPC / Hermes transport:
  - hermes.getVectorGraph — batch loader de nós/arestas (limit, offset, batchSize)
  - hermes.searchGraphNodes — busca por path/file query
  - hermes.getNodeChunks — recuperar chunks de contexto para um nó
  - hermes.getClassStats — estatísticas globais de classes/arquivos
- Integração com store e UI:
  - useNeuralCoreState fornece telemetria e queries vindas do chat/agent
  - openFileInTab, openChatInTab, startChatInTab — integração com fluxo do editor/chat
- Tipos e contratos:
  - @thinkrail/contracts (HermesChunkItem, HermesVectorNode, HermesClassStatsResult)
- Bibliotecas/implementações visuais:
  - WebGPU (navigator.gpu) com fallback Canvas2D
  - Icons: @remixicon/react
  - UI primitives: @thinkrail/ui/*

Dependências externas (package-level)
- Verificar package.json para dependências do frontend (ex: @thinkrail/contracts, @thinkrail/ui, @remixicon/react, webgpu feature detection não é um pacote). Consulte lockfile para versões exatas.

Call graph e fluxos (alto nível)
- UI -> NeuralCorePanel
  - on mount: new NeuralCoreEngine(canvas); camera controller; engine.init(); engine.start(); loadVectorGraph()
- loadVectorGraph -> transport.hermes.getVectorGraph -> setVectorNodes/setVectorEdges -> engine.setVectorGraphData
- User search (manualQuery / agent RAG query) -> NeuralCorePanel updates effectiveQuery -> engine.setRagSearch(query) -> engine.rebuildVectorMesh() which triggers createVectorConstellationWireframe in geometry and updates GPU buffers
- Click on projected label -> handleFocusNode -> handleOpenFile -> openFileInTab (possibly project.open via transport)
- Active chat pivot interactions -> resolvePivotNode local; if not present, hermes.searchGraphNodes then append node to scene

Observações e decisões detectadas
- O motor foi concebido para carregar por lotes (batch loader) e agrupar nós em páginas de ~350 para evitar travar render; existe suporte a streaming automático.
- Impressão digital semântica (computeSemanticFingerprint) é usada como mecanismo anti-plágio e auditoria (exposto no painel).
- O grafo RAG é a fonte gold: NeuralCore apenas consome e visualiza o grafo indexado pelo Hermes (não replica lógica de parsing aqui).
- Há testes unitários cobrindo funções críticas, e benchmarks/fixtures já referenciam arquivos do neural-core no benchmarks/rag-golden-dataset.json.

Próximos passos imediatos (curto prazo)
1) Extrair lista detalhada de exports e assinaturas (AST) de: geometry.ts, neuralEngine.ts, cameraController.ts, resolvePivotNode.ts, useNeuralCoreState.ts, componentes. (objetivo: L1 → assinatura/AST)
2) Construir call-graph 1-hop (chamadores/chamados) usando ast-skeleton ou parser (v2) para localizar dependências internas entre símbolos (L2 cirúrgico).
3) Gerar chunks semânticos: decidir tamanho de chunk e metadados (module, relPath, symbol, methods, snippet).
4) Indexar esses chunks no Hermes RAG (pipeline chunk→embed→upsert) com provenance apontando para commit/branch.

Onde o mapa será salvo
- Arquivo salvo: doc/neuralcore-semantic-map.md (este arquivo).
- Próximo artefato planejado: doc/neuralcore-ast-signatures.json (L1 export signatures) e doc/neuralcore-callgraph.json (L2 call graph).

Notas de contexto
- Branch ativo: feature/neural-core (verificado no .git/HEAD e logs). Considere registrar o commit SHA como provenance quando indexar.
- Benchmarks/fixtures já referenciam arquivos do neural-core (benchmarks/rag-golden-dataset.json).

Se quiser, prossigo automaticamente com o passo 1 (extrair AST/assinaturas) e salvo o resultado em doc/neuralcore-ast-signatures.json — devo continuar para isso agora?