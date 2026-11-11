import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, FileUp, Loader2, MessageSquareText, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { SellerCombobox } from "@/components/SellerCombobox";
import { ProtectedPdfViewer } from "@/components/media/ProtectedPdfViewer";
import { AudioRecorder } from "@/components/media/AudioRecorder";
import { StoredAudio, audioExtension } from "@/components/media/StoredAudio";
import { supabase } from "@/integrations/supabase/client";
import { useCrm } from "@/contexts/CrmContext";
import { useRole } from "@/contexts/RoleContext";
import { cn } from "@/lib/utils";
import {
  STATUS_LABEL, canSendResponse, feedbackPdfPath, feedbackStatus, mapFeedback, responseAudioPath, suggestedPeriod,
  type SellerFeedback,
} from "@/lib/feedback";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const MAX_PDF = 15 * 1024 * 1024;

function useFeedbacks(sellerId: string | null) {
  const [items, setItems] = useState<SellerFeedback[]>([]);
  const [loading, setLoading] = useState(!!sellerId);
  const reload = useCallback(async () => {
    if (!sellerId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("seller_feedbacks").select("*").eq("seller_id", sellerId).order("created_at", { ascending: false });
    setItems((data ?? []).map(mapFeedback));
    setLoading(false);
  }, [sellerId]);
  useEffect(() => { reload(); }, [reload]);
  return { items, loading, reload };
}

function StatusChip({ f }: { f: SellerFeedback }) {
  const s = feedbackStatus(f);
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold",
      s === "novo" ? "bg-brand-50 text-brand-600" : s === "lido" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
      {STATUS_LABEL[s]}
    </span>
  );
}

function ResponseView({ f }: { f: SellerFeedback }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
      <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" /> Resposta enviada em {day(f.respondedAt)}
      </p>
      {f.responseText && <p className="text-sm text-foreground whitespace-pre-wrap">{f.responseText}</p>}
      {f.responseAudioPath && <StoredAudio path={f.responseAudioPath} label="Áudio da resposta" />}
    </div>
  );
}

