// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Sploder-Saptarshi

import layoutTemplate from "../../templates/layout.html" with { type: "text" };
import sidenavTemplate from "../../templates/sidenav.html" with { type: "text" };
import reportBodyTemplate from "../../templates/report.html" with { type: "text" };
import { escapeHtml, type SessionUser } from "../session";
import { timingBadge } from "../timing";
import type { H3Event } from "nitro";
import { getRequestURL, setResponseHeader } from "nitro/h3";
import { render, bootstrap, pageTitle } from "./render";
import {
  NAV_LANGUAGEBAR,
  REPORTER_HTML,
  SIDEBAR_SONIC,
  UPSELL_HTML,
} from "./constants";

function userLanguageBar(username: string): string {
  const name = escapeHtml(username);
  return `<div id="languagebar" style="width:auto;min-width:200px;white-space:nowrap">  <span style="vertical-align:middle">Signed in as <b>${name}</b></span> <a class="lozenge1" style="vertical-align:middle;float:none;display:inline-block;margin-left:8px" href="javascript:void(0)" onclick="javascript:document.signoutForm.submit()" rel="nofollow"><span>Sign out</span></a>
  <form name="signoutForm" action="/member/signout" method="post" style="display:none"></form>
  </div>
`;
}

export interface PageView {
  username?: string;
  languagebar?: string;
  formError?: string;
  next?: string;
  turnstileSitekey?: string;
  origin?: string;
  isModerator?: boolean;
  event?: H3Event;
}

export function toPageView(session: SessionUser | null, event?: H3Event): PageView {
  const origin = event ? getRequestURL(event).origin : undefined;
  const base: PageView = {
    ...(origin ? { origin } : {}),
    ...(event ? { event } : {}),
  };
  if (!session) return base;
  return {
    ...base,
    username: session.username,
    languagebar: userLanguageBar(session.username),
    isModerator: session.isModerator,
  };
}

export function timingFor(view: PageView): string {
  return view.event ? timingBadge(view.event) : "";
}

// link previews need an absolute URL
export function embedImage(view: PageView): string {
  return view.origin ? `${view.origin}/images/embed.png` : "";
}

export function html(event: H3Event, body: string): string {
  setResponseHeader(event, "content-type", "text/html; charset=utf-8");
  setResponseHeader(event, "cache-control", "no-store");
  return body;
}

function topnavItem(
  cls: string,
  href: string,
  label: string,
  active: boolean,
  rel = "",
): string {
  return `  <li class="${cls}"><a href="${href}"${active ? ` class="on"` : ""}${rel ? ` rel="${rel}"` : ""}>${label}</a></li>`;
}

export function topnavFor(view: PageView, active = ""): string {
  const items = [
    topnavItem("one", "/editors/alllevels", "All Levels", active === "alllevels"),
    topnavItem("two", "/editors/mylevels", "My Levels", active === "mylevels"),
    topnavItem(
      "three",
      "/member/account",
      "My Account",
      active === "account",
      "nofollow",
    ),
  ].join("\n");
  return `<ul id="topnav_in"${view.username ? ` class="loggedin"` : ""}>\n${items}\n</ul>\n`;
}

export function footerMidLink(signedIn: boolean): string {
  return signedIn
    ? `<a href="/editors/mylevels">My Levels</a>`
    : `<a href="/quickstart">Quickstart</a>`;
}

export function sidebar(signedIn: boolean, sideActive = "sonic"): string {
  return render(sidenavTemplate, {
    navButton: signedIn
      ? `<a href="/editors/mylevels" class="mylevels"></a>`
      : `<a href="/quickstart" class="quickstart"></a>`,
    upsell: signedIn ? SIDEBAR_SONIC : UPSELL_HTML,
    sonicOn: sideActive === "sonic" ? " on" : "",
    iceOn: sideActive === "ice" ? " on" : "",
  });
}

export function reportBlockHtml(view: PageView, levelId: number | string): string {
  return render(reportBodyTemplate, {
    reportButton: REPORTER_HTML,
    editorButtons: editorButtons(!!view.username),
    levelId,
  });
}

function editorButton(label: string, href: string): string {
  return `<a class="lozenge2" href="javascript:void(0);"
                           onclick="javascript:notifyOfLeaving('${href}', false);">
                             <span>${label}</span>
                         </a>`;
}

function editorButtons(signedIn: boolean): string {
  const buttons = [editorButton("Create Level", "/editors/")];
  if (signedIn) buttons.push(editorButton("My Levels", "/editors/mylevels"));
  buttons.push(editorButton("All Levels", "/editors/alllevels"));
  return buttons.join("\n                        ");
}

export function renderLevelListPage(
  view: PageView,
  active: string,
  baseTitle: string,
  bodyTpl: string,
  rows: string,
  heading = "",
  pagination = "",
  extra: Record<string, unknown> = {},
  headExtra = "",
): string {
  const body = sidebar(!!view.username) + render(bodyTpl, { rows, heading, pagination, ...extra });
  return render(layoutTemplate, {
    title: pageTitle(baseTitle),
    embedImage: embedImage(view),
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view, active),
    footerMidLink: footerMidLink(!!view.username),
    ruffle: "",
    headExtra,
    domloadExtra: `splitBorderBottom.render('playGame');`,
    bootstrap: bootstrap({ username: view.username ?? "Guest" }),
    body,
    srvTiming: timingFor(view),
  });
}
