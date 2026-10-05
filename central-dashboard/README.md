# Central Cloudflare Analytics Dashboard (Version 1)

Ek **private admin dashboard** jo tamara badha Cloudflare projects/domains nu analytics
**sudhu Cloudflare-native free APIs mathi** dekhay.

- NO D1, NO R2, NO external database
- NO paid / third-party analytics (Google/Mixpanel/etc.)
- NO custom user tracking in V1 (Cloudflare native data first)
- Architecture: `Browser -> React frontend (Cloudflare Pages) -> backend Worker -> Cloudflare REST/GraphQL API`
- Auth: **Cloudflare Access** (Zero Trust, free 50 seats) - koi password code ma nathi
- CF API token **sudhu Worker secrets ma** - frontend/HTML/localStorage/git ma KABHI nahi

> Note: aa ek **independent module** che. Tamari existing `../tracking-module/` ane
> `../dashboard-worker/` (Analytics Engine custom tracking) na vapraya - te alag system che.

---

## 1. Folder structure

```
central-dashboard/
  backend-worker/
    wrangler.toml
    src/
      index.js       # router + auth + /api/* handlers
      cloudflare.js  # REST resource discovery (zones/workers/pages) + mapping
      graphql.js     # GraphQL Analytics queries + executor (graceful N/A)
      cache.js       # Cache API + in-memory fallback (no DB)
      metrics.js     # metric catalog + "Not available" rules
  frontend/
    package.json
    vite.config.js   # dev proxy /api -> :8787
    index.html
    public/_redirects # SPA fallback for Cloudflare Pages
    src/
      main.jsx  App.jsx  styles.css
      api/client.js  lib/format.js  lib/useApi.js
      components/ Layout.jsx StatCard.jsx TrafficChart.jsx DataTable.jsx StateViews.jsx
      pages/ Dashboard Projects Domains Traffic Countries Requests Bandwidth Workers Pages Errors
```

---

## 2. Cloudflare API token permissions (minimum)

`dash.cloudflare.com -> My Profile -> API Tokens -> Create Custom Token`:

| Permission | Why |
|---|---|
| Zone > Zone > Read | list zones/domains |
| Zone > Zone Analytics > Read | zone GraphQL analytics (requests, bandwidth, countries, status) |
| Account > Account Analytics > Read | account-level + Workers analytics |
| Account > Workers Scripts > Read | list Workers |
| Account > Pages > Read | list Pages projects |

Account resource: tamaru account. Token ek vaar j dekhay - copy kari ne rakhjo.

---

## 3. PHASE 0 - Live schema/field verification (implement/depend pela mandatory)

`metrics.js` ane `graphql.js` ma jo dataset/field naam che te **best-effort defaults** che.
Cloudflare plan/anu API version pramane naam badlay shake. Ete code rite aa fields
**unverified** che, ane je field na male te auto **"Not available"** dekhay (fake number nathi).

Tame aa ek vaar verify karo (curl - token shell ma, repo ma navi):

```bash
# 3a. introspection: available zone datasets
curl -s https://api.cloudflare.com/client/v4/graphql \
  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"{ __type(name:\"Viewer\") { fields { name } } }"}'

# 3b. overview test (zoneTag = tamari zone id; filter empty rakhyo to badha zones)
curl -s https://api.cloudflare.com/client/v4/graphql \
  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"query($s:Timestamp!,$u:Timestamp!){ viewer{ zones(filter:{zoneTag:\"ZONE_ID\"}){ httpRequestsAdaptiveGroups(limit:1, filter:{datetime_geq:$s, datetime_leq:$u}){ sum{ requests edgeResponseBytes } } } } }","variables":{"s":"2026-09-01T00:00:00Z","u":"2026-10-03T00:00:00Z"}}'
```

Confirm thayela naam `metrics.js`/`graphql.js` ma lock karo, ane aa **verified-against note**
README ma lakho:

```
Verified-against: account <id>, date <YYYY-MM-DD>, datasets: ______
```

**STRICT accuracy rule (prompt mathi):**
- `Requests` = count, `Bandwidth` = bytes. Eka ne byju/eka j label nathi apva.
- `Total Traffic` ke "requests" ne "users" nathi kahayta.
- Je metric Cloudflare free mathi na aave te **hamesha "Not available"**:
  **Unique Users/Visitors, Cities, Device/Browser/OS** (khali Phase 0 confirm thay to j available mark karva).
- Koi 0/estimate/derived/fake calculation **kABHI nathi**.

---

## 4. Backend: local dev + deploy

```bash
cd backend-worker
npx wrangler login
npx wrangler secret put CF_ACCOUNT_ID     # dash.cloudflare.com right-bar mathi
npx wrangler secret put CF_API_TOKEN      # Section 2 mathi
npx wrangler dev                          # http://localhost:8787
# test:
curl "http://localhost:8787/api/account"
curl "http://localhost:8787/api/projects"
curl "http://localhost:8787/api/analytics/overview?preset=7d"

npx wrangler deploy                       # prod
```

