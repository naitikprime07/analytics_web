# User Journey Analytics — Setup & Rollout Guide

This layer adds **visitor activity** tracking (page views, sessions, active time-on-page,
entry/exit, page→page navigation, individual visitor journeys) on top of the
Cloudflare-native dashboard. It is a **separate, clearly-labeled** data source —
custom-tracked numbers never mix with Cloudflare-native analytics.

- **Store:** Workers Analytics Engine dataset `user_journey` (auto-creates on first write).
- **Ingest:** site snippet → `POST /api/track` (public) → `writeEvent()` → AE.
- **Read:** dashboard → AE SQL API → Journey / Sessions / Visited Pages / Navigation / Visitors.
- **Rollout — V1 (preferred):** embed the manual [`tracking/analytics.js`](./tracking/analytics.js)
  `<script>` on each site you want to measure.
- **Rollout — Phase 2 (optional):** `injector-worker` stamps the identical snippet onto zones at
  the edge (no site edits). It is a convenience, **not** the foundation. Its guarantees are
  precise and testable (not blanket "safe" claims): it modifies **only `GET` + `2xx` +
  `text/html`** responses, leaves redirects/3xx, 4xx/5xx, JSON/APIs, downloads, video and
  binary **untouched**, and **fails open** (returns the original response if injection can't be
  applied) so the injector does not break the origin response. See §3 Phase 2 and §5.

```
Visitor ──► [analytics.js snippet]  ──POST /api/track──►  backend Worker ──► AE dataset (user_journey)
Dashboard ───────────────────────── AE SQL read (30-day window) ─────► backend Worker ──► Journey pages
```

---

## 0. Data model & rules (read with §1)

**Event types (locked whitelist).** `/api/track` accepts only:

| Event | Meaning |
|---|---|
| `page_view` | a page was seen (carries the referrer / previous-page path) |
| `page_duration` | sent **once** when a page is finalized; `dur` = **active/visible** seconds |
| `navigation` | an in-app route change; `ref` = from-page, `path` = to-page |
| `session_activity` | 30s heartbeat **while the tab is visible** — keeps the session alive, marks last activity |

- **No `session_start` / `session_end`.** A session is `(visitorId, sessionId)`; it rolls over
  after **30 min idle**. Liveness/last-activity comes from `session_activity`. Sending
  `session_start`/`session_end` to `/api/track` now returns **400**.
- **IDs are anonymous.** `visitorId` in `localStorage`, `sessionId` in `sessionStorage`. No
  cookies, no PII; respects Do Not Track. Every event carries its `domain` (hostname) so the
  dashboard can scope journeys per domain / project / account. `visitorId` is **per-origin** —
  the same person is **not** unified across unrelated domains (no cross-domain identity in V1).
  `/api/track` rejects: invalid JSON, unknown events, missing `visitorId`/`sessionId`, **missing
  `domain`**, and **invalid/absent timestamp** (`ts`), plus oversized payloads (413).
- **Active time only.** The clock pauses on `visibilitychange`→hidden, `blur`; resumes on
  visible/`focus`. `page_duration` is emitted once per page (route change or `pagehide`).
- **Entry / exit / session duration are derived** server-side over `page_view` events.
  Ordering uses the **client event timestamp** (`double2`), *not* AE's ingestion time, because
  the client clock is the true order a visitor saw pages while AE ingestion time is
  non-deterministic for rapid/batched writes (`argMin`/`argMax` per session). No client
  exit event is required.
- **Dashboard window:** dashboard read APIs expose a **rolling 30-day window** (a read-side
  query clamp). Analytics Engine may retain data longer; we never state that data is
  physically deleted.
- **API envelope:** dashboard reads → `{"success":true, ...data}`; errors → `{"success":false,
  "error":"..."}`. `/api/track` is public + server-validated; read APIs are behind Access. The
  Access application policy **must bypass/exclude `POST /api/track`** (keeping every other
  path protected) so external sites can submit events — see [`README.md`](./README.md) §6.

### 0.1 Analytics Engine SQL limits — verified live (Phase 0)

We ran a real end-to-end POC (Browser → `/api/track` → AE → SQL → dashboard) against the
live `user_journey` dataset. Workers Analytics Engine SQL is a **restricted
ClickHouse subset**; the dashboard queries are written to the verified-supported subset only:

