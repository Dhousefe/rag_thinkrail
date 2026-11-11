Resumo

Este documento descreve casos de uso, critérios de aceitação e um prompt de correção destinados a orientar uma intervenção (manual ou assistida por LLM) nas chamadas MCP / no código do Neural Core que controlam a câmera e a exibição de classes (nós). O objetivo é corrigir o comportamento atual — onde a câmera não posiciona/foca/restaura corretamente as classes manipuladas pelo chat — e padronizar os sinais que a automação (MCP) envia/espera.

Problema

- Sintoma: ao instruir o chat/MCP a focar ou destacar uma classe (por id), a câmera às vezes não centraliza o nó, perde o foco após seleção ou não preserva o enquadramento ao restaurar a visualização anterior. A função de "mostrar as classes que o chat está manipulando" está inconsistênte.
- Impacto: má usabilidade, perda de contexto durante inspeção guiada por chat, comportamento de seleção incorreto, e testes visuais falhando.

Arquivos e APIs afetadas (ponto de partida)

- apps/web/src/panels/neural-core/cameraController.ts
  - métodos importantes: focusPosition, saveCameraSnapshot, restoreCameraSnapshot, fitBounds, wasJustDragging, panBy, updateTween
- apps/web/src/panels/neural-core/neuralEngine.ts
  - propriedades/métodos: cameraOrbit, triggerMcpSearchTarget, setVisibleModules, setVectorGraphData, setRagSearch, setSelectedNode, setHighlightedNode, findNodeUnderScreenCoord, getProjectedNodeLabels, rebuildVectorMesh, start/stop render loop
