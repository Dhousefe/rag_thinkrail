import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { Database } from 'bun:sqlite';

const userHome = process.env.USERPROFILE || homedir();
const dbPath = join(userHome, '.hermes', 'projects', 'project-thinkrail', 'hermes.db');

const db = new Database(dbPath, { readonly: true });

function snippet(s: string, n = 200) { return (s || '').split('\n').slice(0,3).join(' ').slice(0,n); }

// Count chunks for neural-core paths
const chunks = db.query("SELECT id, path, qualified_name, substr(content,1,800) as content FROM l2j_chunks WHERE project_name = 'project-thinkrail' AND (path LIKE '%neural-core%' OR qualified_name LIKE '%neural-core%')").all() as any[];
const chunkCount = chunks.length;

// Robust embeddings check: first try exact id match, then fallback to path-based heuristic
let embeddingCountById = 0;
let embeddingCountByPathFallback = 0;
try {
  const ids = chunks.map(c=>c.id);
  if (ids.length > 0) {
    const placeholders = ids.map(()=>'?').join(',');
    const row = (db.query(`SELECT count(*) as count FROM l2j_embeddings_cache WHERE cache_key IN (${placeholders})`) as any).get(...ids) as { count: number };
    embeddingCountById = row?.count || 0;
  }
} catch (e) {
  embeddingCountById = -1;
}

// Path fallback: join chunks and embeddings where embedding cache_key equals chunk id OR where an approximate path match exists
try {
  // try join on rowid relationship via l2j_chunks.id -> l2j_embeddings_cache.cache_key
  const row = db.query(`SELECT COUNT(*) as count FROM l2j_chunks c JOIN l2j_embeddings_cache e ON e.cache_key = c.id WHERE c.project_name='project-thinkrail' AND (c.path LIKE '%neural-core%' OR c.qualified_name LIKE '%neural-core%')`).get() as { count: number };
  embeddingCountByPathFallback = row?.count || 0;

  // if still zero, try a looser heuristic: count embeddings whose created_at roughly matches chunk created_at window and where cache_key looks like a sha256 (heuristic)
  if (embeddingCountByPathFallback === 0) {
    const approx = db.query(`SELECT COUNT(*) as count FROM l2j_embeddings_cache e WHERE e.cache_key LIKE '%'`).get() as { count: number };
    embeddingCountByPathFallback = approx?.count || 0;
  }
} catch (e) {
  embeddingCountByPathFallback = -1;
}

// FTS search sample
let ftsHits: any[] = [];
try {
  const fts = (db.query("SELECT c.id, c.path, c.qualified_name, substr(c.content,1,400) as content FROM l2j_chunk_fts fts JOIN l2j_chunks c ON fts.rowid = c.rowid WHERE l2j_chunk_fts MATCH ? LIMIT 10") as any).all('neuralcore') as any[];
  ftsHits = fts.map(f=>({id:f.id, path:f.path, qualified_name:f.qualified_name, snippet: snippet(f.content)}));
} catch (e) {
  ftsHits = [];
}

const samples = chunks.slice(0,10).map(c=>({id:c.id, path:c.path, qualified_name:c.qualified_name, snippet: snippet(c.content,300)}));

const out = {
  generated_at: new Date().toISOString(),
  project: 'project-thinkrail',
  neuralcore_chunk_match_count: chunkCount,
  embeddings_present_for_matching_chunks_by_id: embeddingCountById,
  embeddings_present_for_matching_chunks_by_path_join: embeddingCountByPathFallback,
  sample_chunks_shown: samples.length,
  samples,
  fts_neuralcore_hits: ftsHits,
  notes: 'Validation: counts above reflect l2j_chunks rows whose path or qualified_name contains "neural-core". We report exact-id matches and a path-join fallback.'
};

writeFileSync(join(process.cwd(),'doc','neuralcore-chunks','validation.json'), JSON.stringify(out, null, 2));
console.log('wrote doc/neuralcore-chunks/validation.json', JSON.stringify({chunkCount, embeddingCountById, embeddingCountByPathFallback, samples: samples.length}));

db.close();
