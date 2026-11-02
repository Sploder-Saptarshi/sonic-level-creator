import layoutTemplate from "../../templates/layout.html" with { type: "text" };
import signinBodyTemplate from "../../templates/signin.html" with { type: "text" };
import signupBodyTemplate from "../../templates/signup.html" with { type: "text" };
import accountBodyTemplate from "../../templates/account.html" with { type: "text" };
import quickstartBodyTemplate from "../../templates/quickstart.html" with { type: "text" };
import { DEV_TURNSTILE_SITEKEY } from "../turnstile";
import { bootstrap, pageTitle, render } from "./render";
import {
  NAV_LANGUAGEBAR,
  accountHeadExtra,
  memberHeadExtra,
  quickstartDomloadExtra,
  signinDomloadExtra,
} from "./constants";
import {
  embedImage,
  footerMidLink,
  sidebar,
  timingFor,
  topnavFor,
  type PageView,
} from "./chrome";
import type { PageQuery } from "./query";

function renderMemberPage(
  bodyTpl: string,
  baseTitle: string,
  view: PageView = {},
  turnstileAction = "",
): string {
  const next = view.next ?? "";
  const withNext = (href: string) =>
    next ? `${href}?next=${encodeURIComponent(next)}` : href;
  const body = render(bodyTpl, {
    formError: view.formError ?? "",
    next,
    signupHref: withNext("/member/signup"),
    signinHref: withNext("/member/signin"),
    turnstileSitekey: view.turnstileSitekey || DEV_TURNSTILE_SITEKEY,
    turnstileAction,
  });
  return render(layoutTemplate, {
    title: pageTitle(baseTitle),
    embedImage: embedImage(view),
    languagebar: NAV_LANGUAGEBAR,
    topnav: topnavFor(view),
    footerMidLink: footerMidLink(!!view.username),
    ruffle: "",
    headExtra: memberHeadExtra,
    domloadExtra: signinDomloadExtra,
    bootstrap: bootstrap({ username: "Guest" }),
    body,
    srvTiming: timingFor(view),
  });
}

export function renderSigninPage(query: PageQuery, view: PageView = {}): string {
  return renderMemberPage(signinBodyTemplate, "Member Sign-in", view, "signin");
}

export function renderSignupPage(query: PageQuery, view: PageView = {}): string {
  return renderMemberPage(signupBodyTemplate, "Member Sign-up", view, "signup");
}

export function renderAccountPage(view: PageView = {}, msg = ""): string {
  const body = sidebar(!!view.username, "") + render(accountBodyTemplate, {
    username: view.username ?? "Guest",
    msg,
  });
  return render(layoutTemplate, {
    title: pageTitle("My Account"),
    embedImage: embedImage(view),
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view, "account"),
    footerMidLink: footerMidLink(!!view.username),
    ruffle: "",
    headExtra: accountHeadExtra,
    domloadExtra: `splitBorderBottom.render('playGame');`,
    bootstrap: bootstrap({ username: view.username ?? "Guest" }),
    body,
    srvTiming: timingFor(view),
  });
}

export function renderQuickstartPage(view: PageView = {}): string {
  const body = sidebar(!!view.username, "") + render(quickstartBodyTemplate, {});
  return render(layoutTemplate, {
    title: pageTitle("Quick Start Guide"),
    embedImage: embedImage(view),
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view),
    footerMidLink: footerMidLink(!!view.username),
    ruffle: "",
    headExtra: "",
    domloadExtra: quickstartDomloadExtra,
    bootstrap: bootstrap({ username: view.username ?? "Guest" }),
    body,
    srvTiming: timingFor(view),
  });
}
