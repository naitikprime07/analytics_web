/**
 * Journey HTML-injector Worker (edge auto-inject rollout for Cloudflare zones).
 *
 * Deploy this Worker, then add it as a Custom Route on every Cloudflare zone you
 * want to measure - across BOTH accounts. For each HTML page it fetches the origin
 * and injects a self-contained User Journey snippet before </head>. No origin /
 * site source changes are required ("Only via Cloudflare").
 *
 * The snippet POSTs to the central backend Worker's public /api/track endpoint
 * (env.TRACK_ENDPOINT), which writes to Analytics Engine (user_journey).
 * The backend resolves the tracked hostname to its project + account, so filtering
 * by project/account works for every site.
 *
 * Strict pass-through guarantees (testable, not blanket claims): only GET requests,
 * only 2xx responses, only `text/html` bodies are ever modified. Redirects (3xx),
 * 4xx/5xx, and non-HTML (JSON/API, downloads, video, binary) are returned untouched.
 * If injection cannot be safely applied, the ORIGINAL response is returned as-is
 * (fail open); the injector is designed not to break the origin response.
 *
 * CSP: this DEFAULT injector does NOT inspect, preserve, or modify any
 * Content-Security-Policy header - it only injects an inline <script>. If a zone later
 * enforces a strict CSP that blocks inline scripts, the browser simply skips the script
 * (the page still loads; only tracking is lost). For such a zone deploy the nonce variant
 * (examples/injector-csp-nonce.js), which is the path that actually mints a per-response
 * nonce and opens connect-src while preserving the rest of the policy. Verify each zone's
 * CURRENT CSP header before choosing a variant - do not assume a cached CSP state
 * (see ../USER-JOURNEY.md §5).
 */

import { SNIPPET } from "./snippet.js";

export default {
  async fetch(request, env) {
    // only GET HTML is injected; everything else is a plain pass-through
    if (request.method !== "GET" || !env.TRACK_ENDPOINT) return fetch(request);

    let res;
    try {
      res = await fetch(request);
    } catch (err) {
      return new Response("Bad Gateway", { status: 502 });
    }

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    // inject into 2xx HTML only; never into redirects (3xx), errors, or non-HTML
    // (APIs, downloads, video, binary) - those pass through untouched.
    if (res.status < 200 || res.status >= 300 || !ct.includes("text/html")) return res;

    const host = new URL(request.url).hostname;
    const tag = SNIPPET(env.TRACK_ENDPOINT, host);

    // inject once: prefer <head>, fall back to <body>.
    // FAIL OPEN: if the rewriter cannot be constructed, return the ORIGINAL response
    // untouched rather than erroring - designed so injection cannot break the origin.
    try {
      let done = false;
      return new HTMLRewriter()
        .on("head", {
          element(el) {
            if (!done) {
              el.append(tag, { htmlBeforeEnd: true });
              done = true;
            }
          },
        })
        .on("body", {
          element(el) {
            if (!done) {
              el.append(tag, { htmlBeforeEnd: true });
              done = true;
            }
          },
        })
        .transform(res);
    } catch (err) {
      console.error("[injector] injection failed, passing original response through:", err && err.message);
      return res;
    }
  },
};
