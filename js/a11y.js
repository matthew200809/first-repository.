'use strict';
/*
 * Acessibilidade e navegabilidade: painel de preferências, botão de tema, ajuda com atalhos de teclado,
 * tour guiado das cinco áreas, título e anúncio de cada página e foco no título ao trocar de tela.
 */
const A11y = (() => {
  const { esc, $, $$ } = U;

  const ICON = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    a11y: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="4.5" r="1.8"/><path d="M5 8.5l7 1.5 7-1.5M12 10v5m0 0l-3 6m3-6l3 6"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/></svg>',
  };

  /* Botões do topo: tema, acessibilidade e ajuda */
  function toolsHtml({ help = true } = {}) {
    const dark = Prefs.effectiveTheme() === 'dark';
    return `
      <button type="button" class="icon-toggle" data-tool="theme" aria-label="${dark ? 'Ativar modo claro' : 'Ativar modo escuro'}" title="${dark ? 'Modo claro' : 'Modo escuro'}">${dark ? ICON.sun : ICON.moon}</button>
      <button type="button" class="icon-toggle" data-tool="a11y" aria-label="Acessibilidade" title="Acessibilidade">${ICON.a11y}</button>
      ${help ? `<button type="button" class="icon-toggle" data-tool="help" aria-label="Ajuda e atalhos de teclado" title="Ajuda (tecla ?)">${ICON.help}</button>` : ''}`;
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tool]');
    if (!t) return;
    if (t.dataset.tool === 'theme') {
      const next = Prefs.toggleTheme();
      U.announce(next === 'dark' ? 'Modo escuro ativado' : 'Modo claro ativado');
      refreshToolIcons();
    } else if (t.dataset.tool === 'a11y') openPanel();
    else if (t.dataset.tool === 'help') openHelp();
  });
  function refreshToolIcons() {
    const dark = Prefs.effectiveTheme() === 'dark';
    $$('[data-tool="theme"]').forEach((b) => {
      b.innerHTML = dark ? ICON.sun : ICON.moon;
      b.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
      b.title = dark ? 'Modo claro' : 'Modo escuro';
    });
  }
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshToolIcons);

  /* ---------------- Painel de acessibilidade ---------------- */
  function seg(name, options, current) {
    return `<div class="seg" role="group" aria-label="${esc(name)}">${options.map(([v, l, aria]) =>
      `<button type="button" data-seg="${esc(name)}" data-value="${esc(v)}" aria-pressed="${String(v) === String(current)}" ${aria ? `aria-label="${esc(aria)}"` : ''}>${esc(l)}</button>`).join('')}</div>`;
  }
  const sw = (key, label, hint, on) => `
    <div class="toggle-row"><div><div id="lbl-${key}">${label}</div><div class="tiny muted">${hint}</div></div>
    <label class="switch"><input type="checkbox" data-pref="${key}" ${on ? 'checked' : ''} aria-labelledby="lbl-${key}"><span></span></label></div>`;

  function panelBody() {
    const p = Prefs.get();
    return `
      <div class="a11y-grid">
        <div class="toggle-row"><div><div>Tema</div><div class="tiny muted">“Sistema” acompanha o seu aparelho.</div></div>
          ${seg('Tema', [['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Sistema']], p.theme)}</div>
        <div class="toggle-row"><div><div>Tamanho do texto</div><div class="tiny muted">Aumenta todos os textos do app.</div></div>
          ${seg('Tamanho do texto', Prefs.SCALES.map(([v, l]) => [v, l, `Texto ${Math.round(v * 100)}%`]), p.scale)}</div>
        ${sw('contrast', 'Alto contraste', 'Textos e bordas mais fortes.', p.contrast)}
        ${sw('font', 'Fonte de leitura fácil', 'Usa a Atkinson Hyperlegible, criada para baixa visão.', p.font)}
        ${sw('spacing', 'Mais espaço entre linhas', 'Ajuda na leitura com dislexia.', p.spacing)}
        ${sw('links', 'Sublinhar links', 'Identifica links sem depender da cor.', p.links)}
        ${sw('motion', 'Reduzir animações', 'Remove transições e movimentos.', p.motion)}
      </div>`;
  }
  function bindPanel(root) {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-seg]');
      if (!b) return;
      const v = b.dataset.value;
      if (b.dataset.seg === 'Tema') Prefs.set({ theme: v });
      else Prefs.set({ scale: Number(v) });
      $$(`[data-seg="${b.dataset.seg}"]`, root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      refreshToolIcons();
      U.announce(`${b.dataset.seg}: ${b.getAttribute('aria-label') || b.textContent}`);
    });
    root.addEventListener('change', (e) => {
      const k = e.target.dataset.pref;
      if (k) { Prefs.set({ [k]: e.target.checked }); U.announce(`${$(`#lbl-${k}`, root).textContent}: ${e.target.checked ? 'ativado' : 'desativado'}`); }
    });
  }
  function openPanel() {
    const m = U.modal(`
      <h2>Acessibilidade</h2>
      <p class="muted small">As preferências valem para este aparelho, inclusive na tela de entrada.</p>
      <div data-panel>${panelBody()}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-reset>Restaurar padrão</button>
        <button class="btn btn-outline" data-tour>Fazer o tour do app</button>
        <button class="btn btn-primary" data-close>Pronto</button>
      </div>`);
    bindPanel($('[data-panel]', m.el));
    $('[data-reset]', m.el).addEventListener('click', () => {
      Prefs.set({ theme: 'system', scale: 1, contrast: false, font: false, spacing: false, links: false, motion: false });
      $('[data-panel]', m.el).innerHTML = panelBody();
      refreshToolIcons();
      U.announce('Preferências restauradas');
    });
    $('[data-tour]', m.el).addEventListener('click', () => { m.close(); openTour(); });
  }

  /* ---------------- Ajuda: atalhos de teclado ---------------- */
  const SHORTCUTS = [
    ['g f', 'Ir para o Feed'], ['g c', 'Ir para a Comunidade'], ['g z', 'Ir para a Zona Segura'], ['g p', 'Ir para o seu Perfil'],
    ['g a', 'Ir para Ajustes'], ['/', 'Buscar no Feed'], ['Esc Esc', 'Saída rápida da Zona Segura'], ['?', 'Abrir esta ajuda'],
  ];
  function openHelp() {
    const m = U.modal(`
      <h2>Como navegar no Eleva</h2>
      <p class="small">O Eleva tem cinco áreas, sempre no mesmo lugar: na barra do topo no computador e na barra de baixo no celular.</p>
      <ul class="why">
        <li><span><b>Feed</b>: artigos para ler, curtir e salvar para depois.</span></li>
        <li><span><b>Comunidade</b>: perguntas e respostas e salas de conversa por tema.</span></li>
        <li><span><b>Zona Segura</b>: mensagens privadas criptografadas.</span></li>
        <li><span><b>Perfil</b>: suas informações e o seu painel privado.</span></li>
        <li><span><b>Ajustes</b>: segurança, privacidade e notificações.</span></li>
      </ul>
      <h3 class="section-title">Atalhos de teclado</h3>
      <div class="shortcut-list">${SHORTCUTS.map(([k, l]) => `<span>${k.split(' ').map((x) => `<kbd>${esc(x)}</kbd>`).join(' ')}</span><span>${esc(l)}</span>`).join('')}</div>
      <p class="tiny muted">Use <kbd>Tab</kbd> para avançar, <kbd>Shift</kbd> + <kbd>Tab</kbd> para voltar e <kbd>Enter</kbd> para ativar. O link “Pular para o conteúdo” aparece no primeiro <kbd>Tab</kbd>.</p>
      <div class="modal-actions"><button class="btn btn-outline" data-tour>Fazer o tour</button><button class="btn btn-primary" data-close>Fechar</button></div>`, { wide: true });
    $('[data-tour]', m.el).addEventListener('click', () => { m.close(); openTour(); });
  }

  /* ---------------- Tour guiado ---------------- */
  const TOUR = [
    { icon: 'feed', title: 'Feed', text: 'Artigos de divulgação científica, estudos de caso e textos de outras líderes. Curta um artigo para salvá-lo em “Curtidos · ler depois”.', href: '#/feed' },
    { icon: 'comunidade', title: 'Comunidade', text: 'Pergunte sobre o mercado corporativo, até de forma anônima, e converse nas salas por tema. Cada sala mostra suas regras.', href: '#/comunidade' },
    { icon: 'zona', title: 'Zona Segura', text: 'Mensagens privadas criptografadas de ponta a ponta. Só você e a outra pessoa conseguem ler. Tem saída rápida e modo discreto.', href: '#/zona' },
    { icon: 'perfil', title: 'Perfil', text: 'Seu perfil público e um painel privado, que só você vê, com visualizações, pesquisas, artigos curtidos e conexões.', href: null },
    { icon: 'config', title: 'Ajustes e segurança', text: 'Ative a verificação em duas etapas, revise suas sessões e ajuste privacidade, notificações e acessibilidade.', href: '#/config#seguranca' },
  ];
  function openTour() {
    let i = 0;
    const m = U.modal('<div data-tour-body></div>');
    const draw = () => {
      const s = TOUR[i];
      $('[data-tour-body]', m.el).innerHTML = `
        <div class="steps" aria-hidden="true">${TOUR.map((_, j) => `<span class="${j <= i ? 'on' : ''}"></span>`).join('')}</div>
        <p class="tiny muted">Passo ${i + 1} de ${TOUR.length}</p>
        <h2>${esc(s.title)}</h2>
        <div class="tour-step"><div class="ill">${App.icon(s.icon)}<p class="small">${esc(s.text)}</p></div></div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-skip>${i === TOUR.length - 1 ? 'Fechar' : 'Pular tour'}</button>
          ${i > 0 ? '<button class="btn btn-outline" data-prev>Voltar</button>' : ''}
          <button class="btn btn-primary" data-next>${i === TOUR.length - 1 ? 'Começar a usar' : 'Próximo'}</button>
        </div>`;
      const h = $('h2', m.el);
      h.id = m.el.getAttribute('aria-labelledby');
      U.announce(`Passo ${i + 1} de ${TOUR.length}: ${s.title}`);
      $('[data-next]', m.el).focus();
    };
    const finish = () => { Prefs.set({ tourDone: true }); m.close(); };
    m.el.addEventListener('click', (e) => {
      if (e.target.closest('[data-next]')) { if (i < TOUR.length - 1) { i++; draw(); } else finish(); }
      else if (e.target.closest('[data-prev]')) { i--; draw(); }
      else if (e.target.closest('[data-skip]')) finish();
    });
    draw();
  }

  /* ---------------- Atalhos ---------------- */
  let gPressed = 0;
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable || U.hasModal()) return;
    if (e.key === '?') { e.preventDefault(); openHelp(); return; }
    if (!App.state.meId) return;
    if (e.key === '/') {
      e.preventDefault();
      if (location.hash.startsWith('#/feed')) { const s = $('#search-form input'); if (s) s.focus(); }
      else App.nav('#/feed?focus=busca');
      return;
    }
    if (e.key === 'g') { gPressed = Date.now(); return; }
    if (Date.now() - gPressed < 1200) {
      const dest = { f: '#/feed', c: '#/comunidade', z: '#/zona', p: `#/perfil/${App.state.meId}`, a: '#/config' }[e.key];
      gPressed = 0;
      if (dest) { e.preventDefault(); App.nav(dest); }
    }
  });

  /* ---------------- Depois de cada troca de tela ---------------- */
  let firstRender = true;
  function afterRender(fallbackTitle, pathChanged) {
    const h1 = $('#app h1');
    const name = (h1 && h1.textContent.trim()) || fallbackTitle || 'Eleva';
    document.title = name === 'Eleva' ? 'Eleva' : `${name} · Eleva`;
    refreshToolIcons();
    if (firstRender) { firstRender = false; return; }
    if (!pathChanged) return;
    // Leva o foco ao título da nova página, para leitores de tela e teclado começarem do lugar certo
    if (!U.hasModal() && h1 && !document.activeElement?.closest?.('#app form')) {
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
    }
    U.announce(`Página: ${name}`);
  }

  return { ICON, toolsHtml, openPanel, openHelp, openTour, afterRender, refreshToolIcons };
})();
