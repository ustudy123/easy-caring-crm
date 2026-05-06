import { useState, useEffect } from "react";
import { useCrm } from "@/contexts/CrmContext";
import { useRole } from "@/contexts/RoleContext";
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
  const [activeAlert, setActiveAlert] = useState<Lead | null>(null);
  const [dismissedLeads, setDismissedLeads] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!leads.length || !role) return;

    // Find first lead that matches urgency rules for current user
    const leadWithAlert = leads.find((lead) => {
      if (dismissedLeads.has(lead.id)) return false;
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
      setDismissedLeads((prev) => new Set([...prev, activeAlert.id]));
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
      <AlertDialogContent className="border-4 border-red-500 shadow-2xl animate-in zoom-in-95 duration-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-2xl font-black text-red-600 uppercase italic">
            <AlertTriangle className="h-8 w-8 animate-bounce" />
            Atenção: Atraso Grave
          </AlertDialogTitle>
          <AlertDialogDescription className="text-lg font-medium text-foreground py-4">
            O cliente <span className="font-black text-red-600">[{activeAlert.clientName}]</span> está há mais de <span className="font-black underline">{levelLabel}</span> sem atendimento!
            <div className="mt-4 flex items-center gap-2 p-3 bg-muted rounded-lg border-2 border-dashed border-muted-foreground/30">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span>Tempo parado total: <strong>{idleTime}</strong></span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction 
            onClick={handleDismiss}
            className="w-full h-14 text-xl font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-95"
          >
            ESTOU CIENTE
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}