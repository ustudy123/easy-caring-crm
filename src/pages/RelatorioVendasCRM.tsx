import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, TrendingUp, AlertTriangle } from "lucide-react";

interface Sale { numeroDocumento: string; phone: string; value: number; date: string; }
interface SellerRow { sellerCode: string; sellerName: string; count: number; totalValue: number; sales: Sale[]; }
interface Unmatched { numeroDocumento: string; phone: string; sellerCode: string; sellerName: string | null; value: number; date: string; reason: string; }
interface Report {
  period: { from: string; to: string | null };
  crmTipoAtendimento: { codigo: any; descricao: any }[];
  totals: { ordersScanned: number; crmOrders: number; validated: number; validatedValue: number; unmatched: number };
  bySeller: SellerRow[];
  unmatchedCrmOrders: Unmatched[];
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function RelatorioVendasCRM() {
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const generate = async () => {
    setLoading(true);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke("citel-sales-tracking", {
        body: { dataHora: dateFrom, dataHoraFim: dateTo || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setReport(data as Report);
    } catch (e: any) {
      toast.error(`Falha ao gerar relatório: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title="Vendas CRM x ERP">
      <div className="space-y-5 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rastreamento de vendas CRM x ERP</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Busca os pedidos faturados no ERP marcados como <strong>CRM</strong> e cruza
              telefone + código do vendedor com as vendas concluídas no CRM, validando quais
              vendas vieram do CRM.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="from" className="text-xs font-semibold">A partir de</Label>
                <Input id="from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-44" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to" className="text-xs font-semibold">Até (opcional)</Label>
                <Input id="to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-44" />
              </div>
              <Button onClick={generate} disabled={loading} className="h-10 gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Gerar relatório
              </Button>
            </div>
          </CardContent>
        </Card>

        {report && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Pedidos lidos</p>
                <p className="text-2xl font-black">{report.totals.ordersScanned}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Marcados como CRM</p>
                <p className="text-2xl font-black">{report.totals.crmOrders}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Vendas validadas</p>
                <p className="text-2xl font-black text-emerald-600">{report.totals.validated}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Valor validado</p>
                <p className="text-2xl font-black text-emerald-600">{brl(report.totals.validatedValue)}</p>
              </CardContent></Card>
            </div>

            {report.crmTipoAtendimento.length === 0 && (
              <Card className="border-warning/40">
                <CardContent className="p-4 flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  Nenhum tipo de atendimento "CRM" foi encontrado no ERP. O cruzamento usou a
                  descrição que contém "crm" — confirme com o André como esse tipo está cadastrado.
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Vendas validadas por vendedor</CardTitle></CardHeader>
              <CardContent>
                {report.bySeller.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma venda validada no período.</p>
                ) : (
                  <div className="divide-y">
                    {report.bySeller.map((s) => (
                      <div key={s.sellerCode} className="flex items-center justify-between py-3">
                        <div>
                          <p className="font-semibold text-sm">{s.sellerName}</p>
                          <p className="text-xs text-muted-foreground">Código {s.sellerCode} · {s.count} venda(s)</p>
                        </div>
                        <p className="font-black text-emerald-600 tabular-nums">{brl(s.totalValue)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {report.unmatchedCrmOrders.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base text-muted-foreground">Pedidos CRM não validados ({report.totals.unmatched})</CardTitle></CardHeader>
                <CardContent>
                  <div className="divide-y text-sm">
                    {report.unmatchedCrmOrders.map((u, i) => (
                      <div key={i} className="flex items-center justify-between py-2 gap-3">
                        <div className="min-w-0">
                          <p className="truncate">Pedido {u.numeroDocumento || "—"} · {u.phone || "sem telefone"}</p>
                          <p className="text-xs text-muted-foreground truncate">Vendedor {u.sellerCode || "—"} · {u.reason}</p>
                        </div>
                        <p className="text-muted-foreground tabular-nums shrink-0">{brl(u.value)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
