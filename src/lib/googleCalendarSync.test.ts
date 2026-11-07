import { describe, expect, it, vi } from "vitest";
import {
  CALENDAR_SCOPE, buildAuthUrl, eventBodyFromFollowUp, exchangeCode, parseEvent, safeReturnTo, signState,
  syncConnection, verifyState, type ConnectionRow, type FollowUpRow, type GoogleEvent, type LinkRow,
  type OutboxRow, type ParsedEvent, type SyncStore,
} from "../../supabase/functions/_shared/googleCalendar";

const followUp = (o: Partial<FollowUpRow> = {}): FollowUpRow => ({
  id: "fu-1", client_name: "SERCON", client_phone: "(21) 99999-0000", scheduled_at: "2026-11-10T13:00:00.000Z",
  description: "Levar catálogo", completed: false, type: "visit", assigned_to: "ana", ...o,
});

describe("evento ⇄ compromisso", () => {
  it("escreve o compromisso no Google e lê de volta igual", () => {
    const body = eventBodyFromFollowUp(followUp({ completed: true }));
    expect(body.summary).toBe("✓ Visita: SERCON");
    expect(body.description).toBe("Levar catálogo\nTelefone: (21) 99999-0000\n— Sincronizado pelo CRM Taeco");
    expect(body.start).toEqual({ dateTime: "2026-11-10T13:00:00.000Z", timeZone: "America/Sao_Paulo" });
    expect(body.end).toEqual({ dateTime: "2026-11-10T14:00:00.000Z", timeZone: "America/Sao_Paulo" });
    expect(body.extendedProperties).toEqual({ private: { crmFollowUpId: "fu-1" } });

    const back = parseEvent({ id: "ev", ...(body as Omit<GoogleEvent, "id">) });
    expect(back).toEqual({
      cancelled: false, clientName: "SERCON", type: "visit", completed: true, description: "Levar catálogo",
      scheduledAt: "2026-11-10T13:00:00.000Z", crmFollowUpId: "fu-1",
    });
    expect(eventBodyFromFollowUp(followUp({ type: "call" })).end).toEqual({ dateTime: "2026-11-10T13:30:00.000Z", timeZone: "America/Sao_Paulo" });
  });

  it("lê evento criado no Google: sem tipo, dia inteiro às 9h e descrição em HTML", () => {
    expect(parseEvent({ id: "x", summary: "Reunião na obra", start: { date: "2026-11-12" }, description: "Portão<br>2&nbsp;&amp; 3" }))
      .toEqual({
        cancelled: false, clientName: "Reunião na obra", type: null, completed: false, description: "Portão\n2 & 3",
        scheduledAt: "2026-11-12T12:00:00.000Z", crmFollowUpId: null,
      });
  });

  it("marca cancelado e ignora eventos repetidos", () => {
    expect(parseEvent({ id: "x", status: "cancelled", extendedProperties: { private: { crmFollowUpId: "fu-9" } } }))
      .toMatchObject({ cancelled: true, crmFollowUpId: "fu-9" });
    expect(parseEvent({ id: "x", summary: "Toda segunda", recurrence: ["RRULE:FREQ=WEEKLY"], start: { dateTime: "2026-11-09T12:00:00Z" } })).toBeNull();
    expect(parseEvent({ id: "x_20261116", summary: "Toda segunda", recurringEventId: "x", start: { dateTime: "2026-11-16T12:00:00Z" } })).toBeNull();
  });
});

