import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getAllVsls, getVslById, upsertVsl, updateVslMapping,
  getVslGroups, getAggregatedPerformance, getTimeSeriesData,
  getVslRetentionData, getPerformanceData, getLatestSyncLogs,
  getSetting, setSetting, getAllSettings,
} from "./db";
import { syncAllData, syncRedTrackData, syncVTurbData } from "./services/syncService";
import { normalizeVslName, extractGroupName } from "./services/vslNormalizer";
import { subDays, format } from "date-fns";

function calcPeriodDates(period: string): { from: string; to: string; prevFrom: string; prevTo: string } {
  const now = new Date();
  const to = format(now, "yyyy-MM-dd");
  let days = 30;
  if (period === "3D") days = 3;
  else if (period === "7D") days = 7;
  else if (period === "14D") days = 14;
  else if (period === "30D") days = 30;
  else if (period === "45D") days = 45;
  else if (period === "60D") days = 60;
  else if (period === "TOTAL") days = 365;

  const from = format(subDays(now, days), "yyyy-MM-dd");
  const prevTo = format(subDays(now, days + 1), "yyyy-MM-dd");
  const prevFrom = format(subDays(now, days * 2), "yyyy-MM-dd");
  return { from, to, prevFrom, prevTo };
}

type AggRow = {
  revenue: string; cost: string; profit: string;
  clicks: number; conversions: number;
  impressions?: number; lpViews?: number; lpClicks?: number;
  initiateCheckouts?: number; purchases?: number;
  totalPlays: number; uniquePlays: number;
  avgWatchRate: string; avgWatchTime: number;
};

