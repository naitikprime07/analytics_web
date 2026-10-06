import React from "react";
import { api } from "../api/client.js";
import { useApi } from "../lib/useApi.js";
import { useFilters } from "../components/Layout.jsx";
import DataTable from "../components/DataTable.jsx";
import PageHeader from "../components/PageHeader.jsx";
import WorldMap from "../components/WorldMap.jsx";
import CountryList from "../components/CountryList.jsx";
import { ErrorState, NotAvailable } from "../components/StateViews.jsx";
import { PageSkeleton } from "../components/Skeleton.jsx";
import { fmtNumber, fmtBytes } from "../lib/format.js";

export default function Countries() {
  const f = useFilters();
  const params = { account: f.account, project: f.project, domain: f.domain, preset: f.preset, from: f.from, to: f.to };
  const { data, loading, error } = useApi(() => api.countries(params), [f.account, f.project, f.domain, f.preset, f.from, f.to]);
  if (loading) return <PageSkeleton variant="table" cols={3} rows={9} />;
  if (error) return <ErrorState message={error} />;

  const rows = data?.rows || [];
  const top = [...rows].sort((a, b) => (b.requests || 0) - (a.requests || 0)).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Countries"
        sub="requests + bandwidth (not users)"
        items={[
          "Cloudflare-native request and bandwidth totals grouped by visitor country for the current filter selection.",
          "These are request/bandwidth counts, NOT unique users - Cloudflare does not report people here.",
          "City-level breakdown is Not available from Cloudflare's native analytics.",
        ]}
      />
      <div className="card country-map-card">
        <div className="cm-grid">
          <div className="cm-map">
            <h3>Requests by Country <span className="sub">world view</span></h3>
            <WorldMap rows={rows} />
          </div>
          <div className="cm-side">
            <div className="cm-side-head"><span>Top Countries</span><span>Requests</span></div>
            <CountryList rows={top} />
          </div>
        </div>
      </div>
      <DataTable
        columns={[
          { key: "country", label: "Country" },
          { key: "requests", label: "Requests", hint: "HTTP requests from this country.", render: (r) => fmtNumber(r.requests) },
          { key: "bandwidthBytes", label: "Bandwidth", hint: "Response bytes served to this country.", render: (r) => fmtBytes(r.bandwidthBytes) },
        ]}
        rows={data?.rows || []}
      />
      <p className="foot">City-level data: <NotAvailable note={data?.cities?.note} /></p>
    </>
  );
}
