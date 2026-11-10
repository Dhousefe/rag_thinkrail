NeuralCore — Dependências e Licenças (inventário inicial)

Local: apps/web/src/panels/neural-core

Dependências diretas (referências no monorepo workspace)
- @thinkrail/contracts (workspace dependency used for Hermes types: HermesVectorNode, HermesChunkItem)
- @thinkrail/ui (UI primitives used across components)
- @remixicon/react (icons)
- Web APIs: WebGPU (navigator.gpu) — runtime browser feature, fallback Canvas2D

Dependências do pacote (resumo via root package.json workspace catalog)
- react, react-dom (frontend)
- typescript (dev)
- bun tooling / scripts

Licenças
- Monorepo: follow individual package licenses; workspace packages under `packages/*` use repo-owned licenses. Check each package's package.json for "license" field for exact text.

Como verificar
- bun run check:deps  → verifica catálogos e consistência de dependências
- Inspecionar packages/* package.json e apps/* package.json para campos license

Notas
- NeuralCore não adiciona novas dependências externas fora das já presentes no web app.
- A integração com Hermes usa transport RPCs e contratos do pacote @thinkrail/contracts, que é local neste monorepo.
