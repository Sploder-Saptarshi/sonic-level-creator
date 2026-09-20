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
import { index, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
  image: text("image"),
  username: text("username").unique(),
  displayUsername: text("display_username"),
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
  ],
);
