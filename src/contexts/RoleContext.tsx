import { createContext, useContext, ReactNode } from "react";
import { useUserRole, AppRole } from "@/hooks/useUserRole";

interface RoleContextType {
  role: AppRole | null;
  sellerId: string | null;
  storeId: string | null;
  loading: boolean;
  isAdmin: boolean;
  isGerente: boolean;
  isVendedor: boolean;
  isSuporte: boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { role, sellerId, storeId, loading } = useUserRole();

  return (
    <RoleContext.Provider
      value={{
        role,
        sellerId,
        storeId,
        loading,
        isAdmin: role === "admin",
        isGerente: role === "gerente",
        isVendedor: role === "vendedor",
        isSuporte: role === "suporte",
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole must be used within RoleProvider");
  return context;
}
