import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SellerCombobox } from "@/components/SellerCombobox";
import { Briefcase, Loader2, Search } from "lucide-react";
import { KANBAN_STAGES } from "@/types/crm";

interface ProjectRow {
  id: string;
  name: string;
  stage: string;
  client_name: string | null;
  client_phone: string;
  seller_id: string | null;
  completed_at: string | null;
  created_at: string;
}

const stageLabel = (key: string) =>
  KANBAN_STAGES.find((s) => s.key === key)?.label || key;

/**
 * Relatório de projetos: o que cada vendedor tem em mãos, em que etapa cada
 * projeto está e quais clientes concentram mais de um projeto.
 */
export function ProjectsReport() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerFilter, setSellerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"ativos" | "concluidos" | "todos">("ativos");
  // Busca por nome (cliente ou projeto) — filtra a lista e os resumos.
  const [nameSearch, setNameSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [projRes, sellRes] = await Promise.all([
        (supabase as any).from("client_projects")
          .select("id, name, stage, client_name, client_phone, seller_id, completed_at, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("sellers").select("id, name").order("name"),
      ]);
      setRows((projRes.data ?? []) as ProjectRow[]);
      setSellers((sellRes.data ?? []) as { id: string; name: string }[]);
      setLoading(false);
    };
    load();
  }, []);

  const sellerName = (id: string | null) =>
    (id && sellers.find((s) => s.id === id)?.name) || "Sem vendedor";

  const filtered = useMemo(() => {
    const q = nameSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (sellerFilter !== "all" && r.seller_id !== sellerFilter) return false;
      if (statusFilter === "ativos" && r.completed_at) return false;
      if (statusFilter === "concluidos" && !r.completed_at) return false;
      if (q && !((r.client_name || "").toLowerCase().includes(q) || (r.name || "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [rows, sellerFilter, statusFilter, nameSearch]);

  // Quantos projetos por etapa (só os ativos fazem sentido no funil).
  const porEtapa = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filtered) if (!r.completed_at) map[r.stage] = (map[r.stage] || 0) + 1;
    return KANBAN_STAGES.map((s) => ({ key: s.key, label: s.label, count: map[s.key] || 0 }))
      .filter((s) => s.count > 0);
  }, [filtered]);

  // Quantos projetos por vendedor.
  const porVendedor = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filtered) {
      const k = r.seller_id || "none";
      map[k] = (map[k] || 0) + 1;
    }
    return Object.entries(map)
      .map(([id, count]) => ({ id, name: id === "none" ? "Sem vendedor" : sellerName(id), count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered, sellers]);

  // Clientes com mais de um projeto (o telefone identifica o cliente).
  const clientesMultiplos = useMemo(() => {
    const map: Record<string, { nome: string; total: number }> = {};
    for (const r of filtered) {
      const k = r.client_phone;
      if (!map[k]) map[k] = { nome: r.client_name || r.client_phone, total: 0 };
      map[k].total += 1;
    }
    return Object.entries(map)
      .map(([phone, v]) => ({ phone, ...v }))
      .filter((c) => c.total > 1)
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="h-4 w-4" /> Relatório de Projetos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <SellerCombobox
            value={sellerFilter}
            onChange={setSellerFilter}
            sellers={sellers}
            presets={[{ value: "all", label: "Todos os vendedores" }]}
            placeholder="Todos os vendedores"
            className="w-56 h-9 text-xs"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-44 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativos">Projetos ativos</SelectItem>
              <SelectItem value="concluidos">Concluídos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder="Buscar por cliente ou projeto..."
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando projetos...
          </div>
        ) : (
          <>
            {/* Resumos */}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por vendedor</p>
                {porVendedor.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum projeto.</p>
                ) : porVendedor.map((v) => (
                  <div key={v.id} className="flex justify-between text-xs py-0.5">
                    <span className="truncate">{v.name}</span>
                    <span className="font-bold tabular-nums">{v.count}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por etapa (ativos)</p>
                {porEtapa.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum projeto ativo.</p>
                ) : porEtapa.map((e) => (
                  <div key={e.key} className="flex justify-between text-xs py-0.5">
                    <span className="truncate">{e.label}</span>
                    <span className="font-bold tabular-nums">{e.count}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Clientes com mais de um projeto</p>
                {clientesMultiplos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum cliente com projetos repetidos.</p>
                ) : clientesMultiplos.map((c) => (
                  <div key={c.phone} className="flex justify-between text-xs py-0.5">
                    <span className="truncate">{c.nome}</span>
                    <span className="font-bold tabular-nums">{c.total}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detalhe */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-medium">{sellerName(r.seller_id)}</TableCell>
                    <TableCell className="text-xs">
                      {r.client_name || r.client_phone}
                      <span className="block text-[10px] text-muted-foreground">{r.client_phone}</span>
                    </TableCell>
                    <TableCell className="text-xs">{r.name}</TableCell>
                    <TableCell className="text-xs">{stageLabel(r.stage)}</TableCell>
                    <TableCell>
                      {r.completed_at ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700">Concluído</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Ativo</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
                      Nenhum projeto para os filtros escolhidos
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
