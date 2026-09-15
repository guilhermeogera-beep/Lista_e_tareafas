/* Tarefas — listas privadas e compartilhadas, com login e check por pessoa.
   O servidor (Supabase) é a fonte da verdade; o localStorage guarda uma cópia para abrir rápido
   e uma fila do que ainda não subiu (para funcionar sem internet). */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const agora = () => Date.now();
const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const capitalizar = s => s.charAt(0).toUpperCase() + s.slice(1);
function fmtData(iso) { if (!iso) return ''; const [a, m, d] = iso.split('-'); return `${d}/${m}${a !== hoje().slice(0, 4) ? '/' + a : ''}`; }

const cfg = window.SUPABASE_CONFIG || {};
if (!(cfg.url && cfg.anonKey && window.supabase)) {
  document.body.innerHTML = '<p style="padding:40px;text-align:center">Falta configurar o Supabase em <code>config.js</code> (ou a biblioteca não carregou).</p>';
  return;
}
const sb = window.supabase.createClient(cfg.url, cfg.anonKey);

/* ============ ESTADO ============ */
let usuario = null;   // { id, email, nome }
let estado = null;    // cache por usuário
let CHAVE = '';

function estadoInicial() {
  return { listas: [], membros: {}, tarefas: [], checks: {}, listaAtual: '', filtro: 'todas', extras: true, grupoAtual: '', fila: [] };
}
function carregar() {
  try { const e = JSON.parse(localStorage.getItem(CHAVE)); return e ? Object.assign(estadoInicial(), e) : estadoInicial(); }
  catch { return estadoInicial(); }
}
function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch {} }

const listaAtual = () => estado.listas.find(l => l.id === estado.listaAtual);
const tarefasDaLista = () => estado.tarefas.filter(t => t.lista_id === estado.listaAtual && !t.apagado);
const meuCheck = t => !!(estado.checks[t.id]?.[usuario.id]?.feito);
const membrosDaLista = id => estado.membros[id] || [];
const souDono = l => l && l.dono === usuario.id;

/* ============ UI BÁSICA ============ */
let toastTimer;
function toast(msg, desfazer) {
  const t = $('#toast');
  t.innerHTML = esc(msg) + (desfazer ? '<button id="toastUndo">Desfazer</button>' : '');
  t.classList.remove('hidden');
  if (desfazer) $('#toastUndo').onclick = () => { desfazer(); t.classList.add('hidden'); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), desfazer ? 2000 : 2500);
}
function statusSync(txt, erro) {
  const el = $('#syncStatus');
  el.hidden = !txt; el.textContent = txt || ''; el.classList.toggle('err', !!erro);
}
function sheet(id, abrir) { $('#' + id).classList.toggle('hidden', !abrir); $('#' + id + 'Bg').classList.toggle('hidden', !abrir); }
document.querySelectorAll('.sheet-bg').forEach(bg => bg.onclick = () => bg.classList.add('hidden') || bg.nextElementSibling.classList.add('hidden'));

let view = 'auth';
function mostrar(v) {
  view = v;
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('hidden', s.id !== 'view-' + v));
  $('#btnVoltar').classList.toggle('hidden', v !== 'lista');
  $('#btnMenu').classList.toggle('hidden', v === 'auth');
  $('#titulo').textContent = v === 'lista' ? (listaAtual()?.nome || 'Lista') : v === 'listas' ? 'Minhas listas' : 'Tarefas';
  render();
}
$('#btnVoltar').onclick = () => { estado.listaAtual = ''; estado.grupoAtual = ''; salvar(); mostrar('listas'); };
$('#btnMenu').onclick = () => sheet(view === 'lista' ? 'menu' : 'menuListas', true);
$('#mnFechar').onclick = () => sheet('menu', false);
$('#menuListasFechar').onclick = () => sheet('menuListas', false);

/* ============ LOGIN ============ */
let modoCadastro = false;
$('#authTrocar').onclick = () => {
  modoCadastro = !modoCadastro;
  $('#authTitulo').textContent = modoCadastro ? 'Criar cadastro' : 'Entrar';
  $('#authBotao').textContent = modoCadastro ? 'Cadastrar' : 'Entrar';
  $('#authTrocar').textContent = modoCadastro ? 'Já tem conta? Entrar' : 'Não tem conta? Criar cadastro';
  $('#authCampoNome').classList.toggle('hidden', !modoCadastro);
  $('#authSenha').autocomplete = modoCadastro ? 'new-password' : 'current-password';
  $('#authErro').classList.add('hidden');
};
$('#formAuth').onsubmit = async e => {
  e.preventDefault();
  const email = $('#authEmail').value.trim().toLowerCase(), password = $('#authSenha').value;
  $('#authBotao').disabled = true; $('#authErro').classList.add('hidden');
  let res;
  if (modoCadastro) {
    res = await sb.auth.signUp({ email, password, options: { data: { nome: $('#authNome').value.trim() || email.split('@')[0] } } });
    if (!res.error && !res.data.session) {
      $('#authErro').textContent = 'Cadastro feito! Confirme pelo link enviado ao seu e-mail e depois entre.';
      $('#authErro').classList.remove('hidden'); $('#authTrocar').click();
    }
  } else {
    res = await sb.auth.signInWithPassword({ email, password });
  }
  $('#authBotao').disabled = false;
  if (res.error) {
    const m = res.error.message || '';
    $('#authErro').textContent = /invalid login/i.test(m) ? 'E-mail ou senha incorretos' : /already registered/i.test(m) ? 'Esse e-mail já tem cadastro' : /email not confirmed/i.test(m) ? 'Confirme seu e-mail antes de entrar' : m;
    $('#authErro').classList.remove('hidden');
  }
};
$('#mnSair').onclick = async () => { sheet('menuListas', false); await sb.auth.signOut(); };

