// Ponte Agenda do CRM ⇄ Google Agenda (Fase 6b), usada pelas funções
// google-calendar-auth e google-calendar-sync. Sem APIs do Deno, para os testes
// (vitest) importarem direto. Tudo que fala com o Google recebe o fetch por
// parâmetro.

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
export const OAUTH_SCOPES = ["openid", "email", CALENDAR_SCOPE];
export const TIME_ZONE = "America/Sao_Paulo";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export type FollowUpType = "call" | "whatsapp" | "visit" | "email" | "quote";
export const TYPE_LABELS: Record<FollowUpType, string> = {
  call: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  visit: "Visita",
  quote: "Orçamentação",
};
const DONE_MARK = "✓";
const FOOTER = "— Sincronizado pelo CRM Taeco";
const PHONE_PREFIX = "Telefone: ";

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

// ── Compromisso ⇄ evento ──────────────────────────────────────────────────────

export interface FollowUpRow {
  id: string;
  client_name: string;
  client_phone: string;
  scheduled_at: string;
  description: string;
  completed: boolean;
  type: FollowUpType;
  assigned_to: string | null;
}

export interface GoogleEvent {
  id: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  recurrence?: string[];
  recurringEventId?: string;
  extendedProperties?: { private?: Record<string, string> };
}

export function eventDurationMinutes(type: FollowUpType): number {
  return type === "visit" || type === "quote" ? 60 : 30;
}

/** Corpo do evento no Google para um compromisso do CRM. */
export function eventBodyFromFollowUp(f: FollowUpRow): Record<string, unknown> {
  const start = new Date(f.scheduled_at);
  const end = new Date(start.getTime() + eventDurationMinutes(f.type) * 60_000);
  const lines = [f.description?.trim(), f.client_phone?.trim() ? `${PHONE_PREFIX}${f.client_phone.trim()}` : "", FOOTER]
    .filter(Boolean);
  return {
    summary: `${f.completed ? `${DONE_MARK} ` : ""}${TYPE_LABELS[f.type] ?? "Compromisso"}: ${f.client_name}`,
    description: lines.join("\n"),
    start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
    extendedProperties: { private: { crmFollowUpId: f.id } },
  };
}

export interface ParsedEvent {
  cancelled: boolean;
  clientName: string | null;
  type: FollowUpType | null;
  completed: boolean | null;
  description: string | null;
  scheduledAt: string | null;
  crmFollowUpId: string | null;
}

/** O Google Agenda na web grava a descrição em HTML; volta para texto simples. */
export function htmlToText(s: string): string {
  if (!/<[a-z!/]/i.test(s) && !/&[a-z#0-9]+;/i.test(s)) return s;
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Lê um evento do Google como compromisso: "✓ " no título = concluído, "Visita: "
 * (ou outro tipo) = tipo, o resto é o cliente. Tira da descrição o rodapé e o
 * telefone que o CRM escreveu. Eventos repetidos ficam de fora (null).
 */
export function parseEvent(ev: GoogleEvent): ParsedEvent | null {
  if (ev.recurrence?.length || ev.recurringEventId) return null;
  const crmFollowUpId = ev.extendedProperties?.private?.crmFollowUpId ?? null;
  if (ev.status === "cancelled") {
    return { cancelled: true, clientName: null, type: null, completed: null, description: null, scheduledAt: null, crmFollowUpId };
  }

  let title = (ev.summary ?? "").trim();
  let completed = false;
  if (title.startsWith(DONE_MARK)) {
    completed = true;
    title = title.slice(DONE_MARK.length).trim();
  }
  let type: FollowUpType | null = null;
  for (const [key, label] of Object.entries(TYPE_LABELS) as [FollowUpType, string][]) {
    if (title.toLowerCase().startsWith(`${label.toLowerCase()}:`)) {
      type = key;
      title = title.slice(label.length + 1).trim();
      break;
    }
  }

  const lines = htmlToText(ev.description ?? "").split(/\r?\n/).map((l) => l.trimEnd());
  if (lines.length && lines[lines.length - 1].trim() === FOOTER) {
    lines.pop();
    if (lines.length && lines[lines.length - 1].startsWith(PHONE_PREFIX)) lines.pop();
  }
  const description = lines.join("\n").trim();

  let scheduledAt: string | null = null;
  if (ev.start?.dateTime) scheduledAt = new Date(ev.start.dateTime).toISOString();
  else if (ev.start?.date) scheduledAt = new Date(`${ev.start.date}T09:00:00-03:00`).toISOString();

  return { cancelled: false, clientName: title || null, type, completed, description, scheduledAt, crmFollowUpId };
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

export class GoogleAuthError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export function buildAuthUrl(o: { clientId: string; redirectUri: string; state: string; loginHint?: string }): string {
  const p = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: "code",
    scope: OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: o.state,
  });
  if (o.loginHint) p.set("login_hint", o.loginHint);
  return `${AUTH_URL}?${p.toString()}`;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Lê o e-mail do id_token devolvido pelo Google (veio direto do Google, por TLS). */
export function emailFromIdToken(idToken?: string): string | null {
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(idToken!.split(".")[1])));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64urlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))));
}

