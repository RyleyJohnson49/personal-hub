'use strict';

const CATEGORY_LABELS = { work: 'Work', personal: 'Personal', home: 'Home', health: 'Health', travel: 'Travel' };
const IMPORTANCE_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };
const HORIZON_LABELS = { today: 'Today', 'this-week': 'This Week', 'this-month': 'This Month', someday: 'Someday' };
const UPGRADE_STATUS_LABELS = { someday: 'Someday', budgeting: 'Budgeting', 'in-progress': 'In Progress', done: 'Done' };
const UPGRADE_SUBCAT_LABELS = { tech: 'Tech', home: 'Home', wardrobe: 'Wardrobe', experience: 'Experience', health: 'Health' };
const READING_STATUS_LABELS = { want: 'Want to Read', reading: 'Reading', done: 'Done' };
const MEDIA_STATUS_LABELS = { want: 'Want to Watch', watching: 'Watching', done: 'Done' };
const MEDIA_TYPE_LABELS = { film: 'Film', show: 'Show', podcast: 'Podcast' };

// ── State ──────────────────────────────────────────────────────────────────────

const state = {
  module: 'tasks',
  filters: {
    tasks: { category: '', importance: '', horizon: '', showDone: false },
    dining: {},
    upgrades: { status: '', subcategory: '' },
    reading: { status: '' },
    media: { status: '', type: '' }
  },
  data: { tasks: [], dining: [], upgrades: [], people: [], reading: [], media: [] }
};

// ── Storage ────────────────────────────────────────────────────────────────────

function loadData() {
  try {
    const saved = localStorage.getItem('personalhub-data');
    if (saved) state.data = { ...state.data, ...JSON.parse(saved) };
  } catch(e) {}
}

function saveData() {
  localStorage.setItem('personalhub-data', JSON.stringify(state.data));
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `personal-hub-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Data exported');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      state.data = { tasks: [], dining: [], upgrades: [], people: [], reading: [], media: [], ...parsed };
      saveData();
      renderModule();
      showToast('Data imported');
    } catch(err) {
      showToast('Import failed: invalid file');
    }
  };
  reader.readAsText(file);
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDate(str) {
  if (!str) return null;
  const d = new Date(str + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMonthDay(str) {
  if (!str) return null;
  const parts = str.split('-');
  const month = parts.length === 3 ? parseInt(parts[1]) : parseInt(parts[0]);
  const day   = parts.length === 3 ? parseInt(parts[2]) : parseInt(parts[1]);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[month-1]} ${day}`;
}

function daysUntilBirthday(str) {
  if (!str) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const parts = str.split('-');
  const month = (parts.length === 3 ? parseInt(parts[1]) : parseInt(parts[0])) - 1;
  const day   = parts.length === 3 ? parseInt(parts[2]) : parseInt(parts[1]);
  let next = new Date(today.getFullYear(), month, day);
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next - today) / 86400000);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + 'T12:00:00');
  return Math.round((target - today) / 86400000);
}

function calcNextDue(dueDate, value, unit) {
  const base = dueDate ? new Date(dueDate + 'T12:00:00') : new Date();
  if (unit === 'days')   base.setDate(base.getDate() + value);
  if (unit === 'weeks')  base.setDate(base.getDate() + value * 7);
  if (unit === 'months') base.setMonth(base.getMonth() + value);
  return base.toISOString().slice(0,10);
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Navigation ─────────────────────────────────────────────────────────────────

function navigate(module) {
  state.module = module;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.module === module);
  });
  renderModule();
}

function renderModule() {
  const main = document.getElementById('main');
  const render = { tasks: renderTasks, dining: renderDining, upgrades: renderUpgrades, people: renderPeople, reading: renderReading, media: renderMedia };
  render[state.module]?.(main);
}

// ── Modal ──────────────────────────────────────────────────────────────────────

let _modalSubmit = null;

function showModal({ title, submitLabel = 'Save', item = null, fields, onSubmit }) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalSubmit').textContent = submitLabel;
  document.getElementById('modalBody').innerHTML = fields.map(f => buildField(f, item)).join('');

  const recurringToggle = document.querySelector('[name="recurring"]');
  if (recurringToggle) {
    const extra = document.getElementById('recurringExtra');
    recurringToggle.addEventListener('change', () => {
      extra.style.display = recurringToggle.checked ? 'flex' : 'none';
    });
  }

  const addEventBtn = document.getElementById('addEventBtn');
  if (addEventBtn) addEventBtn.addEventListener('click', addEventRow);

  document.getElementById('modalBody').addEventListener('click', e => {
    const rem = e.target.closest('.event-remove');
    if (rem) rem.closest('.event-row').remove();
  });

  _modalSubmit = () => {
    const values = readFormValues(fields, item);
    if (values) { onSubmit(values); closeModal(); }
  };

  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  _modalSubmit = null;
}

