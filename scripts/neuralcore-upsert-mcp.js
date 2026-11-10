#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const PAYLOAD_DIR = path.join(process.cwd(),'doc','neuralcore-chunks','payloads');
const EMB_URL = process.env.EMBEDDINGS_URL || 'http://127.0.0.1:9085/api/embeddings';
const MCP_RUNNER = process.env.BUN_PATH || 'bun';
const MCP_SCRIPT = 'apps/cli/scripts/hermes-mcp-server.ts';
const HERMES_PROJECT = process.env.HERMES_PROJECT || 'project-thinkrail';

function fetchJson(url, opts){
  // Prefer global fetch when available (Node 18+ or bun)
  if (typeof globalThis.fetch === 'function') {
    return Promise.resolve().then(()=>globalThis.fetch(url, opts)).then(r=>r.json());
  }

  // Try the 'undici' package (npm name) first, then fall back to node-fetch
  return import('undici')
    .then((mod)=>{
      const f = mod.fetch || (mod.default && mod.default.fetch);
      if (!f) throw new Error('undici has no fetch');
      return f(url, opts).then(r=>r.json());
    })
    .catch(()=> import('node-fetch'))
    .then((mod)=>{
      const f = mod.default || mod;
      return f(url, opts).then(r=>r.json());
    });
}

async function callEmbeddings(text){
  const body = JSON.stringify({texts:[text]});
  const res = await fetchJson(EMB_URL, {method:'POST', headers:{'content-type':'application/json'}, body});
  const vector = res.embeddings?.[0] || res.embeddings?.data?.[0]?.embedding || res.embeddings?.data?.[0]?.vector;
  if(!vector) throw new Error('no embedding in response: '+JSON.stringify(res).slice(0,200));
  return vector;
}

function startMcp(){
  // bunx expects to be called directly with the script path on Windows distributions; call without 'run' when MCP_RUNNER ends with 'bunx.exe' or 'bunx'
  const args = MCP_RUNNER.toLowerCase().endsWith('bunx.exe') || MCP_RUNNER.toLowerCase().endsWith('bunx') ? [MCP_SCRIPT] : ['run', MCP_SCRIPT];
  const proc = spawn(MCP_RUNNER, args, {
    stdio:['pipe','pipe','inherit'],
    env: {...process.env, HERMES_PROJECT: HERMES_PROJECT}
  });

  proc.stdin.setDefaultEncoding('utf8');

  let stdoutBuf = '';
  const handlers = new Map();
  let nextId = 1;

  proc.stdout.on('data', (chunk)=>{
    stdoutBuf += chunk.toString('utf8');
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop() || '';
    for(const line of lines){
      const t = line.trim();
      if(!t) continue;
      try{
        const obj = JSON.parse(t);
        const id = obj.id;
        const h = handlers.get(id);
        if(h){ handlers.delete(id); h.resolve(obj); }
      }catch(e){ console.error('[mcp] invalid json', e, t.slice(0,200)); }
    }
  });

  proc.on('exit',(c)=>{
    console.log('[mcp] exited',c);
  });

  function rpc(method, params){
    return new Promise((resolve, reject)=>{
      const id = nextId++;
      handlers.set(id, {resolve,reject});
      const msg = {jsonrpc:'2.0', id, method, params};
      try{
        proc.stdin.write(JSON.stringify(msg)+"\n");
      }catch(e){ handlers.delete(id); reject(e); }
      // timeout
      setTimeout(()=>{
        if(handlers.has(id)){ handlers.delete(id); reject(new Error('rpc timeout')); }
      }, 30000);
    });
  }

  return {proc, rpc};
}

(async()=>{
  const files = fs.readdirSync(PAYLOAD_DIR).filter(f=>f.endsWith('.json'));
  console.log('found', files.length, 'payloads');
  if(files.length === 0) return;

  const {proc, rpc} = startMcp();

  // wait for tools/list
  try{
    const init = await rpc('initialize', {});
    // ask for tools list
    const list = await rpc('tools/list', {});
    console.log('[mcp] tools count', list?.result?.tools?.length ?? 'unknown');
  }catch(e){ console.error('mcp init failed', e); proc.kill(); process.exit(1); }

  for(const f of files){
    const p = path.join(PAYLOAD_DIR,f);
    try{
      const payload = JSON.parse(fs.readFileSync(p,'utf8'));
      const text = payload.text || payload.content || '';
      const vector = await callEmbeddings(text);
      const params = {
        project: HERMES_PROJECT,
        chunk_id: payload.id,
        embedding: vector,
        embedding_model: payload.embedding_model || 'jina-embeddings-v2-base-code',
        metadata: payload.metadata || {},
        content: text,
        chunk_kind: payload.chunk_kind || 'code'
      };
      const resp = await rpc('tools/call', {name:'upsert_chunk', arguments: params});
      const rText = resp?.result?.content?.[0]?.text || resp?.result || JSON.stringify(resp).slice(0,200);
      console.log('upserted', f, '->', rText);
    }catch(e){ console.error('failed', f, e); proc.kill(); process.exit(1); }
  }

  console.log('done');
  proc.kill();
})();
