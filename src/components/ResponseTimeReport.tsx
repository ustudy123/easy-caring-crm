import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";
import { exportToCsv } from "@/lib/exportCsv";
import { Timer, Download, Loader2, ChevronDown, ChevronRight } from "lucide-react";

interface SellerRow { id: string; name: string; store_id: string | null; is_active: boolean | null; }
interface ClientRow {
  assigned_seller_id: string | null;
  name: string | null;
  phone: string | null;
  last_message_from_client_at: string | null;
  last_seller_response_at: string | null;
  hidden_at: string | null;
}

interface ClientStat {
  name: string;
  respondeu: boolean;
  aguardando: boolean;
  respostaMin: number | null; // tempo que levou para responder
  esperaMin: number | null;   // tempo esperando agora (sem resposta)
}
interface SellerStat {
  id: string;
  name: string;
  clientes: number;      // clientes com troca de mensagem
  aguardando: number;    // sem resposta desde a última msg do cliente
  respondidos: number;
  mediaRespostaMin: number | null;
  piorEsperaMin: number | null;
  detalhe: ClientStat[];
}

const fmt = (min: number | null): string => {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)}min`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}h ${Math.round(min % 60)}min`;
  const d = Math.floor(min / (60 * 24));
  return `${d}d ${Math.floor((min % (60 * 24)) / 60)}h`;
};

export function ResponseTimeReport() {
  const { isAdmin, isGerente, storeId } = useRole();
  const restrictToStore = isGerente && !isAdmin && !!storeId;
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sRes, cRes] = await Promise.all([
        supabase.from("sellers").select("id, name, store_id, is_active"),
        supabase.from("clients").select("assigned_seller_id, name, phone, last_message_from_client_at, last_seller_response_at, hidden_at"),
      ]);
      setSellers((sRes.data as any) || []);
      setClients((cRes.data as any) || []);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo<SellerStat[]>(() => {
    const now = Date.now();
    const bySeller = new Map<string, ClientRow[]>();
    for (const c of clients) {
      if (c.hidden_at || !c.assigned_seller_id || !c.last_message_from_client_at) continue;
      const arr = bySeller.get(c.assigned_seller_id) || [];
      arr.push(c); bySeller.set(c.assigned_seller_id, arr);
    }

    return sellers
      .filter((s) => s.is_active !== false)
      .filter((s) => !restrictToStore || s.store_id === storeId)
      .map((s) => {
        const list = bySeller.get(s.id) || [];
        const detalhe: ClientStat[] = list.map((c) => {
          const cliMs = c.last_message_from_client_at ? new Date(c.last_message_from_client_at).getTime() : null;
          const respMs = c.last_seller_response_at ? new Date(c.last_seller_response_at).getTime() : null;
          const respondeu = !!(cliMs && respMs && respMs >= cliMs);
          const aguardando = !!(cliMs && (!respMs || respMs < cliMs));
          return {
            name: c.name || c.phone || "—",
            respondeu,
            aguardando,
            respostaMin: respondeu && cliMs && respMs ? (respMs - cliMs) / 60000 : null,
            esperaMin: aguardando && cliMs ? (now - cliMs) / 60000 : null,
          };
        }).sort((a, b) => (b.esperaMin ?? -1) - (a.esperaMin ?? -1));

        const respostas = detalhe.map((d) => d.respostaMin).filter((x): x is number => x != null);
        const esperas = detalhe.map((d) => d.esperaMin).filter((x): x is number => x != null);
        return {
          id: s.id, name: s.name,
          clientes: detalhe.length,
          aguardando: detalhe.filter((d) => d.aguardando).length,
          respondidos: respostas.length,
          mediaRespostaMin: respostas.length ? respostas.reduce((a, b) => a + b, 0) / respostas.length : null,
          piorEsperaMin: esperas.length ? Math.max(...esperas) : null,
          detalhe,
        };
      })
      .filter((r) => r.clientes > 0)
      .sort((a, b) => (b.aguardando - a.aguardando) || ((b.piorEsperaMin ?? -1) - (a.piorEsperaMin ?? -1)));
  }, [sellers, clients, restrictToStore, storeId]);

  const handleExport = () => {
    exportToCsv(rows, [
      { key: "vendedor", label: "Vendedor", format: (r) => r.name },
      { key: "clientes", label: "Clientes", format: (r) => String(r.clientes) },
      { key: "aguardando", label: "Aguardando resposta", format: (r) => String(r.aguardando) },
      { key: "respondidos", label: "Respondidos", format: (r) => String(r.respondidos) },
      { key: "media", label: "Tempo médio de resposta", format: (r) => fmt(r.mediaRespostaMin) },
      { key: "pior", label: "Pior espera atual", format: (r) => fmt(r.piorEsperaMin) },
    ], "atraso_resposta_por_vendedor");
  };

  return (
    <div className="rounded-3xl overflow-hidden bg-card border border-border/60 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
            <Timer className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-500">Atendimento</p>
            <h3 className="text-lg font-black text-foreground">Atraso de resposta por vendedor</h3>
          </div>
        </div>
        <button onClick={handleExport} disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-40">
          <Download className="h-3.5 w-3.5" /> Exportar Excel (CSV)
        </button>
      </div>

      <div className="p-5">
        {loading ? (
          <div className="py-8 flex items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…</div>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                  <th className="py-2 font-semibold">Vendedor</th>
                  <th className="py-2 font-semibold text-right">Clientes</th>
                  <th className="py-2 font-semibold text-right">Aguardando</th>
                  <th className="py-2 font-semibold text-right">Tempo médio resposta</th>
                  <th className="py-2 font-semibold text-right">Pior espera atual</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sem dados de resposta ainda.</td></tr>
                )}
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr className="border-b border-border/30 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setExpanded((e) => ({ ...e, [r.id]: !e[r.id] }))}>
                      <td className="py-2.5 font-medium text-foreground uppercase">
                        <span className="inline-flex items-center gap-1">
                          {expanded[r.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          {r.name}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{r.clientes}</td>
                      <td className="py-2.5 text-right tabular-nums font-semibold">
                        {r.aguardando > 0 ? <span className="text-red-600">{r.aguardando}</span> : <span className="text-emerald-600">0</span>}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{fmt(r.mediaRespostaMin)}</td>
                      <td className="py-2.5 text-right tabular-nums">{r.piorEsperaMin != null && r.piorEsperaMin >= 30 ? <span className="text-red-600 font-semibold">{fmt(r.piorEsperaMin)}</span> : fmt(r.piorEsperaMin)}</td>
                    </tr>
                    {expanded[r.id] && r.detalhe.map((c, i) => (
                      <tr key={`${r.id}-${i}`} className="border-b border-border/20 bg-muted/20">
                        <td className="py-1.5 pl-6 text-xs text-muted-foreground uppercase">{c.name}</td>
                        <td className="py-1.5" colSpan={2}>
                          {c.aguardando
                            ? <span className="text-[11px] font-medium text-red-600">Aguardando há {fmt(c.esperaMin)}</span>
                            : <span className="text-[11px] text-emerald-600">Respondido</span>}
                        </td>
                        <td className="py-1.5 text-right text-xs" colSpan={2}>
                          {c.respondeu ? <span className="text-muted-foreground">Respondeu em {fmt(c.respostaMin)}</span> : ""}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-muted-foreground">
              "Aguardando" = clientes sem resposta desde a última mensagem deles. "Tempo médio de resposta" considera
              as respostas já registradas (pelo CRM ou pelo celular, após o ajuste do webhook).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
