import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import crypto from 'crypto';

const SRC = path.join(process.cwd(), 'apps','web','src','panels','neural-core');
const OUT_DIR = path.join(process.cwd(), 'doc','neuralcore-chunks');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function walk(dir, files=[]) {
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir,f);
    if (fs.statSync(fp).isDirectory()) walk(fp, files);
    else if (fp.endsWith('.ts') || fp.endsWith('.tsx')) files.push(fp);
  }
  return files;
}

function sha256hex(s){return crypto.createHash('sha256').update(s).digest('hex');}

const files = walk(SRC);
const allChunks = [];

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  const src = fs.readFileSync(file,'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ESNext, true);
  const lines = src.split(/\r?\n/);

  function addChunk(kind, name, startPos, endPos, extra={}){
    const start = sf.getLineAndCharacterOfPosition(startPos).line + 1;
    const end = sf.getLineAndCharacterOfPosition(endPos).line + 1;
    const contextBefore = Math.max(0, start-4);
    const contextAfter = Math.min(lines.length, end+3);
    const content = lines.slice(contextBefore-1, contextAfter).join('\n');
    const id = sha256hex(`neuralcore|${rel}|${name}|${start}|${end}`);
    const chunk = {
      id,
      file: rel,
      path: rel,
      kind,
      name,
      start_line: start,
      end_line: end,
      content,
      token_estimate: Math.ceil(content.length/4),
      created_at: Date.now(),
      ...extra,
    };
    allChunks.push(chunk);
    fs.writeFileSync(path.join(OUT_DIR, id + '.json'), JSON.stringify(chunk, null, 2));
  }

  function visit(n){
    if (ts.isFunctionDeclaration(n) && n.name) {
      addChunk('function', n.name.getText(sf), n.getStart(sf), n.getEnd(sf));
    } else if (ts.isClassDeclaration(n) && n.name) {
      addChunk('class', n.name.getText(sf), n.getStart(sf), n.getEnd(sf));
      // methods inside
      n.members.forEach(m=>{
        if ((ts.isMethodDeclaration(m) || ts.isMethodSignature(m)) && m.name) {
          const mname = m.name.getText(sf);
          addChunk('method', `${n.name.getText(sf)}.${mname}`, m.getStart(sf), m.getEnd(sf));
        }
      });
    } else if (ts.isVariableStatement(n)) {
      n.declarationList.declarations.forEach(d=>{
        if (d.name && ts.isIdentifier(d.name)) {
          addChunk('variable', d.name.getText(sf), d.getStart(sf), d.getEnd(sf));
        }
      });
    }
    ts.forEachChild(n, visit);
  }

  visit(sf);
  // add file-level chunk
  addChunk('file', path.basename(rel), 0, src.length);
}

fs.writeFileSync(path.join(OUT_DIR,'index.json'), JSON.stringify({generated_at:Date.now(), count: allChunks.length, chunks: allChunks.map(c=>({id:c.id,file:c.file,kind:c.kind,name:c.name,start:c.start_line,end:c.end_line}))}, null, 2));
console.log('wrote', allChunks.length, 'chunks to', OUT_DIR);
