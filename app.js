/**
 * TASK//OS — Application Logic
 * To-Do List com filtros, edição e persistência via localStorage
 */

'use strict';

/* ─────────────────────────────────────────
   ESTADO DA APLICAÇÃO
───────────────────────────────────────── */
const state = {
  tasks: [],        // Array de { id, text, done, createdAt }
  filter: 'all',    // 'all' | 'pending' | 'done'
  editingId: null,  // ID da tarefa sendo editada
};

/* ─────────────────────────────────────────
   REFS DOM
───────────────────────────────────────── */
const $ = id => document.getElementById(id);

const refs = {
  taskInput:    $('taskInput'),
  addBtn:       $('addBtn'),
  taskList:     $('taskList'),
  emptyState:   $('emptyState'),
  pendingCount: $('pendingCount'),
  countAll:     $('countAll'),
  countPending: $('countPending'),
  countDone:    $('countDone'),
  clearDoneBtn: $('clearDoneBtn'),
  editModal:    $('editModal'),
  editInput:    $('editInput'),
  modalClose:   $('modalClose'),
  modalCancel:  $('modalCancel'),
  modalSave:    $('modalSave'),
  cursorDot:    $('cursorDot'),
  cursorRing:   $('cursorRing'),
};

/* ─────────────────────────────────────────
   PERSISTÊNCIA — LocalStorage
───────────────────────────────────────── */
const STORAGE_KEY = 'taskos_tasks';

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.tasks = raw ? JSON.parse(raw) : [];
  } catch {
    state.tasks = [];
  }
}

/* ─────────────────────────────────────────
   LÓGICA DE TAREFAS
───────────────────────────────────────── */
function generateId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  state.tasks.unshift({
    id: generateId(),
    text: trimmed,
    done: false,
    createdAt: Date.now(),
  });

  saveTasks();
  return true;
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveTasks();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveTasks();
}

function editTask(id, newText) {
  const trimmed = newText.trim();
  if (!trimmed) return false;

  const task = state.tasks.find(t => t.id === id);
  if (!task) return false;

  task.text = trimmed;
  saveTasks();
  return true;
}

function clearDoneTasks() {
  state.tasks = state.tasks.filter(t => !t.done);
  saveTasks();
}

/* ─────────────────────────────────────────
   FILTRAGEM & CONTAGENS
───────────────────────────────────────── */
function getFilteredTasks() {
  switch (state.filter) {
    case 'pending': return state.tasks.filter(t => !t.done);
    case 'done':    return state.tasks.filter(t => t.done);
    default:        return state.tasks;
  }
}

function getCounts() {
  const total   = state.tasks.length;
  const done    = state.tasks.filter(t => t.done).length;
  const pending = total - done;
  return { total, done, pending };
}

/* ─────────────────────────────────────────
   RENDER
───────────────────────────────────────── */
function render() {
  const filtered = getFilteredTasks();
  const counts   = getCounts();

  // Atualiza contadores
  refs.pendingCount.textContent = counts.pending;
  refs.countAll.textContent     = counts.total;
  refs.countPending.textContent = counts.pending;
  refs.countDone.textContent    = counts.done;

  // Mostra/oculta estado vazio
  if (filtered.length === 0) {
    refs.emptyState.hidden = false;
    refs.taskList.innerHTML = '';
    return;
  }

  refs.emptyState.hidden = true;

  // Renderiza itens mantendo animações — só reconstrói o necessário
  const existingIds = new Set(
    [...refs.taskList.querySelectorAll('.task-item')].map(el => el.dataset.id)
  );
  const filteredIds = new Set(filtered.map(t => t.id));

  // Remove itens que não estão mais visíveis
  refs.taskList.querySelectorAll('.task-item').forEach(el => {
    if (!filteredIds.has(el.dataset.id)) {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }
  });

  // Adiciona ou atualiza itens
  filtered.forEach((task, index) => {
    const existingEl = refs.taskList.querySelector(`[data-id="${task.id}"]`);

    if (existingEl) {
      // Atualiza estado sem re-criar o elemento (preserva animações)
      updateTaskElement(existingEl, task);
    } else {
      const newEl = createTaskElement(task);
      // Insere na posição correta
      const refEl = refs.taskList.children[index];
      refs.taskList.insertBefore(newEl, refEl || null);
    }
  });
}

function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = `task-item${task.done ? ' done' : ''}`;
  li.dataset.id = task.id;
  li.setAttribute('role', 'listitem');

  li.innerHTML = `
    <button
      class="task-checkbox${task.done ? ' checked' : ''}"
      aria-label="${task.done ? 'Desmarcar tarefa' : 'Marcar como concluída'}"
      data-action="toggle"
    ></button>
    <span class="task-text">${escapeHtml(task.text)}</span>
    <div class="task-actions" aria-label="Ações da tarefa">
      <button class="task-action-btn edit" aria-label="Editar tarefa" data-action="edit">
        <i class="ph ph-pencil-simple"></i>
      </button>
      <button class="task-action-btn delete" aria-label="Remover tarefa" data-action="delete">
        <i class="ph ph-trash-simple"></i>
      </button>
    </div>
  `;

  // Delegação de eventos no item
  li.addEventListener('click', handleTaskAction);
  return li;
}