export interface OAuthState {
  sellerId: string;
  userId: string;
  returnTo: string;
  /** expiração em ms */
  exp: number;
}

/** "state" assinado: o retorno do Google só vale para quem pediu, por 10 minutos. */
export async function signState(state: OAuthState, secret: string): Promise<string> {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(state)));
  return `${body}.${await hmac(secret, body)}`;
}

export async function verifyState(token: string, secret: string, now = Date.now()): Promise<OAuthState | null> {
  const [body, sig] = (token || "").split(".");
  if (!body || !sig) return null;
  const expected = await hmac(secret, body);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const state = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as OAuthState;
    if (typeof state.exp !== "number" || state.exp < now) return null;
    return state;
  } catch {
    return null;
  }
}

/** Volta só para endereço http(s) válido; http só em localhost (testes locais). */
export function safeReturnTo(raw: unknown, fallback: string): string {
  try {
    const u = new URL(String(raw));
    if (u.protocol === "https:" || (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))) return u.toString();
  } catch {
    // ignora
  }
  return fallback;
}

export function withQuery(url: string, params: Record<string, string>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(fetchFn: FetchFn, params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || data.error) {
    throw new GoogleAuthError(data.error || `http_${res.status}`, data.error_description || data.error || `Google respondeu ${res.status}`);
  }
  return data;
}

export async function exchangeCode(fetchFn: FetchFn, o: { code: string; clientId: string; clientSecret: string; redirectUri: string; now?: number }) {
  const data = await tokenRequest(fetchFn, {
    code: o.code,
    client_id: o.clientId,
    client_secret: o.clientSecret,
    redirect_uri: o.redirectUri,
    grant_type: "authorization_code",
  });
  if (!data.refresh_token) throw new GoogleAuthError("no_refresh_token", "O Google não devolveu a autorização permanente. Tente conectar de novo.");
  if (!(data.scope ?? "").split(" ").includes(CALENDAR_SCOPE)) {
    throw new GoogleAuthError("scope_denied", "Permita o acesso à agenda na tela do Google para conectar.");
  }
  return {
    accessToken: data.access_token!,
    refreshToken: data.refresh_token,
    expiresAt: new Date((o.now ?? Date.now()) + (data.expires_in ?? 3600) * 1000).toISOString(),
    email: emailFromIdToken(data.id_token),
  };
}

export async function refreshAccessToken(fetchFn: FetchFn, o: { refreshToken: string; clientId: string; clientSecret: string; now?: number }) {
  const data = await tokenRequest(fetchFn, {
    refresh_token: o.refreshToken,
    client_id: o.clientId,
    client_secret: o.clientSecret,
    grant_type: "refresh_token",
  });
  return {
    accessToken: data.access_token!,
    expiresAt: new Date((o.now ?? Date.now()) + (data.expires_in ?? 3600) * 1000).toISOString(),
  };
}

export async function revokeToken(fetchFn: FetchFn, token: string): Promise<void> {
  await fetchFn(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }).catch(() => undefined);
}

// ── API do Google Agenda ──────────────────────────────────────────────────────

export class GoogleApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class GoogleCalendarApi {
  constructor(private fetchFn: FetchFn, private accessToken: string) {}

