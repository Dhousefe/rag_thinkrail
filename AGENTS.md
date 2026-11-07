# ThinkRail

The agentic IDE that gets better every time you use it, built around the `pi` coding agent. The app is
a thin host that runs `pi` and bridges it to a rich UI; `pi` owns models, skills, compaction, cost, and
session state.

## Read context proportionally

- Use `goal-and-requirements.md` for the product's goal, principles, capabilities, and non-goals.
- Use `architecture.md` for system topology, cross-module decisions, and repo-wide invariants.
- For a pi upgrade or a host workaround around pi, read `pi-compatibility.md`: verify every applicable
  removal gate against the installed SDK, update the registry, and report what was removed or retained.
- Read the owning `SPEC.md` when work is governed by or may alter a module boundary, contract,
  invariant, documented behavior, or architecture decision.
- Localized work does not require unrelated specs or a full repository map.

## Module structure and boundaries

Clear, fractal module boundaries are a top-priority requirement:

- Every package and meaningful directory-level sub-module has a `SPEC.md` stating its responsibility,
  public surface, allowed dependencies, and forbidden reaches.
- A sub-module exposes an `index.ts` barrel as its only public surface; siblings import through the
  barrel, never internals. Per-file imports remain only where a barrel would defeat code-splitting or a
  library convention, such as `apps/web/src/panels` and `packages/ui`.
- Dependency edges between sibling sub-modules live in the parent module's `SPEC.md`, not each leaf.
- A change that moves or blurs a boundary updates the owning spec first. Cover public surfaces and
  boundary rules with tests where practical, but do not manufacture coverage for a localized change.

## Engine and architecture

- Run `pi` in-process through `@earendil-works/pi-coding-agent` (`createAgentSession`), never as a
  subprocess and never through a second agent runtime. Fatal provider/agent faults can take down the
  host; that lack of crash isolation is accepted.
- The three rings are engine host (`packages/server` + `packages/shared`), typed wire
  (`packages/contracts`), and independently shippable UI (`apps/web`). `apps/cli` and `apps/desktop`
  are thin launchers over the same host.
- Use only the `@earendil-works/*` package scope. `@mariozechner/*` is deprecated.

## Repo-wide invariants

- `apps/web` depends on `contracts`, `locales`, `ui`, `extension-api/web`, `resource-renderers`, and
  `thinkrail-extensions/*/web` only, never `server` or `shared`.
- User-facing UI text is a key in `packages/locales/en.json` rendered through `@thinkrail/locales/react`;
  the lint gate rejects hardcoded JSX text and text attributes.
- Never value-import `pi` into browser-bundled code. Import types only from the `pi-ai` /
  `pi-agent-core` package roots; `@earendil-works/pi-coding-agent` is server-only.
- One id model: UI tab id versus `session.sessionId`; there is no separate pi UUID.
- `pi` owns state. The host exposes what pi reports rather than recomputing cost, stats, or state.
- Streaming semantics: `text_delta` / `thinking_delta` append;
  `tool_execution_update.partialResult` replaces.
- `prompt()` throws while a session is streaming; use `steer()` / `followUp()`. Forward errors through
  the event stream and thrown method result rather than treating them as a crash signal.
- Automatic work ends at `agent_settled`, never `agent_end`; retries, compaction, recovery, or queued
  continuations may follow an attempt-level `agent_end`.
- UI panels are layout-agnostic; the shell arranges them.
- Errors are reported to PostHog Error Tracking unconditionally, but only as a classifier — type, `code`,
  source/scope/request method and ThinkRail-only stack frames — never `message` text. Give a failure worth
  telling apart a `CodedError` code rather than relying on its message. Host diagnostics that carry an
  error go through `logger(scope)`, not `console.*`. The allow-list lives in
  `packages/server/src/analytics/SPEC.md`.
- The transport host endpoint is a parameter, defaulting to same-origin; `server.welcome` carries the
  protocol version.

### Web UI context

For web UI work, read `apps/web/SPEC.md` and the owning sub-module spec. Styling uses Tailwind v4
utilities mapped to generated semantic CSS-var tokens: never inline style objects, raw hex, internal
palette names, or unknown token utilities. Read `apps/web/src/styles/COLOR.md` for color work and
`apps/web/src/styles/SPACING.md` for spacing work. Use `@remixicon/react` icons (Line by default, Fill
when active) and owned shadcn/Radix primitives from `@thinkrail/ui/<primitive>`; `cn()` lives in
`@thinkrail/ui/utils`. These rules also apply to `packages/ui`, `packages/resource-renderers`, and extension
web halves.

For conversation rendering or tool presentation, read `apps/web/src/chat/SPEC.md`. Presentational
renderers remain props-driven; only `ChatView` integrates store and transport. A server capability and
its UI renderer are joined by tool name through `registerToolRenderer`; unregistered tools use the
default renderer.

## Specs and comments

