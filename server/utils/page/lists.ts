// server/utils/page/lists.ts — level-list and report rendering (My Levels / All Levels / Reports)
import alllevelsBodyTemplate from "../../templates/alllevels.html" with { type: "text" };
import mylevelsBodyTemplate from "../../templates/mylevels.html" with { type: "text" };
import userlevelsBodyTemplate from "../../templates/userlevels.html" with { type: "text" };
import { escapeHtml } from "../session";
import { STOCK_LEVEL_ID, type PublicLevelRow } from "../levels";
import { escapeJsAttr, formatDate } from "./render";
import { reportsHeadExtra, reportsLinkHtml } from "./constants";
import { renderLevelListPage } from "./chrome";
import type { PageView } from "./chrome";

export interface LevelRow {
  id: string;
  name: string;
  cols: number;
  rows: number;
  published: boolean | null;
  updatedAt: unknown;
}

function renderLevelRows(levels: LevelRow[]): string {
  if (!levels.length) {
    return `<p style="padding: 12px 0">You have not created any levels yet. <a href="/editors/">Create your first level</a>.</p>`;
  }
  const items = levels.map((l, i) => {
    const name = escapeHtml(l.name);
    const nameJs = escapeJsAttr(l.name);
    const id = escapeHtml(l.id);
    const d = formatDate(l.updatedAt);
    const border = i === levels.length - 1 ? "none" : "1px solid #e0e0e0";
    return `<div style="padding: 6px 0; border-bottom: ${border}; overflow: hidden">
      <div style="float: left"><b><a href="/play/${id}" rel="nofollow">${name}</a></b> <span style="color: #666">${l.cols} x ${l.rows} tiles${d ? ` &middot; ${d}` : ""}</span>${l.published ? ` &middot; <span style="color: #1767c9; font-weight: bold">Published</span>` : ""}</div>
      <div style="float: right; cursor: pointer"><a class="lozenge2" href="/play/${id}" rel="nofollow"><span>Play</span></a>
      <a class="lozenge2" href="/editors/?load=${id}" rel="nofollow"><span>Open</span></a>
      <form action="/editors/mylevels/rename" method="post" style="display: inline" onsubmit="return promptRename('${nameJs}', this)"><input type="hidden" name="id" value="${id}" /><input type="hidden" name="name" value="" /><span class="button"><button type="submit" name="submit" value="rename">Rename</button></span></form>
      <form action="/editors/mylevels/delete" method="post" style="display: inline" onsubmit="return confirmDelete('${nameJs}')"><input type="hidden" name="id" value="${id}" /><span class="button"><button type="submit" name="submit" value="delete">Delete</button></span></form></div>
    </div>`;
  });
  return items.join("\n");
}

export function renderMyLevelsPage(
  view: PageView & { levels: LevelRow[] },
  pagination = "",
): string {
  return renderLevelListPage(view, "mylevels", "My Levels", mylevelsBodyTemplate, renderLevelRows(view.levels), "", pagination);
}