describe("OAuth", () => {
  it("assina o state e recusa alterado ou vencido", async () => {
    const state = { sellerId: "ana", userId: "u1", returnTo: "https://crm.example/agenda", exp: 2_000 };
    const token = await signState(state, "segredo");
    expect(await verifyState(token, "segredo", 1_000)).toEqual(state);
    expect(await verifyState(token, "segredo", 3_000)).toBeNull();
    expect(await verifyState(token, "outro", 1_000)).toBeNull();
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...state, sellerId: "bruno" })).toString("base64url");
    expect(await verifyState(`${forged}.${sig}`, "segredo", 1_000)).toBeNull();
    expect(body).not.toBe(forged);
  });

  it("pede acesso offline só à agenda criada pelo app", () => {
    const url = new URL(buildAuthUrl({ clientId: "cid", redirectUri: "https://x.supabase.co/functions/v1/google-calendar-auth", state: "s" }));
    expect(url.searchParams.get("scope")).toBe(`openid email ${CALENDAR_SCOPE}`);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("só volta para endereço https (ou localhost)", () => {
    expect(safeReturnTo("https://crm.example/agenda", "/x")).toBe("https://crm.example/agenda");
    expect(safeReturnTo("http://localhost:5173/agenda", "/x")).toBe("http://localhost:5173/agenda");
    expect(safeReturnTo("javascript:alert(1)", "https://f/")).toBe("https://f/");
    expect(safeReturnTo("http://evil.example", "https://f/")).toBe("https://f/");
  });

  it("recusa quando a pessoa desmarca a agenda na tela do Google", async () => {
    const reply = (scope: string) => vi.fn(async () => new Response(JSON.stringify({
      access_token: "at", refresh_token: "rt", expires_in: 3600, scope,
      id_token: `h.${Buffer.from(JSON.stringify({ email: "agenda@gmail.com" })).toString("base64url")}.s`,
    })));
    await expect(exchangeCode(reply("openid email"), { code: "c", clientId: "i", clientSecret: "s", redirectUri: "r" }))
      .rejects.toMatchObject({ code: "scope_denied" });
    const ok = await exchangeCode(reply(`openid email ${CALENDAR_SCOPE}`), { code: "c", clientId: "i", clientSecret: "s", redirectUri: "r", now: 0 });
    expect(ok).toEqual({ accessToken: "at", refreshToken: "rt", expiresAt: new Date(3_600_000).toISOString(), email: "agenda@gmail.com" });
  });
});

// ── rodada de sincronização contra um Google simulado ─────────────────────────

function fakeGoogle(o: { events?: GoogleEvent[]; tokenError?: string; failInsertFor?: string; expiredSyncToken?: string } = {}) {
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  let n = 0;
  const fetchFn = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const method = init?.method ?? "GET";
    const body = init?.body && typeof init.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: url.pathname + (url.search || ""), body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
    if (url.host === "oauth2.googleapis.com") {
      return o.tokenError ? json({ error: o.tokenError }, 400) : json({ access_token: "novo", expires_in: 3600 });
    }
    if (method === "POST" && url.pathname.endsWith("/events")) {
      if (o.failInsertFor && body?.summary?.includes(o.failInsertFor)) return json({ error: { message: "Backend Error" } }, 500);
      n++;
      return json({ id: `ev-${n}`, etag: `"e-${n}"` });
    }
    if (method === "PATCH") {
      if (url.pathname.endsWith("/sumiu")) return json({ error: { message: "Not Found" } }, 404);
      return json({ id: url.pathname.split("/").pop(), etag: '"patched"' });
    }
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (method === "GET" && url.pathname.endsWith("/events")) {
      if (o.expiredSyncToken && url.searchParams.get("syncToken") === o.expiredSyncToken) return json({ error: { message: "Gone" } }, 410);
      if (!url.searchParams.get("pageToken") && (o.events?.length ?? 0) > 1) {
        return json({ items: o.events!.slice(0, 1), nextPageToken: "p2" });
      }
      return json({ items: url.searchParams.get("pageToken") ? o.events!.slice(1) : o.events ?? [], nextSyncToken: "sync-2" });
    }
    return json({ error: { message: `rota inesperada ${method} ${url.pathname}` } }, 500);
  });
  return { fetchFn, calls };
}

