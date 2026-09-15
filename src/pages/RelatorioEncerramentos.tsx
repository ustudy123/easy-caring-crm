import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { startOfWeek, startOfMonth } from "date-fns";
import { Loader2, MessageCircle, ClipboardList } from "lucide-react";

import { LOST_REASONS, VENDA_CONCLUIDA } from "@/types/crm";
const PERIODS = [
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "all", label: "Tudo" },
];

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function sinceISO(period: string): string | null {
  const now = new Date();
  if (period === "week") return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  if (period === "month") return startOfMonth(now).toISOString();
  return null;
}

interface Row {
  id: string;
  clientName: string;
  clientPhone: string;
  sellerName: string;
  sellerId: string | null;
  motivo: string;
  isWin: boolean;
  value: number;
  closedAt: string | null;
}

export default function RelatorioEncerramentos() {
  const navigate = useNavigate();
  const { isAdmin, isGerente, storeId } = useRole();
  const restrictToStore = isGerente && !isAdmin && !!storeId;
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [motivoFilter, setMotivoFilter] = useState("todos");
  const [sellerFilter, setSellerFilter] = useState("todos");
  const [rows, setRows] = useState<Row[]>([]);
  const [sellers, setSellers] = useState<{ id: string; name: string; store_id?: string | null }[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const since = sinceISO(period);
        let q = supabase
          .from("leads")
          .select("id, client_name, client_phone, assigned_to, stage, lost_reason, value, closed_at")
          .in("stage", ["perdido", "pos_venda"]);
        if (since) q = q.gte("closed_at", since);
        const [leadsRes, sellersRes] = await Promise.all([
          q.order("closed_at", { ascending: false }),
          supabase.from("sellers").select("id, name, store_id"),
        ]);
        if (cancel) return;

        const sellerById = new Map<string, string>();
        for (const s of sellersRes.data || []) sellerById.set(s.id, s.name);
        setSellers((sellersRes.data || []).map((s: any) => ({ id: s.id, name: s.name, store_id: s.store_id })));

        const mapped: Row[] = (leadsRes.data || []).map((l: any) => {
          const isWin = l.stage === "pos_venda";
          return {
            id: l.id,
            clientName: l.client_name || l.client_phone || "—",
            clientPhone: l.client_phone || "",
            sellerName: sellerById.get(l.assigned_to) || "Sem vendedor",
            sellerId: l.assigned_to || null,
            motivo: isWin ? VENDA_CONCLUIDA : (l.lost_reason || "Sem motivo informado"),
            isWin,
            value: Number(l.value) || 0,
            closedAt: l.closed_at || null,
          };
        });
        setRows(mapped);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [period]);

  // Todos os motivos oficiais + os que aparecem nos dados (cobre encerramentos
  // antigos, feitos com motivos que já foram renomeados/removidos).
  const motivos = useMemo(() => {
    const oficiais = [VENDA_CONCLUIDA, ...LOST_REASONS];
    const nosDados = rows.map((r) => r.motivo);
    return Array.from(new Set([...oficiais, ...nosDados])).sort();
  }, [rows]);

  const visibleSellers = restrictToStore ? sellers.filter((s) => s.store_id === storeId) : sellers;

  const filtered = useMemo(() => {
    const myIds = restrictToStore ? new Set(sellers.filter((s) => s.store_id === storeId).map((s) => s.id)) : null;
    return rows.filter(
      (r) =>
        (myIds ? (r.sellerId != null && myIds.has(r.sellerId)) : true) &&
        (motivoFilter === "todos" || r.motivo === motivoFilter) &&
        (sellerFilter === "todos" || r.sellerName === sellerFilter)
    );
  }, [rows, motivoFilter, sellerFilter, restrictToStore, storeId, sellers]);

  const byMotivo = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.motivo, (m.get(r.motivo) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const wins = filtered.filter((r) => r.isWin);
  const losses = filtered.filter((r) => !r.isWin);

  return (
    <AppLayout title="Relatório de Encerramentos">
      <div className="space-y-5 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Encerramentos por motivo e vendedor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex gap-1 rounded-full bg-muted p-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${period === p.key ? "bg-brand-500 text-white" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Motivo</Label>
                <Select value={motivoFilter} onValueChange={setMotivoFilter}>
                  <SelectTrigger className="h-9 w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os motivos</SelectItem>
                    {motivos.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Vendedor</Label>
                <Select value={sellerFilter} onValueChange={setSellerFilter}>
                  <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os vendedores</SelectItem>
                    {visibleSellers.map((s) => (<SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Encerramentos</p><p className="text-2xl font-black">{filtered.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Vendas concluídas</p><p className="text-2xl font-black text-emerald-600">{wins.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Perdas</p><p className="text-2xl font-black text-red-600">{losses.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Valor concluído</p><p className="text-2xl font-black text-emerald-600">{brl(wins.reduce((t, r) => t + r.value, 0))}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Por motivo</CardTitle></CardHeader>
              <CardContent>
                {byMotivo.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum encerramento no período.</p>
                ) : (
                  <div className="space-y-2">
                    {byMotivo.map(([m, c]) => {
                      const share = filtered.length ? c / filtered.length : 0;
                      return (
                        <div key={m}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-foreground">{m}</span>
                            <span className="text-muted-foreground tabular-nums">{c} ({Math.round(share * 100)}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${m === VENDA_CONCLUIDA ? "bg-emerald-500" : "bg-brand-500"}`} style={{ width: `${Math.max(Math.round(share * 100), 2)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Detalhe ({filtered.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                        <th className="py-2 font-semibold">Cliente</th>
                        <th className="py-2 font-semibold">Vendedor</th>
                        <th className="py-2 font-semibold">Motivo</th>
                        <th className="py-2 font-semibold text-right">Valor</th>
                        <th className="py-2 font-semibold text-right">Data</th>
                        <th className="py-2 font-semibold text-right">Conversa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum encerramento com esses filtros.</td></tr>
                      )}
                      {filtered.map((r) => (
                        <tr key={r.id} className="border-b border-border/30">
                          <td className="py-2.5 font-medium text-foreground uppercase">{r.clientName}</td>
                          <td className="py-2.5 text-muted-foreground">{r.sellerName}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${r.isWin ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{r.motivo}</span>
                          </td>
                          <td className="py-2.5 text-right tabular-nums">{r.value ? brl(r.value) : "—"}</td>
                          <td className="py-2.5 text-right text-muted-foreground tabular-nums">{r.closedAt ? new Date(r.closedAt).toLocaleDateString("pt-BR") : "—"}</td>
                          <td className="py-2.5 text-right">
                            <Button
                              variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                              disabled={!r.clientPhone}
                              onClick={() => navigate(`/conversas?phone=${encodeURIComponent(r.clientPhone)}`)}
                            >
                              <MessageCircle className="h-3.5 w-3.5" /> Ver conversa
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
