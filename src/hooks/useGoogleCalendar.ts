import { useCallback, useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Estado da conexão de um vendedor com o Google Agenda (sem os tokens). */
export interface GoogleConnection {
  sellerId: string;
  googleEmail: string | null;
  status: "active" | "error" | "revoked";
  lastError: string | null;
  lastSyncedAt: string | null;
  connectedAt: string;
}

/** Conectado = a sincronização roda (com erro passageiro inclusive); revogado precisa reconectar. */
export const isGoogleLinked = (c?: GoogleConnection) => !!c && c.status !== "revoked";

export function useGoogleCalendarConnections() {
  const [connections, setConnections] = useState<Map<string, GoogleConnection>>(new Map());
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    // Colunas explícitas: as do token não têm permissão de leitura.
    const { data, error } = await supabase
      .from("google_calendar_connections")
      .select("seller_id, google_email, status, last_error, last_synced_at, connected_at");
    if (!error && data) {
      setConnections(new Map(data.map((r) => [r.seller_id, {
        sellerId: r.seller_id,
        googleEmail: r.google_email,
        status: (r.status as GoogleConnection["status"]) ?? "active",
        lastError: r.last_error,
        lastSyncedAt: r.last_synced_at,
        connectedAt: r.connected_at,
      }])));
    }
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { connections, loading, reload };
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let message = "Não foi possível falar com o Google Agenda agora. Tente de novo em instantes.";
    if (error instanceof FunctionsHttpError) {
      try {
        const failure = JSON.parse(await error.context.text()) as { error?: string };
        if (typeof failure.error === "string") message = failure.error;
      } catch {
        // mantém a mensagem padrão
      }
    }
    throw new Error(message);
  }
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") throw new Error(data.error);
  return data as T;
}

/** Abre a tela de autorização do Google; ao terminar, o Google volta para esta página. */
export async function startGoogleConnect(sellerId: string): Promise<void> {
  const returnTo = `${window.location.origin}${window.location.pathname}`;
  const { url } = await invoke<{ url: string }>("google-calendar-auth", { action: "start", sellerId, returnTo });
  window.location.assign(url);
}

export async function disconnectGoogle(sellerId: string): Promise<void> {
  await invoke("google-calendar-auth", { action: "disconnect", sellerId });
}

export interface GoogleSyncReply {
  synced: number;
  busy?: boolean;
  message?: string;
  results?: { status: string; pushed: number; removed: number; pulled: Record<string, number>; error?: string }[];
}

export async function syncGoogleNow(sellerId: string): Promise<GoogleSyncReply> {
  return invoke<GoogleSyncReply>("google-calendar-sync", { sellerId });
}

export const GOOGLE_RETURN_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: "Google Agenda conectado. A agenda “CRM Taeco” já está recebendo os compromissos." },
  cancelado: { ok: false, text: "A conexão com o Google foi cancelada." },
  permissao: { ok: false, text: "Para conectar, permita o acesso à agenda na tela do Google." },
  erro: { ok: false, text: "Não foi possível conectar o Google Agenda. Tente de novo." },
};
