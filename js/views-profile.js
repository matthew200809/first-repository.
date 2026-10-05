'use strict';
/* Perfil público, painel privado de métricas (só a dona vê), seguir, conexões e compartilhamento. */
(() => {
  const { esc, $ } = U;

  Views.toggleFollow = (userId) => {
    const me = App.me();
    const o = Store.user(userId);
    if (!o || o.id === me.id || App.isHidden(o.id)) return;
    if (me.following.includes(o.id)) {
      me.following = me.following.filter((x) => x !== o.id);
      o.followers = o.followers.filter((x) => x !== me.id);
    } else {
      me.following.push(o.id);
      o.followers.push(me.id);
    }
    Store.save();
  };

  Views.shareProfile = (u) => {
    if (!u) return;
    const p = Store.publicUser(u);
    const url = `${location.origin}${location.pathname}#/perfil/${p.id}`;
    const m = U.modal(`
      <h2>Compartilhar perfil</h2>
      <div class="share-card">${App.avatar(p, 'lg')}<h3>${esc(p.name)}</h3><div class="small">${esc(p.role)}</div><div class="brand-mini">Eleva · mulheres na liderança</div></div>
      <label class="field"><span>Link do perfil</span><input type="text" readonly value="${esc(url)}"></label>
      <p class="tiny muted">O link mostra só informações públicas: nome, cargo, bio e artigos. E-mail e métricas nunca são compartilhados.</p>
      <div class="modal-actions">
        ${navigator.share ? '<button class="btn btn-outline" data-native>Compartilhar…</button>' : ''}
        <button class="btn btn-primary" data-copy>Copiar link</button>
      </div>`);
    $('[data-copy]', m.el).addEventListener('click', () => U.copy(url));
    const n = $('[data-native]', m.el);
    if (n) n.addEventListener('click', () => navigator.share({ title: `${p.name} no Eleva`, url }).catch(() => {}));
  };

  function requestConnection(o) {
    const me = App.me();
    o.connRequests = o.connRequests || [];
    if (o.connRequests.includes(me.id)) return;
    // Se ela já tinha pedido conexão comigo, aceitar vira conexão mútua
    if ((me.connRequests || []).includes(o.id)) return acceptConnection(o.id);
    o.connRequests.push(me.id);
    Store.save();
    U.toast('Pedido de conexão enviado.', 'ok');
    if (o.fictional) {
      setTimeout(() => {
        const oo = Store.user(o.id), mm = Store.user(me.id);
        if (!oo || !mm || !(oo.connRequests || []).includes(mm.id)) return;
        oo.connRequests = oo.connRequests.filter((x) => x !== mm.id);
        if (!oo.connections.includes(mm.id)) oo.connections.push(mm.id);
        if (!mm.connections.includes(oo.id)) mm.connections.push(oo.id);
        Store.save();
        U.toast(`${oo.name} aceitou sua conexão.`, 'ok');
        if (location.hash.includes(oo.id)) App.render();
      }, 2500);
    }
  }
  function acceptConnection(fromId) {
    const me = App.me();
    const o = Store.user(fromId);
    me.connRequests = (me.connRequests || []).filter((x) => x !== fromId);
    if (o && !App.isHidden(o.id)) {
      if (!me.connections.includes(o.id)) me.connections.push(o.id);
      if (!o.connections.includes(me.id)) o.connections.push(me.id);
    }
    Store.save();
  }
  function removeConnection(id) {
    const me = App.me();
    const o = Store.user(id);
    me.connections = me.connections.filter((x) => x !== id);
    if (o) o.connections = o.connections.filter((x) => x !== me.id);
    Store.save();
  }

  Views.profile = ({ params }) => {
    const me = App.me();
    const u = Store.user(params[0]);
    if (!u || App.isHidden(u.id) || App.isContentHidden(u.id)) {
      App.shell('perfil', '<div class="empty">Perfil indisponível.</div>');
      return;
    }
    const own = u.id === me.id;
    if (!own && !App.state.viewed.has(u.id)) {
      App.state.viewed.add(u.id);
      u.profileViews = (u.profileViews || 0) + 1;
      Store.save();
    }
    const following = me.following.includes(u.id);
    const connected = me.connections.includes(u.id);
    const pendingConn = (u.connRequests || []).includes(me.id);
    const showCounts = own || !u.settings.hideFollowers;
    const articles = App.db().articles.filter((a) => a.authorId === u.id).sort((a, b) => b.createdAt - a.createdAt);

    let actions;
    if (own) {
      actions = `<a class="btn btn-primary btn-sm" href="#/config">Editar perfil</a><button class="btn btn-outline btn-sm" id="share">Compartilhar perfil</button>`;
    } else {
      actions = `
        <button class="btn ${following ? 'btn-outline' : 'btn-primary'} btn-sm" id="follow">${following ? 'Seguindo' : 'Seguir'}</button>
        ${connected ? '<span class="tag">✓ Conexão</span>' : `<button class="btn btn-outline btn-sm" id="connect" ${pendingConn ? 'disabled' : ''}>${pendingConn ? 'Pedido enviado' : '+ Conectar'}</button>`}
        <a class="btn btn-outline btn-sm" href="#/zona?nova=${esc(u.id)}">🔒 Mensagem</a>
        <button class="btn btn-outline btn-sm" id="share">Compartilhar perfil</button>
        ${App.menu([{ label: 'Denunciar perfil', data: { act: 'report', type: 'perfil', id: u.id, user: u.id } }, { label: 'Bloquear usuária', danger: true, data: { act: 'block', user: u.id } }].concat(connected ? [{ label: 'Remover conexão', data: { act: 'rm-conn', id: u.id } }] : []))}`;
    }

    App.shell('perfil', `
      <div class="narrow">
        <div class="profile-head">
          ${App.avatar(u, 'lg')}
          <div class="grow">
            <h1>${esc(u.name)}</h1>
            <div class="muted">${esc(u.role)}</div>
            <div class="stats">${showCounts
              ? `<span><b>${u.followers.length}</b> seguidoras</span><span><b>${u.following.length}</b> seguindo</span>${own && u.settings.hideFollowers ? '<span class="tiny muted">(números ocultos para outras pessoas)</span>' : ''}`
              : '<span class="muted small">Números de seguidoras ocultos</span>'}</div>
            ${u.bio ? `<p class="serif">${esc(u.bio)}</p>` : own ? '<p class="muted small">Adicione uma bio em Ajustes.</p>' : ''}
            <div class="row">${actions}</div>
          </div>
        </div>
        ${own ? privatePanel(me) : ''}
        <h2 class="section-title">Artigos</h2>
        ${articles.map((a) => `<div class="list-row"><div class="grow"><a href="#/artigo/${esc(a.id)}" class="serif"><b>${esc(a.title)}</b></a><div class="tiny muted">${U.timeAgo(a.createdAt)} · ♥ ${a.likes.length}</div></div></div>`).join('') || '<p class="muted small">Nenhum artigo publicado ainda.</p>'}
      </div>`);

    $('#share').addEventListener('click', () => Views.shareProfile(u));
    const f = $('#follow');
    if (f) f.addEventListener('click', () => { Views.toggleFollow(u.id); App.render(); });
    const c = $('#connect');
    if (c) c.addEventListener('click', () => { requestConnection(u); App.render(); });
    $('#main').addEventListener('click', (e) => {
      const t = e.target.closest('[data-act], [data-hist], [data-accept-conn], [data-decline-conn]');
      if (!t) return;
      if (t.dataset.act === 'rm-conn') { removeConnection(t.dataset.id); App.render(); }
      else if (t.dataset.hist === 'clear') { me.searchHistory = []; Store.save(); App.render(); }
      else if (t.dataset.hist === 'toggle') { me.settings.saveSearch = !me.settings.saveSearch; if (!me.settings.saveSearch) me.searchHistory = []; Store.save(); App.render(); }
      else if (t.dataset.hist) { me.searchHistory = me.searchHistory.filter((h) => h.q !== t.dataset.hist); Store.save(); App.render(); }
      else if (t.dataset.acceptConn) { acceptConnection(t.dataset.acceptConn); App.render(); }
      else if (t.dataset.declineConn) { me.connRequests = (me.connRequests || []).filter((x) => x !== t.dataset.declineConn); Store.save(); App.render(); }
    });
  };

  function privatePanel(me) {
    const liked = App.db().articles.filter((a) => a.likes.includes(me.id) && !App.isHidden(a.authorId));
    const conns = me.connections.map(Store.user).filter((u) => u && !App.isHidden(u.id));
    const reqs = (me.connRequests || []).map(Store.user).filter((u) => u && !App.isHidden(u.id));
    return `
      <section class="private-panel" aria-label="Painel privado">
        <h2>🔒 Painel privado — só você vê</h2>
        <div class="metric-grid">
          <div class="metric"><b>${me.profileViews || 0}</b><span class="small muted">visualizações do perfil</span></div>
          <div class="metric"><b>${me.followers.length}</b><span class="small muted">seguidoras</span></div>
          <div class="metric"><b>${conns.length}</b><span class="small muted">conexões</span></div>
          <div class="metric"><b>${liked.length}</b><span class="small muted">artigos curtidos</span></div>
        </div>

        ${reqs.length ? `<h3 class="section-title">Pedidos de conexão</h3>${reqs.map((u) => `<div class="list-row">${App.avatar(u, 'sm')}<div class="grow"><a href="#/perfil/${esc(u.id)}"><b>${esc(u.name)}</b></a><div class="tiny muted">${esc(u.role)}</div></div><button class="btn btn-primary btn-sm" data-accept-conn="${esc(u.id)}">Aceitar</button><button class="btn btn-ghost btn-sm" data-decline-conn="${esc(u.id)}">Recusar</button></div>`).join('')}` : ''}

        <h3 class="section-title">Histórico de pesquisas</h3>
        <div class="row between small"><span class="muted">${me.settings.saveSearch ? 'Suas pesquisas ficam salvas só para você.' : 'Histórico pausado: novas pesquisas não são salvas.'}</span>
          <span class="row"><button class="link-btn" data-hist="toggle">${me.settings.saveSearch ? 'Pausar histórico' : 'Retomar histórico'}</button>${me.searchHistory.length ? ' · <button class="link-btn" data-hist="clear">Limpar tudo</button>' : ''}</span></div>
        ${me.searchHistory.map((h) => `<div class="list-row"><a class="grow" href="#/feed?q=${encodeURIComponent(h.q)}">🔎 ${esc(h.q)}</a><span class="tiny muted">${U.timeAgo(h.at)}</span><button class="icon-btn" data-hist="${esc(h.q)}" aria-label="Remover">✕</button></div>`).join('') || '<p class="muted small">Nenhuma pesquisa salva.</p>'}

        <h3 class="section-title">Artigos curtidos · ler depois</h3>
        ${liked.map((a) => `<div class="list-row"><a class="grow serif" href="#/artigo/${esc(a.id)}">${esc(a.title)}</a><span class="tiny muted">${U.readingTime(a.body)} min</span></div>`).join('') || '<p class="muted small">Curta artigos no feed para salvá-los aqui.</p>'}

        <h3 class="section-title">Minhas conexões</h3>
        ${conns.map((u) => `<div class="list-row">${App.avatar(u, 'sm')}<div class="grow"><a href="#/perfil/${esc(u.id)}"><b>${esc(u.name)}</b></a><div class="tiny muted">${esc(u.role)}</div></div><a class="btn btn-ghost btn-sm" href="#/zona?nova=${esc(u.id)}">🔒 Mensagem</a><button class="btn btn-ghost btn-sm" data-act="rm-conn" data-id="${esc(u.id)}">Remover</button></div>`).join('') || '<p class="muted small">Você ainda não tem conexões.</p>'}
      </section>`;
  }
})();
