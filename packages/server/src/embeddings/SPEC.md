---
id: submodule-server-embeddings
type: submodule-design
status: active
title: Server local embeddings and Jina daemon lifecycle
parent: module-server
tags: [server, embeddings, jina, rag]
---

## Responsibility

Lifecycle management and health monitoring of the local Jina embeddings server daemon for vector search,
RAG pipelines, and code retrieval operations.

## Public surface

- `startJinaServer()` / `stopJinaServer()`: Boots or terminates the local Jina process daemon on port 8089.
- `isJinaReady()`: Checks availability and health endpoint of the vector embeddings engine.
- `embedTexts()` / `embedQuery()`: Generates dense vector representations for code chunks and natural language queries.

## Boundary

- **Allowed dependencies:** `node:child_process`, `node:http`, `@thinkrail/contracts/jina`, `@thinkrail/shared`.
- **Forbidden reaches:** Web client (`apps/web`) must never access the raw embedding daemon directly; all traffic passes through contracts and RPC.
