# Guia de Compilação e Build: Web, CLI e Desktop (ThinkRail)

Este guia documenta o passo a passo completo, pré-requisitos, comandos e ciclo de vida para compilar as três frentes do **ThinkRail**:
1. **Web UI** (`apps/web`)
2. **CLI & Binário Nativo** (`apps/cli`)
3. **Desktop (Electrobun)** (`apps/desktop`)

---

## 1. Pré-Requisitos e Ambiente

- **Bun**: v1.2+ instalado e no `PATH`
- **Node.js**: v22.19+ (para o runtime compatível do Pi)
- **Sistema Operacional**: Windows x64 (para empacotamento nativo Windows), macOS ou Linux
- **Gerenciador de Monorepo**: Turbo v2.x integrado aos scripts do `package.json` raiz

Antes de qualquer build, certifique-se de que as dependências do monorepo estão instaladas:
```bash
bun install
```

---

## 2. Compilação da Web UI (`apps/web`)

A interface web do ThinkRail é construída com Vite, React 19, Tailwind CSS v4 e Zustand. Seus artefatos compilados servem de base para o servidor local, o binário do CLI e o app Desktop.

### 2.1. Comandos de Build

A partir da raiz do monorepo:
```bash
# Compila apenas os artefatos web para produção (apps/web/dist)
bun run web:build
```

Ou entrando diretamente no diretório do pacote:
```bash
cd apps/web
bun run build
```

### 2.2. Artefatos Gerados
- Diretório de saída: `apps/web/dist/`
  - `index.html`
  - `assets/*.js`, `assets/*.css`
  - Chunks de renderização de código, Monaco editor e Shiki syntax highlighters

### 2.3. Modo de Desenvolvimento (Hot Reload)
```bash
bun run web:dev
```
Abre o Vite Dev Server com suporte a HMR.

---

## 3. Compilação do CLI e Binário Nativo (`apps/cli`)

O ThinkRail CLI pode ser executado diretamente em TypeScript/Bun ou empacotado em um executável autônomo nativo (Single Executable Binary via `bun build --compile`).

### 3.1. Regra de Nomenclatura e Versionamento
Conforme diretriz do projeto, a versão é centralizada em `packages/shared/src/version.ts`.
O build do binário nativo gera:
- `apps/cli/dist/thinkrail.exe` (executável genérico)
- `apps/cli/dist/thinkrail-v<versao>.exe` (executável versionado, ex: `thinkrail-v14.0.2.exe`)

### 3.2. Comandos de Compilação

Para compilar a Web UI + o binário executável CLI em um único fluxo:
```bash
# Executa web:build e compila o binário em apps/cli/dist/
bun run build:binary
```

Para compilar apenas os scripts e tipos do CLI:
```bash
cd apps/cli
bun run build
```

### 3.3. Como o `build:binary` Funciona Internamente
O script `apps/cli/scripts/build-binary.ts` executa:
1. `bun run web:build`: garante que a pasta `apps/web/dist` está atualizada.
2. `bun build --compile`: empacota o ponto de entrada `apps/cli/src/bin.ts` junto com o runtime do servidor e a web UI embutida.
3. Cria cópias sufixadas com a versão e atualiza o manifesto de release se aplicável.

---

## 4. Compilação do Aplicativo Desktop (`apps/desktop`)

O aplicativo desktop utiliza o framework **Electrobun**, integrando o backend host local, o launcher desktop nativo e a Web UI.

### 4.1. Fluxo de Pré-Build (`preBuild.ts`)
Antes de rodar o empacotador do Electrobun, o script `apps/desktop/preBuild.ts`:
- Garante o build do `@thinkrail/web` (`apps/web/dist`).
- Monta o runtime de servidor em `.stage/runtime`.
- Sincroniza extensões, temas e skills necessárias no diretório de empacotamento.

### 4.2. Comandos de Compilação do Desktop

#### A) Build de Desenvolvimento / Pacote Local (Rápido)
Gera os executáveis descompactados para teste e uso local imediato:
```bash
bun run desktop:build
# Ou especificamente:
bun run desktop:package:dev
```
- **Saída**: `apps/desktop/build/dev-win-x64/`
- **Executável**: `apps/desktop/build/dev-win-x64/bin/ThinkRail.exe`

#### B) Build de Release Estável (Empacotamento Completo)
Gera instalador, arquivo compactado e manifesto de atualização:
```bash
bun run desktop:package:stable
```
- **Saídas geradas**:
  - `apps/desktop/build/stable-win-x64/`: Build completo descompactado
  - `apps/desktop/artifacts/`:
    - `win-x64-ThinkRail-Setup.zip`: Pacote compactado para distribuição
    - `stable-win-x64-ThinkRail.tar.zst`: Arquivo zstandard para atualizador automático
    - `stable-win-x64-update.json`: Manifesto de versão e integridade hash

#### C) Build do Canal Canary
```bash
bun run desktop:package:canary
```

#### D) Modo Dev Interativo do Desktop
Para testar alterações no Desktop com auto-reload da janela:
```bash
bun run desktop:dev
```

---

## 5. Resumo Rápido dos Comandos (Cheat Sheet)

| Alvo | Ação | Comando Raiz | Diretório de Saída |
| :--- | :--- | :--- | :--- |
| **Web UI** | Compilar bundle estático | `bun run web:build` | `apps/web/dist/` |
| **Web UI** | Dev server HMR | `bun run web:dev` | `http://localhost:5173` |
| **CLI** | Compilar binário nativo | `bun run build:binary` | `apps/cli/dist/thinkrail-v<ver>.exe` |
| **Desktop** | Build de desenvolvimento | `bun run desktop:build` | `apps/desktop/build/dev-win-x64/` |
| **Desktop** | Build estável + instalador | `bun run desktop:package:stable` | `apps/desktop/artifacts/` |
| **Desktop** | Dev app interativo | `bun run desktop:dev` | Janela nativa Electrobun |
| **RAG** | Reindexar após mudanças | `bun run rag:reindex` | SQLite `~/.hermes/rag/` |

---

## 6. Boas Práticas Pós-Build

1. **Reindexação RAG**: Sempre execute `bun run rag:reindex` após modificar códigos, rotas ou documentações para manter a recuperação de contexto em dia.
2. **Checagem de Tipagem**: Rode `bun run typecheck` antes de finalizar qualquer branch ou release.
3. **Binário Versionado**: Antes de comitar builds de binários, certifique-se de que a versão em `packages/shared/src/version.ts` corresponde à versão descrita no artefato gerado em `apps/cli/dist/`.
