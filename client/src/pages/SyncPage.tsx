import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

const SYNC_RANGES = [
  { value: "1", label: "Hoje" },
  { value: "3", label: "Últimos 3 dias" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "60", label: "Últimos 60 dias" },
];

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "success":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Sucesso</Badge>;
    case "error":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
    case "running":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Executando</Badge>;
    default:
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
  }
}

export default function SyncPage() {
  const [syncRange, setSyncRange] = useState("7");
  const [syncSource, setSyncSource] = useState<"all" | "redtrack" | "vturb">("all");

  const { data: syncLogs, isLoading, refetch } = trpc.sync.status.useQuery();

  const syncMutation = trpc.sync.trigger.useMutation({
    onSuccess: (result) => {
      toast.success("Sincronização concluída", {
        description: `Dados sincronizados com sucesso.`,
      });
      refetch();
    },
    onError: (error) => {
      toast.error("Erro na sincronização", {
        description: error.message,
      });
      refetch();
    },
  });

  const handleSync = () => {
    const now = new Date();
    const days = parseInt(syncRange);
    const dateFrom = format(subDays(now, days), "yyyy-MM-dd");
    const dateTo = format(now, "yyyy-MM-dd");

    syncMutation.mutate({
      dateFrom,
      dateTo,
      source: syncSource,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sincronização</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie a sincronização de dados das APIs externas
        </p>
      </div>

      {/* Sync Controls */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sincronizar Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Período</label>
              <Select value={syncRange} onValueChange={setSyncRange}>
                <SelectTrigger className="w-[200px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_RANGES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fonte</label>
              <Select value={syncSource} onValueChange={(v) => setSyncSource(v as any)}>
                <SelectTrigger className="w-[200px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas (RedTrack + VTurb)</SelectItem>
                  <SelectItem value="redtrack">Apenas RedTrack</SelectItem>
                  <SelectItem value="vturb">Apenas VTurb</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="min-w-[140px]"
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {syncMutation.isPending ? "Sincronizando..." : "Sincronizar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            A sincronização busca dados das APIs do RedTrack e VTurb, respeitando os rate limits configurados.
            Certifique-se de que as API keys estão configuradas na página de Settings.
          </p>
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Histórico de Sincronização</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : syncLogs && syncLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fonte</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Registros</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="py-2.5 px-2">
                        <Badge variant="outline" className="text-xs">
                          {log.source.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 text-foreground">{log.syncType}</td>
                      <td className="py-2.5 px-2"><StatusBadge status={log.status} /></td>
                      <td className="text-right py-2.5 px-2 text-foreground">{log.recordsProcessed}</td>
                      <td className="text-right py-2.5 px-2 text-muted-foreground text-xs">
                        {log.lastSync ? new Date(log.lastSync).toLocaleString("pt-BR") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma sincronização realizada ainda.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
