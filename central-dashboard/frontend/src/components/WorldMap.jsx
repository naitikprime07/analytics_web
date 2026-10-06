import React, { useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import { ALPHA2_TO_NUMERIC } from "../lib/isoNumeric.js";
import { countryName, flagEmoji } from "../lib/countries.js";
import { fmtNumber } from "../lib/format.js";

// World geometry is bundled (world-atlas), so the map renders fully offline -
// no external tile/geo fetch at runtime. Analytics rows are keyed by ISO alpha-2
// (Cloudflare clientCountryName); we join them to the map's numeric feature ids
// via the generated ALPHA2_TO_NUMERIC table.

const WIDTH = 1000;
const HEIGHT = 520;

// Light -> deep green ramp (matches the reference "by country" choropleth).
const RAMP_FROM = [196, 232, 205];
const RAMP_TO = [17, 122, 58];
function ramp(t) {
  const c = RAMP_FROM.map((v, i) => Math.round(v + (RAMP_TO[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export default function WorldMap({ rows = [] }) {
  const wrapRef = useRef(null);
  const [tip, setTip] = useState(null);

  const { features, sphere } = useMemo(() => {
    const fc = feature(world, world.objects.countries);
    const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: "Sphere" });
    const path = geoPath(projection);
    return {
      features: fc.features.map((f) => ({ id: String(f.id), d: path(f) })),
      sphere: path({ type: "Sphere" }),
    };
  }, []);

  // numeric id -> { country, requests } for the current selection.
  const byNumeric = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const num = ALPHA2_TO_NUMERIC[String(r.country || "").toUpperCase()];
      if (num) m.set(num, r);
    }
    return m;
  }, [rows]);

  const max = useMemo(() => rows.reduce((v, r) => Math.max(v, r.requests || 0), 0), [rows]);

  const hide = () => setTip(null);
  const move = (evt, row) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTip({
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
      country: row.country,
      requests: row.requests,
    });
  };

  const hasData = byNumeric.size > 0;

  return (
    <div className="worldmap" ref={wrapRef} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="worldmap-svg" role="img" aria-label="World map shaded by requests per country">
        <path d={sphere} className="wm-ocean" />
        {features.map((f) => {
          const row = byNumeric.get(f.id);
          const val = row ? row.requests || 0 : 0;
          const t = max ? Math.sqrt(val / max) : 0; // sqrt eases the visual spread
          const fill = row ? ramp(t) : undefined;
          return (
            <path
              key={f.id}
              d={f.d}
              className={"wm-country" + (row ? " wm-has" : "")}
              fill={fill}
              onMouseMove={row ? (e) => move(e, row) : undefined}
              onMouseLeave={hide}
            >
              {row ? <title>{`${countryName(row.country)} — ${fmtNumber(val)} requests`}</title> : null}
            </path>
          );
        })}
      </svg>

      {!hasData && <div className="wm-empty">No country data for this selection.</div>}

      {tip && (
        <div className="wm-tip" style={{ left: tip.x, top: tip.y }}>
          <span className="wm-tip-flag" aria-hidden="true">{flagEmoji(tip.country)}</span>
          <span className="wm-tip-name">{countryName(tip.country)}</span>
          <span className="wm-tip-val">{fmtNumber(tip.requests)}</span>
        </div>
      )}
    </div>
  );
}
