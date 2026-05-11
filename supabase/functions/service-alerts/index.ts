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

           if (diffMins >= 90) {
             newStatus = 'critical';
             notificationType = 'sla_critical';
             notificationRole = 'admin';
             notificationMessage = `🚨 ALERTA CRÍTICO: Cliente ${client.name} (${client.phone}) sem resposta há mais de 1h30. Ação imediata necessária!`;
           } else if (diffMins >= 60) {
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

           if (newStatus !== client.alert_status || newStatus === 'critical') {
            const updateData: any = { 
              alert_status: newStatus,
              alert_notified_at: now.toISOString()
            };
            
            await supabase.from("clients").update(updateData).eq("id", client.id);

             // Check for existing unresolved SLA alert if it's critical
             let shouldNotify = newStatus !== client.alert_status;
             let existingAlertId = null;
 
             if (newStatus === 'critical') {
               const { data: existingAlerts } = await supabase
                 .from("sla_alerts")
                 .select("id, last_reminder_at, created_at")
                 .eq("lead_id", client.id)
                 .is("resolved_at", null)
                 .order("created_at", { ascending: false })
                 .limit(1);
 
               if (existingAlerts && existingAlerts.length > 0) {
                 existingAlertId = existingAlerts[0].id;
                 const lastReminder = existingAlerts[0].last_reminder_at || existingAlerts[0].created_at;
                 const lastReminderDate = new Date(lastReminder);
                 const minsSinceLastReminder = (now.getTime() - lastReminderDate.getTime()) / (1000 * 60);
                 
                 if (minsSinceLastReminder >= 15) { // Re-alert every 15 mins for critical
                   shouldNotify = true;
                   notificationMessage = `🚨 LEMBRETE CRÍTICO: Cliente ${client.name} (${client.phone}) continua sem resposta há ${diffMins} min!`;
                 } else {
                   shouldNotify = false; // Already alerted recently
                 }
               } else {
                 shouldNotify = true; // First time critical
               }
             }
 
             if (shouldNotify && notificationType && notificationRole) {
               await supabase.from("notifications").insert({
                 type: notificationType,
                 role_target: notificationRole,
                 store_id: client.store_id,
                 title: "Alerta de SLA",
                 message: notificationMessage,
                 metadata: { client_id: client.id, phone: client.phone, diffMins, is_reminder: !!existingAlertId }
               });
 
               if (existingAlertId) {
                 await supabase.from("sla_alerts").update({ last_reminder_at: now.toISOString() }).eq("id", existingAlertId);
               } else {
                 await supabase.from("sla_alerts").insert({
                   lead_id: client.id,
                   vendedor_id: client.assigned_seller_id,
                   alert_level: newStatus === 'critical' ? 'crítico' : (newStatus === 'red' ? 'vermelho' : 'amarelo'),
                   alert_type: notificationRole,
                   message: notificationMessage
                 });
               }
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