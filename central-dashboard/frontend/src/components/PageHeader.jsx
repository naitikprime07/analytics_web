import React, { useState } from "react";

// Inline "i" info dot with a hover/focus tooltip bubble. Used for metric and
// column hints so an unclear number can be explained in place.
export function InfoTip({ text }) {
  if (!text) return null;
  return (
    <span className="infotip" tabIndex={0} role="button" aria-label={text} title={text}>
      i<span className="infotip-bubble" role="tooltip">{text}</span>
    </span>
  );
}

/**
 * PageHeader - the page title row + an "About this page" (? ) toggle.
 * Clicking ? expands a panel that lists, in plain language, what the page shows,
 * where each number comes from (Cloudflare-native vs custom-tracked), how the
 * filters apply, and any caveats - so every detail is checkable without leaving
 * the page. `items` is an array of short strings (rendered as bullets).
 */
export default function PageHeader({ title, sub, badge, items = [], children }) {
  const [open, setOpen] = useState(false);
  const hasInfo = items.length > 0 || !!children;
  return (
    <div className="pagehead">
      <h2 className="pagetitle">
        {title}
        {badge ? <span className="badge">{badge}</span> : null}
        {sub ? <span className="sub">{sub}</span> : null}
        {hasInfo && (
          <button
            type="button"
            className={"info-btn" + (open ? " on" : "")}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            title="About this page - what these numbers mean"
          >
            ?
          </button>
        )}
      </h2>
      {open && hasInfo && (
        <div className="pageinfo">
          <h4>About this page</h4>
          {items.length > 0 && (
            <ul>
              {items.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
