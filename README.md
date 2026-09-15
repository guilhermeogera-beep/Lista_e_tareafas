# Tarefas

PWA de lista de tarefas para usar em casa, a dois: funciona offline, instala no celular como app
e sincroniza entre os aparelhos pelo Supabase.

## Como usar

- **Login**: cada pessoa cria seu cadastro (e-mail + senha) na primeira tela.
- **Listas**: crie quantas quiser, **privadas** (só você) ou **compartilhadas**.
- **Compartilhar**: botão 👥 Compartilhar dentro da lista. Gera um link/código de convite para
  mandar no WhatsApp; quem abrir e entrar na conta já cai na lista. Também dá para adicionar pelo
  e-mail em *Pessoas da lista* (menu ⋯). Uma lista privada vira compartilhada ao clicar em Compartilhar.
- **Check por pessoa**: em lista compartilhada, cada membro marca o seu check. O cartão mostra
  quantos já fizeram (ex.: 👥 1/3).
- **Toque** no cartão marca/desmarca; **segure** (~meio segundo) abre o editor.
- **Grupos**, **prazo**, **prioridade**, **observação** — por lista, no menu ⋯.
- Funciona offline: o que você fizer sem internet sobe quando reconectar.

## Supabase

1. Crie um projeto em supabase.com.
2. *SQL Editor → New query*: cole [`supabase/schema.sql`](supabase/schema.sql) inteiro e rode
   (pode repetir; ele é idempotente). **Atenção**: ele apaga as tabelas da versão antiga sem login.
3. *Authentication → Providers → Email*: se não quiser exigir confirmação por e-mail, desligue
   **Confirm email**. (Com ele ligado, o cadastro só entra depois de clicar no link do e-mail.)
4. *Project Settings → API*: copie a URL e a chave `anon`/`publishable` para [`config.js`](config.js).

Segurança: tudo passa por RLS — cada pessoa só lê e edita listas de que é membro; o check é
só o próprio; só o dono apaga a lista ou remove pessoas.

## Estrutura

```
index.html              tela única
config.js               URL + chave anon do Supabase (vazio = só local)
manifest.webmanifest    metadados do PWA
sw.js                   service worker (cache do app shell + lib do Supabase)
supabase/schema.sql     tabela, políticas e realtime
assets/css/style.css
assets/js/app.js        toda a lógica
assets/icons/           ícones 192 / 512 / maskable
```

## Publicar no GitHub Pages

1. Suba a pasta para um repositório.
2. Em *Settings → Pages*, escolha a branch `main` e a pasta `/ (root)`.
3. Abra a URL no celular e use "Adicionar à tela inicial".

Sempre que publicar uma mudança, **suba o número da versão** nos dois lugares: `VERSAO` em `sw.js`
(`tarefas-v14` → `tarefas-v15`, e o `?v=14` da lista de arquivos) e o `?v=14` dos `<link>`/`<script>` do `index.html`,
senão os celulares que já instalaram continuam servindo os arquivos antigos do cache.

## Rodar localmente

Precisa ser servido por HTTP (service worker não funciona em `file://`):

```bash
npx serve .
```
