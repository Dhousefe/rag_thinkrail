import { homedir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
const userHome = process.env.USERPROFILE || homedir();
const dbPath = join(userHome, '.hermes', 'projects', 'project-thinkrail', 'hermes.db');
const db = new Database(dbPath, { readonly: true });
try{
  const totalEmb = db.query('SELECT count(*) as c FROM l2j_embeddings_cache').get() as any;
  console.log('total_embeddings_cache:', totalEmb.c);
  const sample = db.query('SELECT cache_key, model, dim, length(vector_blob) as blob_len, created_at FROM l2j_embeddings_cache LIMIT 5').all();
  console.log('samples:', sample);
  const totalChunks = db.query("SELECT count(*) as c FROM l2j_chunks WHERE project_name='project-thinkrail'").get() as any;
  console.log('total_chunks_project:', totalChunks.c);
}finally{ db.close(); }
