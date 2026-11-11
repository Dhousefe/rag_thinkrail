# Documento de Intervenção Técnica: Câmera e Foco do Neural Core (Chat & MCP)

## 1. Visão Geral e Diagnóstico

Este documento consolida o diagnóstico técnico, critérios de aceitação e as correções aplicadas no subsistema da câmera do Neural Core (`OrbitCameraController`), em seu ciclo de integração com o painel React (`NeuralCorePanel.tsx`) e nas chamadas disparadas pelo Chat e MCP.

### Sintomas Resolvidos:
1. **Perda da Pose Panorâmica Original (Sobrescrita de Snapshots)**: Quando o Chat ou MCP navegavam por múltiplos arquivos/classes sucessivamente, snapshots anteriores eram sobrescritos ou perdidos, impedindo que o comando de "Restaurar Câmera" retornasse ao enquadramento global inicial do usuário.
2. **Foco Bloqueado quando Pausado na Busca**: Na busca por query/MCP em tempo real, o fly-to de centralização da câmera só era ativado se `!isPaused`, ignorando solicitações legítimas quando a cena estava pausada para inspeção estática.
3. **Desseleção Inadvertida por Arraste Rápido**: O controle de arraste do ponteiro e cliques no canvas possuíam valores fixos dispersos e não padronizados, causando desseleção acidental de nós após rotações orbitais ou pans rápidos.
4. **Falta de Idempotência e Testabilidade**: A API de `wasJustDragging()` e `saveCameraSnapshot()` não expunha constantes de tolerância para testes e não permitia preservar o snapshot existente (`overwrite: false`).

---

## 2. Assinaturas AST e Interfaces (L1)

### `OrbitCameraController` (`apps/web/src/panels/neural-core/cameraController.ts`)

```typescript
export const DEFAULT_DRAG_THRESHOLD_PX = 4;
export const DEFAULT_DRAG_TIME_THRESHOLD_MS = 250;

export interface CameraPoseSnapshot {
  targetX: number;
  targetY: number;
  targetZ: number;
  theta: number;
  phi: number;
  distance: number;
}

export class OrbitCameraController {
  // Estado público da pose
  public theta: number;
  public phi: number;
  public distance: number;
  public target: [number, number, number];

  // Gestão de Snapshots
  public saveCameraSnapshot(overwrite?: boolean): void;
  public restoreCameraSnapshot(): boolean;
  public clearCameraSnapshot(): void;
  public hasCameraSnapshot(): boolean;
  public isFlying(): boolean;

  // Navegação e Enquadramento
  public focusPosition(pos: [number, number, number], targetDist?: number): void;
  public fitBounds(positions: Array<[number, number, number]>, margin?: number): void;
  public reset(): void;
  public panBy(deltaX: number, deltaY: number): void;
  public updateTween(): void;
  public wasJustDragging(thresholdMs?: number, thresholdPx?: number): boolean;
}
```

---

## 3. Detalhamento das Alterações Implementadas

### A. Blindagem e Idempotência de Snapshots (`cameraController.ts`)
- Adicionada opção `saveCameraSnapshot(overwrite = false)`: se já existir um snapshot ativo (ou restauração pendente) e `overwrite` for `false`, a pose inicial é preservada intacta.
- Adicionados helpers `hasCameraSnapshot()` e `isFlying()`.
- Constantes exportadas: `DEFAULT_DRAG_THRESHOLD_PX = 4` e `DEFAULT_DRAG_TIME_THRESHOLD_MS = 250`.
- Suporte a parametrização em `wasJustDragging(thresholdMs?, thresholdPx?)`.

### B. Integração com Chat & MCP (`NeuralCorePanel.tsx`)
- **Foco por Busca RAG (`effectiveQuery`)**: Agora salva o snapshot inicial via `saveCameraSnapshot(false)` e centraliza no nó correspondente mesmo quando a cena estiver pausada (`isPaused`).
- **Foco por Ferramentas do Chat (`activeChatFilePath` / `activeChatTool`)**: Salva o snapshot panorâmico antes de acionar `focusPosition()`, garantindo que o usuário consiga restaurar a visão anterior ao fechar ou desselecionar o nó.
- **Proteção Unificada contra Desseleção no Canvas**: `handlePointerUp` e `handlePointerMove` adotam estritamente `DEFAULT_DRAG_THRESHOLD_PX` em sintonia com `wasJustDragging()`.

---

## 4. Verificação e Testes Automatizados

A suíte de testes unitários foi expandida em `apps/web/src/panels/neural-core/cameraController.test.ts`:
1. `identifica quando houve arraste da câmera (wasJustDragging)`: valida detecção em tempo real e na janela de tempo após `mouseup`.
2. `calcula fitBounds estável com múltiplos nós sem NaN`: garante centro e distância seguros dentro do intervalo permitido.
3. `salva e restaura suavemente snapshot de pose de câmera com tween`: testa o ciclo completo de `saveCameraSnapshot() -> focusPosition() -> updateTween() -> restoreCameraSnapshot() -> updateTween()`.
4. `preserva snapshot original quando saveCameraSnapshot é chamado com overwrite=false`: assegura retenção da pose original inicial após múltiplos focos subsequentes.
5. `clearCameraSnapshot limpa os snapshots pendentes e salvos`: valida retorno a estado neutro sem vazamento de snapshots.

---

## 5. Status de Conformidade do Repositório

- **Unit tests**: `bun test apps/web/src/panels/neural-core/cameraController.test.ts` (5 pass, 0 fail).
- **TypeScript**: `bun tsc --noEmit -p apps/web/tsconfig.json` (0 erros).
- **Formatador**: `biome format` aplicado aos arquivos modificados.
- **Hermes RAG**: Reindexação incremental concluída (`bun run rag:reindex`).
- **Golden Dataset**: Descoberta técnica gravada com sucesso (`tc_30_web-ui_orbitcameracontroller`).
- **Task Spec**: Documentado em `.thinkrail/context/TASK-neural-core-camera-focus-fix.md`.
