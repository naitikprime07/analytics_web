import React, { useState } from "react";
import { api } from "../api/client.js";
import { useApi } from "../lib/useApi.js";
import { useFilters } from "../components/Layout.jsx";
import { ErrorState, Empty } from "../components/StateViews.jsx";
import { PageSkeleton } from "../components/Skeleton.jsx";
import { fmtNumber, fmtDate } from "../lib/format.js";

function fmtSec(s) {
  if (s == null) return "—";
  const n = Math.round(s);
  return n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${n % 60}s`;
}

// Individual visitor journeys (custom-tracked via Analytics Engine). Anonymous
// visitor IDs only; each visitor's events are grouped into their sessions.
export default function Visitors() {
  const f = useFilters();
  const deps = [f.account, f.project, f.domain, f.preset, f.from, f.to];
  const params = { project: f.project, domain: f.domain, preset: f.preset, from: f.from, to: f.to };

  const [sel, setSel] = useState(null);
  const list = useApi(() => api.visitors(params), deps);
  const detail = useApi(
    () => (sel ? api.visitorDetail({ ...params, id: sel }) : Promise.resolve(null)),
    [sel, ...deps],
    { live: !!sel }
  );

  if (list.loading) return <PageSkeleton variant="table" cols={6} rows={8} />;
  if (list.error) return <ErrorState message={list.error} />;
  const rows = list.data?.rows;

  // group the selected visitor's ordered events into sessions (first-seen order)
  const groups = [];
  const byId = new Map();
  for (const e of detail.data?.rows || []) {
    if (!byId.has(e.sessionId)) {
      const g = { sessionId: e.sessionId, rows: [] };
      byId.set(e.sessionId, g);
      groups.push(g);
    }
    byId.get(e.sessionId).rows.push(e);
  }

  return (
    <>
      <h2 className="pagetitle">Visitors <span className="badge">custom tracked</span></h2>
      <p className="foot" style={{ marginTop: "-8px", marginBottom: 18 }}>
        Anonymous visitor IDs (browser/device), grouped into sessions. No personal data. Rolling 30-day window.
      </p>

      {rows == null ? (
        <Empty text="Visitor data unavailable right now (Analytics Engine query failed or not verified yet)." />
      ) : !rows.length ? (
        <Empty text="No tracked visitors yet. Install analytics.js and complete Phase 0/1." />
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Visitor</th><th>Country</th><th>Domain</th>
                <th style={{ textAlign: "right" }}>Sessions</th>
                <th style={{ textAlign: "right" }}>Page views</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.visitorId} onClick={() => setSel(r.visitorId)} style={{ cursor: "pointer" }}>
                  <td><code>{String(r.visitorId).slice(0, 10)}</code></td>
                  <td>{r.country || "—"}</td>
                  <td>{r.domain || "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmtNumber(r.sessions)}</td>
                  <td style={{ textAlign: "right" }}>{fmtNumber(r.pageViews)}</td>
                  <td>{fmtDate(r.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sel && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>
            Visitor journey <span className="sub"><code>{String(sel).slice(0, 14)}</code></span>
            <button className="chip more" style={{ marginLeft: 12 }} onClick={() => setSel(null)}>close</button>
          </h3>
          {detail.loading ? <p className="state loading">Loading…</p> : detail.error ? <ErrorState message={detail.error} /> : (
            !detail.data?.available ? <Empty text="Visitor detail unavailable (query failed or not verified yet)." /> :
            !groups.length ? <Empty text="No events for this visitor." /> : groups.map((g, i) => (
              <div key={g.sessionId} style={{ marginTop: i ? 16 : 0 }}>
                <h4 style={{ margin: "6px 0" }}>
                  Session {i + 1} <span className="sub"><code>{String(g.sessionId).slice(0, 10)}</code></span>
                </h4>
                <div className="tablewrap">
                  <table>
                    <thead><tr><th>Time</th><th>Event</th><th>Path</th><th style={{ textAlign: "right" }}>Active time</th></tr></thead>
                    <tbody>
                      {g.rows.map((e, j) => (
                        <tr key={j}>
                          <td>{fmtDate(e.timestamp)}</td>
                          <td><span className="badge">{e.event}</span></td>
                          <td>{e.path || "—"}</td>
                          <td style={{ textAlign: "right" }}>{e.duration ? fmtSec(e.duration) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
