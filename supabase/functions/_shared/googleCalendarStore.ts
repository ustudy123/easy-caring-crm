// Gravação no banco da sincronização com o Google Agenda (chave de serviço).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { ConnectionRow, FollowUpRow, LinkRow, OutboxRow, SyncStore } from "./googleCalendar.ts";

/** Depois de tantas falhas seguidas, o compromisso sai da fila (fica só no CRM). */
const MAX_OUTBOX_ATTEMPTS = 20;

const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export function supabaseSyncStore(db: SupabaseClient): SyncStore {
  return {
    async saveAccessToken(sellerId, accessToken, expiresAt) {
      const { error } = await db.from("google_calendar_connections")
        .update({ access_token: accessToken, access_token_expires_at: expiresAt })
        .eq("seller_id", sellerId);
      check(error);
    },
    async pendingOutbox(sellerId) {
      const { data, error } = await db.from("google_calendar_outbox")
        .select("id, follow_up_id, op, attempts")
        .eq("seller_id", sellerId)
        .order("id")
        .limit(200);
      check(error);
      return (data ?? []) as OutboxRow[];
    },
    async followUps(ids) {
      if (!ids.length) return [];
      const { data, error } = await db.from("follow_ups")
        .select("id, client_name, client_phone, scheduled_at, description, completed, type, assigned_to")
        .in("id", ids);
      check(error);
      return (data ?? []) as FollowUpRow[];
    },
    async links(sellerId, ids) {
      if (!ids.length) return [];
      const { data, error } = await db.from("google_calendar_event_links")
        .select("seller_id, follow_up_id, calendar_id, google_event_id, etag")
        .eq("seller_id", sellerId)
        .in("follow_up_id", ids);
      check(error);
      return (data ?? []) as LinkRow[];
    },
    async saveLink(link) {
      const { error } = await db.from("google_calendar_event_links")
        .upsert({ ...link, synced_at: new Date().toISOString() }, { onConflict: "seller_id,follow_up_id" });
      check(error);
    },
    async deleteLink(sellerId, followUpId) {
      const { error } = await db.from("google_calendar_event_links")
        .delete()
        .eq("seller_id", sellerId)
        .eq("follow_up_id", followUpId);
      check(error);
    },
    async deleteOutbox(ids) {
      const { error } = await db.from("google_calendar_outbox").delete().in("id", ids);
      check(error);
    },
    async failOutbox(item, message) {
      const attempts = item.attempts + 1;
      const { error } = attempts >= MAX_OUTBOX_ATTEMPTS
        ? await db.from("google_calendar_outbox").delete().eq("id", item.id)
        : await db.from("google_calendar_outbox").update({ attempts, last_error: message.slice(0, 500) }).eq("id", item.id);
      check(error);
    },
    async applyEvent(sellerId, calendarId, ev, parsed) {
      const { data, error } = await db.rpc("google_calendar_apply_event", {
        _seller_id: sellerId,
        _calendar_id: calendarId,
        _event_id: ev.id,
        _etag: ev.etag ?? null,
        _cancelled: parsed.cancelled,
        _client_name: parsed.clientName,
        _type: parsed.type,
        _completed: parsed.completed,
        _description: parsed.description,
        _scheduled_at: parsed.scheduledAt,
        _crm_follow_up_id: parsed.crmFollowUpId,
      });
      check(error);
      return String(data ?? "skipped");
    },
    async finish(sellerId, patch) {
      const values: Record<string, unknown> = {
        status: patch.status,
        last_error: patch.last_error,
        last_synced_at: new Date().toISOString(),
        sync_lock_until: null,
      };
      if (patch.sync_token !== undefined) values.sync_token = patch.sync_token;
      const { error } = await db.from("google_calendar_connections").update(values).eq("seller_id", sellerId);
      check(error);
    },
  };
}

/** Reserva as conexões para uma rodada (ver google_calendar_claim no banco). */
export async function claimConnections(db: SupabaseClient, sellerId: string | null, minIntervalSeconds: number): Promise<ConnectionRow[]> {
  const { data, error } = await db.rpc("google_calendar_claim", {
    _seller_id: sellerId,
    _min_interval_seconds: minIntervalSeconds,
  });
  check(error);
  return (data ?? []) as ConnectionRow[];
}
