import React from "react";
import { api } from "../api/client.js";
import { useApi } from "../lib/useApi.js";
import { useFilters } from "../components/Layout.jsx";
import StatCard from "../components/StatCard.jsx";
import TrafficChart from "../components/TrafficChart.jsx";
import DataTable from "../components/DataTable.jsx";
import { ErrorState, NotAvailable } from "../components/StateViews.jsx";
import { PageSkeleton, SkeletonTable, Sk } from "../components/Skeleton.jsx";
import { fmtBytes, fmtNumber } from "../lib/format.js";

export default function Dashboard() {
  const f = useFilters();
  const params = { account: f.account, project: f.project, domain: f.domain, preset: f.preset, from: f.from, to: f.to };

  const ov = useApi(() => api.overview(params), [f.account, f.project, f.domain, f.preset, f.from, f.to]);
  const tr = useApi(() => api.traffic(params), [f.account, f.project, f.domain, f.preset, f.from, f.to]);
  const co = useApi(() => api.countries(params), [f.account, f.project, f.domain, f.preset, f.from, f.to]);

  if (ov.loading) return <PageSkeleton variant="dashboard" />;
  if (ov.error) return <ErrorState message={ov.error} />;
  const d = ov.data;

  return (
    <>
      <h2 className="pagetitle">Central Cloudflare Analytics</h2>

      <div className="stats">
        <StatCard metric={d.totals.requests} />
        <StatCard metric={d.totals.bandwidth} />
        <StatCard metric={{ available: true, label: "Total Domains" }} valueLabel={fmtNumber(d.counts.domains)} />
        <StatCard metric={{ available: true, label: "Total Projects" }} valueLabel={fmtNumber(d.counts.projects)} />
        <StatCard metric={d.errorRequests} />
        <StatCard metric={d.uniqueUsers} />
      </div>

      <div className="card">
        <h3>Traffic over time <span className="sub">Requests (left axis) · Bandwidth (right axis, MB)</span></h3>
        {tr.loading ? <Sk h={260} r={10} style={{ marginTop: 14 }} /> : tr.error ? <ErrorState message={tr.error} /> : <TrafficChart series={tr.data?.series || []} />}
      </div>

      <div className="twocol">
        <div className="card">
          <h3>Countries</h3>
          {co.loading ? <SkeletonTable rows={6} cols={3} /> : co.error ? <ErrorState message={co.error} /> : (
            <DataTable
              columns={[
                { key: "country", label: "Country" },
                { key: "requests", label: "Requests", render: (r) => fmtNumber(r.requests) },
                { key: "bandwidthBytes", label: "Bandwidth", render: (r) => fmtBytes(r.bandwidthBytes) },
              ]}
              rows={co.data?.rows || []}
            />
          )}
          <p className="foot">Cities: <NotAvailable note={co.data?.cities?.note} /></p>
        </div>

        <div className="card">
          <h3>Domains</h3>
          <p className="foot">
            Per-domain Requests/Bandwidth dekhva mate upaar aa domain select karo.
            (Dashboard aggregated numbers current selection na che.)
          </p>
          <p className="foot">Unique users Not available che - Cloudflare requests aape, users nahi.</p>
        </div>
      </div>
    </>
  );
}
