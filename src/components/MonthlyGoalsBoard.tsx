import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Copy, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExternalStores } from "@/hooks/useExternalStores";
import { useExternalHolidays, useMonthlyGoals } from "@/hooks/useSalesGoals";
import {
  brl, countBusinessDays, formatMoneyInput, monthKey, monthLabel, monthStart, monthTitle, parseMoneyInput, shiftMonth,
} from "@/lib/salesGoals";
import type { GoalSellerRow } from "@/components/VisitGoalsTab";

type Draft = Record<string, { quote: string; sales: string }>;

const toDraft = (sellers: GoalSellerRow[], goals: Map<string, { quoteGoal: number | null; salesGoal: number | null }>): Draft =>
  Object.fromEntries(sellers.map((s) => [s.id, {
    quote: formatMoneyInput(goals.get(s.id)?.quoteGoal),
    sales: formatMoneyInput(goals.get(s.id)?.salesGoal),
  }]));

const day = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

/**
 * Quadro único do mês (Admin → Metas): meta de orçamentos e de vendas (R$) de
 * cada vendedor da equipe externa e os dias úteis. Meta diária = meta ÷ dias úteis.
 */
export function MonthlyGoalsBoard({ sellers }: { sellers: GoalSellerRow[] }) {
  const [month, setMonth] = useState(() => monthStart());
  const { goals, businessDays, loading, reload } = useMonthlyGoals(month);
  const externalStores = useExternalStores();
  const holidays = useExternalHolidays(externalStores);
  const suggestion = useMemo(() => countBusinessDays(month, holidays), [month, holidays]);

  const [draft, setDraft] = useState<Draft>({});
  const [days, setDays] = useState("");
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (loading) return;
    setDraft(toDraft(sellers, goals));
    setDays(businessDays ? String(businessDays) : "");
  }, [loading, sellers, goals, businessDays]);

  const daysNumber = days.trim() === "" ? null : Number(days);
  const daysError = daysNumber !== null && (!Number.isInteger(daysNumber) || daysNumber < 1 || daysNumber > 31)
    ? "Dias úteis: um número inteiro de 1 a 31." : null;
  const effectiveDays = daysNumber && !daysError ? daysNumber : suggestion.total;

  const parsed = sellers.map((s) => {
    const d = draft[s.id] ?? { quote: "", sales: "" };
    return { seller: s, quote: parseMoneyInput(d.quote), sales: parseMoneyInput(d.sales) };
  });
  const moneyError = parsed.some((p) => Number.isNaN(p.quote) || Number.isNaN(p.sales))
    ? "Use valores em reais, por exemplo 150.000,00." : null;

  const set = (sellerId: string, field: "quote" | "sales", value: string) =>
    setDraft((d) => ({ ...d, [sellerId]: { ...(d[sellerId] ?? { quote: "", sales: "" }), [field]: value } }));

  const copyPrevious = async () => {
    setCopying(true);
    const { data, error } = await supabase.from("monthly_goals").select("seller_id, quote_goal, sales_goal").eq("month", monthKey(shiftMonth(month, -1)));
    setCopying(false);
    if (error) { toast.error(`Não foi possível ler o mês anterior: ${error.message}`); return; }
    if (!data?.length) { toast.info("O mês anterior não tem metas cadastradas."); return; }
    const prev = new Map(data.map((g) => [g.seller_id, {
      quoteGoal: g.quote_goal === null ? null : Number(g.quote_goal),
      salesGoal: g.sales_goal === null ? null : Number(g.sales_goal),
    }]));
    setDraft(toDraft(sellers, prev));
    toast.success("Metas do mês anterior copiadas. Confira e clique em Salvar quadro.");
  };

  const save = async () => {
    if (daysError || moneyError) return;
    setSaving(true);
    const key = monthKey(month);
    try {
      if (daysNumber) {
        const { error } = await supabase.from("month_business_days").upsert({ month: key, business_days: daysNumber }, { onConflict: "month" });
        if (error) throw error;
      } else if (businessDays) {
        const { error } = await supabase.from("month_business_days").delete().eq("month", key);
        if (error) throw error;
      }
      const rows = parsed
        .filter((p) => p.quote !== null || p.sales !== null)
        .map((p) => ({ month: key, seller_id: p.seller.id, quote_goal: p.quote, sales_goal: p.sales }));
      if (rows.length) {
        const { error } = await supabase.from("monthly_goals").upsert(rows, { onConflict: "month,seller_id" });
        if (error) throw error;
      }
      const cleared = parsed.filter((p) => p.quote === null && p.sales === null && goals.has(p.seller.id)).map((p) => p.seller.id);
      if (cleared.length) {
        const { error } = await supabase.from("monthly_goals").delete().eq("month", key).in("seller_id", cleared);
        if (error) throw error;
      }
      toast.success(`Metas de ${monthLabel(month)} salvas.`);
      await reload();
    } catch (e) {
      toast.error(`Não foi possível salvar as metas: ${(e as Error).message}`);
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-brand-500" /> Metas do mês: orçamentos e vendas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Orçado = orçamentos enviados em PDF; vendido = notas fiscais. Meta diária = meta do mês ÷ dias úteis.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Mês anterior" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-bold min-w-[150px] text-center">{monthTitle(month)}</p>
          <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Próximo mês" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
        ) : (
          <>
            <div className="rounded-xl border border-border/60 p-3 space-y-2">
              <label htmlFor="business-days" className="text-[11px] font-semibold text-muted-foreground">Dias úteis do mês</label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="business-days"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  className="h-9 w-24"
                  value={days}
                  placeholder={String(suggestion.total)}
                  onChange={(e) => setDays(e.target.value)}
                />
                {String(suggestion.total) !== days && (
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setDays(String(suggestion.total))}>
                    Usar {suggestion.total}
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pelo calendário: {suggestion.total} (segunda a sexta
                {suggestion.holidays.length ? `, menos ${suggestion.holidays.length} feriado${suggestion.holidays.length > 1 ? "s" : ""}: ${suggestion.holidays.map(day).join(", ")}` : ""}).
                {!daysNumber && " Sem valor informado, o painel usa esta conta."}
              </p>
              {daysError && <p role="alert" className="text-xs text-destructive">{daysError}</p>}
            </div>

            {sellers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum vendedor ativo em loja de equipe externa.</p>
            ) : (
              <div className="space-y-2">
                {parsed.map(({ seller, quote, sales }) => (
                  <div key={seller.id} className="rounded-xl border border-border/60 p-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{seller.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Por dia útil: {quote && !Number.isNaN(quote) ? brl(quote / effectiveDays) : "—"} em orçamentos ·{" "}
                        {sales && !Number.isNaN(sales) ? brl(sales / effectiveDays) : "—"} em vendas
                      </p>
                    </div>
                    {(["quote", "sales"] as const).map((field) => (
                      <div key={field} className="space-y-1">
                        <label htmlFor={`${field}-${seller.id}`} className="text-[11px] font-semibold text-muted-foreground">
                          {field === "quote" ? "Meta de orçamentos (R$)" : "Meta de vendas (R$)"}
                        </label>
                        <Input
                          id={`${field}-${seller.id}`}
                          inputMode="decimal"
                          className="h-9 w-full sm:w-40"
                          placeholder="sem meta"
                          value={draft[seller.id]?.[field] ?? ""}
                          onChange={(e) => set(seller.id, field, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {moneyError && <p role="alert" className="text-xs text-destructive">{moneyError}</p>}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={copyPrevious} disabled={copying || saving}>
                {copying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Copiar do mês anterior
              </Button>
              <Button size="sm" className="gap-1.5" onClick={save} disabled={saving || !!daysError || !!moneyError}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar quadro
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
