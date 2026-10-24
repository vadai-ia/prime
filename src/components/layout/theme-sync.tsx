"use client";

import { useLayoutEffect } from "react";
import { applyTheme, readThemePref } from "@/lib/theme";

/**
 * Vuelve a poner data-theme en <html> después de montar. El script de <head> lo pone antes de pintar,
 * pero si una página falla la hidratación React repinta el documento en el cliente y limpia los
 * atributos de <html>; sin esto esa página se queda en tema claro.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme(readThemePref());
  });
  return null;
}
