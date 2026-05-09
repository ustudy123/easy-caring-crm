 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
     const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const supabase = createClient(supabaseUrl, supabaseKey);
 
      // Find clients waiting for response
      // Logic: last_message_from_client_at is more recent than last_seller_response_at
      const { data: clients, error } = await supabase
        .from("clients")
        .select(`
          id, 
          name, 
          assigned_seller_id, 
          last_message_from_client_at, 
          last_seller_response_at, 
          alert_status, 
          store_id,
          phone
        `)
        .not("last_message_from_client_at", "is", null);

      if (error) throw error;

      const now = new Date();
      const processed = [];

      for (const client of clients) {
        const lastClientMsg = new Date(client.last_message_from_client_at);
        const lastSellerResp = client.last_seller_response_at ? new Date(client.last_seller_response_at) : new Date(0);

        // If client messaged after seller last responded (or seller never responded)
        if (lastClientMsg > lastSellerResp) {
          const diffMs = now.getTime() - lastClientMsg.getTime();
          const diffMins = Math.floor(diffMs / (1000 * 60));

          let newStatus = client.alert_status || 'none';
          let notificationType = null;
          let notificationRole = null;
          let notificationMessage = "";

          if (diffMins >= 90) { // 1h 30m - Alerta Crítico (Admin)
            if (newStatus !== 'critical') {
              newStatus = 'critical';
              notificationType = 'sla_critical';
              notificationRole = 'admin';
              notificationMessage = `🚨 ALERTA CRÍTICO: Cliente ${client.name} (${client.phone}) sem resposta há mais de 1h30. Ação imediata necessária!`;
            }
          } else if (diffMins >= 60) { // 1h - Alerta Vermelho (Gerente)
            if (newStatus !== 'red' && newStatus !== 'critical') {
              newStatus = 'red';
              notificationType = 'sla_red';
              notificationRole = 'gerente';
              notificationMessage = `🔴 ALERTA VERMELHO: Cliente ${client.name} (${client.phone}) aguardando há mais de 1h.`;
            }
          } else if (diffMins >= 30) { // 30 mins - Alerta Amarelo (Vendedor)
            if (newStatus === 'none') {
              newStatus = 'yellow';
              notificationType = 'sla_yellow';
              notificationRole = 'vendedor';
              notificationMessage = `🟡 ALERTA AMARELO: O cliente ${client.name} está aguardando há 30 minutos.`;
            }
          }

          if (newStatus !== client.alert_status) {
            const updateData: any = { 
              alert_status: newStatus,
              alert_notified_at: now.toISOString()
            };
            
            await supabase.from("clients").update(updateData).eq("id", client.id);

            if (notificationType && notificationRole) {
              // Enviar para tabela geral de notificações
              await supabase.from("notifications").insert({
                type: notificationType,
                role_target: notificationRole,
                store_id: client.store_id,
                title: "Alerta de SLA",
                message: notificationMessage,
                metadata: { client_id: client.id, phone: client.phone, diffMins }
              });

              // Registrar no histórico de alertas SLA para auditoria
              await supabase.from("sla_alerts").insert({
                client_id: client.id,
                seller_id: client.assigned_seller_id,
                alert_level: newStatus === 'critical' ? 'crítico' : (newStatus === 'red' ? 'vermelho' : 'amarelo'),
                alert_type: notificationRole,
                message: notificationMessage
              });
            }

            processed.push({ id: client.id, old: client.alert_status, new: newStatus });
          }
        } else if (client.alert_status && client.alert_status !== 'none') {
          // Reset alert if seller responded
          await supabase.from("clients").update({ alert_status: 'none' }).eq("id", client.id);
          processed.push({ id: client.id, status: 'reset' });
        }
      }
 
     return new Response(JSON.stringify({ success: true, processed }), {
       status: 200,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (error: any) {
     return new Response(JSON.stringify({ error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   }
 });