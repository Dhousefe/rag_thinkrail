import fs from 'fs';
import path from 'path';

const CHUNKS_INDEX = path.join(process.cwd(),'doc','neuralcore-chunks','index.json');
const OUT = path.join(process.cwd(),'doc','neuralcore-chunks','payloads');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Read index (not parsed into source files). We'll produce payloads from the chunk JSON files
const index = JSON.parse(fs.readFileSync(CHUNKS_INDEX,'utf8'));

// Read each chunk file and create embedding payloads (text + metadata)
const files = fs.readdirSync(path.join(process.cwd(),'doc','neuralcore-chunks'))
  .filter(f=>f.endsWith('.json') && f!=='index.json' && f!=='README.md');

for (const f of files) {
  const obj = JSON.parse(fs.readFileSync(path.join(process.cwd(),'doc','neuralcore-chunks',f),'utf8'));
  const payload = {
    id: obj.id,
    text: obj.content,
    metadata: {
      file: obj.file,
      kind: obj.kind,
      name: obj.name,
      start_line: obj.start_line,
      end_line: obj.end_line,
      commit: 'af2650f',
      branch: 'feature/neural-core'
    }
  };
  fs.writeFileSync(path.join(OUT, obj.id + '.json'), JSON.stringify(payload,null,2));
}
console.log('prepared', files.length, 'payloads in', OUT);