function renderPublicLevelRows(
  levels: PublicLevelRow[],
  isModerator = false,
  emptyHtml?: string,
  hideAuthor = false,
): string {
  if (!levels.length) {
    return emptyHtml ?? `<p style="padding: 12px 0">No published levels yet. <a href="/editors/">Create one</a>.</p>`;
  }
  const items = levels.map((l, i) => {
    const name = escapeHtml(l.name);
    const nameJs = escapeJsAttr(l.name);
    let byline = "";
    if (!hideAuthor) {
      const display = escapeHtml(l.authorDisplay ?? l.author ?? "Player");
      byline = l.author
        ? `by <a href="/editors/alllevels/${encodeURIComponent(l.authorId)}">${display}</a> &middot; `
        : `by ${display} &middot; `;
    }
    const id = escapeHtml(l.id);
    const d = formatDate(l.updatedAt);
    const border = i === levels.length - 1 ? "none" : "1px solid #e0e0e0";
    const modButtons = isModerator
      ? `\n      <form action="/editors/mylevels/rename" method="post" style="display: inline" onsubmit="return promptRename('${nameJs}', this)"><input type="hidden" name="id" value="${id}" /><input type="hidden" name="name" value="" /><span class="button"><button type="submit" name="submit" value="rename">Rename</button></span></form>\n      <form action="/editors/mylevels/delete" method="post" style="display: inline" onsubmit="return confirmDelete('${nameJs}')"><input type="hidden" name="id" value="${id}" /><span class="button"><button type="submit" name="submit" value="delete">Delete</button></span></form>`
      : "";
    return `<div style="padding: 6px 0; border-bottom: ${border}; overflow: hidden">
      <div style="float: left"><b><a href="/play/${id}" rel="nofollow">${name}</a></b> <span style="color: #666">${byline}${l.cols} x ${l.rows} tiles${d ? ` &middot; ${d}` : ""}</span></div>
      <div style="float: right; cursor: pointer"><a class="lozenge2" href="/play/${id}" rel="nofollow"><span>Play</span></a>${modButtons}</div>
    </div>`;
  });
  return items.join("\n");
}

export function paginationBar(
  basePath: string,
  page: number,
  totalPages: number,
  prevCursor: string | null,
  nextCursor: string | null,
): string {
  const arrow = (dir: 1 | -1, cursor: string | null, target: number): string => {
    const img = `<img src="/images/popup-btn.gif" alt="" style="display:block;height:30px;width:auto;border:0${dir < 0 ? ";transform:scaleX(-1)" : ""}" />`;
    const param = dir < 0 ? "before" : "after";
    return cursor
      ? `<a href="${basePath}?${param}=${cursor}&amp;page=${target}" rel="nofollow" style="display:block;height:30px;">${img}</a>`
      : `<span style="display:block;height:30px;opacity:0.35">${img}</span>`;
  };
  return `<div style="margin:10px -10px -10px;background:linear-gradient(to bottom,#fee6ba 0.00%,#fee3b5 4.76%,#fee0af 9.52%,#fedda8 14.29%,#fed9a1 19.05%,#fed599 23.81%,#fed091 28.57%,#fecc88 33.33%,#fec77f 38.10%,#ffc376 42.86%,#ffbf6f 47.62%,#ffbb68 52.38%,#ffb761 57.14%,#ffb35a 61.90%,#ffb053 66.67%,#ffad4d 71.43%,#ffa947 76.19%,#ffa641 80.95%,#ffa43c 85.71%,#ffa137 90.48%,#ffa035 95.24%,#ffa035 100.00%);border-radius:0 0 8px 8px;overflow:hidden;height:30px;color:#4c4c4c;font-weight:bold;font-size:12px;display:flex;align-items:center;justify-content:center;">${arrow(-1, prevCursor, page - 1)}<span>&nbsp;&nbsp;Page ${page}/${totalPages}&nbsp;&nbsp;</span>${arrow(1, nextCursor, page + 1)}</div>`;
}

export function renderAllLevelsPage(
  view: PageView & { levels: PublicLevelRow[] },
  pagination = "",
): string {
  return renderLevelListPage(
    view,
    "alllevels",
    "All Levels",
    alllevelsBodyTemplate,
    renderPublicLevelRows(view.levels, !!view.isModerator),
    "",
    pagination,
    { reportsLink: view.isModerator ? reportsLinkHtml : "" },
  );
}

export interface ReportGroup {
  levelId: string;
  levelName: string;
  levelCols: number;
  levelRows: number;
  authorId: string;
  authorDisplay: string;
  reports: Array<{
    reason: string;
    reporterDisplay: string;
    createdAt: unknown;
  }>;
}

