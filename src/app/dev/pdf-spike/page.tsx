import { notFound } from "next/navigation";
import { PdfSpike } from "./pdf-spike";

// Development-only page: proves the pdfjs worker setup and demos the statement parser.
// Visit /dev/pdf-spike while running `npm run dev`. Returns 404 in production.
export default function PdfSpikePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Statement parser demo</h1>
      <p className="text-sm text-muted-foreground">
        Pick a statement PDF. Parsing runs in your browser; nothing is uploaded or saved.
      </p>
      <PdfSpike />
    </div>
  );
}
