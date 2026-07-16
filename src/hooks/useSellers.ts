import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Seller } from "@/types/crm";

function mapSeller(s: any): Seller {
  return {
    id: s.id,
    name: s.name,
    avatar: s.avatar || undefined,
    role: s.role,
    store_id: s.store_id || undefined,
    leadsCount: s.leads_count,
    conversions: s.conversions,
  };
}

export function useSellers() {
  const [sellers, setSellers] = useState<Seller[]>([]);

  useEffect(() => {
    const fetchSellers = async () => {
      const { data } = await supabase.from("sellers").select("*").order("name");
      if (data) setSellers(data.map(mapSeller));
    };
    fetchSellers();

    // Mantém a lista viva: cadastrar/remover um vendedor reflete na hora, sem F5.
    const channel = supabase
      .channel("sellers-hook-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "sellers" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setSellers((prev) => prev.some((s) => s.id === payload.new.id)
            ? prev
            : [...prev, mapSeller(payload.new)].sort((a, b) => a.name.localeCompare(b.name)));
        } else if (payload.eventType === "UPDATE") {
          setSellers((prev) => prev
            .map((s) => (s.id === payload.new.id ? mapSeller(payload.new) : s))
            .sort((a, b) => a.name.localeCompare(b.name)));
        } else if (payload.eventType === "DELETE") {
          setSellers((prev) => prev.filter((s) => s.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return sellers;
}