sb.auth.onAuthStateChange((_ev, sessao) => {
  if (sessao?.user) {
    if (usuario?.id === sessao.user.id) return;
    usuario = { id: sessao.user.id, email: sessao.user.email, nome: sessao.user.user_metadata?.nome || sessao.user.email.split('@')[0] };
    CHAVE = 'tarefas.' + usuario.id;
    estado = carregar();
    $('#menuUsuario').textContent = `${usuario.nome} · ${usuario.email}`;
    mostrar(estado.listaAtual ? 'lista' : 'listas');
    conectarRealtime(); recarregar().then(aplicarConvitePendente);
  } else {
    usuario = null; estado = null;
    desconectarRealtime();
    mostrar('auth');
  }
});

/* ============ SINCRONIZAÇÃO ============ */
let recarregando = false, recarregarDeNovo = false, canal = null, timerRealtime = null;

async function recarregar() {
  if (!usuario) return;
  if (recarregando) { recarregarDeNovo = true; return; }
  recarregando = true;
  await enviarFila();
  const [rl, rm, rt, rc] = await Promise.all([
    sb.from('listas').select('*').eq('apagada', false),
    sb.from('membros').select('lista_id,user_id,perfis(email,nome)'),
    sb.from('tarefas').select('*').eq('apagado', false),
    sb.from('checks').select('*')
  ]);
  recarregando = false;
  if (rl.error || rm.error || rt.error || rc.error) { statusSync('sem conexão', true); return; }
  if (!estado) return;
  // o que ainda está na fila local prevalece sobre o servidor até subir
  const pendentesT = new Set(estado.fila.filter(f => f.tabela === 'tarefas').map(f => f.linha.id));
  const pendentesC = new Set(estado.fila.filter(f => f.tabela === 'checks').map(f => f.linha.tarefa_id + '|' + f.linha.user_id));
  const pendentesL = new Set(estado.fila.filter(f => f.tabela === 'listas').map(f => f.linha.id));

  const listasLocais = estado.listas.filter(l => pendentesL.has(l.id));
  estado.listas = rl.data.filter(l => !pendentesL.has(l.id)).concat(listasLocais);
  const membrosAntigos = estado.membros; estado.membros = {};
  listasLocais.forEach(l => { if (!rl.data.some(x => x.id === l.id)) estado.membros[l.id] = membrosAntigos[l.id] || []; });
  rm.data.forEach(m => (estado.membros[m.lista_id] ||= []).push({ user_id: m.user_id, email: m.perfis?.email || '', nome: m.perfis?.nome || '' }));
  const locaisPend = estado.tarefas.filter(t => pendentesT.has(t.id));
  estado.tarefas = rt.data.filter(t => !pendentesT.has(t.id)).concat(locaisPend);
  const checks = {};
  rc.data.forEach(c => { if (!pendentesC.has(c.tarefa_id + '|' + c.user_id)) (checks[c.tarefa_id] ||= {})[c.user_id] = c; });
  Object.entries(estado.checks).forEach(([tid, porUser]) => Object.entries(porUser).forEach(([u, c]) => { if (pendentesC.has(tid + '|' + u)) (checks[tid] ||= {})[u] = c; }));
  estado.checks = checks;
  if (estado.listaAtual && !listaAtual()) { estado.listaAtual = ''; if (view === 'lista') { toast('Essa lista não está mais disponível'); mostrar('listas'); } }
  salvar(); statusSync(''); render();
  if (recarregarDeNovo) { recarregarDeNovo = false; recarregar(); }
}

/* fila de escrita: upserts que ainda não subiram */
let enviando = false;
function enfileirar(tabela, linha, soEmpilha) {
  // substitui item igual já na fila (mesma chave), mantendo só a versão mais nova
  const chave = tabela === 'checks' ? f => f.linha.tarefa_id === linha.tarefa_id && f.linha.user_id === linha.user_id : f => f.linha.id === linha.id;
  estado.fila = estado.fila.filter(f => !(f.tabela === tabela && chave(f)));
  estado.fila.push({ tabela, linha });
  if (soEmpilha) return;
  salvar(); render();
  enviarFila();
}
async function enviarFila() {
  if (!estado || enviando || !estado.fila.length) return;
  enviando = true; statusSync('salvando…');
  while (estado.fila.length) {
    const f = estado.fila[0];
    const { error } = await sb.from(f.tabela).upsert(f.linha);
    if (error) { enviando = false; statusSync('sem conexão', true); console.warn(error); return; }
    estado.fila.shift(); salvar();
  }
  enviando = false; statusSync('');
}

