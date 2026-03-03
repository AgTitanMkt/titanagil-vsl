import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  MousePointerClick, Eye, Play, BarChart3, Target, Percent,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend, BarChart, Bar, Funnel, FunnelChart, LabelList, Cell,
} from "recharts";

const PERIODS = [
  { value: "3D", label: "3 Dias" },
  { value: "7D", label: "7 Dias" },
  { value: "14D", label: "14 Dias" },
  { value: "30D", label: "30 Dias" },
  { value: "45D", label: "45 Dias" },
  { value: "60D", label: "60 Dias" },
  { value: "TOTAL", label: "Total" },
];

function formatCurrency(value: number): string {
  if (value === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number): string {
  if (value === 0) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatTime(seconds: number): string {
  if (seconds === 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function getRoiColor(roi: number): string {
  if (roi < 0) return "text-red-400";
  if (roi <= 10) return "text-yellow-400";
  return "text-emerald-400";
}

function getRoiBgColor(roi: number): string {
  if (roi < 0) return "bg-red-500/10 border-red-500/20";
  if (roi <= 10) return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-emerald-500/10 border-emerald-500/20";
}

// ===== Metric Card Component =====
function MetricCard({ label, value, icon: Icon, comparison, format = "currency", highlight, className = "" }: {
  label: string;
  value: number;
  icon?: any;
  comparison?: number | null;
  format?: "currency" | "number" | "percent" | "time";
  highlight?: "roi" | "profit";
  className?: string;
}) {
  const formatted = format === "currency" ? formatCurrency(value)
    : format === "percent" ? formatPercent(value)
    : format === "time" ? formatTime(value)
    : formatNumber(value);

  let compDiff: number | null = null;
  if (comparison !== undefined && comparison !== null && comparison !== 0) {
    compDiff = ((value - comparison) / Math.abs(comparison)) * 100;
  }

  const textColor = highlight === "roi" ? getRoiColor(value)
    : highlight === "profit" ? (value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-foreground")
    : "text-foreground";

  return (
    <div className={`flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/30 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />}
      </div>
      <span className={`text-lg font-semibold ${textColor}`}>{formatted}</span>
      {compDiff !== null && Math.abs(compDiff) > 0.1 && (
        <div className={`flex items-center gap-0.5 text-xs ${compDiff > 0 ? "text-emerald-400" : "text-red-400"}`}>
          {compDiff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{compDiff > 0 ? "+" : ""}{compDiff.toFixed(1)}% vs grupo</span>
        </div>
      )}
    </div>
  );
}

// ===== Metric Row (for tables) =====
function MetricRow({ label, value, comparison, format = "currency", highlight }: {
  label: string;
  value: number;
  comparison?: number | null;
  format?: "currency" | "number" | "percent" | "time";
  highlight?: "roi" | "profit";
}) {
  const formatted = format === "currency" ? formatCurrency(value)
    : format === "percent" ? formatPercent(value)
    : format === "time" ? formatTime(value)
    : formatNumber(value);

  let compDiff: number | null = null;
  if (comparison !== undefined && comparison !== null && comparison !== 0) {
    compDiff = ((value - comparison) / Math.abs(comparison)) * 100;
  }

  const textColor = highlight === "roi" ? getRoiColor(value)
    : highlight === "profit" ? (value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-foreground")
    : "text-foreground";

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${textColor}`}>{formatted}</span>
        {compDiff !== null && Math.abs(compDiff) > 0.1 && (
          <div className={`flex items-center gap-0.5 text-xs ${compDiff > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {compDiff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{compDiff > 0 ? "+" : ""}{compDiff.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

function VslSelector() {
  const { data: vslList } = trpc.vsls.list.useQuery();
  const [, setLocation] = useLocation();

  return (
    <Card className="bg-card border-border/50">
      <CardContent className="py-12 text-center">
        <h2 className="text-lg font-semibold mb-4">Selecione uma VSL</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Escolha uma VSL para ver análise detalhada
        </p>
        {vslList && vslList.length > 0 ? (
          <div className="max-w-xs mx-auto">
            <Select onValueChange={(v) => setLocation(`/vsl/${v}`)}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Selecionar VSL..." />
              </SelectTrigger>
              <SelectContent>
                {vslList.map(v => (
                  <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-muted-foreground">Nenhuma VSL disponível. Sincronize os dados primeiro.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium text-foreground mb-2">{typeof label === "number" ? formatTime(label) : formatDate(label)}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {entry.name.includes("%") || entry.name.includes("Rate") || entry.name.includes("Taxa")
              ? `${Number(entry.value).toFixed(1)}%`
              : entry.name.includes("$") || entry.name.includes("Revenue") || entry.name.includes("Cost") || entry.name.includes("Profit")
                ? formatCurrency(entry.value)
                : formatNumber(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

const FUNNEL_COLORS = [
  "oklch(0.65 0.18 250)", // impressions - blue
  "oklch(0.68 0.16 220)", // lp views - lighter blue
  "oklch(0.70 0.15 190)", // lp clicks - teal
  "oklch(0.72 0.18 100)", // initiate checkouts - yellow-green
  "oklch(0.75 0.20 80)",  // purchases - gold
];

export default function VslDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState("30D");

  const vslId = params.id ? parseInt(params.id) : null;

  const stableInput = useMemo(() => ({
    id: vslId!,
    period,
  }), [vslId, period]);

  const { data, isLoading } = trpc.vslDetail.get.useQuery(stableInput, {
    enabled: vslId !== null,
  });

  if (!vslId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Análise de VSL</h1>
        <VslSelector />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[200px]" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/ranking")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Card className="bg-card border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            VSL não encontrada.
          </CardContent>
        </Card>
      </div>
    );
  }

  const m = data.metrics;
  const ga = data.groupAverage;

  // Build funnel data for visualization
  const funnelData = [
    { name: "Impressões", value: m.impressions, fill: FUNNEL_COLORS[0] },
    { name: "LP Views", value: m.lpViews, fill: FUNNEL_COLORS[1] },
    { name: "LP Clicks", value: m.lpClicks, fill: FUNNEL_COLORS[2] },
    { name: "Init. Checkout", value: m.initiateCheckouts, fill: FUNNEL_COLORS[3] },
    { name: "Compras", value: m.purchases, fill: FUNNEL_COLORS[4] },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/ranking")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
              {data.groupName && <Badge variant="secondary">{data.groupName}</Badge>}
            </div>
            {data.product && (
              <p className="text-sm text-muted-foreground mt-0.5">Produto: {data.product}</p>
            )}
          </div>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ===== TOP KPI CARDS ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`rounded-xl border p-4 ${getRoiBgColor(m.roi)}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">ROI</span>
            <Percent className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <span className={`text-2xl font-bold ${getRoiColor(m.roi)}`}>{formatPercent(m.roi)}</span>
        </div>
        <div className="rounded-xl border border-border/30 bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Faturamento</span>
            <DollarSign className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <span className="text-2xl font-bold text-foreground">{formatCurrency(m.revenue)}</span>
        </div>
        <div className="rounded-xl border border-border/30 bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Profit</span>
            <TrendingUp className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <span className={`text-2xl font-bold ${m.profit > 0 ? "text-emerald-400" : m.profit < 0 ? "text-red-400" : "text-foreground"}`}>
            {formatCurrency(m.profit)}
          </span>
        </div>
        <div className="rounded-xl border border-border/30 bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Vendas</span>
            <ShoppingCart className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <span className="text-2xl font-bold text-foreground">{formatNumber(m.purchases || m.conversions)}</span>
        </div>
      </div>

      {/* ===== DETAILED METRICS SECTIONS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* 1. Financeiro */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <MetricRow label="Faturamento" value={m.revenue} comparison={ga?.revenue} />
            <MetricRow label="Custo" value={m.cost} comparison={ga?.cost} />
            <MetricRow label="Profit" value={m.profit} comparison={ga?.profit} highlight="profit" />
            <MetricRow label="ROI" value={m.roi} comparison={ga?.roi} format="percent" highlight="roi" />
            <MetricRow label="EPC" value={m.epc} comparison={ga?.epc} />
          </CardContent>
        </Card>

        {/* 2. Vendas & Custos */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Vendas & Custos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <MetricRow label="Vendas (Purchases)" value={m.purchases} comparison={ga?.purchases} format="number" />
            <MetricRow label="Conversões" value={m.conversions} comparison={ga?.conversions} format="number" />
            <MetricRow label="CPA" value={m.cpa} comparison={ga?.cpa} />
            <MetricRow label="CPC" value={m.cpc} comparison={ga?.cpc} />
            <MetricRow label="CPM (CPI)" value={m.cpi} comparison={ga?.cpi} />
          </CardContent>
        </Card>

        {/* 3. Tráfego */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MousePointerClick className="h-4 w-4" /> Tráfego
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <MetricRow label="Impressões" value={m.impressions} comparison={ga?.impressions} format="number" />
            <MetricRow label="Clicks" value={m.clicks} comparison={ga?.clicks} format="number" />
            <MetricRow label="LP Views" value={m.lpViews} comparison={ga?.lpViews} format="number" />
            <MetricRow label="LP Clicks" value={m.lpClicks} comparison={ga?.lpClicks} format="number" />
            <MetricRow label="LP CTR" value={m.lpCtr} comparison={ga?.lpCtr} format="percent" />
          </CardContent>
        </Card>

        {/* 4. Taxas de Funil */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" /> Taxas de Funil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <MetricRow label="Hook Rate" value={m.hookRate} comparison={ga?.hookRate} format="percent" />
            <MetricRow label="Body Rate" value={m.bodyRate} comparison={ga?.bodyRate} format="percent" />
            <MetricRow label="Checkout Rate" value={m.checkoutRate} comparison={ga?.checkoutRate} format="percent" />
            <MetricRow label="Taxa Conversão" value={m.conversionRate} comparison={ga?.conversionRate} format="percent" />
            <MetricRow label="Funil Geral (LP→Compra)" value={m.overallFunnelRate} comparison={ga?.overallFunnelRate} format="percent" />
          </CardContent>
        </Card>

        {/* 5. Checkout */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" /> Checkout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <MetricRow label="Initiate Checkouts" value={m.initiateCheckouts} comparison={ga?.initiateCheckouts} format="number" />
            <MetricRow label="Purchases" value={m.purchases} comparison={ga?.purchases} format="number" />
            <MetricRow label="Checkout Rate" value={m.checkoutRate} comparison={ga?.checkoutRate} format="percent" />
          </CardContent>
        </Card>

        {/* 6. Vídeo */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Play className="h-4 w-4" /> Métricas de Vídeo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <MetricRow label="Total Plays" value={m.totalPlays} comparison={ga?.totalPlays} format="number" />
            <MetricRow label="Unique Plays" value={m.uniquePlays} comparison={ga?.uniquePlays} format="number" />
            <MetricRow label="Watch Rate" value={m.watchRate} comparison={ga?.watchRate} format="percent" />
            <MetricRow label="Tempo Médio" value={m.avgWatchTime} comparison={ga?.avgWatchTime} format="time" />
            <MetricRow label="Hook Rate" value={m.hookRate} comparison={ga?.hookRate} format="percent" />
            <MetricRow label="Body Rate" value={m.bodyRate} comparison={ga?.bodyRate} format="percent" />
          </CardContent>
        </Card>
      </div>

      {ga && (
        <p className="text-xs text-muted-foreground">
          As setas de comparação indicam diferença em relação à média do grupo "{data.groupName}".
        </p>
      )}

      {/* ===== FUNNEL VISUALIZATION ===== */}
      {funnelData.length > 2 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Funil de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 40, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 260)" horizontal={false} />
                  <XAxis type="number" stroke="oklch(0.5 0.01 260)" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="oklch(0.5 0.01 260)" fontSize={11} width={90} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
                          <p className="font-medium text-foreground">{d.name}</p>
                          <p className="text-muted-foreground">{formatNumber(d.value)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Funnel step conversion rates */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {funnelData.slice(1).map((step, i) => {
                const prev = funnelData[i];
                const rate = prev.value > 0 ? ((step.value / prev.value) * 100) : 0;
                return (
                  <div key={step.name} className="text-center p-2 rounded-lg bg-muted/20 border border-border/20">
                    <p className="text-[10px] text-muted-foreground truncate">{prev.name} → {step.name}</p>
                    <p className="text-sm font-semibold text-foreground">{formatPercent(rate)}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== RETENTION CURVE ===== */}
      {data.retentionCurve && data.retentionCurve.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Curva de Retenção do Vídeo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.retentionCurve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRetention" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.7 0.18 250)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="oklch(0.7 0.18 250)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 260)" />
                  <XAxis
                    dataKey="second"
                    tickFormatter={formatTime}
                    stroke="oklch(0.5 0.01 260)"
                    fontSize={11}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                    stroke="oklch(0.5 0.01 260)"
                    fontSize={11}
                    domain={[0, 100]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="percentage"
                    name="Retenção %"
                    stroke="oklch(0.7 0.18 250)"
                    fill="url(#gradRetention)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== TIME SERIES ===== */}
      {data.timeSeries && data.timeSeries.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Performance ao Longo do Tempo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 260)" />
                  <XAxis dataKey="date" tickFormatter={formatDate} stroke="oklch(0.5 0.01 260)" fontSize={11} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="oklch(0.5 0.01 260)" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" stroke="oklch(0.5 0.01 260)" fontSize={11} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="oklch(0.7 0.18 250)" strokeWidth={2} dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="profit" name="Profit" stroke="oklch(0.72 0.2 160)" strokeWidth={2} dot={false} />
                  <Line yAxisId="left" type="monotone" dataKey="cost" name="Cost" stroke="oklch(0.7 0.15 30)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Line yAxisId="right" type="monotone" dataKey="conversions" name="Conversões" stroke="oklch(0.75 0.15 80)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
