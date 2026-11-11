import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Lojas marcadas como equipe de vendas externas (stores.is_external_team). Os
// recursos do plano de 28/10 aparecem, por enquanto, só para essa equipe.
// A lista é pequena e quase não muda: uma consulta por sessão, compartilhada.
let cache: Promise<Set<string>> | null = null;

function loadExternalStores(): Promise<Set<string>> {
  cache ??= (async () => {
    const { data, error } = await supabase.from("stores").select("id, is_external_team");
    if (error) {
      cache = null; // tenta de novo na próxima montagem
      return new Set<string>();
    }
    return new Set((data || []).filter((s) => s.is_external_team).map((s) => s.id));
  })();
  return cache;
}

export function useExternalStores(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    loadExternalStores().then((s) => { if (alive) setIds(s); });
    return () => { alive = false; };
  }, []);
  return ids;
}

/** Só para testes. */
export function resetExternalStoresCache() {
  cache = null;
}
