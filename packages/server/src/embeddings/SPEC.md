---
id: submodule-server-embeddings
type: submodule-design
status: active
title: Server local embeddings and Jina daemon lifecycle
parent: module-server
tags: [server, embeddings, jina, rag]
---

## Responsibility

Lifecycle management, fault tolerance, and health monitoring of the local Jina embeddings server daemon for vector search,
RAG pipelines, and code retrieval operations.

## Architecture and Ports

- **Port:** Defaults to `9085` (`http://127.0.0.1:9085`).
- **Model:** `jina-embeddings-v2-base-code` (768 dimensions with L2 normalization).
- **Environment Discovery:** Discovers Python venvs with priority in `D:/Projeto_Germes/hermes-3.0` (`jina-env`), `HERMES_HOME`, and local repository fallbacks.
- **Heartbeat & Resiliency:** Health endpoint `/health` polled at 5,000ms intervals with a 3,500ms tolerant timeout. Auto-heal triggers exclusively after 3 consecutive failures to prevent false negatives during heavy tensor inference.
- **Process Termination:** Windows process tree termination uses `taskkill /PID <PID> /T /F` to prevent orphan Uvicorn/Torch workers.

## Public surface

- `JinaServerManager.getInstance()`: Returns the singleton instance for lifecycle management.
- `getInfo()`: Reports status, port, uptime, latencies, GPU acceleration and engine metadata.
- `start()` / `stop()` / `restart()`: Controls daemon process lifecycle.
- `testIntegrity()`: Generates 768d sample vector to validate L2 normalization and roundtrip latency.

## Boundary

- **Allowed dependencies:** `node:child_process`, `node:fs`, `node:os`, `node:path`, `@thinkrail/contracts`, `@thinkrail/shared`.
- **Forbidden reaches:** Web client (`apps/web`) must never access the raw embedding daemon directly; all traffic passes through contracts and RPC.
