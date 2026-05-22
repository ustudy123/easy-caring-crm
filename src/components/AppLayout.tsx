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
    // Update the persistent header title on mount/update.
    // Do NOT reset on unmount: the next page sets its own title synchronously,
    // and resetting here caused a double-render flicker on navigation
    // (empty title → new title) that looked like the page was reloading twice.
    setTitle(title ?? "");
  }, [title, setTitle]);

  return <>{children}</>;
}