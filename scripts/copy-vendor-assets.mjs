// postinstall: copies browser assets that must be served by this app (never a CDN),
// so statements and receipts are processed entirely on the user's machine.
//   public/pdf.worker.min.mjs                 pdf.js worker (matches installed pdfjs-dist)
//   public/tesseract/worker.min.js            tesseract.js worker
//   public/tesseract/core/*.wasm.js           OCR engine builds (the browser picks one)
//   public/tesseract/lang/eng.traineddata.gz  English model (4.0.0_best_int)
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = (...p) => join(root, "node_modules", ...p);
const pub = (...p) => join(root, "public", ...p);

function copy(from, to) {
  if (!existsSync(from)) {
    console.warn(`[postinstall] missing ${from}; skipped.`);
    return false;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  return true;
}

// pdf.js worker (file name differs between versions)
const pdfWorker = ["pdf.worker.min.mjs", "pdf.worker.min.js"].find((f) => existsSync(nm("pdfjs-dist", "build", f)));
if (pdfWorker && copy(nm("pdfjs-dist", "build", pdfWorker), pub(pdfWorker))) {
  console.log(`[postinstall] copied ${pdfWorker} to public/`);
}

// tesseract.js worker, cores and language data
copy(nm("tesseract.js", "dist", "worker.min.js"), pub("tesseract", "worker.min.js"));

const coreDir = nm("tesseract.js-core");
const cores = existsSync(coreDir) ? readdirSync(coreDir).filter((f) => f.endsWith(".wasm.js")) : [];
for (const file of cores) copy(join(coreDir, file), pub("tesseract", "core", file));

const lang = copy(
  nm("@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"),
  pub("tesseract", "lang", "eng.traineddata.gz"),
);
console.log(`[postinstall] copied tesseract worker, ${cores.length} cores${lang ? ", eng language data" : ""} to public/tesseract/`);
