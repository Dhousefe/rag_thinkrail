import fs from 'fs';
import path from 'path';

// use global fetch (Node 18+) when available; fall back to node-fetch if not
let fetchImpl;
try { fetchImpl = globalThis.fetch; } catch(e) { fetchImpl = undefined; }
if (!fetchImpl) {
  try { fetchImpl = (await import('node-fetch')).default; } catch(e) { throw new Error('fetch is not available and node-fetch could not be imported'); }
}
const fetch = fetchImpl;


const PAYLOAD_DIR = path.join(process.cwd(),'doc','neuralcore-chunks','payloads');
const EMB_URL = process.env.EMBEDDINGS_URL || 'http://127.0.0.1:9085/api/embeddings';
const HERMES_PROJECT = process.env.HERMES_PROJECT || 'project-thinkrail';
const HERMES_URL = process.env.HERMES_URL || 'http://127.0.0.1:9086/api/hermes/upsert';

async function embedAndUpsert(filePath){
  const payload = JSON.parse(fs.readFileSync(filePath,'utf8'));
  // call embeddings
  const resp = await fetch(EMB_URL, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({texts:[payload.text]})
  });
  if (!resp.ok) throw new Error('embeddings request failed '+resp.status);
  const body = await resp.json();
  // Jina returns {embeddings: [[...]]} or {embeddings: {data:[{embedding:[]}]}}
  const vector = body.embeddings?.[0] || body.embeddings?.data?.[0]?.embedding || (body.embeddings?.data?.[0]?.vector);
  if (!vector) throw new Error('no embedding in response: '+JSON.stringify(body).slice(0,200));

  // upsert to Hermes via HTTP (this endpoint is a placeholder; the repo may supply specific mcp or HTTP upsert)
  const up = await fetch(HERMES_URL, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({project: HERMES_PROJECT, chunk_id: payload.id, embedding: vector, metadata: payload.metadata, content: payload.text})
  });
  if (!up.ok) throw new Error('hermes upsert failed '+up.status);
  return true;
}

(async()=>{
  const files = fs.readdirSync(PAYLOAD_DIR).filter(f=>f.endsWith('.json'));
  console.log('found', files.length, 'payloads');
  for (const f of files) {
    const p = path.join(PAYLOAD_DIR,f);
    try{
      await embedAndUpsert(p);
      console.log('upserted', f);
    }catch(e){
      console.error('failed', f, e.message);
      process.exit(1);
    }
  }
  console.log('done');
})();
