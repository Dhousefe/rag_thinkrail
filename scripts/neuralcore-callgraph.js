import fs from 'fs';
import path from 'path';
import ts from 'typescript';

function walk(dir, files = []) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) walk(fp, files);
    else if (fp.endsWith('.ts') || fp.endsWith('.tsx')) files.push(fp);
  }
  return files;
}

function getNodeName(node, sourceFile) {
  if (!node) return null;
  if (node.name) return node.name.getText(sourceFile);
  return null;
}

function symbolId(file, name) {
  return `${path.relative(process.cwd(), file)}::${name}`;
}

function containerName(node, sf) {
  let cur = node.parent;
  while (cur) {
    if (ts.isFunctionDeclaration(cur) || ts.isMethodDeclaration(cur) || ts.isFunctionExpression(cur) || ts.isArrowFunction(cur) || ts.isClassDeclaration(cur)) {
      const n = getNodeName(cur, sf) || (ts.isClassDeclaration(cur) ? '<class>' : '<fn>');
      return n;
    }
    cur = cur.parent;
  }
  return '<module>'; 
}

const srcDir = path.join(process.cwd(), 'apps','web','src','panels','neural-core');
const out = path.join(process.cwd(), 'doc','neuralcore-callgraph.json');
const files = walk(srcDir);

const graph = { nodes: [], edges: [] };
const nodeIndex = new Map();

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ESNext, true);

  // collect top-level declarations
  const declared = new Set();
  function collect(n) {
    if (ts.isFunctionDeclaration(n) && n.name) declared.add(n.name.getText(sf));
    else if (ts.isClassDeclaration(n) && n.name) declared.add(n.name.getText(sf));
    else if (ts.isVariableStatement(n)) {
      n.declarationList.declarations.forEach(d => {
        if (d.name && ts.isIdentifier(d.name)) {
          // possibly function expressions
          declared.add(d.name.getText(sf));
        }
      });
    }
    ts.forEachChild(n, collect);
  }
  collect(sf);

  // register module node
  const modNodeId = `${path.relative(process.cwd(), file)}::<module>`;
  nodeIndex.set(modNodeId, { id: modNodeId, name: '<module>', file: path.relative(process.cwd(), file), kind: 'module' });
  graph.nodes.push(nodeIndex.get(modNodeId));

  function visit(n) {
    // find declarations and register
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n) || ts.isMethodDeclaration(n) || ts.isVariableStatement(n)) ) {
      if (ts.isFunctionDeclaration(n) && n.name) {
        const name = n.name.getText(sf);
        const id = symbolId(file, name);
        if (!nodeIndex.has(id)) {
          const kind = 'function';
          const node = { id, name, file: path.relative(process.cwd(), file), kind };
          nodeIndex.set(id, node);
          graph.nodes.push(node);
        }
      } else if (ts.isClassDeclaration(n) && n.name) {
        const name = n.name.getText(sf);
        const id = symbolId(file, name);
        if (!nodeIndex.has(id)) {
          const kind = 'class';
          const node = { id, name, file: path.relative(process.cwd(), file), kind };
          nodeIndex.set(id, node);
          graph.nodes.push(node);
        }
      } else if (ts.isVariableStatement(n)) {
        n.declarationList.declarations.forEach(d => {
          if (d.name && ts.isIdentifier(d.name)) {
            const name = d.name.getText(sf);
            const id = symbolId(file, name);
            if (!nodeIndex.has(id)) {
              const kind = 'variable';
              const node = { id, name, file: path.relative(process.cwd(), file), kind };
              nodeIndex.set(id, node);
              graph.nodes.push(node);
            }
          }
        });
      }
    }

    // find call expressions
    if (ts.isCallExpression(n)) {
      let expr = n.expression;
      let calleeName = null;
      if (ts.isIdentifier(expr)) calleeName = expr.getText(sf);
      else if (ts.isPropertyAccessExpression(expr)) calleeName = expr.name.getText(sf);

      if (calleeName) {
        // find container
        const container = containerName(n, sf);
        const fromId = symbolId(file, container === '<module>' ? '<module>' : container);
        const toName = calleeName;
        // try to resolve to local declared symbol
        let toId = null;
        if (declared.has(toName)) {
          toId = symbolId(file, toName);
        } else {
          // try to find across files by name (best-effort)
          for (const [k, v] of nodeIndex) {
            if (v.name === toName) {
              toId = k; break;
            }
          }
        }
        graph.edges.push({ from: fromId, to: toId || toName });
      }
    }

    ts.forEachChild(n, visit);
  }

  visit(sf);
}

// dedupe edges
const seen = new Set();
const dedupEdges = [];
for (const e of graph.edges) {
  const key = `${e.from}-->${e.to}`;
  if (!seen.has(key)) { seen.add(key); dedupEdges.push(e); }
}
graph.edges = dedupEdges;

fs.writeFileSync(out, JSON.stringify(graph, null, 2));
console.log('wrote', out);
