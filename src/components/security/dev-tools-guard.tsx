"use client";

import * as React from "react";

/**
 * Protege a aplicação contra atalhos de desenvolvedor (F12, Ctrl+Shift+I,
 * Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U) e menu de contexto de inspeção.
 */
export function DevToolsGuard() {
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Bloqueio de tecla F12
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Bloqueio de Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (Inspecionar / Console)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        ["I", "i", "J", "j", "C", "c"].includes(e.key)
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Bloqueio de Ctrl+U (Exibir código-fonte)
      if ((e.ctrlKey || e.metaKey) && (e.key === "U" || e.key === "u")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Bloqueio de Ctrl+S (Salvar página em disco)
      if ((e.ctrlKey || e.metaKey) && (e.key === "S" || e.key === "s")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }

    function handleContextMenu(e: MouseEvent) {
      // Desabilita menu de contexto com botão direito para prevenir Inspecionar
      e.preventDefault();
      return false;
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("contextmenu", handleContextMenu, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("contextmenu", handleContextMenu, { capture: true });
    };
  }, []);

  return null;
}
