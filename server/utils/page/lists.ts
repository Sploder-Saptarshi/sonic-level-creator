import alllevelsBodyTemplate from "../../templates/alllevels.html" with { type: "text" };
import mylevelsBodyTemplate from "../../templates/mylevels.html" with { type: "text" };
import userlevelsBodyTemplate from "../../templates/userlevels.html" with { type: "text" };
import myLevelRowTemplate from "../../templates/lists/my-level-row.html" with { type: "text" };
import publicLevelRowTemplate from "../../templates/lists/public-level-row.html" with { type: "text" };
import reportRowTemplate from "../../templates/lists/report-row.html" with { type: "text" };
import reportReasonTemplate from "../../templates/lists/report-reason.html" with { type: "text" };
import renameFormTemplate from "../../templates/lists/rename-form.html" with { type: "text" };
import deleteFormTemplate from "../../templates/lists/delete-form.html" with { type: "text" };
import emptyTemplate from "../../templates/lists/empty.html" with { type: "text" };
import noReportsTemplate from "../../templates/lists/no-reports.html" with { type: "text" };
import paginationTemplate from "../../templates/lists/pagination.html" with { type: "text" };
import pageArrowTemplate from "../../templates/lists/page-arrow.html" with { type: "text" };
import pageLinkTemplate from "../../templates/lists/page-link.html" with { type: "text" };
import pageLinkOffTemplate from "../../templates/lists/page-link-off.html" with { type: "text" };
import { escapeHtml } from "../session";
import { STOCK_LEVEL_ID, type PublicLevelRow } from "../levels";
import type { OpenReportRow } from "../reports";
import {
  pageCursors,
  pageNumbers,
  type ListingQuery,
  type PageResult,
  type RowCursor,
} from "../pagination";
import { escapeJsAttr, formatDate, render } from "./render";
import { reportsHeadExtra, reportsLinkHtml } from "./constants";
import { renderLevelListPage, type PageView } from "./chrome";

export interface LevelRow {
  id: string;
  name: string;
  cols: number;
  rows: number;
  published: boolean | null;
  updatedAt: unknown;
}

const PUBLISHED_BADGE = ` &middot; <span style="color: #1767c9; font-weight: bold">Published</span>`;

function rowBorder(index: number, count: number): string {
  return index === count - 1 ? "none" : "1px solid #e0e0e0";
}

function dateSuffix(v: unknown): string {
  const d = formatDate(v);
  return d ? ` &middot; ${d}` : "";
}

function manageForms(basePath: string, id: string, name: string): { renameForm: string; deleteForm: string } {
  const nameJs = escapeJsAttr(name);
  return {
    renameForm: render(renameFormTemplate, { action: `${basePath}/rename`, id, nameJs }),
    deleteForm: render(deleteFormTemplate, { action: `${basePath}/delete`, id, nameJs }),
  };
}

function modButtons(basePath: string, id: string, name: string): string {
  const { renameForm, deleteForm } = manageForms(basePath, id, name);
  return `\n      ${renameForm}\n      ${deleteForm}`;
}

function myLevelRows(levels: LevelRow[]): string {
  if (!levels.length) {
    return render(emptyTemplate, { text: "You have not created any levels yet.", linkText: "Create your first level" });
  }
  return levels
    .map((l, i) =>
      render(myLevelRowTemplate, {
        ...l,
        ...manageForms("/editors/mylevels", l.id, l.name),
        border: rowBorder(i, levels.length),
        date: dateSuffix(l.updatedAt),
        published: l.published ? PUBLISHED_BADGE : "",
      }),
    )
    .join("\n");
}

function byline(l: PublicLevelRow): string {
  const display = escapeHtml(l.authorDisplay ?? l.author ?? "Player");
  return l.author
    ? `by <a href="/editors/alllevels/${encodeURIComponent(l.authorId)}">${display}</a> &middot; `
    : `by ${display} &middot; `;
}

function publicLevelRows(levels: PublicLevelRow[], opts: { isModerator: boolean; showAuthor: boolean }): string {
  return levels
    .map((l, i) =>
      render(publicLevelRowTemplate, {
        ...l,
        border: rowBorder(i, levels.length),
        byline: opts.showAuthor ? byline(l) : "",
        date: dateSuffix(l.updatedAt),
        modButtons: opts.isModerator ? modButtons("/editors/mylevels", l.id, l.name) : "",
      }),
    )
    .join("\n");
}

