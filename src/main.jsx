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
    headers: { 'Content-Type': 'application/json', ...options.headers },
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
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [section, setSection] = useState('Overview');
  const [workspaceForm, setWorkspaceForm] = useState({ name: '', slug: '', description: '' });
  const [teamForm, setTeamForm] = useState({ name: '', issue_prefix: '', description: '' });
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [overview, setOverview] = useState(null);
  const [workflowStates, setWorkflowStates] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [labels, setLabels] = useState([]);
  const [issues, setIssues] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueForm, setIssueForm] = useState({ title: '', description: '', priority: 0, workflow_state_id: '', cycle_id: '', assignee_user_id: '', label_ids: [] });
  const [cycleForm, setCycleForm] = useState({ name: '', starts_on: '', ends_on: '' });
  const [labelForm, setLabelForm] = useState({ name: '', color: '#6C6FF2' });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

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
      throw new Error(error.detail || 'Request failed');
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function loadWorkspaces(preferredId) {
    const data = await request('/api/v1/workspaces');
    setWorkspaces(data);
    const nextId = preferredId || workspaceId || data[0]?.id || '';
    setWorkspaceId(data.some((item) => item.id === nextId) ? nextId : data[0]?.id || '');
  }

  async function loadTeams(selectedWorkspaceId, preferredId) {
    if (!selectedWorkspaceId) {
      setTeams([]);
      setTeamId('');
      return;
    }
    const data = await request(`/api/v1/workspaces/${selectedWorkspaceId}/teams`);
    setTeams(data);
    const nextId = preferredId || teamId || data[0]?.id || '';
    setTeamId(data.some((item) => item.id === nextId) ? nextId : data[0]?.id || '');
  }

  async function loadPlanning(selectedWorkspaceId, selectedTeamId) {
    if (!selectedWorkspaceId || !selectedTeamId) return;
    const base = `/api/v1/workspaces/${selectedWorkspaceId}/teams/${selectedTeamId}`;
    const [nextOverview, nextStates, nextCycles, nextLabels, nextIssues, nextMembers] = await Promise.all([
      request(`${base}/overview`),
      request(`${base}/workflow-states`),
      request(`${base}/cycles`),
      request(`${base}/labels`),
      request(`${base}/issues`),
      request(`${base}/members`),
    ]);
    setOverview(nextOverview);
    setWorkflowStates(nextStates);
    setCycles(nextCycles);
    setLabels(nextLabels);
    setIssues(nextIssues);
    setMembers(nextMembers);
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const authError = url.searchParams.get('auth_error');
    if (authError) {
      setStatus(authError === 'access_denied' ? 'Google sign-in was canceled.' : 'Google sign-in failed.');
      url.searchParams.delete('auth_error');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    Promise.all([
      refreshAccessToken().then(() => request('/users/me', {}, false)).catch(() => null),
      authRequest('/auth/google/status').catch(() => ({ configured: false })),
    ]).then(async ([profile, google]) => {
      setCurrentUser(profile);
      setGoogleConfigured(google.configured);
      if (profile) await loadWorkspaces();
    }).catch((error) => setStatus(error.message)).finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => {
    if (currentUser && workspaceId) {
      loadTeams(workspaceId).catch((error) => setStatus(error.message));
    }
  }, [workspaceId, currentUser]);

  useEffect(() => {
    setSelectedIssue(null);
    if (currentUser && workspaceId && teamId) {
      loadPlanning(workspaceId, teamId).catch((error) => setStatus(error.message));
    }
  }, [teamId, workspaceId, currentUser]);

  useEffect(() => {
    if (!status) return undefined;
    const timeout = window.setTimeout(() => setStatus(''), 4200);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (!workspaceMenuOpen) return undefined;
    const closeMenu = (event) => {
      if (!event.target.closest('.workspace-switcher')) setWorkspaceMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeMenu);
    return () => document.removeEventListener('pointerdown', closeMenu);
  }, [workspaceMenuOpen]);

  async function submitAuth(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const path = authMode === 'register' ? '/auth/register' : '/auth/login';
      const payload = authMode === 'register' ? authForm : { email: authForm.email, password: authForm.password };
      const auth = await authRequest(path, { method: 'POST', body: JSON.stringify(payload) });
      accessToken = auth.access_token;
      const profile = await request('/users/me', {}, false);
      setCurrentUser(profile);
      await loadWorkspaces();
      setStatus(`Welcome, ${profile.name}`);
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try { await authRequest('/auth/logout', { method: 'POST' }); } catch { /* clear locally */ }
    accessToken = null;
    setCurrentUser(null);
    setWorkspaces([]);
    setTeams([]);
    setBusy(false);
  }

  async function createWorkspace(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await request('/api/v1/workspaces', { method: 'POST', body: JSON.stringify(workspaceForm) });
      await loadWorkspaces(created.id);
      setWorkspaceForm({ name: '', slug: '', description: '' });
      setShowWorkspaceForm(false);
      setStatus(`Created workspace ${created.name}`);
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function createTeam(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await request(`/api/v1/workspaces/${workspaceId}/teams`, {
        method: 'POST', body: JSON.stringify(teamForm),
      });
      await loadTeams(workspaceId, created.id);
      setTeamForm({ name: '', issue_prefix: '', description: '' });
      setShowTeamForm(false);
      setStatus(`Created team ${created.name}`);
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function createIssue(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...issueForm,
        priority: Number(issueForm.priority),
        workflow_state_id: issueForm.workflow_state_id || null,
        cycle_id: issueForm.cycle_id || null,
        assignee_user_id: issueForm.assignee_user_id ? Number(issueForm.assignee_user_id) : null,
      };
      const created = await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/issues`, {
        method: 'POST', body: JSON.stringify(payload),
      });
      setIssueForm({ title: '', description: '', priority: 0, workflow_state_id: '', cycle_id: '', assignee_user_id: '', label_ids: [] });
      setShowIssueForm(false);
      await loadPlanning(workspaceId, teamId);
      setSelectedIssue(created);
      setStatus(`Created ${created.key}`);
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function createCycle(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/cycles`, {
        method: 'POST', body: JSON.stringify(cycleForm),
      });
      setCycleForm({ name: '', starts_on: '', ends_on: '' });
      await loadPlanning(workspaceId, teamId);
      setStatus('Cycle created');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function createLabel(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/labels`, {
        method: 'POST', body: JSON.stringify(labelForm),
      });
      setLabelForm({ name: '', color: '#6C6FF2' });
      await loadPlanning(workspaceId, teamId);
      setStatus('Label created');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function updateIssue(changes) {
    if (!selectedIssue) return;
    setBusy(true);
    try {
      const updated = await request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}`, {
        method: 'PATCH', body: JSON.stringify({ version: selectedIssue.version, ...changes }),
      });
      setSelectedIssue(updated);
      await loadPlanning(workspaceId, teamId);
      setStatus(`Updated ${updated.key}`);
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  if (sessionLoading) return <div className="center-screen"><div className="spinner" />Loading CommonPlan…</div>;
  if (!currentUser) return (
    <main className="auth-shell">
      <section className="auth-brand"><div className="brand-mark">C</div><h1>Plan work.<br />Move together.</h1><p>CommonPlan brings teams, projects, cycles, and issues into one focused workspace.</p></section>
      <section className="auth-card">
        <div className="eyebrow">COMMONPLAN</div><h2>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <form onSubmit={submitAuth}>
          {authMode === 'register' && <label>Name<input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} required /></label>}
          <label>Email<input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required /></label>
          <label>Password<input type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} minLength={authMode === 'register' ? 8 : 1} required /></label>
          <button className="primary" disabled={busy}>{authMode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        {googleConfigured && <button className="google" onClick={() => { window.location.href = `${AUTH_BASE_URL}/auth/google/login`; }}>Continue with Google</button>}
        <button className="text-button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'New to CommonPlan? Create account' : 'Already have an account? Sign in'}</button>
        <p className="status">{status}</p>
      </section>
    </main>
  );

  const selectedWorkspace = workspaces.find((item) => item.id === workspaceId);
  const selectedTeam = teams.find((item) => item.id === teamId);
  const navItems = [
    { name: 'Overview', icon: 'overview' },
    { name: 'Issues', icon: 'issues' },
    { name: 'Cycles', icon: 'cycles' },
    { name: 'Projects', icon: 'projects' },
    { name: 'Views', icon: 'views' },
    { name: 'Settings', icon: 'settings' },
  ];

  function planningContent() {
    if (section === 'Overview') return (
      <section className="overview">
        <div className="hero-card"><div><span className="team-icon large">{selectedTeam.issue_prefix.slice(0, 1)}</span><h2>{selectedTeam.name}</h2><p>{selectedTeam.description || 'A focused space for this team’s projects, cycles, and issues.'}</p></div><span className="prefix-chip">{selectedTeam.issue_prefix}</span></div>
        <div className="metric-grid"><Metric label="Open issues" value={overview?.open_issue_count ?? '—'} /><Metric label="Projects" value={overview?.project_count ?? 0} /><Metric label="Current cycle" value={overview?.current_cycle?.name || '—'} /><Metric label="Members" value={members.length || '—'} /></div>
        <div className="activity-panel"><div className="panel-title"><div><h3>Recent issues</h3><p>The latest work across this team.</p></div><button className="primary" onClick={() => { setSection('Issues'); setShowIssueForm(true); }}>New issue</button></div>{overview?.recent_issues?.length ? <div className="issue-list">{overview.recent_issues.map((issue) => <button key={issue.key} className="issue-row" onClick={() => { setSection('Issues'); setSelectedIssue(issues.find((item) => item.key === issue.key)); }}><span className="issue-key">{issue.key}</span><strong>{issue.title}</strong><StateBadge name={issue.workflow_state} /></button>)}</div> : <div className="inline-empty">No issues yet. Create the first item for this team.</div>}</div>
      </section>
    );

    if (section === 'Issues') return (
      <section className="planning-layout">
        <div className="planning-main">
          <div className="toolbar"><div><strong>{issues.length} issues</strong><span>Plan and track team work</span></div><button className="primary" onClick={() => setShowIssueForm(!showIssueForm)}>+ New issue</button></div>
          {showIssueForm && <form className="editor-card" onSubmit={createIssue}><div className="form-grid"><label className="wide">Title<input autoFocus value={issueForm.title} onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })} required /></label><label className="wide">Description<textarea value={issueForm.description} onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })} /></label><label>Status<select value={issueForm.workflow_state_id} onChange={(e) => setIssueForm({ ...issueForm, workflow_state_id: e.target.value })}><option value="">Default</option>{workflowStates.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select></label><label>Priority<select value={issueForm.priority} onChange={(e) => setIssueForm({ ...issueForm, priority: e.target.value })}>{['No priority', 'Low', 'Medium', 'High', 'Urgent'].map((name, value) => <option key={name} value={value}>{name}</option>)}</select></label><label>Cycle<select value={issueForm.cycle_id} onChange={(e) => setIssueForm({ ...issueForm, cycle_id: e.target.value })}><option value="">No cycle</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></label><label>Assignee<select value={issueForm.assignee_user_id} onChange={(e) => setIssueForm({ ...issueForm, assignee_user_id: e.target.value })}><option value="">Unassigned</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}</select></label><label className="wide">Labels<select multiple value={issueForm.label_ids} onChange={(e) => setIssueForm({ ...issueForm, label_ids: [...e.target.selectedOptions].map((option) => option.value) })}>{labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</select></label></div><div className="form-actions"><button type="button" className="secondary" onClick={() => setShowIssueForm(false)}>Cancel</button><button className="primary" disabled={busy}>Create issue</button></div></form>}
          <div className="issue-board">{workflowStates.map((state) => <div className="state-group" key={state.id}><div className="state-heading"><StateBadge name={state.name} /><span>{issues.filter((issue) => issue.workflow_state_id === state.id).length}</span></div>{issues.filter((issue) => issue.workflow_state_id === state.id).map((issue) => <button key={issue.id} className={`issue-row ${selectedIssue?.id === issue.id ? 'selected' : ''}`} onClick={() => setSelectedIssue(issue)}><span className="priority-dot" data-priority={issue.priority} /><span className="issue-key">{issue.key}</span><strong>{issue.title}</strong><span className="row-meta">{issue.labels.map((label) => label.name).join(', ')}</span></button>)}</div>)}</div>
          <div className="settings-grid"><form className="mini-card" onSubmit={createLabel}><h3>Create label</h3><div className="inline-fields"><input placeholder="Label name" value={labelForm.name} onChange={(e) => setLabelForm({ ...labelForm, name: e.target.value })} required /><input className="color-input" type="color" value={labelForm.color} onChange={(e) => setLabelForm({ ...labelForm, color: e.target.value })} /><button className="secondary">Add</button></div></form><div className="mini-card"><h3>Team labels</h3><div className="label-row">{labels.map((label) => <span className="label-pill" key={label.id} style={{ '--label-color': label.color }}>{label.name}</span>)}{!labels.length && <span className="muted">No labels</span>}</div></div></div>
        </div>
        {selectedIssue && <aside className="detail-panel"><button className="close-button" onClick={() => setSelectedIssue(null)}>×</button><span className="issue-key">{selectedIssue.key}</span><h2>{selectedIssue.title}</h2><p>{selectedIssue.description || 'No description provided.'}</p><label>Status<select value={selectedIssue.workflow_state_id} onChange={(e) => updateIssue({ workflow_state_id: e.target.value })} disabled={busy}>{workflowStates.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select></label><label>Priority<select value={selectedIssue.priority} onChange={(e) => updateIssue({ priority: Number(e.target.value) })} disabled={busy}>{['No priority', 'Low', 'Medium', 'High', 'Urgent'].map((name, value) => <option key={name} value={value}>{name}</option>)}</select></label><label>Cycle<select value={selectedIssue.cycle_id || ''} onChange={(e) => updateIssue({ cycle_id: e.target.value || null })} disabled={busy}><option value="">No cycle</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></label><label>Assignee<select value={selectedIssue.assignee_user_id || ''} onChange={(e) => updateIssue({ assignee_user_id: e.target.value ? Number(e.target.value) : null })} disabled={busy}><option value="">Unassigned</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}</select></label><div className="detail-meta">Version {selectedIssue.version} · Updated {new Date(selectedIssue.updated_at).toLocaleString()}</div></aside>}
      </section>
    );

    if (section === 'Cycles') return (
      <section className="cycle-page"><div className="cycle-grid">{cycles.map((cycle) => <article className="cycle-card" key={cycle.id}><div className="cycle-icon">◒</div><h3>{cycle.name}</h3><p>{new Date(`${cycle.starts_on}T00:00:00`).toLocaleDateString()} — {new Date(`${cycle.ends_on}T00:00:00`).toLocaleDateString()}</p><div className="progress-track"><span /></div></article>)}{!cycles.length && <div className="empty-panel cycle-empty"><div className="section-icon">C</div><h3>No cycles yet</h3><p>Create a time-boxed planning window for this team.</p></div>}</div><form className="editor-card cycle-form" onSubmit={createCycle}><h2>Create a cycle</h2><p>Cycles are non-overlapping, time-boxed planning windows.</p><label>Name<input value={cycleForm.name} onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })} required /></label><div className="two-columns"><label>Starts on<input type="date" value={cycleForm.starts_on} onChange={(e) => setCycleForm({ ...cycleForm, starts_on: e.target.value })} required /></label><label>Ends on<input type="date" value={cycleForm.ends_on} onChange={(e) => setCycleForm({ ...cycleForm, ends_on: e.target.value })} required /></label></div><button className="primary" disabled={busy}>Create cycle</button></form></section>
    );

    return <section className="empty-panel large-panel"><div className="section-icon">{section.slice(0, 1)}</div><h2>{section}</h2><p>This Team-scoped destination is ready for its next milestone.</p></section>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark small">C</span><strong>CommonPlan</strong></div>
        <div className="workspace-row">
          <WorkspaceSwitcher
            open={workspaceMenuOpen}
            onToggle={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            workspaces={workspaces}
            selected={selectedWorkspace}
            onSelect={(id) => { setWorkspaceId(id); setTeamId(''); setWorkspaceMenuOpen(false); }}
            onCreate={() => { setShowWorkspaceForm(true); setWorkspaceMenuOpen(false); }}
          />
          <button className="icon-button" title="New workspace" aria-label="New workspace" onClick={() => setShowWorkspaceForm(!showWorkspaceForm)}><Icon name="plus" /></button>
        </div>
        {showWorkspaceForm && <form className="compact-form" onSubmit={createWorkspace}><input placeholder="Workspace name" value={workspaceForm.name} onChange={(e) => setWorkspaceForm({ ...workspaceForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} required /><input placeholder="workspace-slug" value={workspaceForm.slug} onChange={(e) => setWorkspaceForm({ ...workspaceForm, slug: e.target.value })} required /><button className="primary" disabled={busy}>Create</button></form>}
        <div className="sidebar-heading"><span>Teams</span>{selectedWorkspace?.my_role !== 'member' && <button className="icon-button compact" aria-label="New team" onClick={() => setShowTeamForm(!showTeamForm)}><Icon name="plus" /></button>}</div>
        {showTeamForm && <form className="compact-form" onSubmit={createTeam}><input placeholder="Team name" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} required /><input placeholder="KEY" maxLength="12" value={teamForm.issue_prefix} onChange={(e) => setTeamForm({ ...teamForm, issue_prefix: e.target.value.toUpperCase() })} required /><button className="primary" disabled={busy}>Create team</button></form>}
        <nav className="team-list">
          {teams.map((team) => <div key={team.id} className={`team-block ${team.id === teamId ? 'active' : ''}`}><button className="team-name" onClick={() => { setTeamId(team.id); setSection('Overview'); }}><span className="team-icon">{team.issue_prefix.slice(0, 1)}</span><span>{team.name}</span><Icon name="chevron" /></button>{team.id === teamId && <div className="team-subnav">{navItems.map((item) => <button key={item.name} className={section === item.name ? 'selected' : ''} onClick={() => setSection(item.name)}><Icon name={item.icon} /><span>{item.name}</span></button>)}</div>}</div>)}
          {!teams.length && <p className="sidebar-empty">No teams yet</p>}
        </nav>
        <div className="profile"><div className="avatar">{currentUser.name.slice(0, 1).toUpperCase()}</div><div><strong>{currentUser.name}</strong><span>{currentUser.email}</span></div><button className="profile-action" title="Log out" aria-label="Log out" onClick={logout}><Icon name="logout" /></button></div>
      </aside>
      <main className="content">
        {!selectedWorkspace ? <EmptyState title="Create your first workspace" body="A workspace contains your teams and shared product work." action={() => setShowWorkspaceForm(true)} /> : !selectedTeam ? <EmptyState title="Create your first team" body="Teams own issue keys, cycles, projects, and views." action={() => setShowTeamForm(true)} /> : <>
          <header className="page-header"><div><div className="breadcrumbs">{selectedWorkspace.name} / {selectedTeam.name}</div><h1>{section}</h1></div><span className="role-chip">{selectedTeam.my_role}</span></header>
          {planningContent()}
        </>}
        {status && <div className="toast"><span className="toast-dot" />{status}</div>}
      </main>
    </div>
  );
}

