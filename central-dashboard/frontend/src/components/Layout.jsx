import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useFiltersFromLocation } from "../App.jsx";
import { LiveBadge } from "../lib/live.jsx";

const FiltersContext = createContext({});
export const useFilters = () => useContext(FiltersContext);

const NAV = [
  ["Dashboard", "/"],
  ["Projects", "/projects"],
  ["Domains", "/domains"],
  ["Traffic", "/traffic"],
  ["Countries", "/countries"],
  ["Requests", "/requests"],
  ["Bandwidth", "/bandwidth"],
  ["Workers", "/workers"],
  ["Pages", "/pages"],
  ["Errors", "/errors"],
];

const PRESETS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["7d", "Last 7 Days"],
  ["30d", "Last 30 Days"],
  ["90d", "Last 90 Days"],
  ["custom", "Custom Range"],
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const filters = useFiltersFromLocation(location.search);

  const [accounts, setAccounts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [domains, setDomains] = useState([]);
  const [account, setAccount] = useState(null);
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api.accounts(), api.projects(), api.domains(), api.account()])
      .then(([acc, p, d, a]) => {
        if (!alive) return;
        setAccounts(acc.accounts || []);
        setProjects(p.projects || []);
        setDomains(d.domains || []);
        setAccount(a);
      })
      .catch((e) => alive && setLoadErr(e.message));
    return () => { alive = false; };
  }, []);

  // filters nu URL update karva (project/domain/preset/custom)
  const setFilter = (patch) => {
    const q = new URLSearchParams(location.search);
    Object.entries(patch).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    // domain badle project ane domain nu consistency: project delete rakhhi
    navigate({ pathname: location.pathname, search: q.toString() });
  };

  // projects scoped to the selected account (account-wise separation)
  const projectsForAccount = useMemo(() => {
    if (!filters.account) return projects;
    return projects.filter((p) => p.account === filters.account);
  }, [projects, filters.account]);

  const domainsForProject = useMemo(() => {
    let pool = domains;
    if (filters.account) pool = pool.filter((d) => d.account === filters.account);
    if (!filters.project) return pool;
    // domains are tagged with their project (backend discovers apex + subdomains)
    const byProject = pool.filter((d) => d.project === filters.project);
    if (byProject.length) return byProject;
    // fallback: match the project's own domains list
    const proj = projects.find((p) => p.name === filters.project);
    if (!proj || !proj.domains || !proj.domains.length) return pool;
    const set = new Set(proj.domains);
    return pool.filter((d) => set.has(d.domain));
  }, [projects, domains, filters.project, filters.account]);

  return (
    <FiltersContext.Provider value={filters}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="dot" /> Cloudflare Analytics
          </div>
          <nav>
            {NAV.map(([label, to]) => (
              <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => "navitem" + (isActive ? " active" : "")}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="acct">
            {loadErr && <div className="acct-err">Resource load failed: {loadErr}</div>}
            {account && <div className="acct-name">{account.name}</div>}
            <div className="acct-hint">Private admin · Cloudflare Access</div>
          </div>
        </aside>

        <div className="main">
          <header className="filterbar">
            <label>
              Account
              <select value={filters.account} onChange={(e) => setFilter({ account: e.target.value, project: "", domain: "" })}>
                <option value="">ALL ACCOUNTS</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </label>

            <label>
              Project
              <select value={filters.project} onChange={(e) => setFilter({ project: e.target.value, domain: "" })}>
                <option value="">ALL PROJECTS</option>
                {projectsForAccount.map((p) => (
                  <option key={p.type + p.name} value={p.name}>{p.name} ({p.type})</option>
                ))}
              </select>
            </label>

            <label>
              Domain
              <select value={filters.domain} onChange={(e) => setFilter({ domain: e.target.value })}>
                <option value="">ALL DOMAINS{filters.project ? ` (${domainsForProject.length})` : ""}</option>
                {domainsForProject.map((d) => (
                  <option key={d.domain} value={d.domain}>{d.domain}</option>
                ))}
              </select>
            </label>

            <label>
              Date
              <select value={filters.preset} onChange={(e) => setFilter({ preset: e.target.value })}>
                {PRESETS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>

            {filters.preset === "custom" && (
              <>
                <label>From<input type="date" value={filters.from} onChange={(e) => setFilter({ from: e.target.value })} /></label>
                <label>To<input type="date" value={filters.to} onChange={(e) => setFilter({ to: e.target.value })} /></label>
              </>
            )}

            <LiveBadge />
          </header>

          <main className="content">
            <Outlet />
          </main>
        </div>
      </div>
    </FiltersContext.Provider>
  );
}
