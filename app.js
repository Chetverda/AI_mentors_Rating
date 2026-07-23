const LEVEL_CLASS = {
  'Онбординг': 'level-onboard',
  'Первый уровень': 'level-1',
  'Второй уровень': 'level-2',
  'Третий уровень': 'level-3',
  'Четвертый уровень — PRO': 'level-pro'
};

const LEVEL_ORDER = ['Онбординг', 'Первый уровень', 'Второй уровень', 'Третий уровень', 'Четвертый уровень — PRO'];

let DATA = null;
let globalTooltip = null;
const state = {
  quarter: 'q2',
  sortKey: 'total',
  sortDir: -1,
  search: '',
  levelFilter: '',
  activeOnly: false
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getMentors() {
  return DATA[state.quarter] || DATA.q2;
}

function renderProgress() {
  const s = DATA.stats;
  const eventsPct = Math.min(100, Math.round(s.totalEvents / s.targetEvents * 100));
  const mentorsPct = Math.min(100, Math.round(s.engagedMentors / s.targetMentors * 100));
  document.getElementById('progressSection').innerHTML = `
    <div class="progress-card">
      <h3>Мероприятия за год</h3>
      <div class="progress-numbers">
        <span class="progress-current">${s.totalEvents}</span>
        <span class="progress-separator">/</span>
        <span class="progress-target">${s.targetEvents}</span>
      </div>
      <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${eventsPct}%"></div></div>
      <p class="progress-label">Сессии + мастер-классы + инициативы · ${eventsPct}% от цели</p>
    </div>
    <div class="progress-card">
      <h3>Вовлечённые менторы</h3>
      <div class="progress-numbers">
        <span class="progress-current">${s.engagedMentors}</span>
        <span class="progress-separator">/</span>
        <span class="progress-target">${s.targetMentors}</span>
      </div>
      <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${mentorsPct}%"></div></div>
      <p class="progress-label">Приняли участие хотя бы в одной активности · ${mentorsPct}% от цели</p>
    </div>
  `;
}

function getBonusRewards(levelName) {
  const level = DATA.bonusProgram.find(b => b.name === levelName);
  if (!level) return '';
  return level.rewards.split('\n').filter(Boolean).map(r =>
    `<li>${escapeHtml(r.replace(/^\d+\.\s*/, ''))}</li>`
  ).join('');
}

function filterAndSort(mentors) {
  let list = [...mentors];
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(m => m.name.toLowerCase().includes(q));
  }
  if (state.levelFilter) {
    list = list.filter(m => m.level === state.levelFilter);
  }
  if (state.activeOnly) {
    list = list.filter(m => m.total > 0);
  }
  const key = state.sortKey;
  const dir = state.sortDir;
  list.sort((a, b) => {
    if (key === 'level') {
      const va = LEVEL_ORDER.indexOf(a.level);
      const vb = LEVEL_ORDER.indexOf(b.level);
      return dir * (va - vb) || a.name.localeCompare(b.name, 'ru');
    }
    if (key === 'name') {
      return dir * a.name.localeCompare(b.name, 'ru');
    }
    if (key === 'rank') {
      return 0;
    }
    return dir * (a[key] - b[key]) || a.name.localeCompare(b.name, 'ru');
  });
  return list;
}

