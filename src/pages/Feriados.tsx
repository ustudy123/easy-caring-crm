import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, Trash2, CalendarOff, ArrowRight } from "lucide-react";

interface Store { id: string; name: string; }
interface Holiday { id: string; store_id: string; holiday_date: string; message: string | null; redirect_store_id: string | null; }

const DEFAULT_MSG = "Olá! Hoje nossa loja está fechada em razão de feriado. Assim que retornarmos, entraremos em contato. Obrigado pela compreensão!";

export default function Feriados() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string>("");
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // diálogo de configuração de um dia
  const [dayOpen, setDayOpen] = useState(false);
  const [dayDate, setDayDate] = useState<string>(""); // yyyy-MM-dd
  const [dayMessage, setDayMessage] = useState("");
  const [dayRedirect, setDayRedirect] = useState<string>("none");
  const [savingDay, setSavingDay] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("stores").select("id, name").order("name");
      const list = (data as Store[]) || [];
      setStores(list);
      if (list.length && !storeId) setStoreId(list[0].id);
      setLoading(false);
    })();
  }, []);

  const loadHolidays = async (sid: string) => {
    const { data } = await (supabase as any)
      .from("store_holidays")
      .select("id, store_id, holiday_date, message, redirect_store_id")
      .eq("store_id", sid)
      .order("holiday_date");
    setHolidays((data as Holiday[]) || []);
  };

  useEffect(() => { if (storeId) loadHolidays(storeId); }, [storeId]);

  const holidayDates = useMemo(() => holidays.map((h) => parseISO(h.holiday_date + "T00:00:00")), [holidays]);
  const storeName = (id: string | null) => stores.find((s) => s.id === id)?.name || "—";

  const openDay = (day: Date) => {
    const iso = format(day, "yyyy-MM-dd");
    const existing = holidays.find((h) => h.holiday_date === iso);
    setDayDate(iso);
    setDayMessage(existing?.message ?? DEFAULT_MSG);
    setDayRedirect(existing?.redirect_store_id ?? "none");
    setDayOpen(true);
  };

  const saveDay = async () => {
    if (!storeId || !dayDate) return;
    setSavingDay(true);
    const { error } = await (supabase as any).from("store_holidays").upsert({
      store_id: storeId,
      holiday_date: dayDate,
      message: dayMessage.trim() || null,
      redirect_store_id: dayRedirect === "none" ? null : dayRedirect,
    } as any, { onConflict: "store_id,holiday_date" });
    setSavingDay(false);
    if (error) { toast.error(`Erro ao salvar: ${error.message}`); return; }
    toast.success("Feriado salvo!");
    setDayOpen(false);
    loadHolidays(storeId);
  };

  const removeHoliday = async (id: string) => {
    const { error } = await (supabase as any).from("store_holidays").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setHolidays((h) => h.filter((x) => x.id !== id));
  };

  return (
    <AppLayout title="Feriados das Lojas">
      <div className="space-y-5 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CalendarOff className="h-4 w-4" /> Feriados e fechamento de loja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Marque no calendário os dias em que a loja estará fechada. Nesse dia, quem mandar mensagem recebe um aviso automático — e, se você indicar, o atendimento é redirecionado para outra loja.
            </p>
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs font-semibold">Loja</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Calendário — clique num dia para configurar</CardTitle></CardHeader>
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
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Feriados configurados ({holidays.length})</CardTitle></CardHeader>
              <CardContent>
                {holidays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum feriado configurado para esta loja. Clique num dia no calendário.</p>
                ) : (
                  <div className="space-y-2">
                    {holidays.map((h) => (
                      <div key={h.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/60">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{format(parseISO(h.holiday_date + "T00:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                          {h.redirect_store_id && (
                            <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                              <ArrowRight className="h-3 w-3" /> redireciona para {storeName(h.redirect_store_id)}
                            </p>
                          )}
                          {h.message && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{h.message}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openDay(parseISO(h.holiday_date + "T00:00:00"))}>Editar</Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeHoliday(h.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Feriado — {dayDate ? format(parseISO(dayDate + "T00:00:00"), "dd/MM/yyyy") : ""}</DialogTitle>
            <DialogDescription>{storeName(storeId)} ficará fechada neste dia.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Mensagem automática</Label>
              <Textarea value={dayMessage} onChange={(e) => setDayMessage(e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Redirecionar atendimento para <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Select value={dayRedirect} onValueChange={setDayRedirect}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não redirecionar</SelectItem>
                  {stores.filter((s) => s.id !== storeId).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayOpen(false)}>Cancelar</Button>
            <Button onClick={saveDay} disabled={savingDay}>{savingDay ? "Salvando..." : "Salvar feriado"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
