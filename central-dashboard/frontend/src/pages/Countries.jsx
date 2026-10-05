import React from "react";
import { api } from "../api/client.js";
import { useApi } from "../lib/useApi.js";
import { useFilters } from "../components/Layout.jsx";
import DataTable from "../components/DataTable.jsx";
import { ErrorState, NotAvailable } from "../components/StateViews.jsx";
import { PageSkeleton } from "../components/Skeleton.jsx";
import { fmtNumber, fmtBytes } from "../lib/format.js";

export default function Countries() {
  const f = useFilters();
  const params = { account: f.account, project: f.project, domain: f.domain, preset: f.preset, from: f.from, to: f.to };
  const { data, loading, error } = useApi(() => api.countries(params), [f.account, f.project, f.domain, f.preset, f.from, f.to]);
  if (loading) return <PageSkeleton variant="table" cols={3} rows={9} />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <h2 className="pagetitle">Countries <span className="sub">requests + bandwidth (not users)</span></h2>
      <DataTable
        columns={[
          { key: "country", label: "Country" },
          { key: "requests", label: "Requests", render: (r) => fmtNumber(r.requests) },
          { key: "bandwidthBytes", label: "Bandwidth", render: (r) => fmtBytes(r.bandwidthBytes) },
        ]}
        rows={data?.rows || []}
      />
      <p className="foot">City-level data: <NotAvailable note={data?.cities?.note} /></p>
    </>
  );
}