function renderTable() {
  const mentors = filterAndSort(getMentors());
  const tbody = document.getElementById('ratingBody');
  if (!mentors.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><h3>Никого не найдено</h3><p>Попробуйте изменить фильтры</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = mentors.map((m, i) => {
    const cls = LEVEL_CLASS[m.level] || 'level-onboard';
    const shortLevel = m.level === 'Четвертый уровень — PRO' ? 'PRO' : m.level;
    return `<tr class="${m.total === 0 ? 'inactive' : ''}">
      <td class="num">${i + 1}</td>
      <td class="name">${escapeHtml(m.name)}</td>
      <td class="metric ${m.sessions ? '' : 'zero'}">${m.sessions || '-'}</td>
      <td class="metric ${m.masterclasses ? '' : 'zero'}">${m.masterclasses || '-'}</td>
      <td class="metric ${m.initiatives ? '' : 'zero'}">${m.initiatives || '-'}</td>
      <td class="metric">${m.total || '-'}</td>
      <td class="level-cell">
        <span class="level-badge ${cls}" data-level="${escapeHtml(m.level)}">
          ${escapeHtml(shortLevel)}
        </span>
      </td>
    </tr>`;
  }).join('');
}

function ensureTooltip() {
  if (!globalTooltip) {
    globalTooltip = document.createElement('div');
    globalTooltip.className = 'tooltip';
    globalTooltip.id = 'levelTooltip';
    document.body.appendChild(globalTooltip);
  }
  return globalTooltip;
}

function positionTooltip(tip, anchor) {
  tip.classList.add('visible');
  tip.style.visibility = 'hidden';
  tip.style.left = '0';
  tip.style.top = '0';

  const tipRect = tip.getBoundingClientRect();
  const rect = anchor.getBoundingClientRect();
  const gap = 10;
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = rect.top - tipRect.height - gap;
  if (top < pad) top = rect.bottom + gap;
  if (top + tipRect.height > vh - pad) {
    top = rect.top - tipRect.height - gap;
  }
  top = Math.max(pad, Math.min(top, vh - tipRect.height - pad));

  let left = rect.left + rect.width / 2 - tipRect.width / 2;
  left = Math.max(pad, Math.min(left, vw - tipRect.width - pad));

  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
  tip.style.visibility = '';
}

function hideTooltip() {
  if (!globalTooltip) return;
  globalTooltip.classList.remove('visible');
  globalTooltip.style.top = '';
  globalTooltip.style.left = '';
  globalTooltip.style.visibility = '';
}

function bindTooltips() {
  const tbody = document.getElementById('ratingBody');
  if (tbody.dataset.tooltipsBound) return;
  tbody.dataset.tooltipsBound = '1';

  tbody.addEventListener('mouseover', (e) => {
    const badge = e.target.closest('.level-badge');
    if (!badge || !tbody.contains(badge)) return;
    const level = badge.dataset.level;
    if (!level) return;

    const tip = ensureTooltip();
    tip.innerHTML = `<h4>${escapeHtml(level)}</h4><ul>${getBonusRewards(level)}</ul>`;
    positionTooltip(tip, badge);
  });

  tbody.addEventListener('mouseout', (e) => {
    const badge = e.target.closest('.level-badge');
    if (!badge || badge.contains(e.relatedTarget)) return;
    hideTooltip();
  });
}

function renderBonus() {
  document.getElementById('bonusGrid').innerHTML = DATA.bonusProgram.map(b => `
    <div class="bonus-card">
      <div class="bonus-card-header">
        <div class="bonus-card-num">${b.num}</div>
        <div class="bonus-card-title">${escapeHtml(b.name)}</div>
      </div>
      <div class="bonus-card-body">
        <div class="bonus-section">
          <h4>Что надо сделать</h4>
          <p>${escapeHtml(b.requirements)}</p>
        </div>
        <div class="bonus-section">
          <h4>Сроки</h4>
          <p>${escapeHtml(b.deadline)}</p>
        </div>
        <div class="bonus-section">
          <h4>Вознаграждение</h4>
          <p>${escapeHtml(b.rewards)}</p>
        </div>
      </div>
    </div>
  `).join('');
}

function updateSortHeaders() {
  document.querySelectorAll('thead th').forEach(th => {
    th.classList.toggle('sorted', th.dataset.sort === state.sortKey);
    const icon = th.querySelector('.sort-icon');
    if (!icon) return;
    if (th.dataset.sort === state.sortKey) {
      icon.textContent = state.sortDir === -1 ? '↓' : '↑';
    } else {
      icon.textContent = '↕';
    }
  });
}

function render() {
  renderProgress();
  renderTable();
  updateSortHeaders();
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });

  document.querySelectorAll('.q-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.quarter = btn.dataset.quarter;
      render();
    });
  });

  document.getElementById('searchInput').addEventListener('input', e => {
    state.search = e.target.value;
    renderTable();
  });

  document.getElementById('levelFilter').addEventListener('change', e => {
    state.levelFilter = e.target.value;
    renderTable();
  });

  document.getElementById('activeOnly').addEventListener('change', e => {
    state.activeOnly = e.target.checked;
    renderTable();
  });

  document.querySelectorAll('thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (key === 'rank') return;
      if (state.sortKey === key) {
        state.sortDir *= -1;
      } else {
        state.sortKey = key;
        state.sortDir = -1;
      }
      renderTable();
      updateSortHeaders();
    });
  });

  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage.getItem('ai-mentor-theme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️';
  }
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
    themeToggle.textContent = isDark ? '🌙' : '☀️';
    localStorage.setItem('ai-mentor-theme', isDark ? 'light' : 'dark');
  });
}

function showError(message) {
  document.getElementById('progressSection').innerHTML = '';
  document.getElementById('ratingBody').innerHTML =
    `<tr><td colspan="7"><div class="empty-state"><h3>Не удалось загрузить данные</h3><p>${escapeHtml(message)}</p></div></td></tr>`;
}

async function loadData() {
  const embedded = document.getElementById('mentors-data');
  if (embedded && embedded.textContent.trim()) {
    return JSON.parse(embedded.textContent);
  }
  const response = await fetch('mentors-data.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function init() {
  bindEvents();
  bindTooltips();
  try {
    DATA = await loadData();
    renderBonus();
    render();
  } catch (err) {
    showError('Не удалось загрузить данные. Запустите build.py после обновления Excel или откройте index.html из папки проекта.');
    console.error(err);
  }
}

window.startApp = init;
