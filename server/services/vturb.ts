import axios from "axios";

const VTURB_BASE_URL = "https://analytics.vturb.net";
const RATE_LIMIT_DELAY = 1100; // ~60 RPM for basic tier

let lastRequestTime = 0;

async function rateLimitedRequest<T>(
  endpoint: string,
  apiToken: string,
  body: Record<string, unknown>
): Promise<T> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  const response = await axios.post<T>(`${VTURB_BASE_URL}${endpoint}`, body, {
    headers: {
      "X-Api-Token": apiToken,
      "X-Api-Version": "v1",
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
  return response.data;
}

export interface VTurbPlayerStats {
  player_id: string;
  player_name?: string;
  total?: number;
  total_uniq_device?: number;
  total_uniq_session?: number;
  events?: Array<{
    event_name: string;
    total: number;
    total_uniq_device: number;
    total_uniq_session: number;
  }>;
}

export interface VTurbStatsByDay {
  events_by_day: Array<{
    day: string;
    total: number;
    total_uniq_device: number;
    total_uniq_session: number;
  }>;
  total_events: number;
  total_uniq_device_events: number;
  total_uniq_session_events: number;
}

export interface VTurbVideoTimed {
  grouped_timed: Array<{
    second?: number;
    time?: number;
    company_id?: string;
    player_id?: string;
    total?: number;
    total_uniq_device?: number;
    total_uniq_session?: number;
  }>;
}

export interface VTurbCompanyPlayersResponse {
  players_start_date?: VTurbPlayerStats[];
  [key: string]: unknown;
}

/**
 * Fetch total events for all players in a company.
 * Returns started, finished, viewed counts per player.
 */
export async function fetchVTurbPlayerStats(
  apiToken: string,
  startDate: string,
  endDate: string,
  timezone?: string
): Promise<VTurbCompanyPlayersResponse> {
  return rateLimitedRequest<VTurbCompanyPlayersResponse>(
    "/events/total_by_company_players",
    apiToken,
    {
      events: ["started", "finished", "viewed"],
      start_date: startDate,
      end_date: endDate,
      ...(timezone && { timezone }),
    }
  );
}

/**
 * Fetch stats by day for a specific player.
 */
export async function fetchVTurbStatsByDay(
  apiToken: string,
  playerId: string,
  startDate: string,
  endDate: string,
  timezone?: string
): Promise<VTurbStatsByDay> {
  return rateLimitedRequest<VTurbStatsByDay>(
    "/conversions/stats_by_day",
    apiToken,
    {
      player_id: playerId,
      start_date: startDate,
      end_date: endDate,
      ...(timezone && { timezone }),
    }
  );
}

/**
 * Fetch video retention/timed data for a specific player.
 * Returns second-by-second viewer counts for retention curve.
 */
export async function fetchVTurbVideoTimed(
  apiToken: string,
  playerId: string,
  startDate: string,
  endDate: string,
  timezone?: string
): Promise<VTurbVideoTimed> {
  return rateLimitedRequest<VTurbVideoTimed>(
    "/conversions/video_timed",
    apiToken,
    {
      player_id: playerId,
      start_date: startDate,
      end_date: endDate,
      ...(timezone && { timezone }),
    }
  );
}

/**
 * Fetch total events for a company (aggregate).
 */
export async function fetchVTurbCompanyTotals(
  apiToken: string,
  startDate: string,
  endDate: string,
  playerId?: string,
  timezone?: string
): Promise<{
  total_uniq_sessions: number;
  total_uniq_device: number;
  total: number;
}> {
  return rateLimitedRequest(
    "/events/total_by_company",
    apiToken,
    {
      events: ["started", "finished", "viewed"],
      start_date: startDate,
      end_date: endDate,
      ...(playerId && { player_id: playerId }),
      ...(timezone && { timezone }),
    }
  );
}

/**
 * Fetch events by day for a specific player.
 */
export async function fetchVTurbEventsByDay(
  apiToken: string,
  playerId: string,
  events: string[],
  startDate: string,
  endDate: string,
  timezone?: string
): Promise<{
  events_by_day: Array<{
    day: string;
    event_name: string;
    total: number;
    total_uniq_device: number;
    total_uniq_session: number;
  }>;
}> {
  return rateLimitedRequest(
    "/events/total_by_company_day",
    apiToken,
    {
      player_id: playerId,
      events,
      start_date: startDate,
      end_date: endDate,
      ...(timezone && { timezone }),
    }
  );
}
