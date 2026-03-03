import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, TrendingUp, TrendingDown, MousePointerClick,
  Eye, ShoppingCart, BarChart3, Percent,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";

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
  if (value === 0) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
}

function formatNumber(value: number): string {
  if (value === 0) return "";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getRoiColor(roi: number): string {
  if (roi < 0) return "text-red-400";
  if (roi <= 10) return "text-yellow-400";
  return "text-emerald-400";
}

function ChangeIndicator({ value }: { value: number }) {
  if (Math.abs(value) < 0.01) return null;
  const isPositive = value > 0;
  return (
    <div className={`flex items-center gap-1 text-xs ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      <span>{isPositive ? "+" : ""}{value.toFixed(1)}%</span>
    </div>
  );
}

function MetricCard({
  title, value, change, icon: Icon, format = "currency",
}: {
  title: string;
  value: number;
  change?: number;
  icon: React.ElementType;
  format?: "currency" | "number" | "percent";
}) {
  const formatted = format === "currency" ? formatCurrency(value)
    : format === "percent" ? formatPercent(value)
    : formatNumber(value);

  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="flex items-end justify-between">
          <span className={`text-xl font-bold ${format === "percent" && title.includes("ROI") ? getRoiColor(value) : "text-foreground"}`}>
            {formatted || "—"}
          </span>
          {change !== undefined && <ChangeIndicator value={change} />}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="bg-card border-border/50">
          <CardContent className="p-4">
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-7 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Home() {
  const [period, setPeriod] = useState("30D");
  const [, setLocation] = useLocation();

  const stablePeriod = useMemo(() => period, [period]);

  const { data: overview, isLoading: overviewLoading } = trpc.dashboard.overview.useQuery({
    period: stablePeriod,
  });

  const { data: ranking, isLoading: rankingLoading } = trpc.dashboard.ranking.useQuery({
    period: stablePeriod,
    sortBy: "cost",
    sortDir: "desc",
    pageSize: 10,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral de performance das suas VSLs
          </p>
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

      {/* Overview Cards */}
      {overviewLoading ? (
        <OverviewSkeleton />
      ) : overview ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard title="Revenue" value={overview.current.totalRevenue} change={overview.changes.revenue} icon={DollarSign} />
          <MetricCard title="Cost" value={overview.current.totalCost} change={overview.changes.cost} icon={DollarSign} />
          <MetricCard title="Profit" value={overview.current.totalProfit} change={overview.changes.profit} icon={TrendingUp} />
          <MetricCard title="ROI" value={overview.current.avgRoi} change={overview.changes.roi} icon={Percent} format="percent" />
          <MetricCard title="EPC" value={overview.current.avgEpc} change={overview.changes.epc} icon={MousePointerClick} />
          <MetricCard title="Conversões" value={overview.current.totalConversions} icon={ShoppingCart} format="number" />
          <MetricCard title="Plays" value={overview.current.totalPlays} change={overview.changes.plays} icon={Eye} format="number" />
          <MetricCard title="Watch Rate" value={overview.current.avgWatchRate} change={overview.changes.watchRate} icon={BarChart3} format="percent" />
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhum dado disponível. Configure as APIs e sincronize os dados.</p>
        </div>
      )}

      {/* Top VSLs */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Top VSLs por Investimento</CardTitle>
            <button
              onClick={() => setLocation("/ranking")}
              className="text-xs text-primary hover:underline"
            >
              Ver todas
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {rankingLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : ranking && ranking.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">VSL</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Revenue</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Profit</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">ROI</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Conv.</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">EPC</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border/30 hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => setLocation(`/vsl/${item.id}`)}
                    >
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{item.name}</span>
                          {item.groupName && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {item.groupName}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-2 text-foreground">{formatCurrency(item.revenue) || "—"}</td>
                      <td className="text-right py-2.5 px-2 text-foreground">{formatCurrency(item.cost) || "—"}</td>
                      <td className="text-right py-2.5 px-2 text-foreground">{formatCurrency(item.profit) || "—"}</td>
                      <td className={`text-right py-2.5 px-2 font-medium ${getRoiColor(item.roi)}`}>
                        {formatPercent(item.roi)}
                      </td>
                      <td className="text-right py-2.5 px-2 text-foreground">{formatNumber(item.conversions) || "—"}</td>
                      <td className="text-right py-2.5 px-2 text-foreground">{formatCurrency(item.epc) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma VSL encontrada. Sincronize os dados para começar.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