- apps/web/src/panels/neural-core/geometry.ts (posições/escala/projeção)
- testes unitários relacionados em apps/web/src/panels/neural-core/*.test.ts
- Benchmarks/fixtures: benchmarks/rag-golden-dataset.json (casos de busca/seleção)

Casos de uso (UI-driven / MCP-driven)

1) Foco único por comando de chat
- Fluxo: usuário (via chat) pede "Mostre a classe X" -> MCP chama Neural Core para focar no nó X. A câmera deve salvar snapshot antes do fly-to, fazer um fly-to suave para o nó X e exibir rótulo/realce.
- Critério de aceitação: o nó X fica centralizado, marcado como selecionado, e o snapshot anterior é preservado.

2) Restauração de visual anterior após inspeção
- Fluxo: ao terminar a inspeção (ex: clique em "voltar" no chat/inspector), a câmera restaura o snapshot salvo.
- Critério: restoreCameraSnapshot() retorna true e a câmera transiciona suavemente para a posição anterior.

3) Seleção via hover vs arraste (evitar desseleção involuntária)
- Fluxo: usuário roda orbit/pan e clica rapidamente; se houve arraste (> 4px ou wasJustDragging true), um clique subsequente não deve resetar seleção.
- Critério: wasJustDragging() previne desseleção quando apropriado.

4) Busca MCP com auto-pausa e animação de destaque
- Fluxo: MCP chama triggerMcpSearchTarget(nodeId, autoPause=true). A cena pausa, anima o nó alvo por searchAnimDurationMs e mantém o foco.
- Critério: isPaused=true (quando solicitado), animação ocorre 2s, e o nó alvo ganha prioridade visual sem perder enquadramento.

5) Fit bounds em múltiplos nós (ex: "mostre todas as classes relacionadas")
- Fluxo: MCP pede enquadrar N nós; cameraController.fitBounds deve calcular centro e distância correta e voar até enquadrar todos.
- Critério: todos os nós passados estão no campo de visão com margem configurada; distância limitada ao intervalo permitido.

6) Persistência de snapshot durante transições programáticas
- Fluxo: antes de ações automáticas (fly-to por seleção do chat), salvar snapshot; permitir que a restauração ocorra mesmo após animações intermédias.
- Critério: saveCameraSnapshot + restoreCameraSnapshot funcionam independentemente de flyTarget estado intermediário.

Diagnóstico e passos de reprodução (rápido)

1. Reproduzir manualmente:
   - Abrir Neural Core panel com grafo carregado.
   - Executar um comando de busca/seleção via inspector ou executar as chamadas internas de triggerMcpSearchTarget/setSelectedNode.
   - Verificar se a câmera voa para o nó e se restoreCameraSnapshot restaura corretamente.
2. Reproduzir via testes:
   - Criar fixture com 3-5 nós em posições conhecidas.
   - Invocar saveCameraSnapshot(); focusPosition(nodePos); aguardar updateTween até flyTarget null; invocar restoreCameraSnapshot(); assert posição final ≈ snapshot inicial (tolerância pequena).
3. Sinais MCP a investigar:
   - Quais payloads a camada MCP envia quando o chat pede foco (ex: nodeId, pos, autoPause, preferTopView).
   - Sequência de chamadas: salvar snapshot? desabilitar animação global? chamar fitBounds vs focusPosition?

Prompt de correção (template para LLM / revisão assistida)

Use este prompt quando pedir a um LLM (ou agente automatizado) para gerar patch(es) ou instruções de correção no código. Substitua os campos {{...}}.

-------------------- INÍCIO DO PROMPT --------------------
Linguagem: Português técnico. Repositório: ThinkRail (apps/web/src/panels/neural-core).
Objetivo: corrigir comportamento da câmera ao focar/navegar para nós solicitados pelo chat/MCP — o problema atual é perda de enquadramento, restauração inconsistente de snapshots e desseleções acidentais durante arrastes.

Arquivos que interessam: cameraController.ts, neuralEngine.ts, geometry.ts, NeuralCorePanel.tsx e testes em apps/web/src/panels/neural-core/*.test.ts.

Comportamento esperado (resuma brevemente):
- Ao receber um pedido de foco por nodeId (MCP/Chat), a engine deve: 1) saveCameraSnapshot(); 2) calcular posição alvo (usar node.position) e chamar focusPosition(pos, targetDist); 3) durante fly-to, não perder o snapshot; 4) ao comando de restauração, restoreCameraSnapshot() deve retornar true e voar de volta suavemente.
- Cliques/seleções durante arraste devem ser ignorados se wasJustDragging() for true.
- fitBounds deve calcular centro e distância para N posições e aplicar limites mínimos/máximos.

Tarefas concretas a sugerir ao dev/gerar patch:
1. Rever pontos onde triggerMcpSearchTarget, setSelectedNode e focusPosition são chamados para assegurar a ordem: saveCameraSnapshot() antes do fly-to quando o foco é remoto (MCP).
2. Garantir que restoreCameraSnapshot() não seja sobrescrito por setSelectedNode/setHighlightedNode sem um clear explícito.
3. Ajustar thresholds em wasJustDragging() (px e ms) para evitar falsos-positivos/negativos; tornar esses parâmetros configuráveis via constantes exportadas para testes.
4. Adicionar testes unitários para: a) salvar/restaurar snapshot; b) focusPosition + updateTween até conclusão; c) wasJustDragging com arraste simulado.
5. (Opcional) Adicionar logs telemetry/debug (telemetry.activity) ao iniciar e concluir um fly-to para ajudar a diagnosticar condições de corrida.

Regras de implementação e restrições:
- Não introduzir dependências externas.
- Manter API pública de OrbitCameraController (métodos existentes e assinaturas) inalterada.
- Cobrir com testes automatizados; prover um mock de tempo para updateTween (controlar ler de performance.now via injeção ou mock global nos testes).

Exemplo de bugfix (esboço de código) — aplicar cuidadosamente:
- Em NeuralCoreEngine.triggerMcpSearchTarget(nodeId, autoPause):
  """
  // antes de chamar setSelectedNode ou focusPosition
  cameraController.saveCameraSnapshot();
  cameraController.focusPosition(node.position, /*targetDist=*/2.0);
  // não limpar snapshot aqui
  """
- Em OrbitCameraController.restoreCameraSnapshot(): garantir que flyTarget é setado e cameraSnapshot só limpe após restore bem sucedida (como já implementado), mas proteger contra setSelectedNode que chame clearCameraSnapshot() sem checagem.

Entradas MCP recomendadas (para testes automatizados):
- { "method": "neural.focusNode", "params": { "nodeId": "N123", "autoPause": true, "saveSnapshot": true } }
- { "method": "neural.restoreView", "params": {} }

Critérios de aceite (para a correção)

- Manual: Ao pedir foco em X, a câmera centra X e ao restaurar volta à posição anterior com transição suave.
- Unit tests: todos os testes novos passam localmente (bun run test) e cobertura mínima para OrbitCameraController atingida nas áreas alteradas.
- Visual: gravação GIF mostrando fluxo "foco -> inspecionar -> restaurar" sem saltos óbvios.

Como usar este prompt

- Para revisores humanos: copie o texto "Tarefas concretas" para um issue/PR e anexe patches propostos.
- Para um agente LLM: forneça o repositório path, os arquivos citados e peça um diff/patch seguindo as "Regras de implementação".

-------------------- FIM DO PROMPT --------------------

Planilha de verificação rápida (passos seguintes)

- Extrair AST/assinaturas do neural-core (L1) para referenciar símbolos exatos ao pedir patches automáticos.
- Criar fixtures e testes unitários que simulem arraste, foco e restauração.
- Redigir PR com mudanças e anexar mockup/GIF de inspeção visual.

Mapa do plano (corresponde ao TODO list):
- Inspecionar arquivos e reproduzir o bug
- Escrever casos de uso e critérios de aceite (este documento)
- Extrair assinaturas AST (L1)
- Redigir prompt de correção (seção acima)
- Criar documento final em doc/ (arquivo salvo)
- Implementar correção no código
- Adicionar testes e gravar GIF visual
- Reindexar RAG e executar checagens
- Preparar resumo de entrega e abrir PR

Observações finais

Este documento serve como ponto de partida. Se quiser, prossigo gerando automaticamente a lista de assinaturas AST (doc/neuralcore-ast-signatures.json) e criando os testes unitários de exemplo para save/restore e focusPosition.
