import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { InstanceInfo } from "@/components/InstanceBadge";

export function useInstances() {
  const [instances, setInstances] = useState<InstanceInfo[]>([]);
  const [byId, setById] = useState<Record<string, InstanceInfo>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id, name, instance_type")
        .order("name");
      if (cancelled || !data) return;
      const list = data as InstanceInfo[];
      setInstances(list);
      setById(Object.fromEntries(list.map((i) => [i.id, i])));
    };
    load();
    const channel = supabase
      .channel("instances-lookup")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_instances" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return { instances, byId };
}