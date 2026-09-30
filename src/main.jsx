import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const AUTH_BASE_URL = import.meta.env.VITE_AUTH_BASE_URL || API_BASE_URL;
let accessToken = null;
let refreshPromise = null;
const REQUEST_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server took too long to respond. Please try again.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function parseIssueRoute(pathname = window.location.pathname) {
  const match = pathname.match(/^\/workspaces\/([^/]+)\/issues\/([^/]+)\/?$/);
  return match ? { workspaceId: match[1], key: decodeURIComponent(match[2]).toUpperCase() } : null;
}

function parseSummaryRoute(pathname = window.location.pathname) {
  const match = pathname.match(/^\/workspaces\/([^/]+)\/teams\/([^/]+)\/summary\/?$/);
  return match ? { workspaceId: match[1], teamId: match[2] } : null;
}

const SUMMARY_FILTER_KEYS = ['cycle', 'project', 'status', 'priority', 'assignee', 'label', 'due', 'ownership', 'date_from', 'date_to', 'include_archived'];

function summaryFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(SUMMARY_FILTER_KEYS.map((key) => [key, params.get(key) || '']));
}

async function authRequest(path, options = {}) {
  const hasJsonBody = options.body !== undefined && options.body !== null;
  const response = await fetchWithTimeout(`${AUTH_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
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
  const [section, setSection] = useState(() => parseSummaryRoute() ? 'Summary' : 'Overview');
  const [workspaceForm, setWorkspaceForm] = useState({ name: '', slug: '', description: '' });
  const [teamForm, setTeamForm] = useState({ name: '', issue_prefix: '', description: '' });
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [overview, setOverview] = useState(null);
  const [summaryRoute, setSummaryRoute] = useState(() => parseSummaryRoute());
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryFilters, setSummaryFilters] = useState(() => summaryFiltersFromUrl());
  const [summaryFiltersOpen, setSummaryFiltersOpen] = useState(false);
  const [workflowStates, setWorkflowStates] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [labels, setLabels] = useState([]);
  const [issues, setIssues] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [savedViews, setSavedViews] = useState([]);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [viewIssues, setViewIssues] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [showViewForm, setShowViewForm] = useState(false);
  const [viewForm, setViewForm] = useState({ name: '', visibility: 'private' });
  const [inbox, setInbox] = useState({ unread_count: 0, notifications: [] });
  const [myIssues, setMyIssues] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [cycleSettings, setCycleSettings] = useState({ enabled: false, duration_weeks: 2, upcoming_cycle_count: 3, next_cycle_starts_on: '', rollover_incomplete: true });
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', summary: '', description: '', status: 'planned', lead_user_id: '', target_date: '' });
  const [projectDraft, setProjectDraft] = useState({ name: '', summary: '', description: '', status: 'planned', lead_user_id: '', target_date: '' });
  const [objectiveForm, setObjectiveForm] = useState({ kind: 'objective', body: '' });
  const [milestoneForm, setMilestoneForm] = useState({ name: '', description: '', target_date: '' });
  const [projectUpdateForm, setProjectUpdateForm] = useState({ body: '', health: 'on_track' });
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [issueRoute, setIssueRoute] = useState(() => parseIssueRoute());
  const [issueActivity, setIssueActivity] = useState([]);
  const [issuePullRequests, setIssuePullRequests] = useState([]);
  const [issueCollaboration, setIssueCollaboration] = useState({ watching: false, watchers: [], sub_issues: [] });
  const [relationTypes, setRelationTypes] = useState([]);
  const [issueRelations, setIssueRelations] = useState([]);
  const [issueRelationSummaries, setIssueRelationSummaries] = useState([]);
  const [relationForm, setRelationForm] = useState({ relation_type_id: '', direction: 'outgoing', target_issue_key: '' });
  const [relationTypeForm, setRelationTypeForm] = useState({ key: '', forward_label: '', inverse_label: '', category: 'custom', symmetric: false, allow_cycles: true });
  const [issueDraft, setIssueDraft] = useState({ title: '', description: '' });
  const [commentBody, setCommentBody] = useState('');
  const [commentMentions, setCommentMentions] = useState([]);
  const [mentionMenu, setMentionMenu] = useState({ open: false, start: 0, end: 0, query: '', active: 0 });
  const commentInputRef = useRef(null);
  const [subIssueTitle, setSubIssueTitle] = useState('');
  const [issueLoading, setIssueLoading] = useState(false);
  const [githubHealth, setGitHubHealth] = useState(null);
  const [githubHealthLoading, setGitHubHealthLoading] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [workspacePolicy, setWorkspacePolicy] = useState({ allow_member_invites: false, default_timezone: 'UTC', domain_policy: 'invite_only' });
  const [invitationForm, setInvitationForm] = useState({ email: '', role: 'member' });
  const [invitationUrl, setInvitationUrl] = useState('');
  const [profileDraft, setProfileDraft] = useState({ name: '' });
  const [workspaceDraft, setWorkspaceDraft] = useState({ name: '', description: '' });
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueForm, setIssueForm] = useState({ title: '', description: '', priority: 0, workflow_state_id: '', cycle_id: '', project_id: '', milestone_id: '', assignee_user_id: '', due_date: '', label_ids: [] });
  const [cycleForm, setCycleForm] = useState({ name: '', starts_on: '', ends_on: '' });
  const [labelForm, setLabelForm] = useState({ name: '', color: '#6C6FF2' });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function request(path, options = {}, allowRefresh = true) {
    const hasJsonBody = options.body !== undefined && options.body !== null;
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
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
    const [nextOverview, nextStates, nextCycles, nextCycleSettings, nextLabels, nextIssues, nextMembers, nextProjects, nextRelationTypes, nextRelationSummaries] = await Promise.all([
      request(`${base}/overview`),
      request(`${base}/workflow-states`),
      request(`${base}/cycles`),
      request(`${base}/cycle-settings`),
      request(`${base}/labels`),
      request(`${base}/issues`),
      request(`${base}/members`),
      request(`${base}/projects`),
      request(`/api/v1/workspaces/${selectedWorkspaceId}/relation-types`),
      request(`/api/v1/workspaces/${selectedWorkspaceId}/teams/${selectedTeamId}/issue-relation-summaries`),
    ]);
    setOverview(nextOverview);
    setWorkflowStates(nextStates);
    setCycles(nextCycles);
    setCycleSettings({ ...nextCycleSettings, next_cycle_starts_on: nextCycleSettings.next_cycle_starts_on || '' });
    setLabels(nextLabels);
    setIssues(nextIssues);
    setMembers(nextMembers);
    setProjects(nextProjects);
    setRelationTypes(nextRelationTypes);
    setIssueRelationSummaries(nextRelationSummaries);
    setRelationForm((form) => ({ ...form, relation_type_id: form.relation_type_id || nextRelationTypes[0]?.id || '', direction: form.direction || 'outgoing' }));
    if (selectedCycle) {
      const refreshedCycle = nextCycles.find((cycle) => cycle.id === selectedCycle.id);
      if (refreshedCycle) setSelectedCycle(refreshedCycle);
    }
    if (selectedProject) {
      const refreshed = nextProjects.find((project) => project.id === selectedProject.id);
      if (refreshed) {
        setSelectedProject(refreshed);
        setProjectDraft(projectToDraft(refreshed));
      }
    }
  }

  async function loadSummary(selectedWorkspaceId, selectedTeamId, filters = summaryFilters) {
    if (!selectedWorkspaceId || !selectedTeamId) return;
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => { if (value !== '') params.set(key, value); });
      params.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      const suffix = params.toString() ? `?${params}` : '';
      setSummaryData(await request(`/api/v1/workspaces/${selectedWorkspaceId}/teams/${selectedTeamId}/summary${suffix}`));
    } finally { setSummaryLoading(false); }
  }

  async function loadViews(preferredViewId = '') {
    const data = await request(`/api/v1/workspaces/${workspaceId}/views`);
    setSavedViews(data);
    if (!data.length) {
      setSelectedViewId('');
      setViewIssues(null);
      return;
    }
    const nextId = preferredViewId || (data.some((view) => view.id === selectedViewId) ? selectedViewId : data[0].id);
    const nextView = data.find((view) => view.id === nextId) || data[0];
    await runSavedView(nextView);
  }

  async function loadInbox() {
    setInbox(await request(`/api/v1/me/inbox?workspace_id=${workspaceId}`));
  }

  async function loadMyIssues() {
    setMyIssues(await request(`/api/v1/me/issues?workspace_id=${workspaceId}`));
  }

  async function loadGitHubHealth() {
    setGitHubHealthLoading(true);
    try {
      setGitHubHealth(await request(`/api/v1/workspaces/${workspaceId}/integrations/github`));
    } catch (error) {
      setGitHubHealth({ forbidden: true, message: error.message });
    } finally {
      setGitHubHealthLoading(false);
    }
  }

  async function openCycle(cycle) {
    setSelectedCycle(cycle);
  }

  async function loadSettingsData() {
    const [rows, policy, types] = await Promise.all([
      request(`/api/v1/workspaces/${workspaceId}/members`),
      request(`/api/v1/workspaces/${workspaceId}/settings`),
      request(`/api/v1/workspaces/${workspaceId}/relation-types`),
    ]);
    setWorkspaceMembers(rows);
    setWorkspacePolicy(policy);
    setRelationTypes(types);
  }

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const updated = await request(`/users/${currentUser.id}`, { method: 'PATCH', body: JSON.stringify({ name: profileDraft.name }) });
      setCurrentUser(updated);
      setStatus('Profile updated');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function saveWorkspace(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const [updated] = await Promise.all([
        request(`/api/v1/workspaces/${workspaceId}`, { method: 'PATCH', body: JSON.stringify(workspaceDraft) }),
        request(`/api/v1/workspaces/${workspaceId}/settings`, { method: 'PATCH', body: JSON.stringify({ allow_member_invites: workspacePolicy.allow_member_invites, default_timezone: workspacePolicy.default_timezone, domain_policy: workspacePolicy.domain_policy }) }),
      ]);
      setWorkspaces((rows) => rows.map((row) => row.id === updated.id ? updated : row));
      setStatus('Workspace updated');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function inviteWorkspaceMember(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const invitation = await request(`/api/v1/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ ...invitationForm, team_id: null }),
      });
      const url = `${window.location.origin}/?invite=${encodeURIComponent(invitation.invite_token)}`;
      setInvitationUrl(url);
      setInvitationForm({ email: '', role: 'member' });
      setStatus('Invitation created');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function updateWorkspaceMember(userId, role) {
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/members/${userId}`, { method: 'PUT', body: JSON.stringify({ role }) });
      await loadSettingsData();
      setStatus('Workspace member updated');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function removeWorkspaceMember(member) {
    if (!window.confirm(`Remove ${member.name} from this workspace and all of its teams?`)) return;
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/members/${member.user_id}`, { method: 'DELETE' });
      await Promise.all([loadSettingsData(), loadPlanning(workspaceId, teamId)]);
      setStatus('Workspace member removed');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function addTeamMember(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const userId = form.get('user_id');
    if (!userId || !teamId) return;
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/members/${userId}`, { method: 'PUT', body: JSON.stringify({ role: form.get('role') }) });
      await loadPlanning(workspaceId, teamId);
      formElement.reset();
      setStatus('Team member added');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function updateTeamMember(userId, role) {
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/members/${userId}`, { method: 'PUT', body: JSON.stringify({ role }) });
      await loadPlanning(workspaceId, teamId);
      setStatus('Team member updated');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function removeTeamMember(member) {
    if (!window.confirm(`Remove ${member.name} from ${selectedTeam.name}?`)) return;
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/members/${member.user_id}`, { method: 'DELETE' });
      await loadPlanning(workspaceId, teamId);
      setStatus('Team member removed');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  function applySummaryFilters(changes) {
    const next = { ...summaryFilters, ...changes };
    setSummaryFilters(next);
    const params = summarySearchParams(next);
    window.history.pushState({}, '', `/workspaces/${workspaceId}/teams/${teamId}/summary${params}`);
    setSummaryRoute({ workspaceId, teamId });
  }

  function resetSummaryFilters() {
    const next = Object.fromEntries(SUMMARY_FILTER_KEYS.map((key) => [key, '']));
    applySummaryFilters(next);
  }

  async function loadIssueDetail(selectedWorkspaceId, key) {
    if (!selectedWorkspaceId || !key) return;
    setIssueLoading(true);
    try {
      const [issue, activity, collaboration, pullRequests, relations] = await Promise.all([
        request(`/api/v1/workspaces/${selectedWorkspaceId}/issues/${key}`),
        request(`/api/v1/workspaces/${selectedWorkspaceId}/issues/${key}/activity`),
        request(`/api/v1/workspaces/${selectedWorkspaceId}/issues/${key}/collaboration`),
        request(`/api/v1/workspaces/${selectedWorkspaceId}/issues/${key}/pull-requests`).catch(() => []),
        request(`/api/v1/workspaces/${selectedWorkspaceId}/issues/${key}/relations`),
      ]);
      setSelectedIssue(issue);
      setIssueDraft({ title: issue.title, description: issue.description || '' });
      setIssueActivity(activity);
      setIssueCollaboration(collaboration);
      setIssuePullRequests(pullRequests);
      setIssueRelations(relations);
      setSection('Issues');
      if (issue.team_id !== teamId) setTeamId(issue.team_id);
    } finally {
      setIssueLoading(false);
    }
  }

  function openIssue(issue) {
    const route = { workspaceId: issue.workspace_id || workspaceId, key: issue.key };
    window.history.pushState({}, '', `/workspaces/${route.workspaceId}/issues/${encodeURIComponent(route.key)}`);
    setIssueRoute(route);
    setSummaryRoute(null);
    // Inbox, Summary, Saved Views, and activity rows carry intentionally small
    // issue projections. Always load the canonical detail before rendering the
    // editor instead of treating those projections as a complete IssueRead.
    setSelectedIssue(null);
    setIssueDraft({ title: '', description: '' });
    setIssueActivity([]);
    setIssuePullRequests([]);
    setIssueCollaboration({ watching: false, watchers: [], sub_issues: [] });
    setIssueRelations([]);
    setRelationForm((form) => ({ ...form, target_issue_key: '' }));
    setIssueLoading(true);
    setSection('Issues');
  }

  function closeIssue() {
    window.history.pushState({}, '', '/');
    setIssueRoute(null);
    setSelectedIssue(null);
    setIssueActivity([]);
    setIssuePullRequests([]);
    setIssueCollaboration({ watching: false, watchers: [], sub_issues: [] });
    setIssueRelations([]);
    setIssueLoading(false);
  }

  function showSection(nextSection) {
    if (issueRoute) closeIssue();
    if (nextSection !== 'Projects') setSelectedProject(null);
    if (nextSection !== 'Cycles') setSelectedCycle(null);
    if (nextSection === 'Summary') {
      const route = { workspaceId, teamId };
      const params = summarySearchParams(summaryFilters);
      window.history.pushState({}, '', `/workspaces/${workspaceId}/teams/${teamId}/summary${params}`);
      setSummaryRoute(route);
    } else if (summaryRoute) {
      window.history.pushState({}, '', '/');
      setSummaryRoute(null);
    }
    setSection(nextSection);
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const authError = url.searchParams.get('auth_error');
    if (authError) {
      setStatus(authError === 'access_denied' ? 'Google sign-in was canceled.' : 'Google sign-in failed.');
      url.searchParams.delete('auth_error');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
    async function bootstrap() {
      const [profileResult, googleResult] = await Promise.allSettled([
        refreshAccessToken().then(() => request('/users/me', {}, false)),
        authRequest('/auth/google/status'),
      ]);
      const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
      const google = googleResult.status === 'fulfilled' ? googleResult.value : { configured: false };
      setCurrentUser(profile);
      setGoogleConfigured(Boolean(google.configured));
      setSessionLoading(false);
      if (profile) {
        loadWorkspaces(parseIssueRoute()?.workspaceId || parseSummaryRoute()?.workspaceId).catch((error) => setStatus(error.message));
      }
    }
    bootstrap().catch((error) => {
      setStatus(error.message);
      setSessionLoading(false);
    });
  }, []);

  useEffect(() => {
    if (currentUser && workspaceId) {
      const preferredTeam = summaryRoute?.workspaceId === workspaceId ? summaryRoute.teamId : undefined;
      loadTeams(workspaceId, preferredTeam).catch((error) => setStatus(error.message));
    }
  }, [workspaceId, currentUser]);

  useEffect(() => {
    if (currentUser && workspaceId && teamId) {
      loadPlanning(workspaceId, teamId).catch((error) => setStatus(error.message));
    }
  }, [teamId, workspaceId, currentUser]);

  useEffect(() => {
    if (currentUser && workspaceId && teamId && section === 'Summary') {
      loadSummary(workspaceId, teamId).catch((error) => setStatus(error.message));
    }
  }, [currentUser, workspaceId, teamId, section, summaryFilters]);

  useEffect(() => {
    if (!currentUser || !workspaceId) return;
    if (section === 'Views') loadViews().catch((error) => setStatus(error.message));
    if (section === 'Inbox') loadInbox().catch((error) => setStatus(error.message));
    if (section === 'My Issues') loadMyIssues().catch((error) => setStatus(error.message));
    if (section === 'Members') loadSettingsData().catch((error) => setStatus(error.message));
    if (section === 'Settings') {
      loadGitHubHealth();
      loadSettingsData().catch((error) => setStatus(error.message));
    }
  }, [currentUser, workspaceId, section]);

  useEffect(() => {
    setProfileDraft({ name: currentUser?.name || '' });
  }, [currentUser?.id, currentUser?.name]);

  useEffect(() => {
    if (!currentUser) return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get('invite');
    if (!token) return;
    request('/api/v1/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) })
      .then((workspace) => {
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        setStatus(`Joined ${workspace.name}`);
        return loadWorkspaces(workspace.id);
      })
      .catch((error) => setStatus(error.message));
  }, [currentUser?.id]);

  useEffect(() => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    setWorkspaceDraft({ name: workspace?.name || '', description: workspace?.description || '' });
  }, [workspaceId, workspaces]);

  useEffect(() => {
    if (!currentUser || !issueRoute) return;
    if (workspaceId !== issueRoute.workspaceId) {
      setWorkspaceId(issueRoute.workspaceId);
      return;
    }
    loadIssueDetail(issueRoute.workspaceId, issueRoute.key).catch((error) => {
      setStatus(error.message);
      closeIssue();
    });
  }, [currentUser, workspaceId, issueRoute?.workspaceId, issueRoute?.key]);

  useEffect(() => {
    const handlePopState = () => {
      const route = parseIssueRoute();
      const nextSummaryRoute = parseSummaryRoute();
      setIssueRoute(route);
      setSummaryRoute(nextSummaryRoute);
      if (nextSummaryRoute) {
        setSection('Summary');
        setSummaryFilters(summaryFiltersFromUrl());
        setWorkspaceId(nextSummaryRoute.workspaceId);
        setTeamId(nextSummaryRoute.teamId);
      }
      if (!route) {
        setSelectedIssue(null);
        setIssueActivity([]);
        setIssuePullRequests([]);
      }
      if (!route && !nextSummaryRoute) setSection('Overview');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
        project_id: issueForm.project_id || null,
        milestone_id: issueForm.milestone_id || null,
        assignee_user_id: issueForm.assignee_user_id ? Number(issueForm.assignee_user_id) : null,
        due_date: issueForm.due_date || null,
      };
      const created = await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/issues`, {
        method: 'POST', body: JSON.stringify(payload),
      });
      setIssueForm({ title: '', description: '', priority: 0, workflow_state_id: '', cycle_id: '', project_id: '', milestone_id: '', assignee_user_id: '', due_date: '', label_ids: [] });
      setShowIssueForm(false);
      await loadPlanning(workspaceId, teamId);
      openIssue(created);
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

  async function saveCycleSettings(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/cycle-settings`, {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: cycleSettings.enabled,
          duration_weeks: Number(cycleSettings.duration_weeks),
          upcoming_cycle_count: Number(cycleSettings.upcoming_cycle_count),
          next_cycle_starts_on: cycleSettings.next_cycle_starts_on || null,
          rollover_incomplete: cycleSettings.rollover_incomplete,
        }),
      });
      await loadPlanning(workspaceId, teamId);
      setStatus('Cycle schedule updated');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function moveCycleIssue(issue, workflowStateId) {
    if (issue.workflow_state_id === workflowStateId) return;
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/issues/${issue.key}`, {
        method: 'PATCH',
        body: JSON.stringify({ version: issue.version, workflow_state_id: workflowStateId }),
      });
      await loadPlanning(workspaceId, teamId);
      setStatus(`Moved ${issue.key}`);
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  function createIssueInCycleState(workflowStateId) {
    setIssueForm({ ...issueForm, workflow_state_id: workflowStateId, cycle_id: selectedCycle.id });
    setSelectedCycle(null);
    setShowIssueForm(true);
    showSection('Issues');
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

  function openProject(project) {
    setSelectedProject(project);
    setProjectDraft(projectToDraft(project));
    setSection('Projects');
  }

  async function createProject(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...projectForm,
        lead_user_id: projectForm.lead_user_id ? Number(projectForm.lead_user_id) : null,
        target_date: projectForm.target_date || null,
      };
      const created = await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/projects`, {
        method: 'POST', body: JSON.stringify(payload),
      });
      setProjectForm({ name: '', summary: '', description: '', status: 'planned', lead_user_id: '', target_date: '' });
      setShowProjectForm(false);
      await loadPlanning(workspaceId, teamId);
      openProject(created);
      setStatus(`Created project ${created.name}`);
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function saveProject(event) {
    event.preventDefault();
    if (!selectedProject) return;
    setBusy(true);
    try {
      const updated = await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/projects/${selectedProject.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...projectDraft,
          lead_user_id: projectDraft.lead_user_id ? Number(projectDraft.lead_user_id) : null,
          target_date: projectDraft.target_date || null,
        }),
      });
      setSelectedProject(updated);
      setProjectDraft(projectToDraft(updated));
      setProjects((rows) => rows.map((row) => row.id === updated.id ? updated : row));
      setStatus('Project brief saved');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function addObjective(event) {
    event.preventDefault();
    if (!selectedProject || !objectiveForm.body.trim()) return;
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/projects/${selectedProject.id}/objectives`, {
        method: 'POST', body: JSON.stringify(objectiveForm),
      });
      setObjectiveForm({ kind: 'objective', body: '' });
      await loadPlanning(workspaceId, teamId);
      setStatus(objectiveForm.kind === 'objective' ? 'Objective added' : 'Success criterion added');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function toggleObjective(objective) {
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/projects/${selectedProject.id}/objectives/${objective.id}`, {
        method: 'PATCH', body: JSON.stringify({ is_met: !objective.is_met }),
      });
      await loadPlanning(workspaceId, teamId);
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function addMilestone(event) {
    event.preventDefault();
    if (!selectedProject) return;
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/projects/${selectedProject.id}/milestones`, {
        method: 'POST', body: JSON.stringify({ ...milestoneForm, target_date: milestoneForm.target_date || null }),
      });
      setMilestoneForm({ name: '', description: '', target_date: '' });
      await loadPlanning(workspaceId, teamId);
      setStatus('Milestone added');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function addProjectUpdate(event) {
    event.preventDefault();
    if (!selectedProject || !projectUpdateForm.body.trim()) return;
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/projects/${selectedProject.id}/updates`, {
        method: 'POST', body: JSON.stringify(projectUpdateForm),
      });
      setProjectUpdateForm({ body: '', health: 'on_track' });
      await loadPlanning(workspaceId, teamId);
      setStatus('Project update posted');
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
      setIssueDraft({ title: updated.title, description: updated.description || '' });
      await Promise.all([
        loadPlanning(workspaceId, teamId),
        request(`/api/v1/workspaces/${workspaceId}/issues/${updated.key}/activity`).then(setIssueActivity),
      ]);
      setStatus(`Updated ${updated.key}`);
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function saveIssueBody(event) {
    event.preventDefault();
    await updateIssue({ title: issueDraft.title, description: issueDraft.description || null });
  }

  async function addComment(event) {
    event.preventDefault();
    if (!selectedIssue || !commentBody.trim()) return;
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/comments`, {
        method: 'POST', body: JSON.stringify({ body: commentBody, mentioned_user_ids: commentMentions.map((member) => member.user_id) }),
      });
      setCommentBody('');
      setCommentMentions([]);
      setMentionMenu((menu) => ({ ...menu, open: false }));
      const activity = await request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/activity`);
      setIssueActivity(activity);
      setIssueCollaboration(await request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/collaboration`));
      setStatus('Comment added');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  function mentionCandidates(query = mentionMenu.query) {
    const normalized = query.trim().toLowerCase();
    return members.filter((member) => !normalized || member.name.toLowerCase().includes(normalized) || member.email.toLowerCase().includes(normalized));
  }

  function updateCommentBody(event) {
    const value = event.target.value;
    const cursor = event.target.selectionStart;
    const prefix = value.slice(0, cursor);
    const match = prefix.match(/(?:^|\s)@([^\s@]*)$/);
    setCommentBody(value);
    setCommentMentions((selected) => selected.filter((member) => value.includes(`@${member.name}`)));
    if (!match) {
      setMentionMenu((menu) => ({ ...menu, open: false }));
      return;
    }
    setMentionMenu({ open: true, start: prefix.lastIndexOf('@'), end: cursor, query: match[1], active: 0 });
  }

  function selectMention(member) {
    const before = commentBody.slice(0, mentionMenu.start);
    const after = commentBody.slice(mentionMenu.end).replace(/^\s+/, '');
    const nextBody = `${before}@${member.name} ${after}`;
    const nextCursor = before.length + member.name.length + 2;
    setCommentBody(nextBody);
    setCommentMentions((selected) => selected.some((item) => item.user_id === member.user_id) ? selected : [...selected, member]);
    setMentionMenu((menu) => ({ ...menu, open: false }));
    window.requestAnimationFrame(() => {
      commentInputRef.current?.focus();
      commentInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleMentionKeyDown(event) {
    if (!mentionMenu.open) return;
    const candidates = mentionCandidates();
    if (event.key === 'Escape') {
      event.preventDefault();
      setMentionMenu((menu) => ({ ...menu, open: false }));
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setMentionMenu((menu) => ({ ...menu, active: candidates.length ? (menu.active + direction + candidates.length) % candidates.length : 0 }));
    } else if ((event.key === 'Enter' || event.key === 'Tab') && candidates.length) {
      event.preventDefault();
      selectMention(candidates[mentionMenu.active] || candidates[0]);
    }
  }

  async function updateComment(commentId, body) {
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ body }) });
      setIssueActivity(await request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/activity`));
      setStatus('Comment updated');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function deleteComment(commentId) {
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/comments/${commentId}`, { method: 'DELETE' });
      setIssueActivity(await request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/activity`));
      setStatus('Comment deleted');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function toggleWatch() {
    setBusy(true);
    try {
      const data = await request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/watch`, { method: issueCollaboration.watching ? 'DELETE' : 'PUT' });
      setIssueCollaboration(data);
      setStatus(data.watching ? 'Watching issue' : 'Stopped watching');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function createSubIssue(event) {
    event.preventDefault();
    if (!subIssueTitle.trim()) return;
    setBusy(true);
    try {
      const created = await request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/sub-issues`, { method: 'POST', body: JSON.stringify({ title: subIssueTitle, label_ids: [] }) });
      setSubIssueTitle('');
      await Promise.all([
        loadPlanning(workspaceId, teamId),
        request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/collaboration`).then(setIssueCollaboration),
      ]);
      setStatus(`Created ${created.key}`);
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function createIssueRelation(event) {
    event.preventDefault();
    if (!relationForm.relation_type_id || !relationForm.target_issue_key) return;
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/relations`, { method: 'POST', body: JSON.stringify(relationForm) });
      const [relations, summaries] = await Promise.all([
        request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/relations`),
        request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/issue-relation-summaries`),
      ]);
      setIssueRelations(relations);
      setIssueRelationSummaries(summaries);
      setRelationForm((form) => ({ ...form, target_issue_key: '' }));
      setStatus('Issue relation added');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function deleteIssueRelation(relationId) {
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/issues/${selectedIssue.key}/relations/${relationId}`, { method: 'DELETE' });
      setIssueRelations((rows) => rows.filter((row) => row.id !== relationId));
      setIssueRelationSummaries(await request(`/api/v1/workspaces/${workspaceId}/teams/${teamId}/issue-relation-summaries`));
      setStatus('Issue relation removed');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function createRelationType(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await request(`/api/v1/workspaces/${workspaceId}/relation-types`, { method: 'POST', body: JSON.stringify(relationTypeForm) });
      setRelationTypes((rows) => [...rows, created]);
      setRelationTypeForm({ key: '', forward_label: '', inverse_label: '', category: 'custom', symmetric: false, allow_cycles: true });
      setStatus('Relationship type created');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function createSavedView(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const filterSpec = Object.fromEntries(Object.entries(summaryFilters).filter(([, value]) => value !== ''));
      filterSpec.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const created = await request(`/api/v1/workspaces/${workspaceId}/views`, { method: 'POST', body: JSON.stringify({ ...viewForm, team_id: teamId, filter_spec: filterSpec }) });
      setViewForm({ name: '', visibility: 'private' });
      setShowViewForm(false);
      await loadViews(created.id);
      setStatus('View saved');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function runSavedView(view) {
    setSelectedViewId(view.id);
    setViewIssues(null);
    setViewLoading(true);
    try {
      setViewIssues(await request(`/api/v1/workspaces/${workspaceId}/views/${view.id}/issues`));
    } catch (error) {
      setViewIssues([]);
      setStatus(error.message);
    } finally {
      setViewLoading(false);
    }
  }

  async function deleteSavedView(viewId) {
    setBusy(true);
    try {
      await request(`/api/v1/workspaces/${workspaceId}/views/${viewId}`, { method: 'DELETE' });
      setViewIssues(null);
      await loadViews();
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function markNotificationRead(notification) {
    await request(`/api/v1/me/inbox/${notification.id}/read`, { method: 'POST' });
    await loadInbox();
    if (notification.payload?.issue_key) openIssue({ key: notification.payload.issue_key, workspace_id: notification.workspace_id });
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
    { name: 'Summary', icon: 'summary' },
    { name: 'Issues', icon: 'issues' },
    { name: 'Cycles', icon: 'cycles' },
    { name: 'Projects', icon: 'projects' },
    { name: 'Members', icon: 'members' },
  ];
  const workspaceNavItems = [
    { name: 'My Issues', icon: 'issues' },
    { name: 'Views', icon: 'views' },
    { name: 'Inbox', icon: 'inbox' },
    { name: 'Settings', icon: 'settings' },
  ];
  const workspaceSections = new Set(workspaceNavItems.map((item) => item.name));

  function planningContent() {
    if (section === 'Overview') return (
      <section className="overview">
        <div className="hero-card"><div><span className="team-icon large">{selectedTeam.issue_prefix.slice(0, 1)}</span><h2>{selectedTeam.name}</h2><p>{selectedTeam.description || 'A focused space for this team’s projects, cycles, and issues.'}</p></div><span className="prefix-chip">{selectedTeam.issue_prefix}</span></div>
        <div className="metric-grid"><Metric label="Open issues" value={overview?.open_issue_count ?? '—'} /><Metric label="Projects" value={overview?.project_count ?? 0} /><Metric label="Current cycle" value={overview?.current_cycle?.name || '—'} /><Metric label="Members" value={members.length || '—'} /></div>
        <div className="activity-panel"><div className="panel-title"><div><h3>Recent issues</h3><p>The latest work across this team.</p></div><button className="primary" onClick={() => { showSection('Issues'); setShowIssueForm(true); }}>New issue</button></div>{overview?.recent_issues?.length ? <div className="issue-list">{overview.recent_issues.map((issue) => <button key={issue.key} className="issue-row" onClick={() => openIssue(issues.find((item) => item.key === issue.key) || { ...issue, workspace_id: workspaceId })}><span className="issue-key">{issue.key}</span><strong>{issue.title}</strong><StateBadge name={issue.workflow_state} /></button>)}</div> : <div className="inline-empty">No issues yet. Create the first item for this team.</div>}</div>
      </section>
    );

    if (section === 'Members') {
      const canManageTeam = ['owner', 'admin'].includes(selectedWorkspace.my_role) || selectedTeam.my_role === 'lead';
      const teamMemberIds = new Set(members.map((member) => member.user_id));
      const teamCandidates = workspaceMembers.filter((member) => member.status === 'active' && !teamMemberIds.has(member.user_id));
      return (
        <section className="team-members-page">
          <article className="settings-card"><div className="settings-card-heading"><div><span className="eyebrow">{selectedTeam.issue_prefix} TEAM</span><h3>{selectedTeam.name} members</h3><p>Add people who already belong to {selectedWorkspace.name}. This only changes access to this Team.</p></div><span className="count-badge">{members.length}</span></div>{canManageTeam && <form className="team-member-add" onSubmit={addTeamMember}><label>Workspace member<select name="user_id" defaultValue="" required><option value="" disabled>Select a member</option>{teamCandidates.map((member) => <option key={member.user_id} value={member.user_id}>{member.name} · {member.email}</option>)}</select></label><label>Team role<select name="role" defaultValue="member"><option value="member">Member</option><option value="lead">Lead</option></select></label><button className="primary" disabled={busy || !teamCandidates.length}>Add to Team</button></form>}<div className="member-settings-list">{members.map((member) => <div key={member.user_id}><span className="avatar small-avatar">{member.name.slice(0, 1).toUpperCase()}</span><div><strong>{member.name}{member.user_id === currentUser.id ? ' (You)' : ''}</strong><small>{member.email}</small></div>{canManageTeam ? <><SegmentedControl ariaLabel={`Team role for ${member.name}`} value={member.role} options={[{ value: 'member', label: 'Member' }, { value: 'lead', label: 'Lead' }]} onChange={(value) => updateTeamMember(member.user_id, value)} disabled={busy} /><button className="danger-text" disabled={busy} onClick={() => removeTeamMember(member)}>Remove</button></> : <span className="role-chip">{member.role}</span>}</div>)}</div></article>
        </section>
      );
    }

    if (section === 'Summary') {
      if (summaryLoading && !summaryData) return <section className="issue-detail-loading"><div className="spinner" />Loading team summary…</section>;
      const data = summaryData;
      const maxTrend = Math.max(1, ...(data?.trend?.buckets || []).flatMap((bucket) => [bucket.created, bucket.completed]));
      const activeSummaryFilters = SUMMARY_FILTER_KEYS.filter((key) => summaryFilters[key]);
      const summaryFilterName = { status: 'Status', priority: 'Priority', project: 'Project', cycle: 'Cycle', assignee: 'Assignee', label: 'Label', due: 'Due', ownership: 'Ownership', date_from: 'From', date_to: 'Through', include_archived: 'Archive' };
      const summaryFilterValue = (key, value) => {
        if (key === 'priority') return ['No priority', 'Low', 'Medium', 'High', 'Urgent'][Number(value)] || value;
        if (key === 'project') return value === 'none' ? 'No project' : projects.find((item) => item.id === value)?.name || value;
        if (key === 'cycle') return value === 'none' ? 'No cycle' : cycles.find((item) => item.id === value)?.name || value;
        if (key === 'assignee') return value === 'unassigned' ? 'Unassigned' : members.find((item) => String(item.user_id) === value)?.name || value;
        if (key === 'label') return labels.find((item) => item.id === value)?.name || value;
        if (key === 'include_archived') return 'Included';
        return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      };
      return (
        <section className="summary-page">
          <div className="summary-filter-shell">
            <div className="summary-toolbar">
              <div><strong>Team Summary</strong><span>Health, workload, and momentum for {selectedTeam.name}.</span></div>
              <div className="summary-toolbar-actions"><button className="secondary save-view-trigger" onClick={() => { setShowViewForm(true); showSection('Views'); }}>Save as view</button><button className={`summary-filter-trigger ${summaryFiltersOpen ? 'active' : ''}`} aria-expanded={summaryFiltersOpen} onClick={() => setSummaryFiltersOpen((open) => !open)}><span className="filter-glyph">≡</span> Filter{activeSummaryFilters.length > 0 && <b>{activeSummaryFilters.length}</b>}<span className="filter-chevron">⌄</span></button></div>
            </div>
            {activeSummaryFilters.length > 0 && <div className="summary-filter-chips"><span>Filtered by</span>{activeSummaryFilters.map((key) => <button key={key} onClick={() => applySummaryFilters({ [key]: '' })}><small>{summaryFilterName[key]}</small>{summaryFilterValue(key, summaryFilters[key])}<b>×</b></button>)}<button className="clear-filter-chips" onClick={resetSummaryFilters}>Clear all</button></div>}
            {summaryFiltersOpen && <div className="summary-filter-popover">
              <div className="summary-filter-heading"><div><strong>Filter summary</strong><span>Results update as you choose.</span></div><button aria-label="Close filters" onClick={() => setSummaryFiltersOpen(false)}>×</button></div>
              <div className="summary-filters">
                <ChoicePicker label="Status" value={summaryFilters.status} options={[{ value: '', label: 'All statuses' }, ...['backlog', 'todo', 'in_progress', 'done', 'canceled'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))]} onChange={(value) => applySummaryFilters({ status: value })} />
                <ChoicePicker label="Priority" value={summaryFilters.priority} options={[{ value: '', label: 'All priorities' }, ...['No priority', 'Low', 'Medium', 'High', 'Urgent'].map((label, value) => ({ value, label }))]} onChange={(value) => applySummaryFilters({ priority: String(value) })} />
                <ChoicePicker label="Project" value={summaryFilters.project} options={[{ value: '', label: 'All projects' }, { value: 'none', label: 'No project' }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} onChange={(value) => applySummaryFilters({ project: value })} />
                <ChoicePicker label="Cycle" value={summaryFilters.cycle} options={[{ value: '', label: 'All cycles' }, { value: 'none', label: 'No cycle' }, ...cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))]} onChange={(value) => applySummaryFilters({ cycle: value })} />
                <ChoicePicker label="Assignee" value={summaryFilters.assignee} options={[{ value: '', label: 'All assignees' }, { value: 'unassigned', label: 'Unassigned' }, ...members.map((member) => ({ value: String(member.user_id), label: member.name }))]} onChange={(value) => applySummaryFilters({ assignee: value })} />
                <ChoicePicker label="Label" value={summaryFilters.label} options={[{ value: '', label: 'All labels' }, ...labels.map((label) => ({ value: label.id, label: label.name }))]} onChange={(value) => applySummaryFilters({ label: value })} />
                <ChoicePicker label="Due" value={summaryFilters.due} options={[{ value: '', label: 'Any due date' }, { value: 'overdue', label: 'Overdue' }, { value: 'due_soon', label: 'Due soon' }, { value: 'not_due', label: 'Not due' }, { value: 'no_due_date', label: 'No due date' }]} onChange={(value) => applySummaryFilters({ due: value })} />
                <ChoicePicker label="Ownership" value={summaryFilters.ownership} options={[{ value: '', label: 'All team issues' }, { value: 'mine', label: 'My issues' }, { value: 'unassigned', label: 'Unassigned' }]} onChange={(value) => applySummaryFilters({ ownership: value })} />
                <label>Created from<input type="date" value={summaryFilters.date_from} onChange={(event) => applySummaryFilters({ date_from: event.target.value })} /></label>
                <label>Created through<input type="date" value={summaryFilters.date_to} onChange={(event) => applySummaryFilters({ date_to: event.target.value })} /></label>
                <div className="choice-field"><span>Archive</span><SegmentedControl ariaLabel="Archive visibility" value={summaryFilters.include_archived} options={[{ value: '', label: 'Active' }, { value: 'true', label: 'Include archived' }]} onChange={(value) => applySummaryFilters({ include_archived: value })} /></div>
              </div>
              <div className="summary-filter-footer"><button className="tertiary" onClick={resetSummaryFilters} disabled={!activeSummaryFilters.length}>Clear all</button><button className="primary" onClick={() => setSummaryFiltersOpen(false)}>Done</button></div>
            </div>}
          </div>
          {!data ? <div className="empty-panel">Summary is unavailable.</div> : <>
            <div className="summary-metrics">{Object.entries({ total: 'Matching', open: 'Open', in_progress: 'In progress', completed: 'Completed', overdue: 'Overdue', unassigned: 'Unassigned' }).map(([key, label]) => <Metric key={key} label={label} value={data.headline_metrics[key]} />)}</div>
            <div className="summary-grid">
              <StatusComposition rows={data.status_distribution} onSelect={(row) => applySummaryFilters({ status: row.category })} />
              <PriorityComposition rows={data.priority_distribution} onSelect={(row) => applySummaryFilters({ priority: String(row.priority) })} />
              <WorkloadRanking rows={data.assignee_distribution} onSelect={(row) => applySummaryFilters({ assignee: row.user_id == null ? 'unassigned' : String(row.user_id) })} />
              <ProjectProgress rows={data.project_distribution} onSelect={(row) => applySummaryFilters({ project: row.project_id || 'none' })} />
            </div>
            <div className="summary-progress-grid">
              <CycleProgressRing data={data.cycle_progress} />
              <TrendLines trend={data.trend} maxValue={maxTrend} />
            </div>
            <section className="summary-card"><div className="summary-card-heading"><div><h2>Attention</h2><p>Bounded queues for work that may need action.</p></div></div><div className="attention-grid">{Object.entries(data.attention_issues).map(([kind, rows]) => <div className="attention-column" key={kind}><h3>{kind.replaceAll('_', ' ')}</h3>{rows.map((issue) => <button key={issue.id} onClick={() => openIssue(issue)}><span>{issue.key}</span><strong>{issue.title}</strong></button>)}{!rows.length && <p>Nothing here.</p>}</div>)}</div></section>
            <div className="summary-bottom-grid">
              <section className="summary-card"><div className="summary-card-heading"><div><h2>Matching issues</h2><p>Click chart segments to drill into this result.</p></div><span>{data.matching_issues.length}</span></div><div className="summary-issue-list">{data.matching_issues.map((issue) => <button className="issue-row" key={issue.id} onClick={() => openIssue(issue)}><span className="issue-key">{issue.key}</span><strong>{issue.title}</strong><StateBadge name={issue.status} /></button>)}{!data.matching_issues.length && <div className="summary-empty">No issues match these filters.</div>}</div></section>
              <section className="summary-card"><div className="summary-card-heading"><div><h2>Recent activity</h2><p>Latest activity inside the filtered issue set.</p></div></div><div className="summary-activity">{data.recent_activity.map((item) => <button key={`${item.kind}-${item.id}`} onClick={() => openIssue({ key: item.issue_key, workspace_id: workspaceId })}><span>{item.issue_key}</span><strong>{item.actor_name || 'System'}</strong><p>{item.event_type.replaceAll('.', ' ')}</p><time>{formatDateTime(item.created_at)}</time></button>)}{!data.recent_activity.length && <div className="summary-empty">No recent activity.</div>}</div></section>
            </div>
          </>}
        </section>
      );
    }

    if (section === 'Issues' && issueRoute) {
      if (issueLoading && !selectedIssue) return <section className="issue-detail-loading"><div className="spinner" />Loading issue…</section>;
      if (!selectedIssue) return null;
      const selectedLabelIds = (selectedIssue.labels || []).map((label) => label.id);
      return (
        <section className="issue-detail-page">
          <div className="issue-detail-topbar">
            <button className="back-button" onClick={closeIssue}>← Issues</button>
            <div className="issue-detail-crumb"><span className="team-icon">{selectedTeam.issue_prefix.slice(0, 1)}</span><span>{selectedIssue.key}</span></div>
            <span className="version-chip">v{selectedIssue.version}</span>
          </div>
          <div className="issue-detail-grid">
            <div className="issue-detail-main">
              <form className="issue-copy-card" onSubmit={saveIssueBody}>
                <input className="issue-title-input" aria-label="Issue title" value={issueDraft.title} onChange={(event) => setIssueDraft({ ...issueDraft, title: event.target.value })} required />
                <textarea className="issue-description-input" aria-label="Issue description" placeholder="Add a clear description, context, acceptance criteria, or links…" value={issueDraft.description} onChange={(event) => setIssueDraft({ ...issueDraft, description: event.target.value })} />
                <div className="copy-actions"><span>Created {formatDateTime(selectedIssue.created_at)}</span><button className="secondary" disabled={busy || !issueDraft.title.trim()}>Save description</button></div>
              </form>

              <section className="development-card">
                <div className="development-heading"><div><span className="eyebrow">DEVELOPMENT</span><h2>Pull requests</h2><p>GitHub PRs link automatically when their title contains <strong>{selectedIssue.key}</strong>.</p></div><span>{issuePullRequests.length}</span></div>
                <div className="pull-request-list">{issuePullRequests.map((pullRequest) => <a key={pullRequest.id} href={pullRequest.html_url} target="_blank" rel="noreferrer"><span className={`pr-state ${pullRequest.state}`}>{pullRequest.is_draft ? 'draft' : pullRequest.state}</span><div><strong>{pullRequest.title}</strong><small>{pullRequest.github_repo_full_name} #{pullRequest.pr_number}</small></div><span className="external-arrow">↗</span></a>)}{!issuePullRequests.length && <div className="development-empty"><span>↗</span><div><strong>No linked pull requests</strong><p>Add {selectedIssue.key} to a PR title. No repository mapping is required.</p></div></div>}</div>
              </section>

              <section className="activity-card">
                <div className="activity-heading"><div><h2>Activity</h2><p>Comments and changes are recorded chronologically.</p></div><span>{issueActivity.filter((item) => item.event_type !== 'comment.created').length}</span></div>
                <form className="comment-composer" onSubmit={addComment}>
                  <span className="avatar small-avatar">{currentUser.name.slice(0, 1).toUpperCase()}</span>
                  <div className="comment-entry"><div className="mention-composer"><textarea ref={commentInputRef} placeholder="Leave a comment… Type @ to mention someone." value={commentBody} onChange={updateCommentBody} onKeyDown={handleMentionKeyDown} aria-autocomplete="list" aria-expanded={mentionMenu.open} />{mentionMenu.open && <div className="mention-menu" role="listbox">{mentionCandidates().map((member, index) => <button type="button" role="option" aria-selected={index === mentionMenu.active} className={index === mentionMenu.active ? 'active' : ''} key={member.user_id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectMention(member)}><span className="avatar small-avatar">{member.name.slice(0, 1).toUpperCase()}</span><span><strong>{member.name}{member.user_id === currentUser.id ? ' (You)' : ''}</strong><small>{member.email}</small></span></button>)}{!mentionCandidates().length && <div className="mention-empty">No matching team members</div>}</div>}</div><small className="mention-help">Use @ to notify a teammate or remind yourself.</small></div>
                  <button className="primary" disabled={busy || !commentBody.trim()}>Comment</button>
                </form>
                <div className="activity-list">
                  {issueActivity.filter((item) => item.event_type !== 'comment.created').map((item) => <ActivityItem key={`${item.kind}-${item.id}`} item={item} currentUser={currentUser} onUpdate={updateComment} onDelete={deleteComment} />)}
                  {!issueActivity.length && <div className="inline-empty">No activity yet.</div>}
                </div>
              </section>
            </div>

            <aside className="issue-properties-card">
              <section className="collaboration-panel">
                <div className="collaboration-heading"><div><h2>Collaboration</h2><span>{issueCollaboration.watchers.length} watching</span></div><button className={issueCollaboration.watching ? 'watching' : ''} onClick={toggleWatch} disabled={busy}>{issueCollaboration.watching ? 'Watching' : 'Watch'}</button></div>
                <div className="watcher-row">{issueCollaboration.watchers.map((watcher) => <span key={watcher.user_id} title={`${watcher.name} · ${watcher.reason}`}>{watcher.name.slice(0, 1).toUpperCase()}</span>)}{!issueCollaboration.watchers.length && <small>No watchers yet.</small>}</div>
                <div className="sub-issues"><h3>Sub-issues <span>{issueCollaboration.sub_issues.length}</span></h3>{issueCollaboration.sub_issues.map((issue) => <button key={issue.id} onClick={() => openIssue(issue)}><span>{issue.key}</span><strong>{issue.title}</strong></button>)}<form onSubmit={createSubIssue}><input placeholder="Add a sub-issue…" value={subIssueTitle} onChange={(event) => setSubIssueTitle(event.target.value)} /><button disabled={busy || !subIssueTitle.trim()}>+</button></form></div>
                <div className="issue-relations"><div className="relation-heading"><h3>Relationships <span>{issueRelations.length}</span></h3><small>Dependencies and contextual links</small></div><div className="relation-list">{issueRelations.map((relation) => <div key={relation.id} className={relation.type_key === 'blocked_by' ? `dependency-${relation.direction}` : ''}><span>{relation.label}</span><button type="button" onClick={() => openIssue(relation.related_issue)}><strong>{relation.related_issue.key}</strong>{relation.related_issue.title}</button><button type="button" className="relation-remove" aria-label={`Remove relation to ${relation.related_issue.key}`} onClick={() => deleteIssueRelation(relation.id)} disabled={busy}>×</button></div>)}{!issueRelations.length && <p>No relationships yet.</p>}</div><form className="relation-form" onSubmit={createIssueRelation}><ChoicePicker label="Relationship" value={`${relationForm.relation_type_id}|${relationForm.direction}`} options={relationDirectionOptions(relationTypes)} onChange={(value) => { const [relation_type_id, direction] = value.split('|'); setRelationForm({ ...relationForm, relation_type_id, direction }); }} disabled={busy} /><label>Issue key<input list="relation-issue-options" placeholder="e.g. CORE-12" value={relationForm.target_issue_key} onChange={(event) => setRelationForm({ ...relationForm, target_issue_key: event.target.value.toUpperCase() })} /></label><datalist id="relation-issue-options">{issues.filter((issue) => issue.id !== selectedIssue.id).map((issue) => <option key={issue.id} value={issue.key}>{issue.title}</option>)}</datalist><button className="secondary" disabled={busy || !relationForm.relation_type_id || !relationForm.target_issue_key}>Add relationship</button></form></div>
              </section>
              <div className="properties-heading"><h2>Properties</h2><span>Changes save immediately</span></div>
              <ChoicePicker label="Status" value={selectedIssue.workflow_state_id} options={workflowStates.map((state) => ({ value: state.id, label: state.name }))} onChange={(value) => updateIssue({ workflow_state_id: value })} disabled={busy} />
              <ChoicePicker label="Priority" value={selectedIssue.priority} options={['No priority', 'Low', 'Medium', 'High', 'Urgent'].map((label, value) => ({ value, label }))} onChange={(value) => updateIssue({ priority: Number(value) })} disabled={busy} />
              <ChoicePicker label="Assignee" value={selectedIssue.assignee_user_id || ''} options={[{ value: '', label: 'Unassigned' }, ...members.map((member) => ({ value: member.user_id, label: member.name }))]} onChange={(value) => updateIssue({ assignee_user_id: value ? Number(value) : null })} disabled={busy} />
              <ChoicePicker label="Cycle" value={selectedIssue.cycle_id || ''} options={[{ value: '', label: 'No cycle' }, ...cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))]} onChange={(value) => updateIssue({ cycle_id: value || null })} disabled={busy} />
              <ChoicePicker label="Project" value={selectedIssue.project_id || ''} options={[{ value: '', label: 'No project' }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} onChange={(value) => updateIssue({ project_id: value || null, milestone_id: null })} disabled={busy} />
              <ChoicePicker label="Milestone" value={selectedIssue.milestone_id || ''} options={[{ value: '', label: 'No milestone' }, ...(projects.find((project) => project.id === selectedIssue.project_id)?.milestones || []).map((milestone) => ({ value: milestone.id, label: milestone.name }))]} onChange={(value) => updateIssue({ milestone_id: value || null })} disabled={busy || !selectedIssue.project_id} />
              <label>Due date<input type="date" value={selectedIssue.due_date || ''} onChange={(event) => updateIssue({ due_date: event.target.value || null })} disabled={busy} /></label>
              <fieldset className="label-fieldset"><legend>Labels</legend><div className="label-options">{labels.map((label) => <label className="label-option" key={label.id}><input type="checkbox" checked={selectedLabelIds.includes(label.id)} onChange={() => updateIssue({ label_ids: selectedLabelIds.includes(label.id) ? selectedLabelIds.filter((id) => id !== label.id) : [...selectedLabelIds, label.id] })} disabled={busy} /><span className="label-swatch" style={{ '--label-color': label.color }} />{label.name}</label>)}{!labels.length && <span className="muted">No team labels yet.</span>}</div></fieldset>
              <dl className="issue-metadata"><div><dt>Created by</dt><dd>{memberName(members, selectedIssue.creator_user_id)}</dd></div><div><dt>Updated</dt><dd>{formatDateTime(selectedIssue.updated_at)}</dd></div><div><dt>Issue ID</dt><dd>{selectedIssue.key}</dd></div></dl>
            </aside>
          </div>
        </section>
      );
    }

    if (section === 'Issues') return (
      <section className="planning-list-page">
        <div className="toolbar"><div><strong>{issues.length} issues</strong><span>Plan and track team work</span></div><button className="primary" onClick={() => setShowIssueForm(!showIssueForm)}>+ New issue</button></div>
        {showIssueForm && <form className="editor-card" onSubmit={createIssue}><div className="form-grid"><label className="wide">Title<input autoFocus value={issueForm.title} onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })} required /></label><label className="wide">Description<textarea value={issueForm.description} onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })} /></label><label>Status<select value={issueForm.workflow_state_id} onChange={(e) => setIssueForm({ ...issueForm, workflow_state_id: e.target.value })}><option value="">Default</option>{workflowStates.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select></label><label>Priority<select value={issueForm.priority} onChange={(e) => setIssueForm({ ...issueForm, priority: e.target.value })}>{['No priority', 'Low', 'Medium', 'High', 'Urgent'].map((name, value) => <option key={name} value={value}>{name}</option>)}</select></label><label>Cycle<select value={issueForm.cycle_id} onChange={(e) => setIssueForm({ ...issueForm, cycle_id: e.target.value })}><option value="">No cycle</option>{cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></label><label>Project<select value={issueForm.project_id} onChange={(e) => setIssueForm({ ...issueForm, project_id: e.target.value, milestone_id: '' })}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label>Milestone<select value={issueForm.milestone_id} onChange={(e) => setIssueForm({ ...issueForm, milestone_id: e.target.value })} disabled={!issueForm.project_id}><option value="">No milestone</option>{projects.find((project) => project.id === issueForm.project_id)?.milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.name}</option>)}</select></label><label>Assignee<select value={issueForm.assignee_user_id} onChange={(e) => setIssueForm({ ...issueForm, assignee_user_id: e.target.value })}><option value="">Unassigned</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}</select></label><label>Due date<input type="date" value={issueForm.due_date} onChange={(e) => setIssueForm({ ...issueForm, due_date: e.target.value })} /></label><label className="wide">Labels<select multiple value={issueForm.label_ids} onChange={(e) => setIssueForm({ ...issueForm, label_ids: [...e.target.selectedOptions].map((option) => option.value) })}>{labels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}</select></label></div><div className="form-actions"><button type="button" className="secondary" onClick={() => setShowIssueForm(false)}>Cancel</button><button className="primary" disabled={busy}>Create issue</button></div></form>}
        <div className="issue-board">{workflowStates.map((state) => <div className="state-group" key={state.id}><div className="state-heading"><StateBadge name={state.name} /><span>{issues.filter((issue) => issue.workflow_state_id === state.id).length}</span></div>{issues.filter((issue) => issue.workflow_state_id === state.id).map((issue) => <IssueListRow key={issue.id} issue={issue} issues={issues} workflowStates={workflowStates} relations={issueRelationSummaries.filter((relation) => relation.issue_key === issue.key)} onOpen={openIssue} />)}</div>)}</div>
        <div className="settings-grid"><form className="mini-card" onSubmit={createLabel}><h3>Create label</h3><div className="inline-fields"><input placeholder="Label name" value={labelForm.name} onChange={(e) => setLabelForm({ ...labelForm, name: e.target.value })} required /><input className="color-input" type="color" value={labelForm.color} onChange={(e) => setLabelForm({ ...labelForm, color: e.target.value })} /><button className="secondary">Add</button></div></form><div className="mini-card"><h3>Team labels</h3><div className="label-row">{labels.map((label) => <span className="label-pill" key={label.id} style={{ '--label-color': label.color }}>{label.name}</span>)}{!labels.length && <span className="muted">No labels</span>}</div></div></div>
      </section>
    );

    if (section === 'My Issues') return (
      <section className="personal-list-page"><div className="toolbar"><div><strong>My Issues</strong><span>Assigned to you across accessible teams in this workspace.</span></div><span className="count-badge">{myIssues.length}</span></div><div className="personal-list">{myIssues.map((issue) => <button className="issue-row" key={issue.id} onClick={() => openIssue(issue)}><span className="issue-key">{issue.key}</span><strong>{issue.title}</strong><StateBadge name={issue.workflow_state_name} /></button>)}{!myIssues.length && <div className="empty-panel">Nothing is assigned to you.</div>}</div></section>
    );

    if (section === 'Views') {
      const selectedView = savedViews.find((view) => view.id === selectedViewId);
      const filterName = { status: 'Status', priority: 'Priority', project: 'Project', cycle: 'Cycle', assignee: 'Assignee', label: 'Label', due: 'Due', ownership: 'Ownership', date_from: 'From', date_to: 'Through', include_archived: 'Archive' };
      const filterValue = (key, value) => {
        if (key === 'priority') return ['No priority', 'Low', 'Medium', 'High', 'Urgent'][Number(value)] || value;
        if (key === 'project') return value === 'none' ? 'No project' : projects.find((item) => item.id === value)?.name || value;
        if (key === 'cycle') return value === 'none' ? 'No cycle' : cycles.find((item) => item.id === value)?.name || value;
        if (key === 'assignee') return value === 'unassigned' ? 'Unassigned' : members.find((item) => String(item.user_id) === String(value))?.name || value;
        if (key === 'label') return labels.find((item) => item.id === value)?.name || value;
        if (key === 'include_archived') return 'Included';
        return String(value).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      };
      const viewFilters = (view) => Object.entries(view?.filter_spec || {}).filter(([key, value]) => key !== 'timezone' && value !== '');
      const currentFilters = Object.entries(summaryFilters).filter(([, value]) => value !== '');
      return (
        <section className="views-page">
          <div className="toolbar views-toolbar"><div><strong>Saved Views</strong><span>Reusable live queries over the latest issues in this workspace.</span></div><button className="primary" onClick={() => setShowViewForm((open) => !open)}>{showViewForm ? 'Cancel' : '+ New view'}</button></div>
          {showViewForm && <form className="saved-view-create" onSubmit={createSavedView}><div><span className="eyebrow">CURRENT SUMMARY FILTERS</span><h2>Save this issue view</h2><p>The view stays live—future issue changes automatically appear in its results.</p><div className="view-filter-chips">{currentFilters.map(([key, value]) => <span key={key}><small>{filterName[key] || key}</small>{filterValue(key, value)}</span>)}{!currentFilters.length && <span className="all-issues-chip">All team issues</span>}</div></div><div className="saved-view-fields"><label>Name<input autoFocus value={viewForm.name} onChange={(event) => setViewForm({ ...viewForm, name: event.target.value })} placeholder="e.g. My active work" required /></label><label>Visibility<select value={viewForm.visibility} onChange={(event) => setViewForm({ ...viewForm, visibility: event.target.value })}><option value="private">Private</option><option value="team">Team</option><option value="workspace">Workspace</option></select></label><button className="primary" disabled={busy}>Save view</button></div></form>}
          <div className="view-workbench">
            <aside className="saved-view-list"><div className="view-list-heading"><strong>Your views</strong><span>{savedViews.length}</span></div>{savedViews.map((view) => { const filters = viewFilters(view); return <article className={view.id === selectedViewId ? 'selected' : ''} key={view.id}><button className="saved-view-main" onClick={() => runSavedView(view)}><span className="view-icon">V</span><div><strong>{view.name}</strong><small>{view.visibility} · {view.team_id === teamId ? selectedTeam.name : 'Another team'}</small><div className="view-card-filters">{filters.slice(0, 2).map(([key, value]) => <span key={key}>{filterName[key] || key}: {filterValue(key, value)}</span>)}{!filters.length && <span>All team issues</span>}{filters.length > 2 && <span>+{filters.length - 2}</span>}</div></div></button></article>; })}{!savedViews.length && <div className="view-list-empty"><span className="view-icon">V</span><strong>No saved views yet</strong><p>Set filters in Summary, then save them for quick access.</p></div>}</aside>
            <section className="view-detail">{selectedView ? <><header><div><span className="eyebrow">SAVED VIEW</span><h2>{selectedView.name}</h2><p>{selectedView.visibility} · {selectedView.team_id === teamId ? selectedTeam.name : 'Another team'}</p></div>{selectedView.owner_user_id === currentUser.id && <button className="danger-text" onClick={() => deleteSavedView(selectedView.id)}>Delete view</button>}</header><div className="view-query-summary"><strong>Filters</strong><div className="view-filter-chips">{viewFilters(selectedView).map(([key, value]) => <span key={key}><small>{filterName[key] || key}</small>{filterValue(key, value)}</span>)}{!viewFilters(selectedView).length && <span className="all-issues-chip">All team issues</span>}</div></div><div className="view-results-heading"><div><strong>Matching issues</strong><span>Live results using the saved filters.</span></div>{viewIssues && <b>{viewIssues.length}</b>}</div>{viewLoading || viewIssues === null ? <div className="view-loading"><div className="spinner" />Running saved view…</div> : viewIssues.length ? <div className="view-result-list">{viewIssues.map((issue) => <button className="issue-row" key={issue.id} onClick={() => openIssue(issue)}><span className="issue-key">{issue.key}</span><strong>{issue.title}</strong><StateBadge name={issue.status} /></button>)}</div> : <div className="view-zero-state"><span>0</span><strong>No issues match this view</strong><p>The view is working, but its saved filters currently return no issues.</p></div>}</> : <div className="view-detail-empty"><span className="view-icon large">V</span><h2>Select a saved view</h2><p>Its filters and current issue results will appear here.</p></div>}</section>
          </div>
        </section>
      );
    }

    if (section === 'Inbox') return (
      <section className="inbox-page"><div className="toolbar"><div><strong>Inbox</strong><span>Mentions and activity from issues you can still access.</span></div><span className="unread-badge">{inbox.unread_count} unread</span></div><div className="inbox-list">{inbox.notifications.map((notification) => <button key={notification.id} className={notification.read_at ? 'read' : 'unread'} onClick={() => markNotificationRead(notification)}><span className="notification-dot" /><div><strong>{notification.payload?.issue_key || 'CommonPlan'} · {notification.kind.replaceAll('_', ' ')}</strong><p>{notification.kind === 'self_mention' ? 'You left yourself a reminder on this issue.' : notification.kind === 'comment' ? 'A teammate mentioned you or commented on a watched issue.' : 'Activity occurred on an issue you watch.'}</p><time>{formatDateTime(notification.created_at)}</time></div></button>)}{!inbox.notifications.length && <div className="empty-panel">Your inbox is clear.</div>}</div></section>
    );

    if (section === 'Settings') {
      const canManageWorkspace = ['owner', 'admin'].includes(selectedWorkspace.my_role);
      const workspaceOwnerCount = workspaceMembers.filter((member) => member.role === 'owner' && member.status === 'active').length;
      return (
      <section className="workspace-settings-page">
        <div className="settings-title"><div><span className="eyebrow">SETTINGS</span><h2>{settingsTab === 'profile' ? 'Your profile' : settingsTab === 'workspace' ? 'Workspace profile' : settingsTab === 'members' ? 'Members' : settingsTab === 'relations' ? 'Issue relationships' : 'Applications'}</h2><p>Personal settings belong to you; workspace settings apply to everyone in {selectedWorkspace.name}.</p></div></div>
        <div className="settings-layout"><nav className="settings-nav"><span>Personal</span><button className={settingsTab === 'profile' ? 'selected' : ''} onClick={() => setSettingsTab('profile')}>Profile</button><button disabled title="Managed by the Auth Service">Security & access</button><button disabled title="Managed by the Auth Service">Connected accounts</button><span>Workspace</span><button className={settingsTab === 'workspace' ? 'selected' : ''} onClick={() => setSettingsTab('workspace')}>General</button><button className={settingsTab === 'members' ? 'selected' : ''} onClick={() => setSettingsTab('members')}>Members</button><button className={settingsTab === 'relations' ? 'selected' : ''} onClick={() => setSettingsTab('relations')}>Issue relationships</button><button className={settingsTab === 'applications' ? 'selected' : ''} onClick={() => setSettingsTab('applications')}>Applications</button></nav><div className="settings-content">
        {settingsTab === 'profile' && <form className="settings-card" onSubmit={saveProfile}><h3>Profile</h3><p>This information follows your account across workspaces.</p><label>Display name<input value={profileDraft.name} onChange={(event) => setProfileDraft({ name: event.target.value })} required /></label><label>Email<input value={currentUser.email} disabled /></label><div className="form-actions"><button className="primary" disabled={busy}>Save profile</button></div></form>}
        {settingsTab === 'workspace' && <form className="settings-card" onSubmit={saveWorkspace}><h3>Workspace profile</h3><p>Only workspace owners and admins can change shared details and access policy.</p><label>Name<input value={workspaceDraft.name} onChange={(event) => setWorkspaceDraft({ ...workspaceDraft, name: event.target.value })} required /></label><label>Description<textarea value={workspaceDraft.description} onChange={(event) => setWorkspaceDraft({ ...workspaceDraft, description: event.target.value })} /></label><label>Default timezone<input value={workspacePolicy.default_timezone} onChange={(event) => setWorkspacePolicy({ ...workspacePolicy, default_timezone: event.target.value })} placeholder="UTC" /></label><label>Domain policy<select value={workspacePolicy.domain_policy} onChange={(event) => setWorkspacePolicy({ ...workspacePolicy, domain_policy: event.target.value })}><option value="invite_only">Invite only</option><option value="verified_domains">Verified domains</option></select></label><label className="settings-checkbox"><input type="checkbox" checked={workspacePolicy.allow_member_invites} onChange={(event) => setWorkspacePolicy({ ...workspacePolicy, allow_member_invites: event.target.checked })} />Allow members to invite teammates</label><div className="form-actions"><button className="primary" disabled={busy || selectedWorkspace.my_role === 'member'}>Save workspace</button></div></form>}
        {settingsTab === 'members' && <article className="settings-card"><div className="settings-card-heading"><div><h3>Workspace members</h3><p>Workspace membership is managed here. Removing a member also removes their Team memberships.</p></div><span className="count-badge">{workspaceMembers.length}</span></div>{canManageWorkspace && <form className="member-invite-form workspace-only" onSubmit={inviteWorkspaceMember}><label>Email<input type="email" value={invitationForm.email} onChange={(event) => setInvitationForm({ ...invitationForm, email: event.target.value })} placeholder="teammate@example.com" required /></label><label>Workspace role<select value={invitationForm.role} onChange={(event) => setInvitationForm({ ...invitationForm, role: event.target.value })}><option value="member">Member</option><option value="admin">Admin</option></select></label><button className="primary" disabled={busy}>Create invite</button></form>}{invitationUrl && <div className="invitation-result"><div><strong>Invitation link</strong><small>It is email-bound and expires in seven days.</small></div><code>{invitationUrl}</code><button className="secondary" onClick={() => navigator.clipboard.writeText(invitationUrl)}>Copy</button></div>}<div className="member-settings-list">{workspaceMembers.map((member) => { const lastOwner = member.role === 'owner' && workspaceOwnerCount === 1; return <div key={member.user_id}><span className="avatar small-avatar">{member.name.slice(0, 1).toUpperCase()}</span><div><strong>{member.name}{member.user_id === currentUser.id ? ' (You)' : ''}</strong><small>{member.email}</small></div>{canManageWorkspace ? <><select aria-label={`Workspace role for ${member.name}`} value={member.role} disabled={busy || lastOwner} onChange={(event) => updateWorkspaceMember(member.user_id, event.target.value)}><option value="member">Member</option><option value="admin">Admin</option><option value="owner">Owner</option></select><button className="danger-text" disabled={busy || lastOwner} title={lastOwner ? 'A workspace must keep an owner' : ''} onClick={() => removeWorkspaceMember(member)}>Remove</button></> : <span className="role-chip">{member.role}</span>}</div>; })}</div></article>}
        {settingsTab === 'relations' && <article className="settings-card relation-settings"><div className="settings-card-heading"><div><h3>Relationship types</h3><p>Define the vocabulary people use to connect issues. System types remain available to every team.</p></div><span className="count-badge">{relationTypes.length}</span></div><div className="relation-type-list">{relationTypes.map((type) => <div key={type.id}><div><strong>{type.forward_label}</strong><span>⇄</span><strong>{type.inverse_label}</strong></div><small>{type.key} · {type.category}{type.symmetric ? ' · symmetric' : ''}{type.allow_cycles ? '' : ' · cycle-safe'}</small><span className={type.is_system ? 'system-chip' : 'custom-chip'}>{type.is_system ? 'System' : 'Custom'}</span></div>)}</div>{canManageWorkspace && <form className="relation-type-form" onSubmit={createRelationType}><h4>Create a relationship type</h4><div className="form-grid"><label>Key<input placeholder="duplicates" pattern="[a-z][a-z0-9_]+" value={relationTypeForm.key} onChange={(event) => setRelationTypeForm({ ...relationTypeForm, key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} required /></label><label>Category<select value={relationTypeForm.category} onChange={(event) => setRelationTypeForm({ ...relationTypeForm, category: event.target.value, allow_cycles: event.target.value !== 'dependency' })}><option value="custom">Custom</option><option value="dependency">Dependency</option></select></label><label>Forward label<input placeholder="duplicates" value={relationTypeForm.forward_label} onChange={(event) => setRelationTypeForm({ ...relationTypeForm, forward_label: event.target.value, inverse_label: relationTypeForm.symmetric ? event.target.value : relationTypeForm.inverse_label })} required /></label><label>Inverse label<input placeholder="is duplicated by" value={relationTypeForm.inverse_label} onChange={(event) => setRelationTypeForm({ ...relationTypeForm, inverse_label: event.target.value })} disabled={relationTypeForm.symmetric} required /></label></div><div className="relation-type-options"><label className="settings-checkbox"><input type="checkbox" checked={relationTypeForm.symmetric} onChange={(event) => setRelationTypeForm({ ...relationTypeForm, symmetric: event.target.checked, inverse_label: event.target.checked ? relationTypeForm.forward_label : relationTypeForm.inverse_label })} />Same label in both directions</label><label className="settings-checkbox"><input type="checkbox" checked={relationTypeForm.allow_cycles} onChange={(event) => setRelationTypeForm({ ...relationTypeForm, allow_cycles: event.target.checked })} />Allow circular relationships</label></div><button className="primary" disabled={busy}>Create type</button></form>}</article>}
        {settingsTab === 'applications' && <article className="integration-card">
          <header><div className="github-mark">GH</div><div><h3>GitHub</h3><p>Automatically link pull requests to CommonPlan issues by item key.</p></div>{githubHealthLoading ? <span className="integration-status checking">Checking…</span> : <span className={`integration-status ${githubHealth?.configured ? 'connected' : 'setup'}`}>{githubHealth?.configured ? 'Connected' : 'Setup required'}</span>}</header>
          {githubHealth?.forbidden ? <div className="integration-permission"><strong>Workspace admin access required</strong><p>{githubHealth.message}</p></div> : <>
            <div className="integration-facts"><div><span>GitHub owner</span><strong>{githubHealth?.owner_login || 'Not configured'}</strong></div><div><span>Subscribed event</span><strong>Pull requests</strong></div><div><span>Last delivery</span><strong>{githubHealth?.last_delivery ? formatDateTime(githubHealth.last_delivery.received_at) : 'No delivery yet'}</strong></div><div><span>Last result</span><strong className={githubHealth?.last_delivery?.status || ''}>{githubHealth?.last_delivery?.status || 'Waiting'}</strong></div></div>
            <div className="integration-rule"><span>LINKING RULE</span><p>A PR title containing any issue key in this workspace, such as <code>TA-12 Improve saved views</code>, links to that issue. Repository-to-project mapping is intentionally not used.</p></div>
            <div className="webhook-setup"><div><h4>Local webhook setup</h4><p>GitHub cannot send directly to localhost. Use a public forwarding URL during development and keep its forwarding daemon running.</p></div><ol><li>Create a smee.io channel and use its HTTPS URL as GitHub’s payload URL.</li><li>Choose <strong>application/json</strong>, add a high-entropy secret, and select only <strong>Pull requests</strong>.</li><li>Run <code>smee --url YOUR_SMEE_URL --target {API_BASE_URL}/webhooks/github</code>.</li><li>Put the same secret and allowed owner/workspace IDs in the API environment, restart, then redeliver GitHub’s ping.</li></ol><div className="webhook-endpoint"><span>Local target</span><code>{API_BASE_URL}/webhooks/github</code></div></div>
          </>}
          <footer><a href="https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/testing-webhooks" target="_blank" rel="noreferrer">GitHub local testing guide ↗</a><button className="secondary" onClick={loadGitHubHealth} disabled={githubHealthLoading}>Refresh status</button></footer>
        </article>}
        </div></div>
      </section>
      );
    }

    if (section === 'Projects' && selectedProject) {
      const objectives = selectedProject.objectives.filter((item) => item.kind === 'objective');
      const criteria = selectedProject.objectives.filter((item) => item.kind === 'success_criterion');
      return (
        <section className="project-detail-page">
          <div className="project-detail-topbar"><button className="back-button" onClick={() => setSelectedProject(null)}>← Projects</button><div className="project-progress-copy"><strong>{selectedProject.progress_percent}%</strong><span>{selectedProject.completed_issue_count} of {selectedProject.issue_count} issues complete</span></div></div>
          <div className="project-progress"><span style={{ width: `${selectedProject.progress_percent}%` }} /></div>
          <div className="project-detail-grid">
            <div className="project-detail-main">
              <form className="project-brief-card" onSubmit={saveProject}>
                <div className="project-kicker">Project brief</div>
                <input className="project-title-input" value={projectDraft.name} onChange={(event) => setProjectDraft({ ...projectDraft, name: event.target.value })} required />
                <input className="project-summary-input" placeholder="One-line summary" value={projectDraft.summary} onChange={(event) => setProjectDraft({ ...projectDraft, summary: event.target.value })} />
                <textarea className="project-description-input" placeholder="Describe the context, scope, decisions, and links this project needs…" value={projectDraft.description} onChange={(event) => setProjectDraft({ ...projectDraft, description: event.target.value })} />
                <div className="form-actions"><button className="secondary" disabled={busy}>Save brief</button></div>
              </form>
              <section className="project-section-card"><div className="project-section-heading"><div><h2>Objectives & success</h2><p>Make the intended outcome and definition of success explicit.</p></div></div><div className="objective-columns"><ObjectiveList title="Objectives" items={objectives} onToggle={toggleObjective} /><ObjectiveList title="Success criteria" items={criteria} onToggle={toggleObjective} /></div><form className="inline-create-form" onSubmit={addObjective}><select value={objectiveForm.kind} onChange={(event) => setObjectiveForm({ ...objectiveForm, kind: event.target.value })}><option value="objective">Objective</option><option value="success_criterion">Success criterion</option></select><input placeholder="Add an outcome…" value={objectiveForm.body} onChange={(event) => setObjectiveForm({ ...objectiveForm, body: event.target.value })} required /><button className="secondary" disabled={busy}>Add</button></form></section>
              <section className="project-section-card"><div className="project-section-heading"><div><h2>Linked issues</h2><p>Progress is derived from workflow states—never edited by hand.</p></div><span>{selectedProject.issue_count}</span></div><div className="project-issue-list">{selectedProject.linked_issues.map((issue) => <button className="issue-row" key={issue.id} onClick={() => openIssue(issue)}><span className="issue-key">{issue.key}</span><strong>{issue.title}</strong><StateBadge name={issue.workflow_state_name} /></button>)}{!selectedProject.linked_issues.length && <div className="inline-empty">Link issues from the issue detail properties or when creating an issue.</div>}</div></section>
              <section className="project-section-card"><div className="project-section-heading"><div><h2>Project updates</h2><p>Share concise health and delivery context with the team.</p></div></div><form className="project-update-form" onSubmit={addProjectUpdate}><textarea placeholder="What changed since the last update?" value={projectUpdateForm.body} onChange={(event) => setProjectUpdateForm({ ...projectUpdateForm, body: event.target.value })} required /><div><select value={projectUpdateForm.health} onChange={(event) => setProjectUpdateForm({ ...projectUpdateForm, health: event.target.value })}><option value="on_track">On track</option><option value="at_risk">At risk</option><option value="off_track">Off track</option></select><button className="primary" disabled={busy}>Post update</button></div></form><div className="project-update-list">{selectedProject.updates.map((update) => <article key={update.id}><div><span className={`health-dot ${update.health || ''}`} /><strong>{healthLabel(update.health)}</strong><time>{formatDateTime(update.created_at)}</time></div><p>{update.body}</p><small>{update.author_name || 'Former member'}</small></article>)}{!selectedProject.updates.length && <div className="inline-empty">No project updates yet.</div>}</div></section>
            </div>
            <aside className="project-sidebar">
              <div className="properties-heading"><h2>Project properties</h2><span>Saved with the project brief</span></div>
              <div className="choice-field"><span>Status</span><SegmentedControl ariaLabel="Project status" value={projectDraft.status} options={['planned', 'in_progress', 'paused', 'completed', 'canceled'].map((value) => ({ value, label: value.replaceAll('_', ' ') }))} onChange={(value) => setProjectDraft({ ...projectDraft, status: value })} /></div>
              <ChoicePicker label="Lead" value={projectDraft.lead_user_id} options={[{ value: '', label: 'No lead' }, ...members.map((member) => ({ value: member.user_id, label: member.name }))]} onChange={(value) => setProjectDraft({ ...projectDraft, lead_user_id: value })} />
              <label>Target date<input type="date" value={projectDraft.target_date} onChange={(event) => setProjectDraft({ ...projectDraft, target_date: event.target.value })} /></label>
              <div className="project-sidebar-heading"><h3>Milestones</h3><span>{selectedProject.milestones.length}</span></div>
              <div className="milestone-list">{selectedProject.milestones.map((milestone) => <article key={milestone.id}><div><span className={`milestone-status ${milestone.status}`} /><strong>{milestone.name}</strong></div><p>{milestone.description || 'No description'}</p><small>{milestone.completed_issue_count}/{milestone.issue_count} issues · {milestone.target_date || 'No date'}</small></article>)}</div>
              <form className="milestone-form" onSubmit={addMilestone}><input placeholder="Milestone name" value={milestoneForm.name} onChange={(event) => setMilestoneForm({ ...milestoneForm, name: event.target.value })} required /><textarea placeholder="Description" value={milestoneForm.description} onChange={(event) => setMilestoneForm({ ...milestoneForm, description: event.target.value })} /><input type="date" value={milestoneForm.target_date} onChange={(event) => setMilestoneForm({ ...milestoneForm, target_date: event.target.value })} /><button className="secondary" disabled={busy}>Add milestone</button></form>
            </aside>
          </div>
        </section>
      );
    }

    if (section === 'Projects') return (
      <section className="project-list-page">
        <div className="toolbar"><div><strong>{projects.length} projects</strong><span>Outcome-oriented work owned by {selectedTeam.name}</span></div><button className="primary" onClick={() => setShowProjectForm(!showProjectForm)}>+ New project</button></div>
        {showProjectForm && <form className="editor-card" onSubmit={createProject}><div className="form-grid"><label>Name<input autoFocus value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} required /></label><label>Status<select value={projectForm.status} onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value })}><option value="planned">Planned</option><option value="in_progress">In progress</option></select></label><label className="wide">Summary<input value={projectForm.summary} onChange={(event) => setProjectForm({ ...projectForm, summary: event.target.value })} /></label><label className="wide">Description<textarea value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} /></label><label>Lead<select value={projectForm.lead_user_id} onChange={(event) => setProjectForm({ ...projectForm, lead_user_id: event.target.value })}><option value="">No lead</option>{members.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}</select></label><label>Target date<input type="date" value={projectForm.target_date} onChange={(event) => setProjectForm({ ...projectForm, target_date: event.target.value })} /></label></div><div className="form-actions"><button type="button" className="secondary" onClick={() => setShowProjectForm(false)}>Cancel</button><button className="primary" disabled={busy}>Create project</button></div></form>}
        <div className="project-grid">{projects.map((project) => <button className="project-card" key={project.id} onClick={() => openProject(project)}><div className="project-card-top"><span className={`project-status ${project.status}`} /> <span>{project.status.replaceAll('_', ' ')}</span><strong>{project.progress_percent}%</strong></div><h2>{project.name}</h2><p>{project.summary || 'Add a short project summary.'}</p><div className="project-progress"><span style={{ width: `${project.progress_percent}%` }} /></div><div className="project-card-meta"><span>{project.issue_count} issues</span><span>{project.milestones.length} milestones</span><span>{project.target_date || 'No target date'}</span></div></button>)}{!projects.length && <div className="empty-panel project-empty"><div className="section-icon">P</div><h3>No projects yet</h3><p>Create a project to connect a brief, milestones, updates, and issues.</p></div>}</div>
      </section>
    );

    if (section === 'Cycles' && selectedCycle) {
      const cycleIssues = issues.filter((issue) => issue.cycle_id === selectedCycle.id);
      const doneStateIds = new Set(workflowStates.filter((state) => state.category === 'done').map((state) => state.id));
      const completed = cycleIssues.filter((issue) => doneStateIds.has(issue.workflow_state_id)).length;
      const percent = cycleIssues.length ? Math.round(completed * 100 / cycleIssues.length) : 0;
      return (
        <section className="cycle-board-page">
          <div className="cycle-board-toolbar"><button className="back-button" onClick={() => setSelectedCycle(null)}>← All cycles</button><div><span className="eyebrow">SPRINT BOARD</span><h2>{selectedCycle.name}</h2><p>{new Date(`${selectedCycle.starts_on}T00:00:00`).toLocaleDateString()} — {new Date(`${selectedCycle.ends_on}T00:00:00`).toLocaleDateString()}</p></div><div className="cycle-board-progress"><strong>{percent}%</strong><span>{completed}/{cycleIssues.length} completed</span><i><span style={{ width: `${percent}%` }} /></i></div></div>
          <div className="cycle-kanban">{workflowStates.map((state) => { const stateIssues = cycleIssues.filter((issue) => issue.workflow_state_id === state.id); return <section className={`kanban-column category-${state.category}`} key={state.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const issue = cycleIssues.find((row) => row.id === event.dataTransfer.getData('text/plain')); if (issue) moveCycleIssue(issue, state.id); }}><header><div><StateBadge name={state.name} /><span>{stateIssues.length}</span></div><button aria-label={`Create issue in ${state.name}`} onClick={() => createIssueInCycleState(state.id)}>+</button></header><div className="kanban-cards">{stateIssues.map((issue) => <article className="kanban-card" key={issue.id} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', issue.id)} onClick={() => openIssue(issue)} tabIndex="0" role="button"><div><span className="priority-dot" data-priority={issue.priority} /><span className="issue-key">{issue.key}</span><DependencyBadges relations={issueRelationSummaries.filter((relation) => relation.issue_key === issue.key)} /></div><h3>{issue.title}</h3><footer><span>{issue.assignee_user_id ? memberName(members, issue.assignee_user_id) : 'Unassigned'}</span>{issue.due_date && <time>{issue.due_date}</time>}</footer></article>)}{!stateIssues.length && <div className="kanban-empty">Drop issues here</div>}</div></section>; })}</div>
        </section>
      );
    }

    if (section === 'Cycles') {
      const canManageCycles = ['owner', 'admin'].includes(selectedWorkspace.my_role) || selectedTeam.my_role === 'lead';
      return (
        <section className="cycle-page"><div className="cycle-grid">{cycles.map((cycle) => { const cycleIssues = issues.filter((issue) => issue.cycle_id === cycle.id); const completed = cycleIssues.filter((issue) => workflowStates.find((state) => state.id === issue.workflow_state_id)?.category === 'done').length; const percent = cycleIssues.length ? Math.round(completed * 100 / cycleIssues.length) : 0; return <button type="button" className="cycle-card" key={cycle.id} onClick={() => openCycle(cycle)}><div className="cycle-card-top"><div className="cycle-icon">◒</div><span>{cycle.completed_at ? 'Completed' : new Date(`${cycle.starts_on}T00:00:00`) > new Date() ? 'Upcoming' : 'Active'}</span></div><h3>{cycle.name}</h3><p>{new Date(`${cycle.starts_on}T00:00:00`).toLocaleDateString()} — {new Date(`${cycle.ends_on}T00:00:00`).toLocaleDateString()}</p><div className="project-progress"><span style={{ width: `${percent}%` }} /></div><small>{completed}/{cycleIssues.length} completed</small><span className="cycle-card-action">Open board →</span></button>; })}{!cycles.length && <div className="empty-panel cycle-empty"><div className="section-icon">C</div><h3>No cycles yet</h3><p>Enable the repeating schedule to create this Team's sprint cadence.</p></div>}</div><div className="cycle-settings-stack"><form className="editor-card cycle-form" onSubmit={saveCycleSettings}><div className="cycle-settings-heading"><div><span className="eyebrow">TEAM SETTINGS</span><h2>Cycle schedule</h2></div><label className="toggle-field"><input type="checkbox" checked={cycleSettings.enabled} onChange={(event) => setCycleSettings({ ...cycleSettings, enabled: event.target.checked })} /><span>Enabled</span></label></div><p>Automatically maintain a rolling set of upcoming cycles.</p><div className="choice-field"><span>Each cycle lasts</span><SegmentedControl ariaLabel="Cycle duration" value={cycleSettings.duration_weeks} options={[1, 2, 3, 4, 6, 8].map((weeks) => ({ value: weeks, label: `${weeks}w` }))} onChange={(value) => setCycleSettings({ ...cycleSettings, duration_weeks: value })} /></div><div className="choice-field"><span>Keep upcoming</span><SegmentedControl ariaLabel="Upcoming cycle count" value={cycleSettings.upcoming_cycle_count} options={[1, 2, 3, 4, 5, 6, 8, 10, 15].map((count) => ({ value: count, label: String(count) }))} onChange={(value) => setCycleSettings({ ...cycleSettings, upcoming_cycle_count: value })} /></div><label>Schedule starts<input type="date" value={cycleSettings.next_cycle_starts_on} onChange={(event) => setCycleSettings({ ...cycleSettings, next_cycle_starts_on: event.target.value })} required={cycleSettings.enabled} /></label><label className="settings-checkbox"><input type="checkbox" checked={cycleSettings.rollover_incomplete} onChange={(event) => setCycleSettings({ ...cycleSettings, rollover_incomplete: event.target.checked })} />Move unfinished issues into the next cycle</label><button className="primary" disabled={busy || !canManageCycles}>Save schedule</button></form>{canManageCycles && <details className="manual-cycle"><summary>Create or adjust a one-off cycle</summary><form className="editor-card cycle-form" onSubmit={createCycle}><label>Name<input value={cycleForm.name} onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })} required /></label><div className="two-columns"><label>Starts on<input type="date" value={cycleForm.starts_on} onChange={(e) => setCycleForm({ ...cycleForm, starts_on: e.target.value })} required /></label><label>Ends on<input type="date" value={cycleForm.ends_on} onChange={(e) => setCycleForm({ ...cycleForm, ends_on: e.target.value })} required /></label></div><button className="secondary" disabled={busy}>Create cycle</button></form></details>}</div></section>
      );
    }

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
            onSelect={(id) => { window.history.pushState({}, '', '/'); setSummaryRoute(null); setWorkspaceId(id); setTeamId(''); setSection('Overview'); setWorkspaceMenuOpen(false); }}
            onCreate={() => { setShowWorkspaceForm(true); setWorkspaceMenuOpen(false); }}
          />
          <button className="icon-button" title="New workspace" aria-label="New workspace" onClick={() => setShowWorkspaceForm(!showWorkspaceForm)}><Icon name="plus" /></button>
        </div>
        {showWorkspaceForm && <form className="compact-form" onSubmit={createWorkspace}><input placeholder="Workspace name" value={workspaceForm.name} onChange={(e) => setWorkspaceForm({ ...workspaceForm, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} required /><input placeholder="workspace-slug" value={workspaceForm.slug} onChange={(e) => setWorkspaceForm({ ...workspaceForm, slug: e.target.value })} required /><button className="primary" disabled={busy}>Create</button></form>}
        <nav className="workspace-nav">{workspaceNavItems.map((item) => <button key={item.name} className={section === item.name ? 'selected' : ''} onClick={() => showSection(item.name)}><Icon name={item.icon} /><span>{item.name}</span>{item.name === 'Inbox' && inbox.unread_count > 0 && <b>{inbox.unread_count}</b>}</button>)}</nav>
        <div className="sidebar-heading"><span>Teams</span>{selectedWorkspace?.my_role !== 'member' && <button className="icon-button compact" aria-label="New team" onClick={() => setShowTeamForm(!showTeamForm)}><Icon name="plus" /></button>}</div>
        {showTeamForm && <form className="compact-form" onSubmit={createTeam}><input placeholder="Team name" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} required /><input placeholder="KEY" maxLength="12" value={teamForm.issue_prefix} onChange={(e) => setTeamForm({ ...teamForm, issue_prefix: e.target.value.toUpperCase() })} required /><button className="primary" disabled={busy}>Create team</button></form>}
        <nav className="team-list">
          {teams.map((team) => <div key={team.id} className={`team-block ${team.id === teamId ? 'active' : ''}`}><button className="team-name" onClick={() => { if (issueRoute) closeIssue(); if (summaryRoute) { window.history.pushState({}, '', '/'); setSummaryRoute(null); } setTeamId(team.id); setSection('Overview'); }}><span className="team-icon">{team.issue_prefix.slice(0, 1)}</span><span>{team.name}</span><Icon name="chevron" /></button>{team.id === teamId && <div className="team-subnav">{navItems.map((item) => <button key={item.name} className={section === item.name && (!issueRoute || item.name === 'Issues') ? 'selected' : ''} onClick={() => showSection(item.name)}><Icon name={item.icon} /><span>{item.name}</span></button>)}</div>}</div>)}
          {!teams.length && <p className="sidebar-empty">No teams yet</p>}
        </nav>
        <div className="profile"><div className="avatar">{currentUser.name.slice(0, 1).toUpperCase()}</div><div><strong>{currentUser.name}</strong><span>{currentUser.email}</span></div><button className="profile-action" title="Log out" aria-label="Log out" onClick={logout}><Icon name="logout" /></button></div>
      </aside>
      <main className="content">
        {!selectedWorkspace ? <EmptyState title="Create your first workspace" body="A workspace contains your teams and shared product work." action={() => setShowWorkspaceForm(true)} /> : !selectedTeam && !workspaceSections.has(section) ? <EmptyState title="Create your first team" body="Teams own issue keys, cycles, projects, and workflow." action={() => setShowTeamForm(true)} /> : <>
          <header className="page-header"><div><div className="breadcrumbs">{selectedWorkspace.name}{!workspaceSections.has(section) && selectedTeam ? ` / ${selectedTeam.name}` : ''}{selectedIssue && issueRoute ? ` / ${selectedIssue.key}` : selectedProject ? ` / ${selectedProject.name}` : selectedCycle ? ` / ${selectedCycle.name}` : ''}</div><h1>{selectedIssue && issueRoute ? 'Issue detail' : selectedProject ? 'Project detail' : selectedCycle ? 'Cycle board' : section}</h1></div><span className="role-chip">{workspaceSections.has(section) ? selectedWorkspace.my_role : selectedTeam?.my_role}</span></header>
          {planningContent()}
        </>}
        {status && <div className="toast"><span className="toast-dot" />{status}</div>}
      </main>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));
}

function memberName(members, userId) {
  return members.find((member) => member.user_id === userId)?.name || 'Former member';
}

function IssueListRow({ issue, issues, workflowStates, relations = [], onOpen }) {
  const parent = issue.parent_issue_id ? issues.find((candidate) => candidate.id === issue.parent_issue_id) : null;
  const children = issues.filter((candidate) => candidate.parent_issue_id === issue.id);
  const completed = children.filter((child) => workflowStates.find((state) => state.id === child.workflow_state_id)?.category === 'done').length;
  return <button className={`issue-row ${parent ? 'sub-issue-row' : ''}`} onClick={() => onOpen(issue)}><span className="priority-dot" data-priority={issue.priority} /><span className="issue-key">{issue.key}</span><strong>{issue.title}</strong>{parent && <span className="parent-context">↳ {parent.key}</span>}{children.length > 0 && <span className="sub-issue-progress">{completed}/{children.length} sub-issues</span>}<DependencyBadges relations={relations} /><span className="row-meta">{issue.labels.map((label) => label.name).join(', ')}</span></button>;
}

function relationDirectionOptions(types) {
  return types.flatMap((type) => {
    const forward = { value: `${type.id}|outgoing`, label: type.forward_label };
    if (type.symmetric || type.forward_label === type.inverse_label) return [forward];
    return [forward, { value: `${type.id}|incoming`, label: type.inverse_label }];
  });
}

function DependencyBadges({ relations }) {
  const dependencies = relations.filter((relation) => relation.category === 'dependency');
  if (!dependencies.length) return null;
  const blockedBy = dependencies.filter((relation) => relation.type_key === 'blocked_by' && relation.direction === 'outgoing');
  const blocking = dependencies.filter((relation) => relation.type_key === 'blocked_by' && relation.direction === 'incoming');
  const other = dependencies.filter((relation) => relation.type_key !== 'blocked_by');
  return <span className="dependency-badges" aria-label="Issue dependencies">{blockedBy.length > 0 && <span className="dependency-indicator blocked" title={blockedBy.map((relation) => `${relation.label} ${relation.related_issue_key}`).join('\n')} aria-label={blockedBy.map((relation) => `${relation.label} ${relation.related_issue_key}`).join(', ')}>⊣<small>{blockedBy.length}</small></span>}{blocking.length > 0 && <span className="dependency-indicator blocking" title={blocking.map((relation) => `${relation.label} ${relation.related_issue_key}`).join('\n')} aria-label={blocking.map((relation) => `${relation.label} ${relation.related_issue_key}`).join(', ')}>⊢<small>{blocking.length}</small></span>}{other.length > 0 && <span className="dependency-indicator dependency" title={other.map((relation) => `${relation.label} ${relation.related_issue_key}`).join('\n')} aria-label={other.map((relation) => `${relation.label} ${relation.related_issue_key}`).join(', ')}>⇢<small>{other.length}</small></span>}</span>;
}

function projectToDraft(project) {
  return {
    name: project.name,
    summary: project.summary || '',
    description: project.description || '',
    status: project.status,
    lead_user_id: project.lead_user_id || '',
    target_date: project.target_date || '',
  };
}

function summarySearchParams(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== '') params.set(key, value); });
  const query = params.toString();
  return query ? `?${query}` : '';
}

