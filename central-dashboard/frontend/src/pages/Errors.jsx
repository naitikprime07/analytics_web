import React from "react";
import { api } from "../api/client.js";
import { useApi } from "../lib/useApi.js";
import { useFilters } from "../components/Layout.jsx";
import DataTable from "../components/DataTable.jsx";
import { ErrorState } from "../components/StateViews.jsx";
import { PageSkeleton } from "../components/Skeleton.jsx";
import { fmtNumber } from "../lib/format.js";

// HTTP error analytics: only 4xx/5xx rows Cloudflare returns (no invented data).
export default function Errors() {
  const f = useFilters();
  const params = { account: f.account, project: f.project, domain: f.domain, preset: f.preset, from: f.from, to: f.to };
  const { data, loading, error } = useApi(() => api.errors(params), [f.account, f.project, f.domain, f.preset, f.from, f.to]);
  if (loading) return <PageSkeleton variant="table" cols={3} rows={6} />;
  if (error) return <ErrorState message={error} />;

  const rows = data?.rows || [];
  const total4 = rows.filter((r) => r.status >= 400 && r.status < 500).reduce((s, r) => s + (r.requests || 0), 0);
  const total5 = rows.filter((r) => r.status >= 500).reduce((s, r) => s + (r.requests || 0), 0);

  return (
    <>
      <h2 className="pagetitle">Errors <span className="sub">HTTP 4xx/5xx</span></h2>
      <div className="stats">
        <div className="statcard"><div className="stat-num">{fmtNumber(total4)}</div><div className="stat-label">4xx requests</div></div>
        <div className="statcard"><div className="stat-num">{fmtNumber(total5)}</div><div className="stat-label">5xx requests</div></div>
      </div>
      <div className="card">
        <h3>Status breakdown</h3>
        <DataTable
          columns={[
            { key: "status", label: "Status code" },
            { key: "requests", label: "Requests", render: (r) => fmtNumber(r.requests) },
          ]}
          rows={rows.slice().sort((a, b) => (b.requests || 0) - (a.requests || 0))}
        />
      </div>
    </>
  );
}
