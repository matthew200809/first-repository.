'use strict';
/*
 * Preferências do dispositivo: tema (claro/escuro/sistema) e acessibilidade.
 * Carregado no <head> para aplicar o tema antes de desenhar a página (evita "piscar").
 * Fica no localStorage deste aparelho e funciona também antes do login.
 */
const Prefs = (() => {
  const KEY = 'eleva.prefs.v1';
  const DEFAULTS = { theme: 'system', scale: 1, contrast: false, font: false, spacing: false, links: false, motion: false, tourDone: false };
  const SCALES = [[0.9, 'A−'], [1, 'A'], [1.15, 'A+'], [1.3, 'A++']];
  let prefs = { ...DEFAULTS };
  try { prefs = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* armazenamento bloqueado */ }

  const root = document.documentElement;
  let themeWeSet = false;

  function apply() {
    // "Sistema" só remove o atributo se fomos nós que o colocamos (respeita o tema do ambiente que hospeda a página)
    if (prefs.theme === 'light' || prefs.theme === 'dark') { root.setAttribute('data-theme', prefs.theme); themeWeSet = true; }
    else if (themeWeSet) { root.removeAttribute('data-theme'); themeWeSet = false; }
    root.style.setProperty('--scale', String(prefs.scale));
    root.classList.toggle('a11y-contrast', !!prefs.contrast);
    root.classList.toggle('a11y-font', !!prefs.font);
    root.classList.toggle('a11y-spacing', !!prefs.spacing);
    root.classList.toggle('a11y-links', !!prefs.links);
    root.classList.toggle('a11y-motion', !!prefs.motion);
    document.dispatchEvent(new CustomEvent('prefs-change'));
  }
  function set(patch) {
    Object.assign(prefs, patch);
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignora */ }
    apply();
  }
  const get = () => ({ ...prefs });

  /* Tema que está valendo agora (para o ícone do botão) */
  function effectiveTheme() {
    const attr = root.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function toggleTheme() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    set({ theme: next });
    return next;
  }

  apply();
  return { get, set, apply, effectiveTheme, toggleTheme, SCALES };
})();
