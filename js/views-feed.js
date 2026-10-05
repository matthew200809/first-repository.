'use strict';
/* Feed estilo Substack: busca, filtros, leitura de artigos, curtidas, comentários e compartilhamento. */
(() => {
  const { esc, $, $$ } = U;
  const CATS = { ciencia: 'Divulgação científica', caso: 'Estudo de caso', autoral: 'Texto autoral' };

  function visibleArticles() {
    return App.db().articles.filter((a) => !App.isHidden(a.authorId) && !App.isContentHidden(a.id));
  }

  function articleCard(a) {
    const author = Store.publicUser(Store.user(a.authorId));
    const liked = a.likes.includes(App.state.meId);
    return `
      <article class="article-card">
        <span class="tag">${esc(CATS[a.category] || 'Artigo')}</span>
        <h2><a href="#/artigo/${esc(a.id)}">${esc(a.title)}</a></h2>
        <div class="sub">${esc(a.subtitle)}</div>
        <div class="byline">${App.avatar(author, 'sm')}<a href="#/perfil/${esc(author.id)}">${esc(author.name)}</a> · ${U.timeAgo(a.createdAt)} · ${U.readingTime(a.body)} min de leitura</div>
        <div class="actions">
          <button class="btn btn-ghost ${liked ? 'liked' : ''}" data-like="${esc(a.id)}" aria-pressed="${liked}" aria-label="${liked ? 'Descurtir' : 'Curtir e salvar para ler depois'}: ${esc(a.title)} (${a.likes.length} curtidas)"><span aria-hidden="true">${liked ? '♥' : '♡'}</span> ${a.likes.length}</button>
          <a class="btn btn-ghost" href="#/artigo/${esc(a.id)}#comentarios" aria-label="Comentários de ${esc(a.title)}: ${a.comments.filter((c) => !App.isHidden(c.userId)).length}"><span aria-hidden="true">💬</span> ${a.comments.filter((c) => !App.isHidden(c.userId)).length}</a>
          <button class="btn btn-ghost" data-share-article="${esc(a.id)}" aria-label="Compartilhar ${esc(a.title)}"><span aria-hidden="true">↗</span> Compartilhar</button>
        </div>
      </article>`;
  }

  function toggleLike(id) {
    const a = App.db().articles.find((x) => x.id === id);
    if (!a) return;
    const me = App.state.meId;
    a.likes = a.likes.includes(me) ? a.likes.filter((x) => x !== me) : [...a.likes, me];
    Store.save();
  }

  function shareArticle(a) {
    const author = Store.publicUser(Store.user(a.authorId));
    const url = `${location.origin}${location.pathname}#/artigo/${a.id}`;
    const m = U.modal(`
      <h2>Compartilhar artigo</h2>
      <div class="card"><div class="tag">${esc(CATS[a.category])}</div><h3 class="serif">${esc(a.title)}</h3><div class="muted small">por ${esc(author.name)} · Eleva</div></div>
      <label class="field"><span>Link</span><input type="text" readonly value="${esc(url)}"></label>
      <div class="modal-actions">
        <button class="btn btn-outline" data-profile>Compartilhar perfil da autora</button>
        ${navigator.share ? '<button class="btn btn-outline" data-native>Compartilhar…</button>' : ''}
        <button class="btn btn-primary" data-copy>Copiar link</button>
      </div>`);
    $('[data-copy]', m.el).addEventListener('click', () => U.copy(url));
    $('[data-profile]', m.el).addEventListener('click', () => { m.close(); Views.shareProfile(Store.user(a.authorId)); });
    const n = $('[data-native]', m.el);
    if (n) n.addEventListener('click', () => navigator.share({ title: a.title, url }).catch(() => {}));
  }

  function bindArticleActions(root, rerender) {
    root.addEventListener('click', (e) => {
      const like = e.target.closest('[data-like]');
      if (like) { toggleLike(like.dataset.like); rerender(); return; }
      const share = e.target.closest('[data-share-article]');
      if (share) shareArticle(App.db().articles.find((x) => x.id === share.dataset.shareArticle));
    });
  }

  /* ---------------- Feed ---------------- */
  Views.feed = ({ query }) => {
    const me = App.me();
    const q = (query.get('q') || '').slice(0, 100);
    const f = query.get('f') || 'todos';
    let list = visibleArticles();
    if (f === 'curtidos') list = list.filter((a) => a.likes.includes(me.id));
    else if (f === 'seguindo') list = list.filter((a) => me.following.includes(a.authorId));
    else if (CATS[f]) list = list.filter((a) => a.category === f);
    if (q) {
      const terms = U.normalize(q).split(/\s+/).filter(Boolean);
      list = list.filter((a) => {
        const hay = U.normalize(`${a.title} ${a.subtitle} ${a.body} ${Store.user(a.authorId)?.name || ''} ${CATS[a.category]}`);
        return terms.every((t) => hay.includes(t));
      });
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    const chip = (key, label) => `<a class="chip ${f === key ? 'active' : ''}" ${f === key ? 'aria-current="true"' : ''} href="#/feed?f=${key}${q ? '&q=' + encodeURIComponent(q) : ''}">${label}</a>`;

    App.shell('feed', `
      <div class="narrow">
        <form class="searchbar" id="search-form" role="search">
          <input type="search" name="q" placeholder="Buscar artigos, autoras e palavras-chave" value="${esc(q)}" maxlength="100" aria-label="Buscar">
          <button class="btn btn-primary">Buscar</button>
        </form>
        <div class="row between">
          <div class="chips" role="navigation" aria-label="Filtrar artigos">
            ${chip('todos', 'Todos')}${chip('seguindo', 'Seguindo')}${chip('ciencia', 'Divulgação científica')}${chip('caso', 'Estudos de caso')}${chip('autoral', 'Textos autorais')}${chip('curtidos', '♥ Curtidos · ler depois')}
          </div>
        </div>
        <div class="row between">
          <p class="muted small">${q ? `${list.length} resultado(s) para “${esc(q)}”` : f === 'curtidos' ? 'Artigos que você curtiu ficam salvos aqui para ler depois.' : ''}</p>
          <a class="btn btn-outline btn-sm" href="#/escrever">✎ Escrever artigo</a>
        </div>
        <h1 class="sr-only">Feed de artigos</h1>
        <div id="list">${list.map(articleCard).join('') || `<div class="empty">${f === 'curtidos' ? 'Você ainda não curtiu nenhum artigo.' : 'Nenhum artigo encontrado.'}</div>`}</div>
      </div>`);

    $('#search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const term = e.target.q.value.trim().slice(0, 100);
      if (term && me.settings.saveSearch) {
        me.searchHistory = [{ q: term, at: Date.now() }, ...me.searchHistory.filter((h) => h.q !== term)].slice(0, 30);
        Store.save();
      }
      App.nav(`#/feed?f=${f}${term ? '&q=' + encodeURIComponent(term) : ''}`);
    });
    bindArticleActions($('#list'), () => App.render());
    if (query.get('focus') === 'busca') $('#search-form input').focus();
  };

  /* ---------------- Leitura do artigo ---------------- */
  Views.article = ({ params }) => {
    const a = App.db().articles.find((x) => x.id === params[0]);
    if (!a || App.isHidden(a.authorId) || App.isContentHidden(a.id)) {
      App.shell('feed', '<div class="empty">Este artigo não está disponível.</div>');
      return;
    }
    const me = App.me();
    const author = Store.user(a.authorId);
    const pub = Store.publicUser(author);
    const liked = a.likes.includes(me.id);
    const following = me.following.includes(a.authorId);
    const comments = a.comments.filter((c) => !App.isHidden(c.userId) && !App.isContentHidden(c.id));
    App.shell('feed', `
      <article class="reader">
        <div class="row between"><a href="#/feed" class="small">← Voltar ao feed</a>${App.contentMenu('artigo', a.id, a.authorId, { onDelete: 'del-article' })}</div>
        <span class="tag">${esc(CATS[a.category])}</span>
        <h1>${esc(a.title)}</h1>
        <p class="sub">${esc(a.subtitle)}</p>
        <div class="row between">
          <div class="byline">${App.avatar(pub)}<div><a href="#/perfil/${esc(pub.id)}">${esc(pub.name)}</a><div class="tiny">${esc(pub.role)} · ${U.timeAgo(a.createdAt)} · ${U.readingTime(a.body)} min</div></div></div>
          ${author && a.authorId !== me.id ? `<button class="btn ${following ? 'btn-outline' : 'btn-primary'} btn-sm" id="follow">${following ? 'Seguindo' : 'Seguir'}</button>` : ''}
        </div>
        <div class="actions" id="art-actions">
          <button class="btn btn-ghost ${liked ? 'liked' : ''}" data-like="${esc(a.id)}">${liked ? '♥ Curtido' : '♡ Curtir'} · ${a.likes.length}</button>
          <button class="btn btn-ghost" data-share-article="${esc(a.id)}">↗ Compartilhar artigo</button>
          ${author ? '<button class="btn btn-ghost" id="share-author">Compartilhar perfil da autora</button>' : ''}
        </div>
        <div class="body">${U.paragraphs(a.body)}</div>
        <h2 class="section-title" id="comentarios">Comentários (${comments.length})</h2>
        <form id="comment-form">
          <textarea name="text" placeholder="Escreva um comentário respeitoso…" maxlength="1000" required></textarea>
          <div class="row between"><span class="tiny muted">Evite publicar dados pessoais. CPF e celular são bloqueados em áreas abertas.</span><button class="btn btn-primary btn-sm">Comentar</button></div>
        </form>
        <div id="comments">${comments.map((c) => {
          const u = Store.publicUser(Store.user(c.userId));
          return `<div class="comment">${App.avatar(u, 'sm')}<div class="grow"><div class="row between"><span><a class="who" href="#/perfil/${esc(u.id)}">${esc(u.name)}</a> <span class="tiny muted">${U.timeAgo(c.at)}</span></span>${App.contentMenu('comentario', c.id, c.userId, { onDelete: 'del-comment' })}</div><p>${esc(c.text)}</p></div></div>`;
        }).join('') || '<p class="muted small">Seja a primeira a comentar.</p>'}</div>
      </article>`);

    bindArticleActions($('#art-actions'), () => App.render());
    const f = $('#follow');
    if (f) f.addEventListener('click', () => { Views.toggleFollow(a.authorId); App.render(); });
    const sa = $('#share-author');
    if (sa) sa.addEventListener('click', () => Views.shareProfile(author));
    $('#comment-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = e.target.text.value.trim();
      if (!text) return;
      if (!App.guardPublic(text) || !App.guardRate('comment', { max: 5, windowMs: 60000, minGapMs: 5000 })) return;
      a.comments.push({ id: U.uid('c'), userId: me.id, text: text.slice(0, 1000), at: Date.now() });
      Store.save();
      App.render();
    });
    $('#main').addEventListener('click', async (e) => {
      const t = e.target.closest('[data-act="del-comment"], [data-act="del-article"]');
      if (!t) return;
      if (t.dataset.act === 'del-comment') {
        a.comments = a.comments.filter((c) => !(c.id === t.dataset.id && c.userId === me.id));
        Store.save(); App.render();
      } else if (await U.confirmDialog('Excluir artigo?', 'Esta ação não pode ser desfeita.', { okLabel: 'Excluir', danger: true })) {
        App.db().articles = App.db().articles.filter((x) => !(x.id === a.id && x.authorId === me.id));
        Store.save(); App.nav('#/feed');
      }
    });
  };

  /* ---------------- Escrever ---------------- */
  Views.write = () => {
    App.shell('feed', `
      <div class="narrow">
        <a href="#/feed" class="small">← Voltar</a>
        <h1 class="page-title">Escrever artigo</h1>
        <p class="muted">Compartilhe sua experiência, um estudo de caso ou uma leitura científica.</p>
        <form id="write-form">
          <label class="field"><span>Título</span><input type="text" name="title" required maxlength="140" class="serif"></label>
          <label class="field"><span>Subtítulo</span><input type="text" name="subtitle" maxlength="200"></label>
          <label class="field"><span>Categoria</span><select name="category">
            <option value="autoral">Texto autoral</option><option value="caso">Estudo de caso</option><option value="ciencia">Divulgação científica</option>
          </select></label>
          <label class="field"><span>Texto</span><textarea name="body" required maxlength="20000" rows="14" class="serif" placeholder="Separe parágrafos com uma linha em branco."></textarea></label>
          <p class="tiny muted">Em divulgação científica, cite as fontes. Não publique dados pessoais (CPF, celular) nem informações confidenciais de empresas.</p>
          <div class="row"><button class="btn btn-primary">Publicar</button><a class="btn btn-ghost" href="#/feed">Cancelar</a></div>
        </form>
      </div>`);
    $('#write-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const title = f.title.value.trim(), subtitle = f.subtitle.value.trim(), body = f.body.value.trim();
      if (title.length < 5 || body.length < 50) return U.toast('Escreva um título e um texto com pelo menos 50 caracteres.', 'error');
      if (!['autoral', 'caso', 'ciencia'].includes(f.category.value)) return;
      if (!App.guardPublic(title, subtitle, body) || !App.guardRate('article', { max: 3, windowMs: 600000, minGapMs: 30000 })) return;
      const a = { id: U.uid('a'), authorId: App.state.meId, category: f.category.value, title, subtitle, body, createdAt: Date.now(), likes: [], comments: [] };
      App.db().articles.push(a);
      Store.save();
      U.toast('Artigo publicado!', 'ok');
      App.nav(`#/artigo/${a.id}`);
    });
  };
})();
