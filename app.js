'use strict';

const CATEGORY_LABELS = { work: 'Work', personal: 'Personal', home: 'Home', health: 'Health', travel: 'Travel' };
const IMPORTANCE_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };
const HORIZON_LABELS = { today: 'Today', 'this-week': 'This Week', 'this-month': 'This Month', someday: 'Someday' };
const UPGRADE_STATUS_LABELS = { someday: 'Someday', budgeting: 'Budgeting', 'in-progress': 'In Progress', done: 'Done' };
const UPGRADE_SUBCAT_LABELS = { tech: 'Tech', home: 'Home', wardrobe: 'Wardrobe', experience: 'Experience', health: 'Health' };
const GENRE_LABELS = { fiction: 'Fiction', nonfiction: 'Nonfiction' };
const MEDIA_STATUS_LABELS = { want: 'Want to Watch', watching: 'Watching', done: 'Done' };
const MEDIA_TYPE_LABELS = { film: 'Film', show: 'Show', podcast: 'Podcast' };

const HORIZON_ORDER       = { today: 0, 'this-week': 1, 'this-month': 2, someday: 3 };
const IMPORTANCE_ORDER    = { high: 0, medium: 1, low: 2 };
const UPGRADE_STATUS_ORDER = { someday: 0, budgeting: 1, 'in-progress': 2, done: 3 };

// ── State ──────────────────────────────────────────────────────────────────────

const state = {
  module: 'tasks',
  filters: {
    tasks:    { category: '', importance: '', horizon: '', showDone: false, sortBy: '', sortDir: 'asc', groupBy: '' },
    dining:   { showDone: false },
    upgrades: { status: '', subcategory: '', sortBy: '', sortDir: 'asc', groupBy: '', showDone: false },
    reading:  { genre: '', showDone: false },
    media:    { type: '', showDone: false }
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

function sortItems(items, sortBy, sortDir) {
  if (!sortBy) return items;
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'title': case 'item':
        return dir * (a[sortBy] || '').toLowerCase().localeCompare((b[sortBy] || '').toLowerCase());
      case 'dueDate': {
        const av = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bv = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return dir * (av - bv);
      }
      case 'importance':
        return dir * ((IMPORTANCE_ORDER[a.importance] ?? 99) - (IMPORTANCE_ORDER[b.importance] ?? 99));
      case 'horizon':
        return dir * ((HORIZON_ORDER[a.horizon] ?? 99) - (HORIZON_ORDER[b.horizon] ?? 99));
      case 'status':
        return dir * ((UPGRADE_STATUS_ORDER[a.status] ?? 99) - (UPGRADE_STATUS_ORDER[b.status] ?? 99));
      case 'costEstimate':
        return dir * ((parseFloat(a.costEstimate) || 0) - (parseFloat(b.costEstimate) || 0));
      case 'createdAt':
        return dir * ((a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0));
    }
    return 0;
  });
}

