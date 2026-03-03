import { describe, expect, it } from "vitest";

// Test the pure logic functions extracted from routers

function calcPeriodDates(period: string): { from: string; to: string; prevFrom: string; prevTo: string } {
  const now = new Date("2026-03-03T12:00:00Z");
  const to = now.toISOString().slice(0, 10);
  let days = 30;
  if (period === "3D") days = 3;
  else if (period === "7D") days = 7;
  else if (period === "14D") days = 14;
  else if (period === "30D") days = 30;
  else if (period === "45D") days = 45;
  else if (period === "60D") days = 60;
  else if (period === "TOTAL") days = 365;

  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - days);
  const from = fromDate.toISOString().slice(0, 10);

  const prevToDate = new Date(now);
  prevToDate.setDate(prevToDate.getDate() - days - 1);
  const prevTo = prevToDate.toISOString().slice(0, 10);

  const prevFromDate = new Date(now);
  prevFromDate.setDate(prevFromDate.getDate() - days * 2);
  const prevFrom = prevFromDate.toISOString().slice(0, 10);

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

  const roi = cost > 0 ? ((profit / cost) * 100) : 0;
  const epc = clicks > 0 ? (revenue / clicks) : 0;
  const conversionRate = clicks > 0 ? ((conversions / clicks) * 100) : 0;
  const cpc = clicks > 0 ? (cost / clicks) : 0;
  const cpi = impressions > 0 ? (cost / impressions) * 1000 : 0;
  const cpa = purchases > 0 ? (cost / purchases) : 0;
  const lpCtr = lpViews > 0 ? ((lpClicks / lpViews) * 100) : 0;
  const hookRate = totalPlays > 0 ? ((uniquePlays / totalPlays) * 100) : 0;
  const bodyRate = watchRate;
  const checkoutRate = initiateCheckouts > 0 ? ((purchases / initiateCheckouts) * 100) : 0;
  const overallFunnelRate = lpViews > 0 ? ((purchases / lpViews) * 100) : 0;

  return {
    id: vsl.id, name: vsl.name, groupName: vsl.groupName, product: vsl.product,
    revenue, cost, profit, roi, epc,
    clicks, conversions, impressions, purchases,
    lpViews, lpClicks, initiateCheckouts,
    cpc, cpi, cpa,
    totalPlays, uniquePlays, watchRate, avgWatchTime,
    conversionRate, lpCtr, hookRate, bodyRate,
    checkoutRate, overallFunnelRate,
  };
}

function pctChange(curr: number, prev: number): number {
  return prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : (curr > 0 ? 100 : 0);
}

const vsl = { id: 1, name: "VSL1_US", groupName: "VSL1", product: "Liporise" };

const fullAgg: AggRow = {
  revenue: "5000", cost: "2000", profit: "3000",
  clicks: 500, conversions: 50,
  impressions: 100000, lpViews: 8000, lpClicks: 2000,
  initiateCheckouts: 200, purchases: 50,
  totalPlays: 6000, uniquePlays: 4500,
  avgWatchRate: "65.5", avgWatchTime: 180,
};

describe("calcPeriodDates", () => {
  it("returns correct dates for 7D period", () => {
    const result = calcPeriodDates("7D");
    expect(result.from).toBe("2026-02-24");
    expect(result.to).toBe("2026-03-03");
  });

  it("returns correct dates for 30D period", () => {
    const result = calcPeriodDates("30D");
    expect(result.from).toBe("2026-02-01");
    expect(result.to).toBe("2026-03-03");
  });

  it("returns correct dates for 3D period", () => {
    const result = calcPeriodDates("3D");
    expect(result.from).toBe("2026-02-28");
    expect(result.to).toBe("2026-03-03");
  });

  it("returns previous period dates", () => {
    const result = calcPeriodDates("7D");
    expect(result.prevTo).toBe("2026-02-23");
    expect(result.prevFrom).toBe("2026-02-17");
  });

  it("TOTAL period uses 365 days", () => {
    const result = calcPeriodDates("TOTAL");
    expect(result.from).toBe("2025-03-03");
    expect(result.to).toBe("2026-03-03");
  });
});

describe("buildVslSummary - Financial Metrics", () => {
  it("calculates ROI correctly", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.roi).toBe(150);
  });

  it("calculates EPC correctly", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.epc).toBe(10);
  });

  it("calculates profit correctly", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.profit).toBe(3000);
  });

  it("handles zero cost (ROI = 0)", () => {
    const result = buildVslSummary(vsl, { ...fullAgg, cost: "0", profit: "5000" });
    expect(result.roi).toBe(0);
  });

  it("handles negative profit (negative ROI)", () => {
    const result = buildVslSummary(vsl, { ...fullAgg, revenue: "200", cost: "500", profit: "-300" });
    expect(result.roi).toBe(-60);
    expect(result.profit).toBe(-300);
  });
});

