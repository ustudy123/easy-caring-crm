import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Alerta de novas solicitações mesmo com o sistema em segundo plano:
 * - notificação do sistema operacional (precisa de permissão do usuário);
 * - contador no título da aba, que aparece na barra de tarefas do navegador.
 *
 * O título volta ao normal assim que a pessoa abre a aba de novo.
 */
export function useBackgroundAlert(baseTitle: string) {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );
  const pendingRef = useRef(0);

  // Zera o alerta quando a pessoa volta para a aba.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) {
        pendingRef.current = 0;
        document.title = baseTitle;
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      document.title = baseTitle;
    };
  }, [baseTitle]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied" as NotificationPermission;
    const p = await Notification.requestPermission();
    setPermission(p);
    return p;
  }, []);

  /** Dispara o alerta. Só incomoda quando a aba não está em foco. */
  const notify = useCallback((title: string, body: string) => {
    // Contador no título — visível na aba e na barra de tarefas.
    if (document.hidden) {
      pendingRef.current += 1;
      document.title = `(${pendingRef.current}) ${title} · ${baseTitle}`;
    }
    // Notificação do sistema (se autorizada).
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const n = new Notification(title, { body, tag: "suporte-orcamento", renotify: true } as any);
        n.onclick = () => { window.focus(); n.close(); };
      } catch {
        /* alguns navegadores bloqueiam fora de contexto seguro; o título já alerta */
      }
    }
  }, [baseTitle]);

  return { permission, requestPermission, notify };
}