function groupItems(items, groupBy) {
  if (!groupBy) return [{ label: null, items }];
  const configs = {
    horizon:     { labels: HORIZON_LABELS,       order: ['today', 'this-week', 'this-month', 'someday', '__none__'], none: 'No Horizon' },
    importance:  { labels: IMPORTANCE_LABELS,     order: ['high', 'medium', 'low', '__none__'],                       none: 'No Priority' },
    category:    { labels: CATEGORY_LABELS,       order: [...Object.keys(CATEGORY_LABELS), '__none__'],                none: 'No Category' },
    status:      { labels: UPGRADE_STATUS_LABELS, order: [...Object.keys(UPGRADE_STATUS_LABELS), '__none__'],          none: 'No Status' },
    subcategory: { labels: UPGRADE_SUBCAT_LABELS, order: [...Object.keys(UPGRADE_SUBCAT_LABELS), '__none__'],          none: 'No Category' },
  };
  const cfg = configs[groupBy] || { labels: {}, order: [], none: 'Other' };
  const groups = {};
  for (const item of items) {
    const key = item[groupBy] || '__none__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  const seen = new Set(cfg.order);
  const extraKeys = Object.keys(groups).filter(k => !seen.has(k));
  return [...cfg.order, ...extraKeys]
    .filter(k => groups[k])
    .map(k => ({ label: k === '__none__' ? cfg.none : (cfg.labels[k] || k), items: groups[k] }));
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

  const sorted = sortItems(active, f.sortBy, f.sortDir);
  const groups = groupItems(sorted, f.groupBy);
  const hasGroups = f.groupBy && groups.some(g => g.label);

  let taskListContent;
  if (active.length === 0 && !f.showDone) {
    taskListContent = emptyState('Tasks', 'Nothing here. Add a task to get started.');
  } else if (hasGroups) {
    taskListContent = groups.map(g =>
      `<div class="section-divider">${esc(g.label)} <span class="group-count">${g.items.length}</span></div>${g.items.map(taskItemHTML).join('')}`
    ).join('');
  } else {
    taskListContent = sorted.map(taskItemHTML).join('');
  }
  if (f.showDone && done.length > 0) {
    const sortedDone = sortItems(done, f.sortBy, f.sortDir);
    taskListContent += `<div class="section-divider">Completed (${done.length})</div>${sortedDone.map(taskItemHTML).join('')}`;
  }

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
      <select class="filter-select" id="filterSortBy">
        <option value="">Sort: Default</option>
        <option value="dueDate"${f.sortBy==='dueDate'?' selected':''}>Due Date</option>
        <option value="importance"${f.sortBy==='importance'?' selected':''}>Priority</option>
        <option value="horizon"${f.sortBy==='horizon'?' selected':''}>Horizon</option>
        <option value="title"${f.sortBy==='title'?' selected':''}>Name</option>
        <option value="createdAt"${f.sortBy==='createdAt'?' selected':''}>Date Added</option>
      </select>
      ${f.sortBy ? `<button class="sort-dir-btn" id="sortDirBtn" title="Reverse sort order">${f.sortDir === 'asc' ? '↑' : '↓'}</button>` : ''}
      <select class="filter-select" id="filterGroupBy">
        <option value="">Group: None</option>
        <option value="horizon"${f.groupBy==='horizon'?' selected':''}>by Horizon</option>
        <option value="importance"${f.groupBy==='importance'?' selected':''}>by Priority</option>
        <option value="category"${f.groupBy==='category'?' selected':''}>by Category</option>
      </select>
      <span class="filter-spacer"></span>
      <label class="toggle-label">
        <input type="checkbox" id="showDoneToggle"${f.showDone?' checked':''}>
        <span class="toggle-track"></span>
        Show completed
      </label>
    </div>
    <div class="task-list" id="taskList">${taskListContent}</div>`;

  document.getElementById('addTaskBtn').addEventListener('click', () => openTaskModal());
  document.getElementById('filterCategory').addEventListener('change', e => { state.filters.tasks.category = e.target.value; renderModule(); });
  document.getElementById('filterImportance').addEventListener('change', e => { state.filters.tasks.importance = e.target.value; renderModule(); });
  document.getElementById('filterHorizon').addEventListener('change', e => { state.filters.tasks.horizon = e.target.value; renderModule(); });
  document.getElementById('filterSortBy').addEventListener('change', e => { state.filters.tasks.sortBy = e.target.value; renderModule(); });
  const sortDirBtn = document.getElementById('sortDirBtn');
  if (sortDirBtn) sortDirBtn.addEventListener('click', () => { state.filters.tasks.sortDir = state.filters.tasks.sortDir === 'asc' ? 'desc' : 'asc'; renderModule(); });
  document.getElementById('filterGroupBy').addEventListener('change', e => { state.filters.tasks.groupBy = e.target.value; renderModule(); });
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
  const f = state.filters.dining;
  const active = state.data.dining.filter(d => d.status !== 'done');
  const done   = state.data.dining.filter(d => d.status === 'done');

  let gridContent;
  if (active.length === 0 && !f.showDone) {
    gridContent = emptyState('Dining', 'Your wishlist is empty. Add a restaurant to get started.');
  } else {
    gridContent = `<div class="card-grid">${active.map(diningCardHTML).join('')}</div>`;
    if (f.showDone && done.length > 0) {
      gridContent += `<div class="section-divider" style="margin-top:20px;">Visited <span class="group-count">${done.length}</span></div><div class="card-grid">${done.map(diningCardHTML).join('')}</div>`;
    }
  }

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
    <div class="filter-bar">
      <span class="filter-spacer"></span>
      <label class="toggle-label">
        <input type="checkbox" id="showDiningDoneToggle"${f.showDone?' checked':''}>
        <span class="toggle-track"></span>
        Show visited
      </label>
    </div>
    ${gridContent}`;

  document.getElementById('addDiningBtn').addEventListener('click', () => openDiningModal());
  document.getElementById('showDiningDoneToggle').addEventListener('change', e => { state.filters.dining.showDone = e.target.checked; renderModule(); });
  main.addEventListener('click', e => {
    const check = e.target.closest('[data-check-dining]');
    if (check) { toggleDining(check.dataset.checkDining); return; }
    const edit = e.target.closest('[data-edit-dining]');
    if (edit) { openDiningModal(state.data.dining.find(d => d.id === edit.dataset.editDining)); return; }
    const del = e.target.closest('[data-delete-dining]');
    if (del) { state.data.dining = state.data.dining.filter(d => d.id !== del.dataset.deleteDining); saveData(); renderModule(); }
  });
}

function toggleDining(id) {
  const place = state.data.dining.find(d => d.id === id);
  if (!place) return;
  place.status = place.status === 'done' ? 'todo' : 'done';
  saveData(); renderModule();
}

function diningCardHTML(d) {
  const isDone = d.status === 'done';
  return `<div class="card${isDone ? ' card-done' : ''}">
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <div class="card-check${isDone ? ' checked' : ''}" data-check-dining="${d.id}" role="checkbox" aria-checked="${isDone}" style="margin-top:2px;">
        <svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/></svg>
      </div>
      <div style="flex:1;min-width:0;">
        <div class="card-title${isDone ? ' done-title' : ''}">${esc(d.name)}</div>
        ${d.location ? `<div class="card-subtitle">${esc(d.location)}</div>` : ''}
        ${d.cuisine ? `<div class="card-meta" style="margin-top:6px;"><span class="badge badge-horizon">${esc(d.cuisine)}</span></div>` : ''}
        ${d.notes ? `<div class="card-notes">${esc(d.notes)}</div>` : ''}
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
    if (!f.showDone && u.status === 'done') return false;
    return true;
  });

  const sorted = sortItems(items, f.sortBy, f.sortDir);
  const groups = groupItems(sorted, f.groupBy);
  const hasGroups = f.groupBy && groups.some(g => g.label);

  let upgradeListContent;
  if (items.length === 0) {
    upgradeListContent = emptyState('Upgrades', 'Nothing aspirational yet. Add an upgrade to get started.');
  } else if (hasGroups) {
    upgradeListContent = groups.map(g =>
      `<div class="section-divider">${esc(g.label)} <span class="group-count">${g.items.length}</span></div>${g.items.map(upgradeItemHTML).join('')}`
    ).join('');
  } else {
    upgradeListContent = sorted.map(upgradeItemHTML).join('');
  }

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
      <select class="filter-select" id="filterUpgradeSortBy">
        <option value="">Sort: Default</option>
        <option value="item"${f.sortBy==='item'?' selected':''}>Name</option>
        <option value="costEstimate"${f.sortBy==='costEstimate'?' selected':''}>Cost</option>
        <option value="status"${f.sortBy==='status'?' selected':''}>Status</option>
      </select>
      ${f.sortBy ? `<button class="sort-dir-btn" id="sortDirBtnU" title="Reverse sort order">${f.sortDir === 'asc' ? '↑' : '↓'}</button>` : ''}
      <select class="filter-select" id="filterUpgradeGroupBy">
        <option value="">Group: None</option>
        <option value="status"${f.groupBy==='status'?' selected':''}>by Status</option>
        <option value="subcategory"${f.groupBy==='subcategory'?' selected':''}>by Category</option>
      </select>
      <span class="filter-spacer"></span>
      <label class="toggle-label">
        <input type="checkbox" id="showUpgradeDoneToggle"${f.showDone?' checked':''}>
        <span class="toggle-track"></span>
        Show completed
      </label>
    </div>
    <div class="upgrade-list">${upgradeListContent}</div>`;

  document.getElementById('addUpgradeBtn').addEventListener('click', () => openUpgradeModal());
  document.getElementById('filterUpgradeStatus').addEventListener('change', e => { state.filters.upgrades.status = e.target.value; renderModule(); });
  document.getElementById('filterUpgradeSubcat').addEventListener('change', e => { state.filters.upgrades.subcategory = e.target.value; renderModule(); });
  document.getElementById('filterUpgradeSortBy').addEventListener('change', e => { state.filters.upgrades.sortBy = e.target.value; renderModule(); });
  const sortDirBtnU = document.getElementById('sortDirBtnU');
  if (sortDirBtnU) sortDirBtnU.addEventListener('click', () => { state.filters.upgrades.sortDir = state.filters.upgrades.sortDir === 'asc' ? 'desc' : 'asc'; renderModule(); });
  document.getElementById('filterUpgradeGroupBy').addEventListener('change', e => { state.filters.upgrades.groupBy = e.target.value; renderModule(); });
  document.getElementById('showUpgradeDoneToggle').addEventListener('change', e => { state.filters.upgrades.showDone = e.target.checked; renderModule(); });
  main.querySelectorAll('[data-edit-upgrade]').forEach(btn => {
    btn.addEventListener('click', () => openUpgradeModal(state.data.upgrades.find(u => u.id === btn.dataset.editUpgrade)));
  });
  main.querySelectorAll('[data-delete-upgrade]').forEach(btn => {
    btn.addEventListener('click', () => { state.data.upgrades = state.data.upgrades.filter(u => u.id !== btn.dataset.deleteUpgrade); saveData(); renderModule(); });
  });
}

function upgradeItemHTML(u) {
  return `<div class="upgrade-item${u.status === 'done' ? ' upgrade-done' : ''}">
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
  const items = state.data.reading.filter(r => !f.genre || r.genre === f.genre);
  const active = items.filter(r => r.status !== 'done');
  const done   = items.filter(r => r.status === 'done');

  let gridContent;
  if (active.length === 0 && !f.showDone) {
    gridContent = emptyState('Reading', 'Nothing on the list. Add a book to get started.');
  } else {
    gridContent = `<div class="card-grid">${active.map(readingCardHTML).join('')}</div>`;
    if (f.showDone && done.length > 0) {
      gridContent += `<div class="section-divider" style="margin-top:20px;">Completed <span class="group-count">${done.length}</span></div><div class="card-grid">${done.map(readingCardHTML).join('')}</div>`;
    }
  }

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
      <select class="filter-select" id="filterReadingGenre">
        <option value="">All</option>
        <option value="fiction"${f.genre==='fiction'?' selected':''}>Fiction</option>
        <option value="nonfiction"${f.genre==='nonfiction'?' selected':''}>Nonfiction</option>
      </select>
      <span class="filter-spacer"></span>
      <label class="toggle-label">
        <input type="checkbox" id="showReadingDoneToggle"${f.showDone?' checked':''}>
        <span class="toggle-track"></span>
        Show completed
      </label>
    </div>
    ${gridContent}`;

  document.getElementById('addReadingBtn').addEventListener('click', () => openReadingModal());
  document.getElementById('filterReadingGenre').addEventListener('change', e => { state.filters.reading.genre = e.target.value; renderModule(); });
  document.getElementById('showReadingDoneToggle').addEventListener('change', e => { state.filters.reading.showDone = e.target.checked; renderModule(); });
  main.addEventListener('click', e => {
    const check = e.target.closest('[data-check-reading]');
    if (check) { toggleReading(check.dataset.checkReading); return; }
    const edit = e.target.closest('[data-edit-reading]');
    if (edit) { openReadingModal(state.data.reading.find(r => r.id === edit.dataset.editReading)); return; }
    const del = e.target.closest('[data-delete-reading]');
    if (del) { state.data.reading = state.data.reading.filter(r => r.id !== del.dataset.deleteReading); saveData(); renderModule(); }
  });
}

function readingCardHTML(r) {
  const isDone = r.status === 'done';
  return `<div class="card${isDone ? ' card-done' : ''}">
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <div class="card-check${isDone ? ' checked' : ''}" data-check-reading="${r.id}" role="checkbox" aria-checked="${isDone}" style="margin-top:2px;">
        <svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/></svg>
      </div>
      <div style="flex:1;min-width:0;">
        <div class="card-title${isDone ? ' done-title' : ''}">${esc(r.title)}</div>
        ${r.author ? `<div class="card-subtitle">${esc(r.author)}</div>` : ''}
        ${r.genre ? `<div class="card-meta" style="margin-top:6px;"><span class="badge badge-genre-${r.genre}">${GENRE_LABELS[r.genre]}</span></div>` : ''}
        ${r.notes ? `<div class="card-notes">${esc(r.notes)}</div>` : ''}
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
  </div>`;
}

function openReadingModal(item) {
  showModal({
    title: item ? 'Edit Book' : 'Add Book',
    item,
    fields: [
      { name: 'title',  label: 'Title',  required: true },
      { name: 'author', label: 'Author', placeholder: 'Author name' },
      { name: 'genre',  label: 'Genre',  type: 'radio', default: '',
        options: Object.entries(GENRE_LABELS).map(([v,l]) => ({value:v,label:l})) },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Lists, recommendations, notes…' }
    ],
    onSubmit: values => {
      if (item) { Object.assign(item, values); }
      else { state.data.reading.unshift({ id: uid(), createdAt: new Date().toISOString(), status: 'todo', ...values }); }
      saveData(); renderModule();
    }
  });
}

function toggleReading(id) {
  const book = state.data.reading.find(r => r.id === id);
  if (!book) return;
  book.status = book.status === 'done' ? 'todo' : 'done';
  saveData(); renderModule();
}

// ── MEDIA ──────────────────────────────────────────────────────────────────────

function renderMedia(main) {
  const f = state.filters.media;
  const items = state.data.media.filter(m => !f.type || m.type === f.type);
  const active = items.filter(m => m.status !== 'done');
  const done   = items.filter(m => m.status === 'done');

  let gridContent;
  if (active.length === 0 && !f.showDone) {
    gridContent = emptyState('Media', 'Nothing queued up. Add something to watch or listen to.');
  } else {
    gridContent = `<div class="card-grid">${active.map(mediaCardHTML).join('')}</div>`;
    if (f.showDone && done.length > 0) {
      gridContent += `<div class="section-divider" style="margin-top:20px;">Completed <span class="group-count">${done.length}</span></div><div class="card-grid">${done.map(mediaCardHTML).join('')}</div>`;
    }
  }

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
      <span class="filter-spacer"></span>
      <label class="toggle-label">
        <input type="checkbox" id="showMediaDoneToggle"${f.showDone?' checked':''}>
        <span class="toggle-track"></span>
        Show completed
      </label>
    </div>
    ${gridContent}`;

  document.getElementById('addMediaBtn').addEventListener('click', () => openMediaModal());
  document.getElementById('filterMediaType').addEventListener('change', e => { state.filters.media.type = e.target.value; renderModule(); });
  document.getElementById('showMediaDoneToggle').addEventListener('change', e => { state.filters.media.showDone = e.target.checked; renderModule(); });
  main.addEventListener('click', e => {
    const check = e.target.closest('[data-check-media]');
    if (check) { toggleMedia(check.dataset.checkMedia); return; }
    const edit = e.target.closest('[data-edit-media]');
    if (edit) { openMediaModal(state.data.media.find(m => m.id === edit.dataset.editMedia)); return; }
    const del = e.target.closest('[data-delete-media]');
    if (del) { state.data.media = state.data.media.filter(m => m.id !== del.dataset.deleteMedia); saveData(); renderModule(); }
  });
}

function toggleMedia(id) {
  const item = state.data.media.find(m => m.id === id);
  if (!item) return;
  item.status = item.status === 'done' ? 'todo' : 'done';
  saveData(); renderModule();
}

function mediaCardHTML(m) {
  const isDone = m.status === 'done';
  return `<div class="card${isDone ? ' card-done' : ''}">
    <div style="display:flex;align-items:flex-start;gap:10px;">
      <div class="card-check${isDone ? ' checked' : ''}" data-check-media="${m.id}" role="checkbox" aria-checked="${isDone}" style="margin-top:2px;">
        <svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/></svg>
      </div>
      <div style="flex:1;min-width:0;">
        <div class="card-title${isDone ? ' done-title' : ''}">${esc(m.title)}</div>
        ${m.type ? `<div class="card-meta" style="margin-top:6px;"><span class="badge badge-type-${m.type}">${MEDIA_TYPE_LABELS[m.type]??m.type}</span></div>` : ''}
        ${m.notes ? `<div class="card-notes">${esc(m.notes)}</div>` : ''}
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
  </div>`;
}

function openMediaModal(item) {
  showModal({
    title: item ? 'Edit Title' : 'Add Title',
    item,
    fields: [
      { name: 'title', label: 'Title', required: true },
      { name: 'type',  label: 'Type',  type: 'radio', default: '',
        options: Object.entries(MEDIA_TYPE_LABELS).map(([v,l]) => ({value:v,label:l})) },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Notes, who recommended it…' }
    ],
    onSubmit: values => {
      if (item) { Object.assign(item, values); }
      else { state.data.media.unshift({ id: uid(), createdAt: new Date().toISOString(), status: 'todo', ...values }); }
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
