         <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2 text-base font-bold">
               <MessageCircle className="h-4 w-4 text-primary" /> Integração WhatsApp
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
             <p className="text-xs text-muted-foreground">
               Seu número está sincronizado com o sistema. Mensagens recebidas serão transformadas em leads automaticamente.
             </p>
           </CardContent>
         </Card>

import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
  import { Settings, Bell, Shield, Loader2, MessageCircle, UserX, UserCheck, RefreshCw } from "lucide-react";
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
  const { isAdmin } = useRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [allSellers, setAllSellers] = useState<any[]>([]);
  const [companyName, setCompanyName] = useState("CRM Tintas");
  const [notifications, setNotifications] = useState({
    newLeads: true,
    followUpReminders: true,
    overdueAlerts: true,
  });

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      const [settingsRes, profileRes, sellersRes] = await Promise.all([
        supabase.from("settings").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("profiles").select("id, display_name").neq("id", user.id).order("display_name")
      ]);

      if (settingsRes.data) {
        setCompanyName(settingsRes.data.company_name);
        setNotifications({
          newLeads: settingsRes.data.notify_new_leads,
          followUpReminders: settingsRes.data.notify_follow_up_reminders,
          overdueAlerts: settingsRes.data.notify_overdue_alerts,
        });
      }

      if (profileRes.data) {
        setProfile(profileRes.data);
      }

      if (sellersRes.data) {
        setAllSellers(sellersRes.data);
      }

      setLoading(false);
    };
    fetchSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      company_name: companyName,
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

  if (loading) {
    return (
      <AppLayout title="Configurações">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const handleUpdateProfile = async (updates: any) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setProfile({ ...profile, ...updates });
      toast({ title: "Perfil atualizado!" });
    }
  };

  return (
    <AppLayout title="Configurações">
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <UserCheck className="h-4 w-4 text-primary" /> Status e Disponibilidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl border bg-card shadow-sm">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold flex items-center gap-2">
                  {profile?.is_active ? <span className="flex h-2 w-2 rounded-full bg-green-500" /> : <span className="flex h-2 w-2 rounded-full bg-red-500" />}
                  Você está {profile?.is_active ? 'Ativo' : 'Inativo / Em Férias'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile?.is_active 
                    ? "Você está recebendo leads normalmente." 
                    : "Novas mensagens serão redirecionadas para seu substituto."}
                </p>
              </div>
              <Switch 
                checked={profile?.is_active} 
                onCheckedChange={(v) => handleUpdateProfile({ is_active: v })} 
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
                  value={profile?.substitute_id || "none"} 
                  onValueChange={(v) => handleUpdateProfile({ substitute_id: v === "none" ? null : v })}
                  disabled={saving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um substituto..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (usar fila geral)</SelectItem>
                    {allSellers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.display_name || "Vendedor sem nome"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Settings className="h-4 w-4 text-primary" /> Geral
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome da empresa</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Bell className="h-4 w-4 text-primary" /> Notificações
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Shield className="h-4 w-4 text-primary" /> Sobre
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">CRM Tintas v1.0 — Sistema de gestão comercial</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