/** Operador: lê o PDF e responde uma vez, por texto e/ou áudio. */
function FeedbackReader({ f, sellerId, onBack, onChanged }: { f: SellerFeedback; sellerId: string; onBack: () => void; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [audio, setAudio] = useState<Blob | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!f.viewedAt) {
      supabase.from("seller_feedbacks").update({ viewed_at: new Date().toISOString() }).eq("id", f.id).then(() => onChanged());
    }
    // só na abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.id]);

  const send = async () => {
    if (!canSendResponse(text, audio)) return;
    setSending(true);
    let audioPath: string | null = null;
    if (audio) {
      audioPath = responseAudioPath(sellerId, f.id, audioExtension(audio.type));
      const { error } = await supabase.storage.from("seller-files").upload(audioPath, audio, { contentType: audio.type || "audio/webm" });
      if (error) { setSending(false); toast.error(`Não foi possível enviar o áudio: ${error.message}`); return; }
    }
    const { error } = await supabase.from("seller_feedbacks")
      .update({ response_text: text.trim() || null, response_audio_path: audioPath })
      .eq("id", f.id);
    setSending(false);
    if (error) { toast.error(`Não foi possível enviar a resposta: ${error.message}`); return; }
    toast.success("Resposta enviada ao gestor.");
    onChanged();
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-1" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Voltar</Button>
      <div>
        <h2 className="text-lg font-black text-foreground">Feedback · {f.periodLabel}</h2>
        <p className="text-xs text-muted-foreground">Enviado em {day(f.createdAt)}. O documento é só para leitura.</p>
      </div>
      <ProtectedPdfViewer path={f.storagePath} />
      {f.respondedAt ? (
        <ResponseView f={f} />
      ) : (
        <div className="rounded-xl border border-border/60 p-4 space-y-3">
          <Label htmlFor="fb-answer" className="text-sm font-bold">Sua resposta ao feedback</Label>
          <p className="text-xs text-muted-foreground">Conte o que você entendeu e o que vai fazer. Escreva, grave um áudio ou os dois. Depois de enviada, a resposta fica gravada.</p>
          <Textarea id="fb-answer" rows={5} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva aqui…" />
          <AudioRecorder onChange={setAudio} disabled={sending} />
          <div className="flex justify-end">
            <Button onClick={send} disabled={!canSendResponse(text, audio) || sending} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar resposta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedbackList({ items, onOpen, extra }: { items: SellerFeedback[]; onOpen: (f: SellerFeedback) => void; extra?: (f: SellerFeedback) => React.ReactNode }) {
  if (!items.length) return <p className="text-sm text-muted-foreground py-6 text-center">Nenhum feedback por aqui ainda.</p>;
  return (
    <ul className="divide-y divide-border/40 rounded-2xl border border-border/60 bg-card">
      {items.map((f) => (
        <li key={f.id} className="flex items-center gap-3 px-4 py-3">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(f)}>
            <p className="font-semibold text-sm text-foreground">{f.periodLabel}</p>
            <p className="text-xs text-muted-foreground">Enviado em {day(f.createdAt)}{f.viewedAt ? ` · lido em ${day(f.viewedAt)}` : ""}</p>
          </button>
          <StatusChip f={f} />
          {extra?.(f)}
        </li>
      ))}
    </ul>
  );
}

/** Gestor: envia o PDF do semestre e acompanha a leitura e a resposta. */
function FeedbackManager({ initialSellerId }: { initialSellerId: string | null }) {
  const { sellers } = useCrm();
  const { isAdmin, storeId, sellerId: mySellerId } = useRole();
  const team = useMemo(() => sellers
    .filter((s) => s.id !== mySellerId && (isAdmin || s.store_id === storeId))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [sellers, isAdmin, storeId, mySellerId]);
  const [sellerId, setSellerId] = useState<string>(initialSellerId ?? "");
  const { items, loading, reload } = useFeedbacks(sellerId || null);
  const [period, setPeriod] = useState(suggestedPeriod());
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [viewing, setViewing] = useState<SellerFeedback | null>(null);
  const [deleting, setDeleting] = useState<SellerFeedback | null>(null);

  const upload = async () => {
    if (!sellerId || !file || !period.trim()) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { toast.error("Envie o feedback em PDF."); return; }
    if (file.size > MAX_PDF) { toast.error("O PDF passa de 15 MB."); return; }
    setSending(true);
    const id = crypto.randomUUID();
    const path = feedbackPdfPath(sellerId, id);
    const { error: upErr } = await supabase.storage.from("seller-files").upload(path, file, { contentType: "application/pdf" });
    if (upErr) { setSending(false); toast.error(`Não foi possível enviar o PDF: ${upErr.message}`); return; }
    const { error } = await supabase.from("seller_feedbacks").insert({ id, seller_id: sellerId, period_label: period.trim(), storage_path: path, file_name: file.name });
    setSending(false);
    if (error) {
      await supabase.storage.from("seller-files").remove([path]);
      toast.error(`Não foi possível registrar o feedback: ${error.message}`);
      return;
    }
    toast.success("Feedback enviado. Ele aparece no bloco Feedback do operador.");
    setFile(null);
    reload();
  };

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("seller_feedbacks").delete().eq("id", deleting.id);
    if (error) { toast.error(`Não foi possível excluir: ${error.message}`); return; }
    await supabase.storage.from("seller-files").remove([deleting.storagePath, ...(deleting.responseAudioPath ? [deleting.responseAudioPath] : [])]);
    toast.success("Feedback excluído.");
    setDeleting(null);
    reload();
  };

  if (viewing) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setViewing(null)}><ChevronLeft className="h-4 w-4" /> Voltar</Button>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-black text-foreground">{team.find((s) => s.id === viewing.sellerId)?.name} · {viewing.periodLabel}</h2>
          <StatusChip f={viewing} />
        </div>
        {viewing.respondedAt ? <ResponseView f={viewing} /> : <p className="text-sm text-muted-foreground">O operador ainda não respondeu.</p>}
        <ProtectedPdfViewer path={viewing.storagePath} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5 max-w-sm">
        <Label>Operador</Label>
        <SellerCombobox value={sellerId} onChange={setSellerId} sellers={team} placeholder="Escolha o operador" />
      </div>
      {sellerId && (
        <>
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <p className="text-sm font-bold flex items-center gap-2"><FileUp className="h-4 w-4 text-brand-500" /> Enviar feedback</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fb-period">Período da análise</Label>
                <Input id="fb-period" value={period} maxLength={80} onChange={(e) => setPeriod(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fb-file">PDF do feedback</Label>
                <Input id="fb-file" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={upload} disabled={!file || !period.trim() || sending} className="gap-1.5">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar ao operador
              </Button>
            </div>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
            <FeedbackList items={items} onOpen={setViewing} extra={(f) => (
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Excluir ${f.periodLabel}`} onClick={() => setDeleting(f)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )} />
          )}
        </>
      )}
      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onConfirm={remove}
        title="Excluir este feedback?"
        description="O PDF e a resposta do operador são apagados. Não dá para desfazer."
      />
    </div>
  );
}

/**
 * Bloco de Feedback (Fase 9): o operador lê o feedback do semestre e responde;
 * o gestor (admin ou gerente da loja) envia o PDF e vê as respostas.
 */
export default function Feedback() {
  const { sellerId, isAdmin, isGerente } = useRole();
  const isManager = isAdmin || isGerente;
  const [params] = useSearchParams();
  const initialSeller = params.get("vendedor");
  const [tab, setTab] = useState<"meus" | "equipe">(initialSeller || !sellerId ? "equipe" : "meus");
  const { items, loading, reload } = useFeedbacks(sellerId);
  const [reading, setReading] = useState<SellerFeedback | null>(null);
  const current = reading ? items.find((f) => f.id === reading.id) ?? reading : null;

  return (
    <AppLayout title="Feedback">
      <div className="space-y-5 max-w-4xl">
        {sellerId && isManager && !current && (
          <div className="flex gap-1 rounded-full bg-muted p-1 w-fit">
            {(["meus", "equipe"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={cn("px-3 py-1 text-xs font-semibold rounded-full", tab === k ? "bg-brand-500 text-white" : "text-muted-foreground")}>
                {k === "meus" ? "Meus feedbacks" : "Feedbacks da equipe"}
              </button>
            ))}
          </div>
        )}

        {tab === "meus" && sellerId ? (
          current ? (
            <FeedbackReader f={current} sellerId={sellerId} onBack={() => setReading(null)} onChanged={reload} />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-brand-500" /> Abra o feedback do período, leia e responda por texto ou áudio.
              </p>
              {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : <FeedbackList items={items} onOpen={setReading} />}
            </div>
          )
        ) : isManager ? (
          <FeedbackManager initialSellerId={initialSeller} />
        ) : (
          <p className="text-sm text-muted-foreground">O bloco de feedback é dos operadores e dos gestores.</p>
        )}
      </div>
    </AppLayout>
  );
}

/** Quantos feedbacks o operador ainda não leu (selo no bloco do Hub). */
export function useUnreadFeedbacks(sellerId: string | null) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!sellerId) return;
    supabase.from("seller_feedbacks").select("id", { count: "exact", head: true }).eq("seller_id", sellerId).is("responded_at", null)
      .then(({ count: c }) => setCount(c ?? 0));
  }, [sellerId]);
  return count;
}
