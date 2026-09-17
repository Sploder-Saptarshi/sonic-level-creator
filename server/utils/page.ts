// server/utils/page.ts — SSR page rendering (Eta, Workers-safe: no fs reads).
// Query overrides (?user= ?session= ?levelid= ?) are stubs until auth lands;
// every value is validated AND Eta-escaped.
import { Eta } from "eta";
import layoutTemplate from "../templates/layout.html" with { type: "text" };
import gameBodyTemplate from "../templates/game.html" with { type: "text" };
import editorBodyTemplate from "../templates/editor.html" with { type: "text" };

// Static domload snippet (page wiring, not an Eta template).
const gameDomloadExtra = `;reportArea = $('reportArea');reportButton = $('reporter');reportButton.addEventListener('click', function(e) {
e.preventDefault();
e.stopPropagation();
expandReport();
});getTicker ('tickerAll', 10, 3, '', '', 'true');`;
const editorHeadExtra = `<style type="text/css" media="screen">
#pagecontent { float: left; width: 977px; margin-left: 5px; }
</style>
<link rel="preload" as="image" href="/editors/assets/spritesheet.png" />
`;

// Offline session stub (mirrors ts/actions.ts TEST_API_ID). The game loads
// /<sessionId>.swf, so this must match public/<id>.swf until sessions are real.
export const OFFLINE_SESSION_ID = "9f3210793951251c83ea5addaa24b963";
const DEFAULT_LEVEL_ID = 2914;
const DEFAULT_TITLE = "Sonic The Hedgehog Level Player - At Dawn";
const TERRITORIES = ["EnglishUK", "EnglishUSA"];

const eta = new Eta();

export interface PageQuery {
  user?: unknown;
  session?: unknown;
  levelid?: unknown;
  territory?: unknown;
  title?: unknown;
  zoneone?: unknown;
}

function first(v: unknown): unknown {
  return Array.isArray(v) ? v[0] : v;
}

function cleanUsername(v: unknown): string {
  const s = first(v);
  return typeof s === "string" && /^[\w-]{1,32}$/.test(s) ? s : "Guest";
}

function cleanSession(v: unknown): string {
  const s = first(v);
  return typeof s === "string" && /^[0-9a-f]{32}$/i.test(s)
    ? s.toLowerCase()
    : OFFLINE_SESSION_ID;
}

function cleanLevelId(v: unknown): number {
  const n = Number(first(v));
  return Number.isInteger(n) && n > 0 && n < 1_000_000 ? n : DEFAULT_LEVEL_ID;
}

function cleanTerritory(v: unknown): string {
  const s = first(v);
  return typeof s === "string" && (TERRITORIES as string[]).includes(s)
    ? s
    : TERRITORIES[0];
}

function cleanTitle(v: unknown): string {
  const s = first(v);
  return typeof s === "string" && s.length > 0 && s.length <= 80
    ? s
    : DEFAULT_TITLE;
}

function cleanZoneOne(v: unknown): number {
  return Number(first(v)) === 0 ? 0 : 1;
}

// JSON bootstrap for client scripts; < escaped so it can't break out of <script>.
function bootstrap(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function renderGamePage(query: PageQuery): string {
  const username = cleanUsername(query.user);
  const sessionId = cleanSession(query.session);
  const levelId = cleanLevelId(query.levelid);
  const data = {
    username,
    sessionId,
    territory: cleanTerritory(query.territory),
    levelId,
    levelTitle: cleanTitle(query.title),
    isZoneOne: cleanZoneOne(query.zoneone),
    contentSwf: "/games/swf/52/52.swf",
  };
  const body = eta.renderString(gameBodyTemplate, data);
  return eta.renderString(layoutTemplate, {
    username,
    headExtra: "",
    domloadExtra: gameDomloadExtra,
    bootstrap: bootstrap({ sessionId, username, levelId }),
    body,
  });
}

export function renderEditorPage(query: PageQuery): string {
  const username = cleanUsername(query.user);
  const sessionId = cleanSession(query.session);
  const levelId = cleanLevelId(query.levelid);
  const body = eta.renderString(editorBodyTemplate, {
    username,
    sessionId,
    territory: cleanTerritory(query.territory),
    levelId,
  });
  return eta.renderString(layoutTemplate, {
    username,
    headExtra: editorHeadExtra,
    domloadExtra: "",
    bootstrap: bootstrap({ sessionId, username, levelId }),
    body,
  });
}
