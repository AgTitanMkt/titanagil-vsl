import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, date, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * VSLs table - stores VSL definitions and their mappings to external services.
 * Each VSL is associated with a RedTrack landing and optionally a VTurb player.
 */
export const vsls = mysqlTable("vsls", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  normalizedName: varchar("normalizedName", { length: 255 }).notNull(),
  groupName: varchar("groupName", { length: 255 }),
  product: varchar("product", { length: 255 }),
  vturbPlayerId: varchar("vturbPlayerId", { length: 255 }),
  redtrackLandingId: varchar("redtrackLandingId", { length: 255 }),
  redtrackLandingName: varchar("redtrackLandingName", { length: 255 }),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Vsl = typeof vsls.$inferSelect;
export type InsertVsl = typeof vsls.$inferInsert;

/**
 * VSL Performance Data - daily aggregated metrics from RedTrack + VTurb.
 * One row per VSL per day.
 */
export const vslPerformanceData = mysqlTable("vsl_performance_data", {
  id: int("id").autoincrement().primaryKey(),
  vslId: int("vslId").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  // RedTrack metrics - Financial
  revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0"),
  cost: decimal("cost", { precision: 12, scale: 2 }).default("0"),
  profit: decimal("profit", { precision: 12, scale: 2 }).default("0"),
  clicks: int("clicks").default(0),
  conversions: int("conversions").default(0),
  // RedTrack metrics - Funnel
  impressions: int("impressions").default(0),
  lpViews: int("lpViews").default(0),
  lpClicks: int("lpClicks").default(0),
  presellViews: int("presellViews").default(0),
  presellClicks: int("presellClicks").default(0),
  initiateCheckouts: int("initiateCheckouts").default(0),
  purchases: int("purchases").default(0),
  // VTurb metrics
  totalPlays: int("totalPlays").default(0),
  uniquePlays: int("uniquePlays").default(0),
  watchRate: decimal("watchRate", { precision: 5, scale: 2 }).default("0"),
  avgWatchTime: int("avgWatchTime").default(0),
  // Retention data as JSON (array of {second, viewers} objects)
  retentionData: json("retentionData"),
  // Quartile tracking
  quartile25: int("quartile25").default(0),
  quartile50: int("quartile50").default(0),
  quartile75: int("quartile75").default(0),
  quartile100: int("quartile100").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("vsl_date_idx").on(table.vslId, table.date),
]);

export type VslPerformanceData = typeof vslPerformanceData.$inferSelect;
export type InsertVslPerformanceData = typeof vslPerformanceData.$inferInsert;

/**
 * API Sync Log - tracks when data was last synced from external APIs.
 */
export const apiSyncLog = mysqlTable("api_sync_log", {
  id: int("id").autoincrement().primaryKey(),
  source: varchar("source", { length: 50 }).notNull(),
  syncType: varchar("syncType", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["pending", "running", "success", "error"]).default("pending").notNull(),
  dateFrom: date("dateFrom", { mode: "string" }),
  dateTo: date("dateTo", { mode: "string" }),
  recordsProcessed: int("recordsProcessed").default(0),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type ApiSyncLog = typeof apiSyncLog.$inferSelect;
export type InsertApiSyncLog = typeof apiSyncLog.$inferInsert;

/**
 * API Settings - stores API keys and configuration for external services.
 */
export const apiSettings = mysqlTable("api_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  settingValue: text("settingValue"),
  description: varchar("description", { length: 500 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiSetting = typeof apiSettings.$inferSelect;
export type InsertApiSetting = typeof apiSettings.$inferInsert;
