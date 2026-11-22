// All requests stay on one origin. Vite proxies /api in development; Express serves
// the production build. No cross-site cookies or CSRF-cookie scraping is required.
let csrfToken = '';
async function request(path, { method = 'GET', body, customerToken } = {}) {
  if (method !== 'GET' && !csrfToken) {
    const response = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Unable to get CSRF token.');
    csrfToken = (await response.json()).csrfToken;
  }
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(customerToken ? { 'X-Ticket-Token': customerToken } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}
export const api = {
  me: () => request('/auth/me'),
  demoAgents: () => request('/auth/demo-agents'),
  login: (email) => request('/auth/demo', { method: 'POST', body: { email } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  tickets: (params = {}) => request(`/tickets?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString()}`),
  ticket: (id) => request(`/tickets/${id}`),
  stats: () => request('/tickets/stats/overview'),
  createTicket: (body) => request('/tickets', { method: 'POST', body }),
  claim: (id) => request(`/tickets/${id}/claim`, { method: 'POST' }),
  change: (id, body) => request(`/tickets/${id}`, { method: 'PATCH', body }),
  assign: (id, agentId) => request(`/tickets/${id}/assignment`, { method: 'PATCH', body: { agentId } }),
  message: (id, body, visibility) => request(`/tickets/${id}/messages`, { method: 'POST', body: { body, visibility } }),
  resolve: (id) => request(`/tickets/${id}/resolve`, { method: 'POST' }),
  reopen: (id) => request(`/tickets/${id}/reopen`, { method: 'POST' }),
  agents: () => request('/agents'),
  workload: () => request('/agents/workload'),
  customers: () => request('/customers'),
  holidays: () => request('/holidays'),
  addHoliday: (body) => request('/holidays', { method: 'POST', body }),
  createCustomer: (body) => request('/customers', { method: 'POST', body }),
  customerTicket: (number, token) => request(`/public/tickets/${encodeURIComponent(number)}`, { customerToken: token }),
  customerReply: (number, token, body) => request(`/public/tickets/${encodeURIComponent(number)}/replies`, { method: 'POST', customerToken: token, body: { body } }),
  customerReopen: (number, token) => request(`/public/tickets/${encodeURIComponent(number)}/reopen`, { method: 'POST', customerToken: token })
};