function conectarRealtime() {
  desconectarRealtime();
  const evento = () => { clearTimeout(timerRealtime); timerRealtime = setTimeout(recarregar, 250); };
  canal = sb.channel('tudo');
  ['listas', 'membros', 'tarefas', 'checks'].forEach(t => canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, evento));
  canal.subscribe();
}
function desconectarRealtime() { if (canal) { sb.removeChannel(canal); canal = null; } }
window.addEventListener('online', recarregar);
document.addEventListener('visibilitychange', () => { if (!document.hidden) recarregar(); });

/* ============ LISTAS ============ */
function renderListas() {
  const el = $('#listaListas');
  if (!estado.listas.length) { el.innerHTML = '<div class="vazio"><b>🗂️</b>Nenhuma lista ainda. Crie a primeira!</div>'; return; }
  const ordem = estado.listas.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  el.innerHTML = ordem.map(l => {
    const ts = estado.tarefas.filter(t => t.lista_id === l.id && !t.apagado);
    const pend = ts.filter(t => !meuCheck(t)).length;
    const n = membrosDaLista(l.id).length;
    return `<div class="item lista-card" data-id="${l.id}">
      <span class="ico">${l.compartilhada ? '👥' : '🔒'}</span>
      <div class="body"><span class="txt">${esc(l.nome)}</span>
        <div class="meta"><span>${pend ? pend + ' pendente' + (pend > 1 ? 's' : '') : 'tudo feito'}</span>${l.compartilhada ? `<span>${n} pessoa${n > 1 ? 's' : ''}</span>` : ''}${souDono(l) ? '' : '<span>convidado</span>'}</div>
      </div><span class="seta">›</span></div>`;
  }).join('');
}
$('#listaListas').onclick = e => {
  const c = e.target.closest('.lista-card'); if (!c) return;
  estado.listaAtual = c.dataset.id; estado.grupoAtual = ''; salvar(); mostrar('lista');
};

$('#btnNovaLista').onclick = () => { $('#nlNome').value = ''; sheet('novaLista', true); setTimeout(() => $('#nlNome').focus(), 50); };
$('#nlCancelar').onclick = () => sheet('novaLista', false);
$('#formNovaLista').onsubmit = e => {
  e.preventDefault();
  const nome = capitalizar($('#nlNome').value.trim()); if (!nome) return;
  const l = { id: uid(), nome, dono: usuario.id, compartilhada: $('input[name=nlTipo]:checked').value === 'compartilhada', usar_prazo: false, grupos: [], criado: agora(), atualizado: agora(), apagada: false, codigo: novoCodigo() };
  estado.listas.push(l); estado.membros[l.id] = [{ user_id: usuario.id, email: usuario.email, nome: usuario.nome }];
  sheet('novaLista', false);
  enfileirar('listas', l);
  estado.listaAtual = l.id; salvar(); mostrar('lista');
  if (l.compartilhada) setTimeout(abrirMembros, 300);
};

function atualizarLista(mudancas) {
  const l = listaAtual(); if (!l) return;
  Object.assign(l, mudancas, { atualizado: agora() });
  enfileirar('listas', l);
  $('#titulo').textContent = l.nome;
}
$('#mnRenomear').onclick = () => {
  sheet('menu', false);
  const l = listaAtual();
  const nome = prompt('Novo nome da lista:', l.nome);
  if (nome && nome.trim()) atualizarLista({ nome: capitalizar(nome.trim()) });
};
$('#mnApagarLista').onclick = () => {
  sheet('menu', false);
  const l = listaAtual();
  if (!confirm(`Apagar a lista "${l.nome}" e todas as tarefas dela${l.compartilhada ? ' para todo mundo' : ''}?`)) return;
  atualizarLista({ apagada: true });
  estado.listas = estado.listas.filter(x => x.id !== l.id);
  estado.listaAtual = ''; salvar(); mostrar('listas');
};
$('#mnSairLista').onclick = async () => {
  sheet('menu', false);
  const l = listaAtual();
  if (!confirm(`Sair da lista "${l.nome}"? Você deixa de ver as tarefas dela.`)) return;
  const { error } = await sb.from('membros').delete().match({ lista_id: l.id, user_id: usuario.id });
  if (error) return toast('Não deu para sair agora (sem conexão?)');
  estado.listas = estado.listas.filter(x => x.id !== l.id);
  estado.listaAtual = ''; salvar(); mostrar('listas');
};

/* ============ PESSOAS DA LISTA ============ */
const novoCodigo = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const linkConvite = l => location.origin + location.pathname + '?convite=' + l.codigo;

