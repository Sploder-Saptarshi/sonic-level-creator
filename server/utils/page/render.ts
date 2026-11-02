import { escapeHtml } from "../session";

// Eta's compiler uses new Function, which Workers forbid.
// <%= it.x %> is escaped, <%~ it.x %> is raw.
export function render(tpl: string, data: Record<string, unknown>): string {
  return tpl.replace(
    /<%([=~])\s*it\.([A-Za-z_$][\w$]*)\s*%>/g,
    (_, sig: string, key: string) => {
      const v = data[key];
      const s = v == null ? "" : String(v);
      return sig === "=" ? escapeHtml(s) : s;
    },
  );
}

export function pageTitle(base: string): string {
  return `${base} | Sonic ReLvl`;
}

export function bootstrap(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// For JS strings inside HTML attributes (onsubmit="promptRename('...')").
// The HTML pass must escape & too, or `&#39;` decodes back into a quote.
export function escapeJsAttr(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatDate(v: unknown): string {
  return v instanceof Date && !isNaN(+v) ? v.toISOString().slice(0, 10) : "";
}
