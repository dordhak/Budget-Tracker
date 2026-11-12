# Budget Tracker

A personal budget tracker with Maybank savings statement import.

- **Dashboard** (`/`): total income, total expenses, balance, this month's spending against the sum of your category limits *and* against a single overall monthly limit, and a 30-day spending chart.
- **Expenses** (`/expenses`): paginated table with search (merchant/description) and a category filter. State lives in the URL.
- **Expense detail** (`/expenses/[id]`): full transaction details; edit the category and personal notes, optionally saving the category as a keyword rule for future imports.
- **Import** (`/import`): upload a Maybank savings statement PDF. It is parsed in the browser, checked against the statement totals, previewed, de-duplicated and bulk-inserted.

Stack: Next.js 15 (App Router), React 19, Tailwind CSS 3 + shadcn/ui-style components, Recharts, Supabase (Auth + Postgres), pdf.js, Vitest. Currency is MYR.

## Setup

### 1. Requirements

- Node.js 20 or newer (developed on Node 26 via nvm).
- A Supabase project (the free tier is fine).

### 2. Install

```bash
npm install
```

The `postinstall` script copies the pdf.js worker (`pdf.worker.min.mjs`) from `node_modules/pdfjs-dist` into `public/`. It always matches the installed `pdfjs-dist` version, and the worker is served locally (no CDN), so statements never leave your machine while being parsed. If PDF import ever reports a worker error, run `npm install` again.

### 3. Database

In the Supabase dashboard, open **SQL Editor** and run:

1. `supabase/schema.sql`: tables, row level security, indexes, starter category rules and the dashboard functions. Safe to re-run.
2. `supabase/verify.sql` (optional): checks that each user only sees their own rows and that duplicate imports are rejected. It runs in a transaction that is rolled back, so it leaves nothing behind. Every check should print `PASS`.

If you created your account *before* running `schema.sql`, run the whole file again; the last statement seeds your settings row and starter category rules.

### 4. Auth settings

In **Authentication**:

- **Sign In / Providers → Email**: email sign-in must be enabled. For a local personal app you can turn **Confirm email** off, so sign-up logs you in straight away. Supabase's built-in mailer only sends a few emails per hour. If you keep confirmation on, use your own SMTP.
- **URL Configuration**: add `http://localhost:3000/auth/confirm` to the redirect URLs (used by confirmation emails).

### 5. Environment

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from **Project Settings → API**. The anon key is meant to be public: row level security restricts every query to the signed-in user. `.env.local` is git-ignored. Never commit it, and never use the `service_role` key in this app.

### 6. Run

```bash
npm run dev
```

Open http://localhost:3000. You'll be sent to `/login` to create an account.

## Importing a statement

1. Download the statement PDF from Maybank2u (personal accounts only offer PDF).
2. Go to **Import**, choose the PDF, then choose an account or create one (e.g. "Maybank Savings").
3. Review the preview:
   - **Checks** compare the parsed rows with the statement's TOTAL CREDIT, TOTAL DEBIT and ENDING BALANCE. If any check fails, you must tick "import anyway" before importing.
   - **Already imported** rows are skipped automatically.
   - **Needs review** rows are highlighted with the reason (for example "Description re-assembled", for pages where the bank reflowed the description text). Amounts and balances are always taken from their own columns, so they are exact even then.
   - Untick any row you don't want.
4. Click **Import**. Re-importing the same or an overlapping statement never creates duplicates.

Categories come from keyword rules (Supabase table `category_rules`). Rules match merchant + description, case-insensitively. The lowest `priority` wins, and rules saved from the expense page use priority 1, so they beat the starter rules. Rules only apply to future imports.

### How the parser works

`src/lib/import/` is pure TypeScript (no React), tested with Vitest:

- Groups pdf.js text items into lines by position (the order pdf.js returns them in is ignored) and finds the column header and footer on each page to drop repeated headers.
- Rows start at a date (`DD/MM/YY`; `DD/MM/YYYY` and year-less dates are tolerated). Description lines that follow, including those continuing on the next page, belong to that row.
- Amounts use a trailing sign (`21.00-`, `2,090.47+`). **Income vs expense comes from the running balance change.** The sign is only a cross-check, and any disagreement is flagged.
- Pages whose description column doesn't line up with the date rows are re-split using known transaction-type phrases (`SALE DEBIT`, `IBK FUND TFR FR A/C`, …). Those rows are flagged for review.
- Duplicate key: SHA-256 of account, date, type, amount, running balance and an occurrence counter. The description is deliberately left out, because a parser improvement could change a re-assembled description and make old rows look new.

To test the parser on a real statement without saving anything, run `npm run dev` and open **/dev/pdf-spike** (development only; it 404s in production).

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
    page.tsx                 Dashboard (Server Component)
    expenses/page.tsx        Expenses list (Server Component; filters are a small Client Component)
    expenses/[id]/           Detail page + edit form + Server Action
    import/                  Import page, client importer, Server Actions (validate + insert)
    login/, auth/confirm/    Email/password auth
    actions/budgets.ts       Budget limit Server Actions
    dev/pdf-spike/           Dev-only parser demo
  components/                UI (shadcn-style), dashboard widgets, header/nav
  lib/
    import/                  Statement parser, categorization, dedupe, payload validation
    supabase/                Browser/server clients
    budget.ts, spending.ts, expenses-query.ts, transaction-update.ts   Pure helpers (tested)
  middleware.ts              Session refresh + redirect to /login
supabase/schema.sql, verify.sql
```

## Privacy

- Statement PDFs are parsed in your browser. Only the parsed rows are sent to your Supabase project.
- `*.pdf` is git-ignored so real statements don't get committed. Test fixtures are synthetic: they reuse a real statement's layout and amounts, with personal names and numbers replaced.

## Manual test checklist

- Signed out, `/` redirects to `/login`. Sign up, then sign out and sign in again.
- Dashboard: set an overall limit and two category limits; both bars and the category total update.
- Import the August statement: preview shows 91 rows and four ✓ checks, and only page 9 rows are flagged. Import, then import again: 0 new rows.
- Dashboard totals: income RM 4,423.88, expenses RM 2,046.62. The balance excludes the statement's opening balance, which isn't a transaction.
- Expenses: search "grab", filter by Transport, page through the results, then use the back button; the filters are kept.
- Detail: change a category, add a note, save a keyword rule; the list and dashboard reflect the change.
- Keyboard only: every page can be used with Tab/Enter/Space, with visible focus rings. The "Skip to content" link appears on the first Tab.

## Known limitations

- Only Maybank **savings** statements are supported. Credit card statements need their own parser (different columns, no running balance). It can be added to `PARSERS` in `src/lib/import/index.ts`.
- The dashboard balance is income minus expenses of imported rows, not your bank balance.
- Category filter options are read from your expense rows (capped at 10,000), which is fine at personal scale.
- No Content-Security-Policy header yet (see `next.config.mjs`).
- Accessibility: labels, focus states, headings and screen-reader text were checked in code. Full WCAG conformance still needs manual testing with assistive technology.
