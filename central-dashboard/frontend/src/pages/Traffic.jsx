import React from "react";
import { api } from "../api/client.js";
import { useApi } from "../lib/useApi.js";
import { useFilters } from "../components/Layout.jsx";
import TrafficChart from "../components/TrafficChart.jsx";
import DataTable from "../components/DataTable.jsx";
import { ErrorState } from "../components/StateViews.jsx";
import { PageSkeleton } from "../components/Skeleton.jsx";
import { fmtNumber, fmtBytes, fmtDate } from "../lib/format.js";

export default function Traffic() {
  const f = useFilters();
  const params = { account: f.account, project: f.project, domain: f.domain, preset: f.preset, from: f.from, to: f.to };
  const { data, loading, error } = useApi(() => api.traffic(params), [f.account, f.project, f.domain, f.preset, f.from, f.to]);
  if (loading) return <PageSkeleton variant="chart" />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <h2 className="pagetitle">Traffic <span className="sub">granularity: {data?.granularity}</span></h2>
      <div className="card"><TrafficChart series={data?.series || []} /></div>
      <div className="card">
        <h3>Raw series</h3>
        <DataTable
          columns={[
            { key: "t", label: "Time", render: (r) => fmtDate(r.t) },
            { key: "requests", label: "Requests", render: (r) => fmtNumber(r.requests) },
            { key: "bandwidthBytes", label: "Bandwidth", render: (r) => fmtBytes(r.bandwidthBytes) },
          ]}
          rows={(data?.series || []).slice(0, 200)}
        />
      </div>
    </>
  );
}
