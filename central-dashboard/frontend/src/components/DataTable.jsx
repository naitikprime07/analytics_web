import React from "react";
import { Empty } from "./StateViews.jsx";

/**
 * DataTable columns: [{ key, label, render?(row) }]
 * render vaparyu to cell e value e rendering karay; natari row[key] dekhay.
 */
export default function DataTable({ columns, rows }) {
  if (!rows || !rows.length) return <Empty />;
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || "left", width: c.width }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align || "left" }}>{c.render ? c.render(row) : row[c.key] ?? "Not available"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
