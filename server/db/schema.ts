// server/db/schema.ts — Drizzle schema mirroring better-auth core tables
// plus the username plugin fields. Column names are snake_case; better-auth
// maps its camelCase fields onto these (canonical adapter shape).
//
// Hot-path indexes (D1 bills rows_read — every lookup below hits an index):
//   user.username UNIQUE  — sign-in by username
//   user.email UNIQUE     — sign-up dedupe, email lookups
//   session.token UNIQUE  — per-request session validation (hottest query)
//   session.userId        — list/revoke a user's sessions
//   account.userId        — provider accounts per user
//   verification.identifier — verification lookups
import { index, sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { eq } from "drizzle-orm";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  role: text("role").notNull().default("user"),
  // Trigger-maintained listing counters (migration 0009): total owned
  // levels (any state, stock row included — mirrors countMyLevels) and
  // owned published levels (stock excluded — mirrors
  // countPublicLevelsByUserId). Better Auth never reads/writes them;
  // they exist so listing pages serve totals from a 1-row PK lookup
  // instead of COUNT(*). Never set from application code.
  levelCount: integer("level_count").notNull().default(0),
  publishedLevelCount: integer("published_level_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// Saved levels: one row per user level. `data` is the level CSV (levelCSV()
// in ts/actions.ts); cols/rows are grid dimensions. All access is scoped to
// the owning user (see server/api/levels/*).
export const level = sqliteTable(
  "level",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    cols: integer("cols").notNull(),
    rows: integer("rows").notNull(),
    data: text("data").notNull().default(""),
    // Publishing is permanent: Share flips this once; published levels
    // appear in the public All Levels list.
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("level_user_id_idx").on(t.userId),
    // Composite over the All Levels filter + sort: answers both the
    // published COUNT and the ORDER BY updatedAt page walk from the index
    // alone (no sort step, no full-row scans). Subsumes the old
    // single-column published index (dropped in the migration).
    index("level_published_updated_idx").on(t.published, t.updatedAt),
    // Keyset page walks: My Levels filters userId and seeks on
    // (updatedAt, id); the per-user public page adds the published
    // predicate. Both walks stay inside these indexes.
    index("level_user_updated_idx").on(t.userId, t.updatedAt),
    index("level_user_pub_updated_idx").on(t.userId, t.published, t.updatedAt),
  ],
);

// Global listing counters (migration 0009): single row, id = 1.
// publishedLevels mirrors countPublicLevels (published, stock row
// excluded); openReports mirrors countOpenReports (status = 'open').
// Maintained by triggers on level/report — never written from
// application code — so listing pages serve totals from a 1-row PK
// lookup instead of COUNT(*).
export const stats = sqliteTable("stats", {
  id: integer("id").primaryKey(),
  publishedLevels: integer("published_levels").notNull().default(0),
  openReports: integer("open_reports").notNull().default(0),
});

// Atomic level id sequencer (migration 0010): single row, id = 1,
// next_id holds MAX(CAST(level.id AS INT)) so POST /api/levels can
// allocate via one atomic UPDATE ... RETURNING instead of the racy
// MAX+1 SELECT/INSERT loop. Never written outside that handler.
export const levelSeq = sqliteTable("level_seq", {
  id: integer("id").primaryKey(),
  nextId: integer("next_id").notNull(),
});

// Level reports: one row per (reporter, level) complaint. `status` is
// 'open' until a moderator dismisses it; deleting the level cascades its
// reports away. The partial unique index (open rows only) lets a user
// re-report after a dismiss but never double-queue the same open one —
// and lets dismiss flip open→dismissed without colliding with the reporter's
// earlier dismissed rows (a full (level, reporter, status) key crashes the
// second dismiss with UNIQUE constraint failed).
export const report = sqliteTable(
  "report",
  {
    id: text("id").primaryKey(),
    levelId: text("level_id")
      .notNull()
      .references(() => level.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("report_level_id_idx").on(t.levelId),
    uniqueIndex("report_open_unique").on(t.levelId, t.reporterId).where(eq(t.status, "open")),
    // Composite over the queue filter + sort: answers both the open COUNT
    // and the ORDER BY createdAt page walk from the index alone (no sort
    // step, no full-table scan).
    index("report_status_created_idx").on(t.status, t.createdAt),
  ],
);
