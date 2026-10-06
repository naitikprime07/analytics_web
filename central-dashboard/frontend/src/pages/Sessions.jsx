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

// Session list + drill-down timeline (custom-tracked via Analytics Engine).
export default function Sessions() {
  const f = useFilters();
  const deps = [f.account, f.project, f.domain, f.preset, f.from, f.to, f.visitor, f.session, f.path, f.event];
  const params = { project: f.project, domain: f.domain, preset: f.preset, from: f.from, to: f.to, visitor: f.visitor, session: f.session, path: f.path, event: f.event };

  const [sel, setSel] = useState(null);
  const list = useApi(() => api.sessions(params), deps);
  const detail = useApi(
    () => (sel ? api.sessionDetail({ ...params, id: sel }) : Promise.resolve(null)),
    [sel, ...deps],
    { live: !!sel }
  );

  if (list.loading) return <PageSkeleton variant="table" cols={6} rows={8} />;
  if (list.error) return <ErrorState message={list.error} />;
  const rows = list.data?.rows;

  return (
    <>
      <h2 className="pagetitle">Sessions <span className="badge">custom tracked</span></h2>
      <p className="foot" style={{ marginTop: "-8px", marginBottom: 18 }}>Session start/end derived from activity + the 30-min inactivity timeout (not a client exit event). Rolling 30-day window. Click a row for the timeline.</p>
      {rows == null ? (
        <Empty text="Session data unavailable right now (Analytics Engine query failed or not verified yet)." />
      ) : !rows.length ? (
        <Empty text="No tracked sessions yet. Install analytics.js and complete Phase 0/1." />
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Started</th><th>Country</th><th>Domain</th>
                <th style={{ textAlign: "right" }}>Pages</th><th style={{ textAlign: "right" }}>Duration</th><th>Session</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sessionId} onClick={() => setSel(r.sessionId)} style={{ cursor: "pointer" }}>
                  <td>{fmtDate(r.startedAt)}</td>
                  <td>{r.country || "—"}</td>
                  <td>{r.domain || "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmtNumber(r.pageViews)}</td>
                  <td style={{ textAlign: "right" }}>{fmtSec(r.seconds)}</td>
                  <td><code>{String(r.sessionId).slice(0, 8)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sel && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>
            Session timeline <span className="sub"><code>{String(sel).slice(0, 12)}</code></span>
            <button className="chip more" style={{ marginLeft: 12 }} onClick={() => setSel(null)}>close</button>
          </h3>
          {detail.loading ? <p className="state loading">Loading…</p> : detail.error ? <ErrorState message={detail.error} /> : (
            !detail.data?.available ? <Empty text="Session detail unavailable (query failed or not verified yet)." /> :
            !detail.data.rows.length ? <Empty text="No events for this session." /> : (
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Time</th><th>Event</th><th>Path</th><th style={{ textAlign: "right" }}>Duration</th></tr></thead>
                  <tbody>
                    {detail.data.rows.map((e, i) => (
                      <tr key={i}>
                        <td>{fmtDate(e.timestamp)}</td>
                        <td><span className="badge">{e.event}</span></td>
                        <td>{e.path || "—"}</td>
                        <td style={{ textAlign: "right" }}>{e.duration ? fmtSec(e.duration) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}