function healthLabel(value) {
  return ({ on_track: 'On track', at_risk: 'At risk', off_track: 'Off track' })[value] || 'No health set';
}

function ObjectiveList({ title, items, onToggle }) {
  return <div className="objective-list"><h3>{title}</h3>{items.map((item) => <button type="button" key={item.id} className={item.is_met ? 'complete' : ''} onClick={() => onToggle(item)}><span>{item.is_met ? '✓' : ''}</span><strong>{item.body}</strong></button>)}{!items.length && <p>No items yet.</p>}</div>;
}

function StatusComposition({ rows, onSelect }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return <section className="summary-card composition-card"><div className="summary-card-heading"><div><h2>Workflow composition</h2><p>How matching work is distributed by status.</p></div><span>{total}</span></div>{total ? <><div className="composition-strip" aria-label={`Workflow composition, ${total} issues`}>{rows.filter((row) => row.count).map((row) => <button key={row.category} className={`composition-${row.category}`} style={{ width: `${row.count / total * 100}%` }} title={`${row.label}: ${row.count} (${Math.round(row.count / total * 100)}%)`} aria-label={`${row.label}: ${row.count} issues, ${Math.round(row.count / total * 100)} percent`} onClick={() => onSelect(row)} />)}</div><div className="composition-legend">{rows.map((row) => <button key={row.category} onClick={() => onSelect(row)}><i className={`composition-${row.category}`} /><span>{row.label}</span><strong>{row.count}</strong><small>{total ? Math.round(row.count / total * 100) : 0}%</small></button>)}</div></> : <div className="summary-empty">No matching work.</div>}</section>;
}

