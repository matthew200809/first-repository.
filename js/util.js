'use strict';
/* Utilidades de interface. Todo texto vindo de usuárias passa por esc() antes de virar HTML. */
const U = (() => {
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function randomHex(bytes = 12) {
    const a = crypto.getRandomValues(new Uint8Array(bytes));
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  const uid = (prefix = '') => prefix + randomHex(9);

  function toB64(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  function timeAgo(ts) {
    const d = Math.max(0, Date.now() - ts) / 1000;
    if (d < 60) return 'agora';
    if (d < 3600) return `há ${Math.floor(d / 60)} min`;
    if (d < 86400) return `há ${Math.floor(d / 3600)} h`;
    if (d < 86400 * 7) return `há ${Math.floor(d / 86400)} d`;
    return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  const fullDate = (ts) => new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter((p) => !/^(da|de|do|das|dos|e)$/i.test(p));
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  /* Texto puro -> parágrafos HTML seguros */
  function paragraphs(text) {
    return String(text || '').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  }

  const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function readingTime(text) {
    const words = String(text || '').split(/\s+/).length;
    return Math.max(1, Math.round(words / 200));
  }

  function toast(msg, type = '') {
    const root = $('#toast-root');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    // Erros interrompem o leitor de tela; os demais avisos esperam a vez
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
  }

  /* Anuncia uma frase para leitores de tela sem mudar o que está na tela */
  function announce(msg) {
    const el = $('#sr-announcer');
    if (!el) return;
    el.textContent = '';
    setTimeout(() => { el.textContent = msg; }, 60);
  }

  /* Modal acessível: rótulo pelo título, foco preso dentro e devolvido ao fechar. Retorna { el, close }. */
  let modalStack = [];
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function modal(html, { wide = false, onClose } = {}) {
    const opener = document.activeElement;
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    const titleId = uid('mt');
    back.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">${html}</div>`;
    $('#modal-root').appendChild(back);
    const el = back.firstElementChild;
    const h = el.querySelector('h2');
    if (h) h.id = titleId;
    // O resto da página fica inerte enquanto o modal está aberto
    const app = $('#app');
    if (app) app.setAttribute('aria-hidden', 'true');
    const close = () => {
      if (!back.isConnected) return;
      back.remove();
      modalStack = modalStack.filter((m) => m.close !== close);
      if (!modalStack.length && app) app.removeAttribute('aria-hidden');
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
      if (onClose) onClose();
    };
    modalStack.push({ close, el });
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    $$('[data-close]', el).forEach((b) => b.addEventListener('click', close));
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const items = $$(FOCUSABLE, el).filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    const first = el.querySelector('input:not([type=hidden]), textarea, select, button:not([data-close])') || el.querySelector(FOCUSABLE);
    if (first) setTimeout(() => first.focus(), 30);
    return { el, close };
  }
  const closeAllModals = () => [...modalStack].forEach((m) => m.close());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1].close();
  });

  function confirmDialog(title, text, { okLabel = 'Confirmar', danger = false } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      const m = modal(`
        <h2>${esc(title)}</h2><p>${esc(text)}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-close>Cancelar</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okLabel)}</button>
        </div>`, { onClose: () => { if (!answered) resolve(false); } });
      m.el.querySelector('[data-ok]').addEventListener('click', () => { answered = true; m.close(); resolve(true); });
    });
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copiado para a área de transferência', 'ok'); }
    catch { toast('Não foi possível copiar automaticamente. Selecione e copie o texto.'); }
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  /* Liga o botão "mostrar/ocultar" de campos de senha */
  function bindPasswordToggles(root) {
    $$('.pw-toggle', root).forEach((b) => b.addEventListener('click', () => {
      const input = b.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.textContent = show ? 'ocultar' : 'mostrar';
      b.setAttribute('aria-pressed', String(show));
    }));
  }

  return { esc, $, $$, uid, randomHex, toB64, fromB64, timeAgo, fullDate, initials, paragraphs, normalize, readingTime,
    toast, announce, modal, closeAllModals, hasModal: () => modalStack.length > 0, confirmDialog, copy, debounce, bindPasswordToggles };
})();
