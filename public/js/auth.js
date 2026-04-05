import { api } from './api.js';

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.form').forEach(f => f.style.display = 'none');
    if (tab.dataset.tab === 'student') {
      document.getElementById('student-join-form').style.display = 'block';
    } else {
      document.getElementById('teacher-form').style.display = 'block';
    }
  });
});

document.getElementById('show-login')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('student-join-form').style.display = 'none';
  document.getElementById('student-login-form').style.display = 'block';
});
document.getElementById('show-join')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('student-login-form').style.display = 'none';
  document.getElementById('student-join-form').style.display = 'block';
});

const errorEl = document.getElementById('error');

document.getElementById('student-join-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const form = new FormData(e.target);
  try {
    await api('POST', '/api/auth/student/join', {
      joinCode: form.get('joinCode'),
      username: form.get('username'),
      displayName: form.get('displayName'),
      pin: form.get('pin'),
    });
    window.location.href = '/';
  } catch (err) { errorEl.textContent = err.message; }
});

document.getElementById('student-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const form = new FormData(e.target);
  try {
    await api('POST', '/api/auth/student/login', {
      username: form.get('username'),
      pin: form.get('pin'),
      schoolId: Number(form.get('schoolId')),
    });
    window.location.href = '/';
  } catch (err) { errorEl.textContent = err.message; }
});

document.getElementById('teacher-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  const form = new FormData(e.target);
  try {
    await api('POST', '/api/auth/teacher/login', {
      email: form.get('email'),
      password: form.get('password'),
    });
    window.location.href = '/teacher.html';
  } catch (err) { errorEl.textContent = err.message; }
});
