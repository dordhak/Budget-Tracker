// Browser-only helper: loads pdfjs on demand and extracts positioned text items.
// Import this from Client Components only (it touches `window` via pdfjs).

/** A text fragment with its position on the page (PDF units, origin bottom-left). */
export interface PositionedText {
  page: number; // 1-based
  str: string;
  x: number;
  y: number;
  width: number;
}

// Served from public/ by the postinstall copy script (no CDN; stays local).
const WORKER_SRC = "/pdf.worker.min.mjs";

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export async function extractPositionedText(file: ArrayBuffer): Promise<PositionedText[]> {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(file) });
  const doc = await loadingTask.promise;
  const items: PositionedText[] = [];

  try {
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      for (const item of content.items) {
        // TextMarkedContent entries have no `str`; skip them and empty strings.
        if (!("str" in item) || item.str.trim() === "") continue;
        const [, , , , x, y] = item.transform as number[];
        items.push({ page: pageNo, str: item.str, x, y, width: item.width });
      }
      page.cleanup();
    }
  } finally {
    // Destroying the loading task tears down the document and its worker transport.
    await loadingTask.destroy();
  }
  return items;
}
