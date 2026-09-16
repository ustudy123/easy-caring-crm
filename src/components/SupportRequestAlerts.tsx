import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";
import { useBackgroundAlert } from "@/hooks/useBackgroundAlert";
import { toast } from "sonner";
import { BellOff } from "lucide-react";

/**
 * Alerta de novas solicitações de suporte em QUALQUER página do sistema.
 *
 * Entrega em dois canais:
 *  - Notificação do sistema operacional (precisa de permissão do navegador).
 *  - Aviso dentro do CRM (toast) — sempre aparece com o sistema aberto, mesmo
 *    sem permissão de notificação concedida.
 *
 * Mostra também um indicador quando as notificações do navegador estão
 * desligadas, com botão para ativar — para não ficar no escuro sobre o porquê.
 */
export function SupportRequestAlerts() {
  const { isSuporte, isAdmin, sellerId, storeId } = useRole();
  const { permission, requestPermission, notify } = useBackgroundAlert("CRM Taeco");
  const enabled = isSuporte || isAdmin;

  useEffect(() => {
    if (!enabled) return;

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
          const desc = `${r.client_name || "Cliente"} — solicitação recebida`;

          // 1) Notificação do sistema operacional (só se o navegador autorizou).
          notify(tipo, desc);
          // 2) Aviso dentro do CRM — sempre visível com o sistema aberto.
          toast(`🔔 ${tipo}`, { description: desc, duration: 8000 });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [enabled, isAdmin, sellerId, storeId, notify]);

  // Indicador de permissão: só aparece para suporte/admin quando as notificações
  // do navegador NÃO estão liberadas. Some assim que forem ativadas.
  if (!enabled || permission === "granted") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 shadow-lg max-w-[92vw]">
      <BellOff className="h-4 w-4 shrink-0 text-amber-600" />
      {permission === "denied" ? (
        <span className="text-xs font-medium text-amber-800">
          Notificações bloqueadas — libere no cadeado ao lado do endereço → Notificações → Permitir.
        </span>
      ) : (
        <>
          <span className="text-xs font-medium text-amber-800">Notificações do navegador desligadas</span>
          <button
            onClick={() => requestPermission()}
            className="ml-1 shrink-0 rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Ativar
          </button>
        </>
      )}
    </div>
  );
}
