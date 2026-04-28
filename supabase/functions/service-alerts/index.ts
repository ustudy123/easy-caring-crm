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
       .select("id, name, assigned_seller_id, last_message_from_client_at, last_seller_response_at, alert_status, store_id")
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
 
         let newStatus = client.alert_status;
         let shouldTransfer = false;
 
         if (diffMins >= 120) { // 2 hours
           if (client.alert_status !== 'red_transfer') {
             newStatus = 'red';
             shouldTransfer = true;
           }
         } else if (diffMins >= 60) { // 1 hour
           if (client.alert_status === 'yellow' || client.alert_status === 'none') {
             newStatus = 'red';
           }
         } else if (diffMins >= 30) { // 30 mins
           if (client.alert_status === 'none') {
             newStatus = 'yellow';
           }
         }
 
         if (newStatus !== client.alert_status || shouldTransfer) {
           const updateData: any = { alert_status: newStatus };
           
           if (shouldTransfer) {
             // For now, transfer back to "store pool" by removing assigned_seller_id
             // In a real scenario, we might assign to a specific 'support' ID
             updateData.assigned_seller_id = null;
             updateData.alert_status = 'transferred';
             
             // Log transfer
             await supabase.from("service_transfers").insert({
               client_id: client.id,
               from_seller_id: client.assigned_seller_id,
               to_seller_id: null,
               reason: `Transferência automática por falta de resposta (${diffMins} min)`
             });
           }
 
           await supabase.from("clients").update(updateData).eq("id", client.id);
           processed.push({ id: client.id, old: client.alert_status, new: newStatus, transferred: shouldTransfer });
         }
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