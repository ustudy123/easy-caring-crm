import { createContext, useContext, ReactNode } from "react";
import { useUserRole, AppRole } from "@/hooks/useUserRole";

interface RoleContextType {
  role: AppRole | null;      // papel principal (mais alto)
  roles: AppRole[];          // todos os papéis do usuário
  sellerId: string | null;
  sellerName: string | null;
  storeId: string | null;
  loading: boolean;
  isAdmin: boolean;
  isGerente: boolean;
  isVendedor: boolean;
  isSuporte: boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { role, roles, sellerId, sellerName, storeId, loading } = useUserRole();

  return (
    <RoleContext.Provider
      value={{
        role,
        roles,
        sellerId,
        sellerName,
        storeId,
        loading,
        // Um usuário pode acumular papéis. Cada booleano indica se o usuário
        // TEM aquele papel (não se é exclusivamente ele), dando acesso a tudo
        // de cada função que possui.
        isAdmin: roles.includes("admin"),
        isGerente: roles.includes("gerente"),
        isVendedor: roles.includes("vendedor"),
        isSuporte: roles.includes("suporte"),
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