Optional vars (`wrangler.toml`): `REQUIRE_ACCESS=true`, `CACHE_TTL=120`.

### Endpoints
`GET /api/account` · `/api/zones` · `/api/workers` · `/api/pages` · `/api/projects` · `/api/domains`
`GET /api/analytics/overview|traffic|countries|errors|workers`
Query: `?project=&domain=&preset=today|yesterday|7d|30d|90d|custom&from=&to=&granularity=hourly|daily`

### Caching (no DB)
`cache.js` Worker Cache API (`caches.default`) vapare `max-age=CACHE_TTL`; local dev
mathi in-memory memo fallback. Repeated API call thatho bachay.

### Error handling
Backend error aav to client ne `"Unable to load Cloudflare analytics."` (502) aave;
actual error `console.error` ma log thay (token KABHI response ma nathi aavto).

---

## 5. Frontend: local dev + build + deploy

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173, /api proxy -> :8787
npm run build          # -> dist/
npx wrangler pages deploy dist   # Cloudflare Pages par
```

Frontend SUDHU relative `/api/*` call kare (secret nathi). Prod mate aa two option:

- **A (recommended, same-origin):** Pages custom domain par Worker nu `/api/*` route
  mount karo, ke Pages Function thi `/api` proxy Worker ne.
- **B:** frontend build karta mate `VITE_API_BASE=https://central-analytics-api.<sub>.workers.dev`
  set karo (tyare Worker CORS open rakhjo).

`public/_redirects` SPA routing mate (`/* -> /index.html 200`) add che.

---

## 6. Auth (Cloudflare Access) - private dashboard

1. Zero Trust dashboard -> Access -> Applications -> Add self-hosted app.
2. Add both the backend Worker custom domain AND the Pages domain as paths.
3. Policy: allow tamari email (SSO/OTP). Free plan: 50 seats.
4. Backend `REQUIRE_ACCESS=true` rakhho: Worker darek request ma
   `Cf-Access-Jwt-Assertion` header check kare (Access enforse kare; local dev ma
   `localhost` ethi pass thay che taake `wrangler dev` thi test kari sake).

Koi multi-user SaaS auth banavvanu nathi - ek admin, Access protected.

---

## 7. Kaun nu metrics Cloudflare mathi male / na male

| Metric | V1 source | Status |
|---|---|---|
| Total Requests | zone `httpRequestsAdaptiveGroups.sum.requests` | Available |
| Bandwidth / traffic bytes | `sum.edgeResponseBytes` | Available (bytes) |
| Countries (requests + bytes) | `ClientCountryName` dimension | Available |
| HTTP errors 4xx/5xx | `EdgeResponseStatus` dimension | Available |
| Traffic over time | `httpRequests1mGroups`/`1dGroups` | Available |
| Workers requests/errors/duration | `workersAdaptiveGroups` | Available (Phase 0 verify) |
| Domains / Projects / Pages lists | REST zones/workers/pages | Available |
| **Unique Users/Visitors** | Cloudflare requests aape, users nahi | **Not available** |
| **Cities** | plan/dataset-gated | **Not available** |
| **Device/Browser/OS** | aa dataset mathi nathi | **Not available** |
| Pages "traffic" | alag Pages dataset nathi | **Not available** (select linked domain) |

---

## 8. Additional Cloudflare projects add karva

Resource list **dynamic discover** thay che (`/api/projects`, `/api/domains`).
Navo domain/project Cloudflare account ma aave to te aapje aavi jashe (re-deploy ke
cache TTL pachhi). Je auto-discovery na thay (jem ke ek Worker je custom-domain nu
route data API mathi na male) te **"no linked domain"** bucket ma dekhay -
tena mate Cloudflare par zone/route banavo, ke future ma ek optional mapping var add
kari shakho (khali manual mapping - database chari).

---

## 9. Testing checklist

- [ ] Phase 0 curl queries chalavya ane `metrics.js`/`graphql.js` fields verify/lock karya.
- [ ] `/api/*` darek endpoint -> 200 JSON ke clean 502 error; response ma token nathi.
- [ ] GraphQL na-male field -> UI "Not available" (0/estimate nathi).
- [ ] Domain select -> suudhu teno data; ALL -> aggregated.
- [ ] Date presets (Today/Yesterday/7/30/90/Custom) -> correct since/until.
- [ ] `npm run build` pass; pages render; loading/empty/error states dekhay.
- [ ] Requests vs Bandwidth alag label/axis rite dekhay.
- [ ] Access lagavta pachhi anonymous request block thay.
