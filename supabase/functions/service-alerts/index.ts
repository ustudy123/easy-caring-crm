 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };

// Tempos de alerta configurados pelo gestor (tabela alert_time_settings). Mesma
// regra de src/lib/alertTimes.ts: exceção do vendedor > loja > padrão > 30/60/90.
type AlertTimes = { seller: number; manager: number; admin: number };
const DEFAULT_TIMES: AlertTimes = { seller: 30, manager: 60, admin: 90 };

function resolveTimes(settings: any[], sellerId: string | null, storeId: string | null): AlertTimes {
  const toTimes = (r: any): AlertTimes => ({ seller: r.seller_minutes, manager: r.manager_minutes, admin: r.admin_minutes });
  const bySeller = sellerId ? settings.find((r) => r.seller_id === sellerId) : null;
  if (bySeller) return toTimes(bySeller);
  const byStore = storeId ? settings.find((r) => r.store_id === storeId && !r.seller_id) : null;
  if (byStore) return toTimes(byStore);
  const global = settings.find((r) => !r.store_id && !r.seller_id);
  return global ? toTimes(global) : DEFAULT_TIMES;
}

function fmtMinutes(min: number): string {
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  if (min < 60) return plural(min, "minuto");
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? plural(h, "hora") : `${plural(h, "hora")} e ${plural(m, "minuto")}`;
}
 
Deno.serve(async (req) => {
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

      const [{ data: alertSettings }, { data: sellerRows }] = await Promise.all([
        supabase.from("alert_time_settings").select("store_id, seller_id, seller_minutes, manager_minutes, admin_minutes"),
        supabase.from("sellers").select("id, store_id"),
      ]);
      const sellerStore = new Map((sellerRows || []).map((s: any) => [s.id, s.store_id]));

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
          // Loja do vendedor responsável; sem vendedor, a loja do cliente.
          const times = resolveTimes(
            alertSettings || [],
            client.assigned_seller_id,
            (client.assigned_seller_id && sellerStore.get(client.assigned_seller_id)) || client.store_id,
          );

           if (diffMins >= times.admin) {
             newStatus = 'critical';
             notificationType = 'sla_critical';
             notificationRole = 'admin';
             notificationMessage = `🚨 ALERTA CRÍTICO: Cliente ${client.name} (${client.phone}) sem resposta há mais de ${fmtMinutes(times.admin)}. Ação imediata necessária!`;
           } else if (diffMins >= times.manager) {
            if (newStatus !== 'red' && newStatus !== 'critical') {
              newStatus = 'red';
              notificationType = 'sla_red';
              notificationRole = 'gerente';
              notificationMessage = `🔴 ALERTA VERMELHO: Cliente ${client.name} (${client.phone}) aguardando há mais de ${fmtMinutes(times.manager)}.`;
            }
          } else if (diffMins >= times.seller) { // Alerta Amarelo (Vendedor)
            if (newStatus === 'none') {
              newStatus = 'yellow';
              notificationType = 'sla_yellow';
              notificationRole = 'vendedor';
              notificationMessage = `🟡 ALERTA AMARELO: O cliente ${client.name} está aguardando há ${fmtMinutes(times.seller)}.`;
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
             const { data: latestAlerts } = await supabase
               .from("sla_alerts")
               .select("id, last_reminder_at, created_at, resolved_at")
               .eq("lead_id", client.id)
               .order("created_at", { ascending: false })
               .limit(1);
 
             if (latestAlerts && latestAlerts.length > 0) {
               const latest = latestAlerts[0];
               if (!latest.resolved_at) {
                 // Unresolved: Check for reminder
                 existingAlertId = latest.id;
                 const lastReminder = latest.last_reminder_at || latest.created_at;
                 const lastReminderDate = new Date(lastReminder);
                 const minsSinceLastReminder = (now.getTime() - lastReminderDate.getTime()) / (1000 * 60);
                 
                 if (minsSinceLastReminder >= 15) { // Re-alert every 15 mins for critical
                   shouldNotify = true;
                   notificationMessage = `🚨 LEMBRETE CRÍTICO: Cliente ${client.name} (${client.phone}) continua sem resposta há ${diffMins} min!`;
                 } else {
                   shouldNotify = false;
                 }
               } else {
                 // Resolved: Only re-alert if resolved more than 30 mins ago and still not answered
                 const resolvedDate = new Date(latest.resolved_at);
                 const minsSinceResolution = (now.getTime() - resolvedDate.getTime()) / (1000 * 60);
                 
                 if (minsSinceResolution >= 30) {
                   shouldNotify = true;
                   existingAlertId = null; // Create a new one
                 } else {
                   shouldNotify = false;
                 }
               }
             } else {
               shouldNotify = true; // No alerts at all
             }
             }
 
              if (shouldNotify && notificationType && notificationRole) {
                // If it's a reminder, mark previous notifications for this client as read
                if (existingAlertId) {
                  await supabase
                    .from("notifications")
                    .update({ is_read: true })
                    .eq("type", notificationType)
                    .eq("role_target", notificationRole)
                    .eq("is_read", false)
                    .contains("metadata", { client_id: client.id });
                    
                 await supabase.from("sla_alerts").update({ last_reminder_at: now.toISOString() }).eq("id", existingAlertId);
                }

                await supabase.from("notifications").insert({
                  type: notificationType,
                  role_target: notificationRole,
                  store_id: client.store_id,
                  title: "Alerta de SLA",
                  message: notificationMessage,
                  metadata: { client_id: client.id, phone: client.phone, diffMins, is_reminder: !!existingAlertId }
                });
 
                if (!existingAlertId) {
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