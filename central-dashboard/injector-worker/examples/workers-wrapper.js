/**
 * TEMPLATE - User Journey tracking for a WORKER project (e.g. vidshare,
 * xixvideodownloader).
 *
 * Why a wrapper instead of the injector route: a Worker project already produces
 * its own Response; there is no separate zone/origin traffic for the injector to
 * intercept. The simplest fix (fewest moving parts) is to wrap the existing
 * response here with the same HTMLRewriter injection the zone injector uses.
 *
 * HOW TO USE (per Worker project):
 *   1. Copy this file + `../src/snippet.js` into that Worker's src/.
 *   2. Merge your current fetch handler into `renderHtml(request, env)` below
 *      (it must return your HTML Response).
 *   3. Add TRACK_ENDPOINT to that Worker's wrangler.toml [vars].
 *   Non-GET / non-HTML / error responses pass through untouched.
 */

import { SNIPPET } from "../src/snippet.js";

export default {
  async fetch(request, env) {
    const res = await renderHtml(request, env); // <- your existing Worker logic

    if (request.method !== "GET" || !env.TRACK_ENDPOINT) return res;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (res.status < 200 || res.status >= 300 || !ct.includes("text/html")) return res; // 2xx HTML only

    const host = new URL(request.url).hostname;
    const tag = SNIPPET(env.TRACK_ENDPOINT, host);
    // FAIL OPEN: if injection cannot be applied, return the ORIGINAL response.
    try {
      let done = false;
      return new HTMLRewriter()
        .on("head", { element(el) { if (!done) { el.append(tag, { htmlBeforeEnd: true }); done = true; } } })
        .on("body", { element(el) { if (!done) { el.append(tag, { htmlBeforeEnd: true }); done = true; } } })
        .transform(res);
    } catch (err) {
      console.error("[inject] failed, returning original response:", err && err.message);
      return res;
    }
  },
};

// Replace this with the Worker's real handler that returns your HTML Response.
async function renderHtml(request, env) {
  return new Response("<html><head><title>placeholder</title></head><body>Hello</body></html>", {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
