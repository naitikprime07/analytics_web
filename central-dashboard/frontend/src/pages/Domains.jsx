import React from "react";
import { api } from "../api/client.js";
import { useApi } from "../lib/useApi.js";
import { useFilters } from "../components/Layout.jsx";
import DataTable from "../components/DataTable.jsx";
import { ErrorState } from "../components/StateViews.jsx";
import { PageSkeleton } from "../components/Skeleton.jsx";

// Domain list (apex + discovered subdomains). Respects the filter bar:
// selected Project narrows to its domains; selected Domain narrows to that one.
export default function Domains() {
  const f = useFilters();
  const { data, loading, error } = useApi(() => api.domains(), []);
  if (loading) return <PageSkeleton variant="table" cols={5} rows={9} />;
  if (error) return <ErrorState message={error} />;

  let rows = data?.domains || [];
  if (f.account) rows = rows.filter((d) => d.account === f.account);
  if (f.project) rows = rows.filter((d) => d.project === f.project || d.domain === f.project);
  if (f.domain) rows = rows.filter((d) => d.domain === f.domain);

  return (
    <>
      <h2 className="pagetitle">Domains <span className="sub">{rows.length} shown{f.account ? ` · account: ${f.account}` : ""}</span></h2>
      <p className="foot">Per-domain analytics mate aa domain select karo (upaar filter bar mathi), ane Dashboard/Traffic tena mate refetch thay.</p>
      <DataTable
        columns={[
          { key: "domain", label: "Domain" },
          { key: "project", label: "Project" },
          { key: "account", label: "Account", width: "170px", render: (r) => r.account || <span className="na">n/a</span> },
          { key: "type", label: "Source" },
          {
            key: "linked",
            label: "Linked",
            render: (r) => (r.linked ? "yes" : <span className="na">no</span>),
          },
        ]}
        rows={rows}
      />
    </>
  );
}
