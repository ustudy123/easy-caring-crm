/* Supabase em memória para testes de tela: guarda as tabelas em `state.db`,
 * aplica filtros simples (eq, neq, in) e registra cada escrita em `state.calls`. */
type Row = Record<string, unknown>;

export interface MockCall { table: string; op: "insert" | "update" | "upsert" | "delete"; values?: unknown; filters?: string[]; onConflict?: string }

export interface SupabaseMockState {
  db: Record<string, Row[]>;
  calls: MockCall[];
  rpc?: Record<string, (args: Record<string, unknown>) => unknown>;
  invoke?: (fn: string, body: Record<string, unknown>) => unknown;
  invokes?: { fn: string; body: Record<string, unknown> }[];
  storage?: { op: string; bucket: string; path: string }[];
}

export function createSupabaseMock(state: SupabaseMockState) {
  const from = (table: string) => {
    const filters: ((r: Row) => boolean)[] = [];
    const described: string[] = [];
    let mode: "select" | "update" | "delete" = "select";
    let single = false;
    let updateValues: Row = {};
    const rows = () => (state.db[table] ?? []).filter((r) => filters.every((f) => f(r)));
    const run = () => {
      if (mode === "delete") {
        state.calls.push({ table, op: "delete", filters: described });
        const keep = (state.db[table] ?? []).filter((r) => !filters.every((f) => f(r)));
        state.db[table] = keep;
        return { data: null, error: null };
      }
      if (mode === "update") {
        state.calls.push({ table, op: "update", values: updateValues, filters: described });
        state.db[table] = (state.db[table] ?? []).map((r) => (filters.every((f) => f(r)) ? { ...r, ...updateValues } : r));
        return { data: rows(), error: null };
      }
      const data = rows();
      return { data: single ? (data[0] ?? null) : data, error: null };
    };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); described.push(`${c}=${String(v)}`); return builder; },
      neq: (c: string, v: unknown) => { filters.push((r) => r[c] !== v); described.push(`${c}!=${String(v)}`); return builder; },
      in: (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); described.push(`${c} in ${vs.join(",")}`); return builder; },
      or: () => builder,
      not: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => { single = true; return builder; },
      single: () => { single = true; return builder; },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
      update: (values: Row) => { mode = "update"; updateValues = values; return builder; },
      delete: () => { mode = "delete"; return builder; },
      insert: (values: Row | Row[]) => {
        const list = Array.isArray(values) ? values : [values];
        state.calls.push({ table, op: "insert", values });
        const saved = list.map((v) => ({ id: v.id ?? `new-${state.calls.length}`, ...v }));
        state.db[table] = [...(state.db[table] ?? []), ...saved];
        const result = { data: Array.isArray(values) ? saved : saved[0], error: null };
        const chain: Record<string, unknown> = {
          select: () => chain,
          single: () => chain,
          then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
        };
        return chain;
      },
      upsert: (values: Row | Row[], opts?: { onConflict?: string }) => {
        state.calls.push({ table, op: "upsert", values, onConflict: opts?.onConflict });
        const keys = (opts?.onConflict ?? "id").split(",");
        for (const v of Array.isArray(values) ? values : [values]) {
          const same = (r: Row) => keys.every((k) => r[k] === v[k]);
          state.db[table] = [...(state.db[table] ?? []).filter((r) => !same(r)), v];
        }
        return Promise.resolve({ error: null });
      },
    };
    return builder;
  };

  const rpc = (fn: string, args: Record<string, unknown>) =>
    Promise.resolve({ data: state.rpc?.[fn]?.(args) ?? [], error: null });

  const functions = {
    invoke: (fn: string, { body }: { body: Record<string, unknown> }) => {
      state.invokes?.push({ fn, body });
      return Promise.resolve({ data: state.invoke?.(fn, body) ?? {}, error: null });
    },
  };

  const storage = {
    from: (bucket: string) => ({
      upload: (path: string) => { state.storage?.push({ op: "upload", bucket, path }); return Promise.resolve({ data: { path }, error: null }); },
      remove: (paths: string[]) => { paths.forEach((path) => state.storage?.push({ op: "remove", bucket, path })); return Promise.resolve({ data: null, error: null }); },
      createSignedUrl: (path: string) => Promise.resolve({ data: { signedUrl: `https://signed/${bucket}/${path}` }, error: null }),
    }),
  };

  return { from, rpc, functions, storage };
}
