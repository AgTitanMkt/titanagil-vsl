import {
  upsertVsl, upsertPerformanceData, getSetting,
  createSyncLog, updateSyncLog, getLastSuccessfulSync, getAllVsls,
} from "../db";
import { fetchRedTrackLandingReport, fetchRedTrackLandingReportByDay, fetchRedTrackLandings } from "./redtrack";
import { fetchVTurbPlayerStats, fetchVTurbStatsByDay, fetchVTurbVideoTimed } from "./vturb";
import { normalizeVslName, extractGroupName } from "./vslNormalizer";

/**
 * Sync RedTrack landing data for a date range.
 * Creates/updates VSL records and performance data.
 */
export async function syncRedTrackData(dateFrom: string, dateTo: string): Promise<{
  success: boolean;
  recordsProcessed: number;
  error?: string;
}> {
  const apiKey = await getSetting("redtrack_api_key");
  if (!apiKey) {
    return { success: false, recordsProcessed: 0, error: "RedTrack API key not configured" };
  }

  const logId = await createSyncLog({
    source: "redtrack",
    syncType: "landing_report",
    status: "running",
    dateFrom,
    dateTo,
  });

  try {
    // Fetch landing report grouped by landing and date
    const reportData = await fetchRedTrackLandingReportByDay(apiKey, dateFrom, dateTo);
    let recordsProcessed = 0;

    for (const row of reportData) {
      const landingName = row.landing || row.landing_id || "Unknown";
      const normalizedName = normalizeVslName(landingName);
      const groupName = extractGroupName(landingName);

      // Upsert VSL record
      const vslId = await upsertVsl({
        name: landingName,
        normalizedName,
        groupName,
        redtrackLandingId: row.landing_id || null,
        redtrackLandingName: landingName,
      });

      // Upsert performance data
      if (row.date) {
        // Map RedTrack fields to our funnel columns
        // RedTrack returns different field names depending on configuration
        const impressions = Number(row.impressions) || Number(row['imp']) || 0;
        const clicks = Number(row.clicks) || 0;
        const lpViews = Number(row.lp_views) || Number(row['lp_views']) || Number(row['lpviews']) || 0;
        const lpClicks = Number(row.lp_clicks) || Number(row['lp_clicks']) || Number(row['lpclicks']) || 0;
        const conversions = Number(row.conversions) || Number(row.total_conversions) || 0;
        const purchases = Number(row.purchases) || Number(row.sales) || Number(row['tr']) || conversions;
        const initiateCheckouts = Number(row['initiate_checkouts']) || Number(row['ic']) || 0;

        await upsertPerformanceData({
          vslId,
          date: row.date,
          revenue: String(row.revenue || 0),
          cost: String(row.cost || 0),
          profit: String(row.profit || 0),
          clicks,
          conversions,
          impressions,
          lpViews: lpViews || clicks, // fallback: if no lp_views, use clicks
          lpClicks,
          initiateCheckouts,
          purchases,
        });
        recordsProcessed++;
      }
    }

    await updateSyncLog(logId, {
      status: "success",
      recordsProcessed,
      completedAt: new Date() as any,
    });

    return { success: true, recordsProcessed };
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown error";
    await updateSyncLog(logId, {
      status: "error",
      errorMessage,
      completedAt: new Date() as any,
    });
    return { success: false, recordsProcessed: 0, error: errorMessage };
  }
}

/**
 * Sync VTurb video metrics for all VSLs that have a player ID mapped.
 */
