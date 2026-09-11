# Listas — Tarefas e Compras

PWA simples, sem framework e sem servidor: tarefas e listas de compras que funcionam offline
e podem ser instaladas no celular como app. Tudo fica no `localStorage` do aparelho.

## O que tem

**Tarefas**
- Adicionar com prazo e prioridade (normal / importante / urgente)
- Marcar como concluída, editar (toque no texto), apagar com "Desfazer"
- Filtro pendentes / todas / concluídas e resumo de atrasadas e "para hoje"
- Ordem automática: urgentes primeiro, depois por prazo

**Compras**
- Várias listas (Mercado, Farmácia, Churrasco…) — botão "+ Nova" ou pelo menu ⋯
- Quantidade direto no texto: `2 leite`, `arroz 5kg`, `500g queijo`
- Item marcado vai para "No carrinho"; "Desmarcar tudo" reaproveita a lista na próxima compra
- Autocompletar com itens já usados
- Compartilhar a lista (WhatsApp etc.) ou copiar como texto

**Geral**
- Instalável (botão no menu ⋯ quando o navegador permitir)
- Exportar / importar backup em JSON
- Funciona offline via service worker

## Estrutura

```
index.html              tela única com as duas abas
manifest.webmanifest    metadados do PWA
sw.js                   service worker (cache do app shell)
assets/css/style.css
assets/js/app.js        toda a lógica
assets/icons/           ícones 192 / 512 / maskable
```

## Publicar no GitHub Pages

1. Suba a pasta para um repositório.
2. Em *Settings → Pages*, escolha a branch `main` e a pasta `/ (root)`.
3. Abra a URL gerada no celular e use "Adicionar à tela inicial".

Sempre que publicar uma mudança, **suba o `VERSAO` em `sw.js`** (`listas-v1` → `listas-v2`),
senão os celulares que já instalaram continuam servindo os arquivos antigos do cache.

## Rodar localmente

Precisa ser servido por HTTP (service worker não funciona em `file://`). Qualquer servidor
estático serve, por exemplo:

```bash
npx serve .
```