async function compartilharLista() {
  const l = listaAtual(); if (!l) return;
  if (!l.compartilhada) {
    if (!confirm(`Tornar "${l.nome}" compartilhada? Quem entrar pelo link vê e edita as tarefas, cada um com o seu check.`)) return;
    atualizarLista({ compartilhada: true, codigo: l.codigo || novoCodigo() });
  } else if (!l.codigo) atualizarLista({ codigo: novoCodigo() });
  await enviarFila();
  abrirMembros();
}

async function enviarLink() {
  const l = listaAtual();
  // código sozinho numa linha, para ser fácil de copiar no WhatsApp
  const texto = `Lista "${l.nome}" no app Tarefas

Código:
${l.codigo}

Ou abra o link:
${linkConvite(l)}`;
  try {
    if (navigator.share) await navigator.share({ title: l.nome, text: texto });
    else { await navigator.clipboard.writeText(texto); toast('Link copiado'); }
  } catch {}
}
$('#btnLinkConvite').onclick = enviarLink;
$('#btnCopiarCodigo').onclick = async () => {
  const l = listaAtual();
  try { await navigator.clipboard.writeText(l.codigo); toast('Código copiado'); } catch { toast(l.codigo); }
};

async function entrarPorCodigo(c) {
  const { data, error } = await sb.rpc('entrar_por_codigo', { c });
  if (error) return toast('Não deu para entrar (sem conexão?)');
  if (data) return toast(data);
  toast('Você entrou na lista!');
  await recarregar();
  const l = estado.listas.find(x => x.codigo === c.toUpperCase().trim());
  if (l) { estado.listaAtual = l.id; estado.grupoAtual = ''; salvar(); mostrar('lista'); }
}
$('#btnEntrarCodigo').onclick = () => {
  let c = prompt('Código de convite (ou cole o link):') || '';
  const m = c.match(/convite=([A-Za-z0-9]+)/); if (m) c = m[1];
  c = c.replace(/[^A-Za-z0-9]/g, '');
  if (c) entrarPorCodigo(c);
};

// link ?convite=XXXX: guarda até o login e entra sozinho
const conviteUrl = new URLSearchParams(location.search).get('convite');
if (conviteUrl) { sessionStorage.setItem('convite', conviteUrl); history.replaceState(null, '', location.pathname); }
function aplicarConvitePendente() {
  const c = sessionStorage.getItem('convite'); if (!c) return;
  sessionStorage.removeItem('convite'); entrarPorCodigo(c);
}
function renderMembros() {
  const l = listaAtual();
  const ms = membrosDaLista(l.id);
  $('#listaMembros').innerHTML = ms.map(m => `<div class="grupo-linha" data-user="${m.user_id}">
      <span class="nome">${esc(m.nome || m.email)}${m.user_id === usuario.id ? ' (você)' : ''}</span>
      <span class="n">${m.user_id === l.dono ? 'dono' : esc(m.email)}</span>
      ${souDono(l) && m.user_id !== l.dono ? '<button data-acao="remover" aria-label="Remover">🗑️</button>' : ''}
    </div>`).join('');
  $('#formConvite').classList.toggle('hidden', !(souDono(l) && l.compartilhada));
  $('#conviteBox').classList.toggle('hidden', !(l.compartilhada && l.codigo));
  $('#conviteCodigo').textContent = l.codigo || '';
  $('#membrosDica').textContent = !l.compartilhada ? 'Lista privada: só você vê. Para convidar alguém, crie uma lista compartilhada.'
    : souDono(l) ? 'Mande o link (ou o código) para quem quiser entrar, ou adicione pelo e-mail de quem já tem cadastro.' : 'Compartilhe o link para chamar mais gente.';
}
function abrirMembros() { renderMembros(); sheet('membros', true); }
$('#mnMembros').onclick = () => { sheet('menu', false); compartilharLista(); };
$('#membrosFechar').onclick = () => sheet('membros', false);
$('#formConvite').onsubmit = async e => {
  e.preventDefault();
  const email = $('#inpConvite').value.trim().toLowerCase(); if (!email) return;
  const { data, error } = await sb.rpc('compartilhar', { l: estado.listaAtual, email_convidado: email });
  if (error) return toast('Não deu para convidar (sem conexão?)');
  if (data) return toast(data);
  $('#inpConvite').value = ''; toast('Pessoa adicionada'); await recarregar(); renderMembros();
};
$('#listaMembros').onclick = async e => {
  const b = e.target.closest('[data-acao=remover]'); if (!b) return;
  const uidRem = b.closest('.grupo-linha').dataset.user;
  if (!confirm('Remover essa pessoa da lista?')) return;
  const { error } = await sb.from('membros').delete().match({ lista_id: estado.listaAtual, user_id: uidRem });
  if (error) return toast('Não deu para remover agora');
  await recarregar(); renderMembros();
};

