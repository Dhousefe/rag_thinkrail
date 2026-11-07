import { Database } from "bun:sqlite";
import { join } from "path";
import { homedir } from "os";

const dbPath = join(homedir(), ".hermes", "projects", "project-thinkrail", "hermes.db");
const db = new Database(dbPath, { readonly: true });
const files = db.query("SELECT path FROM l2j_files").all() as { path: string }[];
const counts: Record<string, number> = {};

for (const f of files) {
  const norm = f.path.split("\\").join("/");
  let cluster = "root/specs (Specs, scripts & config)";
  if (norm.includes("apps/web")) cluster = "apps/web (Frontend React UI)";
  else if (norm.includes("apps/cli")) cluster = "apps/cli (CLI launcher & MCP host)";
  else if (norm.includes("apps/desktop")) cluster = "apps/desktop (Desktop container)";
  else if (norm.includes("packages/contracts")) cluster = "packages/contracts (Wire protocols)";
  else if (norm.includes("packages/server")) cluster = "packages/server (Host engine & pi bridge)";
  else if (norm.includes("packages/shared")) cluster = "packages/shared (Shared utilities)";
  else if (norm.includes("packages/ui")) cluster = "packages/ui (Design system primitives)";
  else if (norm.includes("packages/resource-renderers")) cluster = "packages/resource-renderers (Visual cards)";
  else if (norm.includes("packages/locales")) cluster = "packages/locales (i18n catalogs)";
  else if (norm.includes("e2e")) cluster = "e2e (Test suites & workflows)";

  counts[cluster] = (counts[cluster] || 0) + 1;
}

console.log(JSON.stringify(counts, null, 2));
db.close();