describe("buildVslSummary - Cost Metrics", () => {
  it("calculates CPC correctly", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.cpc).toBe(4);
  });

  it("calculates CPA correctly", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.cpa).toBe(40);
  });

  it("calculates CPM (CPI) correctly", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.cpi).toBe(20);
  });

  it("handles zero clicks (CPC = 0)", () => {
    const result = buildVslSummary(vsl, { ...fullAgg, clicks: 0 });
    expect(result.cpc).toBe(0);
  });

  it("handles zero purchases (CPA = 0)", () => {
    const result = buildVslSummary(vsl, { ...fullAgg, purchases: 0 });
    expect(result.cpa).toBe(0);
  });

  it("handles zero impressions (CPI = 0)", () => {
    const result = buildVslSummary(vsl, { ...fullAgg, impressions: 0 });
    expect(result.cpi).toBe(0);
  });
});

describe("buildVslSummary - Funnel Rates", () => {
  it("calculates LP CTR correctly", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.lpCtr).toBe(25);
  });

  it("calculates Hook Rate correctly", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.hookRate).toBe(75);
  });

  it("calculates Body Rate (= watchRate)", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.bodyRate).toBe(65.5);
  });

  it("calculates Checkout Rate correctly", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.checkoutRate).toBe(25);
  });

  it("calculates Overall Funnel Rate correctly", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.overallFunnelRate).toBe(0.625);
  });

  it("handles zero initiate checkouts (checkoutRate = 0)", () => {
    const result = buildVslSummary(vsl, { ...fullAgg, initiateCheckouts: 0 });
    expect(result.checkoutRate).toBe(0);
  });

  it("handles zero lp views (lpCtr = 0, overallFunnelRate = 0)", () => {
    const result = buildVslSummary(vsl, { ...fullAgg, lpViews: 0 });
    expect(result.lpCtr).toBe(0);
    expect(result.overallFunnelRate).toBe(0);
  });
});

describe("buildVslSummary - Video Metrics", () => {
  it("preserves total and unique plays", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.totalPlays).toBe(6000);
    expect(result.uniquePlays).toBe(4500);
  });

  it("preserves watch rate and avg watch time", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.watchRate).toBe(65.5);
    expect(result.avgWatchTime).toBe(180);
  });
});

describe("buildVslSummary - Edge Cases", () => {
  it("handles empty/null string values", () => {
    const result = buildVslSummary(vsl, {
      revenue: "", cost: "", profit: "",
      clicks: 0, conversions: 0,
      totalPlays: 0, uniquePlays: 0,
      avgWatchRate: "", avgWatchTime: 0,
    });
    expect(result.revenue).toBe(0);
    expect(result.cost).toBe(0);
    expect(result.profit).toBe(0);
    expect(result.roi).toBe(0);
    expect(result.cpc).toBe(0);
    expect(result.cpa).toBe(0);
  });

  it("preserves VSL metadata", () => {
    const result = buildVslSummary(vsl, fullAgg);
    expect(result.id).toBe(1);
    expect(result.name).toBe("VSL1_US");
    expect(result.groupName).toBe("VSL1");
    expect(result.product).toBe("Liporise");
  });

  it("handles undefined optional funnel fields", () => {
    const result = buildVslSummary(vsl, {
      revenue: "1000", cost: "500", profit: "500",
      clicks: 100, conversions: 10,
      totalPlays: 200, uniquePlays: 150,
      avgWatchRate: "65.5", avgWatchTime: 120,
    });
    expect(result.impressions).toBe(0);
    expect(result.lpViews).toBe(0);
    expect(result.purchases).toBe(0);
    expect(result.cpi).toBe(0);
    expect(result.lpCtr).toBe(0);
    expect(result.checkoutRate).toBe(0);
    expect(result.overallFunnelRate).toBe(0);
  });
});

describe("pctChange", () => {
  it("calculates positive change", () => {
    expect(pctChange(150, 100)).toBe(50);
  });

  it("calculates negative change", () => {
    expect(pctChange(50, 100)).toBe(-50);
  });

  it("handles zero previous value with positive current", () => {
    expect(pctChange(100, 0)).toBe(100);
  });

  it("handles zero previous value with zero current", () => {
    expect(pctChange(0, 0)).toBe(0);
  });

  it("handles negative values", () => {
    expect(pctChange(-50, -100)).toBe(50);
  });
});
