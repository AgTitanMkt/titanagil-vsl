/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

/** Shared types used by both client and server */

export interface VslSummary {
  id: number;
  name: string;
  groupName: string | null;
  product: string | null;
  revenue: number;
  cost: number;
  profit: number;
  clicks: number;
  conversions: number;
  totalPlays: number;
  uniquePlays: number;
  watchRate: number;
  avgWatchTime: number;
  roi: number;
  epc: number;
  conversionRate: number;
}

export interface OverviewMetrics {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalClicks: number;
  totalConversions: number;
  totalPlays: number;
  totalUniquePlays: number;
  avgRoi: number;
  avgEpc: number;
  avgConversionRate: number;
  avgWatchRate: number;
}

export interface PeriodComparison {
  current: OverviewMetrics;
  previous: OverviewMetrics;
  changes: {
    revenue: number;
    cost: number;
    profit: number;
    roi: number;
    epc: number;
    conversionRate: number;
    plays: number;
    watchRate: number;
  };
}

export interface TimeSeriesPoint {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  clicks: number;
  conversions: number;
  totalPlays: number;
  uniquePlays: number;
}

export interface RetentionPoint {
  second: number;
  viewers: number;
  percentage: number;
}

export interface VslDetail {
  id: number;
  name: string;
  groupName: string | null;
  product: string | null;
  vturbPlayerId: string | null;
  redtrackLandingId: string | null;
  metrics: VslSummary;
  retentionCurve: RetentionPoint[];
  timeSeries: TimeSeriesPoint[];
  groupAverage: VslSummary | null;
}

export interface SyncStatus {
  source: string;
  syncType: string;
  status: string;
  lastSync: string | null;
  recordsProcessed: number;
  errorMessage: string | null;
}

export type PeriodPreset = '3D' | '7D' | '14D' | '30D' | '45D' | '60D' | 'TOTAL';

export interface DateRange {
  from: string;
  to: string;
}

export type SortField = 'name' | 'revenue' | 'cost' | 'profit' | 'roi' | 'epc' | 'conversionRate' | 'totalPlays' | 'watchRate' | 'conversions';
export type SortDirection = 'asc' | 'desc';
