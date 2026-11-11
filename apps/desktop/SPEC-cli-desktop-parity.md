---
id: submodule-cli-desktop-parity
type: submodule-design
status: active
title: CLI and Desktop Continuous Parity Invariant
parent: module-desktop
depends-on: [module-desktop, module-cli, module-web]
references: [module-server, module-contracts]
tags: [parity, cli, desktop, build, synchronization]
---

# CLI and Desktop Continuous Parity Invariant

## Responsibility

Defines and strictly enforces the continuous architectural and visual parity between the CLI launcher
(`apps/cli`) and the native Desktop application (`apps/desktop`). Both targets represent different packaging
and hosting envelopes over the exact same core engine (`packages/server`), data wire (`packages/contracts`),
and user interface (`apps/web`).

Under no circumstances may a bug fix, feature addition, visual tuning, camera calibration, or RPC extension
land on one launcher while leaving the other stale, divergent, or unverified.

## Architectural Invariants

1. **Zero UI Divergence (Single Artifact Source)**:
   - Both CLI and Desktop consume the exact compiled static assets from `apps/web/dist`.
   - Any build change to `apps/web` must immediately synchronize with the dev desktop views directory:
     `apps/desktop/build/dev-win-x64/ThinkRail-dev/Resources/app/views/web/`.
   - File hashes of the primary JavaScript bundle (`dist/assets/index-*.js`) must match identically
     between `apps/web/dist` and the desktop view distribution.

2. **Engine and RPC Parity**:
   - Both CLI and Desktop run the in-process `@thinkrail/server` and Hermes RAG runtime.
   - All methods registered in `packages/server/src/host/hermes.ts` and `handlers.ts` must behave
     identically whether invoked from a Chromium/CEF/WebView2 browser window via CLI or the Electrobun shell.

3. **Mandatory Native Binary Recompilation**:
   - Every task that modifies UI code, panel behavior, or server routing must recompile the version-suffixed
     native binary (`apps/cli/dist/thinkrail-v<version>.exe`) and the canonical alias (`apps/cli/dist/thinkrail.exe`)
     via `bun run build:binary`.

4. **Automated Verification Gate (`check:parity`)**:
   - A dedicated verification script (`scripts/check-client-parity.ts`) validates that:
     a) `apps/web/dist` exists and is non-empty.
     b) The desktop view assets are synchronized with `apps/web/dist` (same bundle filenames and hashes).
     c) `apps/cli/dist/thinkrail-v<version>.exe` exists and has a timestamp newer than or equal to `apps/web/dist`.

## Mandatory Checklist for Agents & Workflows

Whenever a plan or TODO list is created for any task touching `apps/web`, `packages/server`, or `apps/desktop`,
the final checklist must include the following continuous parity steps before commit and handoff:

```markdown
- [ ] Compilar bundle web de produção (`bun run build:web`)
- [ ] Sincronizar assets com Desktop (`apps/desktop/build/.../views/web`)
- [ ] Compilar binário CLI versionado e canônico (`bun run build:binary`)
- [ ] Validar paridade automatizada (`bun run check:parity`)
- [ ] Validar visualmente via project-gif no ambiente Desktop e/ou CLI
- [ ] Reindexar o banco Hermes RAG (`scripts/rag-reindex.bat`)
```

## Troubleshooting and Drift Recovery

If divergence is detected by `bun run check:parity`:
1. Execute `bun run build:web`.
2. Replicate `apps/web/dist` into `apps/desktop/build/dev-win-x64/ThinkRail-dev/Resources/app/views/web`.
3. Execute `bun run build:binary`.
4. Run `bun run check:parity` to confirm green status.