export async function syncVTurbData(dateFrom: string, dateTo: string): Promise<{
  success: boolean;
  recordsProcessed: number;
  error?: string;
}> {
  const apiToken = await getSetting("vturb_api_token");
  if (!apiToken) {
    return { success: false, recordsProcessed: 0, error: "VTurb API token not configured" };
  }

  const logId = await createSyncLog({
    source: "vturb",
    syncType: "player_stats",
    status: "running",
    dateFrom,
    dateTo,
  });

  try {
    // Get all VSLs with VTurb player IDs
    const allVsls = await getAllVsls();
    const vslsWithPlayers = allVsls.filter(v => v.vturbPlayerId);
    let recordsProcessed = 0;

    // Also try to get all player stats from company endpoint
    try {
      const companyStats = await fetchVTurbPlayerStats(apiToken, dateFrom, dateTo);
      if (companyStats.players_start_date) {
        // Map player stats to VSLs
        for (const playerStat of companyStats.players_start_date) {
          const matchingVsl = allVsls.find(v => v.vturbPlayerId === playerStat.player_id);
          if (matchingVsl) {
            // Get started and finished events
            const startedEvent = playerStat.events?.find(e => e.event_name === "started");
            const finishedEvent = playerStat.events?.find(e => e.event_name === "finished");
            const totalPlays = startedEvent?.total || playerStat.total || 0;
            const uniquePlays = startedEvent?.total_uniq_device || playerStat.total_uniq_device || 0;
            const finishedCount = finishedEvent?.total || 0;
            const watchRate = totalPlays > 0 ? (finishedCount / totalPlays) * 100 : 0;

            // Update performance data (merge with existing RedTrack data)
            await upsertPerformanceData({
              vslId: matchingVsl.id,
              date: dateFrom, // Aggregate for the period
              totalPlays,
              uniquePlays,
              watchRate: String(watchRate.toFixed(2)),
            });
            recordsProcessed++;
          }
        }
      }
    } catch (e) {
      console.warn("[VTurb] Failed to fetch company player stats:", e);
    }

    // Fetch detailed stats for each VSL with player ID
    for (const vsl of vslsWithPlayers) {
      try {
        // Get stats by day
        const statsByDay = await fetchVTurbStatsByDay(
          apiToken, vsl.vturbPlayerId!, dateFrom, dateTo
        );

        if (statsByDay.events_by_day) {
          for (const dayData of statsByDay.events_by_day) {
            await upsertPerformanceData({
              vslId: vsl.id,
              date: dayData.day,
              totalPlays: dayData.total || 0,
              uniquePlays: dayData.total_uniq_device || 0,
            });
            recordsProcessed++;
          }
        }

        // Get retention data
        try {
          const videoTimed = await fetchVTurbVideoTimed(
            apiToken, vsl.vturbPlayerId!, dateFrom, dateTo
          );

          if (videoTimed.grouped_timed && videoTimed.grouped_timed.length > 0) {
            const retentionData = videoTimed.grouped_timed.map(item => ({
              second: item.second || item.time || 0,
              viewers: item.total || 0,
              uniqueViewers: item.total_uniq_device || 0,
            }));

            // Calculate quartiles from retention data
            const maxViewers = retentionData.length > 0 ? retentionData[0].viewers : 0;
            const totalSeconds = retentionData.length;
            const q25Index = Math.floor(totalSeconds * 0.25);
            const q50Index = Math.floor(totalSeconds * 0.5);
            const q75Index = Math.floor(totalSeconds * 0.75);

            // Calculate average watch time
            let totalWatchSeconds = 0;
            for (const point of retentionData) {
              totalWatchSeconds += point.viewers;
            }
            const avgWatchTime = maxViewers > 0 ? Math.round(totalWatchSeconds / maxViewers) : 0;

            await upsertPerformanceData({
              vslId: vsl.id,
              date: dateFrom,
              retentionData: JSON.stringify(retentionData),
              avgWatchTime,
              quartile25: retentionData[q25Index]?.viewers || 0,
              quartile50: retentionData[q50Index]?.viewers || 0,
              quartile75: retentionData[q75Index]?.viewers || 0,
              quartile100: retentionData[totalSeconds - 1]?.viewers || 0,
            });
          }
        } catch (e) {
          console.warn(`[VTurb] Failed to fetch retention for player ${vsl.vturbPlayerId}:`, e);
        }
      } catch (e) {
        console.warn(`[VTurb] Failed to fetch stats for player ${vsl.vturbPlayerId}:`, e);
      }
    }

    await updateSyncLog(logId, {
      status: "success",
      recordsProcessed,
      completedAt: new Date() as any,
    });

    return { success: true, recordsProcessed };
  } catch (error: any) {
    const errorMessage = error?.message || "Unknown error";
    await updateSyncLog(logId, {
      status: "error",
      errorMessage,
      completedAt: new Date() as any,
    });
    return { success: false, recordsProcessed: 0, error: errorMessage };
  }
}

/**
 * Full sync: RedTrack + VTurb
 */
export async function syncAllData(dateFrom: string, dateTo: string) {
  const redtrackResult = await syncRedTrackData(dateFrom, dateTo);
  const vturbResult = await syncVTurbData(dateFrom, dateTo);
  return {
    redtrack: redtrackResult,
    vturb: vturbResult,
  };
}
