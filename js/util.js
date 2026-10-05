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
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => el.remove(), type === 'error' ? 5000 : 3200);
  }

  /* Modal simples. Retorna { el, close }. onClose é chamado ao fechar. */
  let modalStack = [];
  function modal(html, { wide = false, onClose } = {}) {
    const back = document.createElement('div');
    back.className = 'modal-backdrop';
    back.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    $('#modal-root').appendChild(back);
    const el = back.firstElementChild;
    const close = () => {
      if (!back.isConnected) return;
      back.remove();
      modalStack = modalStack.filter((m) => m !== close);
      if (onClose) onClose();
    };
    modalStack.push(close);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    $$('[data-close]', el).forEach((b) => b.addEventListener('click', close));
    const first = el.querySelector('input, textarea, select, button:not([data-close])');
    if (first) setTimeout(() => first.focus(), 30);
    return { el, close };
  }
  const closeAllModals = () => [...modalStack].forEach((c) => c());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) modalStack[modalStack.length - 1]();
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
    }));
  }

  return { esc, $, $$, uid, randomHex, toB64, fromB64, timeAgo, fullDate, initials, paragraphs, normalize, readingTime,
    toast, modal, closeAllModals, confirmDialog, copy, debounce, bindPasswordToggles };
})();