function buildVslSummary(
  vsl: { id: number; name: string; groupName: string | null; product: string | null },
  agg: AggRow
) {
  const revenue = parseFloat(agg.revenue || "0");
  const cost = parseFloat(agg.cost || "0");
  const profit = parseFloat(agg.profit || "0");
  const clicks = agg.clicks || 0;
  const conversions = agg.conversions || 0;
  const impressions = agg.impressions || 0;
  const lpViews = agg.lpViews || 0;
  const lpClicks = agg.lpClicks || 0;
  const initiateCheckouts = agg.initiateCheckouts || 0;
  const purchases = agg.purchases || 0;
  const totalPlays = agg.totalPlays || 0;
  const uniquePlays = agg.uniquePlays || 0;
  const watchRate = parseFloat(agg.avgWatchRate || "0");
  const avgWatchTime = agg.avgWatchTime || 0;

  // Financial metrics
  const roi = cost > 0 ? ((profit / cost) * 100) : 0;
  const epc = clicks > 0 ? (revenue / clicks) : 0;
  const conversionRate = clicks > 0 ? ((conversions / clicks) * 100) : 0;

  // Cost metrics
  const cpc = clicks > 0 ? (cost / clicks) : 0;
  const cpi = impressions > 0 ? (cost / impressions) * 1000 : 0; // CPM-style
  const cpa = purchases > 0 ? (cost / purchases) : 0;

  // Funnel rates
  const lpCtr = lpViews > 0 ? ((lpClicks / lpViews) * 100) : 0;
  const hookRate = totalPlays > 0 ? ((uniquePlays / totalPlays) * 100) : 0; // % who stayed past initial hook
  const bodyRate = watchRate; // alias for watch rate (% who watched significant portion)
  const checkoutRate = initiateCheckouts > 0 ? ((purchases / initiateCheckouts) * 100) : 0;
  const overallFunnelRate = lpViews > 0 ? ((purchases / lpViews) * 100) : 0;

  return {
    id: vsl.id,
    name: vsl.name,
    groupName: vsl.groupName,
    product: vsl.product,
    // Financial
    revenue, cost, profit, roi, epc,
    // Volume
    clicks, conversions, impressions, purchases,
    // Funnel stages
    lpViews, lpClicks, initiateCheckouts,
    // Cost metrics
    cpc, cpi, cpa,
    // Video metrics
    totalPlays, uniquePlays, watchRate, avgWatchTime,
    // Funnel rates
    conversionRate, lpCtr, hookRate, bodyRate,
    checkoutRate, overallFunnelRate,
  };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ VSL Management ============
  vsls: router({
    list: publicProcedure.query(async () => {
      return getAllVsls();
    }),

    groups: publicProcedure.query(async () => {
      return getVslGroups();
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getVslById(input.id);
      }),

    create: publicProcedure
      .input(z.object({
        name: z.string(),
        groupName: z.string().optional(),
        product: z.string().optional(),
        vturbPlayerId: z.string().optional(),
        redtrackLandingId: z.string().optional(),
        redtrackLandingName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const normalizedName = normalizeVslName(input.name);
        const groupName = input.groupName || extractGroupName(input.name);
        const id = await upsertVsl({
          name: input.name,
          normalizedName,
          groupName,
          product: input.product,
          vturbPlayerId: input.vturbPlayerId,
          redtrackLandingId: input.redtrackLandingId,
          redtrackLandingName: input.redtrackLandingName,
        });
        return { id };
      }),

    updateMapping: publicProcedure
      .input(z.object({
        id: z.number(),
        vturbPlayerId: z.string().optional(),
        redtrackLandingId: z.string().optional(),
        product: z.string().optional(),
        groupName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        await updateVslMapping(id, updates);
        return { success: true };
      }),
  }),

  // ============ Dashboard ============
  dashboard: router({
    overview: publicProcedure
      .input(z.object({
        period: z.string().default("30D"),
        vslIds: z.array(z.number()).optional(),
        groupName: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { from, to, prevFrom, prevTo } = calcPeriodDates(input.period);

        // Get VSL IDs filtered by group if needed
        let vslIds = input.vslIds;
        if (input.groupName && (!vslIds || vslIds.length === 0)) {
          const allVsls = await getAllVsls();
          vslIds = allVsls
            .filter(v => v.groupName?.toLowerCase() === input.groupName?.toLowerCase())
            .map(v => v.id);
        }

        const [currentData, previousData] = await Promise.all([
          getAggregatedPerformance(from, to, vslIds),
          getAggregatedPerformance(prevFrom, prevTo, vslIds),
        ]);

        const sumMetrics = (data: typeof currentData) => {
          let totalRevenue = 0, totalCost = 0, totalProfit = 0;
          let totalClicks = 0, totalConversions = 0;
          let totalPlays = 0, totalUniquePlays = 0;
          let watchRateSum = 0, watchRateCount = 0;

          for (const row of data) {
            totalRevenue += parseFloat(row.revenue || "0");
            totalCost += parseFloat(row.cost || "0");
            totalProfit += parseFloat(row.profit || "0");
            totalClicks += row.clicks || 0;
            totalConversions += row.conversions || 0;
            totalPlays += row.totalPlays || 0;
            totalUniquePlays += row.uniquePlays || 0;
            const wr = parseFloat(row.avgWatchRate || "0");
            if (wr > 0) { watchRateSum += wr; watchRateCount++; }
          }

          const avgRoi = totalCost > 0 ? ((totalProfit / totalCost) * 100) : 0;
          const avgEpc = totalClicks > 0 ? (totalRevenue / totalClicks) : 0;
          const avgConversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100) : 0;
          const avgWatchRate = watchRateCount > 0 ? (watchRateSum / watchRateCount) : 0;

          return {
            totalRevenue, totalCost, totalProfit,
            totalClicks, totalConversions,
            totalPlays, totalUniquePlays,
            avgRoi, avgEpc, avgConversionRate, avgWatchRate,
          };
        };

        const current = sumMetrics(currentData);
        const previous = sumMetrics(previousData);

        const pctChange = (curr: number, prev: number) =>
          prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : (curr > 0 ? 100 : 0);

        return {
          current,
          previous,
          changes: {
            revenue: pctChange(current.totalRevenue, previous.totalRevenue),
            cost: pctChange(current.totalCost, previous.totalCost),
            profit: pctChange(current.totalProfit, previous.totalProfit),
            roi: pctChange(current.avgRoi, previous.avgRoi),
            epc: pctChange(current.avgEpc, previous.avgEpc),
            conversionRate: pctChange(current.avgConversionRate, previous.avgConversionRate),
            plays: pctChange(current.totalPlays, previous.totalPlays),
            watchRate: pctChange(current.avgWatchRate, previous.avgWatchRate),
          },
          period: input.period,
          dateRange: { from, to },
        };
      }),

    ranking: publicProcedure
      .input(z.object({
        period: z.string().default("30D"),
        vslIds: z.array(z.number()).optional(),
        groupName: z.string().optional(),
        sortBy: z.string().default("revenue"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }))
      .query(async ({ input }) => {
        const { from, to } = calcPeriodDates(input.period);

        const allVsls = await getAllVsls();
        let filteredVsls = allVsls;

        if (input.groupName) {
          filteredVsls = filteredVsls.filter(v =>
            v.groupName?.toLowerCase() === input.groupName?.toLowerCase()
          );
        }
        if (input.vslIds && input.vslIds.length > 0) {
          filteredVsls = filteredVsls.filter(v => input.vslIds!.includes(v.id));
        }

        const vslIds = filteredVsls.map(v => v.id);
        const aggData = await getAggregatedPerformance(from, to, vslIds.length > 0 ? vslIds : undefined);

        const vslMap = new Map(filteredVsls.map(v => [v.id, v]));
        const summaries = aggData.map(agg => {
          const vsl = vslMap.get(agg.vslId);
          if (!vsl) return null;
          return buildVslSummary(vsl, agg);
        }).filter(Boolean) as ReturnType<typeof buildVslSummary>[];

        // Sort
        const sortKey = input.sortBy as keyof typeof summaries[0];
        summaries.sort((a, b) => {
          const aVal = (a as any)[sortKey] ?? 0;
          const bVal = (b as any)[sortKey] ?? 0;
          if (typeof aVal === "string") {
            return input.sortDir === "asc"
              ? aVal.localeCompare(bVal as string)
              : (bVal as string).localeCompare(aVal);
          }
          return input.sortDir === "asc" ? aVal - bVal : bVal - aVal;
        });

        // Paginate
        const total = summaries.length;
        const start = (input.page - 1) * input.pageSize;
        const items = summaries.slice(start, start + input.pageSize);

        return { items, total, page: input.page, pageSize: input.pageSize };
      }),

    timeSeries: publicProcedure
      .input(z.object({
        period: z.string().default("30D"),
        vslIds: z.array(z.number()).optional(),
        groupName: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { from, to } = calcPeriodDates(input.period);

        let vslIds = input.vslIds;
        if (input.groupName && (!vslIds || vslIds.length === 0)) {
          const allVsls = await getAllVsls();
          vslIds = allVsls
            .filter(v => v.groupName?.toLowerCase() === input.groupName?.toLowerCase())
            .map(v => v.id);
        }

        const data = await getTimeSeriesData(from, to, vslIds);
        return data.map(row => ({
          date: typeof row.date === 'string' ? row.date : format(row.date as unknown as Date, "yyyy-MM-dd"),
          revenue: parseFloat(row.revenue || "0"),
          cost: parseFloat(row.cost || "0"),
          profit: parseFloat(row.profit || "0"),
          clicks: row.clicks || 0,
          conversions: row.conversions || 0,
          totalPlays: row.totalPlays || 0,
          uniquePlays: row.uniquePlays || 0,
        }));
      }),
  }),

  // ============ VSL Detail ============
  vslDetail: router({
    get: publicProcedure
      .input(z.object({
        id: z.number(),
        period: z.string().default("30D"),
      }))
      .query(async ({ input }) => {
        const vsl = await getVslById(input.id);
        if (!vsl) return null;

        const { from, to } = calcPeriodDates(input.period);

        const [aggData, tsData, retData] = await Promise.all([
          getAggregatedPerformance(from, to, [input.id]),
          getTimeSeriesData(from, to, [input.id]),
          getVslRetentionData(input.id, from, to),
        ]);

        const emptyAgg: AggRow = {
          revenue: "0", cost: "0", profit: "0", clicks: 0, conversions: 0,
          impressions: 0, lpViews: 0, lpClicks: 0,
          initiateCheckouts: 0, purchases: 0,
          totalPlays: 0, uniquePlays: 0, avgWatchRate: "0", avgWatchTime: 0,
        };
        const metrics = aggData.length > 0
          ? buildVslSummary(vsl, aggData[0])
          : buildVslSummary(vsl, emptyAgg);

        const timeSeries = tsData.map(row => ({
          date: typeof row.date === 'string' ? row.date : format(row.date as unknown as Date, "yyyy-MM-dd"),
          revenue: parseFloat(row.revenue || "0"),
          cost: parseFloat(row.cost || "0"),
          profit: parseFloat(row.profit || "0"),
          clicks: row.clicks || 0,
          conversions: row.conversions || 0,
          totalPlays: row.totalPlays || 0,
          uniquePlays: row.uniquePlays || 0,
        }));

        // Aggregate retention data
        let retentionCurve: Array<{ second: number; viewers: number; percentage: number }> = [];
        if (retData.length > 0) {
          const lastRetention = retData[retData.length - 1];
          if (lastRetention.retentionData) {
            try {
              const parsed = typeof lastRetention.retentionData === "string"
                ? JSON.parse(lastRetention.retentionData)
                : lastRetention.retentionData;
              if (Array.isArray(parsed)) {
                const maxViewers = parsed.length > 0 ? (parsed[0].viewers || parsed[0].total || 1) : 1;
                retentionCurve = parsed.map((p: any) => ({
                  second: p.second || p.time || 0,
                  viewers: p.viewers || p.total || 0,
                  percentage: maxViewers > 0 ? ((p.viewers || p.total || 0) / maxViewers) * 100 : 0,
                }));
              }
            } catch (e) {
              console.warn("Failed to parse retention data:", e);
            }
          }
        }

        // Get group average
        let groupAverage = null;
        if (vsl.groupName) {
          const allVsls = await getAllVsls();
          const groupVslIds = allVsls
            .filter(v => v.groupName?.toLowerCase() === vsl.groupName?.toLowerCase() && v.id !== vsl.id)
            .map(v => v.id);
          if (groupVslIds.length > 0) {
            const groupAgg = await getAggregatedPerformance(from, to, groupVslIds);
            if (groupAgg.length > 0) {
              // Average across group
              const n = groupAgg.length;
              const avgAgg: AggRow = {
                revenue: String(groupAgg.reduce((s, r) => s + parseFloat(r.revenue || "0"), 0) / n),
                cost: String(groupAgg.reduce((s, r) => s + parseFloat(r.cost || "0"), 0) / n),
                profit: String(groupAgg.reduce((s, r) => s + parseFloat(r.profit || "0"), 0) / n),
                clicks: Math.round(groupAgg.reduce((s, r) => s + (r.clicks || 0), 0) / n),
                conversions: Math.round(groupAgg.reduce((s, r) => s + (r.conversions || 0), 0) / n),
                impressions: Math.round(groupAgg.reduce((s, r) => s + (r.impressions || 0), 0) / n),
                lpViews: Math.round(groupAgg.reduce((s, r) => s + (r.lpViews || 0), 0) / n),
                lpClicks: Math.round(groupAgg.reduce((s, r) => s + (r.lpClicks || 0), 0) / n),
                initiateCheckouts: Math.round(groupAgg.reduce((s, r) => s + (r.initiateCheckouts || 0), 0) / n),
                purchases: Math.round(groupAgg.reduce((s, r) => s + (r.purchases || 0), 0) / n),
                totalPlays: Math.round(groupAgg.reduce((s, r) => s + (r.totalPlays || 0), 0) / n),
                uniquePlays: Math.round(groupAgg.reduce((s, r) => s + (r.uniquePlays || 0), 0) / n),
                avgWatchRate: String(groupAgg.reduce((s, r) => s + parseFloat(r.avgWatchRate || "0"), 0) / n),
                avgWatchTime: Math.round(groupAgg.reduce((s, r) => s + (r.avgWatchTime || 0), 0) / n),
              };
              groupAverage = buildVslSummary(
                { id: 0, name: `${vsl.groupName} Average`, groupName: vsl.groupName, product: null },
                avgAgg
              );
            }
          }
        }

        return {
          id: vsl.id,
          name: vsl.name,
          groupName: vsl.groupName,
          product: vsl.product,
          vturbPlayerId: vsl.vturbPlayerId,
          redtrackLandingId: vsl.redtrackLandingId,
          metrics,
          retentionCurve,
          timeSeries,
          groupAverage,
        };
      }),
  }),

  // ============ Sync & Settings ============
  sync: router({
    trigger: publicProcedure
      .input(z.object({
        dateFrom: z.string(),
        dateTo: z.string(),
        source: z.enum(["all", "redtrack", "vturb"]).default("all"),
      }))
      .mutation(async ({ input }) => {
        if (input.source === "redtrack") {
          return syncRedTrackData(input.dateFrom, input.dateTo);
        }
        if (input.source === "vturb") {
          return syncVTurbData(input.dateFrom, input.dateTo);
        }
        return syncAllData(input.dateFrom, input.dateTo);
      }),

    status: publicProcedure.query(async () => {
      const logs = await getLatestSyncLogs();
      return logs.map(log => ({
        source: log.source,
        syncType: log.syncType,
        status: log.status,
        lastSync: log.startedAt ? log.startedAt.toISOString() : null,
        recordsProcessed: log.recordsProcessed || 0,
        errorMessage: log.errorMessage,
      }));
    }),
  }),

  settings: router({
    getAll: publicProcedure.query(async () => {
      const settings = await getAllSettings();
      // Mask API keys for security
      return settings.map(s => ({
        ...s,
        settingValue: s.settingKey.includes("key") || s.settingKey.includes("token")
          ? (s.settingValue ? `***${s.settingValue.slice(-4)}` : null)
          : s.settingValue,
      }));
    }),

    set: publicProcedure
      .input(z.object({
        key: z.string(),
        value: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await setSetting(input.key, input.value, input.description);
        return { success: true };
      }),

    testRedTrack: publicProcedure.query(async () => {
      const apiKey = await getSetting("redtrack_api_key");
      if (!apiKey) return { connected: false, error: "API key not configured" };
      try {
        const { fetchRedTrackLandings } = await import("./services/redtrack");
        const landings = await fetchRedTrackLandings(apiKey);
        return { connected: true, landingsCount: landings.length };
      } catch (e: any) {
        return { connected: false, error: e.message };
      }
    }),

    testVTurb: publicProcedure.query(async () => {
      const apiToken = await getSetting("vturb_api_token");
      if (!apiToken) return { connected: false, error: "API token not configured" };
      try {
        const { fetchVTurbCompanyTotals } = await import("./services/vturb");
        const now = new Date();
        const from = format(subDays(now, 7), "yyyy-MM-dd");
        const to = format(now, "yyyy-MM-dd");
        await fetchVTurbCompanyTotals(apiToken, from, to);
        return { connected: true };
      } catch (e: any) {
        return { connected: false, error: e.message };
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
