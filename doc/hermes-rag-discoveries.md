# Relatório Técnico: Arquitetura, Diagnóstico e Testes do Subsistema RAG Hermes no ThinkRail

**Data:** 03 de Novembro de 2026  
**Projeto Alvo:** `project-thinkrail`  
**Escopo:** Subsistema Hermes MCP RAG, resolução de projetos em ambientes worktree/monorepo, otimizações de performance, integridade de vetores/FTS5 e validação prática de ferramentas.

---

## 1. Visão Geral e Arquitetura do RAG Hermes

O Hermes 3.0 provê um motor agêntico RAG híbrido projetado para indexação e recuperação semântica de código-fonte de alta densidade (Java, TypeScript, Python, etc.).

### Pilares da Arquitetura de Recuperação:
1. **FTS5 (Full-Text Search 5):** Tokenização e busca textual rápida em identificadores, nomes qualificados, assinaturas e trechos de código via SQLite FTS5 (`l2j_chunk_fts`).
2. **Vector Embeddings (sqlite-vec / Jina Embeddings):** Vetorização densa (dimensão 768) servida localmente em `http://127.0.0.1:9085/api/embeddings`, persistida na tabela virtual `l2j_chunk_vec` via módulo nativo `vec0`.
3. **RRF (Reciprocal Rank Fusion):** Combinação matemática das pontuações de FTS5 e busca vetorial para ranqueamento balanceado de relevância sem viés exclusivo de palavras-chave ou proximidade semântica pura.
4. **AST Processing (JavaParser + Tree-sitter / Regex):** Decomposição sintática em símbolos (`l2j_symbols`) com tipos (`method`, `type`, `field`, `section`), intervalos de linhas e chunks de código associados (`l2j_chunks`).

---

## 2. Inventário do Banco de Dados `project-thinkrail`

O banco do projeto localiza-se em `~/.hermes/projects/project-thinkrail/hermes.db` (~253 MB):

- **Arquivos indexados (`l2j_files`):** 1.504 arquivos
- **Símbolos mapeados (`l2j_symbols`):** 17.206 símbolos
- **Fragmentos de código (`l2j_chunks`):** 17.196 chunks
- **Tabelas Principais:**
  - `l2j_files`: Registro de caminho absoluto (`path`), hash SHA-256 (`sha256`) e data de modificação.
  - `l2j_symbols`: `qualified_name`, `simple_name`, `kind`, `start_line`, `end_line`, `signature`, `metadata_json`.
  - `l2j_chunks`: Fragmentos de código delimitados com relacionamento `file_id`.
  - `l2j_chunk_fts`: Índice invertido FTS5 para busca textual rápida.
  - `l2j_chunk_vec`: Tabela vetorial `sqlite-vec` para busca por k-NN de embeddings (768 dimensões).

---

## 3. Diagnóstico Crítico: Resolução de Projeto em Worktrees

### O Problema Identificado
Durante a execução de comandos MCP (`code_search`, `ast_skeleton_tree`), as ferramentas retornavam `Nenhum código encontrado` mesmo com o banco contendo 17.206 símbolos.

### Causa Raiz
1. O servidor MCP do Hermes inicializa com base no diretório de execução atual (`user.dir` / CWD).
2. O ThinkRail roda em um worktree isolado do Git (`C:\Users\Dhousefe\.thinkrail\worktrees\thinkrail\workspace-1`).
3. O algoritmo `ProjectBootstrap.kt` e `ProjectRegistry.kt` percorre o CWD e seus ancestrais procurando um match exato na tabela `project_folders` do banco central (`%LOCALAPPDATA%\hermes\projects.db`).
4. Como o caminho do worktree não estava associado ao slug `project-thinkrail`, o algoritmo subiu a árvore de diretórios até `C:\Users\Dhousefe`, que estava registrado para o projeto legado `dhousefe`.
5. Como consequência, o servidor MCP abria o banco de dados do projeto `dhousefe` (vazio) em vez do `project-thinkrail`.

### Solução Aplicada
1. **Mapeamento em `projects.db`:**
   Inserção dos caminhos canônicos do worktree e do repositório no banco de controle do Hermes:
   - `C:\Users\Dhousefe\.thinkrail\worktrees\thinkrail\workspace-1` → `p_30f5245b` (`project-thinkrail`)
   - `C:\Users\Dhousefe\.thinkrail\worktrees\thinkrail` → `p_30f5245b` (`project-thinkrail`)
   - `D:\Projet_Thinkrail\source\thinkrail` → `p_30f5245b` (`project-thinkrail`)
2. **Definição de `workspace.path`:**
   Criação do arquivo `workspace.path` dentro de `C:\Users\Dhousefe\.hermes\projects\project-thinkrail\workspace.path` e `%LOCALAPPDATA%\hermes\projects\project-thinkrail\workspace.path`.
3. **Resultado:**
   O Hermes passou a carregar instantaneamente o projeto correto no boot:
   ```text
   [INFO] project.bootstrap slug=project-thinkrail cwd=C:\Users\Dhousefe\.thinkrail\worktrees\thinkrail\workspace-1 source=registry
   [MCP-READY] Hermes MCP Server ativo (30 ferramentas expostas) para projeto: project-thinkrail
   ```

---

