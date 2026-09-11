/* Listas — tarefas e compras.
   Tudo fica no localStorage do aparelho. Nada sobe para servidor nenhum. */
(() => {
'use strict';

const CHAVE = 'listas.estado.v1';
const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }; // data local, não UTC

/* ============ ESTADO ============ */
function estadoInicial() {
  const id = uid();
  return {
    v: 1,
    tarefas: [],
    listas: [{ id, nome: 'Mercado', itens: [] }],
    listaAtual: id,
    filtro: 'pendentes',
    view: 'tarefas',
    historico: []            // nomes já usados, para o autocompletar
  };
}

let estado = carregar();

function carregar() {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return estadoInicial();
    const e = JSON.parse(raw);
    if (!e || !Array.isArray(e.tarefas) || !Array.isArray(e.listas) || !e.listas.length) return estadoInicial();
    if (!e.listas.some(l => l.id === e.listaAtual)) e.listaAtual = e.listas[0].id;
    e.historico = e.historico || [];
    e.view = e.view || 'tarefas';
    e.filtro = e.filtro || 'pendentes';
    return e;
  } catch { return estadoInicial(); }
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); }
  catch { toast('Não consegui salvar (memória cheia?)'); }
}

const listaAtual = () => estado.listas.find(l => l.id === estado.listaAtual);

