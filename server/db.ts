import { eq, and, gte, lte, sql, desc, asc, inArray, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  vsls, InsertVsl, Vsl,
  vslPerformanceData, InsertVslPerformanceData,
  apiSyncLog, InsertApiSyncLog,
  apiSettings,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import mysql from "mysql2/promise";


let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER HELPERS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ VSL HELPERS ============

export async function getAllVsls(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const conditions = activeOnly ? [eq(vsls.isActive, 1)] : [];
  return db.select().from(vsls).where(conditions.length ? conditions[0] : undefined);
}

export async function getVslById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(vsls).where(eq(vsls.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getVslByNormalizedName(normalizedName: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(vsls).where(eq(vsls.normalizedName, normalizedName)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertVsl(vsl: InsertVsl): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getVslByNormalizedName(vsl.normalizedName);
  if (existing) {
    await db.update(vsls).set({
      name: vsl.name,
      groupName: vsl.groupName,
      product: vsl.product,
      vturbPlayerId: vsl.vturbPlayerId ?? existing.vturbPlayerId,
      redtrackLandingId: vsl.redtrackLandingId ?? existing.redtrackLandingId,
      redtrackLandingName: vsl.redtrackLandingName ?? existing.redtrackLandingName,
    }).where(eq(vsls.id, existing.id));
    return existing.id;
  }
  const result = await db.insert(vsls).values(vsl);
  return result[0].insertId;
}

export async function updateVslMapping(id: number, updates: Partial<InsertVsl>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vsls).set(updates).where(eq(vsls.id, id));
}

export async function getVslGroups() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ groupName: vsls.groupName }).from(vsls).where(eq(vsls.isActive, 1));
  return result.map(r => r.groupName).filter(Boolean) as string[];
}

// ============ PERFORMANCE DATA HELPERS ============

export async function upsertPerformanceData(data: InsertVslPerformanceData) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(vslPerformanceData).values(data).onDuplicateKeyUpdate({
    set: {
      revenue: data.revenue,
      cost: data.cost,
      profit: data.profit,
      clicks: data.clicks,
      conversions: data.conversions,
      impressions: data.impressions,
      lpViews: data.lpViews,
      lpClicks: data.lpClicks,
      presellViews: data.presellViews,
      presellClicks: data.presellClicks,
      initiateCheckouts: data.initiateCheckouts,
      purchases: data.purchases,
      totalPlays: data.totalPlays,
      uniquePlays: data.uniquePlays,
      watchRate: data.watchRate,
      avgWatchTime: data.avgWatchTime,
      retentionData: data.retentionData,
      quartile25: data.quartile25,
      quartile50: data.quartile50,
      quartile75: data.quartile75,
      quartile100: data.quartile100,
    },
  });
}

export async function getPerformanceData(
  dateFrom: string,
  dateTo: string,
  vslIds?: number[]
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [
    gte(vslPerformanceData.date, sql`${dateFrom}`),
    lte(vslPerformanceData.date, sql`${dateTo}`),
  ];
  if (vslIds && vslIds.length > 0) {
    conditions.push(inArray(vslPerformanceData.vslId, vslIds));
  }
  return db.select().from(vslPerformanceData).where(and(...conditions));
}

export async function getAggregatedPerformance(
  dateFrom: string,
  dateTo: string,
  vslIds?: number[]
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [
    gte(vslPerformanceData.date, sql`${dateFrom}`),
    lte(vslPerformanceData.date, sql`${dateTo}`),
  ];
  if (vslIds && vslIds.length > 0) {
    conditions.push(inArray(vslPerformanceData.vslId, vslIds));
  }
  return db.select({
    vslId: vslPerformanceData.vslId,
    revenue: sql<string>`SUM(${vslPerformanceData.revenue})`,
    cost: sql<string>`SUM(${vslPerformanceData.cost})`,
    profit: sql<string>`SUM(${vslPerformanceData.profit})`,
    clicks: sql<number>`SUM(${vslPerformanceData.clicks})`,
    conversions: sql<number>`SUM(${vslPerformanceData.conversions})`,
    impressions: sql<number>`SUM(${vslPerformanceData.impressions})`,
    lpViews: sql<number>`SUM(${vslPerformanceData.lpViews})`,
    lpClicks: sql<number>`SUM(${vslPerformanceData.lpClicks})`,
    presellViews: sql<number>`SUM(${vslPerformanceData.presellViews})`,
    presellClicks: sql<number>`SUM(${vslPerformanceData.presellClicks})`,
    initiateCheckouts: sql<number>`SUM(${vslPerformanceData.initiateCheckouts})`,
    purchases: sql<number>`SUM(${vslPerformanceData.purchases})`,
    totalPlays: sql<number>`SUM(${vslPerformanceData.totalPlays})`,
    uniquePlays: sql<number>`SUM(${vslPerformanceData.uniquePlays})`,
    avgWatchRate: sql<string>`AVG(${vslPerformanceData.watchRate})`,
    avgWatchTime: sql<number>`AVG(${vslPerformanceData.avgWatchTime})`,
  })
    .from(vslPerformanceData)
    .where(and(...conditions))
    .groupBy(vslPerformanceData.vslId);
}