function renderReportRows(groups: ReportGroup[]): string {
  if (!groups.length) {
    return `<p style="padding: 12px 0">No open reports.</p>`;
  }
  return groups
    .map((g, i) => {
      const name = escapeHtml(g.levelName);
      const nameJs = escapeJsAttr(g.levelName);
      const id = escapeHtml(g.levelId);
      const author = escapeHtml(g.authorDisplay);
      const border = i === groups.length - 1 ? "none" : "1px solid #e0e0e0";
      const byline = `by <a href="/editors/alllevels/${encodeURIComponent(g.authorId)}">${author}</a> &middot; ${g.levelCols} x ${g.levelRows} tiles &middot; ${g.reports.length} report${g.reports.length === 1 ? "" : "s"}`;
      const reasons = g.reports
        .map((r) => {
          const d = formatDate(r.createdAt);
          return `<div style="margin: 4px 0 4px 12px; color: #333">&ldquo;${escapeHtml(r.reason)}&rdquo; <span style="color: #666">by ${escapeHtml(r.reporterDisplay)}${d ? ` &middot; ${d}` : ""}</span></div>`;
        })
        .join("\n");
      const modForms = g.levelId === STOCK_LEVEL_ID
        ? ""
        : `\n      <form action="/editors/reports/rename" method="post" style="display: inline" onsubmit="return promptRename('${nameJs}', this)"><input type="hidden" name="id" value="${id}" /><input type="hidden" name="name" value="" /><span class="button"><button type="submit" name="submit" value="rename">Rename</button></span></form>\n      <form action="/editors/reports/delete" method="post" style="display: inline" onsubmit="return confirmDelete('${nameJs}')"><input type="hidden" name="id" value="${id}" /><span class="button"><button type="submit" name="submit" value="delete">Delete</button></span></form>`;
      return `<div class="report-row" style="padding: 6px 0; border-bottom: ${border}; overflow: hidden">
      <div style="float: left"><b><a href="/play/${id}" rel="nofollow">${name}</a></b> <span style="color: #666">${byline}</span>
${reasons}</div>
      <div style="float: right; cursor: pointer"><a class="lozenge2" href="/play/${id}" rel="nofollow"><span>Play</span></a>${modForms}
      <form action="/editors/reports/dismiss" method="post" style="display: inline"><input type="hidden" name="levelId" value="${id}" /><span class="button"><button type="submit" name="submit" value="dismiss">Dismiss</button></span></form></div>
    </div>`;
    })
    .join("\n");
}

export function renderReportsPage(
  view: PageView & { reports: import("../levels").OpenReportRow[] },
  pagination = "",
): string {
  const groups: ReportGroup[] = [];
  const byLevel = new Map<string, ReportGroup>();
  for (const r of view.reports) {
    let g = byLevel.get(r.levelId);
    if (!g) {
      g = {
        levelId: r.levelId,
        levelName: r.levelName,
        levelCols: r.levelCols,
        levelRows: r.levelRows,
        authorId: r.authorId,
        authorDisplay: r.authorDisplay ?? "Player",
        reports: [],
      };
      byLevel.set(r.levelId, g);
      groups.push(g);
    }
    g.reports.push({
      reason: r.reason,
      reporterDisplay: r.reporterDisplay ?? "Player",
      createdAt: r.createdAt,
    });
  }
  return renderLevelListPage(
    view,
    "",
    "Reported Levels",
    userlevelsBodyTemplate,
    renderReportRows(groups),
    "Reported Levels",
    pagination,
    {},
    reportsHeadExtra,
  );
}

export function renderUserLevelsPage(
  view: PageView & { levels: PublicLevelRow[] },
  displayName: string,
  pagination = "",
): string {
  const heading = `Levels by ${displayName}`;
  return renderLevelListPage(
    view,
    "alllevels",
    heading,
    userlevelsBodyTemplate,
    renderPublicLevelRows(
      view.levels,
      !!view.isModerator,
      `<p style="padding: 12px 0">${escapeHtml(displayName)} has not published any levels yet. <a href="/editors/">Create one</a>.</p>`,
      true,
    ),
    heading,
    pagination,
  );
}