Specs are the durable home for intent, decisions, invariants, trade-offs, and post-mortems. Keep them
concise and avoid restating code or another spec. Comments are near-zero: lint/type directives and a
rare one-line hazard note are acceptable; rationale and narrative belong in the owning spec.

## Verification

Local tests use disposable fixtures and have no production access. Run affected tests, fix failures
caused by the requested change, and rerun them without asking for approval at each step.

- Iterate with the smallest relevant unit or focused E2E target.
- For shipped app behavior or integration changes, run the complete no-agent browser suite
  (`bun run e2e`) once after the combined implementation and before final handoff or PR — not once per
  TODO item or commit.
- When the change touches real agent behavior, also run the focused live specs that cover it, e.g.
  `bun run e2e:full e2e/agent-naming.live.spec.ts`; that needs no approval. Ask the user before running
  the complete `bun run e2e:full` suite: it spends real provider tokens and much more time.
- Documentation/spec-only changes and test-harness-only changes use targeted checks unless they can
  affect the shipped runtime.
- Fast gates: `bun run check:deps`, `bun run check:boundaries`, `bun run check:seams`, `bun run lint`,
  and `bun run typecheck`. Unit tests are `bun run test`; `bun run check:spec-surface` validates enrolled
  spec/barrel public surfaces; `bun run check:compiler` fails when a web function newly bails out of the
  React Compiler (or starts compiling) against the committed census baseline.
- `bun run test:workflows` is on-demand: it uses real provider tokens and is not a commit/CI gate.
- Binary and desktop artifact modes have separate gates; use them when changing those artifacts.

All runner modes, isolation guarantees, credential handling, cancellation behavior, and debugging
commands live in `e2e/SPEC.md`; workflow harness details live in `e2e/workflows/SPEC.md`.

## Handoff hygiene

Green gates are necessary but not sufficient:

- Before a local handoff, review the task-scoped working tree and commits. Before opening or updating a
  PR, review the full branch diff against its base plus the working tree.
- For nontrivial implementation, do a subtraction pass: remove avoidable abstractions, state owners,
  dependencies, compatibility layers, and fallbacks. Report material removals and justify layers that
  remain; do not add ceremony for a localized edit.
- Never add `biome-ignore`, `@ts-expect-error`, `@ts-ignore`, `eslint-disable`, or `as any` merely to make
  a gate pass. Treat the error as a design signal. If a suppression is genuinely required, get explicit
  user approval first.
- Audit newly added comments and suppressions in the same diff range being reviewed. Do not let prior,
  unrelated branch history contaminate a task-local handoff.
- Centralize duplicated nontrivial derivations. In the web app, derived store state belongs in
  selectors and writes that always travel together belong in one atomic action.
- When replacing a pattern or state model, search for every old occurrence and migrate it, or name the
  intentional survivors.
- `README.md` is the user-facing front page. For a change that adds, removes, or renames a user-visible
  capability, or alters installation or analytics behavior, review its claims and update the affected
  ones in the same change; refresh a screenshot under `.github/readme-assets/` when the UI it depicts
  changes materially.
- Apply safe cleanup that is inside the approved scope. Ask only for destructive, out-of-scope, or
  product-level decisions.
- Use the `shipping-a-pr` skill for PR lifecycle work, including screenshot expectations and PR
  templates. When creating an issue programmatically, reproduce the selected issue template and pass
  its frontmatter labels.

## Stack

Bun + Turbo monorepo · TypeScript strict · React 19 + Zustand + Tailwind v4 · in-process `pi`
(Node >= 22.19). App state lives under `~/.thinkrail`.

Dependencies pin exact versions. Cross-cutting dependencies are pinned once in the root
`workspaces.catalog` and referenced through `catalog:`; peer dependencies and local protocols are the
only exemptions. `architecture.md` Decision #10 owns the rationale.

## Protocolo RAG Progressivo L0 -> L1 -> L2 (Contenção Estrita de Tokens)

- **REGRA MANDATÓRIA DE EFICIÊNCIA DE CONTEXTO**: O agente e subagentes são estritamente proibidos de realizar leituras cegas (`read` de arquivos inteiros sem offset/limit), dumps maciços de código no prompt ou buscas vetoriais genéricas sem escopo de cluster. Todo fluxo de investigação deve seguir obrigatoriamente a árvore de navegação progressiva:

```
[L0: Índice Global < 250 tokens] ➔ [L1: Assinaturas/AST 300-800 tokens] ➔ [L2: Código Cirúrgico < 600 tokens]
```

### Ordem Obrigatória do Pipeline:
1. **Camada L0 (Visão Macro / Clusters — Custo: < 250 tokens)**:
   - **Ferramenta**: `mcp__hermes_rag__get_project_l0_index(project?)`
   - **Objetivo**: Identificar qual Super-Nó/Cluster do grafo contém a funcionalidade ou arquivo desejado (ex: `contracts`, `web-ui`, `server-engine`, `renderers`, etc.).
   - **Regra**: Nunca pular o L0 para adivinhar diretórios. O L0 orienta o agente sobre onde a funcionalidade realmente reside com zero desperdício.