function updateTaskElement(el, task) {
  const isDone    = el.classList.contains('done');
  const checkbox  = el.querySelector('.task-checkbox');
  const textSpan  = el.querySelector('.task-text');

  if (isDone !== task.done) {
    el.classList.toggle('done', task.done);
    checkbox.classList.toggle('checked', task.done);
    checkbox.setAttribute('aria-label', task.done ? 'Desmarcar tarefa' : 'Marcar como concluída');
  }

  if (textSpan.textContent !== task.text) {
    textSpan.textContent = task.text;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ─────────────────────────────────────────
   HANDLERS DE EVENTOS
───────────────────────────────────────── */

// Cliques dentro do item de tarefa (delegação)
function handleTaskAction(e) {
  const btn    = e.target.closest('[data-action]');
  if (!btn) return;

  const li     = e.currentTarget;
  const taskId = li.dataset.id;
  const action = btn.dataset.action;

  if (action === 'toggle') {
    toggleTask(taskId);
    render();
  }

  if (action === 'delete') {
    // Animação de saída antes de remover do estado
    li.classList.add('removing');
    li.addEventListener('animationend', () => {
      deleteTask(taskId);
      render();
    }, { once: true });
  }

  if (action === 'edit') {
    openEditModal(taskId);
  }
}

// Adicionar tarefa via input
function handleAddTask() {
  const text = refs.taskInput.value;
  if (addTask(text)) {
    refs.taskInput.value = '';
    render();
    refs.taskInput.focus();
  } else {
    // Shake no input quando vazio
    refs.taskInput.style.animation = 'none';
    requestAnimationFrame(() => {
      refs.taskInput.style.animation = '';
      refs.taskInput.classList.add('shake');
      refs.taskInput.addEventListener('animationend', () => {
        refs.taskInput.classList.remove('shake');
      }, { once: true });
    });
  }
}

// Filtros
function handleFilterClick(e) {
  const tab = e.target.closest('.filter-tab');
  if (!tab) return;

  state.filter = tab.dataset.filter;

  // Atualiza estado das tabs
  document.querySelectorAll('.filter-tab').forEach(t => {
    const isActive = t.dataset.filter === state.filter;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', String(isActive));
  });

  render();
}

// Limpar concluídas
function handleClearDone() {
  const doneCount = state.tasks.filter(t => t.done).length;
  if (doneCount === 0) return;
  clearDoneTasks();
  render();
}

/* ─────────────────────────────────────────
   MODAL DE EDIÇÃO
───────────────────────────────────────── */
function openEditModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  state.editingId = taskId;
  refs.editInput.value = task.text;
  refs.editModal.hidden = false;

  // Foca no input após a animação
  setTimeout(() => refs.editInput.focus(), 50);
}

function closeEditModal() {
  refs.editModal.hidden = true;
  state.editingId = null;
  refs.editInput.value = '';
}

function saveEdit() {
  if (!state.editingId) return;
  const success = editTask(state.editingId, refs.editInput.value);
  if (success) {
    closeEditModal();
    render();
  }
}

/* ─────────────────────────────────────────
   CURSOR PERSONALIZADO
───────────────────────────────────────── */
function initCursor() {
  // Não inicializa em dispositivos touch
  if (!window.matchMedia('(pointer: fine)').matches) {
    refs.cursorDot.style.display  = 'none';
    refs.cursorRing.style.display = 'none';
    document.body.style.cursor   = 'auto';
    document.querySelectorAll('button, input, a').forEach(el => {
      el.style.cursor = 'auto';
    });
    return;
  }

  let mouseX = -100, mouseY = -100;
  let ringX  = -100, ringY  = -100;
  let raf;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Anel segue com suavização
  function animateCursor() {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;

    refs.cursorDot.style.left  = mouseX + 'px';
    refs.cursorDot.style.top   = mouseY + 'px';
    refs.cursorRing.style.left = ringX + 'px';
    refs.cursorRing.style.top  = ringY + 'px';

    raf = requestAnimationFrame(animateCursor);
  }

  animateCursor();

  // Expansão do anel em elementos interativos
  document.querySelectorAll('button, input, a, [data-action]').forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });

  // Oculta ao sair da janela
  document.addEventListener('mouseleave', () => {
    refs.cursorDot.style.opacity  = '0';
    refs.cursorRing.style.opacity = '0';
  });

  document.addEventListener('mouseenter', () => {
    refs.cursorDot.style.opacity  = '1';
    refs.cursorRing.style.opacity = '0.7';
  });
}

/* ─────────────────────────────────────────
   INICIALIZAÇÃO
───────────────────────────────────────── */
function init() {
  // Carrega tarefas salvas
  loadTasks();

  // Cursor
  initCursor();

  // Adicionar tarefa
  refs.addBtn.addEventListener('click', handleAddTask);
  refs.taskInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAddTask();
  });

  // Filtros
  document.querySelector('.filter-tabs').addEventListener('click', handleFilterClick);

  // Limpar concluídas
  refs.clearDoneBtn.addEventListener('click', handleClearDone);

  // Modal — fechar
  refs.modalClose.addEventListener('click', closeEditModal);
  refs.modalCancel.addEventListener('click', closeEditModal);

  // Modal — salvar
  refs.modalSave.addEventListener('click', saveEdit);
  refs.editInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') closeEditModal();
  });

  // Fechar modal ao clicar no overlay
  refs.editModal.addEventListener('click', e => {
    if (e.target === refs.editModal) closeEditModal();
  });

  // Atalho global ESC para fechar modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !refs.editModal.hidden) closeEditModal();
  });

  // Renderização inicial
  render();
}

// Inicia quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);
