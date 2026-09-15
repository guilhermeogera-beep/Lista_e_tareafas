/* Tarefas — lista compartilhada.
   Os dados ficam no localStorage do aparelho (e, quando configurado, sincronizam pelo Supabase). */
(() => {
'use strict';

const CHAVE = 'tarefas.estado.v2';
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }; // data local, não UTC

/* ============ ESTADO ============ */
function estadoInicial() {
  return { v: 2, tarefas: [], filtro: 'pendentes', extras: true, usarPrazo: false, doisChecks: false, configAtualizado: 0, configEnviado: 0, grupos: [], grupoAtual: '' };
}

let estado = carregar();

function carregar() {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return estadoInicial();
    const e = JSON.parse(raw);
    if (!e || !Array.isArray(e.tarefas)) return estadoInicial();
    return Object.assign(estadoInicial(), e);
  } catch { return estadoInicial(); }
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); }
  catch { toast('Não consegui salvar (memória cheia?)'); }
  agendarEnvio();
}

/* Tarefas apagadas viram "tumbas" (apagado: true) para a remoção chegar nos outros aparelhos. */
const visiveis = () => estado.tarefas.filter(t => !t.apagado);
function marcarApagada(t, apagado) { t.apagado = apagado; t.atualizado = Date.now(); }

