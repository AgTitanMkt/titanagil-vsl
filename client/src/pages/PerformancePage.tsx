import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Legend, LineChart, Line,
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium text-foreground mb-2">{formatDate(label)}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {entry.name.includes("Play") || entry.name.includes("Conv") || entry.name.includes("Click")
              ? new Intl.NumberFormat("en-US").format(entry.value)
              : formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PerformancePage() {
  const [period, setPeriod] = useState("30D");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  const stableInput = useMemo(() => ({
    period,
    groupName: groupFilter !== "all" ? groupFilter : undefined,
  }), [period, groupFilter]);

  const { data, isLoading } = trpc.dashboard.timeSeries.useQuery(stableInput);
  const { data: groups } = trpc.vsls.groups.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Evolução temporal das métricas de performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[160px] bg-card">
              <SelectValue placeholder="Grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Grupos</SelectItem>
              {groups?.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-[400px] w-full rounded-lg" />
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
      ) : data && data.length > 0 ? (
        <Tabs defaultValue="financial" className="space-y-4">
          <TabsList className="bg-card">
            <TabsTrigger value="financial">Financeiro</TabsTrigger>
            <TabsTrigger value="engagement">Engajamento</TabsTrigger>
            <TabsTrigger value="combined">Combinado</TabsTrigger>
          </TabsList>

          <TabsContent value="financial" className="space-y-4">
            {/* Revenue / Cost / Profit Area Chart */}
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Revenue, Cost e Profit por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.7 0.18 250)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="oklch(0.7 0.18 250)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.72 0.2 160)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="oklch(0.72 0.2 160)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 260)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} stroke="oklch(0.5 0.01 260)" fontSize={11} />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="oklch(0.5 0.01 260)" fontSize={11} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="oklch(0.7 0.18 250)" fill="url(#gradRevenue)" strokeWidth={2} />
                      <Area type="monotone" dataKey="cost" name="Cost" stroke="oklch(0.65 0.22 25)" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                      <Area type="monotone" dataKey="profit" name="Profit" stroke="oklch(0.72 0.2 160)" fill="url(#gradProfit)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-4">
            {/* Plays / Conversions Bar Chart */}
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Plays e Conversões por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 260)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} stroke="oklch(0.5 0.01 260)" fontSize={11} />
                      <YAxis stroke="oklch(0.5 0.01 260)" fontSize={11} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="totalPlays" name="Plays" fill="oklch(0.7 0.18 250)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="conversions" name="Conversões" fill="oklch(0.72 0.2 160)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Clicks Chart */}
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Clicks por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 260)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} stroke="oklch(0.5 0.01 260)" fontSize={11} />
                      <YAxis stroke="oklch(0.5 0.01 260)" fontSize={11} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="clicks" name="Clicks" stroke="oklch(0.75 0.15 80)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="combined" className="space-y-4">
            <Card className="bg-card border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Revenue vs Plays</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.01 260)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} stroke="oklch(0.5 0.01 260)" fontSize={11} />
                      <YAxis yAxisId="left" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="oklch(0.5 0.01 260)" fontSize={11} />
                      <YAxis yAxisId="right" orientation="right" stroke="oklch(0.5 0.01 260)" fontSize={11} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="oklch(0.7 0.18 250)" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="totalPlays" name="Plays" stroke="oklch(0.72 0.2 160)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="bg-card border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhum dado de performance disponível para o período selecionado.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
