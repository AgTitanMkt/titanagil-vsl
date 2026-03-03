import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Loader2, Save, Key, Link2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function ApiKeyForm({
  title,
  description,
  settingKey,
  placeholder,
  testQuery,
}: {
  title: string;
  description: string;
  settingKey: string;
  placeholder: string;
  testQuery?: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const utils = trpc.useUtils();

  const setMutation = trpc.settings.set.useMutation({
    onSuccess: () => {
      toast.success(`${title} salva com sucesso`);
      setValue("");
      utils.settings.getAll.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const handleSave = async () => {
    if (!value.trim()) {
      toast.error("Insira um valor válido");
      return;
    }
    setSaving(true);
    await setMutation.mutateAsync({
      key: settingKey,
      value: value.trim(),
      description,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="bg-background"
        />
        <Button onClick={handleSave} disabled={saving || !value.trim()} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function ConnectionTest({ source }: { source: "redtrack" | "vturb" }) {
  const { data, isLoading, refetch } = source === "redtrack"
    ? trpc.settings.testRedTrack.useQuery(undefined, { enabled: false })
    : trpc.settings.testVTurb.useQuery(undefined, { enabled: false });

  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    await refetch();
    setTesting(false);
  };

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
        {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
        Testar Conexão
      </Button>
      {data && !testing && (
        data.connected ? (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Conectado
            {source === "redtrack" && "landingsCount" in data && ` (${data.landingsCount} landings)`}
          </Badge>
        ) : (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            {data.error || "Falha na conexão"}
          </Badge>
        )
      )}
    </div>
  );
}

function VslMappingSection() {
  const { data: vslList, isLoading } = trpc.vsls.list.useQuery();
  const [newVsl, setNewVsl] = useState({ name: "", vturbPlayerId: "", redtrackLandingId: "" });

  const createMutation = trpc.vsls.create.useMutation({
    onSuccess: () => {
      toast.success("VSL criada com sucesso");
      setNewVsl({ name: "", vturbPlayerId: "", redtrackLandingId: "" });
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const updateMutation = trpc.vsls.updateMapping.useMutation({
    onSuccess: () => {
      toast.success("Mapeamento atualizado");
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground mb-1">VSLs Cadastradas</h3>
        <p className="text-xs text-muted-foreground">
          Gerencie o mapeamento entre VSLs, players do VTurb e landings do RedTrack.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : vslList && vslList.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase">Nome</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase">Grupo</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase">Produto</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase">VTurb Player ID</th>
                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase">RedTrack Landing</th>
              </tr>
            </thead>
            <tbody>
              {vslList.map(vsl => (
                <tr key={vsl.id} className="border-b border-border/30">
                  <td className="py-2 px-2 font-medium text-foreground">{vsl.name}</td>
                  <td className="py-2 px-2 text-muted-foreground">{vsl.groupName || "—"}</td>
                  <td className="py-2 px-2 text-muted-foreground">{vsl.product || "—"}</td>
                  <td className="py-2 px-2 text-muted-foreground font-mono text-xs">{vsl.vturbPlayerId || "—"}</td>
                  <td className="py-2 px-2 text-muted-foreground font-mono text-xs">{vsl.redtrackLandingName || vsl.redtrackLandingId || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma VSL cadastrada. Sincronize os dados ou adicione manualmente.</p>
      )}

      {/* Add New VSL */}
      <div className="border border-border/50 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-foreground">Adicionar VSL Manualmente</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            value={newVsl.name}
            onChange={(e) => setNewVsl(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Nome da VSL (ex: VSL1_US)"
            className="bg-background"
          />
          <Input
            value={newVsl.vturbPlayerId}
            onChange={(e) => setNewVsl(prev => ({ ...prev, vturbPlayerId: e.target.value }))}
            placeholder="VTurb Player ID"
            className="bg-background"
          />
          <Input
            value={newVsl.redtrackLandingId}
            onChange={(e) => setNewVsl(prev => ({ ...prev, redtrackLandingId: e.target.value }))}
            placeholder="RedTrack Landing ID"
            className="bg-background"
          />
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (!newVsl.name.trim()) { toast.error("Nome é obrigatório"); return; }
            createMutation.mutate({
              name: newVsl.name.trim(),
              vturbPlayerId: newVsl.vturbPlayerId.trim() || undefined,
              redtrackLandingId: newVsl.redtrackLandingId.trim() || undefined,
            });
          }}
          disabled={createMutation.isPending}
        >
          <Plus className="h-4 w-4 mr-1" />
          Adicionar VSL
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading } = trpc.settings.getAll.useQuery();

  const currentSettings = settings?.reduce((acc, s) => {
    acc[s.settingKey] = s.settingValue;
    return acc;
  }, {} as Record<string, string | null>) || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure as integrações e mapeamentos do dashboard
        </p>
      </div>

      <Tabs defaultValue="apis" className="space-y-4">
        <TabsList className="bg-card">
          <TabsTrigger value="apis">API Keys</TabsTrigger>
          <TabsTrigger value="mappings">Mapeamento VSLs</TabsTrigger>
        </TabsList>

        <TabsContent value="apis" className="space-y-4">
          {/* RedTrack */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-red-400" />
                <CardTitle className="text-base">RedTrack</CardTitle>
              </div>
              <CardDescription>
                Configure a API key do RedTrack para buscar métricas de revenue, cost e conversões.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentSettings["redtrack_api_key"] && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Chave atual:</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {currentSettings["redtrack_api_key"]}
                  </Badge>
                </div>
              )}
              <ApiKeyForm
                title="API Key"
                description="Encontre sua API key em RedTrack > Settings > API"
                settingKey="redtrack_api_key"
                placeholder="Insira sua RedTrack API Key"
              />
              <ConnectionTest source="redtrack" />
            </CardContent>
          </Card>

          {/* VTurb */}
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-blue-400" />
                <CardTitle className="text-base">VTurb</CardTitle>
              </div>
              <CardDescription>
                Configure o token da API do VTurb para buscar métricas de vídeo e retenção.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentSettings["vturb_api_token"] && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Token atual:</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {currentSettings["vturb_api_token"]}
                  </Badge>
                </div>
              )}
              <ApiKeyForm
                title="API Token"
                description="Encontre seu token em VTurb > Configurações > API"
                settingKey="vturb_api_token"
                placeholder="Insira seu VTurb API Token"
              />
              <ConnectionTest source="vturb" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings">
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mapeamento de VSLs</CardTitle>
              <CardDescription>
                VSLs são criadas automaticamente ao sincronizar dados do RedTrack. Aqui você pode gerenciar os mapeamentos com o VTurb.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VslMappingSection />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
