import React from "react";
import { fmtMetric } from "../lib/format.js";

// metric = {available,label,value,kind} (backend ane mathi) - available nathi
// to "Not available" dekhay, fake number nathi.
export default function StatCard({ metric, valueLabel }) {
  const text = valueLabel != null ? valueLabel : fmtMetric(metric);
  const na = metric && metric.available === false;
  return (
    <div className={"statcard" + (na ? " na" : "")}>
      <div className="stat-num">{text}</div>
      <div className="stat-label">{metric?.label || valueLabel}</div>
      {metric?.note && <div className="stat-note">{metric.note}</div>}
    </div>
  );
}
