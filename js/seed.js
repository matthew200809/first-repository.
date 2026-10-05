'use strict';
/* Conteúdo de exemplo: usuárias fictícias, artigos, perguntas, salas e a conta de demonstração. */
const Seed = (() => {
  const DAY = 86400000;
  const now = () => Date.now();
  const DEMO_EMAIL = 'demo@eleva.app';
  const DEMO_PASSWORD = 'Prototipo#Demo!2026';

  function defaultSettings() {
    return {
      saveSearch: true, hideFollowers: false, dmPolicy: 'requests', discreet: false, defaultTimer: 0,
      notif: { follows: true, comments: true, answers: true, dms: true, digest: false },
    };
  }

  function baseUser(fields) {
    return Object.assign({
      id: U.uid('u'), email: '', emailVerified: true, pwd: null, bio: '', photo: null,
      followers: [], following: [], connections: [], blocked: [], profileViews: 0, searchHistory: [],
      settings: defaultSettings(), twoFA: false, zonePin: null, keys: null, sessions: [], verified: {},
      termsAcceptedAt: now(), createdAt: now(), fictional: false,
    }, fields);
  }

  const PEOPLE = [
    { id: 'u_ana', name: 'Ana Ribeiro', role: 'Diretora de Operações · Grupo Atlas', bio: 'Engenheira de produção, mãe da Lia e mentora de novas líderes. Escrevo sobre gestão, dados e coragem.' },
    { id: 'u_beatriz', name: 'Beatriz Nogueira', role: 'CFO · Fintech Horizonte', bio: 'Finanças com propósito. Falo sobre carreira em finanças, negociação salarial e conselhos de administração.' },
    { id: 'u_carla', name: 'Carla Menezes', role: 'Head de Engenharia · Nuvem Tech', bio: 'Construo times de tecnologia diversos. Ex-desenvolvedora, eterna aprendiz.' },
    { id: 'u_debora', name: 'Débora Santos', role: 'Gerente de Pessoas · Varejo Sol', bio: 'RH estratégico, cultura e saúde mental no trabalho.' },
    { id: 'u_elisa', name: 'Elisa Martins', role: 'Pesquisadora · Núcleo de Estudos de Gênero', bio: 'Pesquiso liderança feminina e desigualdade nas organizações. Divulgação científica sem complicação.' },
    { id: 'u_fernanda', name: 'Fernanda Lima', role: 'Fundadora · Studio Raiz', bio: 'Empreendedora, primeira da família a fazer faculdade. Conto o que ninguém me contou.' },
  ];

  const ARTICLES = [
    { id: 'a1', authorId: 'u_elisa', category: 'ciencia', days: 1,
      title: 'O “teto de vidro” ainda existe? O que a pesquisa diz',
      subtitle: 'Uma leitura acessível sobre por que mulheres avançam menos nos degraus mais altos das empresas.',
      body: `Quando falamos em teto de vidro, falamos de barreiras que não aparecem no organograma, mas que impedem mulheres qualificadas de chegar aos cargos mais altos. O termo surgiu nos anos 1980 e, desde então, virou tema de muitas pesquisas em administração, economia e psicologia social.

Um achado recorrente nesses estudos é que a perda de mulheres não acontece só no topo. Ela começa cedo, no primeiro degrau de gestão — o chamado “degrau quebrado”. Se menos mulheres são promovidas a coordenadoras, haverá menos candidatas a diretoras anos depois.

Outro ponto importante é a diferença entre mentoria e patrocínio. Mentoras aconselham; patrocinadoras usam a própria influência para indicar alguém a oportunidades. Pesquisas qualitativas mostram que mulheres costumam receber muita mentoria e pouco patrocínio.

O que funciona? Critérios de promoção claros e escritos, avaliação de desempenho baseada em resultados (e não em “estilo”), metas de diversidade acompanhadas pela liderança e redes de apoio entre mulheres — como esta.

Na próxima semana, trago uma lista de leituras para quem quer se aprofundar.` },
    { id: 'a2', authorId: 'u_ana', category: 'caso', days: 2,
      title: 'Estudo de caso: como reestruturamos a escala de turnos sem perder ninguém',
      subtitle: 'Uma operação 24/7, um time exausto e uma decisão que envolveu as próprias equipes.',
      body: `Em 2024, nossa planta tinha rotatividade alta no turno da noite. As pessoas pediam desligamento logo após o primeiro ano, e o motivo mais citado nas entrevistas de saída era o mesmo: a escala não conversava com a vida real.

Em vez de desenhar uma solução na sala de reuniões, montamos um grupo com representantes de cada turno. Foram seis semanas de conversa, simulações em planilha e dois pilotos.

O resultado foi uma escala com previsibilidade de folgas por trimestre e a possibilidade de troca entre colegas por um aplicativo simples. A produtividade se manteve, e a rotatividade caiu de forma consistente nos meses seguintes.

Aprendizado principal: liderança não é ter a resposta, é criar as condições para que a resposta apareça — e assumir o risco de testá-la.` },
    { id: 'a3', authorId: 'u_beatriz', category: 'autoral', days: 3,
      title: 'Negociar salário não é ser “difícil”',
      subtitle: 'O roteiro que eu gostaria de ter recebido aos 25 anos.',
      body: `Durante anos aceitei a primeira proposta. Achava que pedir mais soaria ingrato. Hoje, como CFO, sei que a primeira proposta quase sempre tem margem — e que a empresa espera a conversa.

Meu roteiro: pesquise a faixa de mercado para o cargo; liste três entregas concretas com números; peça o valor que você quer, em silêncio depois de falar; e, se o salário não mudar, negocie outras coisas — bônus, data de revisão, formação, flexibilidade.

Negociar é uma competência como qualquer outra. Treine com uma amiga. Treine em voz alta. E lembre: o “não” você já tem.` },
    { id: 'a4', authorId: 'u_carla', category: 'autoral', days: 4,
      title: 'Ser a única mulher na sala de engenharia',
      subtitle: 'Sobre pertencimento, síndrome da impostora e o que eu faço hoje como gestora.',
      body: `Por muitos anos fui a única mulher nas reuniões técnicas. Eu ensaiava cada frase antes de falar e repetia para mim mesma que precisava ser duas vezes melhor.

Hoje lidero um time de quarenta pessoas e tenho algumas regras: toda reunião tem pauta enviada antes (isso ajuda quem precisa de tempo para se preparar), ideias são creditadas a quem as teve e processos seletivos sempre têm pelo menos uma mulher na banca.

Não são grandes revoluções. São pequenas decisões que, somadas, mudam quem se sente à vontade para ficar.` },
    { id: 'a5', authorId: 'u_elisa', category: 'ciencia', days: 6,
      title: 'Liderança feminina e resultados: cuidado com as manchetes',
      subtitle: 'Correlação não é causalidade — e isso importa para o nosso argumento.',
      body: `Você provavelmente já leu manchetes dizendo que empresas com mais mulheres na liderança lucram mais. Parte dos estudos encontra essa associação, outros não encontram. Como ler isso?

Primeiro: muitos desses estudos mostram correlação. Empresas que já vão bem podem ter mais recursos para investir em diversidade, e não o contrário.

Segundo: o argumento por equidade não deveria depender de lucro. Mulheres devem ter acesso igual a oportunidades porque é justo — e porque desperdiçar talento é ruim para todo mundo.

Usar a ciência com honestidade fortalece a nossa causa. Quando alguém citar um número, pergunte: qual a fonte, qual a amostra e o que exatamente foi medido?` },
    { id: 'a6', authorId: 'u_debora', category: 'caso', days: 8,
      title: 'Programa de retorno pós-licença: o que mudou em um ano',
      subtitle: 'Como uma rede de varejo redesenhou a volta ao trabalho de mães e pais.',
      body: `Percebemos que muitas profissionais pediam desligamento nos meses após a licença-maternidade. Criamos um programa de retorno com três pilares: transição gradual de jornada, conversa estruturada com a liderança antes da volta e um grupo de apoio entre pares.

Também treinamos gestoras e gestores para não tomar decisões “protetoras” no lugar da profissional — como tirá-la de um projeto sem perguntar.

Um ano depois, a permanência após o retorno aumentou e, nas pesquisas internas, a confiança na liderança subiu. O custo foi baixo; o que exigiu esforço foi mudar hábitos.` },
    { id: 'a7', authorId: 'u_fernanda', category: 'autoral', days: 10,
      title: 'Para a próxima geração: cinco coisas que ninguém me contou',
      subtitle: 'Uma carta para as mulheres que estão chegando agora ao mercado.',
      body: `1. Você não precisa saber tudo para se candidatar. Se cumpre boa parte dos requisitos, vá.

2. Rede de contatos não é bajulação. É ajudar e ser ajudada, com constância.

3. Anote suas conquistas toda sexta-feira. Na avaliação, você vai agradecer.

4. Peça feedback específico: “o que eu poderia ter feito diferente nessa apresentação?” rende mais do que “como estou indo?”.

5. Descanso faz parte do trabalho. Ninguém lidera bem exausta.

Estamos aqui por vocês. Contem com a gente.` },
  ];

  const QUESTIONS = [
    { id: 'q1', authorId: 'u_fernanda', anonymous: false, days: 1,
      title: 'Como apresentar minha empresa para investidores sem parecer “pequena”?',
      body: 'Tenho uma empresa de design com 8 pessoas e vou conversar com um fundo. Que números vocês levariam para uma primeira reunião?',
      answers: [
        { userId: 'u_beatriz', text: 'Leve receita recorrente, crescimento mês a mês, margem e custo de aquisição de clientes. Pequena não é problema; falta de clareza é.', useful: ['u_ana', 'u_carla'] },
        { userId: 'u_ana', text: 'Ensaie as perguntas difíceis com alguém de fora. E mostre o que você faria com o dinheiro, com prazos.', useful: ['u_fernanda'] },
      ] },
    { id: 'q2', authorId: 'u_debora', anonymous: true, days: 2,
      title: 'Meu gestor interrompe minhas falas nas reuniões. Como lidar?',
      body: 'Acontece com frequência e só comigo. Não quero criar conflito, mas está afetando como sou vista pelo time.',
      answers: [
        { userId: 'u_carla', text: 'Uma frase curta e calma ajuda: “Só vou terminar meu raciocínio”. E vale combinar com colegas de apoiarem: “Quero ouvir o final da fala dela”.', useful: ['u_debora', 'u_elisa', 'u_ana'] },
      ] },
    { id: 'q3', authorId: 'u_carla', anonymous: false, days: 5,
      title: 'Indicações de cursos de finanças para quem não é da área?',
      body: 'Assumi um orçamento grande este ano e quero entender melhor DRE e fluxo de caixa.',
      answers: [] },
  ];

  const ROOMS = [
    { id: 'r_fin', name: 'Finanças', desc: 'Carreira em finanças, investimentos, negociação e orçamento.' },
    { id: 'r_tec', name: 'Tecnologia', desc: 'Mulheres em tecnologia, produto, dados e inovação.' },
    { id: 'r_pes', name: 'Gestão de Pessoas', desc: 'Liderança de times, cultura, feedback e saúde mental.' },
    { id: 'r_emp', name: 'Empreendedorismo', desc: 'Abrir, manter e crescer o próprio negócio.' },
  ];
  const ROOM_MSGS = {
    r_fin: [['u_beatriz', 'Bom dia! Alguém aqui já participou de conselho consultivo? Quero trocar experiências.'], ['u_fernanda', 'Eu participei de um em uma ONG, posso contar como foi.']],
    r_tec: [['u_carla', 'Estamos com vagas abertas para pessoas desenvolvedoras júnior. Compartilhem com quem está começando!'], ['u_elisa', 'Que ótimo! Vou divulgar no grupo de pesquisa.']],
    r_pes: [['u_debora', 'Qual a melhor forma de conduzir uma conversa de feedback difícil? Tenho uma amanhã.'], ['u_ana', 'Fatos, impacto e pergunta aberta. E escute mais do que fala.']],
    r_emp: [['u_fernanda', 'Dica do dia: separe as contas da empresa das contas pessoais desde o primeiro mês.']],
  };

  async function run(db) {
    for (const p of PEOPLE) {
      const kp = await Sec.generateKeyPair();
      db.users.push(baseUser({
        ...p, email: `${p.id}@exemplo.eleva`, fictional: true, profileViews: 40 + Math.floor(Math.random() * 300),
        keys: { pub: kp.pubJwk }, privJwk: kp.privJwk, createdAt: now() - 90 * DAY,
      }));
    }
    const ids = PEOPLE.map((p) => p.id);
    db.users.forEach((u, i) => {
      // Rede de seguidoras entre as usuárias fictícias
      ids.forEach((other, j) => {
        if (other !== u.id && (i + j) % 3 !== 0) {
          u.following.push(other);
          db.users.find((x) => x.id === other).followers.push(u.id);
        }
      });
    });
    db.users.find((u) => u.id === 'u_ana').connections.push('u_beatriz', 'u_carla');
    db.users.find((u) => u.id === 'u_beatriz').connections.push('u_ana');
    db.users.find((u) => u.id === 'u_carla').connections.push('u_ana');

    db.articles = ARTICLES.map((a) => ({
      id: a.id, authorId: a.authorId, category: a.category, title: a.title, subtitle: a.subtitle, body: a.body,
      createdAt: now() - a.days * DAY, likes: ids.filter((_, i) => (i + a.days) % 2 === 0), comments: [],
    }));
    db.articles[0].comments.push({ id: U.uid('c'), userId: 'u_ana', text: 'O conceito de “degrau quebrado” explica muito do que vi na minha carreira. Obrigada pelo texto!', at: now() - 20 * 3600000 });
    db.articles[2].comments.push({ id: U.uid('c'), userId: 'u_fernanda', text: 'Salvei para reler antes da minha próxima negociação.', at: now() - 2 * DAY });

    db.questions = QUESTIONS.map((q) => ({
      id: q.id, authorId: q.authorId, anonymous: q.anonymous, title: q.title, body: q.body, at: now() - q.days * DAY,
      answers: q.answers.map((a, i) => ({ id: U.uid('ans'), userId: a.userId, text: a.text, useful: a.useful, at: now() - q.days * DAY + (i + 1) * 3600000 })),
    }));

    db.rooms = ROOMS.map((r) => ({
      ...r, messages: (ROOM_MSGS[r.id] || []).map(([userId, text], i) => ({ id: U.uid('rm'), userId, text, at: now() - (5 - i) * 3600000 })),
    }));
    db.seeded = true;
  }

  return { run, baseUser, defaultSettings, DEMO_EMAIL, DEMO_PASSWORD };
})();
