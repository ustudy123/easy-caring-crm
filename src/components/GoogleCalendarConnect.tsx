import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarCheck2, Link2Off, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GOOGLE_RETURN_MESSAGES, disconnectGoogle, startGoogleConnect, syncGoogleNow, type GoogleConnection,
} from "@/hooks/useGoogleCalendar";

const time = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? `hoje às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/**
 * Volta da tela do Google (?google=conectado&vendedor=…): avisa, roda a primeira
 * sincronização e limpa o endereço.
 */
export function useGoogleReturn(onDone: () => void) {
  const [params, setParams] = useSearchParams();
  const handled = useRef(false);
  const result = params.get("google");
  const sellerId = params.get("vendedor");
  useEffect(() => {
    if (!result || handled.current) return;
    handled.current = true;
    const msg = GOOGLE_RETURN_MESSAGES[result] ?? GOOGLE_RETURN_MESSAGES.erro;
    if (msg.ok) toast.success(msg.text);
    else toast.error(msg.text);
    const next = new URLSearchParams(params);
    next.delete("google");
    next.delete("vendedor");
    setParams(next, { replace: true });
    if (result === "conectado" && sellerId) {
      syncGoogleNow(sellerId).catch(() => undefined).finally(onDone);
    } else {
      onDone();
    }
  }, [result, sellerId, params, setParams, onDone]);
}

/**
 * Conexão do vendedor da equipe externa com o Google Agenda. `compact` é a
 * versão de uma linha usada no Admin → Metas.
 */
export function GoogleCalendarCard({
  sellerId, connection, onChanged, compact = false,
}: {
  sellerId: string;
  connection?: GoogleConnection;
  onChanged: () => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<null | "connect" | "sync" | "disconnect">(null);
  const [confirming, setConfirming] = useState(false);

  const run = async (kind: "connect" | "sync" | "disconnect") => {
    setBusy(kind);
    try {
      if (kind === "connect") {
        await startGoogleConnect(sellerId);
        return; // a página sai para o Google
      }
      if (kind === "disconnect") {
        await disconnectGoogle(sellerId);
        toast.success("Google Agenda desconectado. A agenda “CRM Taeco” continua no Google, mas não recebe mais mudanças.");
        setConfirming(false);
      } else {
        const reply = await syncGoogleNow(sellerId);
        const r = reply.results?.[0];
        if (reply.busy) toast.info(reply.message ?? "Sincronizado há poucos segundos.");
        else if (r?.error) toast.error(r.error);
        else toast.success("Agenda sincronizada com o Google.");
      }
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(null);
  };

  const spin = (kind: typeof busy) => busy === kind && <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  const status = connection?.status;

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            !connection && "bg-muted text-muted-foreground",
            status === "active" && "bg-emerald-100 text-emerald-700",
            status === "error" && "bg-amber-100 text-amber-700",
            status === "revoked" && "bg-red-100 text-red-700",
          )}
          title={connection?.lastError ?? connection?.googleEmail ?? undefined}
        >
          {!connection ? "Google Agenda: não conectado"
            : status === "revoked" ? "Google Agenda: reconectar"
              : status === "error" ? "Google Agenda: com erro"
                : `Google Agenda: ${connection.googleEmail ?? "conectado"}`}
        </span>
        {(!connection || status === "revoked") && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => run("connect")} disabled={!!busy}>
            {spin("connect")} Conectar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 space-y-2",
        !connection && "border-border/60 bg-card",
        status === "active" && "border-emerald-200 bg-emerald-50/60",
        status === "error" && "border-amber-200 bg-amber-50/60",
        status === "revoked" && "border-red-200 bg-red-50/60",
      )}
    >
      <div className="flex items-start gap-2">
        {status === "error" || status === "revoked"
          ? <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0", status === "revoked" ? "text-red-600" : "text-amber-600")} />
          : <CalendarCheck2 className={cn("h-4 w-4 mt-0.5 shrink-0", connection ? "text-emerald-600" : "text-muted-foreground")} />}
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-semibold text-foreground text-sm">Google Agenda</p>
          {!connection ? (
            <p className="text-muted-foreground">
              Conecte para ver os compromissos do CRM no celular. O CRM cria no Google uma agenda separada, “CRM Taeco”: o que
              for marcado nela também entra aqui. Compromissos pessoais das outras agendas não entram no CRM.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground break-words">
                {status === "revoked"
                  ? `Sem acesso ao Google${connection.googleEmail ? ` (${connection.googleEmail})` : ""}`
                  : <>
                      {connection.googleEmail ? `Conectado: ${connection.googleEmail}` : "Conectado"}
                      {connection.lastSyncedAt ? ` · atualizado ${time(connection.lastSyncedAt)}` : " · primeira sincronização em andamento"}
                    </>}
              </p>
              {connection.lastError && (
                <p role="alert" className={cn("font-medium", status === "revoked" ? "text-red-700" : "text-amber-800")}>{connection.lastError}</p>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(!connection || status === "revoked") && (
          <Button size="sm" className="h-8 gap-1.5" onClick={() => run("connect")} disabled={!!busy}>
            {spin("connect")} {connection ? "Conectar de novo" : "Conectar Google Agenda"}
          </Button>
        )}
        {connection && status !== "revoked" && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => run("sync")} disabled={!!busy}>
            {spin("sync") || <RefreshCw className="h-3.5 w-3.5" />} Sincronizar agora
          </Button>
        )}
        {connection && (confirming ? (
          <>
            <Button size="sm" variant="destructive" className="h-8 gap-1.5" onClick={() => run("disconnect")} disabled={!!busy}>
              {spin("disconnect")} Confirmar desconexão
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setConfirming(false)} disabled={!!busy}>Cancelar</Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-muted-foreground" onClick={() => setConfirming(true)} disabled={!!busy}>
            <Link2Off className="h-3.5 w-3.5" /> Desconectar
          </Button>
        ))}
      </div>
    </div>
  );
}
