import { notFound } from "next/navigation";
import { ReceiptSpike } from "./receipt-spike";

// Development-only page: try receipt OCR + field suggestions on real receipts.
// Visit /dev/receipt-spike while running `npm run dev`. Returns 404 in production.
export default function ReceiptSpikePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Receipt reader demo</h1>
      <p className="text-sm text-muted-foreground">
        Pick a receipt photo, screenshot or PDF. Text recognition runs in your browser; nothing is uploaded or saved.
      </p>
      <ReceiptSpike />
    </div>
  );
}