/* ============ TAREFAS ============ */
$('#formTarefa').onsubmit = e => {
  e.preventDefault();
  const texto = $('#inpTarefa').value.trim(); if (!texto) return;
  const l = listaAtual();
  // com grupos na lista e nenhum chip selecionado, pergunta em qual grupo a tarefa entra
  if (l.grupos.length && !estado.grupoAtual) {
    $('#escolherGrupoTexto').textContent = `"${capitalizar(texto)}"`;
    $('#opcoesGrupo').innerHTML = l.grupos.map(g => `<button type="button" data-grupo="${esc(g)}">${esc(g)}</button>`).join('') + '<button type="button" class="sem" data-grupo="">Sem grupo</button>';
    sheet('escolherGrupo', true);
    return;
  }
  adicionarTarefa(estado.grupoAtual || '');
};
$('#opcoesGrupo').onclick = e => {
  const b = e.target.closest('[data-grupo]'); if (!b) return;
  sheet('escolherGrupo', false);
  adicionarTarefa(b.dataset.grupo);
};

function adicionarTarefa(grupo) {
  const inp = $('#inpTarefa'); const texto = inp.value.trim(); if (!texto) return;
  const l = listaAtual();
  const t = { id: uid(), lista_id: l.id, texto: capitalizar(texto), prazo: l.usar_prazo ? ($('#inpPrazo').value || '') : '', prio: +$('#selPrioridade').value || 0,
              nota: '', grupo, criado_por: usuario.id, criado: agora(), atualizado: agora(), apagado: false };
  estado.tarefas.unshift(t);
  inp.value = ''; $('#inpPrazo').value = ''; $('#selPrioridade').value = '0';
  if (estado.filtro === 'concluidas') estado.filtro = 'pendentes';
  enfileirar('tarefas', t); inp.focus();
}
$('#filtro').onclick = e => { const b = e.target.closest('button'); if (!b) return; estado.filtro = b.dataset.filtro; salvar(); render(); };
$('#btnExtras').onclick = () => { estado.extras = !estado.extras; salvar(); render(); };
$('#mnPrazo').onclick = () => atualizarLista({ usar_prazo: !listaAtual().usar_prazo });

function marcar(t) {
  const c = estado.checks[t.id]?.[usuario.id];
  const feito = !(c && c.feito);
  const novo = { tarefa_id: t.id, user_id: usuario.id, feito, concluido: feito ? agora() : 0, atualizado: agora() };
  (estado.checks[t.id] ||= {})[usuario.id] = novo;
  enfileirar('checks', novo);
}
function apagarTarefa(t) {
  t.apagado = true; t.atualizado = agora();
  enfileirar('tarefas', t);
  toast('Tarefa apagada', () => { t.apagado = false; t.atualizado = agora(); enfileirar('tarefas', t); });
}

function ordenar(a, b) {
  const fa = meuCheck(a), fb = meuCheck(b);
  if (fa !== fb) return fa - fb;
  if (fa) return (estado.checks[b.id]?.[usuario.id]?.concluido || 0) - (estado.checks[a.id]?.[usuario.id]?.concluido || 0);
  if (b.prio !== a.prio) return b.prio - a.prio;
  if (a.prazo !== b.prazo) return (a.prazo || '9999') < (b.prazo || '9999') ? -1 : 1;
  return b.criado - a.criado;
}

function renderLista() {
  const l = listaAtual(); if (!l) return;
  const h = hoje();
  const todas = tarefasDaLista();
  const pend = todas.filter(t => !meuCheck(t));
  const atras = pend.filter(t => t.prazo && t.prazo < h).length;
  const paraHoje = pend.filter(t => t.prazo === h).length;
  $('#resumo').innerHTML = l.usar_prazo
    ? `<div class="stat"><b>${pend.length}</b><span>pendentes</span></div><div class="stat ${atras ? 'warn' : ''}"><b>${atras}</b><span>atrasadas</span></div><div class="stat"><b>${paraHoje}</b><span>para hoje</span></div>`
    : `<div class="stat"><b>${pend.length}</b><span>pendentes</span></div><div class="stat"><b>${todas.length - pend.length}</b><span>concluídas</span></div><div class="stat"><b>${todas.length}</b><span>no total</span></div>`;
  document.querySelectorAll('#filtro button').forEach(b => b.classList.toggle('on', b.dataset.filtro === estado.filtro));
  $('#campoPrazo').classList.toggle('hidden', !l.usar_prazo);
  $('#swPrazo').classList.toggle('on', !!l.usar_prazo);
  $('#extras').classList.toggle('hidden', !estado.extras);
  $('#btnExtras').setAttribute('aria-expanded', estado.extras);
  $('#mnApagarLista').classList.toggle('hidden', !souDono(l));
  $('#mnSairLista').classList.toggle('hidden', souDono(l));
  $('#mnMembros').classList.toggle('hidden', !l.compartilhada && !souDono(l));
  $('#dica').textContent = l.compartilhada ? 'Bolinha conclui · toque vê quem já fez · segure edita' : 'Bolinha conclui · toque vê detalhes · segure edita';
  renderGrupos();

  let lista = todas.slice().sort(ordenar);
  if (estado.grupoAtual) lista = lista.filter(t => t.grupo === estado.grupoAtual);
  if (estado.filtro === 'pendentes') lista = lista.filter(t => !meuCheck(t));
  if (estado.filtro === 'concluidas') lista = lista.filter(t => meuCheck(t));

  const el = $('#lista');
  if (!lista.length) {
    el.innerHTML = `<div class="vazio"><b>${estado.filtro === 'concluidas' ? '📭' : '🎉'}</b>${estado.filtro === 'concluidas' ? 'Nada concluído ainda' : 'Nenhuma tarefa pendente'}</div>`;
    return;
  }
  const ms = membrosDaLista(l.id);
  el.innerHTML = lista.map(t => {
    const feito = meuCheck(t);
    let prazo = '';
    if (t.prazo && l.usar_prazo) {
      const cls = feito ? '' : t.prazo < h ? 'late' : t.prazo === h ? 'today' : '';
      prazo = `<span class="${cls}">📅 ${t.prazo === h ? 'hoje' : fmtData(t.prazo)}</span>`;
    }
    const prio = t.prio === 2 ? '<span>🔴 urgente</span>' : t.prio === 1 ? '<span>🟡 importante</span>' : '';
    const nota = t.nota ? `<span>📝 ${esc(t.nota)}</span>` : '';
    const grupo = t.grupo && !estado.grupoAtual ? `<span class="grupo">${esc(t.grupo)}</span>` : '';
    let quem = '';
    if (l.compartilhada && ms.length > 1) {
      const fizeram = ms.filter(m => estado.checks[t.id]?.[m.user_id]?.feito);
      quem = `<span class="quem ${fizeram.length === ms.length ? 'todos' : ''}" title="${esc(fizeram.map(m => m.nome || m.email).join(', '))}">👥 ${fizeram.length}/${ms.length}</span>`;
    }
    const meta = prazo || prio || nota || grupo || quem ? `<div class="meta">${grupo}${prazo}${prio}${nota}${quem}</div>` : '';
    return `<div class="item prio-${t.prio} ${feito ? 'feito' : ''}" data-id="${t.id}">
      <span class="check ${feito ? 'on' : ''}">${feito ? '✓' : ''}</span>
      <div class="body"><span class="txt">${esc(t.texto)}</span>${meta}</div>
    </div>`;
  }).join('');
}

