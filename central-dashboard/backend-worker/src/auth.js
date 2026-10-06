/**
 * HTTP Basic Auth for the dashboard / read / admin API (replaces Cloudflare Access).
 *
 * The public tracking ingest (`POST /api/track`) is handled by the caller BEFORE this
 * check runs, so visitor browsers on tracked sites never receive a login prompt.
 *
 * Credentials model:
 *   - username is IGNORED (any value works, e.g. "admin")
 *   - the password MUST equal the DASHBOARD_PASSWORD secret
 *   - expected header:  Authorization: Basic base64("<anything>:" + DASHBOARD_PASSWORD)
 *
 * FAIL CLOSED: if DASHBOARD_PASSWORD is not configured, every protected request is
 * denied (503) - auth is never silently skipped. A missing / malformed / wrong
 * credential returns 401 + WWW-Authenticate so a same-origin dashboard navigation
 * triggers the browser's native login box.
 */

const REALM = 'Basic realm="Central Analytics Dashboard", charset="UTF-8"';

function challenge(cors, { status, message }) {
  const headers = { ...cors, "Content-Type": "application/json" };
  // Only advertise the scheme on 401 (a real credential challenge). 503 = misconfigured.
  if (status === 401) headers["WWW-Authenticate"] = REALM;
  return new Response(JSON.stringify({ success: false, error: message }), { status, headers });
}

/**
 * @param {Request} request
 * @param {object} env  - needs env.DASHBOARD_PASSWORD
 * @param {object} cors - CORS headers to echo on the deny responses
 * @returns {Response|null}  Response = deny it now; null = authorized, continue.
 */
export function checkBasicAuth(request, env, cors = {}) {
  // Fail closed: no password configured -> refuse everything protected.
  if (!env.DASHBOARD_PASSWORD) {
    return challenge(cors, { status: 503, message: "Dashboard auth not configured (set DASHBOARD_PASSWORD secret)" });
  }

  const header = (request.headers.get("Authorization") || "").trim();
  const m = /^Basic\s+(\S.*)$/i.exec(header);
  if (!m) return challenge(cors, { status: 401, message: "Unauthorized" });

  let decoded;
  try {
    decoded = atob(m[1].trim()); // "user:pass"
  } catch {
    return challenge(cors, { status: 401, message: "Unauthorized" });
  }

  const sep = decoded.indexOf(":");
  const pass = sep === -1 ? decoded : decoded.slice(sep + 1); // username ignored

  // Length-guarded, non-short-circuit compare (avoids early-exit timing leaks).
  if (pass.length !== env.DASHBOARD_PASSWORD.length) {
    return challenge(cors, { status: 401, message: "Unauthorized" });
  }
  let diff = 0;
  for (let i = 0; i < pass.length; i++) diff |= pass.charCodeAt(i) ^ env.DASHBOARD_PASSWORD.charCodeAt(i);
  if (diff !== 0) return challenge(cors, { status: 401, message: "Unauthorized" });

  return null; // authorized
}
