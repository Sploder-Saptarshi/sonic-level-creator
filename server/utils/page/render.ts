import { escapeHtml } from "../session";

// Eval-free template renderer (Workers-safe): `<%= it.x %>` is
// HTML-escaped, `<%~ it.x %>` is raw.
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

// JSON for an inline <script>; `<` is escaped so it can't close the tag.
export function bootstrap(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// For single-quoted JS strings inside double-quoted HTML attributes
// (onsubmit="promptRename('...')"). JS-escape first, then HTML-escape with
// `&` first: otherwise a name like `&#39;);alert(1);//` decodes to `'`
// after escaping and breaks out of the string.
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

// YYYY-MM-DD for valid Dates, "" otherwise.
export function formatDate(v: unknown): string {
  return v instanceof Date && !isNaN(+v) ? v.toISOString().slice(0, 10) : "";
}
