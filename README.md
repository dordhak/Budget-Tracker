# Budget Tracker

A personal budget tracker for Maybank accounts. You log income and spending as it happens (from receipts or by hand). When the month-end statement arrives, you import it, and each statement row is matched to what you already logged, so nothing is counted twice.

- **Budget dashboard** (`/`): the "safe to spend" view for a month. It uses your entries plus statement rows you didn't log, each purchase counted once. Shows income, expenses, balance, safe-to-spend against your overall limit, budget bars (overall, the sum of category limits, and each category), matching status chips, and recent entries.
- **Statement dashboard** (`/statements`): bank facts only for a month. Shows money in and out, net change, opening and closing balance per account, and how many rows are matched to your entries.
- **Charts on both:** spending by category (donut), income vs expenses for the last 6 months (bars), and daily spending (line). A month picker switches between months (`?month=YYYY-MM`).
- **Entries** (`/entries`, `/entries/new`, `/entries/[id]`):
  - add income or spending from a **receipt photo, screenshot or PDF e-receipt**, read in your browser, or by hand
  - mark bank or cash, keep the receipt image privately, and edit or delete entries
  - link or unlink a statement row by hand
- **Import** (`/import`): upload a Maybank savings statement PDF. It's parsed in the browser, checked against the statement totals, de-duplicated, **matched to your entries**, previewed and bulk-inserted.
- **Expenses** (`/expenses`, `/expenses/[id]`): the statement rows, with search, a category filter and pagination. You can edit the category or notes, and save a keyword rule.

Stack: Next.js 15 (App Router), React 19, Tailwind CSS 3 + shadcn/ui-style components, Recharts, Supabase (Auth, Postgres, Storage), pdf.js, Tesseract.js, Vitest. Currency is MYR.

## Setup

### 1. Requirements

- Node.js 20 or newer (developed on Node 26 via nvm).
- A Supabase project (the free tier is fine).

### 2. Install

```bash
npm install
```

The `postinstall` script (`scripts/copy-vendor-assets.mjs`) copies browser assets from `node_modules` into `public/`, so they are served by this app and never by a CDN:

| Copied to | What |
| --- | --- |
| `public/pdf.worker.min.mjs` | pdf.js worker (always matches the installed `pdfjs-dist`) |
| `public/tesseract/worker.min.js` | Tesseract.js worker |
| `public/tesseract/core/*.wasm.js` | OCR engine builds (the browser downloads only the one it supports, ~4 MB) |
| `public/tesseract/lang/eng.traineddata.gz` | English model (`4.0.0_best_int`, ~3 MB) |

These files are git-ignored. If PDF import or receipt reading reports a worker or loading error, run `npm install` again.

### 3. Database

In the Supabase dashboard, open **SQL Editor** and run, in order:

1. `supabase/schema.sql`: statement tables, row level security, indexes, starter category rules. Safe to re-run.
2. `supabase/migrations/002_entries.sql`: the `entries` table, statement matching constraints, and the private `receipts` storage bucket with owner-only policies. Safe to re-run; existing data isn't modified.
3. Optional checks: `supabase/verify.sql` and `supabase/migrations/002_verify.sql`. They check privacy between users, duplicate rejection and matching rules, inside a transaction that is rolled back. Every check should print `PASS`.

If you created your account *before* running `schema.sql`, run it again; the last statement seeds your settings row and starter category rules.

### 4. Auth settings

In **Authentication**:

- **Sign In / Providers → Email**: email sign-in must be enabled. For a local personal app you can turn **Confirm email** off, so sign-up logs you in straight away. Supabase's built-in mailer only sends a few emails per hour.
- **URL Configuration**: add `http://localhost:3000/auth/confirm` to the redirect URLs.

### 5. Environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from **Project Settings → API**. The anon key is meant to be public: row level security and storage policies restrict everything to the signed-in user. `.env.local` is git-ignored. Never commit it, and never use the `service_role` key in this app.

### 6. Run

```bash
npm run dev
```

