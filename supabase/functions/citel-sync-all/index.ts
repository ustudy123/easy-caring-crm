 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
   "Access-Control-Allow-Methods": "POST, OPTIONS",
 };
 
 const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), {
     status,
     headers: { ...corsHeaders, "Content-Type": "application/json" },
   });
 
 function mapErpClient(raw: Record<string, any>) {
   const pick = (...keys: string[]) => {
     for (const k of keys) {
       const v = raw[k];
       if (typeof v === "string" && v.trim()) return v.trim();
       if (typeof v === "number") return String(v);
     }
     return undefined;
   };
   return {
     name: pick("nome", "name", "razaoSocial", "razao_social", "fantasia") || "Cliente ERP",
     phone: pick("telefone", "phone", "celular", "mobile") || "",
     email: pick("email", "e_mail"),
     address: pick("endereco", "address", "logradouro", "rua"),
     city: pick("cidade", "city", "municipio"),
   };
 }
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
   try {
     const authHeader = req.headers.get("Authorization") ?? "";
     const supabase = createClient(
       Deno.env.get("SUPABASE_URL") ?? "",
       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
       { global: { headers: { Authorization: authHeader } } }
     );
 
     // Verify Admin
     const { data: { user } } = await supabase.auth.getUser();
     if (!user) return json({ error: "Unauthorized" }, 401);
     
     const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
     if (profile?.role !== "admin") return json({ error: "Forbidden" }, 403);
 
     const apiUrl = (Deno.env.get("CITEL_API_URL") ?? "").replace(/\/+$/, "");
     const erpUser = Deno.env.get("CITEL_USER") ?? "";
     const erpPass = Deno.env.get("CITEL_PASSWORD") ?? "";
     const auth = btoa(`${erpUser}:${erpPass}`);
 
     // 1. Fetch all clients from ERP (trying common endpoints)
     const endpoints = [`${apiUrl}/api/clientes`, `${apiUrl}/api/customers`];
     let clientsRaw: any[] = [];
     
     for (const url of endpoints) {
       const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
       if (res.ok) {
         const data = await res.json();
         clientsRaw = Array.isArray(data) ? data : (data.data || data.items || []);
         if (clientsRaw.length > 0) break;
       }
     }
 
     if (clientsRaw.length === 0) {
       return json({ success: true, count: 0, message: "Nenhum cliente encontrado no ERP ou erro de conexão." });
     }
 
     // 2. Map and Upsert into CRM
     let synced = 0;
     const CHUNK_SIZE = 50;
     
     for (let i = 0; i < clientsRaw.length; i += CHUNK_SIZE) {
       const chunk = clientsRaw.slice(i, i + CHUNK_SIZE);
       const mapped = chunk.map(mapErpClient).filter(c => c.phone);
       
       if (mapped.length > 0) {
         const { error } = await supabase.from("clients").upsert(
           mapped.map(c => ({
             name: c.name,
             phone: c.phone.replace(/\D/g, ""),
             email: c.email,
             address: c.address,
             city: c.city
           })),
           { onConflict: 'phone' }
         );
         if (!error) synced += mapped.length;
       }
     }
 
     return json({ success: true, count: synced, total_found: clientsRaw.length });
   } catch (e) {
     return json({ error: String(e) }, 500);
   }
 });