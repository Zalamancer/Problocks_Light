import { api } from '../api.js';
import { renderLeaderboardChart, renderMasteryChart } from './charts.js';

let currentClassId = null;

async function init() {
  try {
    await api('GET', '/api/teacher/classes');
  } catch {
    window.location.href = '/login.html';
    return;
  }
  loadClasses();
  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('POST', '/api/auth/logout');
    window.location.href = '/login.html';
  });

  document.getElementById('create-class-btn').addEventListener('click', showCreateClassModal);
  document.getElementById('back-btn').addEventListener('click', () => {
    document.getElementById('class-detail').style.display = 'none';
    document.getElementById('classes-section').style.display = 'block';
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      document.getElementById(`${tab.dataset.tab}-tab`).style.display = 'block';
    });
  });
}

async function loadClasses() {
  const data = await api('GET', '/api/teacher/classes');
  const list = document.getElementById('classes-list');
  list.innerHTML = '';
  for (const cls of data.classes) {
    const card = document.createElement('div');
    card.className = 'class-card';
    card.innerHTML = `<strong>${cls.name}</strong> — ${cls.student_count} students — Code: ${cls.join_code}`;
    card.addEventListener('click', () => openClass(cls));
    list.appendChild(card);
  }
  if (data.classes.length === 0) {
    list.innerHTML = '<p style="color:#666">No classes yet. Click "+ Create Class" to get started.</p>';
  }
}

async function openClass(cls) {
  currentClassId = cls.id;
  document.getElementById('classes-section').style.display = 'none';
  document.getElementById('class-detail').style.display = 'block';
  document.getElementById('class-name').textContent = cls.name;
  document.getElementById('class-code').textContent = cls.join_code;

  await loadRoster();
}

async function loadRoster() {
  const data = await api('GET', `/api/teacher/class/${currentClassId}/roster`);
  const tbody = document.querySelector('#roster-table tbody');
  tbody.innerHTML = '';

  for (const s of data.students) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.display_name}</td>
      <td>${s.level}</td>
      <td>${s.xp}</td>
      <td>${s.coins}</td>
      <td>${s.questions_answered}</td>
      <td>${s.accuracy_pct || 0}%</td>
      <td><button class="reset-pin-btn" data-id="${s.id}">Reset PIN</button></td>
    `;
    tbody.appendChild(tr);
  }

  if (data.students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:#666">No students yet. Share the join code!</td></tr>';
  }

  tbody.querySelectorAll('.reset-pin-btn').forEach(btn => {
    btn.addEventListener('click', () => showResetPinModal(btn.dataset.id));
  });

  document.getElementById('export-btn').onclick = () => {
    window.open(`/api/teacher/class/${currentClassId}/export`);
  };

  // Load charts
  const leaderboard = await api('GET', `/api/leaderboard/${currentClassId}`);
  renderLeaderboardChart(leaderboard.leaderboard);

  try {
    const analytics = await api('GET', `/api/teacher/class/${currentClassId}/analytics`);
    renderMasteryChart(analytics.subtopicStats);
  } catch { /* no data yet */ }
}

function showCreateClassModal() {
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = 'Create Class';
  document.getElementById('modal-body').innerHTML = `
    <input type="text" id="new-class-name" placeholder="Class Name (e.g. Math 6A)">
    <input type="number" id="new-grade-level" placeholder="Grade Level" min="1" max="12" value="6">
    <button class="primary" id="modal-submit">Create</button>
    <button class="secondary" id="modal-cancel">Cancel</button>
  `;
  modal.style.display = 'flex';

  document.getElementById('modal-cancel').onclick = () => modal.style.display = 'none';
  document.getElementById('modal-submit').onclick = async () => {
    const name = document.getElementById('new-class-name').value;
    const gradeLevel = document.getElementById('new-grade-level').value;
    if (!name) return;
    await api('POST', '/api/teacher/class', { name, subject: 'Math', gradeLevel: Number(gradeLevel) });
    modal.style.display = 'none';
    loadClasses();
  };
}

function showResetPinModal(studentId) {
  const modal = document.getElementById('modal');
  document.getElementById('modal-title').textContent = 'Reset Student PIN';
  document.getElementById('modal-body').innerHTML = `
    <input type="password" id="new-pin" placeholder="New 4-digit PIN" maxlength="4" pattern="[0-9]{4}">
    <button class="primary" id="modal-submit">Reset</button>
    <button class="secondary" id="modal-cancel">Cancel</button>
  `;
  modal.style.display = 'flex';

  document.getElementById('modal-cancel').onclick = () => modal.style.display = 'none';
  document.getElementById('modal-submit').onclick = async () => {
    const newPin = document.getElementById('new-pin').value;
    if (!newPin || newPin.length !== 4) return;
    await api('POST', `/api/teacher/student/${studentId}/reset-pin`, { newPin });
    modal.style.display = 'none';
  };
}

init();
