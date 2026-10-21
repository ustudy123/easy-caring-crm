import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useCrm } from "@/contexts/CrmContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText, DollarSign, Clock, CheckCircle, Send, Search, Filter, MessageSquare, Paperclip, Phone, Loader2, User, X, Download, Pencil, Forward, Eye, EyeOff, Coffee, Bell, Mic, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useRole } from "@/contexts/RoleContext";
import { useBackgroundAlert } from "@/hooks/useBackgroundAlert";
import { useSearchParams } from "react-router-dom";

type RequestType = "orcamento" | "precificacao_especial" | "distribuicao" | "representacao";
type PageMode = "orcamento" | "pedido";
const MODE_CFG: Record<PageMode, {
  title: string; category: string; defaultType: RequestType;
  type1: { key: RequestType; label: string; desc: string };
  type2: { key: RequestType; label: string; desc: string };
  dialogTitle: (t: RequestType) => string; dialogSubtitle: (t: RequestType) => string;
  badge: (t: string) => string;
}> = {
  orcamento: {
    title: "Suporte a Orçamento", category: "orcamento", defaultType: "orcamento",
    type1: { key: "orcamento", label: "Solicitar Orçamento", desc: "Pedir um orçamento ao setor responsável" },
    type2: { key: "precificacao_especial", label: "Negociação Especial", desc: "Pedir uma condição/preço especial" },
    dialogTitle: (t) => t === "orcamento" ? "Nova Solicitação de Orçamento" : "Solicitação de Negociação Especial",
    dialogSubtitle: (t) => t === "orcamento" ? "Busque o cliente no ERP e solicite a elaboração de um orçamento." : "Busque o cliente no ERP e solicite análise de precificação especial.",
    badge: (t) => t === "orcamento" ? "ORC" : "PREC",
  },
  pedido: {
    title: "Envio de Pedido", category: "pedido", defaultType: "distribuicao",
    type1: { key: "distribuicao", label: "Distribuição", desc: "Enviar pedido de distribuição ao suporte" },
    type2: { key: "representacao", label: "Representação", desc: "Enviar pedido de representação ao suporte" },
    dialogTitle: (t) => t === "distribuicao" ? "Novo Pedido — Distribuição" : "Novo Pedido — Representação",
    dialogSubtitle: () => "Busque o cliente e envie o pedido para o suporte.",
    badge: (t) => t === "distribuicao" ? "DIST" : "REP",
  },
};

interface SupportRequest {
  id: string;
  client_name: string;
  vendedor_name?: string;
  request_type: RequestType;
  notes: string;
  status: "pendente" | "em_analise" | "concluido";
  created_at: string;
  pdf_url?: string;
  pdf_name?: string;
  audio_url?: string;
  erp_client_id?: string;
  created_by?: string;
  seller_id?: string;
  store_id?: string | null;
  assigned_to?: string | null;
  response_notes?: string;
  response_pdf_url?: string;
  response_pdf_name?: string;
  responded_at?: string;
  completed_at?: string | null;
  responded_by_name?: string;
}

