import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Bell, Loader2, MessageCircle, UserCheck, Users, SortAsc } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/contexts/RoleContext";

export default function Configuracoes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isGerente } = useRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seller, setSeller] = useState<any>(null);
  const [allSellers, setAllSellers] = useState<any[]>([]);
  const [teamSellers, setTeamSellers] = useState<any[]>([]);
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);
  const [updatingPriority, setUpdatingPriority] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("CRM Tintas");
  const [autoReturnLeads, setAutoReturnLeads] = useState(true);
  const [notifications, setNotifications] = useState({
    newLeads: true,
    followUpReminders: true,
    overdueAlerts: true,
  });

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      const [settingsRes, sellerRes, allSellersRes, teamRes] = await Promise.all([
        supabase.from("settings").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("sellers").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("sellers").select("id, name, store_id").neq("user_id", user.id).order("name"),
        supabase.from("sellers").select("id, name, code, store_id, is_active, status, substitute_id, user_id, distribution_priority").order("distribution_priority", { ascending: false }).order("name"),
      ]);

      if (settingsRes.data) {
        setCompanyName(settingsRes.data.company_name);
        setAutoReturnLeads(settingsRes.data.auto_return_leads ?? true);
        setNotifications({
          newLeads: settingsRes.data.notify_new_leads,
          followUpReminders: settingsRes.data.notify_follow_up_reminders,
          overdueAlerts: settingsRes.data.notify_overdue_alerts,
        });
      }

      if (sellerRes.data) {
        setSeller(sellerRes.data);
      }

      if (allSellersRes.data) {
        // Only show sellers from the same store if the current seller has a store_id
        if (sellerRes.data?.store_id) {
          setAllSellers(allSellersRes.data.filter(s => s.store_id === sellerRes.data.store_id));
        } else {
          setAllSellers(allSellersRes.data);
        }
      }

      if (teamRes.data) {
        const storeId = sellerRes.data?.store_id;
        const list = storeId
          ? teamRes.data.filter(s => s.store_id === storeId)
          : teamRes.data;
        setTeamSellers(list);
      }

      setLoading(false);
    };
    fetchSettings();
  }, [user]);

  const handleSaveGeneral = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      company_name: companyName,
      auto_return_leads: autoReturnLeads,
      notify_new_leads: notifications.newLeads,
      notify_follow_up_reminders: notifications.followUpReminders,
      notify_overdue_alerts: notifications.overdueAlerts,
    };

    const { error } = await supabase
      .from("settings")
      .upsert(payload, { onConflict: "user_id" });

    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas!", description: "As alterações foram aplicadas." });
    }
  };

  const handleUpdateSeller = async (updates: any) => {
    if (!user || !seller) return;

    // Determine final state after applying updates
    const next = { ...seller, ...updates };
    const willBeInactive = ('is_active' in updates)
      ? updates.is_active === false
      : seller.is_active === false;

    if (willBeInactive && !next.substitute_id) {
      toast({
        title: "Substituto obrigatório",
        description: "Selecione um vendedor substituto antes de ficar inativo.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    
    // If updating activity, also update status for consistency in Admin/Routing
    const finalUpdates = { ...updates };
    if ('is_active' in updates) {
      finalUpdates.status = updates.is_active ? 'active' : 'inactive';
    }

    const { error } = await supabase.from("sellers").update(finalUpdates).eq("id", seller.id);
    
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSeller({ ...seller, ...finalUpdates });
      
      // Mirror to profiles for backward compatibility
      await supabase.from("profiles").update({
        is_active: finalUpdates.is_active,
        substitute_id: finalUpdates.substitute_id
      }).eq("user_id", user.id);

      toast({ title: "Status atualizado!" });
    }
    setSaving(false);
  };

  const handleUpdateTeamMember = async (
    member: any,
    updates: { status?: string; substitute_id?: string | null }
  ) => {
    const next = { ...member, ...updates };
    const inactive = next.status && next.status !== "active";

    if (inactive && !next.substitute_id) {
      toast({
        title: "Substituto obrigatório",
        description: `Selecione um vendedor substituto para ${member.name} antes de marcar como inativo.`,
        variant: "destructive",
      });
      return;
    }

    setSavingTeamId(member.id);
    const dbUpdates: any = { ...updates };
    if ("status" in updates) {
      dbUpdates.is_active = updates.status === "active";
    }
    const { error } = await supabase.from("sellers").update(dbUpdates).eq("id", member.id);
    setSavingTeamId(null);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setTeamSellers((prev) =>
      prev.map((s) => (s.id === member.id ? { ...s, ...dbUpdates } : s))
    );
    toast({ title: "Vendedor atualizado" });
  };

  if (loading) {
    return (
      <AppLayout title="Configurações">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Configurações">
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <UserCheck className="h-4 w-4 text-brand-500" /> Status e Disponibilidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-[14px] border border-black/8 bg-white">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold flex items-center gap-2">
                  {seller?.is_active ? (
                    <span className="flex h-2 w-2 rounded-full bg-green-500" />
                  ) : (
                    <span className="flex h-2 w-2 rounded-full bg-red-500" />
                  )}
                  Você está {seller?.is_active ? 'Ativo' : 'Inativo / Em Férias'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {seller?.is_active 
                    ? "Você está recebendo leads normalmente." 
                    : "Novas mensagens serão redirecionadas para seu substituto."}
                </p>
              </div>
              <Switch 
                checked={seller?.is_active} 
                onCheckedChange={(v) => handleUpdateSeller({ is_active: v })} 
                disabled={saving}
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-col space-y-1">
                <Label className="text-sm font-medium">Vendedor Substituto</Label>
                <p className="text-xs text-muted-foreground">
                  Quem deve assumir seus atendimentos quando você estiver inativo?
                </p>
              </div>
              <div className="flex gap-2">
                <Select 
                  value={seller?.substitute_id || "none"} 
                  onValueChange={(v) => handleUpdateSeller({ substitute_id: v === "none" ? null : v })}
                  disabled={saving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um substituto..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (usar fila geral)</SelectItem>
                    {allSellers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name || "Vendedor sem nome"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <MessageCircle className="h-4 w-4 text-brand-500" /> Integração WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Status da Conexão</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Conectado e pronto para uso
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Ativo</Badge>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Settings className="h-4 w-4 text-brand-500" /> Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome da empresa</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Retorno Automático de Leads</Label>
                  <p className="text-xs text-muted-foreground">
                    Conversas retornam ao vendedor original quando ele volta a ficar ativo.
                  </p>
                </div>
                <Switch checked={autoReturnLeads} onCheckedChange={setAutoReturnLeads} />
              </div>
              <Button onClick={handleSaveGeneral} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </CardContent>
          </Card>
        )}

        {(isGerente || isAdmin) && teamSellers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Users className="h-4 w-4 text-brand-500" /> Gestão da Equipe
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Defina status, vendedor substituto e ordem de preferência da sua equipe.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground border-b pb-2">
                  <SortAsc className="h-4 w-4" /> Ordem de Preferência (Prioridade)
                </div>
                {teamSellers.map((m) => {
                  const otherSellers = teamSellers.filter((s) => s.id !== m.id);
                  return (
                    <div
                      key={m.id}
                      className="space-y-3 p-3 rounded-lg border border-black/8 bg-white"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{m.name}</p>
                          {m.code && (
                            <p className="text-[11px] text-muted-foreground font-mono">Código {m.code}</p>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex flex-col space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground font-medium">Prioridade</Label>
                            <Select
                              value={String(m.distribution_priority || 0)}
                              onValueChange={(v) => handleUpdatePriority(m.id, parseInt(v))}
                              disabled={updatingPriority === m.id}
                            >
                              <SelectTrigger className="w-[80px] h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => (
                                  <SelectItem key={p} value={String(p)}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex flex-col space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground font-medium">Status</Label>
                            <Select
                              value={m.status || "active"}
                              onValueChange={(v) => handleUpdateTeamMember(m, { status: v })}
                              disabled={savingTeamId === m.id}
                            >
                              <SelectTrigger className="w-[120px] h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Ativo</SelectItem>
                                <SelectItem value="inactive">Inativo</SelectItem>
                                <SelectItem value="vacation">Em férias</SelectItem>
                                <SelectItem value="away">Ausente</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex flex-col space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground font-medium">Substituto</Label>
                            <Select
                              value={m.substitute_id || "none"}
                              onValueChange={(v) =>
                                handleUpdateTeamMember(m, { substitute_id: v === "none" ? null : v })
                              }
                              disabled={savingTeamId === m.id}
                            >
                              <SelectTrigger className="w-[160px] h-9">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhum (fila geral)</SelectItem>
                                {otherSellers.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <Bell className="h-4 w-4 text-brand-500" /> Notificações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Novos leads</p>
                <p className="text-xs text-muted-foreground">Receber alerta quando um novo lead entrar</p>
              </div>
              <Switch checked={notifications.newLeads} onCheckedChange={(v) => setNotifications((p) => ({ ...p, newLeads: v }))} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Lembretes de follow-up</p>
                <p className="text-xs text-muted-foreground">Notificar antes de follow-ups agendados</p>
              </div>
              <Switch checked={notifications.followUpReminders} onCheckedChange={(v) => setNotifications((p) => ({ ...p, followUpReminders: v }))} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Alertas de atraso</p>
                <p className="text-xs text-muted-foreground">Avisar quando um lead está parado há muito tempo</p>
              </div>
              <Switch checked={notifications.overdueAlerts} onCheckedChange={(v) => setNotifications((p) => ({ ...p, overdueAlerts: v }))} />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}