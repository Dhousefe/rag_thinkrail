NeuralCore chunks

This directory contains per-symbol JSON chunks extracted by scripts/neuralcore-extract-chunks.js.

How the chunks were generated
- Run: node scripts/neuralcore-extract-chunks.js
- Output: one JSON file per chunk (id.json) plus index.json summarizing files and counts.

Next steps
- Review token_estimate and adjust clipping for very large file-level chunks.
- Add comment extraction for non-code files (README.md) and tests for chunk coverage.