function PriorityComposition({ rows, onSelect }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return <section className="summary-card priority-card"><div className="summary-card-heading"><div><h2>Priority mix</h2><p>Counts and share, without implying a time axis.</p></div><span>{total}</span></div><div className="priority-tiles">{rows.map((row) => <button key={row.priority} className={`priority-${row.priority}`} onClick={() => onSelect(row)}><span className="priority-mark">{row.priority === 0 ? '—' : '!'.repeat(row.priority)}</span><strong>{row.count}</strong><small>{row.label} · {total ? Math.round(row.count / total * 100) : 0}%</small></button>)}</div></section>;
}

function WorkloadRanking({ rows, onSelect }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <section className="summary-card workload-card"><div className="summary-card-heading"><div><h2>Open workload</h2><p>Ranked comparison is where length works best.</p></div><span>{rows.reduce((sum, row) => sum + row.count, 0)}</span></div><div className="workload-list">{rows.map((row) => <button key={row.user_id ?? 'unassigned'} onClick={() => onSelect(row)}><span className="workload-avatar">{row.name.slice(0, 1).toUpperCase()}</span><strong>{row.name}</strong><i><span style={{ width: `${row.count / max * 100}%` }} /></i><b>{row.count}</b></button>)}{!rows.length && <div className="summary-empty">No open assigned work.</div>}</div></section>;
}

