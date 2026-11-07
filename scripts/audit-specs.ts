import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

function findSpecs(dir: string, results: any[] = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (["node_modules", ".git", "dist", ".turbo"].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      findSpecs(full, results);
    } else if (entry.name.endsWith(".md")) {
      try {
        const content = readFileSync(full, "utf-8");
        if (content.startsWith("---")) {
          const matchId = content.match(/^id:\s*([^\r\n]+)/m);
          const matchType = content.match(/^type:\s*([^\r\n]+)/m);
          const matchTitle = content.match(/^title:\s*([^\r\n]+)/m);
          const matchStatus = content.match(/^status:\s*([^\r\n]+)/m);
          if (matchId && matchType) {
            results.push({
              path: relative(process.cwd(), full).split("\\").join("/"),
              id: matchId[1].trim(),
              type: matchType[1].trim(),
              title: matchTitle ? matchTitle[1].trim() : "",
              status: matchStatus ? matchStatus[1].trim() : "active",
            });
          }
        }
      } catch {}
    }
  }
  return results;
}

const specs = findSpecs(process.cwd());
console.log("Total de Specs indexados:", specs.length);

const byType: Record<string, number> = {};
const byStatus: Record<string, number> = {};
specs.forEach((s) => {
  byType[s.type] = (byType[s.type] || 0) + 1;
  byStatus[s.status] = (byStatus[s.status] || 0) + 1;
});

console.log("\nPor Tipo:\n", JSON.stringify(byType, null, 2));
console.log("\nPor Status:\n", JSON.stringify(byStatus, null, 2));

const modules = specs.filter((s) => s.type === "module-design");
console.log("\nModules Designs (" + modules.length + "):");
modules.forEach((m) => console.log("  - " + m.id + " (" + m.path + ")"));

const rootSpecs = specs.filter((s) => ["goal-and-requirements", "architecture-design"].includes(s.type));
console.log("\nSpecs Raiz (" + rootSpecs.length + "):");
rootSpecs.forEach((r) => console.log("  - " + r.id + " (" + r.path + ") :: " + r.title));