function buildField(f, item) {
  const val = item ? (item[f.name] ?? '') : (f.default ?? '');

  if (f.type === 'row') {
    return `<div class="field-row">${f.fields.map(sf => buildField(sf, item)).join('')}</div>`;
  }

  if (f.type === 'radio') {
    const opts = f.options.map(o =>
      `<span class="radio-option${val === o.value ? ' selected' : ''}" data-name="${f.name}" data-value="${esc(o.value)}">${esc(o.label)}</span>`
    ).join('');
    return `<div class="field"><label class="field-label">${esc(f.label)}</label><div class="radio-group" data-radio="${f.name}">${opts}</div></div>`;
  }

  if (f.type === 'toggle') {
    return `<div class="field">
      <label class="toggle-label">
        <input type="checkbox" name="${f.name}"${val ? ' checked' : ''}>
        <span class="toggle-track"></span>
        <span>${esc(f.label)}</span>
      </label>
    </div>`;
  }

  if (f.type === 'recurring-extra') {
    const show = item?.recurring ? 'flex' : 'none';
    return `<div class="field recurring-row" id="recurringExtra" style="display:${show}">
      <input type="number" name="recurringValue" class="field-input" value="${esc(item?.recurringValue ?? 1)}" min="1" style="width:70px;text-align:center">
      <select name="recurringUnit" class="field-input" style="width:auto">
        ${['days','weeks','months'].map(u => `<option value="${u}"${(item?.recurringUnit ?? 'weeks') === u ? ' selected' : ''}>${u.charAt(0).toUpperCase()+u.slice(1)}</option>`).join('')}
      </select>
    </div>`;
  }

  if (f.type === 'events-list') {
    const events = item?.events ?? [];
    return `<div class="field">
      <label class="field-label">Upcoming Events</label>
      <div class="events-list" id="eventsList">${events.map(eventRowHTML).join('')}</div>
      <button type="button" class="btn-add-event" id="addEventBtn">
        <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 2v10M2 7h10"/></svg>
        Add event
      </button>
    </div>`;
  }

  if (f.type === 'textarea') {
    return `<div class="field"><label class="field-label">${esc(f.label)}</label><textarea name="${f.name}" class="field-input" placeholder="${esc(f.placeholder ?? '')}">${esc(val)}</textarea></div>`;
  }

  if (f.type === 'select') {
    const opts = f.options.map(o => `<option value="${esc(o.value)}"${val === o.value ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
    return `<div class="field"><label class="field-label">${esc(f.label)}</label><select name="${f.name}" class="field-input"><option value="">— Select</option>${opts}</select></div>`;
  }

  return `<div class="field">
    <label class="field-label">${esc(f.label)}${!f.required ? ' <span style="color:var(--text-muted);font-weight:400;text-transform:none;font-size:11px">(optional)</span>' : ''}</label>
    <input type="${f.type ?? 'text'}" name="${f.name}" class="field-input" value="${esc(val)}" placeholder="${esc(f.placeholder ?? '')}"${f.required ? ' required' : ''}>
  </div>`;
}

function eventRowHTML(ev = {}) {
  return `<div class="event-row">
    <input type="text" name="event-title" class="field-input" value="${esc(ev.title ?? '')}" placeholder="Event name">
    <input type="date" name="event-date" class="field-input date-input" value="${esc(ev.date ?? '')}">
    <button type="button" class="event-remove" title="Remove">
      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 2l10 10M12 2L2 12"/></svg>
    </button>
  </div>`;
}

function addEventRow() {
  document.getElementById('eventsList').insertAdjacentHTML('beforeend', eventRowHTML());
}

function readFormValues(fields, item) {
  const form = document.getElementById('modalBody');
  const values = {};
  let valid = true;

  function readField(f) {
    if (f.type === 'row') { f.fields.forEach(readField); return; }

    if (f.type === 'events-list') {
      values.events = Array.from(form.querySelectorAll('#eventsList .event-row')).map(row => ({
        id: uid(),
        title: row.querySelector('[name="event-title"]').value.trim(),
        date: row.querySelector('[name="event-date"]').value
      })).filter(ev => ev.title);
      return;
    }

    if (f.type === 'recurring-extra') {
      values.recurringValue = parseInt(form.querySelector('[name="recurringValue"]')?.value) || 1;
      values.recurringUnit = form.querySelector('[name="recurringUnit"]')?.value || 'weeks';
      return;
    }

    if (f.type === 'toggle') {
      values[f.name] = form.querySelector(`[name="${f.name}"]`)?.checked ?? false;
      return;
    }

    if (f.type === 'radio') {
      const sel = form.querySelector(`.radio-option.selected[data-name="${f.name}"]`);
      values[f.name] = sel?.dataset.value ?? (item?.[f.name] ?? '');
      return;
    }

    const el = form.querySelector(`[name="${f.name}"]`);
    if (!el) return;
    const v = el.value.trim();
    if (f.required && !v) {
      el.focus();
      el.style.borderColor = 'var(--imp-high)';
      valid = false;
      return;
    }
    values[f.name] = v;
  }

  fields.forEach(readField);
  return valid ? values : null;
}

document.addEventListener('click', e => {
  const opt = e.target.closest('.radio-option');
  if (!opt) return;
  const group = opt.closest('.radio-group');
  if (!group) return;
  group.querySelectorAll('.radio-option').forEach(o => o.classList.remove('selected'));
  opt.classList.add('selected');
});

// ── TASKS ──────────────────────────────────────────────────────────────────────

function renderTasks(main) {
  const f = state.filters.tasks;
  const items = state.data.tasks.filter(t => {
    if (f.category && t.category !== f.category) return false;
    if (f.importance && t.importance !== f.importance) return false;
    if (f.horizon && t.horizon !== f.horizon) return false;
    return true;
  });
  const active = items.filter(t => t.status === 'todo');
  const done   = items.filter(t => t.status === 'done');

  main.innerHTML = `
    <div class="module-header">
      <div class="module-title-wrap">
        <div class="module-eyebrow">Personal Hub</div>
        <h2 class="module-title">Tasks</h2>
      </div>
      <button class="btn btn-primary" id="addTaskBtn">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v12M2 8h12"/></svg>
        Add Task
      </button>
    </div>
    <div class="filter-bar">
      <select class="filter-select" id="filterCategory">
        <option value="">All Categories</option>
        ${Object.entries(CATEGORY_LABELS).map(([v,l]) => `<option value="${v}"${f.category===v?' selected':''}>${l}</option>`).join('')}
      </select>
      <select class="filter-select" id="filterImportance">
        <option value="">All Priorities</option>
        ${Object.entries(IMPORTANCE_LABELS).map(([v,l]) => `<option value="${v}"${f.importance===v?' selected':''}>${l}</option>`).join('')}
      </select>
      <select class="filter-select" id="filterHorizon">
        <option value="">All Horizons</option>
        ${Object.entries(HORIZON_LABELS).map(([v,l]) => `<option value="${v}"${f.horizon===v?' selected':''}>${l}</option>`).join('')}
      </select>
      <span class="filter-spacer"></span>
      <label class="toggle-label">
        <input type="checkbox" id="showDoneToggle"${f.showDone?' checked':''}>
        <span class="toggle-track"></span>
        Show completed
      </label>
    </div>
    <div class="task-list" id="taskList">
      ${active.length === 0 && !f.showDone ? emptyState('Tasks', 'Nothing here. Add a task to get started.') : active.map(taskItemHTML).join('')}
      ${f.showDone && done.length > 0 ? `<div class="section-divider">Completed (${done.length})</div>${done.map(taskItemHTML).join('')}` : ''}
    </div>`;

  document.getElementById('addTaskBtn').addEventListener('click', () => openTaskModal());
  document.getElementById('filterCategory').addEventListener('change', e => { state.filters.tasks.category = e.target.value; renderModule(); });
  document.getElementById('filterImportance').addEventListener('change', e => { state.filters.tasks.importance = e.target.value; renderModule(); });
  document.getElementById('filterHorizon').addEventListener('change', e => { state.filters.tasks.horizon = e.target.value; renderModule(); });
  document.getElementById('showDoneToggle').addEventListener('change', e => { state.filters.tasks.showDone = e.target.checked; renderModule(); });

  document.getElementById('taskList').addEventListener('click', e => {
    const check = e.target.closest('.task-check');
    if (check) { toggleTask(check.dataset.id); return; }
    const edit = e.target.closest('[data-edit]');
    if (edit) { openTaskModal(state.data.tasks.find(t => t.id === edit.dataset.edit)); return; }
    const del = e.target.closest('[data-delete]');
    if (del) { deleteTask(del.dataset.delete); }
  });
}

function taskItemHTML(t) {
  const days = daysUntil(t.dueDate);
  let dueLabel = '';
  if (t.dueDate) {
    if (days < 0)  dueLabel = `<span class="badge badge-due overdue">Overdue ${Math.abs(days)}d</span>`;
    else if (days === 0) dueLabel = `<span class="badge badge-due">Today</span>`;
    else           dueLabel = `<span class="badge badge-due">${formatDate(t.dueDate)}</span>`;
  }
  const recurLabel = t.recurring
    ? `<span class="badge badge-recurring">↻ Every ${t.recurringValue} ${t.recurringUnit}</span>` : '';

  return `<div class="task-item${t.status === 'done' ? ' done' : ''}">
    <div class="task-check${t.status === 'done' ? ' checked' : ''}" data-id="${t.id}" role="checkbox" aria-checked="${t.status === 'done'}">
      <svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/></svg>
    </div>
    <div class="task-body">
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">
        ${t.category ? `<span class="badge badge-cat-${t.category}">${CATEGORY_LABELS[t.category]??t.category}</span>` : ''}
        ${t.importance ? `<span class="badge badge-imp-${t.importance}">${IMPORTANCE_LABELS[t.importance]??t.importance}</span>` : ''}
        ${t.horizon ? `<span class="badge badge-horizon">${HORIZON_LABELS[t.horizon]??t.horizon}</span>` : ''}
        ${dueLabel}${recurLabel}
      </div>
      ${t.notes ? `<div class="task-notes-preview">${esc(t.notes)}</div>` : ''}
    </div>
    <div class="task-actions">
      <button class="btn-icon" data-edit="${t.id}" title="Edit">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2.5l2.5 2.5-8 8H3v-2.5l8-8z"/></svg>
      </button>
      <button class="btn-icon" data-delete="${t.id}" title="Delete">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5l.5-9"/></svg>
      </button>
    </div>
  </div>`;
}

function openTaskModal(task) {
  showModal({
    title: task ? 'Edit Task' : 'New Task',
    item: task,
    fields: [
      { name: 'title', label: 'Title', required: true, placeholder: 'What needs doing?' },
      { type: 'row', fields: [
        { name: 'category',   label: 'Category', type: 'select', options: Object.entries(CATEGORY_LABELS).map(([v,l])=>({value:v,label:l})) },
        { name: 'importance', label: 'Priority',  type: 'select', options: Object.entries(IMPORTANCE_LABELS).map(([v,l])=>({value:v,label:l})) }
      ]},
      { type: 'row', fields: [
        { name: 'horizon', label: 'Horizon',  type: 'select', options: Object.entries(HORIZON_LABELS).map(([v,l])=>({value:v,label:l})) },
        { name: 'dueDate', label: 'Due Date', type: 'date' }
      ]},
      { name: 'recurring', type: 'toggle', label: 'Recurring task' },
      { type: 'recurring-extra' },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any details…' }
    ],
    onSubmit: values => {
      if (!values.recurring) { values.recurringValue = null; values.recurringUnit = null; }
      if (task) { Object.assign(task, values); }
      else { state.data.tasks.unshift({ id: uid(), status: 'todo', createdAt: new Date().toISOString(), completedAt: null, ...values }); }
      saveData(); renderModule();
    }
  });
}

function toggleTask(id) {
  const task = state.data.tasks.find(t => t.id === id);
  if (!task) return;
  if (task.recurring && task.status === 'todo') {
    task.completedAt = new Date().toISOString();
    if (task.dueDate) task.dueDate = calcNextDue(task.dueDate, task.recurringValue, task.recurringUnit);
    showToast('Done! Next: ' + formatDate(task.dueDate));
  } else if (task.status === 'todo') {
    task.status = 'done';
    task.completedAt = new Date().toISOString();
  } else {
    task.status = 'todo';
    task.completedAt = null;
  }
  saveData(); renderModule();
}

function deleteTask(id) {
  state.data.tasks = state.data.tasks.filter(t => t.id !== id);
  saveData(); renderModule();
}

// ── DINING ─────────────────────────────────────────────────────────────────────

function renderDining(main) {
  const items = state.data.dining;
  main.innerHTML = `
    <div class="module-header">
      <div class="module-title-wrap">
        <div class="module-eyebrow">Personal Hub</div>
        <h2 class="module-title">Dining</h2>
      </div>
      <button class="btn btn-primary" id="addDiningBtn">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v12M2 8h12"/></svg>
        Add Place
      </button>
    </div>
    ${items.length === 0 ? emptyState('Dining', 'Your wishlist is empty. Add a restaurant to get started.') :
      `<div class="card-grid" id="diningGrid">${items.map(diningCardHTML).join('')}</div>`}`;

  document.getElementById('addDiningBtn').addEventListener('click', () => openDiningModal());
  main.querySelectorAll('[data-edit-dining]').forEach(btn => {
    btn.addEventListener('click', () => openDiningModal(state.data.dining.find(d => d.id === btn.dataset.editDining)));
  });
  main.querySelectorAll('[data-delete-dining]').forEach(btn => {
    btn.addEventListener('click', () => { state.data.dining = state.data.dining.filter(d => d.id !== btn.dataset.deleteDining); saveData(); renderModule(); });
  });
  main.querySelectorAll('[data-visited]').forEach(btn => {
    btn.addEventListener('click', () => { state.data.dining = state.data.dining.filter(d => d.id !== btn.dataset.visited); saveData(); renderModule(); showToast('Marked as visited'); });
  });
}

function diningCardHTML(d) {
  return `<div class="card">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
      <div style="flex:1;min-width:0;">
        <div class="card-title">${esc(d.name)}</div>
        ${d.location ? `<div class="card-subtitle">${esc(d.location)}</div>` : ''}
      </div>
      <div class="card-actions">
        <button class="btn-icon" data-edit-dining="${d.id}" title="Edit">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2.5l2.5 2.5-8 8H3v-2.5l8-8z"/></svg>
        </button>
        <button class="btn-icon" data-delete-dining="${d.id}" title="Remove">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5l.5-9"/></svg>
        </button>
      </div>
    </div>
    ${d.cuisine ? `<div style="margin-top:8px;"><span class="badge badge-horizon">${esc(d.cuisine)}</span></div>` : ''}
    ${d.notes ? `<div class="card-notes">${esc(d.notes)}</div>` : ''}
    <div style="margin-top:12px;">
      <button class="btn btn-sm btn-secondary" data-visited="${d.id}">Been here ✓</button>
    </div>
  </div>`;
}

function openDiningModal(item) {
  showModal({
    title: item ? 'Edit Place' : 'New Place',
    item,
    fields: [
      { name: 'name', label: 'Name', required: true, placeholder: 'Restaurant or bar name' },
      { type: 'row', fields: [
        { name: 'location', label: 'Neighborhood / City', placeholder: 'e.g. Hayes Valley, SF' },
        { name: 'cuisine',  label: 'Cuisine',             placeholder: 'e.g. Japanese, Italian' }
      ]},
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Tips, recommendations…' }
    ],
    onSubmit: values => {
      if (item) { Object.assign(item, values); }
      else { state.data.dining.unshift({ id: uid(), createdAt: new Date().toISOString(), ...values }); }
      saveData(); renderModule();
    }
  });
}

// ── UPGRADES ───────────────────────────────────────────────────────────────────

function renderUpgrades(main) {
  const f = state.filters.upgrades;
  const items = state.data.upgrades.filter(u => {
    if (f.status && u.status !== f.status) return false;
    if (f.subcategory && u.subcategory !== f.subcategory) return false;
    return true;
  });

  main.innerHTML = `
    <div class="module-header">
      <div class="module-title-wrap">
        <div class="module-eyebrow">Personal Hub</div>
        <h2 class="module-title">Upgrades</h2>
      </div>
      <button class="btn btn-primary" id="addUpgradeBtn">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v12M2 8h12"/></svg>
        Add Upgrade
      </button>
    </div>
    <div class="filter-bar">
      <select class="filter-select" id="filterUpgradeStatus">
        <option value="">All Statuses</option>
        ${Object.entries(UPGRADE_STATUS_LABELS).map(([v,l]) => `<option value="${v}"${f.status===v?' selected':''}>${l}</option>`).join('')}
      </select>
      <select class="filter-select" id="filterUpgradeSubcat">
        <option value="">All Categories</option>
        ${Object.entries(UPGRADE_SUBCAT_LABELS).map(([v,l]) => `<option value="${v}"${f.subcategory===v?' selected':''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="upgrade-list">
      ${items.length === 0 ? emptyState('Upgrades', 'Nothing aspirational yet. Add an upgrade to get started.') : items.map(upgradeItemHTML).join('')}
    </div>`;

  document.getElementById('addUpgradeBtn').addEventListener('click', () => openUpgradeModal());
  document.getElementById('filterUpgradeStatus').addEventListener('change', e => { state.filters.upgrades.status = e.target.value; renderModule(); });
  document.getElementById('filterUpgradeSubcat').addEventListener('change', e => { state.filters.upgrades.subcategory = e.target.value; renderModule(); });
  main.querySelectorAll('[data-edit-upgrade]').forEach(btn => {
    btn.addEventListener('click', () => openUpgradeModal(state.data.upgrades.find(u => u.id === btn.dataset.editUpgrade)));
  });
  main.querySelectorAll('[data-delete-upgrade]').forEach(btn => {
    btn.addEventListener('click', () => { state.data.upgrades = state.data.upgrades.filter(u => u.id !== btn.dataset.deleteUpgrade); saveData(); renderModule(); });
  });
}

function upgradeItemHTML(u) {
  return `<div class="upgrade-item">
    <div class="upgrade-body">
      <div class="upgrade-title">${esc(u.item)}</div>
      <div class="upgrade-meta">
        ${u.subcategory ? `<span class="badge badge-horizon">${UPGRADE_SUBCAT_LABELS[u.subcategory]??u.subcategory}</span>` : ''}
        ${u.status ? `<span class="badge badge-status-${u.status}">${UPGRADE_STATUS_LABELS[u.status]??u.status}</span>` : ''}
        ${u.costEstimate ? `<span class="upgrade-cost">~$${Number(u.costEstimate).toLocaleString()}</span>` : ''}
      </div>
      ${u.notes ? `<div class="task-notes-preview" style="margin-top:5px;">${esc(u.notes)}</div>` : ''}
    </div>
    <div class="upgrade-actions">
      <button class="btn-icon" data-edit-upgrade="${u.id}" title="Edit">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2.5l2.5 2.5-8 8H3v-2.5l8-8z"/></svg>
      </button>
      <button class="btn-icon" data-delete-upgrade="${u.id}" title="Delete">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5l.5-9"/></svg>
      </button>
    </div>
  </div>`;
}

function openUpgradeModal(item) {
  showModal({
    title: item ? 'Edit Upgrade' : 'New Upgrade',
    item,
    fields: [
      { name: 'item', label: 'Item or Experience', required: true, placeholder: 'What do you want to upgrade?' },
      { type: 'row', fields: [
        { name: 'subcategory', label: 'Category', type: 'select', options: Object.entries(UPGRADE_SUBCAT_LABELS).map(([v,l])=>({value:v,label:l})) },
        { name: 'status',      label: 'Status',   type: 'select', options: Object.entries(UPGRADE_STATUS_LABELS).map(([v,l])=>({value:v,label:l})) }
      ]},
      { name: 'costEstimate', label: 'Cost Estimate', type: 'number', placeholder: 'e.g. 500' },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Links, details, reasoning…' }
    ],
    onSubmit: values => {
      if (item) { Object.assign(item, values); }
      else { state.data.upgrades.unshift({ id: uid(), createdAt: new Date().toISOString(), ...values }); }
      saveData(); renderModule();
    }
  });
}

// ── PEOPLE ─────────────────────────────────────────────────────────────────────

function renderPeople(main) {
  const items = [...state.data.people].sort((a, b) => {
    const da = a.birthday ? daysUntilBirthday(a.birthday) : 999;
    const db = b.birthday ? daysUntilBirthday(b.birthday) : 999;
    return da - db;
  });

  main.innerHTML = `
    <div class="module-header">
      <div class="module-title-wrap">
        <div class="module-eyebrow">Personal Hub</div>
        <h2 class="module-title">People</h2>
      </div>
      <button class="btn btn-primary" id="addPersonBtn">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v12M2 8h12"/></svg>
        Add Person
      </button>
    </div>
    ${items.length === 0 ? emptyState('People', 'No one here yet. Add someone to keep track of.') :
      `<div class="card-grid">${items.map(personCardHTML).join('')}</div>`}`;

  document.getElementById('addPersonBtn').addEventListener('click', () => openPersonModal());
  main.querySelectorAll('[data-edit-person]').forEach(btn => {
    btn.addEventListener('click', () => openPersonModal(state.data.people.find(p => p.id === btn.dataset.editPerson)));
  });
  main.querySelectorAll('[data-delete-person]').forEach(btn => {
    btn.addEventListener('click', () => { state.data.people = state.data.people.filter(p => p.id !== btn.dataset.deletePerson); saveData(); renderModule(); });
  });
}

function personCardHTML(p) {
  const initials = p.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
  const days = p.birthday ? daysUntilBirthday(p.birthday) : null;
  const birthdayBadge = p.birthday
    ? `<div style="margin-bottom:10px;"><span class="birthday-badge">🎂 ${formatMonthDay(p.birthday)}${days !== null && days <= 14 ? ` · in ${days}d` : ''}</span></div>` : '';

  const upcomingEvents = (p.events ?? [])
    .filter(e => e.date)
    .sort((a,b) => new Date(a.date) - new Date(b.date))
    .slice(0,3)
    .map(e => `<div class="person-event"><span class="person-event-date">${formatDate(e.date)}</span><span>${esc(e.title)}</span></div>`)
    .join('');

  return `<div class="card">
    <div class="person-card-header">
      <div class="person-avatar">${initials}</div>
      <div class="person-info">
        <div class="person-name">${esc(p.name)}</div>
        <div class="person-rel">${esc(p.relationship ?? '')}</div>
      </div>
      <div class="card-actions">
        <button class="btn-icon" data-edit-person="${p.id}" title="Edit">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2.5l2.5 2.5-8 8H3v-2.5l8-8z"/></svg>
        </button>
        <button class="btn-icon" data-delete-person="${p.id}" title="Delete">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5l.5-9"/></svg>
        </button>
      </div>
    </div>
    ${birthdayBadge}
    ${upcomingEvents ? `<div class="person-events">${upcomingEvents}</div>` : ''}
    ${p.notes ? `<div class="card-notes">${esc(p.notes)}</div>` : ''}
  </div>`;
}

function openPersonModal(item) {
  showModal({
    title: item ? 'Edit Person' : 'New Person',
    item,
    fields: [
      { type: 'row', fields: [
        { name: 'name',         label: 'Name',         required: true },
        { name: 'relationship', label: 'Relationship', placeholder: 'Friend, Family…' }
      ]},
      { name: 'birthday', label: 'Birthday', type: 'date' },
      { type: 'events-list' },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Things to remember…' }
    ],
    onSubmit: values => {
      if (item) { Object.assign(item, values); }
      else { state.data.people.push({ id: uid(), createdAt: new Date().toISOString(), events: [], ...values }); }
      saveData(); renderModule();
    }
  });
}

// ── READING ────────────────────────────────────────────────────────────────────

function renderReading(main) {
  const f = state.filters.reading;
  const items = state.data.reading.filter(r => !f.status || r.status === f.status);

  main.innerHTML = `
    <div class="module-header">
      <div class="module-title-wrap">
        <div class="module-eyebrow">Personal Hub</div>
        <h2 class="module-title">Reading</h2>
      </div>
      <button class="btn btn-primary" id="addReadingBtn">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v12M2 8h12"/></svg>
        Add Book
      </button>
    </div>
    <div class="filter-bar">
      <select class="filter-select" id="filterReadingStatus">
        <option value="">All</option>
        ${Object.entries(READING_STATUS_LABELS).map(([v,l]) => `<option value="${v}"${f.status===v?' selected':''}>${l}</option>`).join('')}
      </select>
    </div>
    ${items.length === 0 ? emptyState('Reading', 'Nothing on the list. Add a book to get started.') :
      `<div class="card-grid">${items.map(readingCardHTML).join('')}</div>`}`;

  document.getElementById('addReadingBtn').addEventListener('click', () => openReadingModal());
  document.getElementById('filterReadingStatus').addEventListener('change', e => { state.filters.reading.status = e.target.value; renderModule(); });
  main.querySelectorAll('[data-edit-reading]').forEach(btn => {
    btn.addEventListener('click', () => openReadingModal(state.data.reading.find(r => r.id === btn.dataset.editReading)));
  });
  main.querySelectorAll('[data-delete-reading]').forEach(btn => {
    btn.addEventListener('click', () => { state.data.reading = state.data.reading.filter(r => r.id !== btn.dataset.deleteReading); saveData(); renderModule(); });
  });
}

function readingCardHTML(r) {
  return `<div class="card">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
      <div style="flex:1;min-width:0;">
        <div class="card-title">${esc(r.title)}</div>
        ${r.author ? `<div class="card-subtitle">${esc(r.author)}</div>` : ''}
      </div>
      <div class="card-actions">
        <button class="btn-icon" data-edit-reading="${r.id}" title="Edit">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2.5l2.5 2.5-8 8H3v-2.5l8-8z"/></svg>
        </button>
        <button class="btn-icon" data-delete-reading="${r.id}" title="Delete">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5l.5-9"/></svg>
        </button>
      </div>
    </div>
    <div class="card-meta">
      <span class="badge badge-reading-${r.status ?? 'want'}">${READING_STATUS_LABELS[r.status] ?? r.status}</span>
    </div>
    ${r.notes ? `<div class="card-notes">${esc(r.notes)}</div>` : ''}
  </div>`;
}

function openReadingModal(item) {
  showModal({
    title: item ? 'Edit Book' : 'New Book',
    item,
    fields: [
      { name: 'title',  label: 'Title',  required: true },
      { name: 'author', label: 'Author', placeholder: 'Author name' },
      { name: 'status', label: 'Status', type: 'radio', default: 'want',
        options: Object.entries(READING_STATUS_LABELS).map(([v,l]) => ({value:v,label:l})) },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Why you want to read it…' }
    ],
    onSubmit: values => {
      if (item) { Object.assign(item, values); }
      else { state.data.reading.unshift({ id: uid(), createdAt: new Date().toISOString(), status: 'want', ...values }); }
      saveData(); renderModule();
    }
  });
}

// ── MEDIA ──────────────────────────────────────────────────────────────────────

function renderMedia(main) {
  const f = state.filters.media;
  const items = state.data.media.filter(m => {
    if (f.status && m.status !== f.status) return false;
    if (f.type   && m.type   !== f.type)   return false;
    return true;
  });

  main.innerHTML = `
    <div class="module-header">
      <div class="module-title-wrap">
        <div class="module-eyebrow">Personal Hub</div>
        <h2 class="module-title">Media</h2>
      </div>
      <button class="btn btn-primary" id="addMediaBtn">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2v12M2 8h12"/></svg>
        Add Title
      </button>
    </div>
    <div class="filter-bar">
      <select class="filter-select" id="filterMediaType">
        <option value="">All Types</option>
        ${Object.entries(MEDIA_TYPE_LABELS).map(([v,l]) => `<option value="${v}"${f.type===v?' selected':''}>${l}</option>`).join('')}
      </select>
      <select class="filter-select" id="filterMediaStatus">
        <option value="">All Statuses</option>
        ${Object.entries(MEDIA_STATUS_LABELS).map(([v,l]) => `<option value="${v}"${f.status===v?' selected':''}>${l}</option>`).join('')}
      </select>
    </div>
    ${items.length === 0 ? emptyState('Media', 'Nothing queued up. Add something to watch or listen to.') :
      `<div class="card-grid">${items.map(mediaCardHTML).join('')}</div>`}`;

  document.getElementById('addMediaBtn').addEventListener('click', () => openMediaModal());
  document.getElementById('filterMediaType').addEventListener('change', e => { state.filters.media.type = e.target.value; renderModule(); });
  document.getElementById('filterMediaStatus').addEventListener('change', e => { state.filters.media.status = e.target.value; renderModule(); });
  main.querySelectorAll('[data-edit-media]').forEach(btn => {
    btn.addEventListener('click', () => openMediaModal(state.data.media.find(m => m.id === btn.dataset.editMedia)));
  });
  main.querySelectorAll('[data-delete-media]').forEach(btn => {
    btn.addEventListener('click', () => { state.data.media = state.data.media.filter(m => m.id !== btn.dataset.deleteMedia); saveData(); renderModule(); });
  });
}

function mediaCardHTML(m) {
  const statusKey = m.status === 'watching' ? 'reading' : m.status === 'done' ? 'done' : 'want';
  return `<div class="card">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
      <div style="flex:1;min-width:0;">
        <div class="card-title">${esc(m.title)}</div>
      </div>
      <div class="card-actions">
        <button class="btn-icon" data-edit-media="${m.id}" title="Edit">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2.5l2.5 2.5-8 8H3v-2.5l8-8z"/></svg>
        </button>
        <button class="btn-icon" data-delete-media="${m.id}" title="Delete">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5l.5-9"/></svg>
        </button>
      </div>
    </div>
    <div class="card-meta">
      ${m.type ? `<span class="badge badge-type-${m.type}">${MEDIA_TYPE_LABELS[m.type]??m.type}</span>` : ''}
      <span class="badge badge-reading-${statusKey}">${MEDIA_STATUS_LABELS[m.status]??m.status}</span>
    </div>
    ${m.notes ? `<div class="card-notes">${esc(m.notes)}</div>` : ''}
  </div>`;
}

function openMediaModal(item) {
  showModal({
    title: item ? 'Edit Title' : 'New Title',
    item,
    fields: [
      { name: 'title', label: 'Title', required: true },
      { name: 'type',  label: 'Type',  type: 'select', options: Object.entries(MEDIA_TYPE_LABELS).map(([v,l])=>({value:v,label:l})) },
      { name: 'status', label: 'Status', type: 'radio', default: 'want',
        options: Object.entries(MEDIA_STATUS_LABELS).map(([v,l]) => ({value:v,label:l})) },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Notes, who recommended it…' }
    ],
    onSubmit: values => {
      if (item) { Object.assign(item, values); }
      else { state.data.media.unshift({ id: uid(), createdAt: new Date().toISOString(), status: 'want', ...values }); }
      saveData(); renderModule();
    }
  });
}

// ── Shared ─────────────────────────────────────────────────────────────────────

function emptyState(module, desc) {
  return `<div class="empty-state">
    <div class="empty-state-icon">
      <svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="1.2">
        <circle cx="22" cy="22" r="18"/>
        <path d="M14 22h16M22 14v16"/>
      </svg>
    </div>
    <div class="empty-title">${module}</div>
    <div class="empty-desc">${desc}</div>
  </div>`;
}

// ── Init ───────────────────────────────────────────────────────────────────────

function init() {
  loadData();
  renderModule();

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.module));
  });

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modalSubmit').addEventListener('click', () => {
    if (_modalSubmit) _modalSubmit();
  });

  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', e => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

document.addEventListener('DOMContentLoaded', init);
