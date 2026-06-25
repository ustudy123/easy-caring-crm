import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, Trash2, CalendarOff, ArrowRight } from "lucide-react";

interface Store { id: string; name: string; }
interface Holiday { id: string; store_id: string; holiday_date: string; message: string | null; redirect_store_id: string | null; }
interface DayStore { closed: boolean; redirect: string; }

const DEFAULT_MSG = "Olá! Hoje nossa loja está fechada em razão de feriado. Assim que retornarmos, entraremos em contato. Obrigado pela compreensão!";

export default function Feriados() {
  const [stores, setStores] = useState<Store[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const [dayOpen, setDayOpen] = useState(false);
  const [dayDate, setDayDate] = useState<string>(""); // yyyy-MM-dd
  const [dayMessage, setDayMessage] = useState("");
  const [dayStores, setDayStores] = useState<Record<string, DayStore>>({});
  const [savingDay, setSavingDay] = useState(false);

  const loadAll = async () => {
    const [storesRes, holRes] = await Promise.all([
      supabase.from("stores").select("id, name").order("name"),
      (supabase as any).from("store_holidays").select("id, store_id, holiday_date, message, redirect_store_id").order("holiday_date"),
    ]);
    setStores((storesRes.data as Store[]) || []);
    setHolidays((holRes.data as Holiday[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const storeName = (id: string | null) => stores.find((s) => s.id === id)?.name || "—";
  const holidayDates = useMemo(
    () => Array.from(new Set(holidays.map((h) => h.holiday_date))).map((d) => parseISO(d + "T00:00:00")),
    [holidays]
  );

  // Agrupa por data para a lista.
  const byDate = useMemo(() => {
    const m = new Map<string, Holiday[]>();
    for (const h of holidays) { if (!m.has(h.holiday_date)) m.set(h.holiday_date, []); m.get(h.holiday_date)!.push(h); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [holidays]);

  const openDay = (day: Date) => {
    const iso = format(day, "yyyy-MM-dd");
    const existing = holidays.filter((h) => h.holiday_date === iso);
    const map: Record<string, DayStore> = {};
    for (const s of stores) {
      const ex = existing.find((h) => h.store_id === s.id);
      map[s.id] = { closed: !!ex, redirect: ex?.redirect_store_id ?? "none" };
    }
    setDayStores(map);
    setDayMessage(existing[0]?.message ?? DEFAULT_MSG);
    setDayDate(iso);
    setDayOpen(true);
  };

  const toggleStore = (id: string, closed: boolean) =>
    setDayStores((p) => ({ ...p, [id]: { ...p[id], closed } }));
  const setRedirect = (id: string, redirect: string) =>
    setDayStores((p) => ({ ...p, [id]: { ...p[id], redirect } }));

  const saveDay = async () => {
    if (!dayDate) return;
    const chosen = stores.filter((s) => dayStores[s.id]?.closed);
    if (chosen.length === 0) {
      // nada marcado: remove tudo daquele dia
      await (supabase as any).from("store_holidays").delete().eq("holiday_date", dayDate);
      toast.success("Feriado removido.");
      setDayOpen(false); loadAll(); return;
    }
    setSavingDay(true);
    try {
      // upsert das lojas marcadas
      const rows = chosen.map((s) => ({
        store_id: s.id,
        holiday_date: dayDate,
        message: dayMessage.trim() || null,
        redirect_store_id: dayStores[s.id].redirect === "none" ? null : dayStores[s.id].redirect,
      }));
      const { error } = await (supabase as any).from("store_holidays").upsert(rows, { onConflict: "store_id,holiday_date" });
      if (error) throw error;
      // remove as lojas desmarcadas que tinham feriado nesse dia
      const chosenIds = chosen.map((s) => s.id);
      const toRemove = holidays.filter((h) => h.holiday_date === dayDate && !chosenIds.includes(h.store_id)).map((h) => h.id);
      if (toRemove.length) await (supabase as any).from("store_holidays").delete().in("id", toRemove);
      toast.success(`Feriado salvo para ${chosen.length} loja(s).`);
      setDayOpen(false); loadAll();
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e.message || e}`);
    } finally {
      setSavingDay(false);
    }
  };

  const removeDate = async (iso: string) => {
    const { error } = await (supabase as any).from("store_holidays").delete().eq("holiday_date", iso);
    if (error) { toast.error(error.message); return; }
    setHolidays((h) => h.filter((x) => x.holiday_date !== iso));
  };

  const marcadas = stores.filter((s) => dayStores[s.id]?.closed).length;

  return (
    <AppLayout title="Feriados das Lojas">
      <div className="space-y-5 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CalendarOff className="h-4 w-4" /> Feriados e fechamento de loja</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Clique num dia no calendário para marcar quais lojas estarão fechadas. Você define uma mensagem automática em comum e, por loja, pode redirecionar o atendimento para outra unidade.
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Calendário — clique num dia</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <Calendar
                  mode="single"
                  locale={ptBR}
                  onSelect={(d) => d && openDay(d)}
                  modifiers={{ holiday: holidayDates }}
                  modifiersClassNames={{ holiday: "bg-red-500 text-white rounded-full" }}
                  className="p-0 pointer-events-auto"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Feriados configurados ({byDate.length} dia(s))</CardTitle></CardHeader>
              <CardContent>
                {byDate.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum feriado configurado. Clique num dia no calendário.</p>
                ) : (
                  <div className="space-y-3">
                    {byDate.map(([iso, list]) => (
                      <div key={iso} className="p-3 rounded-lg border border-border/60">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{format(parseISO(iso + "T00:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openDay(parseISO(iso + "T00:00:00"))}>Editar</Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeDate(iso)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {list.map((h) => (
                            <span key={h.id} className="text-[11px] bg-muted rounded-full px-2 py-0.5 flex items-center gap-1">
                              {storeName(h.store_id)}
                              {h.redirect_store_id && (<><ArrowRight className="h-3 w-3 text-emerald-600" />{storeName(h.redirect_store_id)}</>)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={dayOpen} onOpenChange={setDayOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feriado — {dayDate ? format(parseISO(dayDate + "T00:00:00"), "dd/MM/yyyy") : ""}</DialogTitle>
            <DialogDescription>Marque as lojas fechadas e, se quiser, para onde cada uma redireciona.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Mensagem automática (comum a todas)</Label>
              <Textarea value={dayMessage} onChange={(e) => setDayMessage(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Lojas fechadas neste dia</Label>
              {stores.map((s) => {
                const st = dayStores[s.id] || { closed: false, redirect: "none" };
                return (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-2.5">
                    <Checkbox checked={st.closed} onCheckedChange={(v) => toggleStore(s.id, !!v)} id={`st-${s.id}`} />
                    <Label htmlFor={`st-${s.id}`} className="flex-1 cursor-pointer text-sm font-medium">{s.name}</Label>
                    {st.closed && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ArrowRight className="h-3.5 w-3.5" />
                        <Select value={st.redirect} onValueChange={(v) => setRedirect(s.id, v)}>
                          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Não redirecionar</SelectItem>
                            {stores.filter((o) => o.id !== s.id).map((o) => (
                              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayOpen(false)}>Cancelar</Button>
            <Button onClick={saveDay} disabled={savingDay}>
              {savingDay ? "Salvando..." : marcadas === 0 ? "Remover feriado" : `Salvar (${marcadas} loja${marcadas > 1 ? "s" : ""})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
