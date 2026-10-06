import React from "react";
import { api } from "../api/client.js";
import { useApi } from "../lib/useApi.js";
import { useFilters } from "../components/Layout.jsx";
import DataTable from "../components/DataTable.jsx";
import { ErrorState } from "../components/StateViews.jsx";
import { PageSkeleton } from "../components/Skeleton.jsx";
import { fmtNumber } from "../lib/format.js";

// Workers built-in analytics (GraphQL). Query fail/empty -> rows [] -> Empty.
// CPU/duration field Cloudflare mathi aave to j dekhay; natari "Not available".
export default function Workers() {
  const f = useFilters();
  const params = { account: f.account, project: f.project, preset: f.preset, from: f.from, to: f.to };
  const { data, loading, error } = useApi(() => api.workers(params), [f.account, f.project, f.preset, f.from, f.to]);
  if (loading) return <PageSkeleton variant="table" cols={4} rows={6} />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <h2 className="pagetitle">Workers <span className="sub">requests · CPU time (error counts not available from this dataset)</span></h2>
      <DataTable
        columns={[
          { key: "worker", label: "Worker" },
          { key: "requests", label: "Requests", render: (r) => fmtNumber(r.requests) },
          { key: "errors", label: "Errors", render: (r) => fmtNumber(r.errors) },
          {
            key: "cpuTimeMs",
            label: "CPU time",
            render: (r) => (r.cpuTimeMs != null ? `${fmtNumber(Math.round(r.cpuTimeMs))} ms` : <span className="na">Not available</span>),
          },
        ]}
        rows={data?.rows || []}
      />
    </>
  );
}
