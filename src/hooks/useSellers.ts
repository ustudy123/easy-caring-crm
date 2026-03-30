import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Seller } from "@/types/crm";

export function useSellers() {
  const [sellers, setSellers] = useState<Seller[]>([]);

  useEffect(() => {
    const fetchSellers = async () => {
      const { data } = await supabase.from("sellers").select("*").order("name");
      if (data) {
        setSellers(data.map((s: any) => ({
          id: s.id,
          name: s.name,
          avatar: s.avatar || undefined,
          role: s.role,
          leadsCount: s.leads_count,
          conversions: s.conversions,
        })));
      }
    };
    fetchSellers();
  }, []);

  return sellers;
}
