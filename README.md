# Tarefas

PWA de lista de tarefas para usar em casa, a dois: funciona offline, instala no celular como app
e sincroniza entre os aparelhos pelo Supabase.

## Como usar

- **Toque** no cartão da tarefa: marca / desmarca como concluída.
- **Duas bolinhas por tarefa** (menu ⋯): cada pessoa marca a sua (azul e verde); a tarefa só
  conclui quando as duas estão marcadas. Bom para coisas que os dois precisam fazer.
- **Segure** o cartão (~meio segundo): abre o editor (texto, prioridade, prazo, observação, apagar).
- **Grupos** (menu ⋯ → Grupos…): crie grupos como Casa, Mercado, Viagem. Os chips acima da lista
  filtram por grupo e a tarefa nova entra no grupo selecionado; no editor dá para trocar. Apagar um
  grupo não apaga as tarefas dele (ficam sem grupo).
- **Detalhes ▾**: mostra/oculta os contadores e os campos de prioridade e prazo.
- **Menu ⋯**: ligar/desligar prazo e duas bolinhas, apagar concluídas (pede confirmação, dá para desfazer),
  exportar/importar backup, instalar no celular. As configurações (prazo, duas bolinhas, grupos,
  detalhes abertos) sincronizam entre os aparelhos; só o filtro da lista fica local.

## Sincronização (Supabase)

Sem login: todo aparelho configurado com a mesma URL + chave vê a mesma lista. Serve para uso
em casa; não guarde nada sensível.

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra *SQL Editor → New query*, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e rode.
3. Em *Project Settings → API* copie a **Project URL** e a chave **anon public**.
4. Cole as duas em [`config.js`](config.js):

```js
window.SUPABASE_CONFIG = {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJ...'
};
```

5. Publique. Cada celular que abrir o app já sincroniza (o cabeçalho mostra "salvando…" ou
   "sem conexão"; sem `config.js` preenchido mostra "só neste aparelho").

Como funciona: cada tarefa tem um `atualizado` (timestamp). Ao salvar, o app envia as alteradas;
ao abrir, voltar para a tela ou reconectar, baixa tudo e a versão mais recente vence. Mudanças
do outro celular chegam na hora via Realtime. Apagar marca `apagado = true` (assim a remoção
chega no outro aparelho); tumbas com mais de 30 dias são limpas do celular.

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

Sempre que publicar uma mudança, **suba o `VERSAO` em `sw.js`** (`tarefas-v4` → `tarefas-v5`),
senão os celulares que já instalaram continuam servindo os arquivos antigos do cache.

## Rodar localmente

Precisa ser servido por HTTP (service worker não funciona em `file://`):

```bash
npx serve .
```
