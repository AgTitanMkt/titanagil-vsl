import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
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

const COLUMNS = [
  { key: "name", label: "VSL", align: "left" as const },
  { key: "revenue", label: "Revenue", align: "right" as const, format: "currency" as const },
  { key: "cost", label: "Cost", align: "right" as const, format: "currency" as const },
  { key: "profit", label: "Profit", align: "right" as const, format: "currency" as const },
  { key: "roi", label: "ROI", align: "right" as const, format: "percent" as const },
  { key: "conversions", label: "Conv.", align: "right" as const, format: "number" as const },
  { key: "epc", label: "EPC", align: "right" as const, format: "currency" as const },
  { key: "totalPlays", label: "Plays", align: "right" as const, format: "number" as const },
  { key: "watchRate", label: "Watch Rate", align: "right" as const, format: "percent" as const },
  { key: "conversionRate", label: "CR", align: "right" as const, format: "percent" as const },
];

function formatValue(value: number, format: string): string {
  if (format === "currency") {
    if (value === 0) return "";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
  }
  if (format === "percent") return `${value.toFixed(1)}%`;
  if (format === "number") {
    if (value === 0) return "";
    return new Intl.NumberFormat("en-US").format(value);
  }
  return String(value);
}

function getRoiColor(roi: number): string {
  if (roi < 0) return "text-red-400";
  if (roi <= 10) return "text-yellow-400";
  return "text-emerald-400";
}

export default function RankingPage() {
  const [period, setPeriod] = useState("30D");
  const [sortBy, setSortBy] = useState("cost");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [, setLocation] = useLocation();

  const stableInput = useMemo(() => ({
    period,
    sortBy,
    sortDir,
    page,
    pageSize: 20,
    groupName: groupFilter !== "all" ? groupFilter : undefined,
  }), [period, sortBy, sortDir, page, groupFilter]);

  const { data, isLoading } = trpc.dashboard.ranking.useQuery(stableInput);
  const { data: groups } = trpc.vsls.groups.useQuery();

  const handleSort = useCallback((key: string) => {
    if (sortBy === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
    setPage(1);
  }, [sortBy]);

  const handleExportCsv = useCallback(() => {
    if (!data?.items) return;
    const headers = COLUMNS.map(c => c.label).join(",");
    const rows = data.items.map(item =>
      COLUMNS.map(col => {
        const val = (item as any)[col.key];
        if (col.key === "name") return `"${val}"`;
        return val;
      }).join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vsl-ranking-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, period]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ranking de VSLs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comparação detalhada de todas as VSLs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v); setPage(1); }}>
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
          <Select value={period} onValueChange={(v) => { setPeriod(v); setPage(1); }}>
            <SelectTrigger className="w-[140px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!data?.items?.length}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      {COLUMNS.map(col => (
                        <th
                          key={col.key}
                          className={`py-3 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors ${col.align === "right" ? "text-right" : "text-left"}`}
                          onClick={() => handleSort(col.key)}
                        >
                          <div className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : ""}`}>
                            <span>{col.label}</span>
                            {sortBy === col.key ? (
                              sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-30" />
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border/30 hover:bg-accent/30 cursor-pointer transition-colors"
                        onClick={() => setLocation(`/vsl/${item.id}`)}
                      >
                        {COLUMNS.map(col => {
                          const val = (item as any)[col.key];
                          if (col.key === "name") {
                            return (
                              <td key={col.key} className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground">{val}</span>
                                  {item.groupName && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      {item.groupName}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                            );
                          }
                          const isRoi = col.key === "roi";
                          return (
                            <td
                              key={col.key}
                              className={`text-right py-2.5 px-3 ${isRoi ? `font-medium ${getRoiColor(val)}` : "text-foreground"}`}
                            >
                              {formatValue(val, col.format || "number") || "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    {data.total} VSLs encontradas
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhuma VSL encontrada para o período selecionado.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
