/**
 * TEMPLATE - User Journey tracking for a Cloudflare PAGES project (e.g.
 * finvexa-subgame, financequizhub, financeloanplatform, finvexafinance).
 *
 * Why a Pages Function instead of editing the build: build-time snippet injection
 * means touching index.html / every framework's config across 4 separate repos.
 * A single Pages Functions middleware is simpler - drop one file per Pages project,
 * reuse the exact same snippet, no rebuild coupling. Pages Functions run at the edge
 * and support HTMLRewriter.
 *
 * HOW TO USE (per Pages project):
 *   1. Put this file at  <pages-project>/functions/_middleware.js
 *   2. Copy `src/snippet.js` into that project and fix the import path.
 *   3. Set TRACK_ENDPOINT as a Pages environment variable (dashboard -> Settings ->
 *      Functions -> Environment variables, or wrangler.toml [vars]).
 *   Non-GET / non-HTML / error responses pass through untouched.
 */

import { SNIPPET } from "../src/snippet.js"; // adjust to the copied location

export async function onRequest(context) {
  const res = await context.next(); // the Pages-rendered response
  const env = context.env || {};

  if (context.request.method !== "GET" || !env.TRACK_ENDPOINT) return res;
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (res.status < 200 || res.status >= 300 || !ct.includes("text/html")) return res; // 2xx HTML only

  const host = new URL(context.request.url).hostname;
  const tag = SNIPPET(env.TRACK_ENDPOINT, host);
  // FAIL OPEN: if injection cannot be applied, return the ORIGINAL Pages response.
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
}