export async function getTimeSeriesData(
  dateFrom: string,
  dateTo: string,
  vslIds?: number[]
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [
    gte(vslPerformanceData.date, sql`${dateFrom}`),
    lte(vslPerformanceData.date, sql`${dateTo}`),
  ];
  if (vslIds && vslIds.length > 0) {
    conditions.push(inArray(vslPerformanceData.vslId, vslIds));
  }
  return db.select({
    date: vslPerformanceData.date,
    revenue: sql<string>`SUM(${vslPerformanceData.revenue})`,
    cost: sql<string>`SUM(${vslPerformanceData.cost})`,
    profit: sql<string>`SUM(${vslPerformanceData.profit})`,
    clicks: sql<number>`SUM(${vslPerformanceData.clicks})`,
    conversions: sql<number>`SUM(${vslPerformanceData.conversions})`,
    totalPlays: sql<number>`SUM(${vslPerformanceData.totalPlays})`,
    uniquePlays: sql<number>`SUM(${vslPerformanceData.uniquePlays})`,
  })
    .from(vslPerformanceData)
    .where(and(...conditions))
    .groupBy(vslPerformanceData.date)
    .orderBy(asc(vslPerformanceData.date));
}

export async function getVslRetentionData(vslId: number, dateFrom: string, dateTo: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    date: vslPerformanceData.date,
    retentionData: vslPerformanceData.retentionData,
  })
    .from(vslPerformanceData)
    .where(and(
      eq(vslPerformanceData.vslId, vslId),
      gte(vslPerformanceData.date, sql`${dateFrom}`),
      lte(vslPerformanceData.date, sql`${dateTo}`),
    ))
    .orderBy(asc(vslPerformanceData.date));
}

// ============ SYNC LOG HELPERS ============

export async function createSyncLog(log: InsertApiSyncLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(apiSyncLog).values(log);
  return result[0].insertId;
}

export async function updateSyncLog(id: number, updates: Partial<InsertApiSyncLog>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(apiSyncLog).set(updates).where(eq(apiSyncLog.id, id));
}

export async function getLatestSyncLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apiSyncLog).orderBy(desc(apiSyncLog.startedAt)).limit(20);
}

export async function getLastSuccessfulSync(source: string, syncType: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(apiSyncLog)
    .where(and(
      eq(apiSyncLog.source, source),
      eq(apiSyncLog.syncType, syncType),
      eq(apiSyncLog.status, "success"),
    ))
    .orderBy(desc(apiSyncLog.startedAt))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============ API SETTINGS HELPERS ============

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(apiSettings).where(eq(apiSettings.settingKey, key)).limit(1);
  return result.length > 0 ? (result[0].settingValue ?? null) : null;
}

export async function setSetting(key: string, value: string, description?: string) {
  // Use mysql2 directly to avoid Drizzle ORM compatibility issues with some MySQL versions
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("Database not available");
  const connection = await mysql.createConnection(dbUrl);
  try {
    const desc = description || null;
    await connection.execute(
      `INSERT INTO api_settings (settingKey, settingValue, description) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue), description = VALUES(description)`,
      [key, value, desc]
    );
  } finally {
    await connection.end();
  }
}



export async function getAllSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apiSettings);
}