2. **Camada L1 (Clusters e Sub-grafos — Custo: 300 a 800 tokens)**:
   - **Ferramentas**: `mcp__hermes_rag__expand_graph_node(cluster_id)` ou `mcp__hermes_rag__ast_skeleton_tree(target_path)` e `ast_predict_context(target)`.
   - **Objetivo**: Inspecionar contratos, interfaces, métodos públicos, assinaturas e dependências (callers/callees) SEM carregar corpos de implementação.
   - **Regra**: O modelo compreende a arquitetura e localiza o símbolo exato sem poluir a janela de contexto com lógica interna.

3. **Camada L2 (Recuperação Cirúrgica — Custo: < 600 tokens)**:
   - **Ferramentas**: `mcp__hermes_rag__code_search(query, limit, cluster_id)` ou `read(path, offset, limit)`.
   - **Objetivo**: Trazer apenas os 1 ou 2 blocos de código específicos e necessários para resolver o bug ou implementar a feature.
   - **Regra**: O parâmetro `cluster_id` é obrigatório no `code_search` para restringir a busca ao domínio validado em L0/L1, bloqueando recuperação cruzada de arquivos não relacionados de outros projetos do Hermes.

- **Multi-Projeto Automático**: O Hermes RAG opera com fusão recíproca (RRF) em múltiplos bancos SQLite ativos configurados em `~/.hermes/active_projects.json`.
- **REGRA MANDATÓRIA DE RAG SEMPRE QUENTE (Reindexação Pós-Trabalho)**: Ao concluir qualquer alteração de código, adição ou edição de arquivos (`.ts`, `.tsx`, `.md`, `.json`, etc.), o agente ou subagente DEVE OBRIGATORIAMENTE disparar a sincronização incremental do banco RAG executando:
  ```bash
  bun run rag:reindex
  ```
  Isso garante que novos símbolos, arquivos e specs sejam imediatamente absorvidos no SQLite (`l2j_chunks` e `l2j_chunk_fts`), mantendo o índice sempre aquecido para as próximas mensagens, tarefas e buscas sem lacunas de conhecimento. Em tarefas com múltiplos passos no TODO list, inclua a reindexação no checklist final antes da entrega.

## Gravação de Descobertas Técnicas no Golden Dataset (Curadoria Contínua)

- **REGRA MANDATÓRIA DE RETENÇÃO DE CONHECIMENTO**: Ao finalizar qualquer tarefa técnica substantiva (resolução de bugs em módulos desconhecidos, criação de novas rotas, introdução de contratos ou refatoração estrutural), o agente deve OBRIGATORIAMENTE persistir a descoberta no Golden Dataset do repositório.
- **Como Registrar**:
  - Executar: `bun scripts/record-rag-discovery.ts --question "<pergunta_técnica>" --query "<termos_chave>" --cluster "<cluster_id>" --files "<arquivos_relevantes>" --symbols "<simbolos_chave>" --ground-truth "<resposta_objetiva>"`
  - Isso garante que a base de testes nunca sofra regressão, retroalimentando o comparador de benchmarks para as próximas execuções.
- **Validação de Regressão**: Se houver alterações na engine do Hermes ou reindexação profunda de tabelas, execute `bun scripts/rag-benchmark-suite.ts` para atestar que o Hit Rate (>=80%) e Precision (>=65%) permanecem estáveis.

## Validação Visual Obrigatória com IA Multimodal (Project-GIF Core)

- **REGRA MANDATÓRIA ANTI-ESCURECIMENTO DE UI**: Qualquer modificação, criação ou refatoração de componentes visuais, telas, painéis, CSS/Tailwind ou mockups HTML NUNCA deve ser finalizada às cegas ou apenas com unit tests.
- **Ciclo de Inspeção Visual Real**:
  1. Renderizar/montar o componente ou mockup em `.thinkrail/context/mockups/<nome>.html` ou na UI ativa.
  2. Disparar a gravação dinâmica de tela em GIF via `bun scripts/record-ui-gif.ts` (ou `--mockup <path>`). O motor quantiza a 128 cores com `Dither.NONE`, gerando arquivos compactos (< 500 KB) e nítidos a 15 FPS.
  3. Chamar a ferramenta nativa `read(path_do_gif)`: o harness Pi anexa os quadros do GIF diretamente ao contexto da mensagem para o provider (IA multimodal).
  4. O provider avalia os frames visuais (espaçamento, cores, hierarquia, quebras de linha e estados interativos) e atesta a qualidade antes da conclusão da tarefa.
  5. Em todo TODO list envolvendo UI, o último passo obrigatoriamente inclui a montagem do ambiente de teste e o envio do GIF real ao provider.


