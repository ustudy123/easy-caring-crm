 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Label } from "@/components/ui/label";
 import { Switch } from "@/components/ui/switch";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 import { AppLayout } from "@/components/AppLayout";
 
 const WebhookSimulator = () => {
   const [phone, setPhone] = useState("5511999999999");
   const [text, setText] = useState("Oi, gostaria de informações");
   const [messageId, setMessageId] = useState(crypto.randomUUID());
   const [isDuplicate, setIsDuplicate] = useState(false);
   const [loading, setLoading] = useState(false);
   const [response, setResponse] = useState<any>(null);
 
   const simulateWebhook = async () => {
     setLoading(true);
     try {
       const payload = {
         event: "message",
         test_mode: true,
         data: {
           from: `${phone}@s.whatsapp.net`,
           text: text,
           id: isDuplicate ? messageId : crypto.randomUUID(),
           fromMe: false,
           timestamp: Date.now()
         }
       };
 
       if (!isDuplicate) {
         setMessageId(payload.data.id);
       }
 
       const { data, error } = await supabase.functions.invoke("whatsapp-webhook", {
         body: payload,
       });
 
       if (error) throw error;
       setResponse(data);
       toast.success("Webhook enviado com sucesso!");
     } catch (error: any) {
       console.error("Erro ao simular webhook:", error);
       toast.error(`Erro: ${error.message}`);
     } finally {
       setLoading(false);
     }
   };
 
   return (
     <AppLayout title="Simulador de Webhook">
       <div className="container mx-auto py-8">
         <Card className="max-w-2xl mx-auto">
           <CardHeader>
             <CardTitle>Simulador de Webhook (Modo Teste)</CardTitle>
             <CardDescription>
               Use esta ferramenta para testar o fluxo da IA e a deduplicação de mensagens sem enviar mensagens reais pelo WhatsApp.
             </CardDescription>
           </CardHeader>
           <CardContent className="space-y-6">
             <div className="space-y-2">
               <Label htmlFor="phone">Telefone do Cliente (com DDI)</Label>
               <Input 
                 id="phone" 
                 value={phone} 
                 onChange={(e) => setPhone(e.target.value)} 
                 placeholder="Ex: 5511999999999"
               />
             </div>
             
             <div className="space-y-2">
               <Label htmlFor="text">Mensagem</Label>
               <Textarea 
                 id="text" 
                 value={text} 
                 onChange={(e) => setText(e.target.value)} 
                 placeholder="Digite a mensagem para a IA..."
               />
             </div>
 
             <div className="flex items-center space-x-2">
               <Switch 
                 id="duplicate" 
                 checked={isDuplicate} 
                 onCheckedChange={setIsDuplicate} 
               />
               <Label htmlFor="duplicate">Simular Mensagem Repetida (mesmo ID)</Label>
             </div>
 
             {isDuplicate && (
               <div className="p-3 bg-muted rounded-md text-sm break-all">
                 <strong>ID da Mensagem atual:</strong> {messageId}
               </div>
             )}
 
             <Button 
               onClick={simulateWebhook} 
               disabled={loading} 
               className="w-full"
             >
               {loading ? "Processando..." : "Enviar Webhook de Teste"}
             </Button>
 
             {response && (
               <div className="mt-6 space-y-2">
                 <Label>Resposta do Webhook:</Label>
                 <pre className="p-4 bg-slate-900 text-slate-100 rounded-md overflow-auto text-xs">
                   {JSON.stringify(response, null, 2)}
                 </pre>
               </div>
             )}
           </CardContent>
         </Card>
       </div>
     </AppLayout>
   );
 };
 
 export default WebhookSimulator;