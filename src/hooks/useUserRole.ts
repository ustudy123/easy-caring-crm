import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "gerente" | "vendedor" | "suporte";

interface UserRoleInfo {
  role: AppRole | null;      // papel principal (mais alto) — compatibilidade
  roles: AppRole[];          // TODOS os papéis do usuário
  sellerId: string | null;
  sellerName: string | null;
  storeId: string | null;
  loading: boolean;
}

export function useUserRole(): UserRoleInfo {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [sellerName, setSellerName] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setRoles([]);
      setSellerId(null);
      setSellerName(null);
      setStoreId(null);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const [rolesRes, sellerRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("sellers").select("id, store_id, name").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("id, store_id").eq("user_id", user.id).maybeSingle(),
      ]);

      if (rolesRes.data && rolesRes.data.length > 0) {
        // Usuário pode ter VÁRIOS papéis. Guardamos todos; o `role` principal
        // (mais alto) fica só para telas legadas que ainda esperam um único.
        const all = rolesRes.data.map((r: any) => r.role as AppRole);
        setRoles(all);
        if (all.includes("admin")) setRole("admin");
        else if (all.includes("gerente")) setRole("gerente");
        else if (all.includes("suporte")) setRole("suporte");
        else setRole("vendedor");
      } else {
        setRoles([]);
        setRole(null);
      }

      // CRM assignment fields reference sellers.id, so prefer the linked seller row.
      if (sellerRes.data) {
        setSellerId(sellerRes.data.id);
        setSellerName(sellerRes.data.name || null);
        setStoreId(sellerRes.data.store_id || profileRes.data?.store_id || null);
      } else if (profileRes.data) {
        setSellerId(profileRes.data.id);
        setStoreId(profileRes.data.store_id || null);
      }

      setLoading(false);
    };

    fetch();
  }, [user]);

  return { role, roles, sellerId, sellerName, storeId, loading };
}
