import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, ArrowLeft, Send, Phone, User, Check, CheckCheck, Smile, Paperclip, Mic, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  if (clean.length === 13) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 12) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  }
  return phone;
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

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

// Avatar color palette
const avatarColors = [
  "bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-rose-500",
  "bg-teal-500", "bg-indigo-500", "bg-orange-500",
];

function getAvatarColor(phone: string) {
  let hash = 0;
  for (let i = 0; i < phone.length; i++) hash = phone.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

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
      // Count unread (incoming messages)
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

  // Contact name resolution
  const [contactNames, setContactNames] = useState<Record<string, string>>({});
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
      <div className="flex h-[calc(100vh-8rem)] rounded-xl overflow-hidden border border-border shadow-lg">
        {/* Left panel - Conversation list */}
        <div className={cn(
          "w-full md:w-[380px] flex flex-col shrink-0 border-r border-border",
          showMobileChat && "hidden md:flex"
        )}>
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-4 bg-[hsl(var(--wa-teal))] shrink-0">
            <h2 className="text-white font-semibold text-base">Conversas</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="p-2 bg-card">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar ou começar uma nova conversa"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-lg bg-muted/60 border-0 text-sm placeholder:text-muted-foreground/70 focus-visible:ring-0"
              />
            </div>
          </div>

          {/* Conversations list */}
          <ScrollArea className="flex-1 bg-card">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                Carregando conversas...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                <MessageSquare className="h-8 w-8 opacity-50" />
                <span className="text-sm">Nenhuma conversa encontrada</span>
              </div>
            ) : (
              <div>
                {filteredConversations.map((conv) => {
                  const name = contactNames[conv.phone] || formatPhone(conv.phone);
                  const lastMsgIsFromMe = conv.messages[conv.messages.length - 1]?.is_from_me;
                  return (
                    <button
                      key={conv.phone}
                      onClick={() => handleSelectConversation(conv.phone)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50",
                        selectedPhone === conv.phone && "bg-muted"
                      )}
                    >
                      {/* Avatar */}
                      <div className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white font-semibold text-sm",
                        getAvatarColor(conv.phone)
                      )}>
                        {contactNames[conv.phone] ? getInitials(contactNames[conv.phone]) : <User className="h-5 w-5" />}
                      </div>

                      <div className="flex-1 min-w-0 border-b border-border/40 pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[15px] font-medium text-foreground truncate">
                            {name}
                          </span>
                          <span className={cn(
                            "text-xs shrink-0",
                            conv.unreadCount > 0 ? "text-[hsl(var(--wa-green))] font-medium" : "text-muted-foreground"
                          )}>
                            {conv.lastTimestamp && formatMessageDate(conv.lastTimestamp)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {lastMsgIsFromMe && (
                            <CheckCheck className="h-4 w-4 shrink-0 text-sky-500" />
                          )}
                          <p className="text-sm text-muted-foreground truncate">
                            {conv.lastMessage || "Sem mensagem"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right panel - Chat area */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          !showMobileChat && "hidden md:flex"
        )}>
          {selectedConversation ? (
            <>
              {/* Chat header */}
              <div className="h-14 flex items-center gap-3 px-3 bg-[hsl(var(--wa-teal))] shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                  onClick={() => setShowMobileChat(false)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-semibold text-sm",
                  getAvatarColor(selectedConversation.phone)
                )}>
                  {contactName ? getInitials(contactName) : <User className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {contactName || formatPhone(selectedConversation.phone)}
                  </p>
                  {contactName && (
                    <p className="text-[11px] text-white/70 flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {formatPhone(selectedConversation.phone)}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>

              {/* Messages area with WhatsApp-style background */}
              <div
                className="flex-1 overflow-y-auto p-3 sm:p-4"
                style={{
                  backgroundColor: "hsl(var(--wa-chat-bg))",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 10c-2 0-4 1-4 3s2 3 4 3 4-1 4-3-2-3-4-3zm-15 15c-2 0-4 1-4 3s2 3 4 3 4-1 4-3-2-3-4-3zm30 0c-2 0-4 1-4 3s2 3 4 3 4-1 4-3-2-3-4-3zm-15 15c-2 0-4 1-4 3s2 3 4 3 4-1 4-3-2-3-4-3z' fill='%23000' fill-opacity='.03'/%3E%3C/svg%3E")`,
                }}
              >
                <div className="max-w-3xl mx-auto space-y-2">
                  {groupMessagesByDate(selectedConversation.messages).map(([dateKey, msgs]) => (
                    <div key={dateKey}>
                      {/* Date separator */}
                      <div className="flex justify-center my-3">
                        <span className="text-[11px] bg-white/80 dark:bg-card/80 backdrop-blur-sm px-3 py-1 rounded-lg text-muted-foreground font-medium shadow-sm">
                          {formatFullDate(msgs[0].timestamp || msgs[0].created_at || "")}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {msgs.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex",
                              msg.is_from_me ? "justify-end" : "justify-start"
                            )}
                          >
                            <div
                              className={cn(
                                "relative max-w-[80%] sm:max-w-[65%] rounded-lg px-3 py-1.5 text-[14.5px] shadow-sm",
                                msg.is_from_me
                                  ? "bg-[hsl(var(--wa-outgoing))] dark:bg-[hsl(142,40%,25%)] rounded-tr-none"
                                  : "bg-white dark:bg-card rounded-tl-none"
                              )}
                            >
                              {/* Message tail */}
                              <div className={cn(
                                "absolute top-0 w-3 h-3",
                                msg.is_from_me
                                  ? "-right-1.5 border-l-[6px] border-l-[hsl(var(--wa-outgoing))] dark:border-l-[hsl(142,40%,25%)] border-t-[6px] border-t-[hsl(var(--wa-outgoing))] dark:border-t-[hsl(142,40%,25%)] border-r-[6px] border-r-transparent border-b-[6px] border-b-transparent"
                                  : "-left-1.5 border-r-[6px] border-r-white dark:border-r-card border-t-[6px] border-t-white dark:border-t-card border-l-[6px] border-l-transparent border-b-[6px] border-b-transparent"
                              )} />

                              <p className="whitespace-pre-wrap break-words text-foreground leading-[1.35]">
                                {msg.body || ""}
                              </p>
                              <div className={cn(
                                "flex items-center justify-end gap-1 -mb-0.5 mt-0.5",
                              )}>
                                <span className="text-[10px] text-muted-foreground">
                                  {msg.timestamp && format(new Date(msg.timestamp), "HH:mm")}
                                </span>
                                {msg.is_from_me && (
                                  <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Message input bar */}
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-t border-border shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0">
                  <Smile className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Input
                  placeholder="Digite uma mensagem"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="flex-1 h-10 rounded-lg bg-card border-0 text-sm focus-visible:ring-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      // TODO: Send message via API
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full bg-[hsl(var(--wa-teal))] hover:bg-[hsl(var(--wa-green-dark))] text-white shrink-0"
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
            <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ backgroundColor: "hsl(var(--wa-chat-bg))" }}>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/80">
                <MessageSquare className="h-10 w-10 text-muted-foreground/60" />
              </div>
              <div className="text-center">
                <p className="text-xl font-light text-foreground/80">CRM Taeco Web</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Envie e receba mensagens pelo WhatsApp. Selecione uma conversa ao lado para começar.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
