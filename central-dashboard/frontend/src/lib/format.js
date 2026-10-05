// Formatting + N/A rendering helpers. STRICT: metric available nathi to "Not available"
// dekhay - kahi 0 ke estimate nathi (prompt nu accuracy rule).

export function fmtNumber(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return "Not available";
  return Number(v).toLocaleString("en-US");
}

export function fmtBytes(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "Not available";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let n = Number(bytes);
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

// metric = {available, label, value, kind} ane backend mathi aavta
export function fmtMetric(metric) {
  if (!metric || metric.available === false) return "Not available";
  if (metric.kind === "bytes") return fmtBytes(metric.value);
  return fmtNumber(metric.value);
}

export function isNA(obj) {
  return !obj || obj.available === false;
}

export function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit" });
}