/* ============ UTIL ============ */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtData(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}${a !== hoje().slice(0, 4) ? '/' + a : ''}`;
}

/* "2 leite", "leite x2", "500g arroz", "3x pão" → { qtd, texto } */
function separarQtd(txt) {
  txt = txt.trim().replace(/\s+/g, ' ');
  let m = txt.match(/^(\d+[.,]?\d*\s?(?:x|kg|g|l|ml|un|dz|pct|cx)?)\s+(.+)$/i);
  if (m) return { qtd: m[1].replace(/\s?x$/i, '').trim(), texto: m[2] };
  m = txt.match(/^(.+?)\s+x?\s?(\d+[.,]?\d*\s?(?:kg|g|l|ml|un|dz|pct|cx)?)$/i);
  if (m) return { qtd: m[2].trim(), texto: m[1] };
  return { qtd: '', texto: txt };
}

const capitalizar = s => s.charAt(0).toUpperCase() + s.slice(1);

let toastTimer, toastDesfazer = null;
function toast(msg, desfazer) {
  const t = $('#toast');
  toastDesfazer = desfazer || null;
  t.innerHTML = esc(msg) + (desfazer ? '<button id="toastUndo">Desfazer</button>' : '');
  t.classList.remove('hidden');
  if (desfazer) $('#toastUndo').onclick = () => { desfazer(); t.classList.add('hidden'); toastDesfazer = null; };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), desfazer ? 5000 : 2200);
}

/* ============ NAVEGAÇÃO ============ */
function mostrarView(v) {
  estado.view = v;
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('hidden', s.id !== 'view-' + v));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.view === v));
  $('#viewTitle').textContent = v === 'tarefas' ? 'Tarefas' : (listaAtual()?.nome || 'Compras');
  const soCompras = v === 'compras';
  ['#mnNovaLista', '#mnRenomearLista', '#mnApagarLista'].forEach(s => $(s).classList.toggle('hidden', !soCompras));
  salvar();
  render();
}
document.querySelectorAll('.tab').forEach(t => t.onclick = () => mostrarView(t.dataset.view));

/* ============ TAREFAS ============ */
$('#formTarefa').onsubmit = e => {
  e.preventDefault();
  const inp = $('#inpTarefa');
  const texto = inp.value.trim();
  if (!texto) return;
  estado.tarefas.unshift({
    id: uid(), texto: capitalizar(texto), feito: false,
    prazo: $('#inpPrazo').value || '', prio: +$('#selPrioridade').value || 0,
    nota: '', criado: Date.now(), concluido: 0
  });
  inp.value = ''; $('#inpPrazo').value = ''; $('#selPrioridade').value = '0';
  if (estado.filtro === 'concluidas') estado.filtro = 'pendentes';
  salvar(); render();
  inp.focus();
};

$('#filtroTarefas').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  estado.filtro = b.dataset.filtro; salvar(); render();
};

$('#btnLimparConcluidas').onclick = () => {
  const feitas = estado.tarefas.filter(t => t.feito);
  if (!feitas.length) return toast('Nenhuma tarefa concluída');
  const copia = estado.tarefas.slice();
  estado.tarefas = estado.tarefas.filter(t => !t.feito);
  salvar(); render();
  toast(`${feitas.length} tarefa(s) removida(s)`, () => { estado.tarefas = copia; salvar(); render(); });
};

function ordenarTarefas(a, b) {
  if (a.feito !== b.feito) return a.feito - b.feito;
  if (a.feito) return b.concluido - a.concluido;
  if (b.prio !== a.prio) return b.prio - a.prio;
  if (a.prazo !== b.prazo) return (a.prazo || '9999') < (b.prazo || '9999') ? -1 : 1;
  return b.criado - a.criado;
}

function renderTarefas() {
  const h = hoje();
  const pend = estado.tarefas.filter(t => !t.feito);
  const atras = pend.filter(t => t.prazo && t.prazo < h).length;
  const paraHoje = pend.filter(t => t.prazo === h).length;
  $('#resumoTarefas').innerHTML =
    `<div class="stat"><b>${pend.length}</b><span>pendentes</span></div>` +
    `<div class="stat ${atras ? 'warn' : ''}"><b>${atras}</b><span>atrasadas</span></div>` +
    `<div class="stat"><b>${paraHoje}</b><span>para hoje</span></div>`;
  $('#badgeTarefas').textContent = pend.length;
  $('#badgeTarefas').classList.toggle('hidden', !pend.length);

  document.querySelectorAll('#filtroTarefas button').forEach(b => b.classList.toggle('on', b.dataset.filtro === estado.filtro));

  let lista = estado.tarefas.slice().sort(ordenarTarefas);
  if (estado.filtro === 'pendentes') lista = lista.filter(t => !t.feito);
  if (estado.filtro === 'concluidas') lista = lista.filter(t => t.feito);

  const el = $('#listaTarefas');
  if (!lista.length) {
    el.innerHTML = `<div class="vazio"><b>${estado.filtro === 'concluidas' ? '📭' : '🎉'}</b>${
      estado.filtro === 'concluidas' ? 'Nada concluído ainda' : 'Nenhuma tarefa pendente'}</div>`;
    return;
  }
  el.innerHTML = lista.map(t => {
    let prazo = '';
    if (t.prazo) {
      const cls = t.feito ? '' : t.prazo < h ? 'late' : t.prazo === h ? 'today' : '';
      prazo = `<span class="${cls}">📅 ${t.prazo === h ? 'hoje' : fmtData(t.prazo)}</span>`;
    }
    const prio = t.prio === 2 ? '<span>🔴 urgente</span>' : t.prio === 1 ? '<span>🟡 importante</span>' : '';
    const nota = t.nota ? `<span>📝 ${esc(t.nota)}</span>` : '';
    const meta = prazo || prio || nota ? `<div class="meta">${prazo}${prio}${nota}</div>` : '';
    return `<div class="item prio-${t.prio} ${t.feito ? 'feito' : ''}" data-id="${t.id}">
      <button class="check" data-acao="check" aria-label="Concluir">${t.feito ? '✓' : ''}</button>
      <button class="body" data-acao="editar"><span class="txt">${esc(t.texto)}</span>${meta}</button>
      <button class="del" data-acao="apagar" aria-label="Apagar">×</button>
    </div>`;
  }).join('');
}

$('#listaTarefas').onclick = e => {
  const b = e.target.closest('[data-acao]'); if (!b) return;
  const id = b.closest('.item').dataset.id;
  const t = estado.tarefas.find(x => x.id === id); if (!t) return;
  if (b.dataset.acao === 'check') {
    t.feito = !t.feito; t.concluido = t.feito ? Date.now() : 0;
    salvar(); render();
  } else if (b.dataset.acao === 'apagar') {
    const i = estado.tarefas.indexOf(t);
    estado.tarefas.splice(i, 1); salvar(); render();
    toast('Tarefa apagada', () => { estado.tarefas.splice(i, 0, t); salvar(); render(); });
  } else if (b.dataset.acao === 'editar') abrirEditor('tarefa', t);
};

/* ============ COMPRAS ============ */
function renderBarraListas() {
  $('#barraListas').innerHTML = estado.listas.map(l => {
    const n = l.itens.filter(i => !i.feito).length;
    return `<button data-id="${l.id}" class="${l.id === estado.listaAtual ? 'on' : ''}">${esc(l.nome)}${n ? ' · ' + n : ''}</button>`;
  }).join('') + '<button class="add" data-id="__nova">+ Nova</button>';
}
$('#barraListas').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.id === '__nova') return novaLista();
  estado.listaAtual = b.dataset.id; salvar(); mostrarView('compras');
};

function novaLista() {
  const nome = prompt('Nome da nova lista:', '');
  if (!nome || !nome.trim()) return;
  const l = { id: uid(), nome: nome.trim(), itens: [] };
  estado.listas.push(l); estado.listaAtual = l.id;
  salvar(); mostrarView('compras');
}

$('#formItem').onsubmit = e => {
  e.preventDefault();
  const inp = $('#inpItem');
  const raw = inp.value.trim(); if (!raw) return;
  const { qtd, texto } = separarQtd(raw);
  const l = listaAtual();
  const nome = capitalizar(texto);
  const existe = l.itens.find(i => i.texto.toLowerCase() === nome.toLowerCase());
  if (existe) {
    // já está na lista: só desmarca e atualiza a quantidade
    existe.feito = false; if (qtd) existe.qtd = qtd;
    toast(`"${nome}" já estava na lista`);
  } else {
    l.itens.unshift({ id: uid(), texto: nome, qtd, feito: false, nota: '', criado: Date.now() });
  }
  if (!estado.historico.some(h => h.toLowerCase() === nome.toLowerCase())) {
    estado.historico.unshift(nome); estado.historico = estado.historico.slice(0, 300);
  }
  inp.value = ''; salvar(); render(); inp.focus();
};

$('#btnLimparComprados').onclick = () => {
  const l = listaAtual();
  const comprados = l.itens.filter(i => i.feito);
  if (!comprados.length) return toast('Nada no carrinho');
  const copia = l.itens.slice();
  l.itens = l.itens.filter(i => !i.feito);
  salvar(); render();
  toast(`${comprados.length} item(ns) removido(s)`, () => { l.itens = copia; salvar(); render(); });
};

$('#btnDesmarcarTudo').onclick = () => {
  const l = listaAtual();
  if (!l.itens.some(i => i.feito)) return toast('Nada marcado');
  l.itens.forEach(i => i.feito = false);
  salvar(); render(); toast('Lista pronta para a próxima compra');
};

$('#btnCompartilhar').onclick = async () => {
  const l = listaAtual();
  const pend = l.itens.filter(i => !i.feito);
  if (!pend.length) return toast('Lista vazia');
  const texto = `🛒 ${l.nome}\n` + pend.map(i => `• ${i.qtd ? i.qtd + ' ' : ''}${i.texto}${i.nota ? ' (' + i.nota + ')' : ''}`).join('\n');
  try {
    if (navigator.share) await navigator.share({ title: l.nome, text: texto });
    else { await navigator.clipboard.writeText(texto); toast('Lista copiada'); }
  } catch { /* usuário cancelou */ }
};

function renderCompras() {
  renderBarraListas();
  const l = listaAtual();
  const pend = l.itens.filter(i => !i.feito);
  const feitos = l.itens.filter(i => i.feito);
  const pct = l.itens.length ? Math.round(feitos.length / l.itens.length * 100) : 0;
  $('#resumoCompras').innerHTML =
    `<div class="stat"><b>${pend.length}</b><span>faltam</span></div>` +
    `<div class="stat"><b>${feitos.length}</b><span>no carrinho</span></div>` +
    `<div class="stat"><b>${pct}%</b><span>concluído</span></div>`;

  const totalPend = estado.listas.reduce((n, x) => n + x.itens.filter(i => !i.feito).length, 0);
  $('#badgeCompras').textContent = totalPend;
  $('#badgeCompras').classList.toggle('hidden', !totalPend);

  $('#sugestoesItem').innerHTML = estado.historico.map(h => `<option value="${esc(h)}">`).join('');

  const item = i => `<div class="item ${i.feito ? 'feito' : ''}" data-id="${i.id}">
      <button class="check" data-acao="check" aria-label="Marcar">${i.feito ? '✓' : ''}</button>
      <button class="body" data-acao="editar"><span class="txt">${esc(i.texto)}</span>${i.nota ? `<div class="meta"><span>📝 ${esc(i.nota)}</span></div>` : ''}</button>
      ${i.qtd ? `<span class="qtd">${esc(i.qtd)}</span>` : ''}
      <button class="del" data-acao="apagar" aria-label="Apagar">×</button>
    </div>`;

  $('#listaItens').innerHTML = pend.length ? pend.map(item).join('')
    : `<div class="vazio"><b>${l.itens.length ? '🧺' : '🛒'}</b>${l.itens.length ? 'Tudo no carrinho!' : 'Lista vazia. Adicione algo acima.'}</div>`;
  $('#tituloComprados').classList.toggle('hidden', !feitos.length);
  $('#listaComprados').innerHTML = feitos.map(item).join('');
}

function clickItemCompra(e) {
  const b = e.target.closest('[data-acao]'); if (!b) return;
  const id = b.closest('.item').dataset.id;
  const l = listaAtual();
  const it = l.itens.find(x => x.id === id); if (!it) return;
  if (b.dataset.acao === 'check') { it.feito = !it.feito; salvar(); render(); }
  else if (b.dataset.acao === 'apagar') {
    const i = l.itens.indexOf(it);
    l.itens.splice(i, 1); salvar(); render();
    toast('Item apagado', () => { l.itens.splice(i, 0, it); salvar(); render(); });
  } else if (b.dataset.acao === 'editar') abrirEditor('item', it);
}
$('#listaItens').onclick = clickItemCompra;
$('#listaComprados').onclick = clickItemCompra;

/* ============ EDITOR (folha inferior) ============ */
let editando = null;   // { tipo, obj }
function abrirEditor(tipo, obj) {
  editando = { tipo, obj };
  $('#edTexto').value = obj.texto;
  $('#edNota').value = obj.nota || '';
  $('#edCampoQtd').classList.toggle('hidden', tipo !== 'item');
  $('#edCampoPrazo').classList.toggle('hidden', tipo !== 'tarefa');
  $('#edCampoPrio').classList.toggle('hidden', tipo !== 'tarefa');
  if (tipo === 'item') $('#edQtd').value = obj.qtd || '';
  else { $('#edPrazo').value = obj.prazo || ''; $('#edPrio').value = obj.prio || 0; }
  $('#edit').classList.remove('hidden'); $('#editBg').classList.remove('hidden');
  setTimeout(() => $('#edTexto').focus(), 50);
}
function fecharEditor() { editando = null; $('#edit').classList.add('hidden'); $('#editBg').classList.add('hidden'); }
$('#edCancelar').onclick = fecharEditor;
$('#editBg').onclick = fecharEditor;
$('#formEditar').onsubmit = e => {
  e.preventDefault();
  if (!editando) return;
  const o = editando.obj;
  o.texto = $('#edTexto').value.trim() || o.texto;
  o.nota = $('#edNota').value.trim();
  if (editando.tipo === 'item') o.qtd = $('#edQtd').value.trim();
  else { o.prazo = $('#edPrazo').value; o.prio = +$('#edPrio').value || 0; }
  fecharEditor(); salvar(); render();
};
$('#edApagar').onclick = () => {
  if (!editando) return;
  const { tipo, obj } = editando;
  const arr = tipo === 'item' ? listaAtual().itens : estado.tarefas;
  const i = arr.indexOf(obj);
  arr.splice(i, 1); fecharEditor(); salvar(); render();
  toast('Apagado', () => { arr.splice(i, 0, obj); salvar(); render(); });
};

/* ============ MENU ============ */
function abrirMenu() { $('#menu').classList.remove('hidden'); $('#menuBg').classList.remove('hidden'); }
function fecharMenu() { $('#menu').classList.add('hidden'); $('#menuBg').classList.add('hidden'); }
$('#btnMenu').onclick = abrirMenu;
$('#mnFechar').onclick = fecharMenu;
$('#menuBg').onclick = fecharMenu;

$('#mnNovaLista').onclick = () => { fecharMenu(); novaLista(); };
$('#mnRenomearLista').onclick = () => {
  fecharMenu();
  const l = listaAtual();
  const nome = prompt('Novo nome da lista:', l.nome);
  if (nome && nome.trim()) { l.nome = nome.trim(); salvar(); mostrarView('compras'); }
};
$('#mnApagarLista').onclick = () => {
  fecharMenu();
  if (estado.listas.length === 1) return toast('Precisa ter pelo menos uma lista');
  const l = listaAtual();
  if (!confirm(`Apagar a lista "${l.nome}" com ${l.itens.length} item(ns)?`)) return;
  const i = estado.listas.indexOf(l);
  estado.listas.splice(i, 1);
  estado.listaAtual = estado.listas[Math.max(0, i - 1)].id;
  salvar(); mostrarView('compras');
  toast('Lista apagada', () => { estado.listas.splice(i, 0, l); estado.listaAtual = l.id; salvar(); mostrarView('compras'); });
};

$('#mnExportar').onclick = () => {
  fecharMenu();
  const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `listas-backup-${hoje()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#inpImportar').onchange = async e => {
  fecharMenu();
  const f = e.target.files[0]; if (!f) return;
  try {
    const novo = JSON.parse(await f.text());
    if (!Array.isArray(novo.tarefas) || !Array.isArray(novo.listas)) throw 0;
    if (!confirm('Substituir tudo pelo backup? Os dados atuais serão perdidos.')) return;
    localStorage.setItem(CHAVE, JSON.stringify(novo));
    estado = carregar(); mostrarView(estado.view); toast('Backup restaurado');
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

/* atalhos de teclado (desktop) */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { fecharEditor(); fecharMenu(); }
});

/* ============ RENDER ============ */
function render() {
  if (estado.view === 'tarefas') renderTarefas(); else renderCompras();
  // badges das duas abas sempre atualizados
  const pendT = estado.tarefas.filter(t => !t.feito).length;
  $('#badgeTarefas').textContent = pendT; $('#badgeTarefas').classList.toggle('hidden', !pendT);
  const pendC = estado.listas.reduce((n, x) => n + x.itens.filter(i => !i.feito).length, 0);
  $('#badgeCompras').textContent = pendC; $('#badgeCompras').classList.toggle('hidden', !pendC);
}

mostrarView(estado.view);

})();
