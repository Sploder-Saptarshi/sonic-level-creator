// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

// Builds the Cloudflare Pages _routes.json include list from server/ (Nitro
// has no public API for its route scan).
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const HANDLER_EXT = /\.(get|post|put|delete|patch|head|options|ts|mjs|js)$/;

function toRoute(prefix: string, file: string): string {
  const name = file
    .replace(/\.(get|post|put|delete|patch|head|options)\.([^.]+)$/, "")
    .replace(/\.(ts|js|mjs|cjs)$/, "");
  const segs = `${prefix}/${name}`
    .split("/")
    .filter((s) => s && s !== "index")
    .map((s) => (/^\[.+\]$/.test(s) ? "*" : s));
  return `/${segs.join("/")}`;
}

function addRoute(route: string, out: Set<string>) {
  out.add(route);
  if (route !== "/" && !route.endsWith("/*")) out.add(`${route}/`);
}

function scan(dir: string, prefix: string, out: Set<string>) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) scan(p, `${prefix}/${e}`, out);
    else if (HANDLER_EXT.test(e)) addRoute(toRoute(prefix, e), out);
  }
}

export function collectFunctionRoutes(
  dirs: Record<string, string> = {
    "server/routes": "",
    "server/api": "/api",
  },
): string[] {
  const out = new Set<string>();
  for (const [dir, prefix] of Object.entries(dirs)) scan(dir, prefix, out);
  const wilds = [...out].filter((r) => r.endsWith("/*"));
  const covered = (r: string) =>
    wilds.some((w) => w !== r && r.startsWith(w.slice(0, -1)));
  return [...out].filter((r) => !covered(r)).sort();
}