function ProjectProgress({ rows, onSelect }) {
  return <section className="summary-card project-progress-card"><div className="summary-card-heading"><div><h2>Project delivery</h2><p>Completion against each project's active scope.</p></div><span>{rows.length}</span></div><div className="project-progress-list">{rows.map((row) => <button key={row.project_id || 'none'} onClick={() => onSelect(row)}><div><strong>{row.name}</strong><span>{row.completed}/{row.total}</span></div><i><span style={{ width: `${row.percent}%` }} /></i><b>{row.percent}%</b></button>)}{!rows.length && <div className="summary-empty">No matching projects.</div>}</div></section>;
}

function CycleProgressRing({ data }) {
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - (data?.percent || 0) / 100);
  return <section className="summary-card cycle-summary"><div className="summary-card-heading"><div><h2>Cycle progress</h2><p>Completed versus remaining scope.</p></div></div>{data ? <div className="cycle-ring-layout"><div className="cycle-ring"><svg viewBox="0 0 112 112" role="img" aria-label={`${data.percent}% complete`}><circle className="ring-track" cx="56" cy="56" r={radius} /><circle className="ring-value" cx="56" cy="56" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} /><text x="56" y="53">{data.percent}%</text><text className="ring-caption" x="56" y="69">complete</text></svg></div><div><strong>{data.name}</strong><span>{data.completed} completed</span><span>{Math.max(0, data.total - data.completed)} remaining</span><small>{data.total} scoped issues</small></div></div> : <div className="summary-empty">No current or selected cycle.</div>}</section>;
}

