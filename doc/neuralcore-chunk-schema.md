NeuralCore chunk schema (v1)

Fields:
- id: string (sha256 of "neuralcore|<relPath>|<symbol>|<start>|<end>")
- file: string (repo-relative path)
- path: string (same as file)
- kind: string (file|function|class|method|variable)
- name: string (symbol name or file basename)
- start_line: number
- end_line: number
- content: string (snippet with context)
- token_estimate: number (rough tokens estimate)
- created_at: epoch ms
- provenance:
  - commit: af2650f
  - branch: feature/neural-core
  - generator: scripts/neuralcore-extract-chunks.js

Notes:
- Chunks are saved under doc/neuralcore-chunks/*.json and an index at doc/neuralcore-chunks/index.json
- This schema is intentionally minimal to be extended with embeddings, language model metadata, or RAG-specific fields when needed.
