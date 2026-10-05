'use strict';
/* Núcleo do app: sessão, roteamento, layout e ações de segurança compartilhadas entre as telas. */
const Views = {};

const App = (() => {
  const { esc, $, $$ } = U;
  const SESSION_KEY = 'eleva.session';
  const IDLE_MS = 15 * 60 * 1000;
  const IDLE_WARN_MS = 14 * 60 * 1000;
  const REAUTH_MS = 5 * 60 * 1000;

  const state = {
    meId: null, sid: null,
    privKey: null,          // chave privada da Zona Segura: só em memória, nunca salva em texto puro
    zoneUnlocked: false,    // PIN da Zona Segura informado nesta sessão
    reauthUntil: 0,         // janela após confirmar a senha para ações sensíveis
    pending: null,          // fluxo de verificação em andamento (e-mail / duas etapas)
    viewed: new Set(),
  };

  const db = () => Store.get();
  /* sessionStorage pode estar bloqueado (janela privada, iframe): o app segue funcionando sem ele */
  const ss = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* ignora */ } },
    del: (k) => { try { sessionStorage.removeItem(k); } catch { /* ignora */ } },
  };
  const me = () => (state.meId ? Store.user(state.meId) : null);

  /* ================= Sessão ================= */
  function deviceLabel() {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
    const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
    return `${browser}${os ? ' · ' + os : ''}`;
  }

  async function completeLogin(user, password, privKeyOverride, nextHash) {
    if (privKeyOverride) state.privKey = privKeyOverride;
    else {
      try { state.privKey = (await Sec.unwrapPrivate(user.keys.wrapped, password)).key; }
      catch { state.privKey = null; }
    }
    const sid = U.uid('s');
    user.sessions = (user.sessions || []).filter((s) => s.id).slice(-4);
    user.sessions.push({ id: sid, device: deviceLabel(), createdAt: Date.now(), lastSeen: Date.now() });
    if (!user.demo) Store.sendMail(user.email, 'Novo acesso à sua conta Eleva', `Detectamos um novo acesso em ${deviceLabel()} em ${U.fullDate(Date.now())}. Se não foi você, altere sua senha e encerre as outras sessões em Configurações.`);
    Store.save();
    state.meId = user.id; state.sid = sid; state.pending = null; state.zoneUnlocked = false; state.reauthUntil = 0;
    ss.set(SESSION_KEY, JSON.stringify({ uid: user.id, sid, last: Date.now() }));
    startIdleWatch();
    nav(nextHash || '#/feed');
    if (!nextHash && !Prefs.get().tourDone) setTimeout(() => { if (!U.hasModal()) A11y.openTour(); }, 400);
  }

  function restoreSession() {
    try {
      const s = JSON.parse(ss.get(SESSION_KEY));
      if (!s) return;
      const u = Store.user(s.uid);
      if (!u || !u.sessions.some((x) => x.id === s.sid) || Date.now() - s.last > IDLE_MS) {
        ss.del(SESSION_KEY);
        if (u && Date.now() - s.last > IDLE_MS) U.toast('Você foi desconectada por inatividade.');
        return;
      }
      state.meId = u.id; state.sid = s.sid;
      startIdleWatch();
    } catch { ss.del(SESSION_KEY); }
  }

  function logout(message) {
    const u = me();
    if (u) {
      u.sessions = u.sessions.filter((s) => s.id !== state.sid);
      Store.save();
    }
    state.meId = null; state.sid = null; state.privKey = null; state.zoneUnlocked = false; state.reauthUntil = 0; state.pending = null;
    state.viewed.clear();
    ss.del(SESSION_KEY);
    stopIdleWatch();
    U.closeAllModals();
    if (message) U.toast(message);
    nav('#/entrar', true);
  }

  /* A sessão continua válida? (pode ter sido encerrada em outra aba/dispositivo) */
  function sessionValid() {
    const u = me();
    return !!(u && u.sessions.some((s) => s.id === state.sid));
  }

  /* ---- Saída automática após 15 min sem uso ---- */
  let idleTimer = null, warnTimer = null, lastTouch = 0, warnEl = null;
  function touch() {
    if (!state.meId) return;
    const now = Date.now();
    if (now - lastTouch < 5000) return;
    lastTouch = now;
    try {
      const s = JSON.parse(ss.get(SESSION_KEY));
      if (s) { s.last = now; ss.set(SESSION_KEY, JSON.stringify(s)); }
    } catch { /* ignora */ }
    armIdle();
  }
  function armIdle() {
    clearTimeout(idleTimer); clearTimeout(warnTimer);
    if (warnEl) { warnEl.remove(); warnEl = null; }
    warnTimer = setTimeout(() => {
      warnEl = document.createElement('div');
      warnEl.className = 'idle-warning alert alert-warn';
      warnEl.innerHTML = 'Por segurança, você será desconectada em 1 minuto por inatividade. <button class="link-btn">Continuar conectada</button>';
      warnEl.querySelector('button').addEventListener('click', () => { lastTouch = 0; touch(); });
      document.body.appendChild(warnEl);
    }, IDLE_WARN_MS);
    idleTimer = setTimeout(() => logout('Você foi desconectada após 15 minutos sem uso.'), IDLE_MS);
  }
  function startIdleWatch() { lastTouch = 0; touch(); }
  function stopIdleWatch() {
    clearTimeout(idleTimer); clearTimeout(warnTimer);
    if (warnEl) { warnEl.remove(); warnEl = null; }
  }
  ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'].forEach((ev) => window.addEventListener(ev, touch, { passive: true }));

  /* ---- Pedir a senha de novo antes de ações sensíveis ---- */
  function requireReauth(reason) {
    if (Date.now() < state.reauthUntil) return Promise.resolve(true);
    const u = me();
    return new Promise((resolve) => {
      let done = false;
      const m = U.modal(`
        <h2>Confirme sua senha</h2>
        <p class="muted">${esc(reason || 'Esta é uma ação sensível.')} Por segurança, digite sua senha novamente.</p>
        <form data-f>
          ${pwField('password', 'Senha', 'current-password')}
          ${u.demo ? `<p class="tiny muted">Conta de demonstração: a senha é <code>${esc(Seed.DEMO_PASSWORD)}</code></p>` : ''}
          <div class="alert alert-error hidden" data-err></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
            <button class="btn btn-primary">Confirmar</button>
          </div>
        </form>`, { onClose: () => { if (!done) resolve(false); } });
      U.bindPasswordToggles(m.el);
      const f = $('[data-f]', m.el);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('button:not([type])', f); btn.disabled = true;
        const pw = f.password.value;
        const ok = await Sec.verifyPassword(pw, u.pwd);
        btn.disabled = false;
        if (!ok) { const err = $('[data-err]', m.el); err.textContent = 'Senha incorreta.'; err.classList.remove('hidden'); return; }
        state.reauthUntil = Date.now() + REAUTH_MS;
        if (!state.privKey && u.keys && u.keys.wrapped) {
          try { state.privKey = (await Sec.unwrapPrivate(u.keys.wrapped, pw)).key; } catch { /* chave antiga */ }
        }
        done = true; m.close(); resolve(true);
      });
    });
  }

  /* ---- Códigos por e-mail (verificação, duas etapas, recuperação) ---- */
  async function issueCode(email, purpose) {
    const code = Sec.randomCode(6);
    const e = Store.normEmail(email);
    const d = db();
    d.codes = d.codes.filter((c) => !(c.email === e && c.purpose === purpose));
    d.codes.push({ email: e, purpose, hash: await Sec.sha256Hex(`${purpose}:${e}:${code}`), expires: Date.now() + 10 * 60000, attempts: 0 });
    const subjects = { verify: 'Confirme seu e-mail no Eleva', '2fa': 'Seu código de acesso ao Eleva', '2fa-setup': 'Ative a verificação em duas etapas', reset: 'Redefinição de senha do Eleva' };
    Store.sendMail(e, subjects[purpose], 'Use o código abaixo. Ele expira em 10 minutos. Nunca compartilhe este código com ninguém — a equipe Eleva nunca pede códigos.', code);
    refreshInboxBadge();
  }
  async function checkCode(email, purpose, code) {
    const e = Store.normEmail(email);
    const d = db();
    const rec = d.codes.find((c) => c.email === e && c.purpose === purpose && c.expires > Date.now());
    if (!rec) return { ok: false, error: 'Código expirado ou inválido. Peça um novo código.' };
    rec.attempts++;
    const ok = rec.hash === await Sec.sha256Hex(`${purpose}:${e}:${String(code).trim()}`);
    if (ok || rec.attempts >= 5) d.codes = d.codes.filter((c) => c !== rec);
    Store.save();
    if (ok) return { ok: true };
    return { ok: false, error: rec.attempts >= 5 ? 'Muitas tentativas. Peça um novo código.' : 'Código incorreto.' };
  }

  /* ================= Moderação e privacidade ================= */
  function isHidden(userId) {
    const u = me();
    if (!u || !userId || userId === u.id) return false;
    const other = Store.user(userId);
    return u.blocked.includes(userId) || (other && other.blocked.includes(u.id));
  }

  const REPORT_REASONS = ['Assédio ou intimidação', 'Discriminação ou discurso de ódio', 'Exposição de dados pessoais', 'Spam ou golpe', 'Informação falsa', 'Conteúdo impróprio', 'Outro motivo'];
  function report(type, targetId, targetUserId) {
    const m = U.modal(`
      <h2>Denunciar</h2>
      <p class="muted small">A denúncia é <b>confidencial</b>: a pessoa denunciada não sabe quem denunciou. Nossa moderação analisa em até 24 horas.</p>
      <form data-f>
        ${REPORT_REASONS.map((r, i) => `<label class="check"><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? 'checked' : ''}> ${esc(r)}</label>`).join('')}
        <label class="field"><span>Detalhes (opcional)</span><textarea name="details" maxlength="1000"></textarea></label>
        <label class="check"><input type="checkbox" name="hide" checked> Ocultar este conteúdo para mim</label>
        ${targetUserId ? '<label class="check"><input type="checkbox" name="block"> Também bloquear esta usuária</label>' : ''}
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Enviar denúncia</button></div>
      </form>`);
    $('[data-f]', m.el).addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const u = me();
      db().reports.push({ id: U.uid('rp'), reporterId: u.id, type, targetId, targetUserId: targetUserId || null, reason: f.reason.value, details: f.details.value.slice(0, 1000), at: Date.now(), status: 'em análise' });
      if (f.hide.checked) { u.hiddenContent = u.hiddenContent || []; u.hiddenContent.push(targetId); }
      Store.save();
      m.close();
      if (f.block && f.block.checked) blockUser(targetUserId, true);
      else { U.toast('Denúncia enviada. Obrigada por ajudar a manter o Eleva seguro.', 'ok'); render(); }
    });
  }
  const isContentHidden = (id) => (me()?.hiddenContent || []).includes(id);

  async function blockUser(userId, skipConfirm) {
    const u = me();
    const other = Store.user(userId);
    if (!other || userId === u.id) return;
    if (!skipConfirm) {
      const ok = await U.confirmDialog(`Bloquear ${other.name}?`, 'Ela não poderá ver seu conteúdo nem enviar mensagens para você, e você deixará de ver o conteúdo dela. Ela não será avisada. Você pode desbloquear em Configurações.', { okLabel: 'Bloquear', danger: true });
      if (!ok) return;
    }
    if (!u.blocked.includes(userId)) u.blocked.push(userId);
    // Desfaz vínculos nos dois sentidos
    u.following = u.following.filter((x) => x !== userId); u.followers = u.followers.filter((x) => x !== userId);
    other.following = other.following.filter((x) => x !== u.id); other.followers = other.followers.filter((x) => x !== u.id);
    u.connections = u.connections.filter((x) => x !== userId); other.connections = other.connections.filter((x) => x !== u.id);
    db().convos.filter((c) => c.members.includes(userId) && c.members.includes(u.id)).forEach((c) => { c.status = 'blocked'; });
    Store.save();
    U.toast(`${other.name} foi bloqueada.`, 'ok');
    render();
  }

  /* Bloqueia CPF/celular em áreas abertas */
  function guardPublic(...texts) {
    const found = [...new Set(texts.flatMap((t) => Sec.detectPII(t)))];
    if (!found.length) return true;
    U.modal(`
      <h2>Proteja seus dados</h2>
      <div class="alert alert-warn">Encontramos ${esc(found.join(' e '))} no seu texto.</div>
      <p>Para sua segurança, não é permitido publicar CPF ou número de celular em áreas abertas do Eleva. Golpistas podem usar esses dados.</p>
      <p class="muted small">Se precisar trocar contato com alguém, use a <b>Zona Segura</b>, que é criptografada de ponta a ponta.</p>
      <div class="modal-actions"><button class="btn btn-primary" data-close>Entendi, vou editar</button></div>`);
    return false;
  }
  function guardRate(bucket, opts) {
    const err = Sec.rateLimit(`${state.meId}:${bucket}`, opts);
    if (err) { U.toast(err, 'error'); return false; }
    return true;
  }

  /* ================= Componentes ================= */
  function avatar(u, size = '') {
    if (!u || u.anonymous) return `<span class="avatar anon ${size}" aria-hidden="true">?</span>`;
    if (u.photo) return `<img class="avatar ${size}" src="${esc(u.photo)}" alt="">`;
    return `<span class="avatar ${size}" aria-hidden="true">${esc(U.initials(u.name))}</span>`;
  }
  function pwField(name, label, autocomplete = 'current-password', extra = '') {
    return `<label class="field"><span>${esc(label)}</span><div class="pw-wrap"><input type="password" name="${name}" autocomplete="${autocomplete}" required maxlength="128" ${extra}><button type="button" class="link-btn pw-toggle" aria-label="Mostrar senha" aria-pressed="false">mostrar</button></div></label>`;
  }
  function meterHtml() {
    return '<div class="meter"><i></i></div><div class="meter-label muted"></div><ul class="meter-issues"></ul>';
  }
  /* Liga o medidor de força a um campo de senha. ctxFn devolve {name,email}. */
  function bindMeter(input, root, ctxFn) {
    const bar = $('.meter > i', root), label = $('.meter-label', root), list = $('.meter-issues', root);
    const colors = ['#b3261e', '#d9622b', '#c79a00', '#3f8f4f', '#1e7a46'];
    const upd = () => {
      const v = input.value;
      if (!v) { bar.style.width = '0'; label.textContent = ''; list.innerHTML = ''; return; }
      const r = Sec.passwordStrength(v, ctxFn());
      bar.style.width = `${(r.score + 1) * 20}%`;
      bar.style.background = colors[r.score];
      label.textContent = `Força: ${r.label}${r.ok ? '' : ' — ainda não pode ser usada'}`;
      list.innerHTML = r.issues.map((i) => `<li>${esc(i)}</li>`).join('');
    };
    input.addEventListener('input', upd);
    upd();
  }
  function menu(items) {
    return `<span class="menu-wrap"><button type="button" class="icon-btn" data-act="menu" aria-label="Mais opções" aria-haspopup="true" aria-expanded="false">•••</button><div class="menu hidden">${
      items.map((i) => `<button type="button" ${i.danger ? 'class="danger"' : ''} ${Object.entries(i.data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${esc(i.label)}</button>`).join('')}</div></span>`;
  }
  /* Menu padrão de conteúdo: denunciar / bloquear (ou excluir, se for meu) */
  function contentMenu(type, id, authorId, { onDelete } = {}) {
    const items = [];
    if (authorId === state.meId) {
      if (onDelete) items.push({ label: 'Excluir', danger: true, data: { act: onDelete, id } });
    } else {
      items.push({ label: 'Denunciar', data: { act: 'report', type, id, user: authorId || '' } });
      if (authorId) items.push({ label: 'Bloquear usuária', danger: true, data: { act: 'block', user: authorId } });
    }
    return items.length ? menu(items) : '';
  }

  const ICONS = {
    feed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 5h16M4 10h16M4 15h10M4 20h7"/></svg>',
    comunidade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
    zona: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    perfil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    config: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  };

  const SHIELD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M12 8v4m0 3h.01"/></svg>';
  let bannerDismissed = false;

  function shell(active, html) {
    const u = me();
    const pendingReq = db().convos.filter((c) => c.status === 'request' && c.members.includes(u.id) && c.requestedBy !== u.id).length;
    const link = (key, href, label, badge) => `<a href="${href}" ${active === key ? 'aria-current="page"' : ''}>${ICONS[key]}<span>${label}</span>${badge ? ` <span class="badge" aria-label="${badge} pedido${badge > 1 ? 's' : ''} pendente${badge > 1 ? 's' : ''}">${badge}</span>` : ''}</a>`;
    // Convite para ativar a verificação em duas etapas, enquanto ela estiver desligada
    const banner = !u.mfa && !bannerDismissed && active !== 'config' ? `
      <div class="security-banner" role="region" aria-label="Aviso de segurança">${SHIELD}
        <div class="grow"><b>Sua conta está protegida só pela senha.</b> Ative a verificação em duas etapas: mesmo que alguém descubra sua senha, não consegue entrar.</div>
        <a class="btn btn-primary btn-sm" href="#/config#seguranca">Ativar agora</a>
        <button class="btn btn-ghost btn-sm" data-act="dismiss-banner">Agora não</button>
      </div>` : '';
    $('#app').innerHTML = `
      <a class="skip-link" href="#main" data-skip>Pular para o conteúdo</a>
      <header class="topbar"><div class="topbar-inner">
        <a class="brand" href="#/feed" aria-label="Eleva, ir para o Feed">Eleva</a>
        <nav class="nav" aria-label="Principal">
          ${link('feed', '#/feed', 'Feed')}
          ${link('comunidade', '#/comunidade', 'Comunidade')}
          ${link('zona', '#/zona', 'Zona Segura', pendingReq)}
          ${link('perfil', `#/perfil/${u.id}`, 'Perfil')}
          ${link('config', '#/config', 'Ajustes')}
        </nav>
        <div class="top-tools">${A11y.toolsHtml()}</div>
      </div></header>
      <main class="main" id="main" tabindex="-1">${banner}${html}</main>
      <footer class="footer-note">Protótipo Eleva · os dados ficam somente neste navegador · <a href="#/termos">Termos</a> · <a href="#/privacidade">Privacidade</a> · <button class="link-btn" data-tool="help">Ajuda e atalhos</button></footer>`;
    document.body.classList.add('in-app');
    window.scrollTo(0, 0);
  }
  const icon = (k) => ICONS[k] || '';

  /* ================= Roteamento ================= */
  const ROUTES = [
    { re: /^\/entrar$/, view: 'login', guest: true },
    { re: /^\/cadastro$/, view: 'signup', guest: true },
    { re: /^\/verificar$/, view: 'verify', guest: true },
    { re: /^\/recuperar$/, view: 'forgot', guest: true },
    { re: /^\/termos$/, view: 'terms', open: true },
    { re: /^\/privacidade$/, view: 'privacy', open: true },
    { re: /^\/feed$/, view: 'feed' },
    { re: /^\/escrever$/, view: 'write' },
    { re: /^\/artigo\/([\w-]+)$/, view: 'article' },
    { re: /^\/comunidade$/, view: 'community' },
    { re: /^\/pergunta\/([\w-]+)$/, view: 'question' },
    { re: /^\/sala\/([\w-]+)$/, view: 'room' },
    { re: /^\/zona$/, view: 'zone' },
    { re: /^\/zona\/([\w-]+)$/, view: 'convo' },
    { re: /^\/perfil\/([\w-]+)$/, view: 'profile' },
    { re: /^\/config$/, view: 'settings' },
  ];

  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [main, anchor] = raw.split('#');
    const [path, qs] = main.split('?');
    return { path, query: new URLSearchParams(qs || ''), anchor };
  }
  function nav(hash, replace = false) {
    if (replace) { history.replaceState(null, '', hash); render(); }
    else if (location.hash === hash) render();
    else location.hash = hash;
  }

  let renderSeq = 0;
  let lastPath = null;
  const TITLES = { login: 'Entrar', signup: 'Criar conta', verify: 'Verificação', forgot: 'Recuperar acesso', feed: 'Feed', write: 'Escrever artigo',
    article: 'Artigo', community: 'Comunidade', question: 'Pergunta', room: 'Sala', zone: 'Zona Segura', convo: 'Conversa', profile: 'Perfil', settings: 'Ajustes', terms: 'Termos de Uso', privacy: 'Privacidade' };
  async function render() {
    const seq = ++renderSeq;
    Store.purgeExpired();
    if (state.meId && !sessionValid()) { logout('Sua sessão foi encerrada.'); return; }
    const { path, query, anchor } = parseHash();
    const route = ROUTES.find((r) => r.re.test(path));
    if (!route) { nav(state.meId ? '#/feed' : '#/entrar', true); return; }
    if (!route.open) {
      if (!state.meId && !route.guest) { nav('#/entrar', true); return; }
      if (state.meId && route.guest) { nav('#/feed', true); return; }
    }
    const params = path.match(route.re).slice(1);
    $$('.menu').forEach((m) => m.classList.add('hidden'));
    try { await Views[route.view]({ params, query, seq }); }
    catch (e) { console.error(e); if (seq === renderSeq) U.toast('Algo deu errado ao abrir esta tela.', 'error'); }
    if (seq !== renderSeq) return;
    if (!state.meId) document.body.classList.remove('in-app');
    A11y.afterRender(TITLES[route.view], path !== lastPath);
    lastPath = path;
    if (anchor) { const el = document.getElementById(anchor); if (el) { el.scrollIntoView(); if (el.tabIndex < 0) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); } }
    refreshInboxBadge();
  }
  const isCurrent = (seq) => seq === renderSeq;

  /* ================= Caixa de e-mail simulada ================= */
  function refreshInboxBadge() {
    const n = db().inbox.filter((m) => !m.read).length;
    const b = $('#inbox-count');
    b.textContent = n; b.classList.toggle('hidden', !n);
  }
  function openInbox() {
    const d = db();
    const html = d.inbox.length ? d.inbox.map((m) => `
      <div class="mail">
        <div class="row between"><b>${esc(m.subject)}</b><span class="tiny muted">${U.timeAgo(m.at)}</span></div>
        <div class="tiny muted">Para: ${esc(m.to)}</div>
        <p class="small">${esc(m.body)}</p>
        ${m.code ? `<div class="code">${esc(m.code)}</div>` : ''}
      </div>`).join('') : '<p class="muted">Nenhum e-mail ainda.</p>';
    U.modal(`<h2>Caixa de e-mail simulada</h2>
      <p class="tiny muted">No app real estes e-mails chegariam à sua caixa de entrada. Aqui eles aparecem para você testar os fluxos de verificação.</p>
      ${html}<div class="modal-actions"><button class="btn btn-primary" data-close>Fechar</button></div>`, { wide: true });
    d.inbox.forEach((m) => { m.read = true; });
    Store.save();
    refreshInboxBadge();
  }

  /* ================= Eventos globais ================= */
  function bindGlobal() {
    $('#inbox-btn').addEventListener('click', openInbox);
    // "Pular para o conteúdo" não pode mexer no endereço (o roteador usa o #)
    document.addEventListener('click', (e) => {
      const skip = e.target.closest('[data-skip]');
      if (!skip) return;
      e.preventDefault();
      const main = $('#main');
      if (main) { main.focus(); main.scrollIntoView(); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const open = $$('.menu').find((m) => !m.classList.contains('hidden'));
        if (open) { open.classList.add('hidden'); const b = open.previousElementSibling; if (b) { b.setAttribute('aria-expanded', 'false'); b.focus(); } }
      }
    });
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      if (!e.target.closest('.menu-wrap')) $$('.menu').forEach((m) => m.classList.add('hidden'));
      if (!t) return;
      const act = t.dataset.act;
      if (act === 'menu') {
        const menuEl = t.nextElementSibling;
        const wasHidden = menuEl.classList.contains('hidden');
        $$('.menu').forEach((m) => m.classList.add('hidden'));
        $$('[data-act="menu"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
        menuEl.classList.toggle('hidden', !wasHidden);
        t.setAttribute('aria-expanded', String(wasHidden));
        if (wasHidden) { const first = menuEl.querySelector('button'); if (first) first.focus(); }
      } else if (act === 'dismiss-banner') {
        bannerDismissed = true;
        const b = t.closest('.security-banner'); if (b) b.remove();
        U.toast('Você pode ativar quando quiser em Ajustes › Conta e segurança.');
      } else if (act === 'report') { report(t.dataset.type, t.dataset.id, t.dataset.user || null); }
      else if (act === 'block') { blockUser(t.dataset.user); }
    });
    window.addEventListener('hashchange', render);
    // Outra aba alterou os dados (ex.: encerrou as sessões): recarrega e revalida
    window.addEventListener('storage', (e) => {
      if (e.key !== 'eleva.db.v1') return;
      Store.load();
      if (state.meId && !sessionValid()) logout('Sua sessão foi encerrada em outro dispositivo.');
    });
    setInterval(() => { if (state.meId) Store.purgeExpired(); }, 30000);
  }

  async function boot() {
    Store.load();
    if (!Store.get().seeded) {
      $('#app').innerHTML = '<div class="empty">Preparando o Eleva…</div>';
      await Seed.run(Store.get());
      Store.save();
    }
    // Contas antigas com "duas etapas" por e-mail passam para o novo formato
    Store.get().users.forEach((u) => { if (u.twoFA && !u.mfa) u.mfa = { method: 'email', backup: [], enabledAt: Date.now() }; delete u.twoFA; });
    bindGlobal();
    restoreSession();
    render();
  }

  return { state, db, me, completeLogin, logout, requireReauth, issueCode, checkCode, isHidden, isContentHidden,
    report, blockUser, guardPublic, guardRate, avatar, pwField, meterHtml, bindMeter, menu, contentMenu, shell,
    nav, render, isCurrent, boot, icon, deviceLabel, refreshInboxBadge, sessionKey: SESSION_KEY };
})();
