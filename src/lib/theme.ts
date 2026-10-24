// Tema claro / oscuro. La preferencia vive en localStorage ("light", "dark" o nada = la del sistema);
// el atributo data-theme de <html> es lo que leen los tokens de globals.css.

export type ThemePref = "light" | "dark" | "system";

export const THEME_KEY = "theme";

/**
 * Corre en <head> antes de pintar (layout raíz) para que no parpadee el tema claro. También sigue
 * los cambios del sistema mientras la preferencia sea "sistema". Misma regla que applyTheme().
 */
export const THEME_SCRIPT = `(function(){try{var m=window.matchMedia("(prefers-color-scheme: dark)");function a(){var t=null;try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}var d=t==="dark"||(t!=="light"&&m.matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}a();m.addEventListener("change",a)}catch(e){}})()`;

export function readThemePref(): ThemePref {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function saveThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Sin localStorage (modo privado estricto) el cambio dura lo que la pestaña.
  }
  applyTheme(pref);
}
