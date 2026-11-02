// Game, editor and /play pages.
import layoutTemplate from "../../templates/layout.html" with { type: "text" };
import gameBodyTemplate from "../../templates/game.html" with { type: "text" };
import editorBodyTemplate from "../../templates/editor.html" with { type: "text" };
import { escapeHtml } from "../session";
import { bootstrap, pageTitle, render } from "./render";
import {
  API_CONNECTOR_ID,
  DEFAULT_LEVEL_ID,
  DEFAULT_PLAYER_NAME,
  GAME_SWF,
  NAV_LANGUAGEBAR,
  PRELOADER_SIGNEDIN_SWF,
  PRELOADER_SWF,
  TOUCH_CONTROLS_HTML,
  editorHeadExtra,
  fullscreenHeadExtra,
  gameDomloadExtra,
  gameHeadExtra,
  ruffleHeadExtra,
} from "./constants";
import {
  embedImage,
  footerMidLink,
  reportBlockHtml,
  sidebar,
  timingFor,
  topnavFor,
  type PageView,
} from "./chrome";
import {
  cleanLevelId,
  cleanSession,
  cleanTerritory,
  cleanTitle,
  cleanUsername,
  cleanZoneOne,
  type PageQuery,
} from "./query";

export interface GamePageOptions {
  contentSwf?: string;
  playerName?: string;
  title?: string;
  headExtra?: string;
  playerSwf?: string;
  hideReport?: boolean;
  hideTitle?: boolean;
  hideTouchControls?: boolean;
  sideActive?: string;
  gameWidth?: number;
  gameHeight?: number;
}

export function renderGamePage(
  query: PageQuery,
  view: PageView = {},
  opts: GamePageOptions = {},
): string {
  const username = view.username ?? cleanUsername(query.user);
  const sessionId = cleanSession(query.session);
  const levelId = cleanLevelId(query.levelid);
  const playerName = opts.playerName ?? DEFAULT_PLAYER_NAME;
  const levelTitle = cleanTitle(query.title);
  const data = {
    username,
    sessionId,
    territory: cleanTerritory(query.territory),
    levelId,
    levelIdJs: JSON.stringify(levelId),
    zoneOneFrag: `,isZoneOne: ${cleanZoneOne(query.zoneone)}`,
    playerSwf: opts.playerSwf ?? (view.username ? PRELOADER_SIGNEDIN_SWF : PRELOADER_SWF),
    reportBlock: opts.hideReport ? "" : reportBlockHtml(view, levelId),
    playerHeading: opts.hideTitle
      ? escapeHtml(playerName)
      : `${escapeHtml(playerName)} - ${escapeHtml(levelTitle)}`,
    contentSwf: opts.contentSwf ?? GAME_SWF,
    gameWidth: opts.gameWidth ?? 640,
    gameHeight: opts.gameHeight ?? 448,
    touchControls: opts.hideTouchControls ? "" : TOUCH_CONTROLS_HTML,
  };
  const body = sidebar(!!view.username, opts.sideActive) + render(gameBodyTemplate, data);
  return render(layoutTemplate, {
    title: pageTitle(opts.title ?? levelTitle),
    embedImage: embedImage(view),
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view),
    footerMidLink: footerMidLink(!!view.username),
    ruffle: ruffleHeadExtra,
    headExtra: (opts.headExtra ?? gameHeadExtra) + fullscreenHeadExtra,
    domloadExtra: gameDomloadExtra,
    bootstrap: bootstrap({ sessionId, username, levelId }),
    body,
    srvTiming: timingFor(view),
  });
}

export function renderEditorPage(query: PageQuery, view: PageView = {}): string {
  const username = view.username ?? cleanUsername(query.user);
  const sessionId = cleanSession(query.session);
  const levelId = cleanLevelId(query.levelid);
  const body = render(editorBodyTemplate, {
    username,
    sessionId,
    territory: cleanTerritory(query.territory),
    levelId,
    levelIdJs: JSON.stringify(levelId),
    contentSwf: GAME_SWF,
  });
  return render(layoutTemplate, {
    title: pageTitle(`${username} | Level Creators`),
    embedImage: embedImage(view),
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view),
    footerMidLink: footerMidLink(!!view.username),
    ruffle: ruffleHeadExtra,
    headExtra: editorHeadExtra,
    domloadExtra: "",
    bootstrap: bootstrap({ sessionId, username, levelId }),
    body,
    srvTiming: timingFor(view),
  });
}

export function renderPlayPage(
  levelName: string,
  levelId: number | string,
  view: PageView = {},
  published: boolean | null = true,
): string {
  const unpublishedBadge = published
    ? ""
    : `<span style="float: right; padding-right: 12px">[Unpublished]</span>`;
  const gameBody = render(gameBodyTemplate, {
    sessionId: API_CONNECTOR_ID,
    territory: "EnglishUK",
    levelId,
    levelIdJs: JSON.stringify(levelId),
    zoneOneFrag: "",
    playerSwf: view.username ? PRELOADER_SIGNEDIN_SWF : PRELOADER_SWF,
    reportBlock: reportBlockHtml(view, levelId),
    playerHeading: `${unpublishedBadge}${escapeHtml(DEFAULT_PLAYER_NAME)} - ${escapeHtml(levelName)}`,
    contentSwf: GAME_SWF,
    gameWidth: 640,
    gameHeight: 448,
    touchControls: TOUCH_CONTROLS_HTML,
  });
  const body = sidebar(!!view.username) + gameBody;
  return render(layoutTemplate, {
    title: pageTitle(levelName),
    embedImage: embedImage(view),
    languagebar: view.languagebar ?? NAV_LANGUAGEBAR,
    topnav: topnavFor(view),
    footerMidLink: footerMidLink(!!view.username),
    ruffle: ruffleHeadExtra,
    headExtra: gameHeadExtra + fullscreenHeadExtra,
    domloadExtra: gameDomloadExtra,
    bootstrap: bootstrap({ sessionId: API_CONNECTOR_ID, username: view.username ?? "Guest", levelId }),
    body,
    srvTiming: timingFor(view),
  });
}