/* Toque = marca/desmarca (o meu check). Segurar (~500 ms) = editor. */
const SEGURAR_MS = 500;
let pressTimer = null, pressAbriu = false, pressX = 0, pressY = 0;
const listaEl = $('#lista');
listaEl.addEventListener('pointerdown', e => {
  const item = e.target.closest('.item'); if (!item) return;
  pressAbriu = false; pressX = e.clientX; pressY = e.clientY;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    pressAbriu = true;
    try { navigator.vibrate && navigator.vibrate(15); } catch {}
    const t = estado.tarefas.find(x => x.id === item.dataset.id);
    if (t) abrirEditor(t);
  }, SEGURAR_MS);
});
const cancelarPress = () => clearTimeout(pressTimer);
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => listaEl.addEventListener(ev, cancelarPress));
listaEl.addEventListener('pointermove', e => { if (Math.abs(e.clientX - pressX) > 10 || Math.abs(e.clientY - pressY) > 10) cancelarPress(); });
listaEl.addEventListener('contextmenu', e => e.preventDefault());
listaEl.addEventListener('click', e => {
  if (pressAbriu) { pressAbriu = false; return; }
  const item = e.target.closest('.item'); if (!item) return;
  const t = estado.tarefas.find(x => x.id === item.dataset.id); if (!t) return;
  if (e.target.closest('.check')) marcar(t);   // bolinha = concluir
  else abrirInfo(t);                             // resto do cartão = quem já concluiu
});

/* ============ DETALHES (toque) ============ */
let infoTarefa = null;
function abrirInfo(t) {
  const l = listaAtual(); infoTarefa = t;
  const ms = membrosDaLista(l.id);
  const nomeDe = m => m.user_id === usuario.id ? 'Você' : (m.nome || m.email);
  const autor = ms.find(m => m.user_id === t.criado_por);
  const linhas = [];
  if (t.grupo) linhas.push(`<div class="linha">🗂️ ${esc(t.grupo)}</div>`);
  if (t.prazo && l.usar_prazo) linhas.push(`<div class="linha">📅 ${t.prazo === hoje() ? 'hoje' : fmtData(t.prazo)}</div>`);
  if (t.prio) linhas.push(`<div class="linha">${t.prio === 2 ? '🔴 urgente' : '🟡 importante'}</div>`);
  if (t.nota) linhas.push(`<div class="linha">📝 ${esc(t.nota)}</div>`);
  if (l.compartilhada && autor) linhas.push(`<div class="linha">Criada por ${esc(nomeDe(autor))}</div>`);
  const pessoas = l.compartilhada ? ms : ms.filter(m => m.user_id === usuario.id);
  linhas.push(pessoas.map(m => { const ok = !!estado.checks[t.id]?.[m.user_id]?.feito;
    return `<div class="quem-linha ${ok ? '' : 'nao'}"><span class="check ${ok ? 'on' : ''}">${ok ? '✓' : ''}</span><span>${esc(nomeDe(m))}</span><span class="grow"></span><span class="linha">${ok ? 'concluiu' : 'pendente'}</span></div>`; }).join(''));
  $('#infoTitulo').textContent = t.texto;
  $('#infoCorpo').innerHTML = linhas.join('');
  sheet('info', true);
}
$('#infoFechar').onclick = () => sheet('info', false);
$('#infoEditar').onclick = () => { sheet('info', false); if (infoTarefa) abrirEditor(infoTarefa); };