  private async request<T>(method: string, path: string, opts: { query?: Record<string, string>; body?: unknown } = {}): Promise<T> {
    const qs = opts.query && Object.keys(opts.query).length ? `?${new URLSearchParams(opts.query).toString()}` : "";
    const res = await this.fetchFn(`${CALENDAR_API}${path}${qs}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (data as { error?: { message?: string } })?.error?.message || `Google Agenda respondeu ${res.status}`;
      throw new GoogleApiError(res.status, message);
    }
    return data as T;
  }

  createCalendar(summary: string, description: string) {
    return this.request<{ id: string }>("POST", "/calendars", { body: { summary, description, timeZone: TIME_ZONE } });
  }

  async calendarExists(calendarId: string): Promise<boolean> {
    try {
      await this.request("GET", `/calendars/${encodeURIComponent(calendarId)}`);
      return true;
    } catch (e) {
      if (e instanceof GoogleApiError && [403, 404, 410].includes(e.status)) return false;
      throw e;
    }
  }

  insertEvent(calendarId: string, body: Record<string, unknown>) {
    return this.request<GoogleEvent>("POST", `/calendars/${encodeURIComponent(calendarId)}/events`, { body });
  }

  /** null quando o evento não existe mais no Google. */
  async patchEvent(calendarId: string, eventId: string, body: Record<string, unknown>): Promise<GoogleEvent | null> {
    try {
      return await this.request<GoogleEvent>("PATCH", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { body });
    } catch (e) {
      if (e instanceof GoogleApiError && (e.status === 404 || e.status === 410)) return null;
      throw e;
    }
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      await this.request("DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
    } catch (e) {
      if (e instanceof GoogleApiError && (e.status === 404 || e.status === 410)) return;
      throw e;
    }
  }

  listEvents(calendarId: string, o: { syncToken?: string | null; pageToken?: string | null }) {
    const query: Record<string, string> = { maxResults: "250", showDeleted: "true" };
    if (o.syncToken) query.syncToken = o.syncToken;
    if (o.pageToken) query.pageToken = o.pageToken;
    return this.request<{ items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }>(
      "GET", `/calendars/${encodeURIComponent(calendarId)}/events`, { query },
    );
  }
}

// ── Rodada de sincronização de uma conexão ────────────────────────────────────

export interface ConnectionRow {
  seller_id: string;
  calendar_id: string | null;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
  sync_token: string | null;
}

export interface OutboxRow { id: number; follow_up_id: string; op: "upsert" | "delete"; attempts: number }
export interface LinkRow { seller_id: string; follow_up_id: string; calendar_id: string; google_event_id: string; etag: string | null }

export interface SyncStore {
  saveAccessToken(sellerId: string, accessToken: string, expiresAt: string): Promise<void>;
  pendingOutbox(sellerId: string): Promise<OutboxRow[]>;
  followUps(ids: string[]): Promise<FollowUpRow[]>;
  links(sellerId: string, followUpIds: string[]): Promise<LinkRow[]>;
  saveLink(link: LinkRow): Promise<void>;
  deleteLink(sellerId: string, followUpId: string): Promise<void>;
  deleteOutbox(ids: number[]): Promise<void>;
  /** Conta a tentativa; o item fica para a próxima rodada (a loja descarta após várias falhas). */
  failOutbox(item: OutboxRow, error: string): Promise<void>;
  applyEvent(sellerId: string, calendarId: string, ev: GoogleEvent, parsed: ParsedEvent): Promise<string>;
  finish(sellerId: string, patch: { status: "active" | "error" | "revoked"; last_error: string | null; sync_token?: string | null }): Promise<void>;
}

export interface SyncResult {
  sellerId: string;
  status: "active" | "error" | "revoked";
  pushed: number;
  removed: number;
  pulled: Record<string, number>;
  error?: string;
}

const REVOKED_MESSAGE = "A autorização do Google expirou ou foi removida. Conecte o Google Agenda de novo.";

/**
 * Uma rodada para um vendedor: renova o acesso, manda a fila do CRM para o
 * Google e depois traz o que mudou no Google (sincronização incremental).
 * O CRM vai primeiro: se os dois lados mudaram o mesmo compromisso, vale o CRM.
 */
export async function syncConnection(
  conn: ConnectionRow,
  deps: { store: SyncStore; fetchFn: FetchFn; clientId: string; clientSecret: string; now?: number },
): Promise<SyncResult> {
  const { store } = deps;
  const now = deps.now ?? Date.now();
  const result: SyncResult = { sellerId: conn.seller_id, status: "active", pushed: 0, removed: 0, pulled: {} };

  const fail = async (status: "error" | "revoked", message: string) => {
    result.status = status;
    result.error = message;
    await store.finish(conn.seller_id, { status, last_error: message });
    return result;
  };

  if (!conn.calendar_id) return fail("error", "Conexão sem agenda. Conecte o Google Agenda de novo.");
  const calendarId = conn.calendar_id;

  // 1) Acesso
  let accessToken = conn.access_token;
  if (!accessToken || !conn.access_token_expires_at || new Date(conn.access_token_expires_at).getTime() < now + 60_000) {
    try {
      const fresh = await refreshAccessToken(deps.fetchFn, { refreshToken: conn.refresh_token, clientId: deps.clientId, clientSecret: deps.clientSecret, now });
      accessToken = fresh.accessToken;
      await store.saveAccessToken(conn.seller_id, fresh.accessToken, fresh.expiresAt);
    } catch (e) {
      if (e instanceof GoogleAuthError && e.code === "invalid_grant") return fail("revoked", REVOKED_MESSAGE);
      return fail("error", `Falha ao renovar o acesso ao Google: ${(e as Error).message}`);
    }
  }
  const api = new GoogleCalendarApi(deps.fetchFn, accessToken!);

  try {
    // 2) CRM → Google
    let outboxError: string | null = null;
    const outbox = await store.pendingOutbox(conn.seller_id);
    if (outbox.length) {
      const ids = [...new Set(outbox.map((o) => o.follow_up_id))];
      const [rows, links] = await Promise.all([store.followUps(ids), store.links(conn.seller_id, ids)]);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const linkById = new Map(links.map((l) => [l.follow_up_id, l]));
      const done: number[] = [];
      for (const item of outbox) {
        try {
          const link = linkById.get(item.follow_up_id);
          const sameCalendar = link && link.calendar_id === calendarId;
          if (item.op === "delete") {
            if (link) {
              if (sameCalendar) await api.deleteEvent(calendarId, link.google_event_id);
              await store.deleteLink(conn.seller_id, item.follow_up_id);
              result.removed++;
            }
          } else {
            const f = byId.get(item.follow_up_id);
            if (f && f.assigned_to === conn.seller_id) {
              const body = eventBodyFromFollowUp(f);
              let ev = sameCalendar ? await api.patchEvent(calendarId, link!.google_event_id, body) : null;
              if (!ev) ev = await api.insertEvent(calendarId, body);
              await store.saveLink({ seller_id: conn.seller_id, follow_up_id: f.id, calendar_id: calendarId, google_event_id: ev.id, etag: ev.etag ?? null });
              result.pushed++;
            }
          }
          done.push(item.id);
        } catch (e) {
          if (e instanceof GoogleApiError && e.status === 401) throw e;
          outboxError = `Não foi possível enviar um compromisso ao Google: ${(e as Error).message}`;
          await store.failOutbox(item, (e as Error).message);
        }
      }
      if (done.length) await store.deleteOutbox(done);
    }

    // 3) Google → CRM
    let syncToken = conn.sync_token;
    let restarted = false;
    let pageToken: string | null = null;
    let nextSyncToken: string | null = null;
    for (;;) {
      let page;
      try {
        page = await api.listEvents(calendarId, { syncToken, pageToken });
      } catch (e) {
        // Token de sincronização vencido: lista tudo de novo (os vínculos evitam duplicar).
        if (e instanceof GoogleApiError && e.status === 410 && !restarted) {
          restarted = true;
          syncToken = null;
          pageToken = null;
          continue;
        }
        throw e;
      }
      for (const ev of page.items ?? []) {
        const parsed = parseEvent(ev);
        if (!parsed) {
          result.pulled.ignored = (result.pulled.ignored ?? 0) + 1;
          continue;
        }
        const outcome = await store.applyEvent(conn.seller_id, calendarId, ev, parsed);
        result.pulled[outcome] = (result.pulled[outcome] ?? 0) + 1;
      }
      if (page.nextPageToken) {
        pageToken = page.nextPageToken;
        continue;
      }
      nextSyncToken = page.nextSyncToken ?? null;
      break;
    }

    await store.finish(conn.seller_id, { status: "active", last_error: outboxError, sync_token: nextSyncToken ?? syncToken });
    return result;
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 401) return fail("error", "O Google recusou o acesso. Se continuar, conecte o Google Agenda de novo.");
    if (e instanceof GoogleApiError && e.status === 404) return fail("error", "A agenda \"CRM Taeco\" não foi encontrada no Google (foi apagada?). Conecte de novo para criar outra.");
    return fail("error", `Falha ao sincronizar com o Google: ${(e as Error).message}`);
  }
}
