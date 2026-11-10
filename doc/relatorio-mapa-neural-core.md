# Relatório Arquitetural: Mapa Neural Core 3D (Descobertas e Próximos Passos)

**Data:** 2026-03-29  
**Origem:** Hermes RAG + Golden Dataset + Task Specs (`.thinkrail/context/`)  
**Escopo:** `apps/web/src/panels/NeuralCorePanel.tsx`, `neuralEngine.ts`, `geometry.ts`, `packages/server/src/host/hermes.ts`  
**Status:** Em Operação Ativa / Backlog Estruturado

---

## 1. Visão Geral do Neural Core 3D

O **Neural Core 3D** é a camada de visualização espacial imersiva do ThinkRail e do Hermes RAG. Ele mapeia classes, componentes, interfaces e arquivos indexados no banco de dados vetorial (`hermes.db`) em uma representação tridimensional de constelações galácticas e trilhas de silício/cobre estilo PCB (Printed Circuit Board).

O motor opera com WebGPU de alta performance (com fallback seguro para 2D Canvas) e buffers indexados em `Uint32Array` para suportar dezenas de milhares de nós sem gargalos de memória.

---

## 2. Descobertas Técnicas Catalogadas no RAG e Golden Dataset

Através da inspeção do Golden Dataset e dos casos técnicos (`tc_11` a `tc_17`, `tc_26` e `tc_27`), mapeamos as decisões críticas já consolidadas:

### 2.1. Topologia Galáctica e Separação Multi-Projeto (`tc_12`)
- **Distribuição em Braços Espirais:** As classes são posicionadas através da equação espiral logarítmica da Via Láctea:
  $$r = a \cdot e^{b \cdot \theta}$$
  com núcleo estelar aberto e relaxação anti-colisão em tempo real $O(N)$ utilizando `SpatialHashGrid`.
- **Galáxias Isoladas no Plano XZ:** Projetos ativos no Hermes MCP ganham galáxias próprias, espaçadas com $13.6$ unidades de separação euclidiana, impedindo mistura visual de nós.
- **Trilhas PCB Multicamada (Manhattan Routing):** O motor emprega 4 camadas de cobre com elevações escalonadas no eixo Y e alternância de eixos ($X \to Z$ versus $Z \to X$), evitando que trilhas se cruzem no mesmo plano geométrico.

### 2.2. Cálculo Exato e Streaming em Lote (`tc_13`, `TASK-neural-core-batch-loader`)
- **Filtro Padronizado de Kinds:** Consulta SQL padronizada em `l2j_chunks` para:
  ```sql
  chunk_kind IN ('class', 'class_skeleton', 'class_overview', 'component', 'html_component', 'interface', 'struct', 'impl_skeleton', 'enum')
  ```
  igualando perfeitamente a contagem do SQLite à barra de progresso do HUD sem inflar nós genéricos.
- **Batch Streaming:** Carregamento progressivo em lotes de 120 a 350 nós a cada 180ms, permitindo visualização imediata sem congelar o navegador.

### 2.3. Interatividade e Preservação de Gestos (`tc_14`, `tc_15`, `tc_17`)
- **Exclusividade do Usuário no Controle de Câmera:** `handleFocusNode` não altera arbitrariamente o estado `isPaused`. A rotação automática só atua quando liberada pelo usuário.
- **Prevenção de Desseleção por Arrasto (`wasJustDragging`):** O `OrbitCameraController` mede a distância percorrida do ponteiro (> 4px). Se o clique foi consequência de órbita ou pan, o evento ignora a desseleção do polígono.
- **Rótulos 2D Projetados:** Tags de nós são interativas (`pointer-events: auto`), com botão `X` de cancelamento rápido de seleção limpando o alvo via `triggerMcpSearchTarget(null)`.

### 2.4. Estabilidade Geométrica e Eliminação de Jitter (`tc_26`)
- **Remoção de Reconstrução Contínua na CPU:** Eliminação do antigo loop de 32ms que recalculava `rebuildVectorMesh` na CPU.
- **Calibração de Nós Secundários:** Escala de $0.65$ e opacidade de $0.22$ para nós não relacionados, mantendo a hierarquia visual clara.
- **Auto-Fit Inicial:** Enquadramento dinâmico (`cameraController.fitBounds`) na carga inicial do grafo.

### 2.5. Impressão Digital Semântica Anti-Plágio (`tc_27`)
- O motor v18 calcula a **entropia de Shannon** e assinatura determinística SHA-256 equivalente a partir das relações de dependência AST e vizinhos k-NN dos nós, gerando um fingerprint topológico do código que expõe estruturas clones ou plagiadas.

---