/* ============ EDITOR ============ */
let editando = null;
function abrirEditor(t) {
  const l = listaAtual();
  editando = t;
  $('#edTexto').value = t.texto; $('#edNota').value = t.nota || ''; $('#edPrazo').value = t.prazo || ''; $('#edPrio').value = t.prio || 0;
  $('#edCampoPrazo').classList.toggle('hidden', !l.usar_prazo);
  $('#edCampoGrupo').classList.toggle('hidden', !l.grupos.length);
  $('#edGrupo').innerHTML = '<option value="">Sem grupo</option>' + l.grupos.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
  $('#edGrupo').value = l.grupos.includes(t.grupo) ? t.grupo : '';
  const ms = membrosDaLista(l.id);
  const nomeDe = m => m.user_id === usuario.id ? 'você' : (m.nome || m.email);
  const autor = ms.find(m => m.user_id === t.criado_por);
  const fizeram = ms.filter(m => estado.checks[t.id]?.[m.user_id]?.feito);
  const partes = [];
  if (l.compartilhada && autor) partes.push(`Criada por ${nomeDe(autor)}`);
  if (l.compartilhada) partes.push(fizeram.length ? `✓ Concluída por: ${fizeram.map(nomeDe).join(', ')}` : 'Ninguém concluiu ainda');
  $('#edQuem').innerHTML = partes.map(esc).join('<br>');
  sheet('edit', true);
}
function fecharEditor() { editando = null; sheet('edit', false); }
$('#edCancelar').onclick = fecharEditor;
$('#formEditar').onsubmit = e => {
  e.preventDefault(); if (!editando) return;
  const t = editando, l = listaAtual();
  t.texto = $('#edTexto').value.trim() || t.texto; t.nota = $('#edNota').value.trim();
  if (l.usar_prazo) t.prazo = $('#edPrazo').value;
  t.prio = +$('#edPrio').value || 0; t.grupo = $('#edGrupo').value || ''; t.atualizado = agora();
  fecharEditor(); enfileirar('tarefas', t);
};
$('#edApagar').onclick = () => { if (!editando) return; const t = editando; fecharEditor(); apagarTarefa(t); };

$('#mnDesmarcarTodas').onclick = () => {
  sheet('menu', false);
  // só desmarca os SEUS checks; as tarefas continuam na lista para reutilizar
  const feitas = tarefasDaLista().filter(t => meuCheck(t));
  if (!feitas.length) return toast('Nenhuma tarefa marcada');
  if (!confirm(`Desmarcar ${feitas.length} tarefa(s)? Elas continuam na lista, só voltam a ficar pendentes para você.`)) return;
  feitas.forEach(t => marcar(t));
  toast(`${feitas.length} tarefa(s) desmarcada(s)`);
};

/* ============ GRUPOS ============ */
function renderGrupos() {
  const l = listaAtual(); const el = $('#barraGrupos');
  if (!l || !l.grupos.length) { el.innerHTML = ''; return; }
  const conta = g => tarefasDaLista().filter(t => t.grupo === g && !meuCheck(t)).length;
  el.innerHTML = `<button data-grupo="" class="${estado.grupoAtual ? '' : 'on'}">Todos</button>` +
    l.grupos.map(g => { const n = conta(g); return `<button data-grupo="${esc(g)}" class="${estado.grupoAtual === g ? 'on' : ''}">${esc(g)}${n ? ' · ' + n : ''}</button>`; }).join('');
}
$('#barraGrupos').onclick = e => { const b = e.target.closest('button'); if (!b) return; estado.grupoAtual = b.dataset.grupo; salvar(); render(); };

function renderListaGrupos() {
  const l = listaAtual();
  $('#listaGrupos').innerHTML = l.grupos.length
    ? l.grupos.map(g => `<div class="grupo-linha" data-grupo="${esc(g)}"><span class="nome">${esc(g)}</span><span class="n">${tarefasDaLista().filter(t => t.grupo === g).length}</span>
        <button data-acao="renomear" aria-label="Renomear">✏️</button><button data-acao="apagar" aria-label="Apagar">🗑️</button></div>`).join('')
    : '<p class="hint">Nenhum grupo ainda. Crie um abaixo.</p>';
}
$('#mnGrupos').onclick = () => { sheet('menu', false); renderListaGrupos(); renderSugestoes(); sheet('grupos', true); };

