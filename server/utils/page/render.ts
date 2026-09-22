// server/utils/page/render.ts — core interpolator and escaping helpers (Workers-safe)
import { escapeHtml } from "../session";

// Minimal template renderer: `<%= it.x %>` HTML-escaped, `<%~ it.x %>` raw.
// Same placeholder syntax/semantics as before, zero codegen. Escaping is
// shared with server/utils/session.ts (single implementation).
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

// Single source of truth for the <title> suffix: every page ends with
// "| Sonic ReLvl". Callers pass the base ("My Levels", level name, ...);
// the suffix is applied here so it can't drift between pages.
export function pageTitle(base: string): string {
  return `${base} | Sonic ReLvl`;
}

// JSON bootstrap for client scripts; < escaped so it can't break out of <script>.
export function bootstrap(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// Level names inside single-quoted JS strings in double-quoted HTML
// attributes (onsubmit="...promptRename('...')..."). Two layers, in order:
// JS-escape first (\ and ' plus control/line separators), then HTML-escape
// with & FIRST. The & layer is load-bearing: without it an attacker name
// like `&#39;);alert(1);//` sails through the JS escapes untouched (no
// literal quote to escape) and HTML-decodes to `'` AFTER our escaping ran,
// breaking out of the JS string — stored XSS on My Levels (self), All
// Levels mod buttons, and the reports queue (moderator compromise).
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

// YYYY-MM-DD for Date values, "" otherwise. Shared by both level-list
// renderers so the guard lives in one place.
export function formatDate(v: unknown): string {
  return v instanceof Date && !isNaN(+v) ? v.toISOString().slice(0, 10) : "";
}
