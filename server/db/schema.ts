// Better Auth core tables (+ username plugin) and app tables. D1 bills
// rows_read, so every hot lookup is indexed.
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
  // Trigger-maintained (migration 0009); never written by app code.
  // levelCount includes the stock level, publishedLevelCount excludes it.
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

// `data` is the level CSV (levelCSV() in ts/actions.ts).
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
    // Permanent once set by Share.
    published: integer("published", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("level_user_id_idx").on(t.userId),
    // Keyset page walks: All Levels, My Levels, Levels by X.
    index("level_published_updated_idx").on(t.published, t.updatedAt),
    index("level_user_updated_idx").on(t.userId, t.updatedAt),
    index("level_user_pub_updated_idx").on(t.userId, t.published, t.updatedAt),
  ],
);

// Global listing counters, single row id = 1 (migration 0009).
// Trigger-maintained; never written by app code.
export const stats = sqliteTable("stats", {
  id: integer("id").primaryKey(),
  publishedLevels: integer("published_levels").notNull().default(0),
  openReports: integer("open_reports").notNull().default(0),
});

// Level id sequencer, single row id = 1 (migration 0010). Bumped
// atomically by POST /api/levels via UPDATE ... RETURNING.
export const levelSeq = sqliteTable("level_seq", {
  id: integer("id").primaryKey(),
  nextId: integer("next_id").notNull(),
});

// `status` is 'open' until a moderator dismisses it. Uniqueness covers
// open rows only, so a user can re-report after a dismissal.
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
    index("report_status_created_idx").on(t.status, t.createdAt),
  ],
);