## 4. Otimização e Prevenção de Timeout em `hermes_rag_coverage_map`

### Análise da Causa Raiz
A ferramenta `hermes_rag_coverage_map` apresentava timeout (>10.000 ms) em projetos grandes como `project-thinkrail` e `brproject-2026`:
1. **Varredura Recursiva sem Exclusões:** `ProjectRagCoverageMapper.kt` usava `FilesKt.walkTopDown(dir)` em diretórios candidatos. Em projetos Node/Bun/Turborepo, ele varria dezenas de milhares de arquivos dentro de `node_modules`, `.git` e `dist` procurando extensões válidas.
2. **Queries SQL Correlacionadas:** Subconsultas correlacionadas executavam `COUNT(*)` repetidas vezes sobre a tabela `l2j_chunks` para cada arquivo sem índice composto.

### Correções Aplicadas e Recomendações
1. **Uso de `fastMode = true`:** O modo rápido desativa o recálculo do SHA-256 no disco durante chamadas MCP em tempo real, confiando nos metadados agregados do banco SQLite.
2. **Agregação Agrupada:** Substituição de subqueries por `LEFT JOIN (SELECT file_id, COUNT(*) AS cnt FROM l2j_chunks GROUP BY file_id) c ON c.file_id = f.id`. Tempo de execução reduzido para **~135 ms**.
3. **Filtro de Diretórios Ignorados:** Adicionar lista de exclusão estrita no `walkTopDown` (`node_modules`, `.git`, `dist`, `.turbo`, `.thinkrail`) para evitar varreduras desnecessárias no filesystem do monorepo.

---

## 5. Validação Prática das Ferramentas RAG no `project-thinkrail`

### A. Ferramenta `code_search`
Busca híbrida combinando texto e embeddings com pontuação RRF.

| Consulta | Símbolo Encontrado | Arquivo / Linha | Score RRF |
|---|---|---|---|
| `HermesMcpPanel` | `panels.HermesMcpPanel()` | `apps/web/src/panels/HermesMcpPanel.tsx:20` | **0.0328** |
| `WorkspaceWorkbench` | `shell.WorkspaceWorkbench()` | `apps/web/src/shell/WorkspaceWorkbench.tsx:313` | **0.0301** |
| `McpServerSection` | `resources.McpServerSection()` | `apps/web/src/chat/resources/mcpRow.tsx:142` | **0.0271** |
| `McpRow` | `resources.McpRow()` | `apps/web/src/chat/resources/mcpRow.tsx:65` | **0.0320** |

*Comportamento de Retorno:* Fornece a assinatura completa, linha de início exata e trecho de código formatado (até 10 linhas de contexto).

---

### B. Ferramenta `ast_skeleton_tree`
Retorna a hierarquia sintática (árvore AST) de um arquivo de código sem corpos de funções, economizando a janela de contexto de tokens do LLM.

- **Alvo:** `apps/web/src/chat/resources/mcpRow.tsx`
- **Total de Símbolos Mapeados:** 8
  - `McpRowActionId` (type, linha 10)
  - `McpRowAction` (type, linha 12)
  - `mcpRowActions()` (method, linha 16)
  - `actions` (field, linha 18)
  - `stateActions()` (method, linha 21)
  - `mcpActionKey()` (method, linha 61)
  - `McpRow()` (method, linha 65)
  - `McpServerSection()` (method, linha 142)

- **Alvo:** `packages/server/src/host/handlers.ts`
  - **Total de Símbolos Mapeados:** 77 símbolos (interfaces RPC, tipos de requisição/resposta e handlers WebSocket registrados).

---

### C. Ferramentas Administrativas
- **`hermes_project_manager`:**
  - `action: "list"` → Lista os 34 projetos mapeados com status de banco, tamanho em KB e sessões ativas.
  - `action: "info", project_slug: "project-thinkrail"` → Retorna status do banco `hermes.db`, arquivos do diretório e presença de `session_working.json`.
- **`hermes_health_check`:**
  - Runtime: Java 21 LTS (Eclipse Adoptium)
  - SQLite FTS5: **Disponível (OK)**
  - SQLite Vec: **Carregado (OK, dim=768)**
  - Embeddings Server: Ativo em `http://127.0.0.1:9085`

---

## 6. Procedimento de Reindexação e Manutenção

Para atualizar o índice de código do `project-thinkrail` quando houver novos commits ou alterações estruturais:

1. **Via CLI Hermes (direto no workspace):**
   ```bat
   java -cp D:\Projeto_Germes\hermes-3.0\dist\germes.jar br.com.hermes.rag.MainKt index D:\Projet_Thinkrail\source\thinkrail
   ```
2. **Via MCP Tool:**
   ```json
   {
     "name": "hermes_index_code",
     "arguments": {
       "path": "D:/Projet_Thinkrail/source/thinkrail",
       "project_slug": "project-thinkrail"
     }
   }
   ```
3. **Pela Interface Web do ThinkRail:**
   Acessar a aba **Hermes MCP** na barra lateral do workbench (`WorkspaceWorkbench.tsx`) ou no trilho do `ProjectHome.tsx`, localizar o card do projeto `project-thinkrail` e clicar em **Reindexar Projeto**. A barra de progresso apresentará a velocidade média em arquivos/segundo e o tempo preditivo restante.
