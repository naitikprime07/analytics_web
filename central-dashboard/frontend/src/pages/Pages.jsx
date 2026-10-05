import React from "react";
import { api } from "../api/client.js";
import { useApi } from "../lib/useApi.js";
import { useFilters } from "../components/Layout.jsx";
import DataTable from "../components/DataTable.jsx";
import { ErrorState, NotAvailable } from "../components/StateViews.jsx";
import { PageSkeleton } from "../components/Skeleton.jsx";

// Pages projects: name + production subdomain + branch. Per Pages "traffic"
// alag dataset nathi -> N/A (fabrication nathi). Traffic joiye to tena custom
// domain select kari ne zone analytics dekho.
export default function Pages() {
  const f = useFilters();
  const { data, loading, error } = useApi(() => api.pages(), []);
  if (loading) return <PageSkeleton variant="table" cols={4} rows={6} />;
  if (error) return <ErrorState message={error} />;

  // respect the filter bar (static list -> filter client-side)
  let rows = data?.pages || [];
  if (f.account) rows = rows.filter((p) => p.account === f.account);
  if (f.project) rows = rows.filter((p) => p.pagesName === f.project);
  const scope = (f.account ? ` · account: ${f.account}` : "") + (f.project ? ` · filtered to ${f.project}` : "");
  return (
    <>
      <h2 className="pagetitle">Pages projects <span className="sub">{rows.length} shown{scope}</span></h2>
      <DataTable
        columns={[
          { key: "pagesName", label: "Project" },
          { key: "subdomain", label: "Production domain", render: (r) => r.subdomain || <span className="na">Not available</span> },
          { key: "productionBranch", label: "Branch", render: (r) => r.productionBranch || <span className="na">Not available</span> },
          { key: "traffic", label: "Traffic", render: () => <NotAvailable note="Pages traffic not exposed as a separate Cloudflare metric; select the linked domain to view zone analytics." /> },
        ]}
        rows={rows}
      />
    </>
  );
}
