'use strict';
/* Boas-vindas, login, cadastro, verificação de e-mail, duas etapas, recuperação de senha e textos legais. */
(() => {
  const { esc, $ } = U;
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 60000;

  const ABOUT = 'Somos uma equipe que visa melhorar o mundo corporativo e, com isso, desenvolvemos, junto com o Instituto Reciclar, esse App com intuito de conectar as mulheres na liderança e incentivar as mulheres que virão de uma nova geração. Estamos felizes com sua presença em nosso App.';

  function authLayout(inner) {
    $('#app').innerHTML = `
      <div class="auth">
        <section class="auth-hero">
          <div class="logo">Eleva</div>
          <div class="tagline">Conexão, conhecimento e apoio para mulheres na liderança.</div>
          <div class="about">
            <h2>Quem somos</h2>
            <p>${esc(ABOUT)}</p>
          </div>
        </section>
        <section class="auth-main"><div class="auth-card">${inner}</div></section>
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
      if (user.twoFA) {
        App.state.pending = { purpose: '2fa', userId: user.id, email, password };
        await App.issueCode(email, '2fa');
        return App.nav('#/verificar');
      }
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
  Views.verify = () => {
    const p = App.state.pending;
    if (!p) return App.nav('#/entrar', true);
    const is2fa = p.purpose === '2fa';
    authLayout(`
      <h1>${is2fa ? 'Verificação em duas etapas' : 'Confirme seu e-mail'}</h1>
      <p class="muted">Enviamos um código de 6 dígitos para <b>${esc(p.email)}</b>. Ele expira em 10 minutos.</p>
      <div class="alert alert-info small">Protótipo: abra o botão <b>“E-mail simulado”</b> no canto da tela para ver o código.</div>
      <form id="code-form" novalidate>
        <label class="field"><span>Código</span><input type="text" name="code" class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}" required></label>
        <div class="alert alert-error hidden" id="code-err"></div>
        <button class="btn btn-primary btn-block">Confirmar</button>
      </form>
      <div class="row between small">
        <button class="link-btn" id="resend">Reenviar código</button>
        <button class="link-btn" id="cancel">Voltar para o login</button>
      </div>`);
    const form = $('#code-form');
    const err = $('#code-err');
    form.code.addEventListener('input', () => { form.code.value = form.code.value.replace(/\D/g, '').slice(0, 6); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showErr(err, '');
      const code = form.code.value;
      if (!/^\d{6}$/.test(code)) return showErr(err, 'Digite os 6 números do código.');
      const res = await App.checkCode(p.email, is2fa ? '2fa' : 'verify', code);
      if (!res.ok || !p.userId) return showErr(err, res.ok ? 'Código incorreto.' : res.error);
      const user = Store.user(p.userId);
      if (!is2fa) { user.emailVerified = true; Store.save(); U.toast('E-mail confirmado! Bem-vinda ao Eleva.', 'ok'); }
      App.completeLogin(user, p.password);
    });
    $('#resend').addEventListener('click', async () => {
      const wait = 30000 - (Date.now() - lastResend);
      if (wait > 0) return U.toast(`Aguarde ${Math.ceil(wait / 1000)}s para reenviar.`);
      lastResend = Date.now();
      if (p.userId) await App.issueCode(p.email, is2fa ? '2fa' : 'verify');
      U.toast('Se o e-mail estiver correto, um novo código foi enviado.');
    });
    $('#cancel').addEventListener('click', () => { App.state.pending = null; App.nav('#/entrar'); });
  };

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