function pageArrow(basePath: string, param: "before" | "after", cursor: string | null, target: number): string {
  const arrow = render(pageArrowTemplate, { flip: param === "before" ? ";transform:scaleX(-1)" : "" });
  if (!cursor) return render(pageLinkOffTemplate, { arrow });
  return render(pageLinkTemplate, { href: `${basePath}?${param}=${cursor}&amp;page=${target}`, arrow });
}

export function listingPagination<T>(
  basePath: string,
  query: ListingQuery,
  total: number,
  result: PageResult<T>,
  cursorOf: (row: T) => RowCursor,
): string {
  if (total === 0) return "";
  const { page, totalPages } = pageNumbers(query.page, total);
  const { prev, next } = pageCursors(result, query.incoming, cursorOf);
  return render(paginationTemplate, {
    prev: pageArrow(basePath, "before", prev, page - 1),
    page,
    totalPages,
    next: pageArrow(basePath, "after", next, page + 1),
  });
}

export function renderMyLevelsPage(view: PageView & { levels: LevelRow[] }, pagination = ""): string {
  return renderLevelListPage(view, "mylevels", "My Levels", mylevelsBodyTemplate, myLevelRows(view.levels), "", pagination);
}

export function renderAllLevelsPage(view: PageView & { levels: PublicLevelRow[] }, pagination = ""): string {
  const rows = view.levels.length
    ? publicLevelRows(view.levels, { isModerator: !!view.isModerator, showAuthor: true })
    : render(emptyTemplate, { text: "No published levels yet.", linkText: "Create one" });
  return renderLevelListPage(view, "alllevels", "All Levels", alllevelsBodyTemplate, rows, "", pagination, {
    reportsLink: view.isModerator ? reportsLinkHtml : "",
  });
}

export function renderUserLevelsPage(
  view: PageView & { levels: PublicLevelRow[] },
  displayName: string,
  pagination = "",
): string {
  const heading = `Levels by ${displayName}`;
  const rows = view.levels.length
    ? publicLevelRows(view.levels, { isModerator: !!view.isModerator, showAuthor: false })
    : render(emptyTemplate, { text: `${displayName} has not published any levels yet.`, linkText: "Create one" });
  return renderLevelListPage(view, "alllevels", heading, userlevelsBodyTemplate, rows, heading, pagination);
}

interface ReportGroup {
  first: OpenReportRow;
  reports: OpenReportRow[];
}

function groupByLevel(reports: OpenReportRow[]): ReportGroup[] {
  const byLevel = new Map<string, ReportGroup>();
  for (const r of reports) {
    const group = byLevel.get(r.levelId);
    if (group) group.reports.push(r);
    else byLevel.set(r.levelId, { first: r, reports: [r] });
  }
  return [...byLevel.values()];
}

function reportRow({ first: l, reports }: ReportGroup, index: number, count: number): string {
  const reasons = reports
    .map((r) =>
      render(reportReasonTemplate, { reason: r.reason, reporter: r.reporterDisplay ?? "Player", date: dateSuffix(r.createdAt) }),
    )
    .join("\n");
  return render(reportRowTemplate, {
    id: l.levelId,
    name: l.levelName,
    cols: l.levelCols,
    rows: l.levelRows,
    author: l.authorDisplay ?? "Player",
    authorPath: encodeURIComponent(l.authorId),
    reportCount: `${reports.length} report${reports.length === 1 ? "" : "s"}`,
    border: rowBorder(index, count),
    reasons,
    // the stock level can't be renamed or deleted
    modButtons: l.levelId === STOCK_LEVEL_ID ? "" : modButtons("/editors/reports", l.levelId, l.levelName),
  });
}

export function renderReportsPage(view: PageView & { reports: OpenReportRow[] }, pagination = ""): string {
  const groups = groupByLevel(view.reports);
  const rows = groups.length ? groups.map((g, i) => reportRow(g, i, groups.length)).join("\n") : noReportsTemplate;
  return renderLevelListPage(view, "", "Reported Levels", userlevelsBodyTemplate, rows, "Reported Levels", pagination, {}, reportsHeadExtra);
}
