'use strict';
/* Boas-vindas, login, cadastro, verificação de e-mail, duas etapas, recuperação de senha e textos legais. */
(() => {
  const { esc, $ } = U;
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 60000;

  const ABOUT = 'Somos uma equipe que visa melhorar o mundo corporativo e, com isso, desenvolvemos, junto com o Instituto Reciclar, esse App com intuito de conectar as mulheres na liderança e incentivar as mulheres que virão de uma nova geração. Estamos felizes com sua presença em nosso App.';

  function authLayout(inner) {
    $('#app').innerHTML = `
      <a class="skip-link" href="#main" data-skip>Pular para o formulário</a>
      <div class="auth">
        <section class="auth-hero" aria-label="Sobre o Eleva">
          <div class="logo">Eleva</div>
          <p class="tagline">Conexão, conhecimento e apoio para mulheres na liderança.</p>
          <div class="about">
            <h2>Quem somos</h2>
            <p>${esc(ABOUT)}</p>
          </div>
          <ul class="pillars">
            <li><span class="dot">${App.icon('feed')}</span><span><b>Fácil de navegar.</b> Cinco áreas sempre no mesmo lugar, tour guiado e atalhos de teclado.</span></li>
            <li><span class="dot">${A11y.ICON.a11y}</span><span><b>Para todas.</b> Modo escuro, texto maior, alto contraste, fonte de leitura fácil e leitor de tela.</span></li>
            <li><span class="dot">${App.icon('zona')}</span><span><b>Segura.</b> Verificação em duas etapas e mensagens criptografadas de ponta a ponta.</span></li>
          </ul>
        </section>
        <main class="auth-main" id="main" tabindex="-1">
          <div class="auth-tools">${A11y.toolsHtml()}</div>
          <div class="auth-card">${inner}</div>
        </main>
      </div>`;
    U.bindPasswordToggles($('#app'));
  }
  const showErr = (el, msg) => { el.textContent = msg; el.classList.toggle('hidden', !msg); };

  /* ---------------- Login ---------------- */
  Views.login = () => {
    authLayout(`
      <h1>Entrar</h1>
      <p class="muted">Que bom ter você aqui.</p>
      <form id="login-form" novalidate>
        <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="username" required maxlength="120"></label>
        ${App.pwField('password', 'Senha')}
        <div class="alert alert-error hidden" id="login-err"></div>
        <button class="btn btn-primary btn-block" id="login-btn">Entrar</button>
      </form>
      <div class="row between small links-row">
        <a href="#/recuperar">Esqueci minha senha</a>
        <span>Nova por aqui? <a href="#/cadastro"><b>Criar conta</b></a></span>
      </div>
      <div class="divider">ou</div>
      <button class="btn btn-outline btn-block" id="demo-btn">Explorar com uma conta de demonstração</button>
      <p class="proto-note">Protótipo: os dados ficam apenas neste navegador. Os códigos de verificação aparecem no botão “E-mail simulado”, no canto da tela.</p>`);

    const form = $('#login-form');
    const err = $('#login-err');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(err, '');
      const email = Store.normEmail(form.email.value);
      const password = form.password.value;
      if (!email || !password) return showErr(err, 'Preencha e-mail e senha.');
      const d = App.db();
      const key = await Sec.sha256Hex(email);
      const att = d.attempts[key] || { count: 0, until: 0 };
      if (att.until > Date.now()) {
        return showErr(err, `Muitas tentativas. Por segurança, aguarde ${Math.ceil((att.until - Date.now()) / 1000)} segundos.`);
      }
      const btn = $('#login-btn'); btn.disabled = true; btn.textContent = 'Verificando…';
      const user = Store.userByEmail(email);
      const ok = await Sec.verifyPassword(password, user && user.pwd);
      btn.disabled = false; btn.textContent = 'Entrar';
      if (!ok) {
        att.count++;
        if (att.count >= MAX_ATTEMPTS) { att.until = Date.now() + LOCK_MS; att.count = 0; }
        d.attempts[key] = att;
        Store.save();
        // Mesma mensagem para e-mail inexistente ou senha errada: não revela quem tem conta
        return showErr(err, att.until > Date.now()
          ? 'Muitas tentativas. Por segurança, o acesso foi bloqueado por 1 minuto.'
          : `E-mail ou senha incorretos. ${MAX_ATTEMPTS - att.count} tentativa(s) antes do bloqueio temporário.`);
      }
      delete d.attempts[key];
      Store.save();
      if (!user.emailVerified) {
        App.state.pending = { purpose: 'verify', userId: user.id, email, password };
        await App.issueCode(email, 'verify');
        return App.nav('#/verificar');
      }
      if (user.mfa) return startSecondFactor(user, email, password);
      App.completeLogin(user, password);
    });
    $('#demo-btn').addEventListener('click', enterDemo);
  };

  /* ---------------- Cadastro ---------------- */
  Views.signup = () => {
    authLayout(`
      <h1>Criar conta</h1>
      <p class="muted">Leva menos de um minuto.</p>
      <form id="signup-form" novalidate>
        <label class="field"><span>Nome completo</span><input type="text" name="name" autocomplete="name" required maxlength="80"></label>
        <label class="field"><span>Cargo / Empresa</span><input type="text" name="role" autocomplete="organization-title" required maxlength="100" placeholder="Ex.: Gerente de Marketing · Empresa X"></label>
        <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="email" required maxlength="120"></label>
        <div id="pw-block">${App.pwField('password', 'Senha', 'new-password')}${App.meterHtml()}</div>
        <div class="field">${App.pwField('confirm', 'Confirmar senha', 'new-password')}</div>
        <label class="check"><input type="checkbox" name="terms"> <span>Li e aceito os <a href="#" data-legal="terms">Termos de Uso</a> e a <a href="#" data-legal="privacy">Política de Privacidade</a>, e autorizo o tratamento dos meus dados conforme a LGPD.</span></label>
        <div class="alert alert-error hidden" id="signup-err"></div>
        <button class="btn btn-primary btn-block" id="signup-btn">Criar conta</button>
      </form>
      <p class="center small">Já tem conta? <a href="#/entrar"><b>Entrar</b></a></p>`);
    const form = $('#signup-form');
    const err = $('#signup-err');
    App.bindMeter(form.password, $('#pw-block'), () => ({ name: form.name.value, email: form.email.value }));
    form.addEventListener('click', (e) => {
      const l = e.target.closest('[data-legal]');
      if (l) { e.preventDefault(); legalModal(l.dataset.legal); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(err, '');
      const name = form.name.value.trim().replace(/\s+/g, ' ');
      const role = form.role.value.trim();
      const email = Store.normEmail(form.email.value);
      const pw = form.password.value;
      if (name.length < 3 || !name.includes(' ')) return showErr(err, 'Informe seu nome completo.');
      if (role.length < 2) return showErr(err, 'Informe seu cargo e empresa.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return showErr(err, 'Informe um e-mail válido.');
      const strength = Sec.passwordStrength(pw, { name, email });
      if (!strength.ok) return showErr(err, `Senha fraca: ${strength.issues[0] || 'use uma senha mais longa e variada.'}`);
      if (pw !== form.confirm.value) return showErr(err, 'As senhas não conferem.');
      if (!form.terms.checked) return showErr(err, 'Para continuar, aceite os Termos de Uso e a Política de Privacidade.');
      if (!App.guardRate('signup', { max: 3, windowMs: 60000, minGapMs: 3000 })) return;

      const btn = $('#signup-btn'); btn.disabled = true; btn.textContent = 'Criando conta…';
      const d = App.db();
      if (Store.userByEmail(email)) {
        // Não revelamos que o e-mail já existe: avisamos a dona do e-mail, e a tela segue igual.
        Store.sendMail(email, 'Tentativa de cadastro no Eleva', 'Alguém tentou criar uma conta com este e-mail. Se foi você, use “Esqueci minha senha” na tela de entrada. Se não foi, pode ignorar esta mensagem.');
        App.state.pending = { purpose: 'verify', userId: null, email, password: null };
        return App.nav('#/verificar');
      }
      const kp = await Sec.generateKeyPair();
      const user = Seed.baseUser({
        name, role, email, emailVerified: false,
        pwd: await Sec.hashPassword(pw),
        keys: { pub: kp.pubJwk, wrapped: await Sec.wrapPrivate(kp.privJwk, pw) },
        termsAcceptedAt: Date.now(), termsVersion: '2026-10',
      });
      d.users.push(user);
      Store.save();
      App.state.pending = { purpose: 'verify', userId: user.id, email, password: pw };
      await App.issueCode(email, 'verify');
      App.nav('#/verificar');
    });
  };

  /* ---------------- Código por e-mail (verificação de conta ou duas etapas) ---------------- */
  let lastResend = 0;
  const MAX_2FA_FAILS = 5;

  async function startSecondFactor(user, email, password) {
    App.state.pending = { purpose: '2fa', method: user.mfa.method, userId: user.id, email, password, fails: 0 };
    if (user.mfa.method === 'email') await App.issueCode(email, '2fa');
    App.nav('#/verificar');
  }

  /* Autenticador simulado: só existe no protótipo, para testar sem instalar um app no celular */
  function totpSimHtml() {
    return `<details class="totp-sim"><summary>Protótipo: não tem um app autenticador à mão?</summary>
      <p class="tiny muted">Este é um autenticador simulado, só para testes. No app real ele não existe: o código vem do seu celular.</p>
      <div class="row between"><span class="code" data-sim-code>······</span><span class="tiny muted" data-sim-left></span></div>
      <div class="countdown" aria-hidden="true"><i data-sim-bar></i></div></details>`;
  }
  function bindTotpSim(root, secret, seqCheck) {
    const codeEl = $('[data-sim-code]', root), left = $('[data-sim-left]', root), bar = $('[data-sim-bar]', root);
    if (!codeEl) return;
    const tick = async () => {
      if (!codeEl.isConnected || (seqCheck && !seqCheck())) { clearInterval(iv); return; }
      const sec = Sec.TOTP_STEP - (Math.floor(Date.now() / 1000) % Sec.TOTP_STEP);
      codeEl.textContent = await Sec.totpAt(secret, Sec.currentStep());
      left.textContent = `troca em ${sec}s`;
      bar.style.width = `${(sec / Sec.TOTP_STEP) * 100}%`;
    };
    const iv = setInterval(tick, 1000);
    tick();
  }
  Views.totpSimHtml = totpSimHtml;
  Views.bindTotpSim = bindTotpSim;

  Views.verify = ({ seq }) => {
    const p = App.state.pending;
    if (!p) return App.nav('#/entrar', true);
    if (p.purpose === 'protect') return protectScreen(p);
    const is2fa = p.purpose === '2fa';
    const user = p.userId ? Store.user(p.userId) : null;
    const mode = p.useBackup ? 'backup' : is2fa ? p.method : 'verify';
    const headings = {
      verify: ['Confirme seu e-mail', `Enviamos um código de 6 dígitos para <b>${esc(p.email)}</b>. Ele expira em 10 minutos.`],
      email: ['Verificação em duas etapas', `Para sua segurança, enviamos um código de 6 dígitos para <b>${esc(p.email)}</b>.`],
      totp: ['Verificação em duas etapas', 'Abra seu app autenticador (Google Authenticator, Microsoft Authenticator, Authy…) e digite o código de 6 dígitos do <b>Eleva</b>.'],
      backup: ['Use um código de backup', 'Digite um dos códigos de backup que você guardou ao ativar a verificação. Cada código só funciona uma vez.'],
    };
    const [title, lead] = headings[mode];
    authLayout(`
      ${is2fa ? '<div class="steps" aria-hidden="true"><span class="on"></span><span class="on"></span></div><p class="tiny muted">Etapa 2 de 2 · senha confirmada ✓</p>' : ''}
      <h1>${title}</h1>
      <p class="muted">${lead}</p>
      ${mode === 'verify' || mode === 'email' ? '<div class="alert alert-info small">Protótipo: abra o botão <b>“E-mail simulado”</b> no canto da tela para ver o código.</div>' : ''}
      <form id="code-form" novalidate>
        <label class="field"><span>${mode === 'backup' ? 'Código de backup' : 'Código de 6 dígitos'}</span>
          ${mode === 'backup'
            ? '<input type="text" name="code" id="code" autocomplete="one-time-code" maxlength="9" placeholder="xxxx-xxxx" required>'
            : '<input type="text" name="code" id="code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required aria-describedby="code-help">'}
        </label>
        ${mode !== 'backup' ? '<p class="tiny muted" id="code-help">Somente números. O código muda a cada 30 segundos no app autenticador.</p>' : ''}
        ${mode === 'totp' && user ? totpSimHtml() : ''}
        <div class="alert alert-error hidden" id="code-err" role="alert"></div>
        <button class="btn btn-primary btn-block">Confirmar</button>
      </form>
      <div class="row between small links-row">
        ${mode === 'verify' || mode === 'email' ? '<button class="link-btn" id="resend">Reenviar código</button>' : ''}
        ${is2fa ? `<button class="link-btn" id="switch">${mode === 'backup' ? 'Voltar para o código normal' : 'Usar um código de backup'}</button>` : ''}
        <button class="link-btn" id="cancel">Voltar para o login</button>
      </div>
      ${is2fa ? '<p class="proto-note">Perdeu o acesso ao celular e aos códigos de backup? Use “Esqueci minha senha” para recuperar a conta pelo e-mail.</p>' : ''}`);
    if (mode === 'totp' && user) bindTotpSim($('#app'), user.mfa.secret, () => App.isCurrent(seq));
    const form = $('#code-form');
    const err = $('#code-err');
    if (mode !== 'backup') form.code.addEventListener('input', () => { form.code.value = form.code.value.replace(/\D/g, '').slice(0, 6); });
    form.code.focus();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(err, '');
      const code = form.code.value.trim();
      if (mode !== 'backup' && !/^\d{6}$/.test(code)) return showErr(err, 'Digite os 6 números do código.');
      if (!is2fa) {
        const res = await App.checkCode(p.email, 'verify', code);
        if (!res.ok || !user) return showErr(err, res.ok ? 'Código incorreto.' : res.error);
        user.emailVerified = true; Store.save();
        U.toast('E-mail confirmado! Bem-vinda ao Eleva.', 'ok');
        if (user.mfa) return startSecondFactor(user, p.email, p.password);
        // Conta nova: convidamos a ativar a verificação em duas etapas antes de entrar
        App.state.pending = { ...p, purpose: 'protect' };
        return App.render();
      }
      let ok = false;
      if (mode === 'totp') {
        const step = await Sec.verifyTotp(user.mfa.secret, code, user.mfa.lastStep ?? -1);
        if (step !== null) { ok = true; user.mfa.lastStep = step; }
      } else if (mode === 'email') {
        ok = (await App.checkCode(p.email, '2fa', code)).ok;
      } else {
        const h = await Sec.sha256Hex(`backup:${user.id}:${Sec.normBackup(code)}`);
        const i = (user.mfa.backup || []).indexOf(h);
        if (i >= 0) {
          ok = true;
          user.mfa.backup.splice(i, 1);
          Store.sendMail(user.email, 'Código de backup usado', `Um código de backup foi usado para entrar na sua conta. Restam ${user.mfa.backup.length}. Se não foi você, troque sua senha.`);
        }
      }
      if (!ok) {
        p.fails++;
        if (p.fails >= MAX_2FA_FAILS) {
          App.db().attempts[await Sec.sha256Hex(p.email)] = { count: 0, until: Date.now() + 60000 };
          Store.save();
          App.state.pending = null;
          U.toast('Muitas tentativas na verificação. Por segurança, o login foi bloqueado por 1 minuto.', 'error');
          return App.nav('#/entrar');
        }
        const reused = mode === 'totp' && user.mfa.lastStep >= 0 && await Sec.totpAt(user.mfa.secret, user.mfa.lastStep) === code;
        form.code.value = '';
        form.code.focus();
        return showErr(err, reused
          ? 'Esse código já foi usado. Por segurança, cada código vale uma vez: espere o app mostrar o próximo (até 30 segundos).'
          : `Código incorreto. ${MAX_2FA_FAILS - p.fails} tentativa(s) restante(s).`);
      }
      Store.save();
      if (mode === 'backup') U.toast(`Código de backup aceito. Restam ${user.mfa.backup.length}.`, user.mfa.backup.length <= 2 ? 'error' : 'ok');
      App.completeLogin(user, p.password);
    });
    const resend = $('#resend');
    if (resend) resend.addEventListener('click', async () => {
      const wait = 30000 - (Date.now() - lastResend);
      if (wait > 0) return U.toast(`Aguarde ${Math.ceil(wait / 1000)}s para reenviar.`);
      lastResend = Date.now();
      if (p.userId) await App.issueCode(p.email, is2fa ? '2fa' : 'verify');
      U.toast('Se o e-mail estiver correto, um novo código foi enviado.');
    });
    const sw = $('#switch');
    if (sw) sw.addEventListener('click', () => { p.useBackup = !p.useBackup; App.render(); });
    $('#cancel').addEventListener('click', () => { App.state.pending = null; App.nav('#/entrar'); });
  };

  /* Depois de confirmar o e-mail: por que ativar a verificação em duas etapas */
  function protectScreen(p) {
    const user = Store.user(p.userId);
    authLayout(`
      <h1>Proteja sua conta</h1>
      <p class="muted">Falta um passo para deixar sua conta muito mais segura.</p>
      <div class="card">
        <p class="small"><b>A verificação em duas etapas pede, além da senha, um código que só você tem.</b> Mesmo que alguém descubra ou vaze a sua senha, não consegue entrar.</p>
        <ul class="why">
          <li><span>Protege suas conversas da Zona Segura, que podem incluir mentorias e desabafos.</span></li>
          <li><span>Impede que alguém publique em seu nome na comunidade.</span></li>
          <li><span>Leva menos de 2 minutos para configurar.</span></li>
        </ul>
      </div>
      <div class="stack">
        <button class="btn btn-primary btn-block" id="setup">Ativar verificação em duas etapas</button>
        <button class="btn btn-ghost btn-block" id="later">Fazer isso depois</button>
      </div>`);
    $('#setup').addEventListener('click', () => App.completeLogin(user, p.password, null, '#/config?ativar=2fa'));
    $('#later').addEventListener('click', () => App.completeLogin(user, p.password));
  }

  /* ---------------- Esqueci minha senha ---------------- */
  let resetEmail = null;
  Views.forgot = () => {
    if (!resetEmail) {
      authLayout(`
        <h1>Recuperar acesso</h1>
        <p class="muted">Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um código para criar uma nova senha.</p>
        <form id="f1" novalidate>
          <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="email" required maxlength="120"></label>
          <button class="btn btn-primary btn-block">Enviar código</button>
        </form>
        <p class="center small"><a href="#/entrar">Voltar para o login</a></p>`);
      $('#f1').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = Store.normEmail(e.target.email.value);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return U.toast('Informe um e-mail válido.', 'error');
        if (!App.guardRate('forgot', { max: 3, windowMs: 300000, minGapMs: 5000 })) return;
        if (Store.userByEmail(email)) await App.issueCode(email, 'reset');
        resetEmail = email;
        Views.forgot();
      });
      return;
    }
    authLayout(`
      <h1>Criar nova senha</h1>
      <div class="alert alert-info small">Se houver uma conta com <b>${esc(resetEmail)}</b>, você receberá um código em instantes. (Protótipo: veja o “E-mail simulado”.)</div>
      <form id="f2" novalidate>
        <label class="field"><span>Código</span><input type="text" name="code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>
        <div id="pw-block">${App.pwField('password', 'Nova senha', 'new-password')}${App.meterHtml()}</div>
        <div class="field">${App.pwField('confirm', 'Confirmar nova senha', 'new-password')}</div>
        <div class="alert alert-error hidden" id="f2-err"></div>
        <button class="btn btn-primary btn-block" id="f2-btn">Salvar nova senha</button>
      </form>
      <p class="center small"><button class="link-btn" id="other-email">Usar outro e-mail</button></p>`);
    const form = $('#f2');
    const err = $('#f2-err');
    const target = Store.userByEmail(resetEmail);
    App.bindMeter(form.password, $('#pw-block'), () => ({ name: target ? target.name : '', email: resetEmail }));
    $('#other-email').addEventListener('click', () => { resetEmail = null; Views.forgot(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(err, '');
      const pw = form.password.value;
      const st = Sec.passwordStrength(pw, { name: target ? target.name : '', email: resetEmail });
      if (!st.ok) return showErr(err, `Senha fraca: ${st.issues[0] || 'use uma senha mais longa e variada.'}`);
      if (pw !== form.confirm.value) return showErr(err, 'As senhas não conferem.');
      const res = await App.checkCode(resetEmail, 'reset', form.code.value);
      if (!res.ok || !target) return showErr(err, res.ok ? 'Código incorreto.' : res.error);
      $('#f2-btn').disabled = true;
      target.pwd = await Sec.hashPassword(pw);
      // Sem a senha antiga não dá para abrir a chave privada antiga: geramos um novo par de chaves.
      // Mensagens antigas da Zona Segura deixam de ser legíveis — comportamento esperado em criptografia de ponta a ponta.
      const kp = await Sec.generateKeyPair();
      target.keys = { pub: kp.pubJwk, wrapped: await Sec.wrapPrivate(kp.privJwk, pw), rotatedAt: Date.now() };
      target.verified = {};
      target.sessions = [];
      delete App.db().attempts[await Sec.sha256Hex(resetEmail)];
      Store.sendMail(resetEmail, 'Sua senha do Eleva foi alterada', 'Sua senha foi redefinida e todas as sessões foram encerradas. Se não foi você, entre em contato com o suporte imediatamente.');
      Store.save();
      resetEmail = null;
      U.toast('Senha alterada. Por segurança, todas as sessões foram encerradas.', 'ok');
      App.nav('#/entrar');
    });
  };

  /* ---------------- Conta de demonstração ---------------- */
  async function enterDemo() {
    const btn = $('#demo-btn');
    btn.disabled = true; btn.textContent = 'Preparando demonstração…';
    const d = App.db();
    let u = d.users.find((x) => x.demo);
    if (u) return App.completeLogin(u, Seed.DEMO_PASSWORD);

    const kp = await Sec.generateKeyPair();
    u = Seed.baseUser({
      name: 'Marina Duarte', role: 'Coordenadora de Projetos · Organização (demo)', email: Seed.DEMO_EMAIL, demo: true,
      bio: 'Conta de demonstração. Coordeno projetos sociais e quero crescer como líder.',
      pwd: await Sec.hashPassword(Seed.DEMO_PASSWORD),
      keys: { pub: kp.pubJwk, wrapped: await Sec.wrapPrivate(kp.privJwk, Seed.DEMO_PASSWORD) },
      profileViews: 128,
      searchHistory: [
        { q: 'negociação', at: Date.now() - 86400000 },
        { q: 'teto de vidro', at: Date.now() - 2 * 86400000 },
        { q: 'feedback', at: Date.now() - 4 * 86400000 },
      ],
    });
    d.users.push(u);
    const link = (a, b) => { a.connections.push(b.id); b.connections.push(a.id); };
    const follow = (a, b) => { a.following.push(b.id); b.followers.push(a.id); };
    const ana = Store.user('u_ana'), carla = Store.user('u_carla'), fer = Store.user('u_fernanda');
    link(u, ana); link(u, carla);
    ['u_ana', 'u_elisa', 'u_beatriz'].forEach((id) => follow(u, Store.user(id)));
    ['u_ana', 'u_carla', 'u_fernanda', 'u_debora'].forEach((id) => follow(Store.user(id), u));
    ['a1', 'a3'].forEach((id) => { const a = d.articles.find((x) => x.id === id); if (a && !a.likes.includes(u.id)) a.likes.push(u.id); });
    u.sessions.push({ id: U.uid('s'), device: 'Safari · iOS', createdAt: Date.now() - 2 * 86400000, lastSeen: Date.now() - 5 * 3600000 });

    const myPriv = await Sec.importPriv(kp.privJwk);
    const convo = { id: U.uid('c'), members: [u.id, ana.id], status: 'active', requestedBy: ana.id, timer: 0, createdAt: Date.now() - 86400000, messages: [] };
    const anaPriv = await Sec.importPriv(ana.privJwk);
    const lines = [
      [ana, anaPriv, u.keys.pub, 'Oi, Marina! Vi que você está liderando o projeto novo. Se quiser, podemos marcar uma mentoria a cada 15 dias.'],
      [u, myPriv, ana.keys.pub, 'Ana, eu adoraria! Estou com dúvidas sobre como dar feedback para o time.'],
      [ana, anaPriv, u.keys.pub, 'Combinado. Me manda um horário que funcione para você 💜'],
    ];
    for (let i = 0; i < lines.length; i++) {
      const [from, priv, pub, text] = lines[i];
      const m = await Zone.encryptMessage(convo, from.id, priv, pub, text);
      m.at = Date.now() - (lines.length - i) * 3600000;
      convo.messages.push(m);
    }
    d.convos.push(convo);
    const req = { id: U.uid('c'), members: [fer.id, u.id], status: 'request', requestedBy: fer.id, timer: 0, createdAt: Date.now() - 3 * 3600000, messages: [] };
    req.messages.push(await Zone.encryptMessage(req, fer.id, await Sec.importPriv(fer.privJwk), u.keys.pub, 'Oi, Marina! Vi seu trabalho com projetos sociais. Podemos conversar sobre uma parceria?'));
    d.convos.push(req);
    Store.save();
    App.completeLogin(u, Seed.DEMO_PASSWORD, myPriv);
  }

  /* ---------------- Termos e Privacidade (modelos) ---------------- */
  const LEGAL = {
    terms: { title: 'Termos de Uso', html: `
      <p class="alert alert-warn small">Modelo para o protótipo. O texto final precisa de revisão jurídica.</p>
      <h2>1. Sobre o Eleva</h2><p>O Eleva é uma comunidade para conectar mulheres na liderança, desenvolvida com o Instituto Reciclar.</p>
      <h2>2. Sua conta</h2><p>Você é responsável por manter sua senha em sigilo. Não compartilhe códigos de verificação. Cada pessoa pode ter uma conta.</p>
      <h2>3. Convivência</h2><p>Não são permitidos assédio, discriminação, discurso de ódio, golpes, spam ou exposição de dados pessoais de terceiras. Conteúdos e contas que violem estas regras podem ser removidos.</p>
      <h2>4. Conteúdo</h2><p>Você mantém os direitos sobre o que publica e autoriza o Eleva a exibir esse conteúdo dentro da plataforma.</p>
      <h2>5. Denúncias</h2><p>Denúncias são confidenciais e analisadas pela moderação.</p>
      <h2>6. Encerramento</h2><p>Você pode excluir sua conta a qualquer momento em Ajustes.</p>` },
    privacy: { title: 'Política de Privacidade', html: `
      <p class="alert alert-warn small">Modelo para o protótipo. O texto final precisa de revisão jurídica e de um(a) encarregado(a) de dados (DPO).</p>
      <h2>Dados que coletamos</h2><p>Nome, cargo/empresa, e-mail, foto (opcional), bio, conteúdos publicados, conexões e, se você permitir, o histórico de pesquisas.</p>
      <h2>Para que usamos</h2><p>Para operar a comunidade, proteger sua conta e mostrar métricas do seu perfil somente para você. Não vendemos dados.</p>
      <h2>Zona Segura</h2><p>As mensagens diretas são criptografadas de ponta a ponta: o Eleva não consegue ler o conteúdo.</p>
      <h2>Fotos</h2><p>Removemos automaticamente a localização e outros metadados das imagens enviadas.</p>
      <h2>Seus direitos (LGPD)</h2><p>Você pode acessar, copiar, corrigir e excluir seus dados, além de revogar consentimentos, a qualquer momento em Ajustes.</p>
      <h2>Segurança</h2><p>Senhas são guardadas apenas como hash forte (PBKDF2), com bloqueio contra tentativas repetidas e saída automática por inatividade.</p>` },
  };
  function legalModal(kind) {
    const l = LEGAL[kind];
    U.modal(`<h2>${l.title}</h2><div class="legal">${l.html}</div><div class="modal-actions"><button class="btn btn-primary" data-close>Fechar</button></div>`, { wide: true });
  }
  function legalPage(kind) {
    const l = LEGAL[kind];
    const inner = `<div class="narrow legal"><h1 class="page-title">${l.title}</h1>${l.html}<p><a href="${App.state.meId ? '#/config' : '#/entrar'}">← Voltar</a></p></div>`;
    if (App.state.meId) App.shell('config', inner);
    else $('#app').innerHTML = `<main class="main">${inner}</main>`;
  }
  Views.terms = () => legalPage('terms');
  Views.privacy = () => legalPage('privacy');
  Views.legalModal = legalModal;
})();