| Not supported (returns HTTP 422) | Use instead (verified working) |
|---|---|
| `parseDateTimeBestEffort()` | `toDateTime('YYYY-MM-DD HH:MM:SS')` for time bounds |
| `uniq()` / `uniqExact()` / `uniqExactIf()` | `count(DISTINCT blobN)` |
| `any(col)` | `argMax(col, timestamp)` for a representative value |
| `max()` / `min()` on **string** columns | `argMin`/`argMax(col, key)` |
| `ORDER BY` on a non-projected column (bare `timestamp`, `double2`) | project an alias (`timestamp AS ts`) then `ORDER BY ts` |

Confirmed working: `countIf/avgIf/sumIf`, `argMin/argMax`, `GROUP BY`/`HAVING`, `min/max(timestamp)`
(in aggregate context), `LIKE`, string equality, `now() - toIntervalDay(n)`, `ORDER BY` on a
projected alias, and nested subquery aggregation.

**Two honest operational caveats (not query-pattern failures):**
1. **Ingestion is asynchronous + eventually consistent.** A `204` means the event was
   **accepted for ingestion** — validated and submitted to Analytics Engine — **not** that it
   is immediately queryable; a written event typically becomes visible after ~60–120s. A
   deployed Worker submits events to Analytics Engine through the binding, but ingestion is
   asynchronous, so **delivery and queryability should not be treated as synchronous** (no
   at-least-once guarantee is claimed here). Under `wrangler dev --remote` the writer is
   fire-and-forget and a small fraction of events may be dropped. Dashboards must therefore
   treat very-recent counts as best-effort.
2. **No row-level delete.** AE data can only be excluded by time, not deleted. POC/test events
   use `*.example` hostnames so they never collide with real domains and age out of the 30-day
   read window on their own.

---

## 1. Authentication facts (corrected — read this first)

There is **no** Cloudflare token permission called **"Analytics Engine: Write"** or
**"Analytics Engine: Read"** — that permission group **does not exist**. Verified against
the official docs: <https://developers.cloudflare.com/analytics/analytics-engine/sql-api/>.

The correct model:

| Action | How it authenticates | Token scope needed |
|---|---|---|
| **Write** events (`writeDataPoint()`) | The Worker's `[[analytics_engine_datasets]]` **binding**, resolved at `wrangler deploy` time | **None** — it never uses `CF_API_TOKEN` |
| **Read** events (dashboard SQL queries) | `Authorization: Bearer CF_API_TOKEN` on `/accounts/{id}/analytics_engine/sql` | **Account ▸ Account Analytics ▸ Read** |

> Your token should already have **Account Analytics ▸ Read** (see the table in
> [`README.md`](./README.md) §2). **Do not** add any "write" scope — it isn't a thing.

---

## 2. Prerequisites

- Backend Worker secrets set: `CF_API_TOKEN` (Account Analytics Read), `CF_ACCOUNT_ID`.
- A Cloudflare API token per account with **Workers Scripts: Edit** and **Workers Routes: Edit**
  for deploying the injector in that account.
- AE binding + dataset already present in `backend-worker/wrangler.toml`:
  ```toml
  [[analytics_engine_datasets]]
  binding = "AE"
  dataset = "user_journey"
  ```

---

## 3. Rollout plan (in order)

The **foundation is V1** (Step 0–2): deploy the backend and embed `analytics.js` manually.
The **injector is an optional Phase 2** (Step 3–5) for edge auto-inject at scale.

### Step 0 — Local write→read round-trip (no production changes)
Run the backend with `--remote` so AE writes land in the real account and are queryable:
```bash
cd central-dashboard/backend-worker
npx --yes wrangler dev --remote --port 8787 --ip 127.0.0.1
```
In another terminal, send one test event. `ts` must be a **valid current Unix timestamp in
milliseconds**. Server-side validation is intentionally strict about *type*: `/api/track` rejects
a missing / non-numeric / non-positive `ts` with 400. A numeric-but-implausible value like `ts:1`
is accepted (204) but is stored dated 1970, so it falls **outside the dashboard's rolling 30-day
window** and will not appear — which is exactly why the test must use the current time:
```bash
# bash: current epoch milliseconds
TS=$(date +%s%3N)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8787/api/track \
  -H "content-type: application/json" \
  -d "{\"e\":\"page_view\",\"p\":\"escavello.com\",\"d\":\"escavello.com\",\"path\":\"/\",\"v\":\"v-test\",\"s\":\"s-test\",\"ts\":$TS}"
```
> PowerShell equivalent for `TS`: `[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()`
Expected: `204` (**accepted for ingestion** — not a guarantee it is queryable yet; AE ingestion
is async). Open the dashboard → **Journey** → the test visitor should become visible after
ingestion, typically within ~1–2 min.
If nothing shows, use the **troubleshooting order in §6** (do NOT assume a missing token scope).

