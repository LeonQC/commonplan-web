import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL || API_BASE_URL;
let accessToken = null;
let refreshPromise = null;

async function authRequest(path, options = {}) {
  const response = await fetch(`${AUTH_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Authentication failed' }));
    throw new Error(error.detail || 'Authentication failed');
  }
  if (response.status === 204) return null;
  return response.json();
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = authRequest('/auth/refresh', { method: 'POST' })
      .then((auth) => {
        accessToken = auth.access_token;
        return auth;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function App() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '' });
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });

  async function request(path, options = {}, allowRefresh = true) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

    if (response.status === 401 && allowRefresh) {
      try {
        await refreshAccessToken();
        return request(path, options, false);
      } catch {
        accessToken = null;
        setCurrentUser(null);
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      if (response.status === 401) {
        accessToken = null;
        setCurrentUser(null);
      }
      throw new Error(error.detail || 'Request failed');
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await request(`/users?include_deleted=${includeDeleted}`);
      setUsers(data);
      setStatus(`Loaded ${data.length} user${data.length === 1 ? '' : 's'}`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentUser) loadUsers();
  }, [includeDeleted, currentUser]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const authError = url.searchParams.get('auth_error');
    if (authError) {
      setStatus(
        authError === 'access_denied'
          ? 'Google sign-in was canceled.'
          : 'Google sign-in failed. Please try again.',
      );
      url.searchParams.delete('auth_error');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }

    Promise.all([
      refreshAccessToken()
        .then(() => request('/users/me', {}, false))
        .catch(() => null),
      authRequest('/auth/google/status').catch(() => ({ configured: false })),
    ])
      .then(([profile, google]) => {
        setCurrentUser(profile);
        setGoogleConfigured(google.configured);
      })
      .catch((error) => setStatus(error.message))
      .finally(() => setSessionLoading(false));
  }, []);

  async function handleLogout() {
    setLoading(true);
    try {
      await authRequest('/auth/logout', { method: 'POST' });
      accessToken = null;
      setCurrentUser(null);
      setUsers([]);
      resetForm();
      setStatus('Signed out');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus('Ready');
    try {
      const path = authMode === 'register' ? '/auth/register' : '/auth/login';
      const payload = {
        email: authForm.email,
        password: authForm.password,
        ...(authMode === 'register' ? { name: authForm.name } : {}),
      };
      const auth = await authRequest(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      accessToken = auth.access_token;
      setCurrentUser(await request('/users/me', {}, false));
      setAuthForm({ name: '', email: '', password: '' });
      setStatus(authMode === 'register' ? 'Account created' : 'Signed in');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  function switchAuthMode() {
    setAuthMode((mode) => (mode === 'login' ? 'register' : 'login'));
    setAuthForm({ name: '', email: '', password: '' });
    setStatus('Ready');
  }

  function resetForm() {
    setSelectedUser(null);
    setForm({ name: '', email: '' });
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    try {
      await request(`/users/${selectedUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setStatus(`Updated ${form.name}`);
      resetForm();
      await loadUsers();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(user) {
    setLoading(true);
    try {
      await request(`/users/${user.id}`, { method: 'DELETE' });
      setStatus(`Soft deleted ${user.name}`);
      if (selectedUser?.id === user.id) resetForm();
      await loadUsers();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(user) {
    setSelectedUser(user);
    setForm({ name: user.name, email: user.email });
  }

  if (sessionLoading) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="brand-mark">Z</div>
          <p className="eyebrow">Project Zhitong</p>
          <h1>Restoring your session…</h1>
          <p className="auth-copy">Restoring your secure credentials.</p>
        </section>
      </main>
    );
  }

  if (!currentUser) {
    const isRegistering = authMode === 'register';
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="brand-mark">Z</div>
          <p className="eyebrow">Project Zhitong</p>
          <h1>{isRegistering ? 'Create your account' : 'Welcome back'}</h1>
          <p className="auth-copy">
            {isRegistering
              ? 'Register with your email or continue with Google.'
              : 'Sign in with your email and password or continue with Google.'}
          </p>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {isRegistering && (
              <label>
                Name
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                minLength={isRegistering ? 8 : 1}
                maxLength={128}
                placeholder={isRegistering ? 'At least 8 characters' : 'Your password'}
                required
              />
            </label>
            <button className="primary auth-action" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : isRegistering ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          {googleConfigured ? (
            <a className="oauth-button auth-action" href={`${AUTH_BASE_URL}/auth/google/login`}>
              Continue with Google
            </a>
          ) : (
            <button className="oauth-button auth-action disabled" type="button" disabled>
              Google OAuth not configured
            </button>
          )}

          <p className="auth-switch">
            {isRegistering ? 'Already have an account?' : 'New to Zhitong?'}{' '}
            <button type="button" onClick={switchAuthMode}>
              {isRegistering ? 'Sign in' : 'Create account'}
            </button>
          </p>
          {status !== 'Ready' && <p className="auth-status">{status}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Project Zhitong</p>
          <h1>User Workspace</h1>
        </div>
        <div className="session-user">
          {currentUser.avatar_url ? (
            <img src={currentUser.avatar_url} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className="avatar-fallback">{currentUser.name.slice(0, 1).toUpperCase()}</span>
          )}
          <div>
            <strong>{currentUser.name}</strong>
            <span>{currentUser.email}</span>
          </div>
          <button type="button" className="ghost" onClick={handleLogout} disabled={loading}>
            Sign out
          </button>
        </div>
      </section>

      <section className={`workspace ${selectedUser ? '' : 'single-column'}`}>
        {selectedUser && (
          <form className="panel" onSubmit={handleUpdate}>
            <div className="panel-header">
              <h2>Edit user</h2>
              <button type="button" className="ghost" onClick={resetForm}>
                Cancel
              </button>
            </div>

            <label>
              Name
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Ada Lovelace"
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="ada@example.com"
                required
              />
            </label>

            <button className="primary" disabled={loading}>
              Save changes
            </button>
          </form>
        )}

        <section className="panel users-panel">
          <div className="panel-header">
            <div>
              <h2>Users</h2>
              <p>{status}</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => setIncludeDeleted(event.target.checked)}
              />
              Show deleted
            </label>
          </div>

          <div className="user-list">
            {users.map((user) => (
              <article className={`user-row ${user.is_deleted ? 'deleted' : ''}`} key={user.id}>
                <div>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                  <small>
                    #{user.id} Auth identity linked
                  </small>
                </div>
                <div className="actions">
                  <button type="button" onClick={() => handleEdit(user)} disabled={user.is_deleted}>
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(user)} disabled={user.is_deleted}>
                    Delete
                  </button>
                </div>
              </article>
            ))}

            {!users.length && <p className="empty">No active users.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
