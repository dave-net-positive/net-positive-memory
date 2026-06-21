// Build the .mcpb staging directory: bundle the server to one file and assemble
// dist/ with the manifest, icon, server and docs. Then run `npm run pack`
// (which calls the mcpb CLI) to produce ../net-positive-memory.mcpb.
import { build } from "esbuild";
import { mkdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "server"), { recursive: true });

await build({
  entryPoints: [join(root, "src/index.js")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  legalComments: "none",
  outfile: join(dist, "server/index.cjs"),
});

for (const f of ["manifest.json", "icon.png", "README.md"]) {
  copyFileSync(join(root, f), join(dist, f));
}
copyFileSync(join(root, "..", "LICENSE"), join(dist, "LICENSE"));

console.log("Built dist/. Now run: npm run pack  (requires the mcpb CLI: npm i -g @anthropic-ai/mcpb)");
