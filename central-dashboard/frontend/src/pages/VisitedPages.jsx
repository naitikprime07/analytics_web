import React from "react";
import { api } from "../api/client.js";
import { useApi } from "../lib/useApi.js";
import { useFilters } from "../components/Layout.jsx";
import DataTable from "../components/DataTable.jsx";
import { ErrorState, Empty } from "../components/StateViews.jsx";
import { PageSkeleton } from "../components/Skeleton.jsx";
import { fmtNumber } from "../lib/format.js";

function fmtSec(s) {
  if (s == null) return "—";
  const n = Math.round(s);
  return n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${n % 60}s`;
}

// Most-visited paths, from custom-tracked page_view / page_duration events.
export default function VisitedPages() {
  const f = useFilters();
  const deps = [f.account, f.project, f.domain, f.preset, f.from, f.to, f.visitor, f.session, f.path, f.event];
  const params = { project: f.project, domain: f.domain, preset: f.preset, from: f.from, to: f.to, visitor: f.visitor, session: f.session, path: f.path, event: f.event };
  const { data, loading, error } = useApi(() => api.journeyPages(params), deps);

  if (loading) return <PageSkeleton variant="table" cols={4} rows={9} />;
  if (error) return <ErrorState message={error} />;

  const rows = data?.rows;
  return (
    <>
      <h2 className="pagetitle">Visited Pages <span className="badge">custom tracked</span></h2>
      <p className="foot" style={{ marginTop: "-8px", marginBottom: 18 }}>
        Avg time counts only ACTIVE (tab-visible) time. Rolling 30-day window.
      </p>
      {rows == null ? (
        <Empty text="Page data unavailable right now (Analytics Engine query failed or not verified yet)." />
      ) : !rows.length ? (
        <Empty text="No tracked page views yet. Install analytics.js and complete Phase 0/1." />
      ) : (
        <DataTable
          columns={[
            { key: "path", label: "Path" },
            { key: "views", label: "Views", align: "right", render: (r) => fmtNumber(r.views) },
            { key: "visitors", label: "Visitors", align: "right", render: (r) => fmtNumber(r.visitors) },
            { key: "avgSeconds", label: "Avg active", align: "right", render: (r) => fmtSec(r.avgSeconds) },
          ]}
          rows={rows}
        />
      )}
    </>
  );
}
