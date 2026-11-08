# ThinkRail

[![Projeto Incubadora JetBrains](https://jb.gg/badges/incubator-plastic.svg)](https://confluence.jetbrains.com/display/ALL/JetBrains+on+GitHub)
[![GitHub stars](https://img.shields.io/github/stars/JetBrains/thinkrail?style=social)](https://star-history.com/#JetBrains/thinkrail&Date)
[![Discord](https://img.shields.io/badge/Discord-Entrar%20no%20chat-5865F2?logo=discord&logoColor=white)](https://thinkrail.ai/discord)
[![Versão](https://img.shields.io/badge/version-14.0.2-blue.svg)](packages/shared/src/version.ts)
[![Engine](https://img.shields.io/badge/engine-pi--coding--agent-orange.svg)](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)

O **ThinkRail** é a IDE agêntica de nova geração que evolui a cada uso — aprendendo a arquitetura do seu projeto através de especificações vivas (*living specs*), inspecionando código e interfaces visualmente com IA multimodal e sintetizando suas próprias ferramentas de forma autônoma.

Construído sobre o motor do agente [`pi`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) rodando em processo, o ThinkRail isola cada fluxo em *worktrees* Git independentes, conecta-se a bases de código gigantescas via **Hermes Code RAG Multi-Projeto** e dispõe de um ecossistema completo de **Agent Skills com Auto-Scaffolding em 1-clique**.

**Website:** [thinkrail.ai](https://thinkrail.ai/) · **Blog:** [thinkrail.ai/blog](https://thinkrail.ai/blog/) ·
**Discord:** [thinkrail.ai/discord](https://thinkrail.ai/discord)

⭐ Se você considera o ThinkRail útil, deixe uma estrela — isso ajuda outros desenvolvedores a descobrirem o projeto.

<p align="center">
 <a href="https://www.star-history.com/jetbrains/thinkrail">
  <picture><source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=JetBrains/thinkrail&type=rank&theme=dark" /><source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=JetBrains/thinkrail&type=rank" /></picture> <picture><source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=JetBrains/thinkrail&type=trending&theme=dark" /><source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=JetBrains/thinkrail&type=trending" /><img alt="Repositório em Tendência no GitHub" src="https://api.star-history.com/badge?repo=JetBrains/thinkrail&type=trending" /></picture>
 </a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/readme-assets/workbench-dark.png">
  <img src=".github/readme-assets/workbench-light.png" alt="Workbench do ThinkRail: painel de Projetos ao lado do trilho de ferramentas à esquerda com workspaces e gaveta Settled, conversa com pi no centro e diff de alterações, árvore de especificações Specs e lista de modificações à direita" width="900">
</picture>

*Uma sessão do `pi` e a alteração produzida, delimitada a um workspace isolado por git worktree.*

---

## 🗺️ Mapa de Conhecimento do Ecossistema ThinkRail

```mermaid
mindmap
  root((ThinkRail Ecosystem))
    Arquitetura de Anéis
      Engine Host - packages/server e shared
      Typed Wire - packages/contracts
      Web UI - apps/web React 19
      Launchers - apps/cli e apps/desktop
    Isolamento e Git
      Workspaces independentes
      Git Worktrees dedicadas
      Shelf de Workspaces inativos
      Commits atomicos por tarefa
    Hermes Code RAG Multi-Projeto
      L0 Macro Clusters - menos de 250 tokens
      L1 AST e Skeleton - 300 a 800 tokens
      L2 Chunks Cirurgicos - menos de 600 tokens
      RRF FTS5 mais AST mais Embeddings
      Hot Reindex incremental em 4ms
    Neural Core 3D
      WebGL e WebGPU Hardware Accelerated
      Micro-estratificacao PCB e Vias 90 e 45 graus
      Multi-Project Chip Dies isolados
      Pulsos luminosos de dependencia
      Graphify labels inteligentes
    Auto-Scaffolding de Skills
      Busca Global de Skills find_skills
      Git Clone Shallow em um clique
      Detecao de Stack e sintese de SKILL.md
      Monaco Editor integrado
    Qualidade e Seguranca Visual
      Project-GIF Core 15fps e 128 cores
      Validacao Multimodal com read de GIF
      Fast Gates lint types boundaries
      Golden Dataset e Curadoria Continua
```

---

## ⚡ Os Superpoderes do ThinkRail

### 1. Workspaces Totalmente Isolados com Git Worktrees
Abra qualquer repositório Git como projeto e derive múltiplos workspaces simultâneos como `git worktree`s independentes. Cada workspace possui sua própria branch, histórico e diretório físico. Os agentes realizam refatorações e testes massivos em paralelo sem interferir no seu checkout principal; mescle a branch validada e descarte o restante com um único clique. Workspaces inativos são preservados na gaveta (*shelf*) e restaurados instantaneamente sob demanda.

### 2. Hub de Skills & Auto-Scaffolding em 1-Clique (Hermes Skills Engine)
O ThinkRail transforma qualquer repositório aberto do GitHub em uma ferramenta utilizável pelo agente:
- **Busca Global Comunitária (`find_skills`):** Localize instantaneamente skills e repositórios populares por estrelas e relevância direto pelo chat ou pela aba lateral.
- **Auto-Scaffolding Inteligente:** Repositórios sem formato de skill pré-existente são inspecionados automaticamente: o ThinkRail lê a documentação, detecta a stack tecnológica (Python, Node/Bun/TypeScript, Rust ou CLI genérica) e **sintetiza um `SKILL.md` operacional completo na hora**, pronto para uso pelo agente.
- **Interface Transparente:** Visualize o nome da pasta física da skill e abra o arquivo `SKILL.md` no editor do Monaco com um clique.

### 3. Validação Visual Obrigatória com IA Multimodal (Project-GIF Core)
Diga adeus a telas desenvolvidas às cegas:
- **Motor Headless Integrado:** Grava animações em GIF de alta performance (< 500 KB, 15 FPS, quantização em 128 cores com `Dither.NONE`) de componentes web, páginas ativas e mockups em `.thinkrail/context/mockups/`.
- **Inspeção Multimodal pelo Agente:** O agente inspeciona os quadros do GIF via `read()`, avaliando espaçamento, contraste, hierarquia visual e comportamento responsivo antes de finalizar qualquer entrega de UI.

### 4. Hermes Code RAG Nativo & Multi-Projeto
Mecanismo de alta performance para indexação incremental e busca de código híbrida (**AST + FTS5 + Embeddings Vetoriais**):
- **Alimentado por SQLite e Binário Nativo:** Execução em milissegundos com busca concorrente e fusão de ranqueamento recíproco (**RRF**) em múltiplos projetos ativos simultaneamente (`~/.hermes/projects`).
- **Invalidação Cirúrgica:** Ignora arquivos inalterados por hash SHA-256 e `mtime_ms` em apenas **4 milissegundos**, sincronizando bancos através de git hooks pós-commit.
- **Barra de Progresso em Tempo Real:** Acompanhe a varredura e o status de indexação diretamente na barra superior do workbench.

### 5. Neural Core 3D & Arquitetura PCB com Chip Dies
Um visualizador de contexto arquitetural acelerado por **WebGL / WebGPU 3D**:
- **Layout PCB Micro-Estratificado:** Posiciona módulos em plano de circuito impresso com folga anti-colisão e conexões ortogonais/Manhattan (90° e 45°) simulando trilhas e vias reais sem transfixar nós adjacentes.
- **Pulsos Dinâmicos de Dependência:** As conexões ativas entre símbolos e arquivos pulsam em tempo real, rastreando ferramentas invocadas no chat (`read`, `edit`, `write`, `ast_*`, `code_search`).
- **Isolamento de Chip Dies Multi-Projeto:** Projetos indexados no Hermes RAG são dispostos em ilhas (dies) independentes com offsets espaciais próprios no plano XZ.
- **Destaque Poligonal & Conexões Temáticas:** Destaque visual volumétrico das relações entre símbolos, classes e métodos com coloração adaptada ao tema ativo.
- **Visualizador de Chunks & Busca Integrada:** Modal com visualização cirúrgica de chunks de código, contagem de tokens, overview do nó e busca rápida com filtros.
- **HUD Interativo & Navegação Zenital:** Botões de pan direcional, alternância de perspectiva orbital para visão zenital (topo da PCB) e toggle para ocultação da barra de detalhes.

### 6. Plan Rail & Governança de Tarefas com Commits Granulares
- **TODO Integrado:** O agente mantém um plano visível no painel lateral com etapas acionáveis (`pending`, `in_progress`, `done`).
- **Commits Semânticos Passo a Passo:** Cada tarefa concluída no plano é commitada individualmente com mensagens no padrão do seu repositório.
- **Promoção Atômica de Notas:** Transforme ideias e anotações soltas em tarefas estruturadas sem perda de contexto.

### 7. Especificações como Fonte da Verdade (Living Specs)
O ThinkRail utiliza um grafo conectado de arquivos `SPEC.md` que residem junto com o código. As ferramentas dedicadas `spec_*` garantem que decisões arquiteturais, limites de módulos e contratos técnicos sejam respeitados e sobrevivam ao encerramento da conversa.

### 8. Flexibilidade Total de Provedores e Modelos
- Suporte a [JetBrains AI](https://www.jetbrains.com/ai/), OpenAI, Anthropic, Opus 4.8 / 3.5, Ollama, OpenRouter e servidores locais personalizados (LiteLLM, vLLM, LM Studio, llama.cpp).
- Descoberta automática de modelos servidos localmente com mapeamento de capacidades em tempo de execução.

---

## 🏗️ Arquitetura dos Pacotes do Monorepo

O ThinkRail é estruturado como um monorepo Turbo + Bun com separação rígida de camadas e contratos:

```mermaid
graph TD
    subgraph ThinkRail_Monorepo [ThinkRail Monorepo Turbo & Bun]
        subgraph Apps [Camada de Apresentacao & Binarios]
            WebUI["apps/web (React 19 + Tailwind v4 + WebGL/WebGPU)"]
            DesktopApp["apps/desktop (Empacotamento Nativo Electrobun)"]
            CliHost["apps/cli (thinkrail.exe & hermes-mcp-server)"]
        end

        subgraph Core_Packages [Nucleo Compartilhado & Engine Host]
            Contracts["packages/contracts (DTOs e Interfaces Tipadas)"]
            Server["packages/server (Host In-Process do Pi Coding Agent)"]
            Shared["packages/shared (Versao, Logging, Utilitarios)"]
            UIPrimitives["packages/ui (Design System Radix & Tailwind)"]
            Locales["packages/locales (i18n PT-BR, EN, ES, JA, etc.)"]
            Renderers["packages/renderers (Visualizadores Ricos de Ferramentas)"]
        end
    end

    subgraph External_Runtime [Runtime do Agente & Conexoes Locais]
        PiAgent["@earendil-works/pi-coding-agent"]
        HermesRAG[("Hermes SQLite RAG Multi-Projeto")]
        GitWorktrees["Git Worktrees Isoladas por Workspace"]
        VisualTester["Project-GIF Core (Validacao Multimodal)"]
    end

    WebUI --> Contracts
    WebUI --> UIPrimitives
    WebUI --> Locales
    WebUI --> Renderers
    DesktopApp --> WebUI
    CliHost --> Server
    Server --> Contracts
    Server --> Shared
    Server --> PiAgent
    Server --> GitWorktrees
    PiAgent --> HermesRAG
    PiAgent --> VisualTester
```

---

## 🔄 Ciclo de Execução Agêntica

Fluxo ponta a ponta desde a instrução do desenvolvedor até o commit granular na branch do workspace:

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Desenvolvedor
    participant UI as Workbench (React 19)
    participant NC as Neural Core 3D (WebGL)
    participant Host as Server Host (packages/server)
    participant Pi as Pi Coding Agent (In-Process)
    participant RAG as Hermes Code RAG (L0-L1-L2)
    participant Git as Git Worktree Isolada
    participant GIF as Project-GIF Core

    Dev->>UI: Envia instrução / tarefa no Chat
    UI->>Host: Despacha prompt via canal RPC
    Host->>Pi: Inicia loop agêntico na worktree isolada
    Pi->>RAG: Consulta semântica progressiva (L0 -> L1 -> L2)
    RAG-->>Pi: Chunks exatos e AST de símbolos (< 600 tokens)
    Pi->>NC: Telemetria de busca e arquivo pivô ativo
    NC-->>UI: Realce 3D em tempo real e pulso de dependências
    Pi->>Git: Executa ferramentas de código (read, edit, write, bash)
    alt Modificação de UI / Frontend
        Pi->>GIF: Grava GIF de mockup ou tela (15 FPS, 128 cores)
        GIF-->>Pi: Quadros compactados (< 500 KB)
        Pi->>Pi: Inspeção multimodal visual (sem telas às cegas)
    end
    Pi->>Git: Executa gates (lint, typecheck, tests)
    Pi->>Git: Commita alterações da etapa (commit semântico)
    Pi-->>Host: Finaliza etapa e atualiza Plan Rail (TODO)
    Host-->>UI: Evento agent_settled e sincronização de diffs
    UI-->>Dev: Interface atualizada com histórico e commits prontos
```

---

## 🎯 Protocolo RAG Progressivo: Contenção de Tokens (L0 ➔ L1 ➔ L2)

Para garantir máxima eficiência de contexto sem estourar janelas de LLMs, o ThinkRail e o Hermes RAG operam em três camadas progressivas obrigatórias:

```mermaid
flowchart LR
    subgraph L0["Camada L0: Super-Nós & Clusters (< 250 tokens)"]
        L0_Idx["get_project_l0_index"]
        L0_Clusters["web-ui • server-engine • contracts • cli-host • renderers"]
        L0_Idx --> L0_Clusters
    end

    subgraph L1["Camada L1: Assinaturas & AST (300-800 tokens)"]
        L1_AST["ast_skeleton_tree / expand_graph_node"]
        L1_Predict["ast_predict_context (Callers & Callees)"]
        L1_Skel["Classes, Métodos, Interfaces e Tipos (Sem corpos)"]
        L1_AST --> L1_Skel
        L1_Predict --> L1_Skel
    end

    subgraph L2["Camada L2: Recuperação Cirúrgica (< 600 tokens)"]
        L2_Search["code_search (query, cluster_id, limit)"]
        L2_Chunks["Chunks Relevantes via FTS5 + AST + Vetores (RRF)"]
        L2_Read["read cirúrgico com offset e limit"]
        L2_Search --> L2_Chunks
        L2_Read --> L2_Chunks
    end

    L0_Clusters -->|"cluster_id identificado"| L1_AST
    L1_Skel -->|"símbolo/arquivo exato"| L2_Search
    L2_Chunks -->|"Contexto mínimo e exato"| LLM["LLM / Coding Agent (Zero Desperdício de Tokens)"]
```

1. **L0 (Macro-Visão):** Identifica em qual cluster o domínio reside (< 250 tokens).
2. **L1 (Esqueleto de Assinaturas):** Carrega apenas assinaturas, interfaces e chamadas (callers/callees) sem o corpo dos métodos (300-800 tokens).
3. **L2 (Resolução Cirúrgica):** Busca semântica e FTS5 com filtro estrito de `cluster_id` (< 600 tokens).

---

## 🛠️ Comandos & Scripts de Produtividade

O repositório fornece utilitários nativos para gerenciar o ecossistema local:

### Hermes Code RAG
```bash
bun run rag:reindex   # Reindexa cirurgicamente arquivos novos ou alterados
bun run rag:status    # Exibe métricas de arquivos, chunks, símbolos e cobertura
bun run rag:prune     # Purga registros órfãos de arquivos deletados ou movidos
```

### Geração do Binário Standalone (V14)
```bash
# Compila a Web UI e empacota o executável single-file nativo com sufixo de versão
bun run build:binary  # Gera apps/cli/dist/thinkrail-v14.0.2.exe
```

### Validação Visual com Gravação de GIF
```bash
bun scripts/record-ui-gif.ts --mockup .thinkrail/context/mockups/minha-tela.html
# Gera um GIF leve e quantizado em 128 cores para validação multimodal da IA
```

### Verificação de Qualidade e Gates
```bash
bun run typecheck          # Checagem rigorosa de tipos TypeScript em todo o monorepo
bun run lint               # Lint e formatação com Biome
bun run check:boundaries   # Validação de fronteiras arquiteturais entre módulos
bun run check:deps         # Verificação de versões exatas no catálogo
bun run test               # Suíte de testes unitários e de integração
```

---

## 🚀 Instalação & Uso

O ThinkRail está disponível como instalador de desktop nativo e como binário executável CLI/Web (V14).

### Versão Desktop & Binários Autônomos
Faça o download do pacote da sua plataforma na [página de lançamentos](https://github.com/JetBrains/thinkrail/releases):
- **Windows (x64):** Execute o instalador `thinkrail-setup.exe` ou o binário autônomo V14 (`thinkrail.exe` / `thinkrail-v14.0.2.exe`).
- **macOS 14+ (Apple Silicon ou Intel):** Abra o arquivo DMG correspondente ou execute o binário nativo.
- **Linux (x64 / arm64):** Pacotes AppImage ou binários autônomos.

### Modo Web / CLI Local
Para executar diretamente do terminal em qualquer navegador:
```bash
# Clone e instale as dependências
bun install

# Inicie o servidor e abra no navegador
bun run dev
```

Consulte também o [Guia Completo de Compilação](doc/guia-compilacao.md) para detalhes de build das três frentes (Web, CLI e Desktop).

---

## 🌐 Localização & Personalização
- **Idiomas Nativos:** Português (PT-BR), Inglês, Espanhol, Russo, Chinês Simplificado e Japonês.
- **Tipografia & Temas:** Temas Escuro, Claro, Alto Contraste e Minimalista, com fontes de programação customizáveis (JetBrains Mono, Geist).

---

## 📜 Licença
Distribuído sob a licença [Apache 2.0](LICENSE).