Open http://localhost:3000. You'll be sent to `/login` to create an account.

## Day to day

### Logging an entry

1. **Entries → Add entry**. Optionally **Add receipt**: a photo, screenshot (Maybank / DuitNow / e-wallet confirmation) or PDF e-receipt.
2. The receipt is read in your browser and pre-fills the amount (it looks for GRAND TOTAL / TOTAL / JUMLAH / AMOUNT and skips subtotal, tax, service charge, rounding, cash and change), the date, the merchant and the type. Your keyword rules suggest a category. **Check the fields:** OCR is a starting point, and the form says when no clear total was found.
3. Choose **Bank / card / e-wallet** (will appear on a statement) or **Cash** (never matched).
4. **Keep receipt** (default on) stores a downscaled JPEG, with phone location data removed, in your private folder. PDFs are kept as they are. Untick it to keep only the data.

### Importing the month-end statement

1. **Import**, choose the PDF, choose or create the account.
2. The preview shows:
   - **Checks** against the statement's TOTAL CREDIT, TOTAL DEBIT and ENDING BALANCE. If one fails, you must tick "import anyway".
   - **Already imported** rows, which are skipped automatically.
   - **Needs review** rows, with the reason (e.g. "Description re-assembled" on pages where the bank reflowed the text). Amounts and balances are always exact.
   - **Your entry** for each row: **Matched** when exactly one entry fits; **Check this match** when several fit (the closest date is pre-selected, so change it if needed). You can always pick "Not matched".
   - **"N of your bank entries in this period aren't on this statement"**: worth a look. It could be a wrong amount, cash marked as bank, or another account.
3. **Import.** Re-importing never creates duplicates or double links.

**Matching rule:** same type, the **exact** amount, dates at most **3 days** apart, and only unmatched bank entries. Each statement row matches at most one entry, and vice versa. The server re-checks every proposed match before linking. Anything the rule misses (card holds, foreign-currency differences) can be linked by hand on the entry page: same type, within 7 days, any amount.

### What each dashboard counts

- **Budget (`/`):** your entries, plus statement rows with no matching entry. For a matched pair, your entry's category and notes are used, and the purchase counts once.
  - **Awaiting statement:** bank entries the latest imported statement doesn't reach yet.
  - **Not on statement:** bank entries dated well within an imported statement's period that still aren't matched.
- **Statements (`/statements`):** imported rows only, exactly as the bank reported them. Opening and closing balances follow the running-balance chain. They're marked "approximate" if rows are missing.

Categories on statement rows come from keyword rules (`category_rules`). The lowest `priority` wins, and rules you save from the expense page use priority 1. Rules only apply to future imports.

## How it works

- **Statement parser** (`src/lib/import/`, pure TypeScript, tested):
  - groups pdf.js text by position and drops repeated page headers and footers
  - starts each row at a date and stitches descriptions across page breaks
  - takes **income vs expense from the running balance change**, with the trailing `+`/`-` as a cross-check
  - re-splits reflowed pages by transaction-type phrases
  - **Duplicate key:** SHA-256 of account, date, type, amount, running balance and an occurrence counter. The description is left out on purpose, so improving the parser can't make old rows look new.
- **Receipt reader** (`src/lib/receipt/`):
  - `read-receipt.ts` OCRs photos with self-hosted Tesseract after an orientation fix, grayscale and contrast stretch. It reads a PDF's text layer directly, with OCR as the fallback for scans.
  - `parse-receipt.ts` (pure, tested) suggests the amount, date (DMY, ISO, English and Malay month names), merchant and type.
- **Matching** (`src/lib/entries/match.ts`, pure, tested): a one-to-one assignment, closest date first, used by the import preview and re-checked on the server.
- **Dashboards** (`src/lib/dashboard/`, pure, tested): month totals, category breakdown with an "Other" bucket, 6-month series, daily series, entry status, and opening/closing balance from the balance chain.

Dev-only demos (they 404 in production): **/dev/pdf-spike** (statement parser) and **/dev/receipt-spike** (receipt OCR and suggestions). Nothing is saved.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, single run |

