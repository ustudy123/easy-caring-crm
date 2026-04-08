import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, MessageSquare, ArrowLeft, Send, Phone, User, CheckCheck, Smile, Paperclip, Mic, MoreVertical, MessageCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──
interface WhatsAppMessage {
  id: string;
  message_id: string;
  phone: string;
  body: string | null;
  is_from_me: boolean | null;
  timestamp: string | null;
  created_at: string | null;
}

interface Conversation {
  phone: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  messages: WhatsAppMessage[];
}

// ── Helpers ──
function formatMessageDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM/yy");
}

function formatFullDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
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

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── Avatar colors using design tokens ──
const avatarGradients = [
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-teal-500 to-cyan-600",
  "from-indigo-500 to-blue-700",
  "from-orange-500 to-red-500",
];

function getAvatarGradient(phone: string) {
  let hash = 0;
  for (let i = 0; i < phone.length; i++) hash = phone.charCodeAt(i) + ((hash << 5) - hash);
  return avatarGradients[Math.abs(hash) % avatarGradients.length];
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
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [useMock, setUseMock] = useState(false);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .order("timestamp", { ascending: true });
      if (data && data.length > 0) {
        setMessages(data as WhatsAppMessage[]);
        setUseMock(false);
      } else {
        setMessages(mockMessages);
        setUseMock(true);
      }
      setLoading(false);
    };
    fetchMessages();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, (payload) => {
        setMessages((prev) => [...prev, payload.new as WhatsAppMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedPhone, messages]);

  const conversations: Conversation[] = (() => {
    const map = new Map<string, Conversation>();
    messages.forEach((msg) => {
      const phone = msg.phone;
      if (!map.has(phone)) {
        map.set(phone, { phone, lastMessage: "", lastTimestamp: "", unreadCount: 0, messages: [] });
      }
      const conv = map.get(phone)!;
      conv.messages.push(msg);
      const ts = msg.timestamp || msg.created_at || "";
      if (!conv.lastTimestamp || ts > conv.lastTimestamp) {
        conv.lastTimestamp = ts;
        conv.lastMessage = msg.body || "";
      }
      if (!msg.is_from_me) conv.unreadCount++;
    });
    return Array.from(map.values()).sort((a, b) => b.lastTimestamp.localeCompare(a.lastTimestamp));
  })();

  const filteredConversations = conversations.filter((c) => {
    const name = contactNames[c.phone] || "";
    return c.phone.includes(search) || c.lastMessage.toLowerCase().includes(search.toLowerCase()) || name.toLowerCase().includes(search.toLowerCase());
  });

  const selectedConversation = conversations.find((c) => c.phone === selectedPhone);

  const handleSelectConversation = (phone: string) => {
    setSelectedPhone(phone);
    setShowMobileChat(true);
  };

  useEffect(() => {
    if (useMock) {
      setContactNames(mockContactNames);
      return;
    }
    const phones = conversations.map(c => c.phone);
    if (phones.length === 0) return;
    const fetchNames = async () => {
      const names: Record<string, string> = {};
      const { data: leads } = await supabase.from("leads").select("client_name, client_phone");
      const { data: clients } = await supabase.from("clients").select("name, phone");
      leads?.forEach(l => { if (phones.includes(l.client_phone)) names[l.client_phone] = l.client_name; });
      clients?.forEach(c => { if (phones.includes(c.phone) && !names[c.phone]) names[c.phone] = c.name; });
      setContactNames(names);
    };
    fetchNames();
  }, [useMock, conversations.length]);

  const contactName = selectedPhone ? contactNames[selectedPhone] || null : null;

  return (
    <AppLayout title="Conversas">
      <div className="flex h-[calc(100vh-8rem)] rounded-2xl overflow-hidden border border-border/60 bg-card" style={{ boxShadow: "var(--shadow-elevated)" }}>
        {/* ── Left panel ── */}
        <div className={cn(
          "w-full md:w-[380px] flex flex-col shrink-0 border-r border-border/40",
          showMobileChat && "hidden md:flex"
        )}>
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-4 bg-gradient-to-r from-primary to-primary/80 shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary-foreground/15 flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-primary-foreground" />
              </div>
              <h2 className="text-primary-foreground font-bold text-base tracking-tight">Conversas</h2>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="bg-primary-foreground/15 text-primary-foreground border-0 text-xs font-semibold">
                {conversations.length}
              </Badge>
            </div>
          </div>

          {/* Search */}
          <div className="p-3 bg-card border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar conversa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-muted/50 border-border/40 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </div>
          </div>

          {/* Conversations list */}
          <ScrollArea className="flex-1 bg-card">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground gap-2">
                <Clock className="h-4 w-4 animate-spin" />
                Carregando conversas...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center">
                  <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <span className="text-sm">Nenhuma conversa encontrada</span>
              </div>
            ) : (
              <div className="py-1">
                <AnimatePresence>
                  {filteredConversations.map((conv, idx) => {
                    const name = contactNames[conv.phone] || formatPhone(conv.phone);
                    const lastMsgIsFromMe = conv.messages[conv.messages.length - 1]?.is_from_me;
                    const isSelected = selectedPhone === conv.phone;
                    return (
                      <motion.button
                        key={conv.phone}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.2 }}
                        onClick={() => handleSelectConversation(conv.phone)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-3 text-left transition-all duration-200",
                          isSelected
                            ? "bg-primary/8 border-l-3 border-l-primary"
                            : "hover:bg-muted/40 border-l-3 border-l-transparent"
                        )}
                      >
                        {/* Avatar */}
                        <div className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white font-bold text-sm shadow-sm",
                          getAvatarGradient(conv.phone)
                        )}>
                          {contactNames[conv.phone] ? getInitials(contactNames[conv.phone]) : <User className="h-5 w-5" />}
                        </div>

                        <div className="flex-1 min-w-0 py-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn(
                              "text-[15px] truncate",
                              isSelected ? "font-bold text-foreground" : "font-medium text-foreground"
                            )}>
                              {name}
                            </span>
                            <span className={cn(
                              "text-[11px] shrink-0 font-medium",
                              conv.unreadCount > 0 ? "text-primary" : "text-muted-foreground"
                            )}>
                              {conv.lastTimestamp && formatMessageDate(conv.lastTimestamp)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {lastMsgIsFromMe && (
                              <CheckCheck className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                            )}
                            <p className="text-[13px] text-muted-foreground truncate flex-1">
                              {conv.lastMessage || "Sem mensagem"}
                            </p>
                            {conv.unreadCount > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ── Right panel - Chat ── */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 bg-muted/20",
          !showMobileChat && "hidden md:flex"
        )}>
          {selectedConversation ? (
            <>
              {/* Chat header */}
              <div className="h-16 flex items-center gap-3 px-4 bg-gradient-to-r from-primary to-primary/80 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
                  onClick={() => setShowMobileChat(false)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white font-bold text-sm shadow-sm ring-2 ring-primary-foreground/20",
                  getAvatarGradient(selectedConversation.phone)
                )}>
                  {contactName ? getInitials(contactName) : <User className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-primary-foreground truncate">
                    {contactName || formatPhone(selectedConversation.phone)}
                  </p>
                  {contactName && (
                    <p className="text-[11px] text-primary-foreground/60 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {formatPhone(selectedConversation.phone)}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>

              {/* Messages area */}
              <div
                className="flex-1 overflow-y-auto p-4 sm:p-6"
                style={{
                  background: "linear-gradient(180deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--background)) 100%)",
                }}
              >
                <div className="max-w-3xl mx-auto space-y-2">
                  {groupMessagesByDate(selectedConversation.messages).map(([dateKey, msgs]) => (
                    <div key={dateKey}>
                      {/* Date separator */}
                      <div className="flex justify-center my-4">
                        <span className="text-[11px] glass-card px-4 py-1.5 rounded-full text-muted-foreground font-semibold shadow-sm border border-border/30">
                          {formatFullDate(msgs[0].timestamp || msgs[0].created_at || "")}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {msgs.map((msg) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                              "flex",
                              msg.is_from_me ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "relative max-w-[80%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed",
                                msg.is_from_me
                                  ? "bg-primary text-primary-foreground rounded-br-md shadow-md"
                                  : "bg-card text-foreground rounded-bl-md shadow-sm border border-border/40"
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words">
                                {msg.body || ""}
                              </p>
                              <div className="flex items-center justify-end gap-1 mt-1">
                                <span className={cn(
                                  "text-[10px]",
                                  msg.is_from_me ? "text-primary-foreground/60" : "text-muted-foreground"
                                )}>
                                  {msg.timestamp && format(new Date(msg.timestamp), "HH:mm")}
                                </span>
                                {msg.is_from_me && (
                                  <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/60" />
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message input bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-card border-t border-border/40 shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0 rounded-xl">
                  <Smile className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0 rounded-xl">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Input
                  placeholder="Digite uma mensagem..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="flex-1 h-10 rounded-xl bg-muted/40 border-border/40 text-sm focus-visible:ring-1 focus-visible:ring-primary/30"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-md transition-all"
                >
                  {messageInput.trim() ? (
                    <Send className="h-4 w-4" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-5"
              style={{ background: "linear-gradient(180deg, hsl(var(--muted) / 0.2) 0%, hsl(var(--background)) 100%)" }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shadow-lg">
                  <MessageSquare className="h-12 w-12 text-primary/50" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground/80">Central de Atendimento</p>
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
                    Selecione uma conversa ao lado para visualizar as mensagens e interagir com seus clientes.
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