function fakeStore(o: { outbox?: OutboxRow[]; followUps?: FollowUpRow[]; links?: LinkRow[] } = {}) {
  const state = {
    outbox: [...(o.outbox ?? [])],
    links: [...(o.links ?? [])],
    failed: [] as { id: number; error: string }[],
    applied: [] as { ev: GoogleEvent; parsed: ParsedEvent }[],
    finished: [] as { status: string; last_error: string | null; sync_token?: string | null }[],
    tokens: [] as string[],
  };
  const store: SyncStore = {
    saveAccessToken: async (_s, t) => { state.tokens.push(t); },
    pendingOutbox: async () => state.outbox,
    followUps: async (ids) => (o.followUps ?? []).filter((f) => ids.includes(f.id)),
    links: async (_s, ids) => state.links.filter((l) => ids.includes(l.follow_up_id)),
    saveLink: async (l) => { state.links = [...state.links.filter((x) => x.follow_up_id !== l.follow_up_id), l]; },
    deleteLink: async (_s, id) => { state.links = state.links.filter((x) => x.follow_up_id !== id); },
    deleteOutbox: async (ids) => { state.outbox = state.outbox.filter((x) => !ids.includes(x.id)); },
    failOutbox: async (item, error) => { state.failed.push({ id: item.id, error }); },
    applyEvent: async (_s, _c, ev, parsed) => { state.applied.push({ ev, parsed }); return parsed.cancelled ? "deleted" : "created"; },
    finish: async (_s, patch) => { state.finished.push(patch); },
  };
  return { store, state };
}

const conn = (o: Partial<ConnectionRow> = {}): ConnectionRow => ({
  seller_id: "ana", calendar_id: "calA", refresh_token: "rt", access_token: "at",
  access_token_expires_at: new Date(10_000_000).toISOString(), sync_token: "sync-1", ...o,
});
const deps = (fetchFn: ReturnType<typeof fakeGoogle>["fetchFn"], store: SyncStore) => ({ store, fetchFn, clientId: "cid", clientSecret: "sec", now: 0 });

