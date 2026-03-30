import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Campaign } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, DollarSign, Users, Target, MessageCircle, Instagram, Globe, Share2, Pencil, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { NewCampaignForm } from "@/components/forms/NewCampaignForm";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useToast } from "@/hooks/use-toast";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const channelConfig: Record<string, { icon: typeof MessageCircle; label: string; color: string }> = {
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "bg-kanban-new text-white" },
  instagram: { icon: Instagram, label: "Instagram", color: "bg-accent text-white" },
  meta: { icon: Globe, label: "Meta Ads", color: "bg-primary text-white" },
  google: { icon: Globe, label: "Google Ads", color: "bg-kanban-quote text-white" },
  indicacao: { icon: Share2, label: "Indicação", color: "bg-secondary text-white" },
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  active: { label: "Ativa", variant: "default" },
  paused: { label: "Pausada", variant: "secondary" },
  completed: { label: "Concluída", variant: "outline" },
};

export default function Campanhas() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      if (data) {
        setCampaigns(data.map((c: any) => ({
          id: c.id,
          name: c.name,
          channel: c.channel,
          startDate: c.start_date,
          endDate: c.end_date || undefined,
          budget: Number(c.budget),
          leadsGenerated: c.leads_generated,
          conversions: c.conversions,
          status: c.status,
        })));
      }
    };
    fetch();
  }, []);

  const addCampaign = async (campaign: Campaign) => {
    setCampaigns((prev) => [campaign, ...prev]);
    const { error } = await supabase.from("campaigns").insert({
      id: campaign.id,
      name: campaign.name,
      channel: campaign.channel,
      start_date: campaign.startDate,
      end_date: campaign.endDate || null,
      budget: campaign.budget,
      status: campaign.status,
    });
    if (error) {
      console.error("Error adding campaign:", error);
      setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
    }
  };

  const deleteCampaign = async (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Campanha excluída", variant: "destructive" });
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) console.error("Error deleting campaign:", error);
  };

  const totalLeads = campaigns.reduce((s, c) => s + c.leadsGenerated, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0);
  const avgCPL = totalLeads > 0 ? Math.round(totalBudget / totalLeads) : 0;

  const chartData = campaigns.map((c) => ({
    name: c.name.length > 15 ? c.name.slice(0, 15) + "…" : c.name,
    leads: c.leadsGenerated,
    conversoes: c.conversions,
  }));

  return (
    <AppLayout title="Campanhas">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Leads Gerados", value: totalLeads, icon: Users, color: "bg-primary" },
            { label: "Conversões", value: totalConversions, icon: Target, color: "bg-kanban-closed" },
            { label: "Investimento", value: `R$ ${totalBudget.toLocaleString("pt-BR")}`, icon: DollarSign, color: "bg-kanban-quote" },
            { label: "Custo por Lead", value: `R$ ${avgCPL}`, icon: TrendingUp, color: "bg-secondary" },
          ].map((kpi) => (
            <motion.div key={kpi.label} variants={item}>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kpi.color}`}>
                    <kpi.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-xl font-extrabold">{kpi.value}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold">Performance por Campanha</CardTitle>
              <Button size="sm" className="bg-primary" onClick={() => setShowNewCampaign(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Nova Campanha
              </Button>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="leads" fill="hsl(220,90%,56%)" radius={[6, 6, 0, 0]} name="Leads" />
                    <Bar dataKey="conversoes" fill="hsl(142,71%,45%)" radius={[6, 6, 0, 0]} name="Conversões" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma campanha cadastrada. Clique em "Nova Campanha" para começar.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map((campaign) => {
            const config = channelConfig[campaign.channel] || channelConfig.whatsapp;
            const status = statusConfig[campaign.status];
            const convRate = campaign.leadsGenerated > 0 ? Math.round((campaign.conversions / campaign.leadsGenerated) * 100) : 0;
            const cpl = campaign.leadsGenerated > 0 ? Math.round(campaign.budget / campaign.leadsGenerated) : 0;
            const Icon = config.icon;

            return (
              <motion.div key={campaign.id} variants={item}>
                <Card className="hover:shadow-md transition-shadow group">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{campaign.name}</p>
                          <p className="text-[10px] text-muted-foreground">{config.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>
                        <button
                          onClick={() => setPendingDeleteId(campaign.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted p-2">
                        <p className="text-[10px] text-muted-foreground">Leads</p>
                        <p className="text-sm font-bold">{campaign.leadsGenerated}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <p className="text-[10px] text-muted-foreground">Conversões</p>
                        <p className="text-sm font-bold text-kanban-closed">{campaign.conversions}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <p className="text-[10px] text-muted-foreground">CPL</p>
                        <p className="text-sm font-bold">R$ {cpl}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <p className="text-[10px] text-muted-foreground">Conversão</p>
                        <p className="text-sm font-bold text-primary">{convRate}%</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Investimento: R$ {campaign.budget.toLocaleString("pt-BR")}</span>
                      <span>{new Date(campaign.startDate).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <NewCampaignForm open={showNewCampaign} onOpenChange={setShowNewCampaign} onSubmit={addCampaign} />
      <ConfirmDeleteDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        onConfirm={() => { if (pendingDeleteId) { deleteCampaign(pendingDeleteId); setPendingDeleteId(null); } }}
      />
    </AppLayout>
  );
}
