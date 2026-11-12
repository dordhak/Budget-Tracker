// Copies the pdfjs worker matching the installed pdfjs-dist version into public/.
// Keeps the worker local (no CDN) and always in sync with the installed version.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const candidates = ["pdf.worker.min.mjs", "pdf.worker.min.js"];
const buildDir = join(root, "node_modules", "pdfjs-dist", "build");

const found = candidates.find((f) => existsSync(join(buildDir, f)));
if (!found) {
  console.warn("[postinstall] pdfjs-dist worker not found; skipping copy.");
  process.exit(0);
}
mkdirSync(join(root, "public"), { recursive: true });
copyFileSync(join(buildDir, found), join(root, "public", found));
console.log(`[postinstall] copied ${found} to public/`);
