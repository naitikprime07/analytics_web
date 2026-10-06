/**
 * OPTIONAL VARIANT - injector for zones that enforce a strict CSP.
 *
 * Use this variant ONLY for zones that actually enforce a CSP. The plain injector
 * (../src/index.js) is enough for zones that send NO Content-Security-Policy header -
 * CHECK each zone's current header before choosing (see ../USER-JOURNEY.md §5 for a probe
 * command); do NOT assume a zone's CSP state, and do NOT claim a cached "all zones have no
 * CSP" result. A CSP, if present, would block an inline <script> and/or the cross-origin
 * beacon to /api/track - this variant is exactly for that case.
 *
 * Strategy (does NOT weaken the site's CSP - it only adds exactly what is needed):
 *   1. Mint a per-response nonce and put it on the injected <script>.
 *   2. Add 'nonce-...' to the policy's script-src (or default-src if no script-src).
 *   3. Add the /api/track ORIGIN to connect-src (or default-src) so the beacon passes.
 *   If neither relevant directive exists, that resource class is already unrestricted
 *   and we leave the header untouched.
 *
 * Deploy by pointing a zone route at this Worker (same wrangler.toml pattern, main
 * = examples/injector-csp-nonce.js). Requires TRACK_ENDPOINT var.
 */

import { SNIPPET } from "../src/snippet.js";

function genNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/[^A-Za-z0-9+/]/g, ""); // CSP base64 charset only
}

// Insert `token` into the first directive (in priority order) that exists.
// Returns the new CSP, or null if none of those directives are present.
function addToDirective(csp, names, token) {
  for (const n of names) {
    const re = new RegExp("((?:^|;)\\s*" + n + "\\s+)([^;]*)", "i");
    if (re.test(csp)) return csp.replace(re, (_m, head, val) => head + token + " " + val);
  }
  return null;
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" || !env.TRACK_ENDPOINT) return fetch(request);

    let res;
    try {
      res = await fetch(request);
    } catch (err) {
      return new Response("Bad Gateway", { status: 502 });
    }

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (res.status < 200 || res.status >= 300 || !ct.includes("text/html")) return res; // 2xx HTML only

    const host = new URL(request.url).hostname;
    const csp = res.headers.get("content-security-policy");

    // No CSP -> plain inline is fine.
    if (!csp) return inject(res, SNIPPET(env.TRACK_ENDPOINT, host), null);

    // Strict CSP -> nonce the script and open exactly the needed sources.
    const nonce = genNonce();
    let patched = csp;
    const withNonce = addToDirective(patched, ["script-src", "default-src"], `'nonce-${nonce}'`);
    if (withNonce) patched = withNonce;
    const epOrigin = new URL(env.TRACK_ENDPOINT).origin;
    const withConnect = addToDirective(patched, ["connect-src", "default-src"], epOrigin);
    if (withConnect) patched = withConnect;

    return inject(res, SNIPPET(env.TRACK_ENDPOINT, host, nonce), patched);
  },
};

function inject(res, tag, cspOverride) {
  let out;
  try {
    let done = false;
    out = new HTMLRewriter()
      .on("head", { element(el) { if (!done) { el.append(tag, { htmlBeforeEnd: true }); done = true; } } })
      .on("body", { element(el) { if (!done) { el.append(tag, { htmlBeforeEnd: true }); done = true; } } })
      .transform(res);
  } catch (err) {
    // FAIL OPEN: injection broke - return the ORIGINAL response untouched.
    console.error("[inject-csp] failed, returning original response:", err && err.message);
    return res;
  }
  if (!cspOverride) return out;
  const headers = new Headers(out.headers);
  headers.set("content-security-policy", cspOverride);
  return new Response(out.body, { status: out.status, statusText: out.statusText, headers });
}