`NEXT_DIST_DIR=.next-verify npm run build` builds into a separate folder, so it doesn't disturb a running `npm run dev`. Next.js then adds `.next-verify` entries to `tsconfig.json` and `next-env.d.ts`. Remove them, and delete the folder, afterwards.

## Project structure

```
src/
  app/
    page.tsx                 Budget dashboard
    statements/              Statement dashboard
    entries/                 List, filters, Server Actions; new/ (receipt + form); [id]/ (edit, receipt, link, delete)
    import/                  Statement import, matching preview, Server Actions (validate, insert, link)
    expenses/                Statement rows list + detail/edit
    login/, auth/confirm/    Email/password auth
    actions/budgets.ts       Budget limit Server Actions
    dev/                     Dev-only parser and receipt demos
  components/
    charts/                  Donut, monthly bars, daily line (Recharts, accessible fallbacks)
    dashboard/, entries/     Stat cards, budget bars/forms, match badge
    ui/                      shadcn-style primitives
    month-picker.tsx, site-header.tsx, nav-links.tsx
  lib/
    import/                  Statement parser, categorization, dedupe, payload validation
    receipt/                 OCR loader (browser) + receipt text parser (pure)
    entries/                 Entry validation, matching, list URL state
    dashboard/               Aggregations, balances, loaders
    month.ts, budget.ts, spending.ts, expenses-query.ts, transaction-update.ts
    supabase/                Browser/server clients
  middleware.ts              Session refresh + redirect to /login
scripts/copy-vendor-assets.mjs
supabase/schema.sql, verify.sql, migrations/002_entries.sql, migrations/002_verify.sql
```

## Privacy

- Statements and receipts are read **in your browser**. OCR assets are self-hosted, so no third-party service sees your images.
- Only the extracted data goes to your Supabase project, plus receipt files if you choose to keep them. Those are stored in a private bucket under your user folder, readable only by you through links that expire after 10 minutes. Deleting an entry or replacing a receipt deletes the old file.
- `*.pdf` is git-ignored. Test fixtures are synthetic.

## Manual test checklist

- Signed out, `/` redirects to `/login`. Sign up, then sign out and sign in again.
- **Add entry:**
  - A receipt photo pre-fills the amount, date and merchant.
  - A manual cash expense saves.
  - A receipt you choose to keep appears under **Storage → receipts** and on the entry page.
- **Entries:** filter by month, type and status, and search. On an entry, edit it, replace and then remove the receipt, and delete it.
- **Import August with matching entries:**
  - A bank entry for RM 3.50 dated 2–4 Aug shows **Matched**.
  - A RM 9.00 entry shows **Check this match**.
  - After import, the entry shows "Matched to statement", and re-importing adds nothing.
- **Budget dashboard (August):**
  - A matched purchase counts once, with your entry's category.
  - The limits and per-category bars update.
  - The status chips link to the filtered entries.
- **Statement dashboard (August):** money in RM 4,423.88, money out RM 2,046.62, opening RM 1,074.30, closing RM 3,451.56 (exact).
- **Keyboard only:** every page can be used with Tab/Enter/Space, with visible focus rings.

## Known limitations

- **Supported statements:** only Maybank **savings** statements. A credit card parser can be added to `PARSERS` in `src/lib/import/index.ts`.
- **OCR accuracy:** it's moderate on faded or crumpled thermal receipts. That's why every field is reviewed before saving.
- **Image formats:** HEIC photos only open in browsers that support HEIC (Safari). Elsewhere, use JPG/PNG (iPhone: Settings → Camera → Formats → Most Compatible).
- **Data volume:** the dashboards load up to 10,000 rows per 6-month window, which is fine at personal scale.
- **"Not on statement":** this uses the latest imported statement date for all accounts.
- **No Content-Security-Policy header yet** (see `next.config.mjs`).
- **Accessibility:** labels, focus states, headings, chart text alternatives and screen-reader text were checked in code. Full WCAG conformance still needs manual testing with assistive technology.