function Metric({ label, value }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function StateBadge({ name }) { return <span className={`state-badge state-${name.toLowerCase().replaceAll(' ', '-')}`}>{name}</span>; }
function EmptyState({ title, body, action }) { return <section className="empty-panel large-panel"><h2>{title}</h2><p>{body}</p><button className="primary" onClick={action}>Get started</button></section>; }

function WorkspaceSwitcher({ open, onToggle, workspaces, selected, onSelect, onCreate }) {
  return <div className="workspace-switcher">
    <button className={`workspace-trigger ${open ? 'open' : ''}`} onClick={onToggle} aria-expanded={open}>
      <span className="workspace-avatar">{selected?.name?.slice(0, 1).toUpperCase() || 'W'}</span>
      <span className="workspace-copy"><strong>{selected?.name || 'Select workspace'}</strong><small>{selected?.my_role || 'Workspace'}</small></span>
      <Icon name="chevron" />
    </button>
    {open && <div className="workspace-menu">
      <div className="menu-label">Workspaces</div>
      {workspaces.map((workspace) => <button key={workspace.id} className={workspace.id === selected?.id ? 'selected' : ''} onClick={() => onSelect(workspace.id)}><span className="workspace-avatar small">{workspace.name.slice(0, 1).toUpperCase()}</span><span>{workspace.name}</span>{workspace.id === selected?.id && <Icon name="check" />}</button>)}
      <div className="menu-separator" />
      <button onClick={onCreate}><span className="menu-add"><Icon name="plus" /></span><span>Create workspace</span></button>
    </div>}
  </div>;
}

function Icon({ name }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    overview: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    issues: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5M12 16h.01" /></>,
    cycles: <><path d="M20 11a8 8 0 0 0-14.9-4M4 5v4h4" /><path d="M4 13a8 8 0 0 0 14.9 4M20 19v-4h-4" /></>,
    projects: <><path d="M4 7h6l2 2h8v10H4z" /><path d="M4 7V5h6l2 2" /></>,
    views: <><path d="M4 5h16v14H4z" /><path d="M9 5v14M9 10h11" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

createRoot(document.getElementById('root')).render(<App />);
