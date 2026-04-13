import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Bell, Shield, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function Configuracoes() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("CRM Tintas");
  const [notifications, setNotifications] = useState({
    newLeads: true,
    followUpReminders: true,
    overdueAlerts: true,
  });

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setCompanyName(data.company_name);
        setNotifications({
          newLeads: data.notify_new_leads,
          followUpReminders: data.notify_follow_up_reminders,
          overdueAlerts: data.notify_overdue_alerts,
        });
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

  return (
    <AppLayout title="Configurações">
      <div className="max-w-2xl space-y-6">
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
