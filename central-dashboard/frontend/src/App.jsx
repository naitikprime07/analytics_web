import React, { useMemo } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LiveProvider } from "./lib/live.jsx";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Projects from "./pages/Projects.jsx";
import Domains from "./pages/Domains.jsx";
import Traffic from "./pages/Traffic.jsx";
import Countries from "./pages/Countries.jsx";
import Requests from "./pages/Requests.jsx";
import Bandwidth from "./pages/Bandwidth.jsx";
import Workers from "./pages/Workers.jsx";
import Pages from "./pages/Pages.jsx";
import Errors from "./pages/Errors.jsx";

// Filter state (project / domain / date) URL query param mathi aavte - refresh/
// share thathu rahe. Layout ma aa state set thay.
export function useFiltersFromLocation(search) {
  return useMemo(() => {
    const q = new URLSearchParams(search);
    return {
      account: q.get("account") || "",
      project: q.get("project") || "",
      domain: q.get("domain") || "",
      preset: q.get("preset") || "7d",
      from: q.get("from") || "",
      to: q.get("to") || "",
    };
  }, [search]);
}

export default function App() {
  return (
    <LiveProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="domains" element={<Domains />} />
          <Route path="traffic" element={<Traffic />} />
          <Route path="countries" element={<Countries />} />
          <Route path="requests" element={<Requests />} />
          <Route path="bandwidth" element={<Bandwidth />} />
          <Route path="workers" element={<Workers />} />
          <Route path="pages" element={<Pages />} />
          <Route path="errors" element={<Errors />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </LiveProvider>
  );
}
