import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
 import { Lead, FollowUp, Seller } from "@/types/crm";
import { supabase } from "@/integrations/supabase/client";

 export interface Notification {
   id: string;
   user_id: string | null;
   role_target: string | null;
   store_id: string | null;
   type: string;
   title: string;
   message: string;
   metadata: any;
   is_read: boolean;
   created_at: string;
 }
 
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
   slaAlertsCount: number;
   notifications: Notification[];
  loading: boolean;
   markNotificationRead: (id: string) => Promise<void>;
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
     clientType: row.client_type || undefined,
     companyWorkSite: row.company_work_site || undefined,
     interestProducts: row.interest_products || undefined,
     storeName: row.store_name || undefined,
     storeId: row.store_id || undefined,
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
       const [leadsRes, followUpsRes, whatsappRes, sellersRes, notificationsRes] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("follow_ups").select("*").order("scheduled_at"),
         supabase.from("whatsapp_messages").select("phone", { count: "exact", head: true }).eq("is_from_me", false).eq("is_read", false),
         supabase.from("sellers").select("*").order("name"),
         supabase.from("notifications").select("*").eq("is_read", false).order("created_at", { ascending: false }),
      ]);
      if (leadsRes.data) setLeads(leadsRes.data.map(mapLeadFromDb));
      if (followUpsRes.data) setFollowUps(followUpsRes.data.map(mapFollowUpFromDb));
       if (sellersRes.data) setSellers(sellersRes.data.map(mapSellerFromDb));
      if (whatsappRes.count != null) setUnreadWhatsAppCount(whatsappRes.count);
      if (notificationsRes.data) setNotifications(notificationsRes.data);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages" }, (payload) => {
        if (payload.eventType === "INSERT") {
          if (!payload.new.is_from_me && !payload.new.is_read) {
            setUnreadWhatsAppCount((prev) => prev + 1);
          }
        } else if (payload.eventType === "UPDATE") {
          if (payload.old.is_read === false && payload.new.is_read === true) {
            setUnreadWhatsAppCount((prev) => Math.max(0, prev - 1));
          } else if (payload.old.is_read === true && payload.new.is_read === false) {
            setUnreadWhatsAppCount((prev) => prev + 1);
          }
        } else if (payload.eventType === "DELETE") {
          if (!payload.old.is_from_me && !payload.old.is_read) {
            setUnreadWhatsAppCount((prev) => Math.max(0, prev - 1));
          }
        }
      })
      .subscribe();

    const notificationsChannel = supabase
      .channel("notifications-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newNotif = payload.new as Notification;
          if (!newNotif.is_read) {
            setNotifications((prev) => {
              if (prev.some(n => n.id === newNotif.id)) return prev;
              return [newNotif, ...prev];
            });
          }
        } else if (payload.eventType === "UPDATE") {
          const updatedNotif = payload.new as Notification;
          if (updatedNotif.is_read) {
            setNotifications((prev) => prev.filter((n) => n.id !== updatedNotif.id));
          } else {
            setNotifications((prev) => prev.map((n) => n.id === updatedNotif.id ? updatedNotif : n));
          }
        } else if (payload.eventType === "DELETE") {
          setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(followUpsChannel);
      supabase.removeChannel(whatsappChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter(n => n.id !== id));
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) console.error("Error marking notification as read:", error);
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
       client_type: lead.clientType || null,
       company_work_site: lead.companyWorkSite || null,
       interest_products: lead.interestProducts || null,
       store_name: lead.storeName || null,
       store_id: lead.storeId || null,
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
       client_type: lead.clientType || null,
       company_work_site: lead.companyWorkSite || null,
       interest_products: lead.interestProducts || null,
       store_name: lead.storeName || null,
       store_id: lead.storeId || null,
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
  // Get current user's role and ID to filter notifications
  // Note: Since context initialization is complex, we filter notifications in the getter
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const filterNotifs = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFilteredNotifications([]);
        return;
      }

      const [rolesRes, sellerRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("sellers").select("id, store_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("id, store_id").eq("user_id", user.id).maybeSingle()
      ]);

      const userRoles = rolesRes.data?.map(r => r.role) || [];
      const userStoreId = sellerRes.data?.store_id || profileRes.data?.store_id;
      const userSellerId = sellerRes.data?.id;

      const filtered = notifications.filter(n => {
        // If specific user_id, must match
        if (n.user_id && n.user_id !== user.id) return false;
        
        // If admin, see all SLA alerts
        if (userRoles.includes('admin')) return true;

        // If gerente, see alerts for their store
        if (userRoles.includes('gerente')) {
          return !n.store_id || n.store_id === userStoreId;
        }

        // If vendedor, see alerts targeted to them or their client
        if (userRoles.includes('vendedor')) {
          if (n.role_target === 'vendedor') {
             return n.metadata?.seller_id === userSellerId || !n.metadata?.seller_id;
          }
        }
        
        return n.role_target ? userRoles.includes(n.role_target) : true;
      });
      
      setFilteredNotifications(filtered);
    };

    filterNotifs();
  }, [notifications]);

  const slaAlertsCount = filteredNotifications.length;

  return (
    <CrmContext.Provider
      value={{
        leads, setLeads, addLead, updateLead, deleteLead,
        followUps, setFollowUps, addFollowUp, updateFollowUp, deleteFollowUp,
        sellers, notifications: filteredNotifications, slaAlertsCount,
        newLeadsCount, pendingFollowUpsCount, negotiationCount, unreadWhatsAppCount, loading,
        markNotificationRead
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
