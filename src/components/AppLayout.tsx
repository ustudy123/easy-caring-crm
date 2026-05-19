import { useEffect } from "react";
import { usePageTitle } from "./AppShell";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

/**
 * Backwards-compatible layout wrapper.
 * The actual chrome (sidebar/header) lives in <AppShell /> at the route level
 * so navigations no longer remount the shell. This component now only syncs
 * the page title into the persistent header.
 */
export function AppLayout({ children, title }: AppLayoutProps) {
  const { setTitle } = usePageTitle();

  useEffect(() => {
    setTitle(title ?? "");
    return () => setTitle("");
  }, [title, setTitle]);

  return <>{children}</>;
}