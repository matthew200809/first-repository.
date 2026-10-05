'use strict';
/* Ajustes: perfil, segurança da conta, privacidade, Zona Segura, notificações, bloqueios e direitos LGPD. */
(() => {
  const { esc, $, $$ } = U;
  const TIMERS = [[0, 'Desligadas'], [3600, '1 hora'], [86400, '24 horas'], [604800, '7 dias']];

  const toggle = (id, checked, label, hint) => `
    <div class="toggle-row"><div><div>${label}</div>${hint ? `<div class="tiny muted">${hint}</div>` : ''}</div>
    <label class="switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span></span><span class="sr-only">${label}</span></label></div>`;

  Views.settings = ({ query }) => {
    const me = App.me();
    const s = me.settings;
    const blocked = me.blocked.map(Store.user).filter(Boolean);
    App.shell('config', `
      <h1 class="page-title">Ajustes</h1>
      <div class="settings-grid">
        <nav class="settings-nav">
          <a href="#/config#perfil">Editar perfil</a><a href="#/config#seguranca">Conta e segurança</a><a href="#/config#privacidade">Privacidade</a>
          <a href="#/config#zona">Zona Segura</a><a href="#/config#notificacoes">Notificações</a><a href="#/config#acessibilidade">Acessibilidade</a><a href="#/config#bloqueadas">Bloqueadas</a><a href="#/config#dados">Seus dados (LGPD)</a>
        </nav>
        <div>
          <section class="settings-section" id="perfil">
            <h2>Editar perfil</h2>
            <div class="row">${App.avatar(me, 'lg')}
              <div><label class="btn btn-outline btn-sm" for="photo">Trocar foto</label><input type="file" id="photo" accept="image/jpeg,image/png,image/webp" class="sr-only">
              ${me.photo ? ' <button class="btn btn-ghost btn-sm" id="rm-photo">Remover</button>' : ''}
              <div class="tiny muted">JPG, PNG ou WebP até 5 MB. Removemos a localização e outros metadados da imagem.</div></div>
            </div>
            <form id="profile-form" class="stack">
              <label class="field"><span>Nome completo</span><input type="text" name="name" value="${esc(me.name)}" required maxlength="80"></label>
              <label class="field"><span>Cargo / Empresa</span><input type="text" name="role" value="${esc(me.role)}" required maxlength="100"></label>
              <label class="field"><span>Bio</span><textarea name="bio" maxlength="280">${esc(me.bio)}</textarea></label>
              <button class="btn btn-primary">Salvar perfil</button>
            </form>
          </section>

          <section class="settings-section" id="seguranca">
            <h2>Conta e segurança</h2>
            <p class="small muted">E-mail: <b>${esc(me.email)}</b> ${me.emailVerified ? '<span class="tag lock">verificado</span>' : ''}</p>
            <button class="btn btn-outline btn-sm" id="change-pw">Alterar senha</button>
            ${protectionHtml(me)}
            ${mfaHtml(me)}
            <div class="toggle-row"><div><div>Saída automática</div><div class="tiny muted">Por segurança, você é desconectada após 15 minutos sem uso.</div></div><span class="tag">Sempre ativa</span></div>
            <h3 class="section-title">Sessões ativas</h3>
            ${me.sessions.map((x) => `<div class="list-row"><div class="grow"><b>${esc(x.device)}</b> ${x.id === App.state.sid ? '<span class="tag lock">esta sessão</span>' : ''}<div class="tiny muted">Iniciada ${U.fullDate(x.createdAt)}</div></div></div>`).join('')}
            <button class="btn btn-danger btn-sm" id="end-others" ${me.sessions.length < 2 ? 'disabled' : ''}>Encerrar outras sessões</button>
            <button class="btn btn-ghost btn-sm" id="logout">Sair desta conta</button>
          </section>

          <section class="settings-section" id="privacidade">
            <h2>Privacidade</h2>
            ${toggle('hide-followers', s.hideFollowers, 'Ocultar número de seguidoras', 'Outras pessoas não verão quantas seguidoras e quantas pessoas você segue.')}
            ${toggle('save-search', s.saveSearch, 'Salvar histórico de pesquisas', 'O histórico é visível só para você. Ao desligar, o histórico atual é apagado.')}
            <div class="toggle-row"><div><div>Métricas do perfil</div><div class="tiny muted">Visualizações, curtidas e conexões são sempre privadas.</div></div><span class="tag">Só você vê</span></div>
          </section>

          <section class="settings-section" id="zona">
            <h2>Zona Segura</h2>
            <label class="field"><span>Quem pode me enviar pedidos de mensagem</span>
              <select id="dm-policy"><option value="requests" ${s.dmPolicy === 'requests' ? 'selected' : ''}>Qualquer usuária (como pedido, que eu aceito ou recuso)</option><option value="none" ${s.dmPolicy === 'none' ? 'selected' : ''}>Somente minhas conexões</option></select></label>
            <label class="field"><span>Mensagens temporárias em novas conversas</span>
              <select id="def-timer">${TIMERS.map(([v, l]) => `<option value="${v}" ${s.defaultTimer === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            ${toggle('discreet', s.discreet, 'Modo discreto', 'Borra nomes e mensagens na tela até você passar o mouse ou tocar.')}
            <div class="toggle-row"><div><div>PIN de acesso</div><div class="tiny muted">${me.zonePin ? 'Ativo: a Zona Segura pede o PIN a cada sessão.' : 'Peça um PIN de 4 a 8 números para abrir a Zona Segura.'}</div></div>
              <span class="row">${me.zonePin ? '<button class="btn btn-outline btn-sm" id="pin-set">Trocar PIN</button><button class="btn btn-ghost btn-sm" id="pin-rm">Remover</button>' : '<button class="btn btn-outline btn-sm" id="pin-set">Criar PIN</button>'}</span></div>
            <p class="tiny muted">Dica: na Zona Segura, o botão “Saída rápida” (ou Esc duas vezes) esconde as conversas na hora.</p>
          </section>

          <section class="settings-section" id="notificacoes">
            <h2>Notificações</h2>
            ${toggle('n-follows', s.notif.follows, 'Novas seguidoras')}
            ${toggle('n-comments', s.notif.comments, 'Comentários nos meus artigos')}
            ${toggle('n-answers', s.notif.answers, 'Respostas às minhas perguntas')}
            ${toggle('n-dms', s.notif.dms, 'Mensagens na Zona Segura', 'A notificação nunca mostra o conteúdo nem o nome de quem enviou.')}
            ${toggle('n-digest', s.notif.digest, 'Resumo semanal por e-mail')}
            <div class="toggle-row"><div><div>Alertas de segurança</div><div class="tiny muted">Novo acesso, troca de senha e exclusão de conta.</div></div><span class="tag">Sempre ativos</span></div>
          </section>

          <section class="settings-section" id="acessibilidade">
            <h2>Acessibilidade e aparência</h2>
            <p class="small muted">Modo escuro, tamanho do texto, alto contraste, fonte de leitura fácil, espaçamento, links sublinhados e menos animações.</p>
            <div class="row"><button class="btn btn-outline btn-sm" data-tool="a11y">Abrir preferências de acessibilidade</button><button class="btn btn-ghost btn-sm" data-tool="help">Ver atalhos de teclado</button><button class="btn btn-ghost btn-sm" id="tour">Refazer o tour</button></div>
          </section>

          <section class="settings-section" id="bloqueadas">
            <h2>Usuárias bloqueadas</h2>
            ${blocked.map((u) => `<div class="list-row">${App.avatar(u, 'sm')}<div class="grow"><b>${esc(u.name)}</b></div><button class="btn btn-ghost btn-sm" data-unblock="${esc(u.id)}">Desbloquear</button></div>`).join('') || '<p class="muted small">Você não bloqueou ninguém.</p>'}
          </section>

          <section class="settings-section" id="dados">
            <h2>Seus dados (LGPD)</h2>
            <p class="small muted">Você aceitou os termos em ${U.fullDate(me.termsAcceptedAt)}. <a href="#/termos">Termos de Uso</a> · <a href="#/privacidade">Política de Privacidade</a></p>
            <div class="row"><button class="btn btn-outline btn-sm" id="my-data">Ver e copiar meus dados</button><button class="btn btn-danger btn-sm" id="delete-account">Excluir minha conta</button></div>
          </section>
        </div>
      </div>`);

    $$('[data-pct]').forEach((i) => { i.style.width = `${i.dataset.pct}%`; });
    const save = () => Store.save();
    const bindToggle = (id, fn) => $(`#${id}`).addEventListener('change', (e) => { fn(e.target.checked); save(); U.toast('Preferência salva'); });

    /* Perfil */
    $('#profile-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const name = f.name.value.trim().replace(/\s+/g, ' '), role = f.role.value.trim(), bio = f.bio.value.trim();
      if (name.length < 3) return U.toast('Informe seu nome completo.', 'error');
      if (!App.guardPublic(name, role, bio)) return;
      Object.assign(me, { name, role, bio: bio.slice(0, 280) });
      save(); U.toast('Perfil atualizado', 'ok'); App.render();
    });
    $('#photo').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        me.photo = await Sec.stripImageMetadata(file);
        save(); U.toast('Foto atualizada. Localização e metadados removidos.', 'ok'); App.render();
      } catch (err) { U.toast(err.message, 'error'); }
    });
    const rmPhoto = $('#rm-photo');
    if (rmPhoto) rmPhoto.addEventListener('click', () => { me.photo = null; save(); App.render(); });

    /* Segurança */
    $('#change-pw').addEventListener('click', changePassword);
    const mfaRoot = $('#mfa');
    mfaRoot.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-mfa]');
      if (!a) return;
      if (a.dataset.mfa === 'setup') setupMfa();
      else if (a.dataset.mfa === 'backup') regenerateBackup();
      else if (a.dataset.mfa === 'off') disableMfa();
    });
    $('#tour').addEventListener('click', () => A11y.openTour());
    if (query.get('ativar') === '2fa' && !me.mfa) { history.replaceState(null, '', '#/config'); $('#seguranca').scrollIntoView(); setTimeout(setupMfa, 300); }
    $('#end-others').addEventListener('click', async () => {
      if (!(await App.requireReauth('Para encerrar as outras sessões.'))) return;
      me.sessions = me.sessions.filter((x) => x.id === App.state.sid);
      save(); U.toast('Outras sessões encerradas.', 'ok'); App.render();
    });
    $('#logout').addEventListener('click', () => App.logout('Você saiu da sua conta.'));

    /* Privacidade */
    bindToggle('hide-followers', (v) => { s.hideFollowers = v; });
    bindToggle('save-search', (v) => { s.saveSearch = v; if (!v) me.searchHistory = []; });

    /* Zona Segura */
    $('#dm-policy').addEventListener('change', (e) => { if (['requests', 'none'].includes(e.target.value)) { s.dmPolicy = e.target.value; save(); U.toast('Preferência salva'); } });
    $('#def-timer').addEventListener('change', (e) => { const v = Number(e.target.value); if (TIMERS.some((t) => t[0] === v)) { s.defaultTimer = v; save(); U.toast('Preferência salva'); } });
    bindToggle('discreet', (v) => { s.discreet = v; });
    $('#pin-set').addEventListener('click', setPin);
    const pinRm = $('#pin-rm');
    if (pinRm) pinRm.addEventListener('click', async () => {
      if (!(await App.requireReauth('Para remover o PIN da Zona Segura.'))) return;
      me.zonePin = null; save(); U.toast('PIN removido'); App.render();
    });

    /* Notificações */
    [['n-follows', 'follows'], ['n-comments', 'comments'], ['n-answers', 'answers'], ['n-dms', 'dms'], ['n-digest', 'digest']]
      .forEach(([id, k]) => bindToggle(id, (v) => { s.notif[k] = v; }));

    /* Bloqueadas */
    $('#bloqueadas').addEventListener('click', (e) => {
      const id = e.target.dataset.unblock;
      if (!id) return;
      me.blocked = me.blocked.filter((x) => x !== id);
      App.db().convos.filter((c) => c.status === 'blocked' && c.members.includes(id) && c.members.includes(me.id)).forEach((c) => { c.status = 'active'; });
      save(); U.toast('Usuária desbloqueada'); App.render();
    });

    /* LGPD */
    $('#my-data').addEventListener('click', showMyData);
    $('#delete-account').addEventListener('click', deleteAccount);
  };

  /* ---------- Nível de proteção da conta ---------- */
  function protectionHtml(me) {
    const items = [
      [me.emailVerified, 'E-mail confirmado'],
      [true, 'Senha forte (exigida pelo Eleva)'],
      [!!me.mfa, 'Verificação em duas etapas ativada'],
      [!!me.mfa && (me.mfa.backup || []).length >= 3, 'Códigos de backup guardados'],
      [!!me.zonePin, 'PIN na Zona Segura'],
      [me.sessions.length <= 1, 'Nenhuma outra sessão aberta'],
    ];
    const done = items.filter((i) => i[0]).length;
    const pct = Math.round((done / items.length) * 100);
    const level = pct >= 80 ? 'Alto' : pct >= 50 ? 'Médio' : 'Baixo';
    return `
      <div class="protect" role="group" aria-label="Nível de proteção da conta">
        <div class="row between"><b>Nível de proteção: ${level}</b><span class="small muted">${done} de ${items.length}</span></div>
        <div class="protect-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Proteção da conta"><i data-pct="${pct}"></i></div>
        <ul>${items.map(([ok, l]) => `<li><span class="st ${ok ? 'ok' : 'no'}" aria-hidden="true">${ok ? '✓' : '!'}</span><span>${esc(l)}<span class="sr-only">: ${ok ? 'feito' : 'pendente'}</span></span></li>`).join('')}</ul>
      </div>`;
  }

  /* ---------- Verificação em duas etapas ---------- */
  function mfaHtml(me) {
    const m = me.mfa;
    if (!m) {
      return `<div id="mfa" class="card white">
        <div class="row between"><h3 class="serif">Verificação em duas etapas</h3><span class="tag warn">Desativada</span></div>
        <p class="small">Além da senha, o Eleva pede um código que só você tem. <b>Mesmo que sua senha vaze, ninguém entra na sua conta.</b> É a proteção mais importante que você pode ativar.</p>
        <button class="btn btn-primary btn-sm" data-mfa="setup">Ativar verificação em duas etapas</button>
      </div>`;
    }
    const left = (m.backup || []).length;
    return `<div id="mfa" class="card white">
      <div class="row between"><h3 class="serif">Verificação em duas etapas</h3><span class="tag lock">Ativada</span></div>
      <p class="small">Método: <b>${m.method === 'totp' ? 'app autenticador' : 'código por e-mail'}</b> · ativada em ${U.fullDate(m.enabledAt)}</p>
      <p class="small">Códigos de backup: <b>${left}</b> restante${left === 1 ? '' : 's'} ${left <= 2 ? '<span class="tag warn">gere novos</span>' : ''}</p>
      <div class="row">
        <button class="btn btn-outline btn-sm" data-mfa="setup">Trocar método</button>
        <button class="btn btn-outline btn-sm" data-mfa="backup">Gerar novos códigos de backup</button>
        <button class="btn btn-danger btn-sm" data-mfa="off">Desativar</button>
      </div>
    </div>`;
  }

  async function makeBackup(me) {
    const codes = Sec.newBackupCodes();
    me.mfa.backup = await Promise.all(codes.map((c) => Sec.sha256Hex(`backup:${me.id}:${Sec.normBackup(c)}`)));
    return codes;
  }
  function backupStep(codes, onDone) {
    return `
      <h2>Guarde seus códigos de backup</h2>
      <p class="small">Se você perder o celular, use um destes códigos para entrar. <b>Cada um funciona uma vez.</b> Guarde num lugar seguro (gerenciador de senhas ou papel). Eles não serão mostrados de novo.</p>
      <div class="backup-grid" aria-label="Códigos de backup">${codes.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
      <label class="check"><input type="checkbox" id="saved-codes"> <span>Guardei meus códigos de backup em um lugar seguro</span></label>
      <div class="modal-actions"><button class="btn btn-outline" data-copy-codes>Copiar códigos</button><button class="btn btn-primary" data-finish disabled>Concluir</button></div>`;
  }
  function bindBackupStep(m, codes, onDone) {
    $('[data-copy-codes]', m.el).addEventListener('click', () => U.copy(codes.join('\n')));
    const chk = $('#saved-codes', m.el), fin = $('[data-finish]', m.el);
    chk.addEventListener('change', () => { fin.disabled = !chk.checked; });
    fin.addEventListener('click', onDone);
  }

  async function setupMfa() {
    if (!(await App.requireReauth('Para configurar a verificação em duas etapas.'))) return;
    const me = App.me();
    const state = { method: 'totp', secret: Sec.newTotpSecret() };
    const m = U.modal('<div data-wiz></div>', { wide: true });
    const wiz = () => $('[data-wiz]', m.el);
    const steps = (n) => `<div class="steps" aria-hidden="true">${[1, 2, 3].map((i) => `<span class="${i <= n ? 'on' : ''}"></span>`).join('')}</div><p class="tiny muted">Passo ${n} de 3</p>`;
    const setTitle = () => { const h = $('h2', m.el); if (h) h.id = m.el.getAttribute('aria-labelledby'); };

    const step1 = () => {
      wiz().innerHTML = `${steps(1)}
        <h2>Por que ativar a verificação em duas etapas?</h2>
        <ul class="why">
          <li><span>Senhas vazam: são reaproveitadas em outros sites ou descobertas em golpes de phishing.</span></li>
          <li><span>Com a segunda etapa, quem tiver só a sua senha não entra. É preciso também o código do seu celular.</span></li>
          <li><span>Suas mentorias e conversas na Zona Segura ficam muito mais protegidas.</span></li>
        </ul>
        <fieldset class="stack"><legend class="section-title">Escolha como receber o código</legend>
          <label class="method"><input type="radio" name="method" value="totp" checked><span><b>App autenticador</b> <span class="tag lock">Recomendado</span><br><span class="small muted">Google Authenticator, Microsoft Authenticator, Authy ou 1Password. Funciona sem internet e é o mais seguro.</span></span></label>
          <label class="method"><input type="radio" name="method" value="email"><span><b>Código por e-mail</b><br><span class="small muted">Mais simples, mas depende da segurança do seu e-mail.</span></span></label>
        </fieldset>
        <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary" data-next>Continuar</button></div>`;
      setTitle();
      $('[data-close]', m.el).addEventListener('click', m.close);
      $('[data-next]', m.el).addEventListener('click', () => {
        state.method = $('input[name=method]:checked', m.el).value;
        step2();
      });
    };

    const step2 = async () => {
      if (state.method === 'totp') {
        const grouped = state.secret.match(/.{1,4}/g).join(' ');
        wiz().innerHTML = `${steps(2)}
          <h2>Conecte seu app autenticador</h2>
          <ol class="small">
            <li>Abra o app autenticador no celular e toque em <b>Adicionar conta</b> (ou “+”).</li>
            <li>Escolha <b>Inserir chave de configuração</b>. Em nome, use <b>Eleva</b>.</li>
            <li>Digite a chave abaixo e escolha <b>Baseada em tempo</b>.</li>
          </ol>
          <div class="secret" aria-label="Chave de configuração">${esc(grouped)}</div>
          <div class="row"><button class="btn btn-ghost btn-sm" data-copy-secret>Copiar chave</button><button class="btn btn-ghost btn-sm" data-copy-uri>Copiar link otpauth://</button></div>
          ${Views.totpSimHtml()}
          <form data-confirm>
            <label class="field"><span>Digite o código de 6 dígitos que aparece no app</span><input type="text" name="code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
            <div class="alert alert-error hidden" data-err role="alert"></div>
            <div class="modal-actions"><button type="button" class="btn btn-ghost" data-back>Voltar</button><button class="btn btn-primary">Verificar e ativar</button></div>
          </form>`;
        Views.bindTotpSim(m.el, state.secret);
        $('[data-copy-secret]', m.el).addEventListener('click', () => U.copy(state.secret));
        $('[data-copy-uri]', m.el).addEventListener('click', () => U.copy(Sec.otpauthUri(state.secret, me.email)));
      } else {
        await App.issueCode(me.email, '2fa-setup');
        wiz().innerHTML = `${steps(2)}
          <h2>Confirme seu e-mail</h2>
          <p class="small">Enviamos um código para <b>${esc(me.email)}</b>. (Protótipo: veja o “E-mail simulado”, disponível também em Ajustes › Seus dados.)</p>
          <form data-confirm>
            <label class="field"><span>Código de 6 dígitos</span><input type="text" name="code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
            <div class="alert alert-error hidden" data-err role="alert"></div>
            <div class="modal-actions"><button type="button" class="btn btn-ghost" data-back>Voltar</button><button type="button" class="btn btn-outline" data-inbox>Abrir e-mail simulado</button><button class="btn btn-primary">Verificar e ativar</button></div>
          </form>`;
        $('[data-inbox]', m.el).addEventListener('click', () => $('#inbox-btn').click());
      }
      setTitle();
      const f = $('[data-confirm]', m.el);
      f.code.addEventListener('input', () => { f.code.value = f.code.value.replace(/\D/g, '').slice(0, 6); });
      f.code.focus();
      $('[data-back]', m.el).addEventListener('click', step1);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('[data-err]', m.el);
        let ok = false, lastStep = -1;
        if (state.method === 'totp') {
          const st = await Sec.verifyTotp(state.secret, f.code.value);
          if (st !== null) { ok = true; lastStep = st; }
        } else ok = (await App.checkCode(me.email, '2fa-setup', f.code.value)).ok;
        if (!ok) { err.textContent = 'Código incorreto. Confira e tente de novo (o código do app muda a cada 30 segundos).'; err.classList.remove('hidden'); f.code.value = ''; f.code.focus(); return; }
        me.mfa = { method: state.method, secret: state.method === 'totp' ? state.secret : null, lastStep, backup: [], enabledAt: Date.now() };
        const codes = await makeBackup(me);
        Store.save();
        Store.sendMail(me.email, 'Verificação em duas etapas ativada', `A partir de agora pediremos um código ${state.method === 'totp' ? 'do seu app autenticador' : 'enviado por e-mail'} a cada acesso.`);
        step3(codes);
      });
    };

    const step3 = (codes) => {
      wiz().innerHTML = `${steps(3)}${backupStep(codes)}`;
      setTitle();
      bindBackupStep(m, codes, () => {
        m.close();
        U.toast('Verificação em duas etapas ativada. Sua conta está mais segura!', 'ok');
        App.nav('#/config#seguranca', true);
      });
      U.announce('Verificação em duas etapas ativada. Guarde seus códigos de backup.');
    };
    step1();
  }

  async function regenerateBackup() {
    if (!(await App.requireReauth('Para gerar novos códigos de backup.'))) return;
    const me = App.me();
    const codes = await makeBackup(me);
    Store.save();
    const m = U.modal(`${backupStep(codes)}<p class="tiny muted">Os códigos antigos deixaram de funcionar.</p>`);
    bindBackupStep(m, codes, () => { m.close(); App.render(); });
  }

  async function disableMfa() {
    if (!(await App.requireReauth('Para desativar a verificação em duas etapas.'))) return;
    const ok = await U.confirmDialog('Desativar a verificação em duas etapas?', 'Sua conta voltará a depender só da senha. Se a senha vazar, qualquer pessoa poderá entrar.', { okLabel: 'Desativar mesmo assim', danger: true });
    if (!ok) return;
    const me = App.me();
    me.mfa = null;
    Store.save();
    Store.sendMail(me.email, 'Verificação em duas etapas desativada', 'Se não foi você, troque sua senha imediatamente e ative a verificação de novo.');
    U.toast('Verificação em duas etapas desativada.');
    App.render();
  }

  function changePassword() {
    const me = App.me();
    const m = U.modal(`
      <h2>Alterar senha</h2>
      <form data-f>
        ${App.pwField('current', 'Senha atual')}
        <div data-meter>${App.pwField('password', 'Nova senha', 'new-password')}${App.meterHtml()}</div>
        <div class="field">${App.pwField('confirm', 'Confirmar nova senha', 'new-password')}</div>
        <label class="check"><input type="checkbox" name="others" checked> Encerrar as outras sessões</label>
        ${me.demo ? `<p class="tiny muted">Conta demo: senha atual <code>${esc(Seed.DEMO_PASSWORD)}</code></p>` : ''}
        <div class="alert alert-error hidden" data-err></div>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Salvar</button></div>
      </form>`);
    U.bindPasswordToggles(m.el);
    const f = $('[data-f]', m.el);
    const err = $('[data-err]', m.el);
    App.bindMeter(f.password, $('[data-meter]', m.el), () => ({ name: me.name, email: me.email }));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fail = (msg) => { err.textContent = msg; err.classList.remove('hidden'); };
      const pw = f.password.value;
      const st = Sec.passwordStrength(pw, { name: me.name, email: me.email });
      if (!st.ok) return fail(`Senha fraca: ${st.issues[0] || 'use uma senha mais longa e variada.'}`);
      if (pw !== f.confirm.value) return fail('As senhas não conferem.');
      if (pw === f.current.value) return fail('A nova senha deve ser diferente da atual.');
      const btn = $('button:not([type])', f); btn.disabled = true;
      if (!(await Sec.verifyPassword(f.current.value, me.pwd))) { btn.disabled = false; return fail('Senha atual incorreta.'); }
      // Re-cifra a chave privada com a nova senha (as conversas continuam legíveis)
      let jwk;
      try { jwk = (await Sec.unwrapPrivate(me.keys.wrapped, f.current.value)).jwk; } catch { jwk = null; }
      me.pwd = await Sec.hashPassword(pw);
      if (jwk) me.keys.wrapped = await Sec.wrapPrivate(jwk, pw);
      if (me.demo) U.toast('Atenção: a conta demo usa uma senha fixa; ela foi alterada só neste navegador.');
      if (f.others.checked) me.sessions = me.sessions.filter((x) => x.id === App.state.sid);
      Store.sendMail(me.email, 'Sua senha do Eleva foi alterada', 'Se não foi você, use “Esqueci minha senha” imediatamente.');
      Store.save();
      m.close(); U.toast('Senha alterada com sucesso', 'ok'); App.render();
    });
  }

  async function setPin() {
    if (!(await App.requireReauth('Para configurar o PIN da Zona Segura.'))) return;
    const me = App.me();
    const m = U.modal(`
      <h2>PIN da Zona Segura</h2>
      <p class="muted small">Use de 4 a 8 números. Evite datas de aniversário e sequências.</p>
      <form data-f>
        <label class="field"><span>Novo PIN</span><input type="password" name="pin" inputmode="numeric" maxlength="8" class="code-input" required></label>
        <label class="field"><span>Confirmar PIN</span><input type="password" name="confirm" inputmode="numeric" maxlength="8" class="code-input" required></label>
        <div class="alert alert-error hidden" data-err></div>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Salvar PIN</button></div>
      </form>`);
    $('[data-f]', m.el).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, err = $('[data-err]', m.el);
      const pin = f.pin.value;
      const fail = (msg) => { err.textContent = msg; err.classList.remove('hidden'); };
      if (!/^\d{4,8}$/.test(pin)) return fail('O PIN deve ter de 4 a 8 números.');
      if (/^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) return fail('Esse PIN é fácil de adivinhar.');
      if (pin !== f.confirm.value) return fail('Os PINs não conferem.');
      me.zonePin = await Sec.hashPassword(pin);
      me.zonePinLock = 0;
      App.state.zoneUnlocked = true;
      Store.save(); m.close(); U.toast('PIN salvo', 'ok'); App.render();
    });
  }

  /* LGPD: acesso e portabilidade */
  async function showMyData() {
    if (!(await App.requireReauth('Para ver todos os seus dados.'))) return;
    const me = App.me();
    const d = App.db();
    const data = {
      exportadoEm: new Date().toISOString(),
      perfil: { nome: me.name, cargo: me.role, email: me.email, bio: me.bio, foto: me.photo ? '(imagem sem metadados)' : null, criadoEm: new Date(me.createdAt).toISOString(), termosAceitosEm: new Date(me.termsAcceptedAt).toISOString() },
      seguranca: { senha: 'guardada apenas como hash PBKDF2 — nem nós conseguimos ver', verificacaoDuasEtapas: me.mfa ? (me.mfa.method === 'totp' ? 'app autenticador' : 'código por e-mail') : 'desativada', codigosDeBackupRestantes: me.mfa ? (me.mfa.backup || []).length : 0, pinZonaSegura: !!me.zonePin, sessoes: me.sessions.map((x) => ({ dispositivo: x.device, inicio: new Date(x.createdAt).toISOString() })) },
      preferencias: me.settings,
      metricas: { visualizacoesDoPerfil: me.profileViews, seguidoras: me.followers.length, seguindo: me.following.length },
      seguindo: me.following.map((id) => Store.user(id)?.name).filter(Boolean),
      conexoes: me.connections.map((id) => Store.user(id)?.name).filter(Boolean),
      bloqueadas: me.blocked.map((id) => Store.user(id)?.name).filter(Boolean),
      historicoDePesquisas: me.searchHistory,
      artigos: d.articles.filter((a) => a.authorId === me.id).map((a) => ({ titulo: a.title, subtitulo: a.subtitle, texto: a.body, data: new Date(a.createdAt).toISOString() })),
      artigosCurtidos: d.articles.filter((a) => a.likes.includes(me.id)).map((a) => a.title),
      comentarios: d.articles.flatMap((a) => a.comments.filter((c) => c.userId === me.id).map((c) => ({ artigo: a.title, texto: c.text }))),
      perguntas: d.questions.filter((q) => q.authorId === me.id).map((q) => ({ titulo: q.title, anonima: q.anonymous })),
      respostas: d.questions.flatMap((q) => q.answers.filter((a) => a.userId === me.id).map((a) => ({ pergunta: q.title, texto: a.text }))),
      zonaSegura: { conversas: d.convos.filter((c) => c.members.includes(me.id)).length, observacao: 'O conteúdo das mensagens é criptografado de ponta a ponta e não fica legível no servidor.' },
      denunciasFeitas: d.reports.filter((r) => r.reporterId === me.id).map((r) => ({ tipo: r.type, motivo: r.reason, status: r.status })),
    };
    const json = JSON.stringify(data, null, 2);
    const m = U.modal(`
      <h2>Seus dados</h2>
      <p class="muted small">Direito de acesso e portabilidade (LGPD, art. 18).</p>
      <pre class="data">${esc(json)}</pre>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Fechar</button><button class="btn btn-outline" data-dl>Baixar JSON</button><button class="btn btn-primary" data-copy>Copiar</button></div>`, { wide: true });
    $('[data-copy]', m.el).addEventListener('click', () => U.copy(json));
    $('[data-dl]', m.el).addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'meus-dados-eleva.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  /* LGPD: eliminação */
  async function deleteAccount() {
    if (!(await App.requireReauth('Para excluir sua conta.'))) return;
    const me = App.me();
    const m = U.modal(`
      <h2>Excluir conta</h2>
      <div class="alert alert-error">Isto apaga definitivamente seu perfil, artigos, comentários, perguntas, respostas, mensagens e conexões. Não dá para desfazer.</div>
      <form data-f>
        <label class="field"><span>Digite EXCLUIR para confirmar</span><input type="text" name="confirm" autocomplete="off" required></label>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-danger">Excluir definitivamente</button></div>
      </form>`);
    $('[data-f]', m.el).addEventListener('submit', (e) => {
      e.preventDefault();
      if (e.target.confirm.value.trim() !== 'EXCLUIR') return U.toast('Digite EXCLUIR para confirmar.', 'error');
      const d = App.db();
      const id = me.id;
      d.articles = d.articles.filter((a) => a.authorId !== id);
      d.articles.forEach((a) => { a.likes = a.likes.filter((x) => x !== id); a.comments = a.comments.filter((c) => c.userId !== id); });
      d.questions = d.questions.filter((q) => q.authorId !== id);
      d.questions.forEach((q) => { q.answers = q.answers.filter((a) => a.userId !== id); q.answers.forEach((a) => { a.useful = a.useful.filter((x) => x !== id); }); });
      d.rooms.forEach((r) => { r.messages = r.messages.filter((x) => x.userId !== id); });
      d.convos = d.convos.filter((c) => !c.members.includes(id));
      d.reports = d.reports.filter((r) => r.reporterId !== id);
      d.users.forEach((u) => {
        ['followers', 'following', 'connections', 'blocked'].forEach((k) => { u[k] = u[k].filter((x) => x !== id); });
        u.connRequests = (u.connRequests || []).filter((x) => x !== id);
      });
      d.users = d.users.filter((u) => u.id !== id);
      d.codes = d.codes.filter((c) => c.email !== me.email);
      Store.sendMail(me.email, 'Sua conta Eleva foi excluída', 'Seus dados foram apagados. Sentiremos sua falta.');
      Store.save();
      m.close();
      App.logout('Sua conta foi excluída.');
    });
  }
})();
