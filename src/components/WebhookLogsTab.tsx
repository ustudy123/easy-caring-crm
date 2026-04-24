import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function WebhookLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Erro ao carregar logs: " + error.message);
    } else if (data) {
      setLogs(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
    let interval: any;
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 5000);
    }
    return () => clearInterval(interval);
  }, [fetchLogs, autoRefresh]);

  const getEventBadge = (rawData: any) => {
    const event = rawData?.event || rawData?.type || rawData?.action || "unknown";
    return <Badge variant="outline" className="capitalize">{event}</Badge>;
  };

  return (
    <div className="grid gap-4 md:grid-cols-1">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Logs em Tempo Real (WhatsApp Webhook)</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Mostrando as últimas 50 mensagens recebidas pelo sistema.
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? "bg-primary/10 text-primary hover:bg-primary/20" : ""}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Auto-refresh: ON" : "Auto-refresh: OFF"}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              Atualizar Agora
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && logs.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[180px]">Data/Hora</TableHead>
                    <TableHead className="w-[140px]">Número</TableHead>
                    <TableHead className="w-[100px]">Evento</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className={log.is_from_me ? "bg-muted/30" : ""}>
                      <TableCell className="text-xs font-mono">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">{log.phone}</TableCell>
                      <TableCell>{getEventBadge(log.raw_data)}</TableCell>
                      <TableCell className="max-w-md truncate text-xs" title={log.body}>
                        {log.body}
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" title="Ver Detalhes">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                            <DialogHeader>
                              <DialogTitle>Detalhes do Webhook</DialogTitle>
                            </DialogHeader>
                            <div className="flex-1 overflow-auto py-4">
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground font-medium">Telefone:</p>
                                    <p>{log.phone}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground font-medium">ID da Mensagem:</p>
                                    <p className="font-mono text-xs">{log.message_id}</p>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-muted-foreground font-medium text-sm mb-1">Conteúdo:</p>
                                  <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                                    {log.body}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-muted-foreground font-medium text-sm mb-1">JSON Bruto (Payload):</p>
                                  <pre className="p-3 bg-slate-950 text-slate-50 rounded-md text-[10px] overflow-auto max-h-64 leading-tight">
                                    {JSON.stringify(log.raw_data, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                        Nenhum log de webhook encontrado ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}