/* ============ UTIL ============ */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtData(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}${a !== hoje().slice(0, 4) ? '/' + a : ''}`;
}

const capitalizar = s => s.charAt(0).toUpperCase() + s.slice(1);

let toastTimer;
function toast(msg, desfazer) {
  const t = $('#toast');
  t.innerHTML = esc(msg) + (desfazer ? '<button id="toastUndo">Desfazer</button>' : '');
  t.classList.remove('hidden');
  if (desfazer) $('#toastUndo').onclick = () => { desfazer(); t.classList.add('hidden'); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), desfazer ? 5000 : 2200);
}

/* ============ ADICIONAR ============ */
$('#formTarefa').onsubmit = e => {
  e.preventDefault();
  const inp = $('#inpTarefa');
  const texto = inp.value.trim();
  if (!texto) return;
  estado.tarefas.unshift({
    id: uid(), texto: capitalizar(texto), feito: false, feitoA: false, feitoB: false, grupo: estado.grupoAtual || '',
    prazo: estado.usarPrazo ? ($('#inpPrazo').value || '') : '',
    prio: +$('#selPrioridade').value || 0,
    nota: '', criado: Date.now(), concluido: 0, atualizado: Date.now()
  });
  inp.value = ''; $('#inpPrazo').value = ''; $('#selPrioridade').value = '0';
  if (estado.filtro === 'concluidas') estado.filtro = 'pendentes';
  salvar(); render();
  inp.focus();
};

$('#filtro').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  estado.filtro = b.dataset.filtro; salvar(); render();
};

/* ============ LISTA ============ */
function ordenar(a, b) {
  if (a.feito !== b.feito) return a.feito - b.feito;
  if (a.feito) return b.concluido - a.concluido;
  if (b.prio !== a.prio) return b.prio - a.prio;
  if (a.prazo !== b.prazo) return (a.prazo || '9999') < (b.prazo || '9999') ? -1 : 1;
  return b.criado - a.criado;
}

function render() {
  const h = hoje();
  const todas = visiveis();
  const pend = todas.filter(t => !t.feito);
  const atras = pend.filter(t => t.prazo && t.prazo < h).length;
  const paraHoje = pend.filter(t => t.prazo === h).length;
  const feitas = todas.length - pend.length;
  $('#resumo').innerHTML = estado.usarPrazo
    ? `<div class="stat"><b>${pend.length}</b><span>pendentes</span></div>` +
      `<div class="stat ${atras ? 'warn' : ''}"><b>${atras}</b><span>atrasadas</span></div>` +
      `<div class="stat"><b>${paraHoje}</b><span>para hoje</span></div>`
    : `<div class="stat"><b>${pend.length}</b><span>pendentes</span></div>` +
      `<div class="stat"><b>${feitas}</b><span>concluídas</span></div>` +
      `<div class="stat"><b>${todas.length}</b><span>no total</span></div>`;

  document.querySelectorAll('#filtro button').forEach(b => b.classList.toggle('on', b.dataset.filtro === estado.filtro));
  $('#campoPrazo').classList.toggle('hidden', !estado.usarPrazo);
  $('#swPrazo').classList.toggle('on', estado.usarPrazo);
  $('#swDois').classList.toggle('on', estado.doisChecks);
  $('#dica').textContent = estado.doisChecks ? 'Toque na sua bolinha · segure para editar' : 'Toque para concluir · segure para editar';
  $('#extras').classList.toggle('hidden', !estado.extras);
  $('#btnExtras').setAttribute('aria-expanded', estado.extras);

  renderGrupos();
  let lista = todas.slice().sort(ordenar);
  if (estado.grupoAtual) lista = lista.filter(t => t.grupo === estado.grupoAtual);
  if (estado.filtro === 'pendentes') lista = lista.filter(t => !t.feito);
  if (estado.filtro === 'concluidas') lista = lista.filter(t => t.feito);

  const el = $('#lista');
  if (!lista.length) {
    el.innerHTML = `<div class="vazio"><b>${estado.filtro === 'concluidas' ? '📭' : '🎉'}</b>${
      estado.filtro === 'concluidas' ? 'Nada concluído ainda' : 'Nenhuma tarefa pendente'}</div>`;
    return;
  }
  el.innerHTML = lista.map(t => {
    let prazo = '';
    if (t.prazo && estado.usarPrazo) {
      const cls = t.feito ? '' : t.prazo < h ? 'late' : t.prazo === h ? 'today' : '';
      prazo = `<span class="${cls}">📅 ${t.prazo === h ? 'hoje' : fmtData(t.prazo)}</span>`;
    }
    const prio = t.prio === 2 ? '<span>🔴 urgente</span>' : t.prio === 1 ? '<span>🟡 importante</span>' : '';
    const nota = t.nota ? `<span>📝 ${esc(t.nota)}</span>` : '';
    const grupo = t.grupo && !estado.grupoAtual ? `<span class="grupo">${esc(t.grupo)}</span>` : '';
    const meta = prazo || prio || nota || grupo ? `<div class="meta">${grupo}${prazo}${prio}${nota}</div>` : '';
    const checks = estado.doisChecks
      ? `<span class="check a ${t.feitoA ? 'on' : ''}" data-quem="A">${t.feitoA ? '✓' : ''}</span>` +
        `<span class="check b ${t.feitoB ? 'on' : ''}" data-quem="B">${t.feitoB ? '✓' : ''}</span>`
      : `<span class="check ${t.feito ? 'on' : ''}">${t.feito ? '✓' : ''}</span>`;
    return `<div class="item prio-${t.prio} ${t.feito ? 'feito' : ''}" data-id="${t.id}">
      ${checks}
      <div class="body"><span class="txt">${esc(t.texto)}</span>${meta}</div>
    </div>`;
  }).join('');
}

/* Toque = marca/desmarca. Segurar (~500 ms) = abre o editor. */
const SEGURAR_MS = 500;
let pressTimer = null, pressAbriu = false, pressX = 0, pressY = 0;
const lista = $('#lista');

lista.addEventListener('pointerdown', e => {
  const item = e.target.closest('.item'); if (!item) return;
  pressAbriu = false; pressX = e.clientX; pressY = e.clientY;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    pressAbriu = true;
    if (navigator.vibrate) navigator.vibrate(15);
    const t = estado.tarefas.find(x => x.id === item.dataset.id);
    if (t) abrirEditor(t);
  }, SEGURAR_MS);
});
const cancelarPress = () => clearTimeout(pressTimer);
lista.addEventListener('pointerup', cancelarPress);
lista.addEventListener('pointercancel', cancelarPress);
lista.addEventListener('pointerleave', cancelarPress);
lista.addEventListener('pointermove', e => {
  // se o dedo arrastou (rolagem), não é "segurar"
  if (Math.abs(e.clientX - pressX) > 10 || Math.abs(e.clientY - pressY) > 10) cancelarPress();
});
lista.addEventListener('contextmenu', e => e.preventDefault());

lista.addEventListener('click', e => {
  if (pressAbriu) { pressAbriu = false; return; }
  const item = e.target.closest('.item'); if (!item) return;
  const t = estado.tarefas.find(x => x.id === item.dataset.id); if (!t) return;
  if (estado.doisChecks) {
    // cada pessoa marca a sua bolinha; a tarefa conclui quando as duas estão marcadas
    const quem = e.target.closest('[data-quem]')?.dataset.quem;
    if (!quem) return;
    if (quem === 'A') t.feitoA = !t.feitoA; else t.feitoB = !t.feitoB;
    t.feito = !!(t.feitoA && t.feitoB);
  } else {
    t.feito = !t.feito; t.feitoA = t.feitoB = t.feito;
  }
  t.concluido = t.feito ? Date.now() : 0; t.atualizado = Date.now();
  salvar(); render();
});

/* ============ EDITOR (folha inferior) ============ */
let editando = null;
function abrirEditor(t) {
  editando = t;
  $('#edTexto').value = t.texto;
  $('#edNota').value = t.nota || '';
  $('#edPrazo').value = t.prazo || '';
  $('#edPrio').value = t.prio || 0;
  $('#edCampoGrupo').classList.toggle('hidden', !estado.grupos.length);
  $('#edGrupo').innerHTML = '<option value="">Sem grupo</option>' + estado.grupos.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
  $('#edGrupo').value = estado.grupos.includes(t.grupo) ? t.grupo : '';
  $('#edCampoPrazo').classList.toggle('hidden', !estado.usarPrazo);
  $('#edit').classList.remove('hidden'); $('#editBg').classList.remove('hidden');
}
function fecharEditor() { editando = null; $('#edit').classList.add('hidden'); $('#editBg').classList.add('hidden'); }
$('#edCancelar').onclick = fecharEditor;
$('#editBg').onclick = fecharEditor;
$('#formEditar').onsubmit = e => {
  e.preventDefault();
  if (!editando) return;
  const t = editando;
  t.texto = $('#edTexto').value.trim() || t.texto;
  t.nota = $('#edNota').value.trim();
  t.prazo = estado.usarPrazo ? $('#edPrazo').value : t.prazo;
  t.prio = +$('#edPrio').value || 0;
  t.grupo = $('#edGrupo').value || '';
  t.atualizado = Date.now();
  fecharEditor(); salvar(); render();
};
$('#edApagar').onclick = () => {
  if (!editando) return;
  const t = editando;
  marcarApagada(t, true); fecharEditor(); salvar(); render();
  toast('Tarefa apagada', () => { marcarApagada(t, false); salvar(); render(); });
};

/* ============ DETALHES (recolher) ============ */
$('#btnExtras').onclick = () => mudarConfig('extras', !estado.extras);

/* ============ GRUPOS ============ */
function renderGrupos() {
  const el = $('#barraGrupos');
  if (!estado.grupos.length) { el.innerHTML = ''; return; }
  const conta = g => visiveis().filter(t => t.grupo === g && !t.feito).length;
  el.innerHTML = `<button data-grupo="" class="${estado.grupoAtual ? '' : 'on'}">Todos</button>` +
    estado.grupos.map(g => { const n = conta(g); return `<button data-grupo="${esc(g)}" class="${estado.grupoAtual === g ? 'on' : ''}">${esc(g)}${n ? ' · ' + n : ''}</button>`; }).join('');
}
$('#barraGrupos').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  estado.grupoAtual = b.dataset.grupo; salvar(); render();
};

function renderListaGrupos() {
  $('#listaGrupos').innerHTML = estado.grupos.length
    ? estado.grupos.map(g => `<div class="grupo-linha" data-grupo="${esc(g)}">
        <span class="nome">${esc(g)}</span><span class="n">${visiveis().filter(t => t.grupo === g).length}</span>
        <button data-acao="renomear" aria-label="Renomear">✏️</button>
        <button data-acao="apagar" aria-label="Apagar">🗑️</button>
      </div>`).join('')
    : '<p class="hint">Nenhum grupo ainda. Crie um abaixo.</p>';
}
function abrirGrupos() { renderListaGrupos(); $('#grupos').classList.remove('hidden'); $('#gruposBg').classList.remove('hidden'); }
function fecharGrupos() { $('#grupos').classList.add('hidden'); $('#gruposBg').classList.add('hidden'); }
$('#gruposFechar').onclick = fecharGrupos;
$('#gruposBg').onclick = fecharGrupos;

$('#formGrupo').onsubmit = e => {
  e.preventDefault();
  const inp = $('#inpGrupo');
  const nome = capitalizar(inp.value.trim());
  if (!nome) return;
  if (estado.grupos.some(g => g.toLowerCase() === nome.toLowerCase())) return toast('Esse grupo já existe');
  inp.value = '';
  mudarConfig('grupos', [...estado.grupos, nome]);
  renderListaGrupos();
};

$('#listaGrupos').onclick = e => {
  const b = e.target.closest('[data-acao]'); if (!b) return;
  const g = b.closest('.grupo-linha').dataset.grupo;
  if (b.dataset.acao === 'renomear') {
    const novo = capitalizar((prompt('Novo nome do grupo:', g) || '').trim());
    if (!novo || novo === g) return;
    if (estado.grupos.some(x => x.toLowerCase() === novo.toLowerCase())) return toast('Esse grupo já existe');
    estado.tarefas.forEach(t => { if (t.grupo === g) { t.grupo = novo; t.atualizado = Date.now(); } });
    if (estado.grupoAtual === g) estado.grupoAtual = novo;
    mudarConfig('grupos', estado.grupos.map(x => x === g ? novo : x));
  } else {
    const n = visiveis().filter(t => t.grupo === g).length;
    if (!confirm(`Apagar o grupo "${g}"?${n ? ` As ${n} tarefa(s) dele continuam, sem grupo.` : ''}`)) return;
    estado.tarefas.forEach(t => { if (t.grupo === g) { t.grupo = ''; t.atualizado = Date.now(); } });
    if (estado.grupoAtual === g) estado.grupoAtual = '';
    mudarConfig('grupos', estado.grupos.filter(x => x !== g));
  }
  renderListaGrupos();
};

/* ============ MENU ============ */
function abrirMenu() { $('#menu').classList.remove('hidden'); $('#menuBg').classList.remove('hidden'); }
function fecharMenu() { $('#menu').classList.add('hidden'); $('#menuBg').classList.add('hidden'); }
$('#btnMenu').onclick = abrirMenu;
$('#mnFechar').onclick = fecharMenu;
$('#menuBg').onclick = fecharMenu;

$('#mnPrazo').onclick = () => mudarConfig('usarPrazo', !estado.usarPrazo);
$('#mnDois').onclick = () => mudarConfig('doisChecks', !estado.doisChecks);
$('#mnGrupos').onclick = () => { fecharMenu(); abrirGrupos(); };

/* Configurações compartilhadas entre os aparelhos (o filtro da lista fica só local). */
const CONFIGS = ['usarPrazo', 'doisChecks', 'extras', 'grupos'];
function mudarConfig(chave, valor) {
  estado[chave] = valor; estado.configAtualizado = Date.now();
  salvar(); render();
}

$('#mnLimparConcluidas').onclick = () => {
  fecharMenu();
  const feitas = visiveis().filter(t => t.feito);
  if (!feitas.length) return toast('Nenhuma tarefa concluída');
  if (!confirm(`Apagar ${feitas.length} tarefa(s) concluída(s)?`)) return;
  feitas.forEach(t => marcarApagada(t, true));
  salvar(); render();
  toast(`${feitas.length} tarefa(s) apagada(s)`, () => { feitas.forEach(t => marcarApagada(t, false)); salvar(); render(); });
};

$('#mnExportar').onclick = () => {
  fecharMenu();
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tarefas-backup-${hoje()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#inpImportar').onchange = async e => {
  fecharMenu();
  const f = e.target.files[0]; if (!f) return;
  try {
    const novo = JSON.parse(await f.text());
    if (!Array.isArray(novo.tarefas)) throw 0;
    if (!confirm('Substituir tudo pelo backup? Os dados atuais serão perdidos.')) return;
    localStorage.setItem(CHAVE, JSON.stringify(novo));
    estado = carregar(); estado.tarefas.forEach(t => t.atualizado = Date.now()); salvar(); render(); toast('Backup restaurado');
  } catch { toast('Arquivo inválido'); }
  e.target.value = '';
};

/* ============ INSTALAR (PWA) ============ */
let promptInstalar = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); promptInstalar = e; $('#mnInstalar').hidden = false;
});
$('#mnInstalar').onclick = async () => {
  fecharMenu();
  if (!promptInstalar) return;
  promptInstalar.prompt();
  await promptInstalar.userChoice;
  promptInstalar = null; $('#mnInstalar').hidden = true;
};
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { fecharEditor(); fecharMenu(); fecharGrupos(); }
});

/* ============ SINCRONIZAÇÃO (Supabase) ============
   Sem login: todo aparelho com a mesma URL + chave vê a mesma lista.
   Regra de conflito: a versão com o maior `atualizado` vence. */
const cfg = window.SUPABASE_CONFIG || {};
const sb = (cfg.url && cfg.anonKey && window.supabase) ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;
const linha = t => ({ id: t.id, texto: t.texto || '', feito: !!t.feito, feito_a: !!t.feitoA, feito_b: !!t.feitoB, grupo: t.grupo || '', prazo: t.prazo || '', prio: +t.prio || 0, nota: t.nota || '',
                      criado: +t.criado || 0, concluido: +t.concluido || 0, atualizado: +t.atualizado || 0, apagado: !!t.apagado });
let enviando = false, enviarDeNovo = false, timerEnvio = null;

function statusSync(txt, erro) {
  const el = $('#syncStatus');
  el.hidden = !txt; el.textContent = txt || ''; el.classList.toggle('err', !!erro);
}

/* mescla uma linha do servidor no estado local; devolve true se mudou algo */
function mesclar(r) {
  const local = estado.tarefas.find(t => t.id === r.id);
  if (local && (local.atualizado || 0) >= (r.atualizado || 0)) return false;
  const novo = { id: r.id, texto: r.texto, feito: !!r.feito, feitoA: !!r.feito_a, feitoB: !!r.feito_b, grupo: r.grupo || '', prazo: r.prazo || '', prio: +r.prio || 0, nota: r.nota || '',
                 criado: +r.criado || 0, concluido: +r.concluido || 0, atualizado: +r.atualizado || 0, apagado: !!r.apagado, enviado: true, enviadoEm: +r.atualizado || 0 };
  if (local) Object.assign(local, novo); else estado.tarefas.push(novo);
  return true;
}

async function baixar() {
  if (!sb) return;
  const cfgRes = await sb.from('config').select('*').eq('id', 'casa').maybeSingle();
  if (!cfgRes.error && cfgRes.data && mesclarConfig(cfgRes.data)) render();
  const { data, error } = await sb.from('tarefas').select('*');
  if (error) { statusSync('sem conexão', true); return; }
  let mudou = false;
  data.forEach(r => { if (mesclar(r)) mudou = true; });
  // o que só existe aqui (criado offline) precisa subir
  estado.tarefas.forEach(t => { if (!data.some(r => r.id === t.id)) t.enviado = false; });
  localStorage.setItem(CHAVE, JSON.stringify(estado));
  if (mudou) render();
  statusSync('');
  enviar();
}

function agendarEnvio() {
  if (!sb) return;
  estado.tarefas.forEach(t => { if (t.atualizado > (t.enviadoEm || 0)) t.enviado = false; });
  clearTimeout(timerEnvio);
  timerEnvio = setTimeout(enviar, 300);
}

function mesclarConfig(r) {
  if ((r.atualizado || 0) <= (estado.configAtualizado || 0)) return false;
  CONFIGS.forEach(k => { if (k in (r.valor || {})) estado[k] = k === 'grupos' ? (Array.isArray(r.valor[k]) ? r.valor[k] : []) : !!r.valor[k]; });
  if (estado.grupoAtual && !estado.grupos.includes(estado.grupoAtual)) estado.grupoAtual = '';
  estado.configAtualizado = estado.configEnviado = r.atualizado;
  localStorage.setItem(CHAVE, JSON.stringify(estado));
  return true;
}

async function enviar() {
  if (!sb) return;
  if (enviando) { enviarDeNovo = true; return; }
  const pend = estado.tarefas.filter(t => !t.enviado);
  const cfgPend = estado.configAtualizado > (estado.configEnviado || 0);
  if (!pend.length && !cfgPend) return;
  enviando = true; statusSync('salvando…');
  let error = null;
  if (pend.length) ({ error } = await sb.from('tarefas').upsert(pend.map(linha)));
  if (!error && cfgPend) {
    const valor = Object.fromEntries(CONFIGS.map(k => [k, k === 'grupos' ? estado.grupos : !!estado[k]]));
    ({ error } = await sb.from('config').upsert({ id: 'casa', valor, atualizado: estado.configAtualizado }));
  }
  enviando = false;
  if (error) { statusSync('sem conexão', true); return; }
  pend.forEach(t => { t.enviado = true; t.enviadoEm = t.atualizado; });
  if (cfgPend) estado.configEnviado = estado.configAtualizado;
  localStorage.setItem(CHAVE, JSON.stringify(estado));
  statusSync('');
  if (enviarDeNovo) { enviarDeNovo = false; enviar(); }
}

if (sb) {
  baixar();
  sb.channel('tarefas')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas' }, p => {
      if (p.new && p.new.id && mesclar(p.new)) { localStorage.setItem(CHAVE, JSON.stringify(estado)); render(); }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'config' }, p => {
      if (p.new && p.new.id === 'casa' && mesclarConfig(p.new)) render();
    })
    .subscribe();
  window.addEventListener('online', baixar);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) baixar(); });
  // limpa tumbas antigas (30 dias) para o localStorage não crescer para sempre
  const limite = Date.now() - 30 * 86400000;
  estado.tarefas = estado.tarefas.filter(t => !(t.apagado && t.enviado && t.atualizado < limite));
} else {
  statusSync(!(cfg.url && cfg.anonKey) ? 'só neste aparelho' : 'sem a biblioteca de sync', !!(cfg.url && cfg.anonKey));
}

render();

})();
