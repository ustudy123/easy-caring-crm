 import { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
   import { Search, ArrowLeft, Send, Phone, User, CheckCheck, Smile, Paperclip, Mic, MoreVertical, MessageCircle, Clock, Lock, ChevronUp, ChevronDown, X, Users, Store, UserCheck, AlertCircle, ShieldAlert, Forward, ListFilter, Check, Link2, Plus } from "lucide-react";
import { Trash2, Tag } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useRole } from "@/contexts/RoleContext";
import { useCrm } from "@/contexts/CrmContext";
import { KANBAN_STAGES, CLIENT_TYPE_EQUIPE_INTERNA, CLIENT_TYPES } from "@/types/crm";
import { useSearchParams } from "react-router-dom";
import { EmojiPicker } from "@/components/EmojiPicker";
 import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Textarea } from "@/components/ui/textarea";
 import { Label } from "@/components/ui/label";
 import { InstanceBadge } from "@/components/InstanceBadge";
 import { useInstances } from "@/hooks/useInstances";
const ChatMessageBody = memo(({ body, chatSearch, isCurrentOccurrence }: { body: string | null; chatSearch: string; isCurrentOccurrence: boolean }) => {
  const content = useMemo(() => {
    if (!chatSearch || chatSearch.length < 2 || !body) return body || "";
    try {
      const parts = body.split(new RegExp(`(${chatSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
      return parts.map((part, i) => 
        part.toLowerCase() === chatSearch.toLowerCase() ? (
          <mark key={i} className={cn(
            "bg-yellow-200 text-black px-0.5 rounded-sm transition-colors duration-200",
            isCurrentOccurrence && "bg-orange-400 text-white"
          )}>
            {part}
          </mark>
        ) : part
      );
    } catch (e) {
      return body || "";
    }
  }, [body, chatSearch, isCurrentOccurrence]);

  return (
    <p className="whitespace-pre-wrap break-words text-foreground">
      {content}
    </p>
  );
});

ChatMessageBody.displayName = "ChatMessageBody";


// ── Types ──
interface WhatsAppMessage {
  id: string;
  message_id: string;
  phone: string;
  body: string | null;
  is_from_me: boolean | null;
  timestamp: string | null;
  created_at: string | null;
  is_read?: boolean;
  media_url?: string | null;
  media_type?: string | null;
}

 interface Conversation {
   phone: string;
   lastMessage: string;
   lastTimestamp: string;
   lastFromMe?: boolean;
   unreadCount: number;
   messages: WhatsAppMessage[];
   assigned_seller_id?: string | null;
   store_id?: string | null;
   status?: string;
   claimed_at?: string | null;
  last_message_from_client_at?: string | null;
  alert_status?: 'none' | 'yellow' | 'red' | 'transferred' | 'critical';
  received_on_instance_id?: string | null;
 }
 
 type TabType = 'minhas' | 'loja' | 'geral' | 'todas' | 'equipe_interna';

// ── Helpers ──
function formatMessageDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM/yy");
}

function formatFullDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return "HOJE";
  if (isYesterday(date)) return "ONTEM";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

function groupMessagesByDate(messages: WhatsAppMessage[]) {
  const groups: Record<string, WhatsAppMessage[]> = {};
  messages.forEach((msg) => {
    const dateKey = format(new Date(msg.timestamp || msg.created_at || ""), "yyyy-MM-dd");
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(msg);
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function formatPhone(phone: string) {
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 13)
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  if (clean.length === 12)
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  return phone;
}

function normalizePhone(phone: string) {
  return (phone || "").replace(/\D/g, "");
}

// Busca todas as linhas de uma query paginando de 1000 em 1000. O Supabase
// corta em 1000 por padrão e, com ordenação ascendente, isso esconde as linhas
// MAIS NOVAS quando há mais que isso (ex.: mensagens recém-enviadas somem).
async function fetchAllRows(
  makeQuery: (from: number, to: number) => any,
): Promise<{ data: any[]; error?: any }> {
  const pageSize = 1000;
  let all: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error) return { data: all, error };
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
  }
  return { data: all };
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── Mock data ──
const now = new Date();
const mockMessages: WhatsAppMessage[] = [
  { id: "m1", message_id: "mock1", phone: "5511999887766", body: "Olá, gostaria de saber o preço da tinta acrílica Suvinil 18L", is_from_me: false, timestamp: new Date(now.getTime() - 3600000 * 3).toISOString(), created_at: null },
  { id: "m2", message_id: "mock2", phone: "5511999887766", body: "Claro! A tinta acrílica Suvinil 18L está por R$ 289,90. Temos pronta entrega. Deseja reservar?", is_from_me: true, timestamp: new Date(now.getTime() - 3600000 * 2.5).toISOString(), created_at: null },
  { id: "m3", message_id: "mock3", phone: "5511999887766", body: "Ótimo! Pode reservar 2 latas na cor Branco Neve pra mim?", is_from_me: false, timestamp: new Date(now.getTime() - 3600000 * 2).toISOString(), created_at: null },
  { id: "m4", message_id: "mock4", phone: "5511999887766", body: "Reservado! Pode retirar até amanhã às 18h. Total: R$ 579,80 👍", is_from_me: true, timestamp: new Date(now.getTime() - 3600000 * 1.5).toISOString(), created_at: null },
  { id: "m5", message_id: "mock5", phone: "5521988776655", body: "Bom dia! Vocês fazem entrega em Niterói?", is_from_me: false, timestamp: new Date(now.getTime() - 86400000).toISOString(), created_at: null },
  { id: "m6", message_id: "mock6", phone: "5521988776655", body: "Bom dia, Maria! Sim, entregamos em Niterói. O frete sai por R$ 35,00 para pedidos acima de R$ 200.", is_from_me: true, timestamp: new Date(now.getTime() - 86400000 + 1800000).toISOString(), created_at: null },
  { id: "m7", message_id: "mock7", phone: "5521988776655", body: "Perfeito! Vou montar meu pedido e te mando a lista", is_from_me: false, timestamp: new Date(now.getTime() - 86400000 + 3600000).toISOString(), created_at: null },
  { id: "m8", message_id: "mock8", phone: "5531977665544", body: "Preciso de um orçamento para 50 latas de tinta latex para obra comercial", is_from_me: false, timestamp: new Date(now.getTime() - 86400000 * 2).toISOString(), created_at: null },
  { id: "m9", message_id: "mock9", phone: "5531977665544", body: "Boa tarde, Carlos! Para essa quantidade temos condições especiais. Qual a cor e marca de preferência?", is_from_me: true, timestamp: new Date(now.getTime() - 86400000 * 2 + 3600000).toISOString(), created_at: null },
  { id: "m10", message_id: "mock10", phone: "5531977665544", body: "Pode ser Coral, cor Branco Gelo. Preciso para a semana que vem", is_from_me: false, timestamp: new Date(now.getTime() - 86400000 * 2 + 7200000).toISOString(), created_at: null },
  { id: "m11", message_id: "mock11", phone: "5531977665544", body: "Montei o orçamento: 50 latas Coral Látex Branco Gelo 18L por R$ 12.450,00 com frete grátis. Posso enviar o PDF?", is_from_me: true, timestamp: new Date(now.getTime() - 86400000 * 1.5).toISOString(), created_at: null },
  { id: "m12", message_id: "mock12", phone: "5541966554433", body: "Oi! Vocês têm tinta com efeito cimento queimado?", is_from_me: false, timestamp: new Date(now.getTime() - 3600000 * 5).toISOString(), created_at: null },
  { id: "m13", message_id: "mock13", phone: "5541966554433", body: "Temos sim! A linha Efeito Decorativo da Suvinil. Temos em estoque nas cores Concreto, Grafite e Areia.", is_from_me: true, timestamp: new Date(now.getTime() - 3600000 * 4).toISOString(), created_at: null },
  { id: "m14", message_id: "mock14", phone: "5541966554433", body: "Quanto rende cada galão?", is_from_me: false, timestamp: new Date(now.getTime() - 3600000 * 3.5).toISOString(), created_at: null },
  { id: "m15", message_id: "mock15", phone: "5541966554433", body: "Cada galão de 5L rende cerca de 15m². Para um ambiente de 40m² recomendo 3 galões. O valor unitário é R$ 189,90.", is_from_me: true, timestamp: new Date(now.getTime() - 3600000).toISOString(), created_at: null },
  { id: "m16", message_id: "mock16", phone: "5511955443322", body: "Fala pessoal! Tem rolo de lã 23cm anti-respingo?", is_from_me: false, timestamp: new Date(now.getTime() - 7200000).toISOString(), created_at: null },
  { id: "m17", message_id: "mock17", phone: "5511955443322", body: "Tem sim, Roberto! R$ 32,90 cada. Quer quantos?", is_from_me: true, timestamp: new Date(now.getTime() - 5400000).toISOString(), created_at: null },
];

const mockContactNames: Record<string, string> = {
  "5511999887766": "João Silva",
  "5521988776655": "Maria Oliveira",
  "5531977665544": "Carlos Construções",
  "5541966554433": "Ana Decorações",
  "5511955443322": "Roberto Pintor",
};

// ── Component ──
 export default function Conversas() {
     const { isAdmin, isGerente, isVendedor, isSuporte, sellerId, storeId, role } = useRole();
    const { decrementUnreadWhatsApp, leads, updateLead } = useCrm();
    const { instances: allInstances, byId: instancesById } = useInstances();
    const [instanceFilter, setInstanceFilter] = useState<string>("all");
    const [stageFilter, setStageFilter] = useState<string>("all");
    const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('minhas');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  // Telefones abertos que ainda não têm mensagem no WhatsApp (conversa "vazia" para iniciar).
  const [virtualPhones, setVirtualPhones] = useState<string[]>([]);
  // Reclassificação do tipo de cliente a partir da aba Equipe Interna.
  const [reclassifyPhone, setReclassifyPhone] = useState<string | null>(null);
  const [reclassifyType, setReclassifyType] = useState<string>("");
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [isSearchingInChat, setIsSearchingInChat] = useState(false);
  const [searchOccurrenceIndex, setSearchOccurrenceIndex] = useState(0);
  const searchResultsRefs = useRef<(HTMLDivElement | null)[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [useMock, setUseMock] = useState(false);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});
  const [contactPhotos, setContactPhotos] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
 const [isRecording, setIsRecording] = useState(false);
 const [recordingDuration, setRecordingDuration] = useState(0);
 const mediaRecorderRef = useRef<MediaRecorder | null>(null);
 const audioChunksRef = useRef<Blob[]>([]);
 const timerIntervalRef = useRef<number | null>(null);
 const cancelledRecordingRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [staleAlertConversation, setStaleAlertConversation] = useState<Conversation | null>(null);
  const hasDismissedStaleAlert = useRef<Set<string>>(new Set());
   const [isClaiming, setIsClaiming] = useState(false);
   const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
   const [sellers, setSellers] = useState<any[]>([]);
   const [selectedTransferSeller, setSelectedTransferSeller] = useState<string>("");
  const [transferReason, setTransferReason] = useState("");
   const [isTransferring, setIsTransferring] = useState(false);

   // "Associar conversa": categoria do contato + vínculo com cliente do ERP
   const [isAssocModalOpen, setIsAssocModalOpen] = useState(false);
   const [assocCategory, setAssocCategory] = useState<string>("");
   const [erpSearchQuery, setErpSearchQuery] = useState("");
   const [erpSearching, setErpSearching] = useState(false);
   const [erpResults, setErpResults] = useState<any[]>([]);
   const [selectedErpClient, setSelectedErpClient] = useState<any | null>(null);
   const [savingAssoc, setSavingAssoc] = useState(false);

   // Nova conversa (iniciar ativamente com um número)
   const [newChatOpen, setNewChatOpen] = useState(false);
   const [newChatPhone, setNewChatPhone] = useState("");
   const [newChatName, setNewChatName] = useState("");
   const [newChatMessage, setNewChatMessage] = useState("");
   const [newChatSending, setNewChatSending] = useState(false);
   // Busca de cliente (ERP) para preencher a nova conversa
   const [newChatSearch, setNewChatSearch] = useState("");
   const [newChatResults, setNewChatResults] = useState<any[]>([]);
   const [newChatSearching, setNewChatSearching] = useState(false);
   const [newChatErpClient, setNewChatErpClient] = useState<any | null>(null);

   const handleNewChatSearch = async () => {
     if (newChatSearch.trim().length < 2) { toast.error("Digite pelo menos 2 caracteres"); return; }
     setNewChatSearching(true);
     try {
       const { data, error } = await supabase.functions.invoke("citel-search-name", { body: { name: newChatSearch.trim() } });
       if (error) throw error;
       setNewChatResults(data?.results || []);
       if (!data?.found) toast.info("Nenhum cliente encontrado no ERP");
     } catch (e: any) {
       toast.error("Erro na busca: " + (e.message || e));
     } finally {
       setNewChatSearching(false);
     }
   };

   const pickNewChatClient = (c: any) => {
     if (c.phone) setNewChatPhone(String(c.phone));
     setNewChatName(c.name || "");
     setNewChatErpClient(c);
     setNewChatResults([]);
     setNewChatSearch("");
   };

    const fetchData = useCallback(async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [msgsRes, clientsRes, sellersRes, storesRes] = await Promise.all([
           fetchAllRows((f, t) => supabase.from("whatsapp_messages").select("*").order("timestamp", { ascending: true }).range(f, t)),
           fetchAllRows((f, t) => supabase.from("clients").select("*, alert_status").order("created_at", { ascending: true }).range(f, t)),
           supabase.from("sellers").select("id, name, code, store_id, is_active, user_id"),
           supabase.from("stores").select("id, name")
        ]);
 
       if (msgsRes.data && msgsRes.data.length > 0) {
         setMessages(msgsRes.data as WhatsAppMessage[]);
         setUseMock(false);
       } else {
         setMessages(mockMessages);
         setUseMock(true);
       }
 
       if (clientsRes.data) {
         setClients(clientsRes.data);
       }

        if (sellersRes.data) {
          setSellers(sellersRes.data);
        }
        if (storesRes.data) {
          setStores(storesRes.data);
        }
     } catch (err) {
       console.error("Erro ao carregar dados:", err);
     } finally {
       setLoading(false);
     }
   }, []);
   const handleTransferConversation = async () => {
     if (!selectedPhone || !selectedTransferSeller) return;
     setIsTransferring(true);
     try {
       const targetSeller = sellers.find(s => s.id === selectedTransferSeller);
       const currentClient = clients.find(c => c.phone === selectedPhone);
       const { data: { user } } = await supabase.auth.getUser();
       
       if (!user) throw new Error("Usuário não autenticado");

       // Get profile ID for the current user
       const { data: profile } = await supabase
         .from("profiles")
         .select("id")
         .eq("user_id", user.id)
         .single();

       if (!profile) throw new Error("Perfil não encontrado");

       // 1. Update the client's assigned seller
       const { error: updateError } = await supabase
         .from("clients")
         .update({ 
           assigned_seller_id: selectedTransferSeller,
           store_id: targetSeller?.store_id || null,
           status: 'em_atendimento',
           claimed_at: new Date().toISOString()
         })
         .eq("phone", selectedPhone);

       if (updateError) throw updateError;

        // 2. Record the transfer history (legacy)
       const { error: historyError } = await supabase
         .from("service_transfers")
         .insert({
           client_id: currentClient?.id,
           from_seller_id: currentClient?.assigned_seller_id,
           to_seller_id: selectedTransferSeller,
           reason: transferReason,
           performed_by: profile.id
         });

       if (historyError) {
         console.error("Erro ao registrar histórico de transferência:", historyError);
         // We don't fail the whole operation if history record fails, but we log it
       }

        // 3. Record in unified redirection history
        await supabase
          .from("redirection_history")
          .insert({
            client_id: currentClient?.id,
            from_seller_id: currentClient?.assigned_seller_id,
            to_seller_id: selectedTransferSeller,
            redirection_type: 'manual_transfer',
            reason: transferReason || 'Transferência manual',
            performed_by: profile.id,
            store_id: targetSeller?.store_id || null
          });

       toast.success(`Conversa transferida para ${targetSeller?.name || 'o vendedor'}`);
       setIsTransferModalOpen(false);
       setTransferReason("");
       setSelectedTransferSeller("");
       fetchData();
     } catch (err) {
       console.error("Erro ao transferir conversa:", err);
       toast.error("Erro ao transferir a conversa.");
     } finally {
       setIsTransferring(false);
     }
   };

   // ---- Associar conversa (categoria + vínculo com cliente do ERP) ----
   const INTERMEDIARY_CATEGORIES = ["sindico", "comprador", "pintor", "arquiteto", "construtor"];

   const openAssocModal = async () => {
     setAssocCategory("");
     setSelectedErpClient(null);
     setErpSearchQuery("");
     setErpResults([]);
     setIsAssocModalOpen(true);
     const phone = selectedConversation?.phone;
     if (!phone) return;
     // Lê a associação atual direto do banco (evita array em memória desatualizado).
     const { data: rows } = await supabase
       .from("clients")
       .select("contact_category, linked_erp_client_id, linked_erp_client_name")
       .eq("phone", phone);
     const row: any = (rows || []).find((r: any) => r.contact_category) || (rows || [])[0];
     if (row) {
       setAssocCategory(row.contact_category || "");
       if (row.linked_erp_client_id || row.linked_erp_client_name) {
         setSelectedErpClient({ erpId: row.linked_erp_client_id, name: row.linked_erp_client_name });
       }
     }
   };

   const handleErpSearch = async () => {
     if (erpSearchQuery.trim().length < 2) {
       toast.error("Digite ao menos 2 caracteres do nome.");
       return;
     }
     setErpSearching(true);
     setErpResults([]);
     try {
       const { data, error } = await supabase.functions.invoke("citel-search-name", { body: { name: erpSearchQuery.trim() } });
       if (error) throw error;
       if (data?.error) throw new Error(data.error);
       const results = data?.results || [];
       setErpResults(results);
       if (results.length === 0) toast.info("Nenhum cliente encontrado no ERP com esse nome.");
     } catch (e: any) {
       toast.error(`Erro ao buscar no ERP: ${e.message || e}`);
     } finally {
       setErpSearching(false);
     }
   };

   const handleSaveAssociation = async () => {
     if (!selectedConversation?.phone || !assocCategory) {
       toast.error("Selecione uma categoria.");
       return;
     }
     const isIntermediary = INTERMEDIARY_CATEGORIES.includes(assocCategory);
     if (isIntermediary && !selectedErpClient) {
       toast.error("Selecione o cliente do ERP a vincular.");
       return;
     }
     setSavingAssoc(true);
     try {
       const updates: any = {
         contact_category: assocCategory,
         linked_erp_client_id: isIntermediary ? (selectedErpClient.erpId || selectedErpClient.document || null) : null,
         linked_erp_client_name: isIntermediary ? (selectedErpClient.name || null) : null,
       };
       // Atualiza por telefone (cobre eventuais linhas duplicadas do mesmo contato).
       const { data: updated, error } = await supabase
         .from("clients")
         .update(updates)
         .eq("phone", selectedConversation.phone)
         .select("id");
       if (error) throw error;
       if (!updated || updated.length === 0) {
         toast.error("Não encontrei o cadastro deste contato para associar.");
         return;
       }
       toast.success(isIntermediary ? `Conversa associada a ${selectedErpClient.name}` : "Categoria salva!");
       setIsAssocModalOpen(false);
       fetchData(true);
     } catch (e: any) {
       toast.error(`Erro ao salvar associação: ${e.message || e}`);
     } finally {
       setSavingAssoc(false);
     }
   };

   const handleStartNewChat = async () => {
     const digits = newChatPhone.replace(/\D/g, "");
     if (digits.length < 10) { toast.error("Informe um número válido com DDD (ex.: 21 99999-8888)."); return; }
     const fullPhone = digits.startsWith("55") ? digits : `55${digits}`;
     const text = newChatMessage.trim();
     if (!text) { toast.error("Escreva a primeira mensagem."); return; }
     setNewChatSending(true);
     try {
       const { data: { user } } = await supabase.auth.getUser();
       // O registro do contato é criado pela função send-whatsapp (service role),
       // evitando a RLS de INSERT de clients que exige store_id.
       const { data, error } = await supabase.functions.invoke("send-whatsapp", {
         body: { phone: fullPhone, message: text, senderId: user?.id, contactName: newChatName.trim() || undefined },
       });
       if (error) throw error;
       if (data?.error) throw new Error(data.error);
       toast.success("Conversa iniciada!");
       if (data?.message_saved === false) {
         toast.error("Mensagem enviada, mas não registrada no sistema: " + (data.message_error || "erro desconhecido"));
       }
       setNewChatOpen(false);
       // Mantém a conversa recém-criada visível e aberta: limpa a busca (que
       // poderia escondê-la) e fixa o telefone como conversa aberta, para não
       // sumir enquanto o recarregamento traz a mensagem/cliente.
       setSearch("");
       setVirtualPhones((prev) => (prev.includes(fullPhone) ? prev : [...prev, fullPhone]));
       setSelectedPhone(fullPhone);
       fetchData();
     } catch (e: any) {
       let msg = e?.message || String(e);
       // supabase.functions.invoke esconde o corpo no e.context (Response) em erros non-2xx.
       try {
         if (e?.context && typeof e.context.json === "function") {
           const b = await e.context.json();
           if (b?.error) msg = b.error + (b.details ? ` — ${typeof b.details === "string" ? b.details : JSON.stringify(b.details)}` : "");
         }
       } catch { /* mantém a mensagem original */ }
       toast.error(`Erro ao iniciar conversa: ${msg}`);
     } finally {
       setNewChatSending(false);
     }
   };

   useEffect(() => {
     fetchData();
   }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setMessages((prev) => {
            const newMsg = payload.new as WhatsAppMessage;
            // Já existe (por id ou message_id) → ignora
            if (prev.some(m => m.id === newMsg.id || m.message_id === newMsg.message_id)) {
              return prev;
            }
            // Substitui uma mensagem otimista temporária equivalente (mesmo texto/origem, recente)
            const tempIdx = prev.findIndex(m =>
              typeof m.id === "string" && m.id.startsWith("temp-") &&
              m.is_from_me === newMsg.is_from_me &&
              m.body === newMsg.body &&
              m.phone === newMsg.phone &&
              Math.abs(new Date(m.timestamp || m.created_at || 0).getTime() - new Date(newMsg.timestamp || newMsg.created_at || 0).getTime()) < 30000
            );
            if (tempIdx !== -1) {
              const copy = [...prev];
              copy[tempIdx] = newMsg;
              return copy;
            }
            return [...prev, newMsg];
          });
        } else if (payload.eventType === "UPDATE") {
          setMessages((prev) => prev.map(m => m.id === payload.new.id ? (payload.new as WhatsAppMessage) : m));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedPhone, messages]);

   useEffect(() => {
     const channel = supabase
       .channel("clients-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
          fetchData(true);
        })
       .subscribe();
     return () => { supabase.removeChannel(channel); };
   }, [fetchData]);

    const conversations: Conversation[] = useMemo(() => {
      const map = new Map<string, Conversation>();
      messages.forEach((msg) => {
        const phone = msg.phone;
        if (!map.has(phone)) {
          const client = clients.find(c => c.phone === phone);
          map.set(phone, { 
            phone, 
            lastMessage: "", 
            lastTimestamp: "", 
            unreadCount: 0, 
            messages: [],
            assigned_seller_id: client?.assigned_seller_id,
            store_id: client?.store_id,
            status: client?.status,
            alert_status: client?.alert_status,
            last_message_from_client_at: client?.last_message_from_client_at,
            received_on_instance_id: client?.received_on_instance_id
          });
        }
        const conv = map.get(phone)!;
        conv.messages.push(msg);
        
        const currentTs = new Date(msg.timestamp || msg.created_at || 0).getTime();
        const lastTs = new Date(conv.lastTimestamp || 0).getTime();
  
        if (!conv.lastTimestamp || currentTs >= lastTs) {
          conv.lastTimestamp = msg.timestamp || msg.created_at || "";
          conv.lastMessage = msg.body || "";
          conv.lastFromMe = !!msg.is_from_me;
        }
        
        if (!msg.is_from_me && !msg.is_read) conv.unreadCount++;
      });
      // Adiciona conversas "vazias" (telefones abertos sem mensagem ainda), para o vendedor iniciar.
      const strip = (p: string) => (p || "").replace(/\D/g, "").replace(/^55/, "");
      virtualPhones.forEach((vp) => {
        if (!map.has(vp) && !Array.from(map.keys()).some((k) => strip(k) === strip(vp))) {
          const client = clients.find((c) => strip(c.phone) === strip(vp));
          map.set(vp, {
            phone: vp,
            lastMessage: "",
            lastTimestamp: "",
            unreadCount: 0,
            messages: [],
            assigned_seller_id: client?.assigned_seller_id,
            store_id: client?.store_id,
            status: client?.status,
            alert_status: client?.alert_status,
            last_message_from_client_at: client?.last_message_from_client_at,
            received_on_instance_id: client?.received_on_instance_id,
          });
        }
      });
      return Array.from(map.values());
    }, [messages, clients, virtualPhones]);

     // Mapa telefone (normalizado, sem DDI) -> etapa do lead, para filtrar por etapa do Kanban
     const normPhone = (p: string) => (p || "").replace(/\D/g, "").replace(/^55/, "");
     const phoneStage = useMemo(() => {
       const m: Record<string, string> = {};
       (leads || []).forEach((l) => { if (l.clientPhone) m[normPhone(l.clientPhone)] = l.stage; });
       return m;
     }, [leads]);

     // Telefones de leads marcados como "Equipe Interna" — suas conversas só
     // aparecem na aba Equipe Interna e são ocultadas das demais abas.
     const equipeInternaPhones = useMemo(() => {
       const s = new Set<string>();
       (leads || []).forEach((l) => {
         if (l.clientPhone && l.clientType === CLIENT_TYPE_EQUIPE_INTERNA) s.add(normPhone(l.clientPhone));
       });
       return s;
     }, [leads]);

     const stageCounts = useMemo(() => {
       const c: Record<string, number> = { all: conversations.length, sem_resposta: 0, sem_lead: 0 };
       conversations.forEach((conv) => {
         if (!conv.lastFromMe) c.sem_resposta++;
         const st = phoneStage[normPhone(conv.phone)];
         if (!st) c.sem_lead++;
         else c[st] = (c[st] || 0) + 1;
       });
       return c;
     }, [conversations, phoneStage]);

     const filterOptions = [
       { key: "all", label: "Todas" },
       ...KANBAN_STAGES.map((s) => ({ key: s.key as string, label: s.label })),
       { key: "sem_resposta", label: "Sem resposta" },
       { key: "sem_lead", label: "Sem lead" },
     ];
     const activeFilterLabel = filterOptions.find((f) => f.key === stageFilter)?.label || "Filtrar";

     const filteredConversations = useMemo(() => {
       let filtered = conversations.filter((c) => {
         const isMine = c.assigned_seller_id === sellerId;

         // Multi-instance filter
         if (instanceFilter !== "all" && c.received_on_instance_id !== instanceFilter) {
           return false;
         }

         // Filtro por etapa do Kanban
         if (stageFilter !== "all") {
           if (stageFilter === "sem_resposta") {
             // Última mensagem foi do cliente (aguardando nossa resposta)
             if (c.lastFromMe) return false;
           } else if (stageFilter === "sem_lead") {
             if (phoneStage[normPhone(c.phone)]) return false;
           } else if (phoneStage[normPhone(c.phone)] !== stageFilter) {
             return false;
           }
         }
 
         // Equipe Interna: só aparece na aba Equipe Interna; oculta nas demais.
         const isEquipeInterna = equipeInternaPhones.has(normPhone(c.phone));
         if (activeTab === 'equipe_interna') {
           if (!isEquipeInterna) return false;
         } else if (isEquipeInterna) {
           return false;
         }

         // Conversa aberta explicitamente pelo usuário (ex.: clique no card do
         // Kanban ou Nova conversa) e ainda sem histórico: sempre aparece na
         // lista. Sem isso, um cliente sem registro em `clients` não tem
         // assigned_seller_id e o filtro de aba a escondia logo após abrir.
         const isVirtual = virtualPhones.includes(c.phone);

         // Controle de acesso baseado no perfil e na aba (não se aplica à aba Equipe Interna)
         if (activeTab !== 'equipe_interna' && !isVirtual) {
         if (isVendedor) {
           if (activeTab === 'minhas') {
             if (!isMine) return false;
           } else if (activeTab === 'loja') {
             if (!c.store_id || c.assigned_seller_id || c.store_id !== storeId) return false;
           } else if (activeTab === 'geral') {
             if (c.store_id || c.assigned_seller_id) return false;
           } else {
             return false; // Vendedor não vê "todas"
           }
         } else if (isGerente) {
           if (activeTab === 'minhas') {
             if (!isMine) return false;
           } else if (activeTab === 'loja') {
             // Ver todos os leads da sua loja (atribuídos ou não)
             if (c.store_id !== storeId) return false;
           } else if (activeTab === 'geral') {
             // Leads sem loja e sem vendedor
             if (c.store_id || c.assigned_seller_id) return false;
           } else if (activeTab === 'todas') {
             // Todas as conversas da sua loja
             if (c.store_id !== storeId && !isMine) return false;
           }
         } else if (isAdmin) {
           if (activeTab === 'minhas') {
             if (!isMine) return false;
           } else if (activeTab === 'loja') {
             if (!c.store_id || c.assigned_seller_id) return false;
           } else if (activeTab === 'geral') {
             if (c.store_id || c.assigned_seller_id) return false;
           }
           // 'todas' tab shows everything for admin
         }
         } // fim do controle de acesso por perfil (pulado na aba Equipe Interna)
   
         // Search filtering
         const name = contactNames[c.phone] || "";
         const searchLower = search.toLowerCase();
         return c.phone.includes(search) || 
                c.lastMessage.toLowerCase().includes(searchLower) || 
                name.toLowerCase().includes(searchLower);
       });

      // Ordenação: mais recente primeiro em todas as abas.
      return filtered.sort((a, b) => (b.lastTimestamp || "0").localeCompare(a.lastTimestamp || "0"));
     }, [conversations, contactNames, search, activeTab, sellerId, storeId, isAdmin, isGerente, instanceFilter, stageFilter, phoneStage, equipeInternaPhones, virtualPhones]);

  // Monitor conversations for stale messages to trigger alert popup
  useEffect(() => {
    const STALE_ALERT_THRESHOLD = 30 * 60 * 1000; // 30 minutes
    const checkStale = () => {
      const now = new Date().getTime();
      const myConversations = conversations.filter(c => c.assigned_seller_id === sellerId);
      const stale = myConversations.find(c => {
        if (!c.last_message_from_client_at || hasDismissedStaleAlert.current.has(c.phone)) return false;
        const waitTime = now - new Date(c.last_message_from_client_at).getTime();
        return waitTime > STALE_ALERT_THRESHOLD;
      });
      if (stale && (!staleAlertConversation || staleAlertConversation.phone !== stale.phone)) {
        setStaleAlertConversation(stale);
      }
    };
    const interval = setInterval(checkStale, 30000);
    checkStale();
    return () => clearInterval(interval);
  }, [conversations, sellerId, staleAlertConversation]);

  const dismissStaleAlert = () => {
    if (staleAlertConversation) {
      hasDismissedStaleAlert.current.add(staleAlertConversation.phone);
      setStaleAlertConversation(null);
    }
  };

  const formatWaitTime = (lastMessageAt: string | null | undefined) => {
    if (!lastMessageAt) return "";
    const diffMs = new Date().getTime() - new Date(lastMessageAt).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} minutos`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  const selectedConversation = useMemo(() => conversations.find((c) => c.phone === selectedPhone), [conversations, selectedPhone]);

  const isSelectedStale = useMemo(() => {
    if (!selectedConversation?.last_message_from_client_at) return false;
    const STALE_TIME = 15 * 60 * 1000;
    return (new Date().getTime() - new Date(selectedConversation.last_message_from_client_at).getTime() > STALE_TIME);
  }, [selectedConversation]);

  const handleSelectConversation = (phone: string) => {
    setSelectedPhone(phone);
    setShowMobileChat(true);
  };

  // Deep-link: ao chegar de /conversas?phone=... (ex.: clique no Kanban),
  // abre direto a conversa daquele cliente.
  const [deepLinkParams, setDeepLinkParams] = useSearchParams();
  useEffect(() => {
    const target = deepLinkParams.get("phone");
    if (!target || loading) return;
    const norm = (p: string) => (p || "").replace(/\D/g, "").replace(/^55/, "");
    const conv = conversations.find((c) => norm(c.phone) === norm(target));
    if (conv) {
      handleSelectConversation(conv.phone);
    } else {
      // Ainda não há conversa no WhatsApp: abre uma conversa vazia para o vendedor iniciar.
      const digits = (target || "").replace(/\D/g, "");
      const canonical = (digits.length === 10 || digits.length === 11) ? `55${digits}` : digits;
      setVirtualPhones((prev) => (prev.includes(canonical) ? prev : [...prev, canonical]));
      handleSelectConversation(canonical);
    }
    deepLinkParams.delete("phone");
    setDeepLinkParams(deepLinkParams, { replace: true });
  }, [deepLinkParams, loading, conversations]);

  useEffect(() => {
    if (!selectedPhone) return;
    // Zera o contador da conversa localmente assim que ela é aberta — inclusive
    // em modo demo/mock e mesmo que a persistência no banco falhe.
    setMessages(prev => prev.map(m =>
      (m.phone === selectedPhone && !m.is_from_me) ? { ...m, is_read: true } : m
    ));
    if (useMock) return; // modo demo não persiste no banco

    const markAsRead = async () => {
      // Usa RPC (SECURITY DEFINER) em vez de UPDATE direto: a RLS de
      // whatsapp_messages bloqueava o update silenciosamente (0 linhas)
      // para usuários não-admin, fazendo o contador nunca zerar.
      const { data: affected, error } = await (supabase.rpc as any)(
        "mark_whatsapp_read",
        { p_phone: selectedPhone }
      );
      if (error) {
        console.error("Erro ao marcar mensagens como lidas:", error);
        return;
      }
      // Desconta do contador global o número REAL de linhas marcadas no banco
      if (typeof affected === "number" && affected > 0) {
        decrementUnreadWhatsApp(affected);
      }
    };
    markAsRead();
  }, [selectedPhone, useMock]);

  useEffect(() => {
    if (useMock) {
      setContactNames(mockContactNames);
      return;
    }
    const phones = conversations.map(c => c.phone);
    if (phones.length === 0) return;
     const names: Record<string, string> = {};
     const photos: Record<string, string> = {};
     clients.forEach(c => {
       if (phones.includes(c.phone)) {
         names[c.phone] = c.name;
         if (c.profile_pic_url) photos[c.phone] = c.profile_pic_url;
       }
     });
     setContactNames(names);
     setContactPhotos(photos);
  }, [useMock, conversations.length]);

   const chatMessages = useMemo(() => selectedConversation ? selectedConversation.messages : [], [selectedConversation]);

   const chatSearchResults = useMemo(() => {
     if (chatSearch.length < 2) return [];
     const searchLower = chatSearch.toLowerCase();
     return chatMessages.filter(msg => msg.body?.toLowerCase().includes(searchLower));
   }, [chatMessages, chatSearch]);

   useEffect(() => {
     if (chatSearchResults.length > 0 && isSearchingInChat) {
       setSearchOccurrenceIndex(0);
       const firstResult = searchResultsRefs.current[0];
       firstResult?.scrollIntoView({ behavior: "smooth", block: "center" });
     }
   }, [chatSearch, isSearchingInChat, chatSearchResults.length]);

   const navigateSearch = (direction: 'next' | 'prev') => {
     if (chatSearchResults.length === 0) return;
     let newIndex = direction === 'next' ? searchOccurrenceIndex + 1 : searchOccurrenceIndex - 1;
     if (newIndex >= chatSearchResults.length) newIndex = 0;
     if (newIndex < 0) newIndex = chatSearchResults.length - 1;
     setSearchOccurrenceIndex(newIndex);
     const target = searchResultsRefs.current[newIndex];
     target?.scrollIntoView({ behavior: "smooth", block: "center" });
   };

  const contactName = selectedPhone ? contactNames[selectedPhone] || null : null;

    // Reclassifica o tipo de cliente do lead da conversa. Saindo de "Equipe
    // Interna", o lead volta a aparecer no Kanban e a conversa deixa a aba
    // Interna (ambas as telas derivam do clientType, então basta gravá-lo).
    const handleReclassify = async () => {
      if (!reclassifyPhone || !reclassifyType) return;
      const target = normPhone(reclassifyPhone);
      const lead = (leads || []).find((l) => l.clientPhone && normPhone(l.clientPhone) === target);
      if (!lead) { toast.error("Lead não encontrado para esta conversa."); return; }

      setIsReclassifying(true);
      try {
        await updateLead({ ...lead, clientType: reclassifyType });
        const saiuDaInterna = reclassifyType !== CLIENT_TYPE_EQUIPE_INTERNA;
        toast.success(
          saiuDaInterna
            ? `Classificado como ${reclassifyType}. O lead voltou para o Kanban.`
            : `Classificado como ${reclassifyType}.`,
        );
        if (saiuDaInterna && activeTab === "equipe_interna") {
          // A conversa sai desta aba: leva o usuário para onde ela agora está.
          setActiveTab("minhas");
        }
        setReclassifyPhone(null);
        setReclassifyType("");
      } catch (e: any) {
        toast.error("Erro ao classificar: " + (e?.message || "tente novamente"));
      } finally {
        setIsReclassifying(false);
      }
    };

    const handleClaimLead = async (phoneToClaim?: string) => {
      const targetPhone = phoneToClaim || selectedPhone;
      if (!targetPhone) {
        console.warn("Missing phone to claim:", { targetPhone, selectedPhone });
        return;
      }
      setIsClaiming(true);
      
      try {
        // clients/leads assignment fields reference sellers.id.
        let realSellerId: string | null = null;
        let realStoreId: string | null = storeId;

        const { data: claimResult, error: claimError } = await (supabase as any)
          .rpc("claim_whatsapp_client", {
            _phone: targetPhone,
            _fallback_name: `Cliente ${formatPhone(targetPhone)}`,
          });

        if (claimError) throw claimError;

        const claimed = claimResult?.[0];
        realSellerId = claimed?.seller_id ?? null;
        realStoreId = claimed?.store_id ?? storeId;

        if (!realSellerId) {
          toast.error("Seu usuário não está vinculado a um vendedor. Peça para um administrador criar seu cadastro em Vendedores.");
          return;
        }

        toast.success("Você assumiu este atendimento!");
        // Force an immediate update of the local state before fetching
        setClients(prev => {
          const existing = prev.find(c => c.phone === targetPhone);
          if (existing) {
            return prev.map(c => c.phone === targetPhone ? { 
              ...c, 
              assigned_seller_id: realSellerId, 
              store_id: realStoreId,
              status: 'em_atendimento',
              claimed_at: new Date().toISOString() 
            } : c);
          } else {
            return [...prev, { 
              phone: targetPhone, 
              name: `Cliente ${formatPhone(targetPhone)}`,
              assigned_seller_id: realSellerId, 
              status: 'em_atendimento',
              claimed_at: new Date().toISOString(),
              store_id: realStoreId
            }];
          }
        });
        
        fetchData(); // Refresh to ensure sync
      } catch (err) {
        console.error("Erro ao assumir lead:", err);
        toast.error("Não foi possível assumir este lead.");
      } finally {
        setIsClaiming(false);
      }
    };
 
  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPhone) return;

    const loadingToast = toast.loading(`Enviando ${file.name}...`);
    setSending(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${selectedPhone}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp_media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: signed, error: signErr } = await supabase.storage
        .from('whatsapp_media')
        .createSignedUrl(filePath, 60 * 60 * 24);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error('Falha ao gerar URL assinada');
      const publicUrl = signed.signedUrl;

      let mediaType = 'document';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('video/')) mediaType = 'video';
      else if (file.type.startsWith('audio/')) mediaType = 'audio';

      const currentSeller = sellers.find(s => s.id === sellerId);
      const { data: { user } } = await supabase.auth.getUser();

      const { error: invokeError } = await supabase.functions.invoke("send-whatsapp", {
        body: { 
          phone: selectedPhone, 
          message: "", 
          mediaUrl: publicUrl,
          mediaType: mediaType,
          senderId: user?.id,
          senderName: currentSeller?.name || role
        },
      });

      if (invokeError) throw invokeError;

      // Adicionar mensagem localmente para feedback instantâneo
      const newMessage: WhatsAppMessage = {
        id: `temp-file-${Date.now()}`,
        message_id: `temp-file-${Date.now()}`,
        phone: selectedPhone,
        body: messageInput || `[Arquivo: ${mediaType || 'mídia'}]`,
        is_from_me: true,
        media_url: publicUrl,
        media_type: mediaType,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, newMessage]);

      toast.dismiss(loadingToast);
      toast.success("Arquivo enviado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao enviar arquivo:", err);
      toast.dismiss(loadingToast);
      toast.error(`Erro ao enviar arquivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

   const handleSendMessage = async () => {
     if (!messageInput.trim() || !selectedPhone || sending) return;
     const text = messageInput.trim();
     const phone = selectedPhone;
     setMessageInput("");
     setSending(true);

     // Feedback instantâneo: adiciona a mensagem ANTES de enviar.
     const tempId = `temp-${Date.now()}`;
     const optimistic: WhatsAppMessage = {
       id: tempId,
       message_id: tempId,
       phone,
       body: text,
       is_from_me: true,
       timestamp: new Date().toISOString(),
       created_at: new Date().toISOString(),
     };
     setMessages((prev) => [...prev, optimistic]);

     const currentSeller = sellers.find(s => s.id === sellerId);
     const { data: { user } } = await supabase.auth.getUser();

     try {
       const { data, error } = await supabase.functions.invoke("send-whatsapp", {
         body: {
           phone,
           message: text,
           senderId: user?.id,
           senderName: currentSeller?.name || role
         },
       });

       if (error) {
         console.error("Erro ao enviar mensagem:", error);
         // Remove a mensagem otimista e devolve o texto pro campo
         setMessages((prev) => prev.filter((m) => m.id !== tempId));
         setMessageInput(text);
         toast.error("Erro ao enviar mensagem. Tente novamente.");
       } else {
         // Sucesso: o realtime substitui a otimista pela real (mesmo texto/origem/horário).
         // Como reforço, já marca o message_id real na otimista.
         const realId = (data as any)?.messageId;
         if (realId) {
           setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, message_id: realId } : m));
         }
       }
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMessageInput(text);
      toast.error("Falha na conexão. Verifique sua internet.");
    } finally {
      setSending(false);
    }
  };

 const startRecording = async () => {
   try {
     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
     const mediaRecorder = new MediaRecorder(stream);
     mediaRecorderRef.current = mediaRecorder;
     audioChunksRef.current = [];

     mediaRecorder.ondataavailable = (event) => {
       if (event.data.size > 0) {
         audioChunksRef.current.push(event.data);
       }
     };

     mediaRecorder.onstop = async () => {
       const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
       // Se a gravação foi cancelada, descarta sem enviar.
       if (!cancelledRecordingRef.current && audioBlob.size > 0) {
         await uploadAndSendAudio(audioBlob);
       }
       audioChunksRef.current = [];
       stream.getTracks().forEach(track => track.stop());
     };

     mediaRecorder.start();
     cancelledRecordingRef.current = false;
     setIsRecording(true);
     setRecordingDuration(0);
     timerIntervalRef.current = window.setInterval(() => {
       setRecordingDuration(prev => prev + 1);
     }, 1000);
   } catch (err) {
     console.error("Erro ao acessar microfone:", err);
     toast.error("Não foi possível acessar o microfone.");
   }
 };

 const stopRecording = () => {
   if (mediaRecorderRef.current && isRecording) {
     mediaRecorderRef.current.stop();
     setIsRecording(false);
     if (timerIntervalRef.current) {
       clearInterval(timerIntervalRef.current);
       timerIntervalRef.current = null;
     }
   }
 };

 const cancelRecording = () => {
   if (mediaRecorderRef.current && isRecording) {
     cancelledRecordingRef.current = true; // sinaliza pro onstop descartar
     mediaRecorderRef.current.stop();
     setIsRecording(false);
     setRecordingDuration(0);
     if (timerIntervalRef.current) {
       clearInterval(timerIntervalRef.current);
       timerIntervalRef.current = null;
     }
   }
 };

 const uploadAndSendAudio = async (blob: Blob) => {
   if (!selectedPhone) return;
   const phone = selectedPhone;
   setSending(true);

   // Feedback instantâneo: toca o áudio local na hora, antes do upload/envio.
   const tempId = `temp-audio-${Date.now()}`;
   const localUrl = URL.createObjectURL(blob);
   const optimistic: WhatsAppMessage = {
     id: tempId,
     message_id: tempId,
     phone,
     body: "",
     is_from_me: true,
     media_url: localUrl,
     media_type: 'audio',
     timestamp: new Date().toISOString(),
     created_at: new Date().toISOString(),
   };
   setMessages((prev) => [...prev, optimistic]);

   try {
     const fileName = `${Math.random()}.webm`;
     const filePath = `${phone}/${fileName}`;

     const { error: uploadError } = await supabase.storage
       .from('whatsapp_media')
       .upload(filePath, blob);

     if (uploadError) throw uploadError;

      const { data: signed, error: signErr } = await supabase.storage
        .from('whatsapp_media')
        .createSignedUrl(filePath, 60 * 60 * 24);
      if (signErr || !signed?.signedUrl) throw signErr ?? new Error('Falha ao gerar URL assinada');
      const publicUrl = signed.signedUrl;

      const currentSeller = sellers.find(s => s.id === sellerId);
      const { data: { user } } = await supabase.auth.getUser();

      const { error: invokeError } = await supabase.functions.invoke("send-whatsapp", {
        body: { 
          phone, 
          message: "", 
          mediaUrl: publicUrl,
          mediaType: 'audio',
          senderId: user?.id,
          senderName: currentSeller?.name || role
        },
      });

      if (invokeError) throw invokeError;

      // Atualiza a otimista com a URL definitiva (o realtime depois substitui pela do banco)
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, media_url: publicUrl } : m));
   } catch (err: any) {
     console.error("Erro ao enviar áudio:", err);
     // Remove a otimista em caso de falha
     setMessages((prev) => prev.filter((m) => m.id !== tempId));
     toast.error(`Erro ao enviar áudio: ${err.message || 'Erro desconhecido'}`);
   } finally {
     setSending(false);
   }
 };

 const formatDuration = (seconds: number) => {
   const mins = Math.floor(seconds / 60);
   const secs = seconds % 60;
   return `${mins}:${secs.toString().padStart(2, '0')}`;
 };

  const handleExport = () => {
    if (!selectedConversation) return;
    const name = contactName || formatPhone(selectedConversation.phone);
    const lines: string[] = [
      `Conversa com: ${name}`,
      `Telefone: ${formatPhone(selectedConversation.phone)}`,
      `Exportado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
      `Total de mensagens: ${selectedConversation.messages.length}`,
      "",
      "─".repeat(60),
      "",
    ];
    selectedConversation.messages.forEach((msg) => {
      const ts = msg.timestamp || msg.created_at || "";
      const when = ts ? format(new Date(ts), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";
      const sender = msg.is_from_me ? "Atendente" : name;
      lines.push(`[${when}] ${sender}: ${msg.body || ""}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversa-${selectedConversation.phone}-${format(new Date(), "yyyy-MM-dd")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Conversa exportada com sucesso!");
  };

  return (
    <AppLayout title="Conversas">
      <div className="flex h-[calc(100vh-5rem)] overflow-hidden bg-background">
        {/* ── Left panel - Contact list ── */}
        <div className={cn(
          "w-full md:w-[420px] lg:w-[380px] flex flex-col shrink-0 border-r border-border/60 shadow-[1px_0_0_rgba(0,0,0,0.04)]",
          showMobileChat && "hidden md:flex"
        )}>
          {/* tonal background to separate from chat panel */}
          <div className="flex flex-col flex-1 min-h-0" style={{ backgroundColor: "hsl(var(--wa-list-bg))" }}>
          {/* WhatsApp-style header */}
          <div className="h-14 flex items-center justify-between px-4" style={{ backgroundColor: "hsl(var(--wa-header))" }}>
            <div className="flex items-center gap-3">
               <div className="relative">
                 <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center">
                   <MessageCircle className="h-5 w-5 text-white" />
                 </div>
                 <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[hsl(var(--wa-header))] bg-green-500 shadow-sm" title="WhatsApp Conectado" />
               </div>
               <div className="flex flex-col">
                 <span className="text-sm font-medium text-white leading-none">WhatsApp</span>
                 <span className="text-[10px] text-white/70 mt-1 flex items-center gap-1">
                   <div className="h-1 w-1 rounded-full bg-green-400 animate-pulse" />
                   Conectado
                 </span>
               </div>
            </div>
            {/* Removido o botão de 3 pontos no cabeçalho lateral */}
          </div>

           {/* Search and Tabs */}
           <div className="px-2 py-2.5 bg-white/70 backdrop-blur-sm space-y-2 border-b border-border/60">
             <Button
               onClick={() => { setNewChatPhone(""); setNewChatName(""); setNewChatMessage(""); setNewChatErpClient(null); setNewChatResults([]); setNewChatSearch(""); setNewChatOpen(true); }}
               className="w-full h-9 rounded-lg bg-brand-500 hover:opacity-90 text-white text-sm gap-2"
             >
               <Plus className="h-4 w-4" /> Nova conversa
             </Button>
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
               <Input
                 placeholder="Pesquisar..."
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="pl-10 h-9 rounded-lg bg-white border border-border text-sm placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:border-brand-500/40"
               />
             </div>

             {allInstances.length > 1 && (
               <Select value={instanceFilter} onValueChange={setInstanceFilter}>
                 <SelectTrigger className="h-9 rounded-lg bg-white border border-border text-xs">
                   <SelectValue placeholder="Todos os números" />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="all">Todos os números</SelectItem>
                   {allInstances.map((inst) => (
                     <SelectItem key={inst.id} value={inst.id}>
                       {inst.instance_type === "store" ? "🏬 " : "📱 "}{inst.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             )}
             
              <div className="flex gap-1 flex-wrap">
               <Button 
                 variant="ghost" 
                 size="sm" 
                 onClick={() => setActiveTab('minhas')}
                 className={cn(
                   "flex-1 text-[11px] h-8 gap-1.5 rounded-md transition-all",
                   activeTab === 'minhas' ? "bg-brand-500/10 text-brand-500 hover:bg-brand-500/20" : "text-muted-foreground hover:bg-muted"
                 )}
               >
                 <UserCheck className="h-3.5 w-3.5" />
                 Minhas
               </Button>
               <Button 
                 variant="ghost" 
                 size="sm" 
                 onClick={() => setActiveTab('loja')}
                 className={cn(
                   "flex-1 text-[11px] h-8 gap-1.5 rounded-md transition-all",
                   activeTab === 'loja' ? "bg-brand-500/10 text-brand-500 hover:bg-brand-500/20" : "text-muted-foreground hover:bg-muted"
                 )}
               >
                 <Store className="h-3.5 w-3.5" />
                 Loja
               </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveTab('geral')}
                  className={cn(
                    "flex-1 text-[11px] h-8 gap-1.5 rounded-md transition-all",
                    activeTab === 'geral' ? "bg-brand-500/10 text-brand-500 hover:bg-brand-500/20" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Users className="h-3.5 w-3.5" />
                  Geral
                </Button>
                {(isAdmin || isGerente) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setActiveTab('todas')}
                    className={cn(
                      "flex-1 text-[11px] h-8 gap-1.5 rounded-md transition-all min-w-[70px]",
                      activeTab === 'todas' ? "bg-brand-500/10 text-brand-500 hover:bg-brand-500/20" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                    Todas
                  </Button>
                )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('equipe_interna')}
                title="Equipe Interna"
                className={cn(
                  "flex-1 text-[11px] h-8 gap-1.5 rounded-md transition-all min-w-[64px]",
                  activeTab === 'equipe_interna' ? "bg-brand-500/10 text-brand-500 hover:bg-brand-500/20" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Lock className="h-3.5 w-3.5" />
                Interna
              </Button>
              </div>
            </div>

            {/* Filtro por etapa do Kanban */}
            <div className="px-2 pb-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs">
                    <ListFilter className="h-3.5 w-3.5" />
                    {stageFilter === "all" ? "Filtrar por etapa" : activeFilterLabel}
                    {stageFilter !== "all" && (
                      <span className="rounded-full bg-brand-500/15 text-brand-500 px-1.5 text-[10px] font-bold">{stageCounts[stageFilter] || 0}</span>
                    )}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 max-h-[60vh] overflow-y-auto">
                  {filterOptions.map((f) => (
                    <DropdownMenuItem key={f.key} onClick={() => setStageFilter(f.key)} className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="flex items-center gap-1.5">
                        {stageFilter === f.key && <Check className="h-3.5 w-3.5 text-brand-500" />}
                        <span className={stageFilter === f.key ? "font-semibold text-brand-500" : ""}>{f.label}</span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{stageCounts[f.key] || 0}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {stageFilter !== "all" && (
                <button onClick={() => setStageFilter("all")} className="ml-2 text-xs text-muted-foreground hover:text-foreground underline">
                  limpar
                </button>
              )}
            </div>

            
          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground gap-2">
                <Clock className="h-4 w-4 animate-spin" />
                Carregando conversas...
              </div>
             ) : filteredConversations.length === 0 ? (
               <div className="flex flex-col items-center justify-center min-h-[400px] p-6 gap-6 text-center animate-in fade-in duration-500">
                 <div className="relative">
                   <div className="absolute inset-0 bg-brand-500/5 rounded-full scale-150 blur-2xl" />
                   <div className="relative h-20 w-20 rounded-[14px] bg-muted/50 flex items-center justify-center mx-auto mb-2">
                     <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
                   </div>
                 </div>
                 
                 <div className="max-w-[240px] space-y-2">
                   <h3 className="font-semibold text-foreground">Nenhuma conversa encontrada</h3>
                   <p className="text-sm text-muted-foreground leading-relaxed">
                     {activeTab === 'minhas' 
                       ? "Você não possui atendimentos ativos no momento." 
                       : "Não há novas conversas pendentes nesta categoria."}
                   </p>
                 </div>
 
                 <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
                   {activeTab === 'minhas' && (
                     <>
                       <Button 
                         variant="outline" 
                         className="w-full justify-start gap-3 h-12 bg-background border-dashed hover:border-primary/50 hover:bg-brand-500/5 transition-all group"
                         onClick={() => setActiveTab('loja')}
                       >
                         <div className="h-8 w-8 rounded-lg bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                           <Store className="h-4 w-4 text-brand-500" />
                         </div>
                         <div className="text-left">
                           <div className="text-xs font-semibold">Ver Fila da Loja</div>
                           <div className="text-[10px] text-muted-foreground">Novos leads aguardando</div>
                         </div>
                       </Button>
 
                       <Button 
                         variant="outline" 
                         className="w-full justify-start gap-3 h-12 bg-background border-dashed hover:border-primary/50 hover:bg-brand-500/5 transition-all group"
                         onClick={() => setActiveTab('geral')}
                       >
                         <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50 transition-colors">
                           <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                         </div>
                         <div className="text-left">
                           <div className="text-xs font-semibold">Fila Geral</div>
                           <div className="text-[10px] text-muted-foreground">Leads sem atribuição</div>
                         </div>
                       </Button>
                     </>
                   )}
                   
                   <Button 
                     variant="ghost" 
                     className="text-xs text-brand-500 hover:bg-brand-500/5 mt-2"
                     onClick={() => {
                       setSearch("");
                       fetchData();
                     }}
                   >
                     Atualizar lista
                   </Button>
                 </div>
               </div>
             ) : (
              <div>
                <AnimatePresence>
                  {filteredConversations.map((conv, idx) => {
                    const name = contactNames[conv.phone] || formatPhone(conv.phone);
                    const lastMsgIsFromMe = conv.messages[conv.messages.length - 1]?.is_from_me;
                    const isSelected = selectedPhone === conv.phone;
                    return (
                      <motion.button
                        key={conv.phone}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02, duration: 0.15 }}
                        onClick={() => handleSelectConversation(conv.phone)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors duration-100 bg-white/60 hover:bg-white",
                          isSelected && "bg-brand-500/10 hover:bg-brand-500/15 border-l-2 border-brand-500",
                          conv.alert_status === 'critical' && "bg-destructive/10 hover:bg-destructive/20",
                          conv.alert_status === 'red' && "bg-red-50/50 hover:bg-red-100/40",
                          conv.alert_status === 'yellow' && "bg-yellow-50/50 hover:bg-yellow-100/40"
                        )}
                      >
                        {/* Avatar */}
                        <div className="flex h-[49px] w-[49px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-100 to-brand-50 text-brand-500 ring-1 ring-brand-500/10">
                          {contactPhotos[conv.phone] ? (
                            <img
                              src={contactPhotos[conv.phone]}
                              alt={contactNames[conv.phone] || formatPhone(conv.phone)}
                              className="h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : contactNames[conv.phone] ? (
                            <span className="text-sm font-semibold text-brand-500">{getInitials(contactNames[conv.phone])}</span>
                          ) : (
                            <User className="h-6 w-6" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            {/* O nome ocupa a linha inteira: o selo do número e o
                                botão ATENDER foram para a linha de baixo, senão
                                espremiam o nome e ele saía truncado. */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="text-[16px] font-normal text-foreground truncate">
                                 {name}
                               </span>
                               {conv.alert_status === 'critical' && <div className="h-2 w-2 rounded-full bg-destructive animate-pulse shrink-0" title="ALERTA CRÍTICO - ADMIN" />}
                              {conv.alert_status === 'red' && <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" title="Alerta Crítico" />}
                               {conv.alert_status === 'yellow' && <div className="h-2 w-2 rounded-full bg-yellow-400 shrink-0" title="Alerta de Demora" />}
                             </div>
                             <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[12px] shrink-0",
                                conv.unreadCount > 0 ? "text-[hsl(var(--wa-green))]" : "text-muted-foreground"
                              )}>
                                {conv.lastTimestamp && formatMessageDate(conv.lastTimestamp)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {lastMsgIsFromMe && (
                              <CheckCheck className="h-4 w-4 shrink-0 text-[hsl(var(--wa-green))]/70" />
                            )}
                            <p className="text-[14px] text-muted-foreground truncate flex-1 leading-snug">
                              {conv.lastMessage || "Sem mensagem"}
                            </p>
                            {conv.unreadCount > 0 && (
                              <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full text-[11px] font-medium px-1.5"
                                style={{ backgroundColor: "hsl(var(--wa-green))", color: "white" }}>
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>

                          {/* Selo do número/loja + ATENDER: linha própria, para não
                              disputar espaço com o nome do cliente. */}
                          {(() => {
                            const badge = conv.received_on_instance_id && instancesById[conv.received_on_instance_id] ? (
                              <InstanceBadge instance={instancesById[conv.received_on_instance_id]} size="xs" />
                            ) : conv.store_id ? (
                              <span className="text-[10px] bg-brand-500/10 text-brand-500 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                                {stores.find(s => s.id === conv.store_id)?.name || 'Loja'}
                              </span>
                            ) : null;
                            const canClaim = activeTab === 'geral' || activeTab === 'loja';
                            if (!badge && !canClaim) return null;
                            return (
                              <div className="flex items-center gap-2 mt-1.5">
                                {badge}
                                {canClaim && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 px-2 text-[10px] bg-green-600 hover:bg-green-700 text-white font-bold ml-auto"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      handleSelectConversation(conv.phone);
                                      handleClaimLead(conv.phone);
                                    }}
                                  >
                                    ATENDER
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
          </div>
        </div>

        {/* ── Right panel - Chat area ── */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          !showMobileChat && "hidden md:flex"
        )}>
          {selectedConversation ? (
            <>
               {/* Alert Banners */}
               {selectedConversation.alert_status === 'critical' && (
                 <div className="bg-destructive text-white text-[11px] py-1 px-4 flex items-center justify-between">
                   <span className="flex items-center gap-1.5 font-bold">
                     <ShieldAlert className="h-3 w-3" /> ALERTA CRÍTICO: Cliente sem resposta há mais de 1h30! Administrador notificado.
                   </span>
                   <span className="opacity-80">SLA Estourado</span>
                 </div>
               )}
               {selectedConversation.alert_status === 'red' && (
                 <div className="bg-red-500 text-white text-[11px] py-1 px-4 flex items-center justify-between">
                   <span className="flex items-center gap-1.5 font-medium">
                     <AlertCircle className="h-3 w-3" /> ATENÇÃO: Cliente aguardando há mais de 1 hora!
                   </span>
                   <span className="opacity-80">Gerente Notificado</span>
                 </div>
               )}
               {selectedConversation.alert_status === 'yellow' && (
                 <div className="bg-yellow-400 text-black text-[11px] py-1 px-4 flex items-center gap-1.5 font-medium">
                   <Clock className="h-3 w-3" /> Responda logo: Cliente aguardando há mais de 30 minutos.
                 </div>
               )}

              {/* Chat header */}
              <div className="h-14 flex items-center gap-3 px-4 shrink-0 border-b border-border/20"
                style={{ backgroundColor: "hsl(var(--wa-header))" }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-9 w-9 text-white/80 hover:text-white hover:bg-white/10 rounded-full"
                  onClick={() => setShowMobileChat(false)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                {!isSearchingInChat ? (
                  <>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                      {selectedPhone && contactPhotos[selectedPhone] ? (
                        <img
                          src={contactPhotos[selectedPhone]}
                          alt={contactName || formatPhone(selectedConversation.phone)}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : contactName ? (
                        <span className="text-sm font-semibold text-white">{getInitials(contactName)}</span>
                      ) : (
                        <User className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] font-normal text-white truncate">
                        {contactName || formatPhone(selectedConversation.phone)}
                      </p>
                      {contactName && (
                        <p className="text-[12px] text-white/60">
                          {formatPhone(selectedConversation.phone)}
                        </p>
                      )}
                    </div>
                     <div className="flex items-center gap-2">
                       {/* Conversa da Equipe Interna: permite reclassificar o lead.
                           Ao sair de "Equipe Interna", ele volta ao Kanban e a
                           conversa deixa esta aba, indo para as abas normais. */}
                       {equipeInternaPhones.has(normPhone(selectedConversation.phone)) && (
                         <Button
                           size="sm"
                           onClick={() => setReclassifyPhone(selectedConversation.phone)}
                           className="bg-white text-[hsl(var(--wa-header))] hover:bg-white/90 font-semibold h-8 px-3"
                         >
                           <span className="flex items-center gap-1.5">
                             <Tag className="h-4 w-4" /> Classificar cliente
                           </span>
                         </Button>
                       )}
                       {(!selectedConversation.assigned_seller_id || (isSelectedStale && selectedConversation.assigned_seller_id !== sellerId)) && (
                         <Button
                           size="sm"
                            onClick={() => handleClaimLead()} disabled={isClaiming} aria-busy={isClaiming} aria-live="polite"
                           className="bg-white text-[hsl(var(--wa-header))] hover:bg-white/90 font-semibold h-8 px-3"
                         >
                           {isClaiming ? (<span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 animate-spin" /> Processando...</span>) : (<span className="flex items-center gap-1.5"><UserCheck className="h-4 w-4" /> {isSelectedStale && selectedConversation?.assigned_seller_id ? "Retomar Atendimento" : "Atender Cliente"}</span>)}
                         </Button>
                       )}
                         {(isAdmin || isGerente || isVendedor || isSuporte) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setIsTransferModalOpen(true)}
                                  aria-label="Transferir conversa"
                                  className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                                >
                                  <Forward className="h-5 w-5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Transferir conversa</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {(isAdmin || isGerente || isVendedor || isSuporte) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={openAssocModal}
                                  aria-label="Associar conversa"
                                  className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                                >
                                  <Link2 className="h-5 w-5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Associar conversa</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {isAdmin && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleExport}
                                aria-label="Exportar conversa"
                                className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                              >
                                <Download className="h-5 w-5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Exportar conversa (.txt)</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                        onClick={() => setIsSearchingInChat(true)}
                      >
                        <Search className="h-5 w-5" />
                      </Button>
                    </div>
                  </>
                ) : (
                   <div className="flex-1 flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                     <div className="flex-1 flex items-center bg-white/15 rounded-lg px-3">
                       <Search className="h-4 w-4 text-white/60 mr-2" />
                       <Input
                         autoFocus
                         placeholder="Pesquisar na conversa..."
                         value={chatSearch}
                         onChange={(e) => setChatSearch(e.target.value)}
                         className="flex-1 h-9 bg-transparent border-0 text-white placeholder:text-white/40 focus-visible:ring-0 text-sm"
                         onKeyDown={(e) => {
                           if (e.key === "Enter") navigateSearch('next');
                           if (e.key === "Escape") {
                             setIsSearchingInChat(false);
                             setChatSearch("");
                           }
                         }}
                       />
                       {chatSearch && (
                         <div className="flex items-center gap-1 border-l border-white/20 pl-2 ml-1">
                           <span className="text-[10px] text-white/60 tabular-nums whitespace-nowrap">
                             {chatSearchResults.length > 0 ? `${searchOccurrenceIndex + 1}/${chatSearchResults.length}` : '0/0'}
                           </span>
                           <Button 
                             variant="ghost" size="icon" className="h-6 w-6 text-white/80 hover:bg-white/10"
                             onClick={() => navigateSearch('prev')} disabled={chatSearchResults.length === 0}
                           >
                             <ChevronUp className="h-4 w-4" />
                           </Button>
                           <Button 
                             variant="ghost" size="icon" className="h-6 w-6 text-white/80 hover:bg-white/10"
                             onClick={() => navigateSearch('next')} disabled={chatSearchResults.length === 0}
                           >
                             <ChevronDown className="h-4 w-4" />
                           </Button>
                           <Button 
                             variant="ghost" size="icon" className="h-6 w-6 text-white/80 hover:bg-white/10"
                             onClick={() => setChatSearch("")}
                           >
                             <X className="h-3 w-3" />
                           </Button>
                         </div>
                       )}
                     </div>
                     <Button 
                       variant="ghost" 
                       size="sm"
                       className="text-white hover:bg-white/10 text-xs font-medium"
                       onClick={() => {
                         setIsSearchingInChat(false);
                         setChatSearch("");
                       }}
                     >
                       Fechar
                     </Button>
                   </div>
                )}
              </div>

              {/* Messages area - WhatsApp wallpaper style */}
              <div
                className="flex-1 overflow-y-auto px-4 sm:px-[5%] lg:px-[8%] py-2"
                style={{
                  backgroundColor: "hsl(var(--wa-chat-bg))",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              >
                <div className="max-w-3xl mx-auto space-y-1 pb-4">
                    {groupMessagesByDate(chatMessages).map(([dateKey, msgs]) => (
                    <div key={dateKey}>
                      {/* Date separator - WhatsApp style */}
                      <div className="flex justify-center my-3">
                        <span className="text-[12px] bg-card/90 px-3 py-1 rounded-lg text-foreground/70 shadow-sm">
                          {formatFullDate(msgs[0].timestamp || msgs[0].created_at || "")}
                        </span>
                      </div>
                      <div className="space-y-[2px]">
                         {msgs.map((msg) => {
                           const isSearchResult = chatSearch.length >= 2 && msg.body?.toLowerCase().includes(chatSearch.toLowerCase());
                           const searchIndex = isSearchResult ? chatSearchResults.findIndex(m => m.id === msg.id) : -1;
                           const isCurrentOccurrence = searchIndex === searchOccurrenceIndex;

                           return (
                           <motion.div
                             key={msg.id}
                             ref={el => { if (searchIndex !== -1) searchResultsRefs.current[searchIndex] = el; }}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                            className={cn(
                              "flex",
                              msg.is_from_me ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                               className={cn(
                                 "relative max-w-[85%] sm:max-w-[65%] px-3 py-1.5 text-[14.2px] leading-[19px] shadow-sm transition-all duration-300",
                                 msg.is_from_me
                                   ? "rounded-lg rounded-tr-none"
                                   : "rounded-lg rounded-tl-none",
                                 isCurrentOccurrence && "ring-2 ring-[hsl(var(--wa-green))] ring-offset-2 ring-offset-transparent scale-[1.02] z-10"
                               )}
                               style={{
                                 backgroundColor: isSearchResult 
                                   ? (isCurrentOccurrence ? "hsl(var(--wa-green)/20%)" : "rgba(255, 255, 0, 0.2)")
                                   : (msg.is_from_me ? "hsl(var(--wa-outgoing))" : "hsl(var(--wa-incoming))"),
                               }}
                            >
                              {msg.media_url && (
                                <div className="mb-1 rounded-md overflow-hidden bg-black/5">
                                  {msg.media_type === 'image' ? (
                                    <img 
                                      src={msg.media_url} 
                                      alt="Anexo" 
                                      className="max-w-full h-auto cursor-pointer"
                                      onClick={() => window.open(msg.media_url!, '_blank')}
                                    />
                                  ) : msg.media_type === 'audio' ? (
                                    <div className="p-2 min-w-[200px]">
                                      <audio 
                                        src={msg.media_url} 
                                        controls 
                                        className="w-full h-8"
                                      />
                                    </div>
                                  ) : (
                                    <div 
                                      className="flex items-center gap-2 p-2 cursor-pointer hover:bg-black/10 transition-colors"
                                      onClick={() => window.open(msg.media_url!, '_blank')}
                                    >
                                      <div className="bg-brand-500/10 p-2 rounded">
                                        <Paperclip className="h-4 w-4 text-brand-500" />
                                      </div>
                                      <span className="text-xs truncate max-w-[200px]">
                                        {msg.media_url.split('/').pop()?.slice(-20) || 'Arquivo'}
                                      </span>
                                      <Download className="h-4 w-4 text-muted-foreground ml-auto" />
                                    </div>
                                  )}
                                </div>
                              )}
                       <ChatMessageBody body={msg.body} chatSearch={chatSearch} isCurrentOccurrence={isCurrentOccurrence} />
                              <div className="flex items-center justify-end gap-1 -mb-0.5 mt-0.5">
                                <span className="text-[11px] text-foreground/60">
                                  {msg.timestamp && format(new Date(msg.timestamp), "HH:mm")}
                                </span>
                                {msg.is_from_me && (
                                  <CheckCheck className="h-[16px] w-[16px]" style={{ color: "hsl(var(--wa-green))" }} />
                                )}
                              </div>
                            </div>
                          </motion.div>
                           );
                         })}
                      </div>
                    </div>
                   ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message input bar - WhatsApp style */}
              <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ backgroundColor: "hsl(var(--wa-light))" }}>
                <EmojiPicker onSelect={(emoji) => setMessageInput((prev) => prev + emoji)} />
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileAttach}
                />
                {isRecording ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0 rounded-full"
                    onClick={cancelRecording}
                    title="Cancelar gravação"
                  >
                    <Trash2 className="h-6 w-6" />
                  </Button>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0 rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-6 w-6" />
                  </Button>
                )}
                <div className="relative flex-1">
                  {isRecording && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                  )}
                  <Input
                    placeholder="Digite uma mensagem"
                    value={isRecording ? `Gravando... ${formatDuration(recordingDuration)}` : messageInput}
                    onChange={(e) => !isRecording && setMessageInput(e.target.value)}
                    className={cn(
                      "h-[42px] rounded-lg bg-card border-0 text-[15px] placeholder:text-muted-foreground/50 focus-visible:ring-0 shadow-sm w-full",
                      isRecording && "text-red-500 font-medium pl-7"
                    )}
                    readOnly={isRecording}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                </div>
                <Button
                  size="icon"
                  className="h-[48px] w-[48px] rounded-full shrink-0 shadow-md transition-all"
                  style={{ backgroundColor: "hsl(var(--wa-green))" }}
                  disabled={(!messageInput.trim() && !isRecording && sending) || sending}
                  onClick={() => {
                    if (messageInput.trim()) {
                      handleSendMessage();
                    } else if (isRecording) {
                      stopRecording();
                    } else {
                      startRecording();
                    }
                  }}
                  title={isRecording ? "Enviar áudio" : messageInput.trim() ? "Enviar" : "Gravar áudio"}
                >
                  {messageInput.trim() ? (
                    <Send className="h-5 w-5 text-white" />
                  ) : isRecording ? (
                    <Send className="h-5 w-5 text-white" />
                  ) : (
                    <Mic className="h-6 w-6 text-white" />
                  )}
                </Button>
              </div>
            </>
          ) : (
            /* Empty state - WhatsApp Web style */
            <div className="flex-1 flex flex-col items-center justify-center bg-muted/10 border-b-[6px]"
              style={{ borderColor: "hsl(var(--wa-green))" }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-6 max-w-md text-center px-8"
              >
                <div className="h-[212px] w-[212px] rounded-full bg-muted/30 flex items-center justify-center">
                  <MessageCircle className="h-24 w-24 text-muted-foreground/20" />
                </div>
                <div>
                  <h2 className="text-[32px] font-light text-foreground/80 mb-3">
                    CRM Taeco WhatsApp
                  </h2>
                  <p className="text-[14px] text-muted-foreground leading-relaxed">
                    Envie e receba mensagens dos seus clientes diretamente pelo CRM.
                    Selecione uma conversa ao lado para começar.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground/60 mt-4">
                  <Lock className="h-3 w-3" />
                  <span>Suas mensagens são sincronizadas em tempo real</span>
                </div>
                <AnimatePresence>
                  {staleAlertConversation && (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white dark:bg-zinc-900 border-l-4 border-amber-500 shadow-2xl rounded-lg overflow-hidden flex flex-col p-4 gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">Atendimento Atrasado</h4>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            O cliente <span className="font-medium">{contactNames[staleAlertConversation.phone] || formatPhone(staleAlertConversation.phone)}</span> aguarda há {formatWaitTime(staleAlertConversation.last_message_from_client_at)}.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => {
                            handleSelectConversation(staleAlertConversation.phone);
                            dismissStaleAlert();
                          }}
                        >
                          Atender Agora
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={dismissStaleAlert}
                        >
                          Ignorar
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          )}
        </div>
      </div>
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Transferir Conversa</DialogTitle>
          <DialogDescription>
            Selecione o vendedor para quem deseja transferir este atendimento.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="seller">Novo Responsável</Label>
            <Select value={selectedTransferSeller} onValueChange={setSelectedTransferSeller}>
              <SelectTrigger id="seller">
                <SelectValue placeholder="Selecione um vendedor" />
              </SelectTrigger>
              <SelectContent>
                {sellers
                  .filter(s => s.id !== sellerId && s.is_active !== false && !!s.user_id)
                  .map(seller => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.code ? `[${seller.code}] ` : ''}{seller.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da Transferência</Label>
            <Textarea 
              id="reason"
              placeholder="Descreva o motivo da transferência (opcional)"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsTransferModalOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleTransferConversation} 
            disabled={!selectedTransferSeller || isTransferring}
            className="bg-[hsl(var(--wa-green))] hover:bg-[hsl(var(--wa-green))/90] text-white"
          >
            {isTransferring ? "Transferindo..." : "Transferir"}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>

      <Dialog open={isAssocModalOpen} onOpenChange={setIsAssocModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Associar conversa</DialogTitle>
            <DialogDescription>
              Classifique o contato. Se for intermediário, vincule ao cliente final cadastrado no ERP.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Categoria do contato</Label>
              <Select value={assocCategory} onValueChange={(v) => { setAssocCategory(v); setSelectedErpClient(null); setErpResults([]); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sindico">Síndico</SelectItem>
                  <SelectItem value="comprador">Comprador</SelectItem>
                  <SelectItem value="pintor">Pintor</SelectItem>
                  <SelectItem value="arquiteto">Arquiteto</SelectItem>
                  <SelectItem value="construtor">Construtor</SelectItem>
                  <SelectItem value="consumidor_final">Consumidor final</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {assocCategory && assocCategory !== "consumidor_final" && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Cliente final no ERP</Label>
                {selectedErpClient ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{selectedErpClient.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {selectedErpClient.erpId ? `Código ${selectedErpClient.erpId}` : ""}{selectedErpClient.document ? ` · ${selectedErpClient.document}` : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedErpClient(null)}>Trocar</Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome do cliente no ERP"
                        value={erpSearchQuery}
                        onChange={(e) => setErpSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleErpSearch(); } }}
                      />
                      <Button onClick={handleErpSearch} disabled={erpSearching} className="shrink-0">
                        {erpSearching ? "Buscando..." : "Buscar"}
                      </Button>
                    </div>
                    {erpResults.length > 0 && (
                      <div className="max-h-52 overflow-y-auto rounded-lg border border-border/60 divide-y">
                        {erpResults.map((r, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => { setSelectedErpClient(r); setErpResults([]); }}
                            className="w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors"
                          >
                            <p className="text-sm font-medium truncate">{r.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {r.erpId ? `Código ${r.erpId}` : ""}{r.document ? ` · ${r.document}` : ""}{r.city ? ` · ${r.city}` : ""}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {assocCategory === "consumidor_final" && (
              <p className="text-xs text-muted-foreground">
                Consumidor final: o próprio contato é o cliente — não precisa vincular ao ERP.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssocModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAssociation} disabled={savingAssoc}>
              {savingAssoc ? "Salvando..." : "Salvar associação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova conversa</DialogTitle>
            <DialogDescription>
              Inicie um atendimento mandando a primeira mensagem para um número.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Buscar cliente <span className="font-normal text-muted-foreground">(nome, CNPJ, CPF ou código)</span></Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar cliente no ERP..."
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNewChatSearch()}
                />
                <Button size="sm" variant="secondary" onClick={handleNewChatSearch} disabled={newChatSearching}>
                  {newChatSearching ? "..." : "Buscar"}
                </Button>
              </div>
              {newChatResults.length > 0 && (
                <div className="max-h-44 overflow-y-auto rounded-lg border border-border/60 divide-y">
                  {newChatResults.map((c) => (
                    <button
                      key={c.erpId || c.document || c.name}
                      onClick={() => pickNewChatClient(c)}
                      className="w-full text-left p-2 hover:bg-muted transition-colors"
                    >
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground flex gap-1.5 flex-wrap items-center mt-0.5">
                        {c.erpId && <span className="bg-muted px-1.5 py-0.5 rounded">COD: {c.erpId}</span>}
                        {c.document && <span>{c.document}</span>}
                        {c.phone && <span>• {c.phone}</span>}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {newChatErpClient && (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-brand-500/30 bg-brand-500/5 p-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{newChatErpClient.name}</p>
                  <p className="text-[11px] text-muted-foreground flex gap-1.5 flex-wrap items-center mt-0.5">
                    {newChatErpClient.erpId && <span className="bg-muted px-1.5 py-0.5 rounded">COD: {newChatErpClient.erpId}</span>}
                    {newChatErpClient.document && <span>{newChatErpClient.document}</span>}
                    {newChatErpClient.phone
                      ? <span className="text-emerald-600">✓ telefone preenchido</span>
                      : <span className="text-amber-600">sem telefone no ERP — digite o número abaixo</span>}
                  </p>
                </div>
                <button type="button" onClick={() => setNewChatErpClient(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Número (com DDD)</Label>
              <Input
                placeholder="Ex.: 21 99999-8888"
                value={newChatPhone}
                onChange={(e) => setNewChatPhone(e.target.value)}
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Input
                placeholder="Nome do contato"
                value={newChatName}
                onChange={(e) => setNewChatName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Primeira mensagem</Label>
              <Textarea
                placeholder="Escreva a mensagem que será enviada..."
                value={newChatMessage}
                onChange={(e) => setNewChatMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewChatOpen(false)}>Cancelar</Button>
            <Button onClick={handleStartNewChat} disabled={newChatSending} className="gap-1.5">
              <Send className="h-4 w-4" /> {newChatSending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Classificar cliente (aba Equipe Interna) */}
      <Dialog open={!!reclassifyPhone} onOpenChange={(o) => { if (!o) { setReclassifyPhone(null); setReclassifyType(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Classificar cliente</DialogTitle>
            <DialogDescription>
              Ao escolher um tipo diferente de "Equipe Interna", o lead volta para o
              Kanban e a conversa sai da aba Interna.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tipo de Cliente</Label>
            <Select value={reclassifyType} onValueChange={setReclassifyType}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {CLIENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReclassifyPhone(null); setReclassifyType(""); }}>
              Cancelar
            </Button>
            <Button onClick={handleReclassify} disabled={!reclassifyType || isReclassifying} className="gap-1.5">
              <Tag className="h-4 w-4" /> {isReclassifying ? "Salvando..." : "Classificar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
