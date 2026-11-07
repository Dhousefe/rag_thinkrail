---
id: submodule-server-craft
type: submodule-design
status: active
title: Server craft engine, tool registry and execution host
parent: module-server
tags: [server, craft, tools, code-generation]
---

## Responsibility

The server-side execution engine, tool registry, and WebSocket RPC handlers for the ThinkRail Craft
subsystem, providing structured code generation, asset manipulation, and automated crafting pipelines.

## Public surface

- `createCraftEngine()`: Initializes the isolated craft runtime and execution context.
- `registerCraftTools()`: Registers extensible craft capabilities and executors.
- `handleCraftRpc()`: Routes wire RPC requests from `@thinkrail/contracts/craft` to local engine instances.

## Boundary

- **Allowed dependencies:** `@thinkrail/contracts/craft`, `@thinkrail/shared`, `@thinkrail/locales`.
- **Forbidden reaches:** Direct browser DOM rendering, UI store mutations, or unversioned wire mutations.