function TrendLines({ trend, maxValue }) {
  const width = 680;
  const height = 190;
  const left = 34;
  const right = 16;
  const top = 18;
  const bottom = 30;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const x = (index) => left + (trend.buckets.length <= 1 ? chartWidth / 2 : index / (trend.buckets.length - 1) * chartWidth);
  const y = (value) => top + (1 - value / Math.max(1, maxValue)) * chartHeight;
  const points = (key) => trend.buckets.map((bucket, index) => `${x(index)},${y(bucket[key])}`).join(' ');
  const createdTotal = trend.buckets.reduce((sum, bucket) => sum + bucket.created, 0);
  const completedTotal = trend.buckets.reduce((sum, bucket) => sum + bucket.completed, 0);
  const labelIndexes = [...new Set([0, Math.floor((trend.buckets.length - 1) / 2), trend.buckets.length - 1])].filter((index) => index >= 0);
  return <section className="summary-card trend-card"><div className="summary-card-heading"><div><h2>Flow over time</h2><p>{trend.from} — {trend.to}</p></div><div className="trend-total"><span><i className="created" />Created <b>{createdTotal}</b></span><span><i className="completed" />Completed <b>{completedTotal}</b></span></div></div>{trend.buckets.length ? <div className="trend-line-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Created and completed issue trend from ${trend.from} through ${trend.to}`} preserveAspectRatio="none"><title>Created and completed issues by day</title>{[0, .5, 1].map((ratio) => <g key={ratio}><line className="trend-gridline" x1={left} x2={width - right} y1={top + ratio * chartHeight} y2={top + ratio * chartHeight} /><text className="trend-axis-value" x={left - 8} y={top + ratio * chartHeight + 3}>{Math.round(maxValue * (1 - ratio))}</text></g>)}<polyline className="trend-line created" points={points('created')} /><polyline className="trend-line completed" points={points('completed')} strokeDasharray="5 4" />{trend.buckets.map((bucket, index) => <g key={bucket.date}><circle className="trend-point created" cx={x(index)} cy={y(bucket.created)} r="3"><title>{bucket.date}: {bucket.created} created</title></circle><circle className="trend-point completed" cx={x(index)} cy={y(bucket.completed)} r="3"><title>{bucket.date}: {bucket.completed} completed</title></circle></g>)}{labelIndexes.map((index) => <text key={index} className="trend-axis-date" x={x(index)} y={height - 7} textAnchor={index === 0 ? 'start' : index === trend.buckets.length - 1 ? 'end' : 'middle'}>{trend.buckets[index].date.slice(5)}</text>)}</svg><ul className="sr-only">{trend.buckets.map((bucket) => <li key={bucket.date}>{bucket.date}: {bucket.created} created, {bucket.completed} completed</li>)}</ul></div> : <div className="summary-empty">No trend data.</div>}</section>;
}

function ActivityItem({ item, currentUser, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.body || '');
  const initial = (item.actor_name || 'S').slice(0, 1).toUpperCase();
  if (item.kind === 'comment') return (
    <article className="activity-item comment-item">
      <span className="avatar small-avatar">{initial}</span>
      <div><div className="activity-byline"><strong>{item.actor_name || 'Former member'}</strong><time>{formatDateTime(item.created_at)}{item.edited_at ? ' · edited' : ''}</time>{item.actor_user_id === currentUser?.id && <span className="comment-actions"><button onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</button><button onClick={() => onDelete(item.id)}>Delete</button></span>}</div>{editing ? <form className="comment-editor" onSubmit={(event) => { event.preventDefault(); onUpdate(item.id, draft); setEditing(false); }}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} /><button className="primary" disabled={!draft.trim()}>Save</button></form> : <p>{item.body}</p>}</div>
    </article>
  );
  const fieldLabels = {
    workflow_state_id: 'status',
    assignee_user_id: 'assignee',
    cycle_id: 'cycle',
    due_date: 'due date',
    label_ids: 'labels',
  };
  const fieldNames = Object.keys(item.changes?.fields || {}).map((field) => fieldLabels[field] || field.replaceAll('_', ' '));
  const message = item.event_type === 'issue.created'
    ? 'created this issue'
    : item.event_type === 'issue.updated'
      ? `updated ${fieldNames.join(', ') || 'the issue'}`
      : item.event_type.replaceAll('.', ' ');
  return (
    <article className="activity-item event-item">
      <span className="event-dot" />
      <div><div className="activity-byline"><strong>{item.actor_name || 'System'}</strong><span>{message}</span><time>{formatDateTime(item.created_at)}</time></div></div>
    </article>
  );
}