export default function SuporteOrcamento({ mode = "orcamento" }: { mode?: PageMode }) {
  const cfg = MODE_CFG[mode];
  const { sellers } = useCrm();
  const { role, isAdmin, isGerente, isSuporte, sellerId, storeId } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  // Filtro por suporte (assigned_to). Só o supervisor de suporte usa, no lugar do
  // filtro por tipo. "all" = todos os suportes da loja dele.
  const [filterSupport, setFilterSupport] = useState<string>("all");
  // Ocultar concluídos com mais de 3 dias. Admin/gerente podem reexibir.
  const [showHiddenCompleted, setShowHiddenCompleted] = useState(false);
  // Alerta de novas solicitações com a aba em segundo plano.
  const { permission: notifPermission, requestPermission, notify } = useBackgroundAlert(cfg.title);
  // Pausa para almoço: uma por dia. myBreak = a pausa de hoje deste usuário.
  const [myBreak, setMyBreak] = useState<{ id: string; started_at: string; ended_at: string | null } | null>(null);
  const [breakSaving, setBreakSaving] = useState(false);
  // Relógio que avança de minuto em minuto, para o tempo de pausa em aberto
  // aparecer correndo na tela sem precisar recarregar.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  // Todas as pausas (para descontar do tempo de atendimento de cada suporte).
  const [allBreaks, setAllBreaks] = useState<{ seller_id: string; started_at: string; ended_at: string | null }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>(cfg.defaultType);
  const [description, setDescription] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  // Gravação de áudio da solicitação (opcional).
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // URL assinada do áudio da solicitação aberta no detalhe (para o player).
  const [detailAudioUrl, setDetailAudioUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ERP Search states
  const [erpSearch, setErpSearch] = useState("");
  const [erpResults, setErpResults] = useState<any[]>([]);
  const [searchingErp, setSearchingErp] = useState(false);
  const [erpSearchError, setErpSearchError] = useState("");
  const [selectedErpClient, setSelectedErpClient] = useState<any | null>(null);
  // Destino da solicitação: suportes (supervisor + trainees) da loja do vendedor.
  const [storeSupports, setStoreSupports] = useState<{ id: string; name: string; is_support_supervisor: boolean; store_id: string | null; store_name: string }[]>([]);
  const [selectedSupportId, setSelectedSupportId] = useState<string>("");
  // Dados de supervisão do usuário logado (se for suporte).
  const [mySupervisorInfo, setMySupervisorInfo] = useState<{ isSupervisor: boolean; storeId: string | null }>({ isSupervisor: false, storeId: null });
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);
  const [pdfRawUrl, setPdfRawUrl] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState("");
  const [responseFile, setResponseFile] = useState<File | null>(null);
  // Edição da própria solicitação pelo vendedor (2.6)
  const [editReqOpen, setEditReqOpen] = useState(false);
  const [editReqNotes, setEditReqNotes] = useState("");
  const [editReqFile, setEditReqFile] = useState<File | null>(null);
  const [savingReqEdit, setSavingReqEdit] = useState(false);
  const [savingResponse, setSavingResponse] = useState(false);
  const canRespond = isAdmin || isSuporte || isGerente;
  // Quem pode mover o card entre colunas (mudar o status) é o mesmo time que
  // processa a solicitação. O vendedor só cria e edita a PRÓPRIA solicitação
  // (notas/anexo); ele não arrasta cards nem usa o "Mover para".
  const canMoveCard = canRespond;

  // Pré-preenche a resposta ao abrir uma solicitação
  useEffect(() => {
    setResponseNotes(selectedRequest?.response_notes || "");
    setResponseFile(null);
  }, [selectedRequest?.id]);

  const submitResponse = async () => {
    if (!selectedRequest) return;
    setSavingResponse(true);
    try {
      let respUrl = selectedRequest.response_pdf_url || null;
      let respName = selectedRequest.response_pdf_name || null;
      if (responseFile) {
        const ext = responseFile.name.split(".").pop();
        const filePath = `responses/${selectedRequest.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("pricing_attachments").upload(filePath, responseFile);
        if (upErr) throw upErr;
        respUrl = filePath;
        respName = responseFile.name;
      }
      const responderName = sellers.find((s) => s.id === sellerId)?.name
        || (isAdmin ? "Administrador" : isSuporte ? "Suporte" : isGerente ? "Gerente" : "Equipe");
      const { data: updated, error } = await supabase.from("pricing_support_requests").update({
        response_notes: responseNotes || null,
        response_pdf_url: respUrl,
        response_pdf_name: respName,
        responded_at: new Date().toISOString(),
        responded_by_name: responderName,
      } as any).eq("id", selectedRequest.id).select("id");
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error("Você não tem permissão para responder esta solicitação (nenhuma linha atualizada).");
      }
      toast.success("Resposta salva!");
      setResponseFile(null);
      setSelectedRequest({
        ...selectedRequest,
        response_notes: responseNotes || undefined,
        response_pdf_url: respUrl || undefined,
        response_pdf_name: respName || undefined,
        responded_at: new Date().toISOString(),
        responded_by_name: responderName,
      });
      fetchRequests();
    } catch (e: any) {
      toast.error("Erro ao salvar resposta: " + e.message);
    } finally {
      setSavingResponse(false);
    }
  };

  const saveRequestEdit = async () => {
    if (!selectedRequest) return;
    setSavingReqEdit(true);
    try {
      let pdfUrl = selectedRequest.pdf_url || null;
      let pdfName = (selectedRequest as any).pdf_name || null;
      if (editReqFile) {
        const ext = editReqFile.name.split(".").pop();
        const filePath = `requests/${selectedRequest.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("pricing_attachments").upload(filePath, editReqFile);
        if (upErr) throw upErr;
        pdfUrl = filePath;
        pdfName = editReqFile.name;
      }
      const { data: updated, error } = await supabase.from("pricing_support_requests").update({
        notes: editReqNotes,
        pdf_url: pdfUrl,
        pdf_name: pdfName,
      } as any).eq("id", selectedRequest.id).select("id");
      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error("Você não tem permissão para editar esta solicitação (nenhuma linha atualizada).");
      }
      toast.success("Solicitação atualizada!");
      setSelectedRequest({ ...selectedRequest, notes: editReqNotes, pdf_url: pdfUrl || undefined, pdf_name: pdfName || undefined } as any);
      setEditReqOpen(false);
      setEditReqFile(null);
      fetchRequests();
    } catch (e: any) {
      toast.error("Erro ao atualizar: " + (e.message || e));
    } finally {
      setSavingReqEdit(false);
    }
  };

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("pricing_attachments").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o anexo.");
      return;
    }
    setPdfRawUrl(data.signedUrl);
    // Baixa como blob e exibe localmente — bloqueadores costumam barrar a URL
    // direta do Supabase, mas não um blob local.
    try {
      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error("download falhou");
      const blob = await res.blob();
      setViewingPdf(URL.createObjectURL(blob));
    } catch {
      setViewingPdf(data.signedUrl);
    }
  };

  const closePdf = () => {
    if (viewingPdf && viewingPdf.startsWith("blob:")) URL.revokeObjectURL(viewingPdf);
    setViewingPdf(null);
    setPdfRawUrl(null);
  };

  const downloadAttachment = async (path: string, name?: string) => {
    const { data, error } = await supabase.storage.from("pricing_attachments").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível baixar o anexo.");
      return;
    }
    try {
      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error("download falhou");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name || path.split("/").pop() || "anexo.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // fallback: abre a URL direta (o navegador faz o download)
      window.open(data.signedUrl, "_blank");
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pricing_support_requests")
        .select(`
          *,
          sellers:seller_id (name)
        `)
        .eq("category", cfg.category)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((r: any) => ({
        ...r,
        vendedor_name: r.sellers?.name || "Vendedor não identificado"
      }));

      setRequests(formatted);
      // Mantém o item aberto no detalhe sincronizado com o banco.
      setSelectedRequest((cur) => (cur ? (formatted.find((x: any) => x.id === cur.id) || cur) : cur));
    } catch (error: any) {
      toast.error("Erro ao carregar solicitações: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Nome do admin, para exibir no campo travado da negociação especial.
  const [adminName, setAdminName] = useState<string>("Administrador");
  useEffect(() => {
    const loadAdmin = async () => {
      const { data, error } = await (supabase as any).rpc("get_admin_display_name");
      if (!error && typeof data === "string" && data) setAdminName(data);
    };
    loadAdmin();
  }, []);
  useEffect(() => {
    const loadSupports = async () => {
      // Usa RPC (SECURITY DEFINER): ler user_roles direto no front retorna vazio
      // para o vendedor, pois a RLS só deixa ver o próprio papel.
      const { data, error } = await (supabase as any).rpc("list_support_sellers");
      if (error) { setStoreSupports([]); return; }
      const list = ((data ?? []) as any[]).map((s) => ({
        id: s.seller_id, name: s.name,
        is_support_supervisor: !!s.is_support_supervisor,
        store_id: s.store_id || null,
        store_name: s.store_name || "Sem loja",
      }));
      // Ordena por loja e, dentro dela, supervisor primeiro, depois alfabético.
      list.sort((a, b) =>
        a.store_name.localeCompare(b.store_name, "pt-BR")
        || (b.is_support_supervisor ? 1 : 0) - (a.is_support_supervisor ? 1 : 0)
        || a.name.localeCompare(b.name, "pt-BR"));
      setStoreSupports(list);
    };
    loadSupports();
  }, [storeId]);

  // Descobre se o usuário logado é supervisor de suporte e qual a loja dele.
  useEffect(() => {
    const loadMine = async () => {
      if (!isSuporte || !sellerId) { setMySupervisorInfo({ isSupervisor: false, storeId: null }); return; }
      const { data } = await supabase
        .from("sellers").select("is_support_supervisor, store_id").eq("id", sellerId).maybeSingle();
      setMySupervisorInfo({
        isSupervisor: !!(data as any)?.is_support_supervisor,
        storeId: (data as any)?.store_id ?? null,
      });
    };
    loadMine();
  }, [isSuporte, sellerId]);

  // Realtime: reflete ao vivo as mudanças de status/resposta entre vendas e suporte.
  useEffect(() => {
    const channel = supabase
      .channel("pricing-support-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pricing_support_requests" }, () => {
        // O alerta de nova solicitação é global (SupportRequestAlerts), para
        // funcionar em qualquer página; aqui só recarrega a lista.
        fetchRequests();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleErpSearch = async () => {
    if (searchingErp) return;
    const query = erpSearch.trim();
    if (query.length < 2) {
      toast.error("Digite pelo menos 2 caracteres para buscar");
      return;
    }
    setSearchingErp(true);
    setErpSearchError("");
    setErpResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("citel-search-name", {
        body: { name: query }
      });
      if (error instanceof FunctionsHttpError) {
        const details = await error.context.text();
        console.error("citel-search-name failed:", details);
        let message = "Não foi possível consultar o ERP. Tente novamente em instantes.";
        try {
          const failure = JSON.parse(details) as { error?: string };
          if (typeof failure.error === "string") message = failure.error;
        } catch { /* Preserve a readable message for non-JSON errors. */ }
        throw new Error(message);
      }
      if (error) throw new Error("Não foi possível conectar ao ERP. Tente novamente em instantes.");
      if (data?.error) throw new Error(data.error);
      if (!data || !Array.isArray(data.results) || typeof data.found !== "boolean") {
        throw new Error("O ERP retornou uma resposta inválida para a busca.");
      }
      setErpResults(data.results || []);
      if (!data.found) toast.info("Nenhum cliente encontrado no ERP");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível consultar o ERP.";
      setErpSearchError(message);
      toast.error(message);
    } finally {
      setSearchingErp(false);
    }
  };

  // ---- Gravação de áudio (MediaRecorder) ----
  const fmtSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const type = mr.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type });
        setAudioBlob(blob);
        setAudioPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
        stream.getTracks().forEach((t) => t.stop()); // libera o microfone
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    try { mediaRecorderRef.current?.stop(); } catch { /* já parado */ }
    setIsRecording(false);
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setAudioPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setRecordSeconds(0);
  };

  // Ao fechar o formulário, encerra qualquer gravação em andamento e limpa o áudio.
  useEffect(() => {
    if (!showForm) {
      if (isRecording) stopRecording();
      clearAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm]);

  // Busca a URL assinada do áudio da solicitação aberta no detalhe.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setDetailAudioUrl(null);
      const path = selectedRequest?.audio_url;
      if (!path) return;
      const { data } = await supabase.storage.from("pricing_attachments").createSignedUrl(path, 3600);
      if (!cancelled && data?.signedUrl) setDetailAudioUrl(data.signedUrl);
    };
    run();
    return () => { cancelled = true; };
  }, [selectedRequest?.id, selectedRequest?.audio_url]);

  const handleSubmit = async () => {
    if (!selectedErpClient) {
      toast.error("Selecione um cliente do ERP");
      return;
    }
    if (!description.trim() && !audioBlob) {
      toast.error("Descreva a solicitação ou grave um áudio.");
      return;
    }
    if (isRecording) {
      toast.error("Pare a gravação do áudio antes de enviar.");
      return;
    }

    setSubmitting(true);
    try {
      let pdfUrl = null;
      if (pdfFile) {
        const fileExt = pdfFile.name.split(".").pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("pricing_attachments")
          .upload(filePath, pdfFile);

        if (uploadError) throw uploadError;
        pdfUrl = filePath;
      }

      // Sobe o áudio gravado (se houver) no mesmo bucket.
      let audioUrl = null;
      if (audioBlob) {
        const ext = audioBlob.type.includes("ogg") ? "ogg" : audioBlob.type.includes("mp4") ? "m4a" : "webm";
        const audioPath = `audio/${crypto.randomUUID()}.${ext}`;
        const { error: audioErr } = await supabase.storage
          .from("pricing_attachments")
          .upload(audioPath, audioBlob, { contentType: audioBlob.type || "audio/webm" });
        if (audioErr) throw audioErr;
        audioUrl = audioPath;
      }

      const { data: inserted, error: insertError } = await (supabase as any)
        .from("pricing_support_requests")
        .insert({
          request_type: requestType as any,
          category: cfg.category,
          client_name: selectedErpClient.name,
          erp_client_id: selectedErpClient.erpId || null,
          notes: description,
          pdf_url: pdfUrl,
          pdf_name: pdfFile?.name,
          audio_url: audioUrl,
          seller_id: sellers.some((s) => s.id === sellerId) ? sellerId : null,
          lead_id: pendingLeadId || null,
          // Escopo por loja + destino escolhido pelo vendedor.
          store_id: storeId || null,
          assigned_to: requestType === "precificacao_especial" ? null : (selectedSupportId || null),
          status: "pendente"
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Registra o direcionamento inicial no histórico (base do SLA por pessoa).
      // Só para orçamento com suporte escolhido (negociação especial vai ao admin).
      if (inserted?.id && requestType !== "precificacao_especial" && selectedSupportId) {
        await (supabase as any).from("support_request_assignments").insert({
          request_id: inserted.id,
          from_seller_id: null,
          to_seller_id: selectedSupportId,
          assigned_by: sellers.some((s) => s.id === sellerId) ? sellerId : null,
          note: "Direcionamento inicial",
        });
      }

      // Veio do Kanban: no modo orçamento, move o card para "Orçamento e Preço".
      // No modo pedido, o card está em Fechamento e não deve ser movido.
      if (pendingLeadId && mode === "orcamento") {
        await supabase.from("leads").update({ stage: "precificacao_especial" }).eq("id", pendingLeadId);
      }

      toast.success("Solicitação enviada com sucesso!");
      setShowForm(false);
      resetForm();
      fetchRequests();
    } catch (error: any) {
      toast.error("Erro ao enviar: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedErpClient(null);
    setDescription("");
    setPdfFile(null);
    clearAudio();
    setErpSearch("");
    setErpResults([]);
    setErpSearchError("");
  };

  // Cliente vindo do Kanban (?cliente=...): pré-preenche a solicitação.
  const [pendingClient, setPendingClient] = useState(() => searchParams.get("cliente") || "");
  // Lead de origem (?lead=...): vincula a solicitação ao card do Kanban.
  const [pendingLeadId] = useState(() => searchParams.get("lead") || "");
  // Ao chegar do Kanban, abre um modal central para escolher o tipo (orçamento
  // ou negociação), em vez de deixar o nome discreto num canto da tela.
  const [showTypeChoice, setShowTypeChoice] = useState(() => !!searchParams.get("cliente"));

  const openNewRequest = (type: RequestType) => {
    resetForm();
    setRequestType(type);
    if (pendingClient) {
      // Pré-seleciona o cliente do Kanban (sem ERP id; o vendedor pode trocar).
      setSelectedErpClient({ name: pendingClient, erpId: "" });
      setPendingClient("");
    }
    setShowTypeChoice(false);
    // Remove ?cliente da URL para o modal não reabrir num F5.
    if (searchParams.get("cliente")) setSearchParams({}, { replace: true });
    setShowForm(true);
  };

  // Encaminhamento: o supervisor repassa a solicitação para um trainee da loja.
  // Muda o responsável (assigned_to) e registra no histórico.
  const forwardRequest = async (requestId: string, toSellerId: string) => {
    const current = requests.find((r) => r.id === requestId);
    try {
      const { error } = await (supabase as any)
        .from("pricing_support_requests")
        .update({ assigned_to: toSellerId })
        .eq("id", requestId);
      if (error) throw error;

      await (supabase as any).from("support_request_assignments").insert({
        request_id: requestId,
        from_seller_id: current?.assigned_to || null,
        to_seller_id: toSellerId,
        assigned_by: sellerId,
        note: "Encaminhado pelo supervisor",
      });

      setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, assigned_to: toSellerId } : r)));
      const toName = storeSupports.find((s) => s.id === toSellerId)?.name || "suporte";
      toast.success(`Encaminhado para ${toName}.`);
    } catch (error: any) {
      toast.error("Erro ao encaminhar: " + error.message);
    }
  };

  // Pausa para almoço: carrega a de hoje (deste usuário) e todas (para descontar
  // o tempo do cálculo de atendimento).
  const todayStr = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  };

  const loadBreaks = async () => {
    const { data } = await (supabase as any)
      .from("support_breaks").select("id, seller_id, started_at, ended_at, break_date");
    const rows = (data ?? []) as any[];
    setAllBreaks(rows.map((b) => ({ seller_id: b.seller_id, started_at: b.started_at, ended_at: b.ended_at })));
    const mine = rows.find((b) => b.seller_id === sellerId && b.break_date === todayStr());
    setMyBreak(mine ? { id: mine.id, started_at: mine.started_at, ended_at: mine.ended_at } : null);
  };

  useEffect(() => { loadBreaks(); }, [sellerId]);

  // Um clique registra a saída; o próximo, a volta. Uma pausa por dia.
  const toggleBreak = async () => {
    if (!sellerId) { toast.error("Seu usuário não tem cadastro de suporte."); return; }
    setBreakSaving(true);
    try {
      if (!myBreak) {
        const { data, error } = await (supabase as any)
          .from("support_breaks")
          .insert({ seller_id: sellerId, break_date: todayStr() })
          .select("id, started_at, ended_at")
          .single();
        if (error) throw error;
        setMyBreak(data);
        toast.success("Pausa iniciada. Bom almoço!");
      } else if (!myBreak.ended_at) {
        const endedAt = new Date().toISOString();
        const { error } = await (supabase as any)
          .from("support_breaks").update({ ended_at: endedAt }).eq("id", myBreak.id);
        if (error) throw error;
        setMyBreak({ ...myBreak, ended_at: endedAt });
        toast.success("Bem-vindo de volta! Pausa encerrada.");
      }
      loadBreaks();
    } catch (e: any) {
      toast.error("Erro na pausa: " + (e?.message || "tente novamente"));
    } finally {
      setBreakSaving(false);
    }
  };

  const updateRequestStatus = async (id: string, status: SupportRequest["status"]) => {
    try {
      // Marca (ou limpa) o momento em que foi para Concluídos — base para ocultar
      // os concluídos antigos. Só grava ao ENTRAR em concluído; preserva se já
      // estava concluído; limpa ao sair.
      const prev = requests.find((r) => r.id === id);
      const patch: any = { status };
      if (status === "concluido") {
        patch.completed_at = prev?.completed_at || new Date().toISOString();
      } else {
        patch.completed_at = null;
      }
      const { data, error } = await supabase
        .from("pricing_support_requests")
        .update(patch)
        .eq("id", id)
        .select("id");

      if (error) throw error;
      // Sem erro mas 0 linhas = bloqueio de RLS. Não deixa a UI mentir "salvo".
      if (!data || data.length === 0) {
        throw new Error("Você não tem permissão para mover esta solicitação (nenhuma linha atualizada).");
      }

      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status, completed_at: patch.completed_at } : r)));
      toast.success("Status atualizado!");
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!canMoveCard) return;
    if (!result.destination) return;
    const destStatus = result.destination.droppableId as SupportRequest["status"];
    if (result.source.droppableId === destStatus) return;
    updateRequestStatus(result.draggableId, destStatus);
  };

  const columns: { id: SupportRequest["status"]; label: string; color: string; icon: any }[] = [
    { id: "pendente", label: "Pendentes", color: "text-warning bg-warning/10 border-warning/20", icon: Clock },
    { id: "em_analise", label: "Em Análise", color: "text-brand-500 bg-brand-500/10 border-primary/20", icon: FileText },
    { id: "concluido", label: "Concluídos", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle },
  ];

  // Supervisor de suporte: usa filtro por suporte (nome) em vez de por tipo.
  const isSupSupervisor = isSuporte && mySupervisorInfo.isSupervisor;
  // Suportes da loja onde o supervisor está cadastrado (inclui ele mesmo).
  const myStoreSupports = storeSupports.filter(
    (s) => s.store_id && s.store_id === mySupervisorInfo.storeId,
  );

  const filteredRequests = requests.filter((r) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !search || 
      r.client_name.toLowerCase().includes(searchLower) || 
      r.vendedor_name?.toLowerCase().includes(searchLower);
    
    const matchesType = filterType === "all" || r.request_type === filterType;
    // Filtro por suporte (só o supervisor troca isso; para os demais fica "all").
    const matchesSupport = filterSupport === "all" || r.assigned_to === filterSupport;

    // Regras de visibilidade
    // - Admin: tudo.
    // - Supervisor de suporte: tudo que está com o time DA LOJA DELE.
    // - Trainee (suporte não-supervisor): só as direcionadas a ele.
    // - Gerente: as de precificação especial (como antes).
    // - Vendedor: as que ele criou/é dono.
    let isVisible = false;
    if (isAdmin) isVisible = true;
    else if (isSuporte && mySupervisorInfo.isSupervisor) {
      // O que importa é o DESTINO: como o vendedor pode direcionar para outra
      // loja, a loja de origem (store_id) não diz quem está atendendo.
      const destinoDaMinhaLoja = !!r.assigned_to && storeSupports.some(
        (s) => s.id === r.assigned_to && s.store_id === mySupervisorInfo.storeId,
      );
      // Sem destino definido, cai para a loja de origem (não fica órfã).
      const semDestinoDaMinhaLoja = !r.assigned_to
        && !!mySupervisorInfo.storeId && r.store_id === mySupervisorInfo.storeId;
      isVisible = destinoDaMinhaLoja || semDestinoDaMinhaLoja
        || r.assigned_to === sellerId || r.created_by === sellerId;
    } else if (isSuporte) {
      // trainee: só o que está atribuído a ele (ou que ele criou).
      isVisible = r.assigned_to === sellerId || r.created_by === sellerId;
    } else if (isGerente && r.request_type === "precificacao_especial") isVisible = true;
    else if (r.created_by === sellerId || r.seller_id === sellerId) isVisible = true;

    // Oculta concluídos com mais de 3 dias de CALENDÁRIO (conta a virada do dia,
    // não 72h corridas): concluído hoje conta dia 0; some no início do 4º dia.
    // Continuam no banco; admin/gerente reexibem com "mostrar ocultos".
    if (isVisible && r.status === "concluido") {
      const ref = r.completed_at || r.responded_at || r.created_at;
      if (ref) {
        const d = new Date(ref);
        const startRef = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const daysPassed = Math.floor((startToday.getTime() - startRef.getTime()) / 86_400_000);
        if (daysPassed > 3) {
          const canReveal = (isAdmin || isGerente) && showHiddenCompleted;
          if (!canReveal) isVisible = false;
        }
      }
    }

    return matchesSearch && matchesType && matchesSupport && isVisible;
  });

  const pendingCount = filteredRequests.filter((r) => r.status === "pendente").length;
  const inAnalysisCount = filteredRequests.filter((r) => r.status === "em_analise").length;
  const completedCount = filteredRequests.filter((r) => r.status === "concluido").length;
  // Minutos de pausa (almoço) do responsável que caem DENTRO da janela de
  // atendimento — esse tempo não conta como demora.
  const breakMinutesInWindow = (sellerIdOfRequest: string | null | undefined, from: Date, to: Date) => {
    if (!sellerIdOfRequest) return 0;
    let mins = 0;
    for (const b of allBreaks) {
      if (b.seller_id !== sellerIdOfRequest) continue;
      const bStart = new Date(b.started_at);
      // Pausa em aberto conta até agora (a pessoa ainda não voltou).
      const bEnd = b.ended_at ? new Date(b.ended_at) : new Date();
      const overlapStart = Math.max(bStart.getTime(), from.getTime());
      const overlapEnd = Math.min(bEnd.getTime(), to.getTime());
      if (overlapEnd > overlapStart) mins += (overlapEnd - overlapStart) / 60000;
    }
    return mins;
  };

  const respondedReqs = filteredRequests.filter((r: any) => r.responded_at && r.created_at);
  const avgResponseMins = respondedReqs.length > 0
    ? Math.round(respondedReqs.reduce((acc: number, r: any) => {
        const from = new Date(r.created_at);
        const to = new Date(r.responded_at);
        const gross = (to.getTime() - from.getTime()) / 60000;
        const paused = breakMinutesInWindow(r.assigned_to, from, to);
        return acc + Math.max(0, gross - paused);
      }, 0) / respondedReqs.length)
    : null;
  const avgResponseLabel = avgResponseMins == null ? "—" : avgResponseMins < 60 ? `${avgResponseMins} min` : `${(avgResponseMins / 60).toFixed(1)} h`;

  return (
    <AppLayout title={cfg.title}>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-medium text-foreground">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15">
                <FileText className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <p className="text-2xl font-medium text-foreground">{inAnalysisCount}</p>
                <p className="text-xs text-muted-foreground">Em Análise</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-medium text-foreground">{completedCount}</p>
                <p className="text-xs text-muted-foreground">Concluídos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-medium text-foreground">{avgResponseLabel}</p>
                <p className="text-xs text-muted-foreground">Tempo médio de resposta</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar solicitação..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {isSupSupervisor ? (
              <Select value={filterSupport} onValueChange={setFilterSupport}>
                <SelectTrigger className="w-52 shrink-0">
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os suportes</SelectItem>
                  {myStoreSupports.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.id === sellerId ? `${s.name} (você)` : s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40 shrink-0">
                  <Filter className="h-3.5 w-3.5 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="orcamento">Orçamento</SelectItem>
                  <SelectItem value="precificacao_especial">Prec. Especial</SelectItem>
                </SelectContent>
              </Select>
            )}
            {(isAdmin || isGerente) && (
              <Button
                variant={showHiddenCompleted ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHiddenCompleted((v) => !v)}
                className="h-9 gap-1.5 text-xs shrink-0"
                title="Concluídos com mais de 3 dias ficam ocultos"
              >
                {showHiddenCompleted ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {showHiddenCompleted ? "Ocultando antigos" : "Mostrar ocultos"}
              </Button>
            )}
            {(isSuporte || isAdmin) && notifPermission !== "granted" && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const p = await requestPermission();
                  if (p === "granted") toast.success("Alertas ativados neste computador.");
                  else toast.error("O navegador bloqueou as notificações. Libere nas configurações do site.");
                }}
                className="h-9 gap-1.5 text-xs shrink-0"
                title="Avisa no computador quando chegar uma solicitação, mesmo fora do sistema"
              >
                <Bell className="h-3.5 w-3.5" /> Ativar alertas
              </Button>
            )}
            {/* Pausa para almoço: uma por dia. Sai -> volta. O tempo parado não
                conta como demora nas solicitações pendentes/em análise. */}
            {isSuporte && sellerId && (() => {
              // Duração da pausa: fechada usa o fim; em aberto conta até agora.
              const mins = myBreak
                ? Math.max(0, Math.round(
                    ((myBreak.ended_at ? new Date(myBreak.ended_at).getTime() : nowTick)
                      - new Date(myBreak.started_at).getTime()) / 60000))
                : 0;
              const label = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
              const hora = (iso: string) =>
                new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              return (
                <div className="relative flex items-center shrink-0">
                  <Button
                    variant={myBreak && !myBreak.ended_at ? "default" : "outline"}
                    size="sm"
                    onClick={toggleBreak}
                    disabled={breakSaving || !!(myBreak && myBreak.ended_at)}
                    className="h-9 gap-1.5 text-xs"
                    title={myBreak?.ended_at ? "A pausa de hoje já foi registrada" : "Registra a saída e a volta do almoço"}
                  >
                    <Coffee className="h-3.5 w-3.5" />
                    {!myBreak ? "Sair para almoço"
                      : !myBreak.ended_at ? "Voltar do almoço"
                      : "Almoço registrado"}
                  </Button>
                  {myBreak && (
                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-0.5 whitespace-nowrap text-[10px] text-muted-foreground">
                      {myBreak.ended_at
                        ? `${hora(myBreak.started_at)}–${hora(myBreak.ended_at)} · ${label}`
                        : `em pausa desde ${hora(myBreak.started_at)} · ${label}`}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="flex flex-col gap-2 items-end">
            <div className="flex gap-2">
              <Button
                onClick={() => openNewRequest(cfg.type1.key)}
                className="bg-brand-500"
                size="sm"
              >
                <FileText className="h-3.5 w-3.5 mr-1" /> {cfg.type1.label}
              </Button>
              <Button
                onClick={() => openNewRequest(cfg.type2.key)}
                variant="outline"
                size="sm"
                className="border-kanban-recommendation text-kanban-recommendation hover:bg-kanban-recommendation/10"
              >
                <DollarSign className="h-3.5 w-3.5 mr-1" /> {cfg.type2.label}
              </Button>
            </div>
          </div>
        </div>

        {/* Escolha do tipo ao chegar do Kanban (pop-up central) */}
        <Dialog open={showTypeChoice} onOpenChange={(o) => {
          setShowTypeChoice(o);
          if (!o) {
            setPendingClient(""); // fechou sem escolher: descarta o pré-preenchimento
            if (searchParams.get("cliente")) setSearchParams({}, { replace: true });
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>O que você quer solicitar?</DialogTitle>
              <DialogDescription>
                {pendingClient
                  ? <>Para o cliente <strong>{pendingClient}</strong>. Escolha uma opção abaixo.</>
                  : "Escolha uma opção abaixo."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              <button
                onClick={() => openNewRequest(cfg.type1.key)}
                className="flex flex-col items-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/5 p-4 text-center hover:bg-brand-500/10 transition-colors"
              >
                <FileText className="h-7 w-7 text-brand-500" />
                <span className="font-bold text-sm">{cfg.type1.label}</span>
                <span className="text-[11px] text-muted-foreground">{cfg.type1.desc}</span>
              </button>
              <button
                onClick={() => openNewRequest(cfg.type2.key)}
                className="flex flex-col items-center gap-2 rounded-xl border border-kanban-recommendation/40 bg-kanban-recommendation/5 p-4 text-center hover:bg-kanban-recommendation/10 transition-colors"
              >
                <DollarSign className="h-7 w-7 text-kanban-recommendation" />
                <span className="font-bold text-sm">{cfg.type2.label}</span>
                <span className="text-[11px] text-muted-foreground">{cfg.type2.desc}</span>
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* New request form */}
        {showForm && (
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {cfg.dialogTitle(requestType)}
              </CardTitle>
              <CardDescription>
                {cfg.dialogSubtitle(requestType)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Lead / Cliente</label>
                {!selectedErpClient ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Buscar por nome no ERP..." 
                          value={erpSearch}
                          onChange={(e) => setErpSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter") return;
                            e.preventDefault();
                            void handleErpSearch();
                          }}
                          disabled={searchingErp}
                          className="pl-9"
                        />
                      </div>
                      <Button size="sm" onClick={handleErpSearch} disabled={searchingErp} variant="secondary">
                        {searchingErp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                      </Button>
                    </div>
                    {erpSearchError && <p role="alert" className="text-sm text-destructive">{erpSearchError}</p>}
                    {erpResults.length > 0 && (
                      <div className="max-h-60 overflow-y-auto border rounded-md divide-y bg-background shadow-sm animate-in fade-in slide-in-from-top-1">
                        {erpResults.map((client) => (
                          <div 
                            key={client.erpId} 
                            className="p-3 hover:bg-muted/50 cursor-pointer transition-colors group"
                            onClick={() => setSelectedErpClient(client)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="space-y-0.5">
                                <p className="text-sm font-semibold group-hover:text-brand-500 transition-colors">{client.name}</p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                                  <span className="bg-muted px-1.5 py-0.5 rounded">COD: {client.erpId}</span>
                                  {client.document && <span>{client.document}</span>}
                                  {client.phone && <span>• {client.phone}</span>}
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <CheckCircle className="h-4 w-4 text-brand-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-brand-500/5 border-brand-500/20 animate-in zoom-in-95">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-brand-500/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-brand-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-brand-600">{selectedErpClient.name}</p>
                        <p className="text-[10px] text-muted-foreground">{selectedErpClient.erpId ? `ERP ID: ${selectedErpClient.erpId}` : "Cliente do Kanban — busque no ERP para vincular"}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => {
                        setSelectedErpClient(null);
                        setErpResults([]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {/* Direcionar para: negociação especial vai travada ao admin;
                  orçamento escolhe um suporte da loja do vendedor. */}
              {requestType === "precificacao_especial" ? (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Direcionar para</label>
                  <Input value={`${adminName} · Administrador`} disabled readOnly />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Negociações especiais vão direto para a alçada do administrador.
                  </p>
                </div>
              ) : storeSupports.length > 0 ? (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Direcionar para</label>
                  <Select value={selectedSupportId || "none"} onValueChange={(v) => setSelectedSupportId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Escolha a loja e o suporte..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sem direcionamento —</SelectItem>
                      {/* A loja do próprio vendedor vem primeiro (é a que ele
                          mais usa); as demais em ordem alfabética. */}
                      {(() => {
                        const nomes = Array.from(new Set(storeSupports.map((s) => s.store_name)));
                        const minhaLoja = storeSupports.find((s) => s.store_id === storeId)?.store_name;
                        nomes.sort((a, b) =>
                          (a === minhaLoja ? -1 : b === minhaLoja ? 1 : 0)
                          || a.localeCompare(b, "pt-BR"));
                        return nomes;
                      })().map((storeName) => (
                        <SelectGroup key={storeName}>
                          <SelectLabel>{storeName}{storeName === storeSupports.find((s) => s.store_id === storeId)?.store_name ? " · sua loja" : ""}</SelectLabel>
                          {storeSupports.filter((s) => s.store_name === storeName).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}{s.is_support_supervisor ? " · Supervisor" : ""}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Descrição / Observações</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes da solicitação..."
                  rows={3}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Anexar PDF (opcional)</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    id="pdf-upload"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  />
                  <label
                    htmlFor="pdf-upload"
                    className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-md cursor-pointer border border-input transition-colors text-xs font-medium"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {pdfFile ? pdfFile.name : "Selecionar arquivo PDF"}
                  </label>
                  {pdfFile && (
                    <Button variant="ghost" size="sm" onClick={() => setPdfFile(null)} className="h-8 text-destructive">
                      Remover
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Áudio (opcional)</label>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {!isRecording && !audioBlob && (
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={startRecording}>
                      <Mic className="h-3.5 w-3.5" /> Gravar áudio
                    </Button>
                  )}
                  {isRecording && (
                    <Button type="button" variant="destructive" size="sm" className="h-8 gap-1.5" onClick={stopRecording}>
                      <Square className="h-3.5 w-3.5" /> Parar
                      <span className="ml-1 inline-flex items-center gap-1 tabular-nums">
                        <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> {fmtSeconds(recordSeconds)}
                      </span>
                    </Button>
                  )}
                  {!isRecording && audioBlob && audioPreviewUrl && (
                    <>
                      <audio controls src={audioPreviewUrl} className="h-9 max-w-[220px]" />
                      <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => { clearAudio(); startRecording(); }}>
                        <Mic className="h-3.5 w-3.5" /> Regravar
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive gap-1.5" onClick={clearAudio}>
                        <Trash2 className="h-3.5 w-3.5" /> Remover
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleSubmit} disabled={submitting || isRecording}>
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                  Enviar Solicitação
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            {/* As 3 colunas cabem SEMPRE na largura da tela (grid), sem rolagem
                lateral. Antes era uma faixa com rolagem horizontal dentro da página
                (rolagem aninhada): a coluna "Concluídos" ficava fora da tela e o
                arraste não rolava até ela — o suporte não conseguia mover os cards. */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6">
              {columns.map((col) => {
                const colRequests = filteredRequests.filter((r) => r.status === col.id);
                const colIdx = columns.findIndex((c) => c.id === col.id);
                const nextCol = columns[colIdx + 1];
                return (
                  <div key={col.id} className="min-w-0 flex flex-col bg-muted/30 rounded-[14px] border border-border/40 min-h-[300px] md:min-h-[500px]">
                    <div className={`p-3 border-b border-border/40 rounded-t-xl flex items-center justify-between ${col.color}`}>
                      <div className="flex items-center gap-2">
                        <col.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{col.label}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{colRequests.length}</Badge>
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`p-3 space-y-3 min-h-[400px] ${snapshot.isDraggingOver ? "bg-brand-500/5" : ""}`}
                        >
                          {colRequests.map((req, index) => (
                            <Draggable key={req.id} draggableId={req.id} index={index} isDragDisabled={!canMoveCard}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  onClick={() => setSelectedRequest(req)}
                                  className={`shadow-sm hover:shadow-md hover:ring-1 hover:ring-brand-500/30 transition-all cursor-pointer select-none ${snapshot.isDragging ? "rotate-2 shadow-xl ring-2 ring-primary/20" : ""}`}
                                >
                                  <CardContent className="p-3 space-y-2">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="text-xs font-bold truncate flex-1">{req.client_name}</span>
                                      <Badge variant="outline" className="text-[9px] uppercase">
                                        {cfg.badge(req.request_type)}
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground line-clamp-2 italic">"{req.notes}"</p>
                                    <div className="flex justify-between items-center text-[9px] text-muted-foreground pt-1 border-t border-border/10">
                                      <span className="truncate max-w-[120px]">{req.vendedor_name}</span>
                                      <span>{new Date(req.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                      {req.pdf_url && (
                                        <Button 
                                          variant="secondary" 
                                          className="h-6 px-2 text-[9px] font-semibold bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 border-none"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openAttachment(req.pdf_url!);
                                          }}
                                        >
                                          <Paperclip className="h-3 w-3 mr-1" />
                                          PDF
                                        </Button>
                                      )}
                                      {req.audio_url && (
                                        <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[9px] font-semibold bg-brand-500/10 text-brand-500" title="Tem áudio">
                                          <Mic className="h-3 w-3" /> Áudio
                                        </span>
                                      )}
                                      {canMoveCard && nextCol && (
                                        <Button
                                          variant="outline"
                                          className="h-6 px-2 text-[9px] font-semibold ml-auto"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateRequestStatus(req.id, nextCol.id);
                                          }}
                                        >
                                          {nextCol.label} →
                                        </Button>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}

        {/* Detalhes da solicitação */}
        <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <DialogContent className="rounded-2xl max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedRequest?.request_type === "orcamento"
                  ? <FileText className="h-5 w-5 text-brand-500" />
                  : <DollarSign className="h-5 w-5 text-kanban-recommendation" />}
                {selectedRequest?.client_name}
              </DialogTitle>
              <DialogDescription>
                {selectedRequest?.request_type === "orcamento" ? "Solicitação de orçamento" : "Negociação / precificação especial"}
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-3 py-1 text-sm min-w-0 overflow-hidden">
                <div className="rounded-xl bg-muted/40 p-3 space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Vendedor</span>
                    <span className="font-medium text-right">{selectedRequest.vendedor_name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Data</span>
                    <span className="font-medium">{new Date(selectedRequest.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {selectedRequest.status === "pendente" ? "Pendente" : selectedRequest.status === "em_analise" ? "Em análise" : "Concluído"}
                    </Badge>
                  </div>
                  {/* Responsável atual */}
                  {selectedRequest.assigned_to && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Responsável</span>
                      <span className="font-medium text-right">
                        {storeSupports.find((s) => s.id === selectedRequest.assigned_to)?.name || "—"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Encaminhar: só o supervisor de suporte pode repassar a um trainee */}
                {mySupervisorInfo.isSupervisor && (
                  <div className="rounded-xl border border-brand-500/20 bg-brand-500/[0.03] p-3 space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Forward className="h-3.5 w-3.5" /> Encaminhar para
                    </span>
                    <Select
                      value={selectedRequest.assigned_to || "none"}
                      onValueChange={(v) => { if (v !== "none" && v !== selectedRequest.assigned_to) forwardRequest(selectedRequest.id, v); }}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Escolha um suporte..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>Escolha um suporte...</SelectItem>
                        {/* O supervisor pode redirecionar para outra loja (ex.:
                            chegou na loja errada). A dele aparece primeiro. */}
                        {(() => {
                          const nomes = Array.from(new Set(storeSupports.map((s) => s.store_name)));
                          const minha = storeSupports.find((s) => s.store_id === mySupervisorInfo.storeId)?.store_name;
                          nomes.sort((a, b) =>
                            (a === minha ? -1 : b === minha ? 1 : 0) || a.localeCompare(b, "pt-BR"));
                          return nomes.map((storeName) => {
                            const itens = storeSupports.filter((s) => s.store_name === storeName && s.id !== sellerId);
                            if (itens.length === 0) return null;
                            return (
                              <SelectGroup key={storeName}>
                                <SelectLabel>{storeName}{storeName === minha ? " · sua loja" : ""}</SelectLabel>
                                {itens.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}{s.is_support_supervisor ? " · Supervisor" : ""}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            );
                          });
                        })()}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground">Repassa a solicitação para outro suporte da loja.</p>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Detalhes</span>
                  <p className="rounded-xl border border-border/40 p-3 whitespace-pre-wrap">{selectedRequest.notes || "—"}</p>
                </div>

                {selectedRequest.audio_url && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Mic className="h-3.5 w-3.5" /> Áudio da solicitação</span>
                    {detailAudioUrl ? (
                      <audio controls src={detailAudioUrl} className="w-full h-10" />
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando áudio…</div>
                    )}
                  </div>
                )}

                {selectedRequest.pdf_url && (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1 rounded-xl bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 border-none"
                      onClick={() => openAttachment(selectedRequest.pdf_url!)}
                    >
                      <Paperclip className="h-4 w-4 mr-1" /> Abrir anexo
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      title="Baixar anexo"
                      onClick={() => downloadAttachment(selectedRequest.pdf_url!, selectedRequest.pdf_name)}
                    >
                      <Download className="h-4 w-4 mr-1" /> Baixar
                    </Button>
                  </div>
                )}

                {/* Edição da própria solicitação (2.6) — para quem criou */}
                {(selectedRequest.created_by === sellerId || selectedRequest.seller_id === sellerId || isAdmin) && (
                  editReqOpen ? (
                    <div className="rounded-xl border border-amber-300/60 bg-amber-50/50 p-3 space-y-2">
                      <span className="text-xs font-semibold text-amber-700">Editar solicitação</span>
                      <Textarea value={editReqNotes} onChange={(e) => setEditReqNotes(e.target.value)} rows={3} placeholder="Detalhes da solicitação..." />
                      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                        <Paperclip className="h-3.5 w-3.5" />
                        <span className="truncate">{editReqFile ? editReqFile.name : "Anexar/substituir arquivo (opcional)"}</span>
                        <input type="file" className="hidden" onChange={(e) => setEditReqFile(e.target.files?.[0] || null)} />
                      </label>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => { setEditReqOpen(false); setEditReqFile(null); }}>Cancelar</Button>
                        <Button size="sm" onClick={saveRequestEdit} disabled={savingReqEdit}>{savingReqEdit ? "Salvando..." : "Salvar"}</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setEditReqNotes(selectedRequest.notes || ""); setEditReqFile(null); setEditReqOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar solicitação
                    </Button>
                  )
                )}

                {/* Resposta do suporte/admin (exibição) */}
                {(selectedRequest.response_notes || selectedRequest.response_pdf_url) && (
                  <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand-500">Resposta do suporte</span>
                      {selectedRequest.responded_at && (
                        <span className="text-[10px] text-muted-foreground">
                          {selectedRequest.responded_by_name} · {new Date(selectedRequest.responded_at).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                    {selectedRequest.response_notes && (
                      <p className="text-sm whitespace-pre-wrap">{selectedRequest.response_notes}</p>
                    )}
                    {selectedRequest.response_pdf_url && (
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="rounded-lg bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 border-none" onClick={() => openAttachment(selectedRequest.response_pdf_url!)}>
                          <Paperclip className="h-3.5 w-3.5 mr-1" /> Ver anexo da resposta
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => downloadAttachment(selectedRequest.response_pdf_url!, selectedRequest.response_pdf_name)}>
                          <Download className="h-3.5 w-3.5 mr-1" /> Baixar
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Formulário de resposta (suporte/admin/gerente) */}
                {canRespond && (
                  <div className="rounded-xl border border-border/50 p-3 space-y-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {selectedRequest.response_notes || selectedRequest.response_pdf_url ? "Editar resposta" : "Responder solicitação"}
                    </span>
                    <Textarea
                      value={responseNotes}
                      onChange={(e) => setResponseNotes(e.target.value)}
                      placeholder="Escreva a resposta para o vendedor (ex.: orçamento aprovado, condições, observações)..."
                      className="min-h-[70px] text-sm"
                    />
                    <div className="flex items-center gap-2 min-w-0">
                      <label className="flex-1 min-w-0">
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => setResponseFile(e.target.files?.[0] || null)}
                        />
                        <span className="flex items-center gap-1.5 cursor-pointer text-xs rounded-lg border border-dashed border-border px-3 py-2 hover:bg-muted/50 overflow-hidden">
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{responseFile ? responseFile.name : "Anexar arquivo (opcional)"}</span>
                        </span>
                      </label>
                      {responseFile && (
                        <Button variant="ghost" size="sm" className="h-8 text-destructive shrink-0" onClick={() => setResponseFile(null)}>Remover</Button>
                      )}
                    </div>
                    <Button
                      className="w-full rounded-xl bg-brand-500 hover:bg-brand-600"
                      disabled={savingResponse || (!responseNotes.trim() && !responseFile && !selectedRequest.response_notes && !selectedRequest.response_pdf_url)}
                      onClick={submitResponse}
                    >
                      {savingResponse ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                      Enviar resposta
                    </Button>
                  </div>
                )}

                {canMoveCard && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs text-muted-foreground">Mover para</span>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { key: "pendente", label: "Pendente" },
                      { key: "em_analise", label: "Em análise" },
                      { key: "concluido", label: "Concluído" },
                    ] as const).map((s) => (
                      <Button
                        key={s.key}
                        size="sm"
                        variant={selectedRequest.status === s.key ? "default" : "outline"}
                        className="rounded-xl text-xs"
                        disabled={selectedRequest.status === s.key}
                        onClick={async () => {
                          await updateRequestStatus(selectedRequest.id, s.key);
                          setSelectedRequest({ ...selectedRequest, status: s.key });
                        }}
                      >
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" className="rounded-xl" onClick={() => setSelectedRequest(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Visualizador de PDF embutido */}
        <Dialog open={!!viewingPdf} onOpenChange={(open) => !open && closePdf()}>
          <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 overflow-hidden flex flex-col">
            <DialogHeader className="px-4 py-3 border-b">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Paperclip className="h-4 w-4 text-brand-500" /> Anexo do orçamento
              </DialogTitle>
            </DialogHeader>
            {viewingPdf && (
              <iframe src={viewingPdf} title="Anexo PDF" className="flex-1 w-full border-0" />
            )}
            <div className="px-4 py-2 border-t text-center">
              <a href={pdfRawUrl || "#"} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-500 hover:underline">
                Não carregou? Abrir em nova aba
              </a>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
