# Eleva — protótipo navegável

App para conectar mulheres na liderança, desenvolvido com o Instituto Reciclar. Visual inspirado no Substack: fundo branco, roxo nos botões principais, lilás claro nos cards e conversas, e tipografia serifada para a leitura.

## Como abrir

É um site estático, sem instalação nem build.

```bash
python3 -m http.server 8000
# depois acesse http://localhost:8000
```

Também funciona abrindo `index.html` direto no Chrome. Para testar rápido, use **“Explorar com uma conta de demonstração”** na tela de entrada. Os códigos de verificação aparecem no botão **“E-mail simulado”**.

## Telas

| Área | O que tem |
|---|---|
| Entrada | Texto “Quem somos”, login, cadastro (nome, cargo/empresa, e-mail, senha, confirmação e aceite de Termos e Privacidade), confirmação de e-mail, “esqueci minha senha” |
| Feed | Artigos (divulgação científica, estudos de caso, textos autorais), busca, filtros, “Curtidos · ler depois”, curtir, comentar, compartilhar o artigo ou o perfil da autora, escrever artigo |
| Comunidade | Perguntas e respostas (com pergunta anônima e “resposta útil”) e salas de chat por tema (Finanças, Tecnologia, Gestão de Pessoas, Empreendedorismo) com regras visíveis |
| Zona Segura | Mensagens diretas criptografadas de ponta a ponta, pedidos de mensagem, código de segurança, mensagens temporárias, PIN, modo discreto e saída rápida |
| Perfil | Foto, nome, cargo, bio, seguidoras/seguindo, Seguir, Conectar, Compartilhar perfil (card + link) e um painel privado com visualizações, histórico de pesquisas, artigos curtidos e conexões |
| Ajustes | Editar perfil, senha, duas etapas, sessões, privacidade, Zona Segura, notificações, bloqueadas e seus dados (LGPD) |

## Acessibilidade e navegação

- **Modo escuro**: escolha Claro, Escuro ou Sistema. O botão de lua/sol no topo troca na hora.
- **Painel de acessibilidade**: tamanho do texto (até 130%), alto contraste, fonte de leitura fácil (Atkinson Hyperlegible), mais espaço entre linhas, links sublinhados e menos animações. A preferência vale para o aparelho, inclusive na tela de entrada.
- **Teclado**: link "Pular para o conteúdo", foco sempre visível, modais que prendem e devolvem o foco, menus que fecham com Esc e atalhos (`g f` Feed, `g c` Comunidade, `g z` Zona Segura, `g p` Perfil, `g a` Ajustes, `/` busca, `?` ajuda).
- **Leitor de tela**: cada página tem título próprio, o foco vai para o título ao trocar de tela, mudanças são anunciadas, botões de ícone têm nome e estados (curtido, ativado, aberto) são informados.
- **Navegabilidade**: as cinco áreas ficam sempre no mesmo lugar, há um tour guiado no primeiro acesso (pode ser refeito em Ajustes) e uma ajuda com os atalhos.

## Segurança

- **Senhas**: guardadas só como hash PBKDF2-SHA256 (310 mil iterações e sal aleatório). O medidor de força barra senhas curtas, comuns ou que contêm o nome ou o e-mail.
- **Login**: após 5 tentativas erradas, o acesso fica bloqueado por 1 minuto. A mensagem de erro é a mesma para e-mail inexistente e senha errada, e o tempo de resposta também.
- **Verificação**: o e-mail é confirmado por código de 6 dígitos (expira em 10 min, máximo de 5 tentativas). A recuperação de senha e o cadastro não revelam se o e-mail já existe.
- **Verificação em duas etapas (2FA)**: por app autenticador (TOTP, RFC 6238, compatível com Google Authenticator, Microsoft Authenticator, Authy e 1Password) ou por código no e-mail. Ao ativar, a usuária recebe 10 códigos de backup de uso único, guardados só como hash. O mesmo código TOTP não vale duas vezes, e 5 erros bloqueiam o login por 1 minuto. Depois do cadastro, a tela "Proteja sua conta" convida a ativar a 2FA; enquanto ela estiver desligada, uma faixa no app explica por que vale a pena. Em Ajustes, o "Nível de proteção" mostra o que falta.
- **Sessão**: saída automática após 15 min sem uso (com aviso 1 min antes), lista de sessões com “Encerrar outras sessões” e pedido de senha para ações sensíveis. O usuário recebe um alerta por e-mail a cada novo acesso.
- **Zona Segura**: cada usuária tem um par de chaves ECDH P-256. A chave privada é guardada cifrada com a senha. Cada conversa usa AES-256-GCM com chave derivada por ECDH + HKDF, e o armazenamento só contém texto cifrado. O botão 👁 mostra o que o servidor vê. Também há código de segurança de 60 dígitos, PIN (com bloqueio após 5 erros), mensagens temporárias apagadas de verdade, modo discreto e saída rápida (botão ou Esc duas vezes). Quem não é conexão só pode enviar um pedido de mensagem, e dá para aceitar só pedidos de conexões.
- **Comunidade**: denúncia confidencial em todo conteúdo, bloqueio de usuárias nos dois sentidos, limite de frequência contra spam e bloqueio de CPF (com validação dos dígitos) e de celular em áreas abertas.
- **Privacidade/LGPD**: métricas visíveis só para a dona, histórico de pesquisas que pode ser pausado ou apagado e opção de ocultar o número de seguidoras. A usuária pode ver, copiar e baixar os próprios dados e excluir a conta. As fotos são redesenhadas para remover GPS/EXIF.
- **Web**: Content-Security-Policy sem scripts inline, `no-referrer`, e todo texto de usuária é escapado antes de ir para a tela (proteção contra XSS).

## Limites do protótipo

- Os dados ficam só no `localStorage` deste navegador. Não há servidor.
- Os e-mails (códigos e alertas) aparecem na “caixa de e-mail simulada”.
- Para testar a 2FA sem celular, as telas de código têm um “autenticador simulado”. Ele existe só no protótipo. Com um app autenticador de verdade, a chave mostrada na ativação também funciona.
- As outras usuárias, os artigos e as respostas são fictícios.
- A criptografia é real, mas didática: não tem sigilo futuro nem várias chaves por dispositivo.

## Para o app real

1. **Servidor com autenticação própria**: hash Argon2id, limite de tentativas por IP e por conta, tokens de sessão em cookie `HttpOnly`/`Secure`/`SameSite`, envio real de e-mails, cabeçalhos de segurança (CSP, HSTS, `frame-ancestors`) e moderação no servidor.
2. **Protocolo de mensagens auditado**, como o Signal Protocol (libsignal), no lugar da versão demonstrativa.
3. **Revisão jurídica** dos Termos de Uso e da Política de Privacidade (hoje em versão de modelo) e definição de um(a) encarregado(a) de dados (DPO).

## Estrutura

```
index.html            página única + política de segurança (CSP)
css/styles.css        identidade visual e layout responsivo
js/prefs.js           tema e preferências de acessibilidade (carregado no <head>)
js/a11y.js            painel de acessibilidade, atalhos, tour, títulos e foco por página
js/util.js            escape de HTML, modais acessíveis, avisos
js/security.js        senhas, 2FA (TOTP e códigos de backup), força de senha, chaves e criptografia, detecção de CPF/celular, remoção de metadados, anti-spam
js/store.js           "servidor" simulado (localStorage)
js/seed.js            conteúdo de exemplo
js/app.js             sessão, roteamento, denúncia/bloqueio, layout
js/views-*.js         telas (entrada, feed, comunidade, Zona Segura, perfil, ajustes)
```