### Step 1 — Deploy the backend, get its public URL
```bash
npx --yes wrangler secret put CF_ACCOUNT_ID
npx --yes wrangler secret put CF_API_TOKEN
npx --yes wrangler deploy
```
Note the URL, e.g. `https://central-analytics-api.<your-sub>.workers.dev`. This is the single
`/api/track` target for **all** sites/injectors (data from every account pools into one dataset).

### Step 2 — (V1) Embed `analytics.js` on each site
Add one tag per site you want to measure (e.g. before `</head>`):
```html
<script src="https://<your-worker>/tracking/analytics.js"
        data-endpoint="https://central-analytics-api.<your-sub>.workers.dev/api/track"
        data-project="escavello.com" defer></script>
```
`data-project` is a stable grouping label (defaults to the hostname); the backend resolves the
tracked hostname → its project/account across both accounts, so the dashboard filters work.

---

### Phase 2 (optional) — edge auto-inject so you don't edit each site

### Step 3 — Set `TRACK_ENDPOINT` in the injector
Edit `central-dashboard/injector-worker/wrangler.toml`:
```toml
[vars]
TRACK_ENDPOINT = "https://central-analytics-api.<your-sub>.workers.dev/api/track"
```

### Step 4 — Deploy the injector **once per account** + attach zone routes
Cloudflare **Worker Routes are account-scoped** — a Worker can only route zones in its own
account. Your zones live in **two** accounts, so deploy the injector in **each** account (same
code + same `TRACK_ENDPOINT`), using that account's token.

**Route pattern (important — Cloudflare Worker Routes match the HOST exactly):**
`example.com/*` matches **only** the apex host `example.com`; it does **NOT** match
`www.example.com` or any other subdomain. To cover both the apex and all subdomains of a zone,
create **two** Custom Routes per zone:

```
example.com/*        # apex only
*.example.com/*      # all subdomains (www., app., …)
```

Do **NOT** use `*example.com/*` — the leading wildcard also matches unrelated hosts whose names
*end in* your domain (e.g. `notexample.com`), which is unsafe. Use only the two explicit patterns
above; do not create overlapping/duplicate routes.

