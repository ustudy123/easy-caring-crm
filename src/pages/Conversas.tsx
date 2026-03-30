import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, ArrowLeft, Send, Phone, User } from "lucide-react";
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

const now = new Date();
const mockMessages: WhatsAppMessage[] = [
  // Conversa 1 - João Silva
  { id: "m1", message_id: "mock1", phone: "5511999887766", body: "Olá, gostaria de saber o preço da tinta acrílica Suvinil 18L", is_from_me: false, timestamp: new Date(now.getTime() - 3600000 * 3).toISOString(), created_at: null },
  { id: "m2", message_id: "mock2", phone: "5511999887766", body: "Claro! A tinta acrílica Suvinil 18L está por R$ 289,90. Temos pronta entrega. Deseja reservar?", is_from_me: true, timestamp: new Date(now.getTime() - 3600000 * 2.5).toISOString(), created_at: null },
  { id: "m3", message_id: "mock3", phone: "5511999887766", body: "Ótimo! Pode reservar 2 latas na cor Branco Neve pra mim?", is_from_me: false, timestamp: new Date(now.getTime() - 3600000 * 2).toISOString(), created_at: null },
  { id: "m4", message_id: "mock4", phone: "5511999887766", body: "Reservado! Pode retirar até amanhã às 18h. Total: R$ 579,80 👍", is_from_me: true, timestamp: new Date(now.getTime() - 3600000 * 1.5).toISOString(), created_at: null },
  // Conversa 2 - Maria Oliveira
  { id: "m5", message_id: "mock5", phone: "5521988776655", body: "Bom dia! Vocês fazem entrega em Niterói?", is_from_me: false, timestamp: new Date(now.getTime() - 86400000).toISOString(), created_at: null },
  { id: "m6", message_id: "mock6", phone: "5521988776655", body: "Bom dia, Maria! Sim, entregamos em Niterói. O frete sai por R$ 35,00 para pedidos acima de R$ 200.", is_from_me: true, timestamp: new Date(now.getTime() - 86400000 + 1800000).toISOString(), created_at: null },
  { id: "m7", message_id: "mock7", phone: "5521988776655", body: "Perfeito! Vou montar meu pedido e te mando a lista", is_from_me: false, timestamp: new Date(now.getTime() - 86400000 + 3600000).toISOString(), created_at: null },
  // Conversa 3 - Carlos Construções
  { id: "m8", message_id: "mock8", phone: "5531977665544", body: "Preciso de um orçamento para 50 latas de tinta latex para obra comercial", is_from_me: false, timestamp: new Date(now.getTime() - 86400000 * 2).toISOString(), created_at: null },
  { id: "m9", message_id: "mock9", phone: "5531977665544", body: "Boa tarde, Carlos! Para essa quantidade temos condições especiais. Qual a cor e marca de preferência?", is_from_me: true, timestamp: new Date(now.getTime() - 86400000 * 2 + 3600000).toISOString(), created_at: null },
  { id: "m10", message_id: "mock10", phone: "5531977665544", body: "Pode ser Coral, cor Branco Gelo. Preciso para a semana que vem", is_from_me: false, timestamp: new Date(now.getTime() - 86400000 * 2 + 7200000).toISOString(), created_at: null },
  { id: "m11", message_id: "mock11", phone: "5531977665544", body: "Montei o orçamento: 50 latas Coral Látex Branco Gelo 18L por R$ 12.450,00 com frete grátis. Posso enviar o PDF?", is_from_me: true, timestamp: new Date(now.getTime() - 86400000 * 1.5).toISOString(), created_at: null },
  // Conversa 4 - Ana Decorações
  { id: "m12", message_id: "mock12", phone: "5541966554433", body: "Oi! Vocês têm tinta com efeito cimento queimado?", is_from_me: false, timestamp: new Date(now.getTime() - 3600000 * 5).toISOString(), created_at: null },
  { id: "m13", message_id: "mock13", phone: "5541966554433", body: "Temos sim! A linha Efeito Decorativo da Suvinil. Temos em estoque nas cores Concreto, Grafite e Areia.", is_from_me: true, timestamp: new Date(now.getTime() - 3600000 * 4).toISOString(), created_at: null },
  { id: "m14", message_id: "mock14", phone: "5541966554433", body: "Quanto rende cada galão?", is_from_me: false, timestamp: new Date(now.getTime() - 3600000 * 3.5).toISOString(), created_at: null },
  { id: "m15", message_id: "mock15", phone: "5541966554433", body: "Cada galão de 5L rende cerca de 15m². Para um ambiente de 40m² recomendo 3 galões. O valor unitário é R$ 189,90.", is_from_me: true, timestamp: new Date(now.getTime() - 3600000).toISOString(), created_at: null },
  // Conversa 5 - Roberto Pintor
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

export default function Conversas() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [useMock, setUseMock] = useState(false);

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

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, (payload) => {
        setMessages((prev) => [...prev, payload.new as WhatsAppMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Scroll to bottom when selected conversation changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedPhone, messages]);

  // Build conversations from messages
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
    });
    return Array.from(map.values()).sort((a, b) => b.lastTimestamp.localeCompare(a.lastTimestamp));
  })();

  const filteredConversations = conversations.filter((c) =>
    c.phone.includes(search) || c.lastMessage.toLowerCase().includes(search.toLowerCase())
  );

  const selectedConversation = conversations.find((c) => c.phone === selectedPhone);

  const handleSelectConversation = (phone: string) => {
    setSelectedPhone(phone);
    setShowMobileChat(true);
  };

  // Check if lead exists for this phone
  const [contactName, setContactName] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedPhone) { setContactName(null); return; }
    const fetchName = async () => {
      const { data } = await supabase
        .from("leads")
        .select("client_name")
        .eq("client_phone", selectedPhone)
        .limit(1);
      if (data && data.length > 0) {
        setContactName(data[0].client_name);
      } else {
        const { data: clientData } = await supabase
          .from("clients")
          .select("name")
          .eq("phone", selectedPhone)
          .limit(1);
        setContactName(clientData && clientData.length > 0 ? clientData[0].name : null);
      }
    };
    fetchName();
  }, [selectedPhone]);

  return (
    <AppLayout title="Conversas">
      <div className="flex h-[calc(100vh-8rem)] rounded-xl border bg-card overflow-hidden">
        {/* Sidebar - Lista de conversas */}
        <div className={cn(
          "w-full md:w-96 border-r flex flex-col bg-card shrink-0",
          showMobileChat && "hidden md:flex"
        )}>
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-muted/50"
              />
            </div>
          </div>

          {/* Conversations list */}
          <ScrollArea className="flex-1">
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
              <div className="divide-y">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.phone}
                    onClick={() => handleSelectConversation(conv.phone)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors",
                      selectedPhone === conv.phone && "bg-muted"
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {formatPhone(conv.phone)}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {conv.lastTimestamp && formatMessageDate(conv.lastTimestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.lastMessage || "Sem mensagem"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Main - Chat area */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          !showMobileChat && "hidden md:flex"
        )}>
          {selectedConversation ? (
            <>
              {/* Chat header */}
              <div className="h-14 flex items-center gap-3 px-4 border-b bg-card shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8"
                  onClick={() => setShowMobileChat(false)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {contactName || formatPhone(selectedConversation.phone)}
                  </p>
                  {contactName && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {formatPhone(selectedConversation.phone)}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {selectedConversation.messages.length} msgs
                </Badge>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="max-w-2xl mx-auto space-y-4">
                  {groupMessagesByDate(selectedConversation.messages).map(([dateKey, msgs]) => (
                    <div key={dateKey}>
                      <div className="flex justify-center my-3">
                        <span className="text-[10px] bg-muted px-3 py-1 rounded-full text-muted-foreground font-medium">
                          {formatFullDate(msgs[0].timestamp || msgs[0].created_at || "")}
                        </span>
                      </div>
                      <div className="space-y-1.5">
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
                                "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                                msg.is_from_me
                                  ? "bg-primary text-primary-foreground rounded-br-md"
                                  : "bg-muted text-foreground rounded-bl-md"
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words">{msg.body || ""}</p>
                              <p className={cn(
                                "text-[10px] mt-1 text-right",
                                msg.is_from_me ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                {msg.timestamp && format(new Date(msg.timestamp), "HH:mm")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-8 w-8" />
              </div>
              <p className="text-sm font-medium">Selecione uma conversa</p>
              <p className="text-xs">Escolha um contato para ver o histórico de mensagens</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
