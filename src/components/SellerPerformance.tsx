import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCrm } from "@/contexts/CrmContext";
import { useRole } from "@/contexts/RoleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, Trophy } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";

interface SellerRow {
  id: string;
  name: string;
  role: string | null;
  sla_target_minutes: number | null;
  is_active: boolean | null;
  store_id: string | null;
}

interface ClientResp {
  assigned_seller_id: string | null;
  last_message_from_client_at: string | null;
  last_seller_response_at: string | null;
}

interface PerfRow {
  id: string;
  name: string;
  assigned: number;
  won: number;
  lost: number;
  winRate: number;
  valueWon: number;
  avgResponseMin: number | null;
  slaTarget: number | null;
  slaAdherence: number | null;
}

export function SellerPerformance() {
  const { leads } = useCrm();
  const { isAdmin, isGerente, storeId } = useRole();
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [clients, setClients] = useState<ClientResp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sellersRes, clientsRes] = await Promise.all([
        supabase.from("sellers").select("id, name, role, sla_target_minutes, is_active, store_id").order("name"),
        supabase.from("clients").select("assigned_seller_id, last_message_from_client_at, last_seller_response_at"),
      ]);
      if (sellersRes.data) setSellers(sellersRes.data as SellerRow[]);
      if (clientsRes.data) setClients(clientsRes.data as ClientResp[]);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo<PerfRow[]>(() => {
    // Gerente vê apenas a equipe da própria loja; admin vê todos.
    const restrictToStore = isGerente && !isAdmin && !!storeId;
    return sellers
      .filter((s) => s.is_active !== false)
      .filter((s) => !restrictToStore || s.store_id === storeId)
      .map((s) => {
        const sellerLeads = leads.filter((l) => l.assignedTo === s.id);
        const won = sellerLeads.filter((l) => l.stage === "fechamento" || l.stage === "pos_venda").length;
        const lost = sellerLeads.filter((l) => l.stage === "perdido").length;
        const decided = won + lost;
        const winRate = decided > 0 ? Math.round((won / decided) * 100) : 0;
        const valueWon = sellerLeads
          .filter((l) => l.stage === "fechamento" || l.stage === "pos_venda")
          .reduce((sum, l) => sum + (l.value || 0), 0);

        // Tempo de resposta a partir dos clientes atribuídos ao vendedor
        const sellerClients = clients.filter(
          (c) => c.assigned_seller_id === s.id && c.last_message_from_client_at && c.last_seller_response_at,
        );
        const responseMins = sellerClients
          .map((c) => {
            const diff =
              new Date(c.last_seller_response_at!).getTime() -
              new Date(c.last_message_from_client_at!).getTime();
            return diff / 60000;
          })
          .filter((m) => m >= 0);
        const avgResponseMin =
          responseMins.length > 0
            ? Math.round(responseMins.reduce((a, b) => a + b, 0) / responseMins.length)
            : null;

        let slaAdherence: number | null = null;
        if (s.sla_target_minutes && responseMins.length > 0) {
          const within = responseMins.filter((m) => m <= s.sla_target_minutes!).length;
          slaAdherence = Math.round((within / responseMins.length) * 100);
        }

        return {
          id: s.id,
          name: s.name,
          assigned: sellerLeads.length,
          won,
          lost,
          winRate,
          valueWon,
          avgResponseMin,
          slaTarget: s.sla_target_minutes,
          slaAdherence,
        };
      })
      .sort((a, b) => b.valueWon - a.valueWon || b.won - a.won);
  }, [sellers, leads, clients, isAdmin, isGerente, storeId]);

  const handleExport = () => {
    exportToCsv(
      rows,
      [
        { key: "name", label: "Vendedor" },
        { key: "assigned", label: "Leads atribuídos" },
        { key: "won", label: "Ganhos" },
        { key: "lost", label: "Perdidos" },
        { key: "winRate", label: "Win rate (%)" },
        { key: "valueWon", label: "Valor ganho (R$)" },
        { key: "avgResponseMin", label: "Tempo médio resposta (min)", format: (r) => r.avgResponseMin ?? "" },
        { key: "slaTarget", label: "Meta SLA (min)", format: (r) => r.slaTarget ?? "" },
        { key: "slaAdherence", label: "Aderência SLA (%)", format: (r) => r.slaAdherence ?? "" },
      ],
      "performance_vendedores",
    );
  };

  const slaColor = (adh: number | null) =>
    adh === null ? "" : adh >= 80 ? "text-emerald-600" : adh >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" /> Performance por vendedor
        </CardTitle>
        <Button variant="outline" size="sm" className="h-8" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum vendedor ativo encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Vendedor</TableHead>
                  <TableHead className="text-xs text-center">Leads</TableHead>
                  <TableHead className="text-xs text-center">Ganhos</TableHead>
                  <TableHead className="text-xs text-center">Perdidos</TableHead>
                  <TableHead className="text-xs text-center">Win rate</TableHead>
                  <TableHead className="text-xs text-right">Valor ganho</TableHead>
                  <TableHead className="text-xs text-center">Resp. média</TableHead>
                  <TableHead className="text-xs text-center">SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs text-center">{r.assigned}</TableCell>
                    <TableCell className="text-xs text-center text-emerald-600 font-medium">{r.won}</TableCell>
                    <TableCell className="text-xs text-center text-red-500">{r.lost}</TableCell>
                    <TableCell className="text-xs text-center">
                      <Badge variant="secondary" className="text-[10px]">{r.winRate}%</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      R$ {r.valueWon.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs text-center tabular-nums">
                      {r.avgResponseMin !== null ? `${r.avgResponseMin} min` : "—"}
                    </TableCell>
                    <TableCell className={`text-xs text-center tabular-nums font-medium ${slaColor(r.slaAdherence)}`}>
                      {r.slaAdherence !== null ? `${r.slaAdherence}%` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