/* sugestões prontas (assets/js/sugestoes.js): cria o grupo e as tarefas dele */
let tagSugestao = 'viagem';
function renderSugestoes() {
  const l = listaAtual(); const todas = window.SUGESTOES_GRUPOS || [];
  document.querySelectorAll('#filtroSugestoes button').forEach(b => b.classList.toggle('on', b.dataset.tag === tagSugestao));
  $('#listaSugestoes').innerHTML = todas.filter(s => s.tags.includes(tagSugestao)).map((s, i) => {
    const ja = l.grupos.some(g => g.toLowerCase() === s.nome.toLowerCase());
    return `<button type="button" class="sugestao ${ja ? 'ja' : ''}" data-nome="${esc(s.nome)}">
      <span class="ico">${s.icone}</span>
      <span class="body"><span class="txt">${esc(s.nome)}</span><span class="n">${s.itens.length} itens · ${esc(s.itens.slice(0, 4).join(', '))}…</span></span>
      <span class="add">${ja ? 'já tem' : '+ Adicionar'}</span></button>`;
  }).join('');
}
$('#filtroSugestoes').onclick = e => { const b = e.target.closest('button'); if (!b) return; tagSugestao = b.dataset.tag; renderSugestoes(); };
$('#listaSugestoes').onclick = e => {
  const b = e.target.closest('.sugestao'); if (!b) return;
  const s = (window.SUGESTOES_GRUPOS || []).find(x => x.nome === b.dataset.nome); if (!s) return;
  const l = listaAtual();
  const existentes = tarefasDaLista().map(t => t.texto.toLowerCase());
  const novos = s.itens.filter(i => !existentes.includes(i.toLowerCase()));
  const jaTem = l.grupos.some(g => g.toLowerCase() === s.nome.toLowerCase());
  if (!confirm(`${jaTem ? 'Completar' : 'Criar'} o grupo "${s.nome}" com ${novos.length} item(ns)?`)) return;
  const grupo = l.grupos.find(g => g.toLowerCase() === s.nome.toLowerCase()) || s.nome;
  if (!jaTem) atualizarLista({ grupos: [...l.grupos, grupo] });
  const base = agora();
  novos.forEach((texto, i) => enfileirar('tarefas', { id: uid(), lista_id: l.id, texto, prazo: '', prio: 0, nota: '', grupo, criado_por: usuario.id, criado: base - i, atualizado: base, apagado: false }, true));
  // enfileirar(..., true) só empilha; agora manda tudo de uma vez
  estado.tarefas.push(...estado.fila.filter(f => f.tabela === 'tarefas' && !estado.tarefas.some(t => t.id === f.linha.id)).map(f => f.linha));
  salvar(); render(); enviarFila();
  toast(`Grupo "${grupo}" com ${novos.length} item(ns)`);
  renderListaGrupos(); renderSugestoes();
};
$('#gruposFechar').onclick = () => sheet('grupos', false);
$('#formGrupo').onsubmit = e => {
  e.preventDefault();
  const l = listaAtual(); const nome = capitalizar($('#inpGrupo').value.trim()); if (!nome) return;
  if (l.grupos.some(g => g.toLowerCase() === nome.toLowerCase())) return toast('Esse grupo já existe');
  $('#inpGrupo').value = '';
  atualizarLista({ grupos: [...l.grupos, nome] }); renderListaGrupos();
};
$('#listaGrupos').onclick = e => {
  const b = e.target.closest('[data-acao]'); if (!b) return;
  const l = listaAtual(); const g = b.closest('.grupo-linha').dataset.grupo;
  if (b.dataset.acao === 'renomear') {
    const novo = capitalizar((prompt('Novo nome do grupo:', g) || '').trim());
    if (!novo || novo === g) return;
    if (l.grupos.some(x => x.toLowerCase() === novo.toLowerCase())) return toast('Esse grupo já existe');
    tarefasDaLista().forEach(t => { if (t.grupo === g) { t.grupo = novo; t.atualizado = agora(); enfileirar('tarefas', t); } });
    if (estado.grupoAtual === g) estado.grupoAtual = novo;
    atualizarLista({ grupos: l.grupos.map(x => x === g ? novo : x) });
  } else {
    const n = tarefasDaLista().filter(t => t.grupo === g).length;
    if (!confirm(`Apagar o grupo "${g}"?${n ? ` As ${n} tarefa(s) dele continuam, sem grupo.` : ''}`)) return;
    tarefasDaLista().forEach(t => { if (t.grupo === g) { t.grupo = ''; t.atualizado = agora(); enfileirar('tarefas', t); } });
    if (estado.grupoAtual === g) estado.grupoAtual = '';
    atualizarLista({ grupos: l.grupos.filter(x => x !== g) });
  }
  renderListaGrupos();
};

/* ============ RENDER ============ */
function render() {
  if (!estado) return;
  if (view === 'listas') renderListas();
  else if (view === 'lista') renderLista();
}

/* ============ PWA ============ */
let promptInstalar = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptInstalar = e; $('#mnInstalar').hidden = false; });
$('#mnInstalar').onclick = async () => { sheet('menuListas', false); if (!promptInstalar) return; promptInstalar.prompt(); await promptInstalar.userChoice; promptInstalar = null; $('#mnInstalar').hidden = true; };
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.sheet, .sheet-bg').forEach(s => s.classList.add('hidden')); });

mostrar('auth');

})();
