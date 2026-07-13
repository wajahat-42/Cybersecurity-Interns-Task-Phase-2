// SecureNotes — Frontend Logic
// Key security practices in this file:
// 1. JWT stored in memory (not localStorage) — safe from XSS storage attacks
// 2. CSRF token fetched before every state-changing request
// 3. All API calls use proper Authorization header

let jwtToken = null;  // In-memory only — not localStorage or sessionStorage

const api = async (method, path, body = null, includeCsrf = false) => {
  const headers = { 'Content-Type': 'application/json' };
  if (jwtToken) headers['Authorization'] = `Bearer ${jwtToken}`;

  // CSRF token required for POST/DELETE requests
  if (includeCsrf) {
    const tokenRes = await fetch('/api/notes/csrf-token', { headers });
    const { csrfToken } = await tokenRes.json();
    headers['X-CSRF-Token'] = csrfToken;
    document.getElementById('csrf-display').textContent = csrfToken;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

function showMsg(elId, text, isErr = false) {
  const el = document.getElementById(elId);
  el.className = `msg ${isErr ? 'err' : 'ok'}`;
  el.textContent = text;
}

async function register() {
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const data = await api('POST', '/api/auth/register', { username, email, password });
  if (data.token) {
    showMsg('reg-msg', 'Registered! API Key: ' + data.apiKey);
    jwtToken = data.token;
    showApp();
  } else {
    showMsg('reg-msg', JSON.stringify(data), true);
  }
}

async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const data = await api('POST', '/api/auth/login', { email, password });
  if (data.token) {
    jwtToken = data.token;
    showApp();
  } else {
    showMsg('login-msg', data.error || 'Login failed', true);
  }
}

function logout() {
  jwtToken = null;
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('app-section').style.display = 'none';
  document.getElementById('status-badge').textContent = 'Not logged in';
}

function showApp() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('app-section').style.display = 'block';
  document.getElementById('token-display').textContent = jwtToken;
  document.getElementById('status-badge').textContent = 'Logged in';
  loadNotes();
}

async function loadNotes() {
  const notes = await api('GET', '/api/notes');
  renderNotes(notes, 'notes-list');
}

function renderNotes(notes, containerId) {
  const el = document.getElementById(containerId);
  if (!Array.isArray(notes) || notes.length === 0) {
    el.innerHTML = '<p style="color:#718096;font-size:0.85rem;">No notes found.</p>';
    return;
  }
  el.innerHTML = notes.map(n => `
    <div class="note-item">
      <div>
        <h3>${escHtml(n.title)}</h3>
        <p>${escHtml(n.content || '')}</p>
        <p style="font-size:0.72rem;color:#4a5568;margin-top:0.3rem;">${new Date(n.created_at).toLocaleString()}</p>
      </div>
      <button class="danger" onclick="deleteNote(${n.id})">Delete</button>
    </div>
  `).join('');
}

async function createNote() {
  const title = document.getElementById('note-title').value;
  const content = document.getElementById('note-content').value;
  if (!title) return showMsg('create-msg', 'Title required', true);
  // includeCsrf=true — fetches CSRF token first, then sends POST with X-CSRF-Token header
  const data = await api('POST', '/api/notes', { title, content }, true);
  if (data.id) {
    showMsg('create-msg', 'Note created!');
    document.getElementById('note-title').value = '';
    document.getElementById('note-content').value = '';
    loadNotes();
  } else {
    showMsg('create-msg', data.error || JSON.stringify(data), true);
  }
}

async function deleteNote(id) {
  const data = await api('DELETE', `/api/notes/${id}`, null, true);
  if (data.message) loadNotes();
}

async function searchNotes() {
  const q = document.getElementById('search-q').value;
  const notes = await api('GET', `/api/notes/search?q=${encodeURIComponent(q)}`);
  renderNotes(Array.isArray(notes) ? notes : [], 'search-results');
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
