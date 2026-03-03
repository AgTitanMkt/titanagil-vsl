import axios from "axios";

const REDTRACK_BASE_URL = "https://api.redtrack.io";
const RATE_LIMIT_DELAY = 3100; // ~20 RPM = 1 request per 3 seconds

let lastRequestTime = 0;

async function rateLimitedRequest<T>(url: string, params: Record<string, string>): Promise<T> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  const response = await axios.get<T>(url, { params, timeout: 30000 });
  return response.data;
}

export interface RedTrackReportRow {
  landing?: string;
  landing_id?: string;
  campaign?: string;
  campaign_id?: string;
  source?: string;
  source_id?: string;
  date?: string;
  revenue?: number;
  cost?: number;
  profit?: number;
  clicks?: number;
  lp_clicks?: number;
  lp_views?: number;
  impressions?: number;
  conversions?: number;
  total_conversions?: number;
  sales?: number;
  purchases?: number;
  cr?: number;
  epc?: number;
  roi?: number;
  [key: string]: unknown;
}

export interface RedTrackLanding {
  id: string;
  name: string;
  url?: string;
  [key: string]: unknown;
}

/**
 * Fetch report data from RedTrack grouped by landing (VSL).
 * Uses the GET /report endpoint with group=landing.
 */
export async function fetchRedTrackLandingReport(
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  options?: {
    campaignId?: string;
    sourceId?: string;
    landingId?: string;
  }
): Promise<RedTrackReportRow[]> {
  const params: Record<string, string> = {
    api_key: apiKey,
    group: "landing",
    date_from: dateFrom,
    date_to: dateTo,
    tracks_view: "true",
  };

  if (options?.campaignId) params.campaign_id = options.campaignId;
  if (options?.sourceId) params.source_id = options.sourceId;
  if (options?.landingId) params.landing_id = options.landingId;

  return rateLimitedRequest<RedTrackReportRow[]>(`${REDTRACK_BASE_URL}/report`, params);
}

/**
 * Fetch report data grouped by landing AND date for time series.
 */
export async function fetchRedTrackLandingReportByDay(
  apiKey: string,
  dateFrom: string,
  dateTo: string,
  options?: {
    campaignId?: string;
    sourceId?: string;
    landingId?: string;
  }
): Promise<RedTrackReportRow[]> {
  const params: Record<string, string> = {
    api_key: apiKey,
    group: "landing,date",
    date_from: dateFrom,
    date_to: dateTo,
    tracks_view: "true",
  };

  if (options?.campaignId) params.campaign_id = options.campaignId;
  if (options?.sourceId) params.source_id = options.sourceId;
  if (options?.landingId) params.landing_id = options.landingId;

  return rateLimitedRequest<RedTrackReportRow[]>(`${REDTRACK_BASE_URL}/report`, params);
}

/**
 * Fetch list of landings from RedTrack.
 */
export async function fetchRedTrackLandings(apiKey: string): Promise<RedTrackLanding[]> {
  return rateLimitedRequest<RedTrackLanding[]>(`${REDTRACK_BASE_URL}/landings`, {
    api_key: apiKey,
  });
}

/**
 * Fetch list of campaigns from RedTrack.
 */
export async function fetchRedTrackCampaigns(apiKey: string): Promise<Array<{ id: string; name: string }>> {
  return rateLimitedRequest<Array<{ id: string; name: string }>>(`${REDTRACK_BASE_URL}/campaigns`, {
    api_key: apiKey,
  });
}

/**
 * Fetch list of sources from RedTrack.
 */
export async function fetchRedTrackSources(apiKey: string): Promise<Array<{ id: string; name: string }>> {
  return rateLimitedRequest<Array<{ id: string; name: string }>>(`${REDTRACK_BASE_URL}/sources`, {
    api_key: apiKey,
  });
}