**Account: Prime-2 — 12 zones** (deploy the injector here, then add TWO Custom Routes per zone:
`<apex>/*` and `*.<apex>/*`):
```
escavello.com   finudge.site   gstvoyana.com   healnest.site   moduvix.com   playwizzy.site
prodkick.site   utilnexa.site   wizzogame.site   xixvideohub.com   zenflora.fun   zevixa.site
```
*(the names above are the zone apexes from `/api/projects`; for each, create the apex route
`<apex>/*` and the subdomain route `*.<apex>/*.)*

**Account: Server@primesoftechs — 4 zones:**
```
cashloanplatform.com   financeloanportal.com   financequizapp.com   financequizword.site
```

The injector only touches **2xx HTML `GET`** responses; redirects (3xx), error pages, and
non-HTML bodies (APIs, downloads, video, binary) pass through **untouched**. If injection cannot
be safely applied it **fails open** (returns the original response unchanged); the injector is
designed not to break the origin response.

### Step 5 — Live verification
1. Open any zone site → **View page source** → you should see the injected `<script>` containing
   `cfj_vid` before `</head>`.
2. Browse a couple of pages, wait **5–10 minutes**.
3. Dashboard → **Journey / Sessions / Visited Pages / Navigation / Visitors** should show real
   rows. Filter by Account or Project to confirm the hostname→project/account resolution works;
   click a Visitor to see their individual journey (events grouped into sessions).

---

## 4. Pages (4) and Workers (2) — not covered by zone Routes

Routes only intercept **zone/DNS traffic**, so they can't touch responses already rendered by a
**Pages** project or another **Worker**. Recommendation for this 4+2 scope:

| Type | Projects | Recommended method | Why |
|---|---|---|---|
| **Workers** | `vidshare`, `xixvideodownloader` | **HTMLRewriter wrapper** (option b) | Simplest: 2 projects, you already own the Worker code — wrap its response with the same snippet. |
| **Pages** | `finvexa-subgame`, `financequizhub`, `financeloanplatform`, `finvexafinance` | **Pages Functions middleware** (better than build-time editing) | One `_middleware.js` per project reuses the shared snippet; no per-file / per-framework build edits across 4 repos. |

Ready-to-use templates (single shared snippet lives in `injector-worker/src/snippet.js`):
- Workers: [`injector-worker/examples/workers-wrapper.js`](./injector-worker/examples/workers-wrapper.js)
- Pages: [`injector-worker/examples/pages-middleware.js`](./injector-worker/examples/pages-middleware.js)

For each, set `TRACK_ENDPOINT` (Worker `[vars]` or Pages environment variable) and copy
`src/snippet.js` into that project. Non-GET / non-HTML / error responses pass through untouched.

> Note: Pages/Workers custom domains must resolve as the tracked hostname for the dashboard's
> project filter to match them; the backend already groups subdomains under their apex.

---

## 5. Content-Security-Policy (CSP) — verify per zone before deploying

**What the injectors actually do (implementation, not assumption):**
- The **default injector** (`injector-worker/src/index.js`) only injects an inline `<script>`.
  It does **not** read, preserve, or modify any `Content-Security-Policy` header. If a zone's
  CSP blocks inline scripts, the browser simply skips the script — the page still loads, only
  tracking is lost (fail-safe; the origin response is not broken).
- The **nonce variant** (`injector-worker/examples/injector-csp-nonce.js`) is the only path that
  touches CSP. For a zone that *does* send a CSP it mints a per-response nonce, appends
  `'nonce-…'` to `script-src` (or `default-src` if there is no `script-src`), and adds the
  `/api/track` origin to `connect-src` (or `default-src`) — **preserving every other directive**
  and leaving the header untouched when neither directive exists (it does not weaken policy).
  Deploy it only where a CSP is actually present.

**Do not assume a zone's CSP state — probe each zone's current header first** (a site owner can
add or change a CSP at any time). This guide deliberately does **not** assert a cached
"all zones have no CSP" result:
```bash
for d in escavello.com ... financequizword.site; do
  echo "== $d =="; curl -sI "https://$d/" | grep -i "content-security-policy" || echo "(no CSP header)"
done
```
Zones with **no** CSP header → the default injector's inline script runs. Zones **with** a
strict CSP → use the nonce variant.

---

## 6. Troubleshooting — "no data after the test curl" (correct order)

Do **not** conclude "the token is missing an Analytics Engine scope" — that scope doesn't exist.
Diagnose in this order:

1. **Check the curl response code.**
   - `204` = **accepted for ingestion** (validated + submitted to AE; ingestion is async, so
     it is not yet a guarantee the row is queryable) → allow ~1–2 min; if still missing, check
     the read side (continue to 2-4).
   - `400` = unknown event / missing `v`/`s` ids / missing `domain` / invalid `ts` / invalid JSON.
   - `403` = origin not in `ALLOWED_ORIGINS`. `413` = payload too large. `429` = rate limited.
   - `500` = **server/configuration error**. Inspect the Worker logs and verify the Analytics
     Engine binding, the dataset name, and other server-side config — do **not** assume every
     500 is a missing binding. Fix the actual reported error first.
2. **Confirm `CF_API_TOKEN` + `CF_ACCOUNT_ID`** are set with **no stray whitespace/newlines**
   (local `.dev.vars`, prod `wrangler secret put`). A malformed value makes reads return `null`
   → the UI shows "Not available".
3. **Confirm binding + dataset names match the code exactly.** `wrangler.toml` uses
   `binding = "AE"` and `dataset = "user_journey"`; `src/analytics-engine.js` must
   reference the same dataset. A mismatch means writes and reads hit different places silently.
4. **Confirm the dashboard SQL uses the same dataset name.** A typo yields empty results with
   no error ("Not available"), never a fake number.

> Local `wrangler dev` **without `--remote`** buffers AE writes inside miniflare — they are **not**
> queryable via the hosted SQL API. Use `wrangler dev --remote` (or a deploy) for the round-trip.

---

## 7. Data-accuracy note

Every AE read is guarded: a failed or unsupported query returns `null`, so the UI shows
"Not available" — the dashboard **never fabricates** journey numbers. `uniqueVisitors` /
`sessions` / `pageViews` here come from **our own tracked events**, and are kept separate from
Cloudflare-native request counts.
