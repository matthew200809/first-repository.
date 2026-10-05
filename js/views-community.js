'use strict';
/* Comunidade: perguntas e respostas (com opção anônima) e salas de bate-papo por tema. */
(() => {
  const { esc, $ } = U;

  const ROOM_RULES = [
    'Respeito sempre: sem ataques pessoais, assédio ou discriminação.',
    'Não publique CPF, celular, endereço ou outros dados pessoais. Para trocar contatos, use a Zona Segura.',
    'Nada de spam, correntes ou venda não solicitada.',
    'O que é compartilhado aqui fica aqui: não divulgue conversas da sala fora do Eleva.',
    'Viu algo errado? Use “Denunciar” no menu ••• da mensagem. A denúncia é confidencial.',
  ];

  function authorOf(q) {
    if (q.anonymous) return { id: '', name: 'Anônima', role: '', anonymous: true };
    return Store.publicUser(Store.user(q.authorId));
  }

  /* ---------------- Lista: Q&A e Salas ---------------- */
  Views.community = ({ query }) => {
    const tab = query.get('tab') === 'salas' ? 'salas' : 'qa';
    const d = App.db();
    let body;
    if (tab === 'qa') {
      const list = d.questions
        .filter((q) => !App.isContentHidden(q.id) && (q.anonymous || !App.isHidden(q.authorId)))
        .sort((a, b) => b.at - a.at);
      body = `
        <div class="row between"><p class="muted">Lance dúvidas sobre o mercado corporativo. Outras líderes respondem.</p><button class="btn btn-primary btn-sm" id="ask">Fazer pergunta</button></div>
        ${list.map((q) => {
          const a = authorOf(q);
          const n = q.answers.filter((x) => !App.isHidden(x.userId)).length;
          return `<a class="q-card" href="#/pergunta/${esc(q.id)}"><h3>${esc(q.title)}</h3><div class="byline">${App.avatar(a, 'sm')} ${esc(a.name)} · ${U.timeAgo(q.at)} · ${n} resposta${n === 1 ? '' : 's'}</div></a>`;
        }).join('') || '<div class="empty">Nenhuma pergunta ainda.</div>'}`;
    } else {
      body = `
        <p class="muted">Salas de bate-papo abertas por tema. Leia as regras antes de participar.</p>
        <div class="room-grid">${d.rooms.map((r) => `
          <a class="room-card" href="#/sala/${esc(r.id)}"><h3># ${esc(r.name)}</h3><p class="small muted">${esc(r.desc)}</p><span class="tiny muted">${r.messages.length} mensagens</span></a>`).join('')}
        </div>`;
    }
    App.shell('comunidade', `
      <h1 class="page-title">Comunidade</h1>
      <nav class="tabs"><a href="#/comunidade?tab=qa" class="${tab === 'qa' ? 'active' : ''}">Perguntas e Respostas</a><a href="#/comunidade?tab=salas" class="${tab === 'salas' ? 'active' : ''}">Chat por temas</a></nav>
      ${body}`);
    const ask = $('#ask');
    if (ask) ask.addEventListener('click', askModal);
  };

  function askModal() {
    const m = U.modal(`
      <h2>Fazer pergunta</h2>
      <form data-f>
        <label class="field"><span>Pergunta</span><input type="text" name="title" required maxlength="160" placeholder="Seja clara e objetiva"></label>
        <label class="field"><span>Detalhes</span><textarea name="body" maxlength="2000" placeholder="Dê contexto, sem expor pessoas ou empresas."></textarea></label>
        <label class="check"><input type="checkbox" name="anon"> <span><b>Perguntar anonimamente</b><br><span class="tiny muted">Seu nome e foto não aparecem para ninguém. A autoria só é consultada pela moderação em caso de denúncia grave.</span></span></label>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Publicar pergunta</button></div>
      </form>`);
    $('[data-f]', m.el).addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const title = f.title.value.trim(), body = f.body.value.trim();
      if (title.length < 10) return U.toast('Escreva uma pergunta com pelo menos 10 caracteres.', 'error');
      if (!App.guardPublic(title, body) || !App.guardRate('question', { max: 3, windowMs: 300000, minGapMs: 20000 })) return;
      const q = { id: U.uid('q'), authorId: App.state.meId, anonymous: f.anon.checked, title, body, at: Date.now(), answers: [] };
      App.db().questions.push(q);
      Store.save();
      m.close();
      App.nav(`#/pergunta/${q.id}`);
    });
  }

  /* ---------------- Pergunta ---------------- */
  Views.question = ({ params }) => {
    const d = App.db();
    const me = App.me();
    const q = d.questions.find((x) => x.id === params[0]);
    if (!q || App.isContentHidden(q.id) || (!q.anonymous && App.isHidden(q.authorId))) {
      App.shell('comunidade', '<div class="empty">Esta pergunta não está disponível.</div>');
      return;
    }
    const a = authorOf(q);
    const mine = q.authorId === me.id;
    const answers = q.answers.filter((x) => !App.isHidden(x.userId) && !App.isContentHidden(x.id))
      .sort((x, y) => y.useful.length - x.useful.length || x.at - y.at);
    const top = answers.length && answers[0].useful.length ? answers[0].id : null;
    App.shell('comunidade', `
      <div class="narrow">
        <div class="row between"><a href="#/comunidade?tab=qa" class="small">← Perguntas</a>
          ${mine ? App.contentMenu('pergunta', q.id, me.id, { onDelete: 'del-question' }) : App.menu([{ label: 'Denunciar', data: { act: 'report', type: 'pergunta', id: q.id, user: q.anonymous ? '' : q.authorId } }].concat(q.anonymous ? [] : [{ label: 'Bloquear usuária', danger: true, data: { act: 'block', user: q.authorId } }]))}
        </div>
        <h1 class="page-title">${esc(q.title)}</h1>
        <div class="byline">${App.avatar(a, 'sm')} ${a.anonymous ? 'Anônima' : `<a href="#/perfil/${esc(a.id)}">${esc(a.name)}</a>`} · ${U.timeAgo(q.at)}${mine && q.anonymous ? ' · <span class="tag">você perguntou anonimamente</span>' : ''}</div>
        ${q.body ? `<div class="card"><p class="serif">${esc(q.body)}</p></div>` : ''}
        <h2 class="section-title">${answers.length} resposta${answers.length === 1 ? '' : 's'}</h2>
        <div id="answers">${answers.map((x) => {
          const u = Store.publicUser(Store.user(x.userId));
          const marked = x.useful.includes(me.id);
          const own = x.userId === me.id;
          return `<div class="answer ${x.id === top ? 'top' : ''}">
            <div class="row between"><div class="byline">${App.avatar(u, 'sm')}<a href="#/perfil/${esc(u.id)}">${esc(u.name)}</a> · ${U.timeAgo(x.at)}${x.id === top ? ' · <span class="tag">Mais útil</span>' : ''}</div>${App.contentMenu('resposta', x.id, x.userId, { onDelete: 'del-answer' })}</div>
            <p>${esc(x.text)}</p>
            <button class="btn btn-ghost btn-sm ${marked ? 'liked' : ''}" data-useful="${esc(x.id)}" ${own ? 'disabled title="Você não pode marcar sua própria resposta"' : ''}>👍 Útil · ${x.useful.length}</button>
          </div>`;
        }).join('') || '<p class="muted">Ainda sem respostas. Que tal ajudar?</p>'}</div>
        <form id="answer-form" class="stack">
          <textarea name="text" placeholder="Compartilhe sua experiência…" maxlength="3000" required></textarea>
          <div class="row between"><span class="tiny muted">Respostas respeitosas e sem dados pessoais.</span><button class="btn btn-primary btn-sm">Responder</button></div>
        </form>
      </div>`);

    $('#answer-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = e.target.text.value.trim();
      if (!text) return;
      if (!App.guardPublic(text) || !App.guardRate('answer', { max: 5, windowMs: 60000, minGapMs: 8000 })) return;
      q.answers.push({ id: U.uid('ans'), userId: me.id, text: text.slice(0, 3000), at: Date.now(), useful: [] });
      Store.save();
      App.render();
    });
    $('#main').addEventListener('click', async (e) => {
      const u = e.target.closest('[data-useful]');
      if (u) {
        const ans = q.answers.find((x) => x.id === u.dataset.useful);
        if (!ans || ans.userId === me.id) return;
        ans.useful = ans.useful.includes(me.id) ? ans.useful.filter((x) => x !== me.id) : [...ans.useful, me.id];
        Store.save(); App.render();
        return;
      }
      const t = e.target.closest('[data-act="del-answer"], [data-act="del-question"]');
      if (!t) return;
      if (t.dataset.act === 'del-answer') {
        q.answers = q.answers.filter((x) => !(x.id === t.dataset.id && x.userId === me.id));
        Store.save(); App.render();
      } else if (await U.confirmDialog('Excluir pergunta?', 'A pergunta e as respostas serão removidas.', { okLabel: 'Excluir', danger: true })) {
        d.questions = d.questions.filter((x) => !(x.id === q.id && x.authorId === me.id));
        Store.save(); App.nav('#/comunidade?tab=qa');
      }
    });
  };

  /* ---------------- Sala de bate-papo ---------------- */
  Views.room = ({ params }) => {
    const me = App.me();
    const room = App.db().rooms.find((r) => r.id === params[0]);
    if (!room) { App.shell('comunidade', '<div class="empty">Sala não encontrada.</div>'); return; }
    const seenRules = (me.seenRules || []).includes(room.id);
    const msgs = room.messages.filter((m) => !App.isHidden(m.userId) && !App.isContentHidden(m.id));
    App.shell('comunidade', `
      <div class="narrow">
        <a href="#/comunidade?tab=salas" class="small">← Salas</a>
        <h1 class="page-title"># ${esc(room.name)}</h1>
        <p class="muted">${esc(room.desc)}</p>
        <details class="rules" ${seenRules ? '' : 'open'} id="rules"><summary>Regras da sala</summary><ol>${ROOM_RULES.map((r) => `<li>${esc(r)}</li>`).join('')}</ol></details>
        <div class="chat" id="chat">${msgs.map((m) => {
          const u = Store.publicUser(Store.user(m.userId));
          const mine = m.userId === me.id;
          return `<div class="msg ${mine ? 'mine' : ''}">
            ${mine ? '' : `<div class="meta"><a href="#/perfil/${esc(u.id)}"><b>${esc(u.name)}</b></a></div>`}
            <div class="bubble">${esc(m.text)}</div>
            <div class="meta">${U.timeAgo(m.at)} ${App.contentMenu('mensagem-sala', m.id, m.userId, { onDelete: 'del-room-msg' })}</div>
          </div>`;
        }).join('') || '<p class="muted center">Nenhuma mensagem ainda.</p>'}</div>
        <form class="composer" id="room-form">
          <textarea name="text" placeholder="Mensagem para #${esc(room.name)}" maxlength="1000" aria-label="Mensagem"></textarea>
          <button class="btn btn-primary">Enviar</button>
        </form>
      </div>`);
    const chat = $('#chat');
    chat.scrollTop = chat.scrollHeight;
    $('#rules').addEventListener('toggle', (e) => {
      if (!e.target.open && !seenRules) { me.seenRules = [...(me.seenRules || []), room.id]; Store.save(); }
    });
    const form = $('#room-form');
    const send = () => {
      const text = form.text.value.trim();
      if (!text) return;
      if (!App.guardPublic(text) || !App.guardRate(`room:${room.id}`, { max: 6, windowMs: 30000, minGapMs: 2000 })) return;
      room.messages.push({ id: U.uid('rm'), userId: me.id, text: text.slice(0, 1000), at: Date.now() });
      room.messages = room.messages.slice(-300);
      Store.save();
      App.render();
    };
    form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
    form.text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    chat.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act="del-room-msg"]');
      if (!t) return;
      room.messages = room.messages.filter((m) => !(m.id === t.dataset.id && m.userId === me.id));
      Store.save(); App.render();
    });
  };
})();