function SegmentedControl({ value, options, onChange, ariaLabel, disabled = false }) {
  return <div className="segmented-control" role="group" aria-label={ariaLabel}>{options.map((option) => <button type="button" key={String(option.value)} className={String(option.value) === String(value) ? 'selected' : ''} aria-pressed={String(option.value) === String(value)} disabled={disabled} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

function ChoicePicker({ label, value, options, onChange, disabled = false }) {
  const pickerRef = useRef(null);
  const selected = options.find((option) => String(option.value) === String(value)) || options[0];
  return <div className="choice-field"><span>{label}</span><details ref={pickerRef} className={`choice-picker ${disabled ? 'disabled' : ''}`}><summary aria-label={label}>{selected?.label || '—'}</summary><div className="choice-picker-menu">{options.map((option) => <button type="button" key={String(option.value)} className={String(option.value) === String(value) ? 'selected' : ''} onClick={() => { onChange(option.value); if (pickerRef.current) pickerRef.current.open = false; }}>{option.label}</button>)}</div></details></div>;
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
    summary: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="M2 19h22" /></>,
    issues: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5M12 16h.01" /></>,
    cycles: <><path d="M20 11a8 8 0 0 0-14.9-4M4 5v4h4" /><path d="M4 13a8 8 0 0 0 14.9 4M20 19v-4h-4" /></>,
    projects: <><path d="M4 7h6l2 2h8v10H4z" /><path d="M4 7V5h6l2 2" /></>,
    members: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M14 15c3.5 0 6 1.5 6 5" /></>,
    views: <><path d="M4 5h16v14H4z" /><path d="M9 5v14M9 10h11" /></>,
    inbox: <><path d="M4 5h16v14H4z" /><path d="m4 14 4-4h8l4 4M9 14h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

createRoot(document.getElementById('root')).render(<App />);
