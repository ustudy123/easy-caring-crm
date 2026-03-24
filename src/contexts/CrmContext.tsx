import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Lead, FollowUp } from "@/types/crm";
import { mockLeads, mockFollowUps } from "@/data/mockData";

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
  // Badge counts
  newLeadsCount: number;
  pendingFollowUpsCount: number;
  negotiationCount: number;
}

const CrmContext = createContext<CrmContextType | null>(null);

export function CrmProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [followUps, setFollowUps] = useState<FollowUp[]>(mockFollowUps);

  const addLead = useCallback((lead: Lead) => {
    setLeads((prev) => [lead, ...prev]);
  }, []);

  const updateLead = useCallback((lead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
  }, []);

  const deleteLead = useCallback((id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addFollowUp = useCallback((followUp: FollowUp) => {
    setFollowUps((prev) => [followUp, ...prev]);
  }, []);

  const updateFollowUp = useCallback((followUp: FollowUp) => {
    setFollowUps((prev) => prev.map((f) => (f.id === followUp.id ? followUp : f)));
  }, []);

  const deleteFollowUp = useCallback((id: string) => {
    setFollowUps((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const newLeadsCount = leads.filter((l) => l.stage === "novo_lead").length;
  const pendingFollowUpsCount = followUps.filter((f) => !f.completed).length;
  const negotiationCount = leads.filter((l) => l.stage === "negociacao").length;

  return (
    <CrmContext.Provider
      value={{
        leads,
        setLeads,
        addLead,
        updateLead,
        deleteLead,
        followUps,
        setFollowUps,
        addFollowUp,
        updateFollowUp,
        deleteFollowUp,
        newLeadsCount,
        pendingFollowUpsCount,
        negotiationCount,
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
