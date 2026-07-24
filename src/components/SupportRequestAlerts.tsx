import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";
import { useBackgroundAlert } from "@/hooks/useBackgroundAlert";

/**
 * Alerta de novas solicitações de suporte em QUALQUER página do sistema.
 *
 * Antes o aviso vivia dentro da página de Suporte a Orçamento: quem estivesse
 * no Kanban (ou em outra tela) não era avisado. Montado no AppShell, o alerta
 * vale enquanto o sistema estiver aberto em alguma aba.
 */
export function SupportRequestAlerts() {
  const { isSuporte, isAdmin, sellerId, storeId } = useRole();
  const { notify } = useBackgroundAlert("CRM Taeco");

  useEffect(() => {
    if (!isSuporte && !isAdmin) return;

    const channel = supabase
      .channel("support-alerts-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pricing_support_requests" },
        (payload: any) => {
          const r = payload?.new || {};
          const paraMim = !!sellerId && r.assigned_to === sellerId;
          const daMinhaLoja = !!storeId && r.store_id === storeId;
          if (!(isAdmin || paraMim || daMinhaLoja)) return;

          const tipo = r.request_type === "precificacao_especial"
            ? "Negociação especial"
            : "Novo orçamento";
          notify(tipo, `${r.client_name || "Cliente"} — solicitação recebida`);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isSuporte, isAdmin, sellerId, storeId, notify]);

  return null;
}
