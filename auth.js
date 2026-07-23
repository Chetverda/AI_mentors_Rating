const AUTH_KEY = 'ai-mentor-auth';
const PASSWORD = '2688';

function isAuthed() {
  return sessionStorage.getItem(AUTH_KEY) === '1';
}

function unlockApp() {
  sessionStorage.setItem(AUTH_KEY, '1');
  document.getElementById('authGate').hidden = true;
  document.getElementById('appRoot').removeAttribute('hidden');
  document.body.classList.remove('locked');
  if (typeof window.startApp === 'function') window.startApp();
}

function setupAuth() {
  const form = document.getElementById('authForm');
  const error = document.getElementById('authError');
  const input = document.getElementById('authPassword');

  if (isAuthed()) {
    unlockApp();
    return;
  }

  document.body.classList.add('locked');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value.trim() === PASSWORD) {
      error.hidden = true;
      unlockApp();
    } else {
      error.hidden = false;
      input.focus();
      input.select();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupAuth);
} else {
  setupAuth();
}
