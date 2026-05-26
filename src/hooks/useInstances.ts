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

/**
 * Maps client phone → whatsapp_instances.id (the instance that last received
 * a message from that client). Used to render the instance badge on
 * lead/client cards across the CRM.
 */
export function useClientInstanceMap() {
  const [byPhone, setByPhone] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("clients")
        .select("phone, received_on_instance_id")
        .not("received_on_instance_id", "is", null);
      if (cancelled || !data) return;
      const map: Record<string, string> = {};
      for (const row of data as any[]) {
        if (row.phone && row.received_on_instance_id) map[row.phone] = row.received_on_instance_id;
      }
      setByPhone(map);
    };
    load();
    const channel = supabase
      .channel("clients-instance-lookup")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return byPhone;
}