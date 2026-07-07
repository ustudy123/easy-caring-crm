import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCrm } from "@/contexts/CrmContext";
import { useRole } from "@/contexts/RoleContext";
import { useAuth } from "@/contexts/AuthContext";
import { getUrgencyLevel, formatIdleTime } from "@/lib/leadUrgency";
import { Lead } from "@/types/crm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Clock } from "lucide-react";

export function UrgencyAlertPopup() {
  const { leads } = useCrm();
  const { role, sellerId, isAdmin, isGerente, isVendedor } = useRole();
  const { user } = useAuth();
  const storageKey = user ? `urgency_dismissed_${user.id}` : null;
  const [activeAlert, setActiveAlert] = useState<Lead | null>(null);
  const [dismissedLeads, setDismissedLeads] = useState<Set<string>>(new Set());

  // Load dismissed leads from localStorage on mount / user change
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        setDismissedLeads(new Set(parsed));
      } else {
        setDismissedLeads(new Set());
      }
    } catch {
      setDismissedLeads(new Set());
    }
  }, [storageKey]);

  useEffect(() => {
    if (!leads.length || !role) return;

    // Find first lead that matches urgency rules for current user
    const leadWithAlert = leads.find((lead) => {
      if (dismissedLeads.has(lead.id)) return false;
      if (lead.urgencyAcknowledgedAt) return false; // já deram "Estou ciente"
      if (lead.stage === "fechamento" || lead.stage === "pos_venda") return false;

      const urgency = getUrgencyLevel(lead);
      
      // Vendedor: 30m (attention)
      if (isVendedor && lead.assignedTo === sellerId && urgency === "attention") {
        return true;
      }
      
      // Gerente: 1h (warning)
      if (isGerente && urgency === "warning") {
        return true;
      }
      
      // Admin: 1.5h (critical)
      if (isAdmin && urgency === "critical") {
        return true;
      }

      return false;
    });

    if (leadWithAlert && (!activeAlert || activeAlert.id !== leadWithAlert.id)) {
      setActiveAlert(leadWithAlert);
    } else if (!leadWithAlert && activeAlert) {
      setActiveAlert(null);
    }
  }, [leads, role, sellerId, isAdmin, isGerente, isVendedor, dismissedLeads, activeAlert]);

  const handleDismiss = () => {
    if (activeAlert) {
      const leadId = activeAlert.id;
      // Persiste a ciência no banco: não reaparece para ninguém (vendedor/gerente/admin).
      supabase.from("leads").update({ urgency_acknowledged_at: new Date().toISOString() } as any).eq("id", leadId).then(({ error }) => {
        if (error) console.error("Erro ao registrar ciência do alerta:", error);
      });
      setDismissedLeads((prev) => {
        const next = new Set([...prev, leadId]);
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify([...next]));
          } catch {}
        }
        return next;
      });
      setActiveAlert(null);
    }
  };

  if (!activeAlert) return null;

  const idleTime = formatIdleTime(activeAlert);
  const urgency = getUrgencyLevel(activeAlert);
  
  let levelLabel = "30 minutos";
  if (urgency === "warning") levelLabel = "1 hora";
  if (urgency === "critical") levelLabel = "1 hora e 30 minutos";

  return (
    <AlertDialog open={!!activeAlert} onOpenChange={(open) => !open && handleDismiss()}>
      <AlertDialogContent className="border border-border shadow-2xl animate-in zoom-in-95 duration-200 p-0 overflow-hidden">
        <div className={cn(
          "h-1.5 w-full",
          urgency === "attention" ? "bg-warning" :
          urgency === "warning" ? "bg-destructive/80" : "bg-destructive"
        )} />
        <div className="p-6 pt-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-xl font-bold text-foreground">
              <div className={cn(
                "rounded-full p-2 animate-urgency-pulse",
                urgency === "attention" ? "bg-warning/20 text-warning" :
                urgency === "warning" ? "bg-destructive/20 text-destructive/80" : "bg-destructive/20 text-destructive"
              )}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              Atenção: Atraso Grave
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground py-4">
              O cliente <span className="font-semibold text-foreground">{activeAlert.clientName}</span> está há mais de <span className="font-semibold text-foreground">{levelLabel}</span> sem atendimento!
              <div className="mt-4">
                <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Tempo parado total: <strong className="text-foreground">{idleTime}</strong></span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2">
            <AlertDialogAction 
              onClick={handleDismiss}
              className={cn(
                "w-full h-11 text-sm font-semibold text-white transition-all shadow-md",
                urgency === "attention" ? "bg-warning hover:bg-warning/90 shadow-warning/20" :
                urgency === "warning" ? "bg-destructive/80 hover:bg-destructive/90 shadow-destructive/20" : "bg-destructive hover:bg-destructive/90 shadow-destructive/20"
              )}
            >
              ESTOU CIENTE
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}