## 3. O Que Precisa Ser Feito (Backlog de Implementação)

Com base no cruzamento das tarefas abertas (`TASK-neural-core-pcb-semantic-layout.md`, `TASK-neural-core-graphify-rag-motion.md`) e nas auditorias de UX/Performance, estão identificadas as seguintes ações necessárias:

### Prioridade Alta (Curto Prazo)

1. **Keepout Zone para Trilhas PCB (Desobstrução de Nós Intermediários)**
   - **Problema:** Em repositórios densos, algumas trilhas Manhattan atravessam visualmente os corpos e dies de outros polígonos, atrapalhando a leitura e o hit test.
   - **Ação:** Em `geometry.ts`, calcular uma caixa delimitadora de exclusão (*keepout zone*) em volta de cada nó intermediário. Se uma trilha cruzar essa zona, deve ser rebaixada no eixo Y (abaixo do die) ou sofrer deflexão Manhattan de contorno.

2. **Memória de Pose da Câmera (Snapshot & Restore on Deselect)**
   - **Problema:** Ao selecionar um nó, a câmera faz fly-to de zoom. Ao desmarcar o nó (pressionando `Esc` ou clicando no fundo), o usuário perde a orientação espacial anterior.
   - **Ação:** Implementar `saveCameraSnapshot()` no `OrbitCameraController` antes do fly-to e disparar `restoreCameraSnapshot()` com interpolação suave (lerp) na desseleção.

3. **Sincronização Bidirecional com Tabs e Editor Ativo**
   - **Problema:** Quando o desenvolvedor troca de arquivo ou linha no editor do ThinkRail, o nó correspondente no Neural Core não recebe destaque automático em tempo de repouso.
   - **Ação:** Conectar o hook `useAppStore` com o estado de abas abertas e disparar foco suave (`handleFocusNode`) para manter a correspondência visual código-espaço.

### Prioridade Média (Médio Prazo)

4. **Animação de Pulsos e Feixes Luminosos Exclusiva em Shaders WGSL**
   - **Problema:** O efeito de pulsos senoidais ainda depende de uploads esporádicos para a GPU.
   - **Ação:** Mover as ondas de choque e pulsos direcionais de inferência RAG para o shader de vértices/fragmentos (`shaders.wgsl.ts`), passando apenas o `timestamp` e `activePulseId` como uniform buffers, atingindo 120 FPS fixos com 0% de overhead de CPU.

5. **Comparador Visual de Plágio Multi-Projeto no Painel**
   - **Problema:** A impressão digital semântica (`computeSemanticFingerprint`) é gerada, mas ainda não existe uma tela de comparação direta entre dois projetos ativos.
   - **Ação:** Criar um card comparador em `NeuralCoreFingerprintCard.tsx` que exibe o coeficiente de similaridade Jaccard e distância de cosseno entre duas galáxias do workspace.

6. **Ajuste de Esquema no MCP `cindy_tools`**
   - **Problema:** O método auxiliar `cindy_search_code` falha com `no such column: chunk_text`.
   - **Ação:** Atualizar a query do MCP para utilizar a coluna unificada `content` (ou verificar `chunk_text AS content`), garantindo interoperabilidade total com o Hermes RAG.

---

## 4. Matriz de Rastreabilidade e Arquivos Afetados

| Funcionalidade / Tarefa | Arquivo(s) de Código | Spec / Referência |
|---|---|---|
| Keepout Zone de Trilhas | `apps/web/src/panels/neural-core/geometry.ts` | `TASK-neural-core-pcb-semantic-layout.md` |
| Snapshot / Restore Câmera | `apps/web/src/panels/neural-core/cameraController.ts` | `TASK-neural-core-pcb-semantic-layout.md` |
| Sincronização Tab->Grafo | `apps/web/src/panels/NeuralCorePanel.tsx` | `TASK-neural-core-graphify-rag-motion.md` |
| Shaders de Feixe RAG WGSL | `apps/web/src/panels/neural-core/shaders.wgsl.ts` | `TASK-neural-core-graphify-rag-motion.md` |
| Comparador de Fingerprint | `apps/web/src/panels/neural-core/components/NeuralCoreFingerprintCard.tsx` | `TASK-neural-core-semantic-fingerprint-v18.md` |
| Correção de Coluna SQLite | `packages/server/src/host/cindy.ts` ou MCP Cindy | `doc/relatorio-integridade-rag-mcp.md` |

---

## 5. Próximo Passo Recomendado

Iniciar a implementação do **Snapshot e Restauração de Câmera** e da **Keepout Zone de Trilhas PCB**, que trazem o maior ganho imediato de ergonomia e clareza visual para o desenvolvedor ao explorar grafos densos no Neural Core.