describe("syncConnection", () => {
  it("manda a fila para o Google: cria, atualiza, recria o que sumiu e apaga", async () => {
    const g = fakeGoogle();
    const { store, state } = fakeStore({
      outbox: [
        { id: 1, follow_up_id: "novo", op: "upsert", attempts: 0 },
        { id: 2, follow_up_id: "existente", op: "upsert", attempts: 0 },
        { id: 3, follow_up_id: "apagado-no-google", op: "upsert", attempts: 0 },
        { id: 4, follow_up_id: "removido", op: "delete", attempts: 0 },
        { id: 5, follow_up_id: "de-outro", op: "upsert", attempts: 0 },
      ],
      followUps: [
        followUp({ id: "novo" }), followUp({ id: "existente", client_name: "Existente" }),
        followUp({ id: "apagado-no-google" }), followUp({ id: "de-outro", assigned_to: "bruno" }),
      ],
      links: [
        { seller_id: "ana", follow_up_id: "existente", calendar_id: "calA", google_event_id: "ev-x", etag: '"old"' },
        { seller_id: "ana", follow_up_id: "apagado-no-google", calendar_id: "calA", google_event_id: "sumiu", etag: '"old"' },
        { seller_id: "ana", follow_up_id: "removido", calendar_id: "calA", google_event_id: "ev-del", etag: '"old"' },
      ],
    });
    const r = await syncConnection(conn(), deps(g.fetchFn, store));
    expect(r).toMatchObject({ status: "active", pushed: 3, removed: 1 });
    expect(g.calls.filter((c) => c.method !== "GET").map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /calendar/v3/calendars/calA/events",
      "PATCH /calendar/v3/calendars/calA/events/ev-x",
      "PATCH /calendar/v3/calendars/calA/events/sumiu",
      "POST /calendar/v3/calendars/calA/events",
      "DELETE /calendar/v3/calendars/calA/events/ev-del",
    ]);
    expect(state.outbox).toEqual([]);
    expect(state.links.map((l) => `${l.follow_up_id}=${l.google_event_id}:${l.etag}`).sort()).toEqual([
      'apagado-no-google=ev-2:"e-2"', 'existente=ev-x:"patched"', 'novo=ev-1:"e-1"',
    ]);
    expect(state.finished).toEqual([{ status: "active", last_error: null, sync_token: "sync-2" }]);
  });

  it("traz as mudanças do Google página a página e guarda o novo token", async () => {
    const events: GoogleEvent[] = [
      { id: "a", etag: '"1"', summary: "Visita: Nova", start: { dateTime: "2026-11-10T13:00:00Z" } },
      { id: "b", status: "cancelled" },
      { id: "c", summary: "Semanal", recurrence: ["RRULE:FREQ=WEEKLY"], start: { dateTime: "2026-11-10T13:00:00Z" } },
    ];
    const g = fakeGoogle({ events });
    const { store, state } = fakeStore();
    const r = await syncConnection(conn(), deps(g.fetchFn, store));
    expect(state.applied.map((a) => a.ev.id)).toEqual(["a", "b"]);
    expect(r.pulled).toEqual({ created: 1, deleted: 1, ignored: 1 });
    expect(g.calls.filter((c) => c.method === "GET").map((c) => new URL(`https://x${c.path}`).searchParams.get("syncToken"))).toEqual(["sync-1", "sync-1"]);
    expect(state.finished.at(-1)).toMatchObject({ sync_token: "sync-2" });
  });

  it("refaz a lista completa quando o token de sincronização venceu", async () => {
    const g = fakeGoogle({ events: [{ id: "a", summary: "X", start: { dateTime: "2026-11-10T13:00:00Z" } }], expiredSyncToken: "sync-1" });
    const { store, state } = fakeStore();
    await syncConnection(conn(), deps(g.fetchFn, store));
    const tokens = g.calls.filter((c) => c.method === "GET").map((c) => new URL(`https://x${c.path}`).searchParams.get("syncToken"));
    expect(tokens).toEqual(["sync-1", null]);
    expect(state.finished.at(-1)).toMatchObject({ status: "active", sync_token: "sync-2" });
  });

  it("renova o acesso vencido e marca revogado quando o Google recusa a autorização", async () => {
    const ok = fakeGoogle();
    const s1 = fakeStore();
    await syncConnection(conn({ access_token_expires_at: new Date(30_000).toISOString() }), deps(ok.fetchFn, s1.store));
    expect(s1.state.tokens).toEqual(["novo"]);

    const revoked = fakeGoogle({ tokenError: "invalid_grant" });
    const s2 = fakeStore();
    const r = await syncConnection(conn({ access_token: null }), deps(revoked.fetchFn, s2.store));
    expect(r.status).toBe("revoked");
    expect(s2.state.finished).toEqual([{ status: "revoked", last_error: expect.stringMatching(/Conecte o Google Agenda de novo/) }]);
    expect(revoked.calls.some((c) => c.path.includes("/calendar/"))).toBe(false);
  });

  it("segue a fila quando um compromisso falha e deixa ele para a próxima rodada", async () => {
    const g = fakeGoogle({ failInsertFor: "Falha" });
    const { store, state } = fakeStore({
      outbox: [{ id: 1, follow_up_id: "f1", op: "upsert", attempts: 0 }, { id: 2, follow_up_id: "f2", op: "upsert", attempts: 0 }],
      followUps: [followUp({ id: "f1", client_name: "Falha" }), followUp({ id: "f2", client_name: "Ok" })],
    });
    const r = await syncConnection(conn(), deps(g.fetchFn, store));
    expect(r.pushed).toBe(1);
    expect(state.outbox.map((o) => o.id)).toEqual([1]);
    expect(state.failed).toEqual([{ id: 1, error: "Backend Error" }]);
    expect(state.finished.at(-1)).toMatchObject({ status: "active", last_error: expect.stringMatching(/Não foi possível enviar/) });
  });
});
