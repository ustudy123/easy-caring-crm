// Edge Function: admin-reset-password
// Permite que um ADMIN redefina a senha de outro usuário.
// Trocar senha exige a service_role (API admin do Supabase), que nunca pode
// ficar no front — por isso roda aqui. A função confirma que quem chama é admin
// antes de qualquer coisa.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1) Identifica quem está chamando, pelo token do próprio usuário.
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);

    // 2) Confirma que o chamador é admin (has_role no banco).
    const { data: isAdmin, error: roleErr } = await caller.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr) return json({ error: "Falha ao verificar permissão" }, 500);
    if (!isAdmin) return json({ error: "Acesso negado: requer admin" }, 403);

    // 3) Lê os dados da requisição.
    const { user_id, new_password } = await req.json().catch(() => ({}));
    if (!user_id || typeof new_password !== "string" || new_password.length < 6) {
      return json({ error: "Informe o usuário e uma senha de ao menos 6 caracteres" }, 400);
    }

    // 4) Troca a senha usando a service_role (API admin).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error: updErr } = await admin.auth.admin.updateUserById(user_id, {
      password: new_password,
    });
    if (updErr) return json({ error: updErr.message }, 400);

    // 5) Marca que a pessoa deve escolher a própria senha no próximo acesso.
    //    A senha definida aqui é temporária, só para ela conseguir entrar.
    const { error: flagErr } = await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("user_id", user_id);
    if (flagErr) {
      // A senha já foi trocada; avisa, mas não trata como falha total.
      return json({ success: true, warning: "Senha alterada, mas não foi possível exigir a troca no próximo login." });
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
