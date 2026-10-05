'use strict';
/*
 * Zona Segura: mensagens diretas criptografadas de ponta a ponta (ECDH P-256 + HKDF + AES-256-GCM).
 * O armazenamento ("servidor") só recebe { iv, ct }. A chave privada fica em memória durante a sessão.
 */
const Zone = (() => {
  const aad = (convo, m) => `${convo.id}|${m.from}|${m.id}`;

  async function encryptMessage(convo, fromId, fromPriv, toPubJwk, text, timerSec = 0) {
    const key = await Sec.conversationKey(fromPriv, toPubJwk, convo.id);
    const m = { id: U.uid('dm'), from: fromId, at: Date.now(), expiresAt: timerSec ? Date.now() + timerSec * 1000 : null };
    Object.assign(m, await Sec.encrypt(key, text, aad(convo, m)));
    return m;
  }
  async function decryptMessage(convo, m, myPriv, otherPubJwk) {
    const key = await Sec.conversationKey(myPriv, otherPubJwk, convo.id);
    return Sec.decrypt(key, m, aad(convo, m));
  }
  return { encryptMessage, decryptMessage };
})();

(() => {
  const { esc, $, $$ } = U;
  const TIMERS = [[0, 'Desligadas'], [300, '5 minutos'], [3600, '1 hora'], [86400, '24 horas'], [604800, '7 dias']];
  const REPLIES = [
    'Que bom falar com você por aqui! 😊', 'Entendi. Vamos marcar uma conversa por vídeo esta semana?',
    'Passei por algo parecido. O que me ajudou foi colocar tudo por escrito antes da reunião.',
    'Obrigada por confiar em mim para falar sobre isso. 💜', 'Combinado! Te mando os materiais que comentei.',
  ];
  let showCipher = false;
  let pinFails = 0;

  const S = () => App.state;
  const other = (c) => Store.user(c.members.find((id) => id !== S().meId));
  const myConvos = () => App.db().convos.filter((c) => c.members.includes(S().meId) && c.status !== 'blocked' && !App.isHidden(other(c)?.id) && !App.isContentHidden(c.id));
  const timerLabel = (s) => (TIMERS.find((t) => t[0] === s) || TIMERS[0])[1];

  /* Saída rápida: esconde tudo na hora e volta ao feed sem deixar a Zona no histórico */
  function quickExit() {
    S().zoneUnlocked = false;
    showCipher = false;
    U.closeAllModals();
    const main = $('#main');
    if (main) main.innerHTML = '';
    App.nav('#/feed', true);
  }
  let lastEsc = 0;
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !location.hash.startsWith('#/zona')) return;
    if (Date.now() - lastEsc < 800) quickExit();
    lastEsc = Date.now();
  });

  /* ---------- Portões: PIN da Zona Segura e desbloqueio da chave ---------- */
  async function gate() {
    const me = App.me();
    if (me.zonePin && !S().zoneUnlocked) {
      App.shell('zona', `
        <div class="lock-screen">
          <h1 class="page-title">🔒 Zona Segura</h1>
          <p class="muted">Digite seu PIN de acesso.</p>
          <form id="pin-form">
            <input type="password" name="pin" class="code-input" inputmode="numeric" autocomplete="off" maxlength="8" aria-label="PIN" required>
            <div class="alert alert-error hidden" id="pin-err"></div>
            <button class="btn btn-primary btn-block">Entrar</button>
          </form>
          <p class="tiny muted">Esqueceu o PIN? Remova-o em Ajustes › Zona Segura (pede sua senha).</p>
        </div>`);
      $('#pin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('#pin-err');
        if (me.zonePinLock && me.zonePinLock > Date.now()) {
          err.textContent = `PIN bloqueado. Aguarde ${Math.ceil((me.zonePinLock - Date.now()) / 1000)}s.`; err.classList.remove('hidden'); return;
        }
        const ok = await Sec.verifyPassword(e.target.pin.value, me.zonePin);
        if (ok) { pinFails = 0; S().zoneUnlocked = true; App.render(); return; }
        pinFails++;
        if (pinFails >= 5) { me.zonePinLock = Date.now() + 60000; pinFails = 0; Store.save(); }
        err.textContent = me.zonePinLock > Date.now() ? 'Muitas tentativas. PIN bloqueado por 1 minuto.' : 'PIN incorreto.';
        err.classList.remove('hidden');
        e.target.pin.value = '';
      });
      return false;
    }
    if (!S().privKey) {
      App.shell('zona', `
        <div class="lock-screen">
          <h1 class="page-title">🔐 Desbloquear mensagens</h1>
          <p class="muted">Sua chave de criptografia fica guardada cifrada com a sua senha. Para ler as mensagens neste acesso, confirme a senha.</p>
          <button class="btn btn-primary" id="unlock">Confirmar senha</button>
        </div>`);
      $('#unlock').addEventListener('click', async () => {
        if (await App.requireReauth('Para abrir a Zona Segura neste acesso.')) {
          if (!S().privKey) U.toast('Não foi possível abrir a chave de criptografia.', 'error');
          App.render();
        }
      });
      return false;
    }
    return true;
  }

  function zoneHeader(sub) {
    const me = App.me();
    return `
      <div class="zone-head">
        <div><h1 class="page-title">Zona Segura</h1><span class="tag lock">🔒 Criptografia de ponta a ponta</span> ${sub || ''}</div>
        <div class="row">
          <label class="row small" title="Borra nomes e mensagens até você passar o mouse ou tocar"><span class="switch"><input type="checkbox" id="discreet" ${me.settings.discreet ? 'checked' : ''}><span></span></span> Modo discreto</label>
          <button class="btn btn-exit btn-sm" id="quick-exit" title="Atalho: Esc duas vezes">⨯ Saída rápida</button>
        </div>
      </div>`;
  }
  function bindHeader() {
    const me = App.me();
    $('#quick-exit').addEventListener('click', quickExit);
    $('#discreet').addEventListener('change', (e) => {
      me.settings.discreet = e.target.checked; Store.save();
      $('#main').classList.toggle('discreet', me.settings.discreet);
    });
    $('#main').classList.toggle('discreet', !!me.settings.discreet);
  }

  async function preview(c) {
    const last = c.messages[c.messages.length - 1];
    if (!last) return 'Sem mensagens';
    try { return await Zone.decryptMessage(c, last, S().privKey, other(c).keys.pub); }
    catch { return '🔒 Mensagem indisponível'; }
  }

  /* ---------- Lista de conversas, pedidos e nova conversa ---------- */
  Views.zone = async ({ query, seq }) => {
    if (!(await gate())) return;
    const me = App.me();
    const startWith = query.get('nova');
    if (startWith) return startConversation(startWith);
    const tab = ['pedidos', 'nova'].includes(query.get('tab')) ? query.get('tab') : 'conversas';
    const convos = myConvos();
    const incoming = convos.filter((c) => c.status === 'request' && c.requestedBy !== me.id);
    const list = convos.filter((c) => !(c.status === 'request' && c.requestedBy !== me.id))
      .sort((a, b) => (b.messages.at(-1)?.at || b.createdAt) - (a.messages.at(-1)?.at || a.createdAt));

    let body = '';
    if (tab === 'conversas') {
      body = list.map((c) => {
        const o = Store.publicUser(other(c));
        const verified = me.verified[c.id] && me.verified[c.id] === other(c)?.keys?.pub?.x;
        return `<a class="convo-item" href="#/zona/${esc(c.id)}">${App.avatar(o)}<div class="grow"><div class="name"><b>${esc(o.name)}</b> ${verified ? '<span class="tag lock">verificada</span>' : ''} ${c.status === 'request' ? '<span class="tag">pedido enviado</span>' : ''} ${c.timer ? '<span class="tiny muted">⏱</span>' : ''}</div><div class="preview" data-preview="${esc(c.id)}">…</div></div></a>`;
      }).join('') || '<div class="empty">Nenhuma conversa ainda. Comece uma com suas conexões.</div>';
    } else if (tab === 'pedidos') {
      body = `<p class="muted small">Pedidos de quem ainda não é sua conexão. A mensagem fica escondida até você decidir abrir — e ela não sabe se você leu.</p>` +
        (incoming.map((c) => {
          const o = Store.publicUser(other(c));
          return `<div class="card" data-req="${esc(c.id)}">
            <div class="row">${App.avatar(o)}<div class="grow"><a href="#/perfil/${esc(o.id)}"><b>${esc(o.name)}</b></a><div class="tiny muted">${esc(o.role)} · ${U.timeAgo(c.createdAt)}</div></div></div>
            <p class="small" data-req-text><button class="link-btn" data-reveal="${esc(c.id)}">Ver mensagem</button></p>
            <div class="row"><button class="btn btn-primary btn-sm" data-accept="${esc(c.id)}">Aceitar</button><button class="btn btn-outline btn-sm" data-decline="${esc(c.id)}">Recusar</button><button class="btn btn-danger btn-sm" data-act="report" data-type="pedido-de-mensagem" data-id="${esc(c.id)}" data-user="${esc(o.id)}">Denunciar / bloquear</button></div>
          </div>`;
        }).join('') || '<div class="empty">Nenhum pedido pendente.</div>');
    } else {
      const conns = me.connections.map(Store.user).filter((u) => u && !App.isHidden(u.id));
      body = `
        <h2 class="section-title">Minhas conexões</h2>
        ${conns.map((u) => `<div class="list-row">${App.avatar(u, 'sm')}<div class="grow"><b>${esc(u.name)}</b><div class="tiny muted">${esc(u.role)}</div></div><button class="btn btn-primary btn-sm" data-start="${esc(u.id)}">Conversar</button></div>`).join('') || '<p class="muted small">Você ainda não tem conexões. Adicione pelo perfil das usuárias.</p>'}
        <h2 class="section-title">Outras usuárias</h2>
        <p class="tiny muted">Para quem não é sua conexão, você pode enviar apenas um <b>pedido de mensagem</b>. Ela decide se aceita.</p>
        <input type="search" id="user-search" placeholder="Buscar pelo nome" maxlength="60" aria-label="Buscar usuária">
        <div id="user-results"></div>`;
    }

    App.shell('zona', `
      ${zoneHeader()}
      <nav class="tabs">
        <a href="#/zona" class="${tab === 'conversas' ? 'active' : ''}">Conversas</a>
        <a href="#/zona?tab=pedidos" class="${tab === 'pedidos' ? 'active' : ''}">Pedidos ${incoming.length ? `<span class="badge">${incoming.length}</span>` : ''}</a>
        <a href="#/zona?tab=nova" class="${tab === 'nova' ? 'active' : ''}">Nova conversa</a>
      </nav>
      <div id="zone-body">${body}</div>`);
    bindHeader();

    if (tab === 'conversas') {
      for (const c of list) {
        const text = await preview(c);
        if (!App.isCurrent(seq)) return;
        const el = $(`[data-preview="${CSS.escape(c.id)}"]`);
        if (el) el.textContent = text;
      }
    }
    const zb = $('#zone-body');
    zb.addEventListener('click', async (e) => {
      const t = e.target;
      const find = (id) => App.db().convos.find((c) => c.id === id);
      if (t.dataset.reveal) {
        const c = find(t.dataset.reveal);
        t.parentElement.textContent = `“${await preview(c)}”`;
      } else if (t.dataset.accept) {
        const c = find(t.dataset.accept);
        c.status = 'active'; Store.save();
        App.nav(`#/zona/${c.id}`);
      } else if (t.dataset.decline) {
        App.db().convos = App.db().convos.filter((c) => c.id !== t.dataset.decline);
        Store.save(); U.toast('Pedido recusado. Ela não é avisada.'); App.render();
      } else if (t.dataset.start) {
        startConversation(t.dataset.start);
      }
    });
    const search = $('#user-search');
    if (search) {
      search.addEventListener('input', U.debounce(() => {
        const term = U.normalize(search.value.trim());
        const res = term.length < 2 ? [] : App.db().users.filter((u) => u.id !== me.id && !me.connections.includes(u.id) && !App.isHidden(u.id) && U.normalize(u.name).includes(term)).slice(0, 8);
        $('#user-results').innerHTML = res.map((u) => `<div class="list-row">${App.avatar(u, 'sm')}<div class="grow"><b>${esc(u.name)}</b><div class="tiny muted">${esc(u.role)}</div></div>${u.settings.dmPolicy === 'none' ? '<span class="tiny muted">Só aceita mensagens de conexões</span>' : `<button class="btn btn-outline btn-sm" data-start="${esc(u.id)}">Pedir para conversar</button>`}</div>`).join('') || (term.length >= 2 ? '<p class="muted small">Ninguém encontrado.</p>' : '');
      }, 200));
    }
  };

  /* Abre conversa com conexão, ou envia pedido de mensagem para quem não é conexão */
  function startConversation(userId) {
    const me = App.me();
    const o = Store.user(userId);
    if (!o || o.id === me.id || App.isHidden(o.id)) { App.nav('#/zona', true); return; }
    const existing = App.db().convos.find((c) => c.members.includes(me.id) && c.members.includes(o.id) && c.status !== 'blocked');
    if (existing) { App.nav(`#/zona/${existing.id}`, true); return; }
    if (me.connections.includes(o.id)) {
      const c = { id: U.uid('c'), members: [me.id, o.id], status: 'active', requestedBy: me.id, timer: me.settings.defaultTimer || 0, createdAt: Date.now(), messages: [] };
      App.db().convos.push(c); Store.save();
      App.nav(`#/zona/${c.id}`, true);
      return;
    }
    if (o.settings.dmPolicy === 'none') {
      U.toast(`${o.name} só recebe mensagens de conexões.`, 'error');
      App.nav('#/zona?tab=nova', true);
      return;
    }
    App.nav('#/zona?tab=nova', true);
    const m = U.modal(`
      <h2>Pedido de mensagem</h2>
      <p class="muted small">${esc(o.name)} ainda não é sua conexão. Envie uma apresentação curta — ela decide se aceita a conversa. Você só pode enviar outra mensagem depois do aceite.</p>
      <form data-f>
        <textarea name="text" maxlength="500" required placeholder="Olá! Gostaria de conversar sobre…"></textarea>
        <p class="tiny muted">🔒 Também é criptografada de ponta a ponta.</p>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Enviar pedido</button></div>
      </form>`);
    $('[data-f]', m.el).addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = e.target.text.value.trim();
      if (!text) return;
      if (!App.guardRate('dm-request', { max: 3, windowMs: 600000, minGapMs: 10000 })) return;
      const c = { id: U.uid('c'), members: [me.id, o.id], status: 'request', requestedBy: me.id, timer: 0, createdAt: Date.now(), messages: [] };
      c.messages.push(await Zone.encryptMessage(c, me.id, S().privKey, o.keys.pub, text.slice(0, 500)));
      App.db().convos.push(c); Store.save();
      m.close();
      U.toast('Pedido enviado.', 'ok');
      if (o.fictional) {
        // Simulação: usuárias fictícias aceitam o pedido depois de alguns segundos
        setTimeout(() => { const cc = App.db().convos.find((x) => x.id === c.id); if (cc && cc.status === 'request') { cc.status = 'active'; Store.save(); U.toast(`${o.name} aceitou seu pedido de mensagem.`, 'ok'); if (location.hash.includes(c.id)) App.render(); } }, 4000);
      }
      App.nav(`#/zona/${c.id}`);
    });
  }

  /* ---------- Conversa ---------- */
  Views.convo = async ({ params, seq }) => {
    if (!(await gate())) return;
    const me = App.me();
    const c = myConvos().find((x) => x.id === params[0]);
    if (!c) { App.shell('zona', `${zoneHeader()}<div class="empty">Conversa indisponível.</div>`); bindHeader(); return; }
    const o = other(c);
    const pub = Store.publicUser(o);
    const verified = me.verified[c.id] && me.verified[c.id] === o.keys.pub.x;
    const keyChanged = me.verified[c.id] && !verified;
    const incomingReq = c.status === 'request' && c.requestedBy !== me.id;
    const outgoingReq = c.status === 'request' && c.requestedBy === me.id;

    App.shell('zona', `
      ${zoneHeader()}
      <div class="row between">
        <div class="row"><a href="#/zona" class="small">←</a>${App.avatar(pub)}<div><a href="#/perfil/${esc(pub.id)}" class="name"><b>${esc(pub.name)}</b></a> ${verified ? '<span class="tag lock">✓ verificada</span>' : ''}<div class="tiny muted">${esc(pub.role)}</div></div></div>
        <div class="row">
          <button class="btn btn-ghost btn-sm ${showCipher ? 'active' : ''}" id="eye" aria-pressed="${showCipher}" title="Ver o que o servidor enxerga">👁 ${showCipher ? 'Ver mensagens' : 'Ver como o servidor vê'}</button>
          <button class="btn btn-ghost btn-sm" id="safety">Código de segurança</button>
          <label class="small nowrap" title="Mensagens temporárias">⏱ <select id="timer" class="compact" aria-label="Mensagens temporárias">${TIMERS.map(([s, l]) => `<option value="${s}" ${c.timer === s ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          ${App.menu([{ label: 'Denunciar conversa', data: { act: 'report', type: 'conversa', id: c.id, user: o.id } }, { label: 'Bloquear usuária', danger: true, data: { act: 'block', user: o.id } }, { label: 'Apagar conversa para mim', danger: true, data: { act: 'del-convo', id: c.id } }])}
        </div>
      </div>
      ${keyChanged ? '<div class="alert alert-warn small">⚠ A chave de segurança desta pessoa mudou (ex.: ela redefiniu a senha). Verifique o código de segurança de novo.</div>' : ''}
      ${c.timer ? `<div class="alert alert-info small">⏱ Mensagens temporárias ativadas: novas mensagens somem após ${esc(timerLabel(c.timer))}.</div>` : ''}
      ${showCipher ? '<div class="cipher-banner">É isto que o servidor guarda: apenas texto cifrado (AES-256-GCM). Sem as chaves privadas, que ficam só com vocês duas, ninguém consegue ler — nem a equipe Eleva.</div>' : ''}
      ${incomingReq ? `<div class="alert alert-info">Pedido de mensagem de ${esc(pub.name)}. <button class="link-btn" id="accept"><b>Aceitar</b></button> · <button class="link-btn" id="decline">Recusar</button></div>` : ''}
      <div class="chat" id="chat"><p class="muted center small">Descriptografando…</p></div>
      ${c.status === 'active' ? `
        <form class="composer" id="dm-form">
          <textarea name="text" placeholder="Mensagem criptografada" maxlength="2000" aria-label="Mensagem"></textarea>
          <button class="btn btn-primary">Enviar</button>
        </form>` : outgoingReq ? '<p class="muted small center">Pedido enviado. Você poderá mandar outras mensagens quando ela aceitar.</p>' : ''}`);
    bindHeader();

    async function drawMessages() {
      const chat = $('#chat');
      if (!chat) return;
      const parts = [];
      for (const m of c.messages) {
        const mine = m.from === me.id;
        let inner;
        if (showCipher) inner = `<div class="bubble cipher">iv: ${esc(m.iv)}<br>ct: ${esc(m.ct)}</div>`;
        else {
          try { inner = `<div class="bubble">${esc(await Zone.decryptMessage(c, m, S().privKey, o.keys.pub))}</div>`; }
          catch { inner = '<div class="bubble undecryptable">🔒 Esta mensagem foi cifrada com uma chave anterior e não pode ser lida.</div>'; }
        }
        parts.push(`<div class="msg ${mine ? 'mine' : ''}">${inner}<div class="meta">${U.timeAgo(m.at)}${m.expiresAt ? ` · ⏱ some ${U.timeAgo(2 * Date.now() - m.expiresAt).replace('há', 'em')}` : ''}</div></div>`);
      }
      if (!App.isCurrent(seq)) return;
      chat.innerHTML = parts.join('') || '<p class="muted center small">Nenhuma mensagem. Diga olá! 👋</p>';
      chat.scrollTop = chat.scrollHeight;
    }
    await drawMessages();

    // Remove mensagens temporárias vencidas enquanto a conversa está aberta
    const iv = setInterval(() => {
      if (!App.isCurrent(seq)) { clearInterval(iv); return; }
      const before = c.messages.length;
      Store.purgeExpired();
      const fresh = App.db().convos.find((x) => x.id === c.id);
      if (fresh && fresh.messages.length !== before) { c.messages = fresh.messages; drawMessages(); }
    }, 5000);

    $('#eye').addEventListener('click', () => { showCipher = !showCipher; App.render(); });
    $('#safety').addEventListener('click', () => safetyModal(c, o));
    $('#timer').addEventListener('change', (e) => {
      const v = Number(e.target.value);
      if (!TIMERS.some((t) => t[0] === v)) return;
      c.timer = v; Store.save();
      U.toast(v ? `Mensagens temporárias: ${timerLabel(v)}` : 'Mensagens temporárias desligadas');
      App.render();
    });
    const acc = $('#accept');
    if (acc) acc.addEventListener('click', () => { c.status = 'active'; Store.save(); App.render(); });
    const dec = $('#decline');
    if (dec) dec.addEventListener('click', () => { App.db().convos = App.db().convos.filter((x) => x.id !== c.id); Store.save(); App.nav('#/zona?tab=pedidos'); });
    $('#main').addEventListener('click', async (e) => {
      const t = e.target.closest('[data-act="del-convo"]');
      if (!t) return;
      if (await U.confirmDialog('Apagar conversa?', 'As mensagens serão apagadas deste dispositivo e do servidor.', { okLabel: 'Apagar', danger: true })) {
        App.db().convos = App.db().convos.filter((x) => x.id !== c.id); Store.save(); App.nav('#/zona');
      }
    });

    const form = $('#dm-form');
    if (!form) return;
    const send = async () => {
      const text = form.text.value.trim();
      if (!text) return;
      if (!App.guardRate('dm', { max: 20, windowMs: 60000, minGapMs: 400 })) return;
      form.text.value = '';
      c.messages.push(await Zone.encryptMessage(c, me.id, S().privKey, o.keys.pub, text.slice(0, 2000), c.timer));
      Store.save();
      await drawMessages();
      if (o.fictional) {
        // Simulação: a usuária fictícia responde com uma mensagem cifrada pela chave dela
        setTimeout(async () => {
          const cc = App.db().convos.find((x) => x.id === c.id);
          if (!cc || cc.status !== 'active') return;
          const reply = REPLIES[Math.floor(Math.random() * REPLIES.length)];
          cc.messages.push(await Zone.encryptMessage(cc, o.id, await Sec.importPriv(o.privJwk), me.keys.pub, reply, cc.timer));
          Store.save();
          if (App.isCurrent(seq)) { c.messages = cc.messages; drawMessages(); }
        }, 1500);
      }
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
    form.text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    form.text.focus();
  };

  async function safetyCode(me, o) { return Sec.safetyCode(me.keys.pub, o.keys.pub); }
  async function safetyModal(c, o) {
    const me = App.me();
    const groups = await safetyCode(me, o);
    const verified = me.verified[c.id] === o.keys.pub.x;
    const m = U.modal(`
      <h2>Código de segurança</h2>
      <p class="muted small">Compare este código com o de ${esc(o.name)}, pessoalmente ou por chamada de vídeo. Se for igual nos dois aparelhos, ninguém está interceptando a conversa.</p>
      <div class="safety-code">${groups.slice(0, 4).join(' ')}<br>${groups.slice(4, 8).join(' ')}<br>${groups.slice(8).join(' ')}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close>Fechar</button>
        <button class="btn ${verified ? 'btn-outline' : 'btn-primary'}" data-verify>${verified ? 'Remover verificação' : 'Marcar como verificada'}</button>
      </div>`);
    $('[data-verify]', m.el).addEventListener('click', () => {
      if (verified) delete me.verified[c.id];
      else me.verified[c.id] = o.keys.pub.x;
      Store.save(); m.close(); App.render();
    });
  }
})();
