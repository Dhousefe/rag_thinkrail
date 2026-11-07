---
id: module-ci-release
type: module-design
status: active
title: CI and release automation scripts
parent: architecture
tags: [ci, release, scripts]
---

## Responsibility

Automation scripts and workflows for continuous integration, package verification, version bumping,
artifact builds, and release packaging across ThinkRail.

## Public surface

- Build scripts under `scripts/` consumed by GitHub Actions workflows and local verification harnesses.
- Release orchestration and packaging targets for desktop and CLI distributions.

## Boundary

- **Allowed dependencies:** Node / Bun built-in modules, root catalog tooling.
- **Forbidden reaches:** Product code in `apps/web` or `packages/server` must never depend on CI scripts.
