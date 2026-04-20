import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
 import { Lead, FollowUp, Seller } from "@/types/crm";
import { supabase } from "@/integrations/supabase/client";

interface CrmContextType {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  addLead: (lead: Lead) => void;
  updateLead: (lead: Lead) => void;
  deleteLead: (id: string) => void;
  followUps: FollowUp[];
  setFollowUps: React.Dispatch<React.SetStateAction<FollowUp[]>>;
  addFollowUp: (followUp: FollowUp) => void;
  updateFollowUp: (followUp: FollowUp) => void;
  deleteFollowUp: (id: string) => void;
   sellers: Seller[];
  newLeadsCount: number;
  pendingFollowUpsCount: number;
  negotiationCount: number;
  unreadWhatsAppCount: number;
  loading: boolean;
}

const CrmContext = createContext<CrmContextType | null>(null);

function mapLeadFromDb(row: any): Lead {
  return {
    id: row.id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientEmail: row.client_email || undefined,
    stage: row.stage,
    value: Number(row.value),
    assignedTo: row.assigned_to || "",
    source: row.source,
    tags: row.tags || [],
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    nextFollowUp: row.next_follow_up || undefined,
  };
}

function mapFollowUpFromDb(row: any): FollowUp {
  return {
    id: row.id,
    leadId: row.lead_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    scheduledAt: row.scheduled_at,
    description: row.description || "",
    completed: row.completed,
    assignedTo: row.assigned_to || "",
    type: row.type,
  };
}

 function mapSellerFromDb(row: any): Seller {
   return {
     id: row.id,
     name: row.name,
     avatar: row.avatar || undefined,
     role: row.role,
     leadsCount: Number(row.leads_count || 0),
     conversions: Number(row.conversions || 0),
   };
 }
 
export function CrmProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
   const [sellers, setSellers] = useState<Seller[]>([]);
  const [unreadWhatsAppCount, setUnreadWhatsAppCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
       const [leadsRes, followUpsRes, whatsappRes, sellersRes] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("follow_ups").select("*").order("scheduled_at"),
        supabase.from("whatsapp_messages").select("phone", { count: "exact", head: true }).eq("is_from_me", false),
         supabase.from("sellers").select("*").order("name"),
      ]);
      if (leadsRes.data) setLeads(leadsRes.data.map(mapLeadFromDb));
      if (followUpsRes.data) setFollowUps(followUpsRes.data.map(mapFollowUpFromDb));
       if (sellersRes.data) setSellers(sellersRes.data.map(mapSellerFromDb));
      if (whatsappRes.count != null) setUnreadWhatsAppCount(whatsappRes.count);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    const leadsChannel = supabase
      .channel("leads-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setLeads((prev) => [mapLeadFromDb(payload.new), ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setLeads((prev) => prev.map((l) => l.id === payload.new.id ? mapLeadFromDb(payload.new) : l));
        } else if (payload.eventType === "DELETE") {
          setLeads((prev) => prev.filter((l) => l.id !== payload.old.id));
        }
      })
      .subscribe();

    const followUpsChannel = supabase
      .channel("follow-ups-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setFollowUps((prev) => [mapFollowUpFromDb(payload.new), ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setFollowUps((prev) => prev.map((f) => f.id === payload.new.id ? mapFollowUpFromDb(payload.new) : f));
        } else if (payload.eventType === "DELETE") {
          setFollowUps((prev) => prev.filter((f) => f.id !== payload.old.id));
        }
      })
      .subscribe();

    const whatsappChannel = supabase
      .channel("whatsapp-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, (payload) => {
        if (!payload.new.is_from_me) {
          setUnreadWhatsAppCount((prev) => prev + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(followUpsChannel);
      supabase.removeChannel(whatsappChannel);
    };
  }, []);

  const addLead = useCallback(async (lead: Lead) => {
    // Optimistic update
    setLeads((prev) => [lead, ...prev]);
    const { error } = await supabase.from("leads").insert({
      id: lead.id,
      client_name: lead.clientName,
      client_phone: lead.clientPhone,
      client_email: lead.clientEmail || null,
      stage: lead.stage,
      value: lead.value,
      assigned_to: lead.assignedTo || null,
      source: lead.source,
      tags: lead.tags,
      notes: lead.notes,
      next_follow_up: lead.nextFollowUp || null,
    });
    if (error) {
      console.error("Error adding lead:", error);
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    }
  }, []);

  const updateLead = useCallback(async (lead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
    const { error } = await supabase.from("leads").update({
      client_name: lead.clientName,
      client_phone: lead.clientPhone,
      client_email: lead.clientEmail || null,
      stage: lead.stage,
      value: lead.value,
      assigned_to: lead.assignedTo || null,
      source: lead.source,
      tags: lead.tags,
      notes: lead.notes,
      next_follow_up: lead.nextFollowUp || null,
    }).eq("id", lead.id);
    if (error) console.error("Error updating lead:", error);
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) console.error("Error deleting lead:", error);
  }, []);

  const addFollowUp = useCallback(async (followUp: FollowUp) => {
    setFollowUps((prev) => [followUp, ...prev]);
    const { error } = await supabase.from("follow_ups").insert({
      id: followUp.id,
      lead_id: followUp.leadId || null,
      client_name: followUp.clientName,
      client_phone: followUp.clientPhone,
      scheduled_at: followUp.scheduledAt,
      description: followUp.description,
      completed: followUp.completed,
      assigned_to: followUp.assignedTo || null,
      type: followUp.type,
    });
    if (error) {
      console.error("Error adding follow-up:", error);
      setFollowUps((prev) => prev.filter((f) => f.id !== followUp.id));
    }
  }, []);

  const updateFollowUp = useCallback(async (followUp: FollowUp) => {
    setFollowUps((prev) => prev.map((f) => (f.id === followUp.id ? followUp : f)));
    const { error } = await supabase.from("follow_ups").update({
      client_name: followUp.clientName,
      client_phone: followUp.clientPhone,
      scheduled_at: followUp.scheduledAt,
      description: followUp.description,
      completed: followUp.completed,
      assigned_to: followUp.assignedTo || null,
      type: followUp.type,
    }).eq("id", followUp.id);
    if (error) console.error("Error updating follow-up:", error);
  }, []);

  const deleteFollowUp = useCallback(async (id: string) => {
    setFollowUps((prev) => prev.filter((f) => f.id !== id));
    const { error } = await supabase.from("follow_ups").delete().eq("id", id);
    if (error) console.error("Error deleting follow-up:", error);
  }, []);

  const newLeadsCount = leads.filter((l) => l.stage === "abordagem").length;
  const pendingFollowUpsCount = followUps.filter((f) => !f.completed).length;
  const negotiationCount = leads.filter((l) => l.stage === "contorno_objecoes").length;

  return (
    <CrmContext.Provider
      value={{
        leads, setLeads, addLead, updateLead, deleteLead,
        followUps, setFollowUps, addFollowUp, updateFollowUp, deleteFollowUp,
       sellers,
        newLeadsCount, pendingFollowUpsCount, negotiationCount, unreadWhatsAppCount, loading,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
}

export function useCrm() {
  const context = useContext(CrmContext);
  if (!context) throw new Error("useCrm must be used within CrmProvider");
  return context;
}
