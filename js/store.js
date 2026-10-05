'use strict';
/*
 * "Servidor" simulado: tudo fica no localStorage deste navegador.
 * Senhas aparecem só como hash; mensagens da Zona Segura só como texto cifrado.
 */
const Store = (() => {
  const KEY = 'eleva.db.v1';
  let db = null;

  function empty() {
    return {
      version: 1, seeded: false, users: [], articles: [], questions: [], rooms: [], convos: [],
      reports: [], codes: [], inbox: [], attempts: {},
    };
  }
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)) || empty(); }
    catch { db = empty(); }
    return db;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { U.toast('Não foi possível salvar os dados neste navegador (armazenamento cheio?).', 'error'); }
  }
  function reset() { localStorage.removeItem(KEY); db = empty(); }

  const get = () => db;
  const user = (id) => db.users.find((u) => u.id === id);
  const userByEmail = (email) => db.users.find((u) => u.email === normEmail(email) && !u.fictional);
  const normEmail = (e) => String(e || '').trim().toLowerCase();

  /* Remove mensagens temporárias vencidas, de verdade, do armazenamento */
  function purgeExpired() {
    const now = Date.now();
    let changed = false;
    db.convos.forEach((c) => {
      const before = c.messages.length;
      c.messages = c.messages.filter((m) => !m.expiresAt || m.expiresAt > now);
      if (c.messages.length !== before) changed = true;
    });
    db.codes = db.codes.filter((c) => {
      const keep = c.expires > now;
      if (!keep) changed = true;
      return keep;
    });
    if (changed) save();
  }

  /* Visão "pública" de uma usuária (sem hashes, chaves cifradas etc.) */
  function publicUser(u) {
    if (!u) return { id: '', name: 'Usuária removida', role: '', bio: '', removed: true };
    return { id: u.id, name: u.name, role: u.role, bio: u.bio, photo: u.photo, fictional: !!u.fictional };
  }

  function sendMail(to, subject, body, code) {
    db.inbox.unshift({ id: U.uid('m'), to: normEmail(to), subject, body, code: code || null, at: Date.now(), read: false });
    db.inbox = db.inbox.slice(0, 40);
    save();
  }

  return { load, save, reset, get, user, userByEmail, normEmail, purgeExpired, publicUser, sendMail };
})();
