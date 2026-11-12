// Browser-only: turns a receipt image or PDF into text, entirely on this machine.
// Tesseract's worker, engine and English model are served from /public/tesseract
// (copied there by scripts/copy-vendor-assets.mjs), so no CDN or API is contacted.
import { groupLines, joinText } from "@/lib/import/lines";
import { extractPositionedText, renderPdfPage } from "@/lib/pdf/extract-text";

export type ReceiptSource = "receipt_image" | "receipt_pdf";

export interface ReadReceiptResult {
  text: string;
  source: ReceiptSource;
  /** "text-layer" when a PDF had real text; "ocr" otherwise. */
  method: "text-layer" | "ocr";
  /** OCR confidence 0–100, when OCR was used. */
  confidence: number | null;
  /** What to keep in storage: a downscaled JPEG (EXIF/GPS stripped) for images, the original for PDFs. */
  storeBlob: Blob;
  storeContentType: "image/jpeg" | "application/pdf";
}

export type ProgressHandler = (status: string, progress: number) => void;

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const OCR_TARGET_LONG_SIDE = 2000; // px; small photos are upscaled, huge ones downscaled
const STORE_LONG_SIDE = 1600;
const MIN_TEXT_LAYER_CHARS = 20;

type TesseractWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;
let workerPromise: Promise<TesseractWorker> | null = null;
let progressListener: ProgressHandler | null = null;

function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then(({ createWorker, OEM }) =>
      createWorker("eng", OEM.LSTM_ONLY, {
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract/core",
        langPath: "/tesseract/lang",
        workerBlobURL: false,
        logger: (m) => progressListener?.(m.status, m.progress),
      }),
    );
    // Let a failed start be retried on the next receipt.
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

/** Draws the image scaled to `longSide`, honouring EXIF rotation from phone cameras. */
async function drawScaled(file: Blob, longSide: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = longSide / Math.max(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** Grayscale + contrast stretch: noticeably better OCR on thermal receipts. */
function enhanceForOcr(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < px.length; i += 4) {
    const g = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = px[i + 1] = px[i + 2] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.round(((px[i] - min) / range) * 255);
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

const toJpeg = (canvas: HTMLCanvasElement, quality = 0.82) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", quality),
  );

async function ocr(canvas: HTMLCanvasElement, onProgress?: ProgressHandler) {
  progressListener = onProgress ?? null;
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(canvas);
    return { text: data.text, confidence: Math.round(data.confidence) };
  } finally {
    progressListener = null;
  }
}

export async function readReceipt(
  file: File,
  onProgress?: ProgressHandler,
  options: { ocr?: boolean } = {},
): Promise<ReadReceiptResult> {
  if (file.size > MAX_RECEIPT_BYTES) throw new Error("That file is larger than 10 MB.");
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  // Only preparing the stored copy (e.g. replacing a receipt): skip text recognition.
  if (options.ocr === false) {
    if (isPdf) return { text: "", source: "receipt_pdf", method: "text-layer", confidence: null, storeBlob: file, storeContentType: "application/pdf" };
    if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPG, PNG, WebP) or a PDF receipt.");
    try {
      const storeBlob = await toJpeg(await drawScaled(file, STORE_LONG_SIDE));
      return { text: "", source: "receipt_image", method: "ocr", confidence: null, storeBlob, storeContentType: "image/jpeg" };
    } catch {
      throw new Error("This browser can't open that image format. Try a JPG or PNG.");
    }
  }

  if (isPdf) {
    const buffer = await file.arrayBuffer();
    onProgress?.("reading pdf", 0);
    // pdf.js may detach the buffer it is given, so hand it copies.
    const items = await extractPositionedText(buffer.slice(0));
    const pages = [...new Set(items.map((i) => i.page))];
    const text = pages
      .flatMap((p) => groupLines(items.filter((i) => i.page === p)).map((line) => joinText(line.items)))
      .join("\n");

    if (text.replace(/\s/g, "").length >= MIN_TEXT_LAYER_CHARS) {
      return { text, source: "receipt_pdf", method: "text-layer", confidence: null, storeBlob: file, storeContentType: "application/pdf" };
    }
    // Scanned PDF: no usable text layer, so OCR the first page.
    const canvas = await renderPdfPage(buffer.slice(0), 1, 2);
    const result = await ocr(enhanceForOcr(canvas), onProgress);
    return { ...result, source: "receipt_pdf", method: "ocr", storeBlob: file, storeContentType: "application/pdf" };
  }

  if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPG, PNG, WebP) or a PDF receipt.");

  let ocrCanvas: HTMLCanvasElement;
  let storeBlob: Blob;
  try {
    ocrCanvas = enhanceForOcr(await drawScaled(file, OCR_TARGET_LONG_SIDE));
    storeBlob = await toJpeg(await drawScaled(file, STORE_LONG_SIDE));
  } catch {
    throw new Error("This browser can't open that image format. Try a JPG or PNG (iPhone: Settings → Camera → Most Compatible).");
  }
  const result = await ocr(ocrCanvas, onProgress);
  return { ...result, source: "receipt_image", method: "ocr", storeBlob, storeContentType: "image/jpeg" };
}
