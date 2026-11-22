import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import './index.css';

const STATUS = { OPEN: 'Open', IN_PROGRESS: 'In progress', WAITING_ON_CUSTOMER: 'Waiting on customer', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const PRIORITY = { URGENT: 'Urgent', MEDIUM: 'Medium', LOW: 'Low' };
const menu = [
  { id: 'all', label: 'All tickets', glyph: '▤' }, { id: 'mine', label: 'My tickets', glyph: '◉' },
  { id: 'unassigned', label: 'Unassigned', glyph: '◎' }, { id: 'waiting', label: 'Waiting on customer', glyph: '◷' },
  { id: 'overdue', label: 'Overdue', glyph: '!' }
];
const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const initials = (s = '?') => s.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
const shortDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '—';
function initialsAvatar(name, index = 0) { return <span className={`avatar avatar-${index % 5}`}>{initials(name)}</span>; }
function StatusPill({ status }) { return <span className={`pill status-${status?.toLowerCase() || 'open'}`}><span className="pill-dot"/>{STATUS[status] || status}</span>; }
function PriorityPill({ priority }) { return <span className={`priority priority-${priority?.toLowerCase()}`}>● {PRIORITY[priority] || priority}</span>; }
function Icon({ children }) { return <span className="icon-box" aria-hidden="true">{children}</span>; }
function BrandMark() { return <span className="brand-mark" aria-hidden="true"><span className="brand-ticket"/></span>; }
function Spinner() { return <span className="spinner" aria-label="Loading"/>; }
function ErrorNotice({ error, onClose }) { return error ? <div className="alert" role="alert"><span>{error}</span><button className="icon-button" onClick={onClose} aria-label="Dismiss">×</button></div> : null; }
function Modal({ title, onClose, children }) { return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="modal"><header className="modal-header"><div><p className="eyebrow">Arvo / WORKSPACE</p><h2>{title}</h2></div><button className="icon-button close" onClick={onClose} aria-label="Close dialog">×</button></header><div className="modal-body">{children}</div></section></div>; }

function Login({ onLogin }) {
  const [agents, setAgents] = useState([]), [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { api.demoAgents().then((d) => { setAgents(d.agents); setEmail(d.agents.find((a) => a.role === 'SUPPORT_LEAD')?.email || d.agents[0]?.email || ''); }).catch((e) => setError(e.message)); }, []);
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { const data = await api.login(email); onLogin(data.user); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return (
    <main className="login-layout">
      <section className="login-card" aria-labelledby="login-heading">
        <BrandMark/>
        <h1 id="login-heading">Sign in to Arvo</h1>
        <p>Select a demo account to explore the support workspace.</p>
        <ErrorNotice error={error} onClose={() => setError('')}/>
        <form onSubmit={submit}>
          <label className="field">
            Demo account
            <select required value={email} onChange={(e) => setEmail(e.target.value)}>
              <option value="">Select an account</option>
              {agents.map((a) => (
                <option key={a.email} value={a.email}>
                  {a.name}{' \u2014 '}{a.role === 'SUPPORT_LEAD' ? 'Support lead' : 'Agent'}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary full" disabled={busy || !email}>{busy ? <Spinner/> : 'Enter workspace'}</button>
        </form>
        <div className="demo-note">Demo login is available for the hiring assessment.</div>
      </section>
    </main>
  );
}

function Sidebar({ user, section, setSection, stats, onLogout, onCreate }) {
  return <aside className="sidebar"><div className="brand"><BrandMark/><div className="brand-title">Arvo<span>SUPPORT HQ</span></div></div><div className="workspace-label">WORKSPACE</div><div className="workspace-card"><div className="workspace-symbol">A</div><div><strong>Arvo Support</strong><small>Support operations</small></div></div><div className="sidebar-label">INBOX</div><nav className="side-nav" aria-label="Primary navigation">{menu.map((item) => <button key={item.id} className={`nav-item ${section === item.id ? 'selected' : ''}`} onClick={() => setSection(item.id)}><Icon>{item.glyph}</Icon><span>{item.label}</span>{item.id === 'overdue' && stats?.overdue > 0 && <strong className="nav-count bad">{stats.overdue}</strong>}{item.id === 'waiting' && stats?.waiting > 0 && <strong className="nav-count">{stats.waiting}</strong>}</button>)}</nav>{user.role === 'SUPPORT_LEAD' && <><div className="sidebar-label">MANAGEMENT</div><nav className="side-nav"><button className={`nav-item ${section === 'team' ? 'selected' : ''}`} onClick={() => setSection('team')}><Icon>♙</Icon>Team workload</button><button className={`nav-item ${section === 'customers' ? 'selected' : ''}`} onClick={() => setSection('customers')}><Icon>♧</Icon>Customers</button><button className={`nav-item ${section === 'holidays' ? 'selected' : ''}`} onClick={() => setSection('holidays')}><Icon>▦</Icon>Holidays</button></nav></>}<div className="sidebar-bottom"><div className="sidebar-callout"><div className="callout-glyph">✦</div><strong>Stay ahead of deadlines</strong><p>SLA clocks automatically pause while waiting for customers.</p><button onClick={onCreate}>+ Create a ticket</button></div><div className="account">{initialsAvatar(user.name, 1)}<span><strong>{user.name}</strong><small>{user.role === 'SUPPORT_LEAD' ? 'Support lead' : 'Support agent'}</small></span><button type="button" className="logout-button" onClick={onLogout}>Log out</button></div></div></aside>;
}

function MetricCards({ stats, onSelect }) {
  const metrics = [
    { label: 'Total tickets', value: stats?.total ?? '—', glyph: '▤', tone: 'indigo', text: 'All conversations', view: 'all' },
    { label: 'In progress', value: stats?.inProgress ?? '—', glyph: '◷', tone: 'sky', text: 'Currently being handled', view: 'all' },
    { label: 'Awaiting customer', value: stats?.waiting ?? '—', glyph: '↗', tone: 'amber', text: 'SLA timer paused', view: 'waiting' },
    { label: 'Overdue', value: stats?.overdue ?? '—', glyph: '!', tone: 'rose', text: 'Needs your attention', view: 'overdue' }
  ];
  return <div className="metrics">{metrics.map((m) => <button className="metric" key={m.label} onClick={() => onSelect(m.view)}><div className="metric-top"><span>{m.label}</span><span className={`metric-icon tone-${m.tone}`}>{m.glyph}</span></div><strong>{m.value}</strong><small>{m.text}</small></button>)}</div>;
}

function TicketList({ tickets, selectedId, onOpen, loading, page, pageCount, onPage }) {
  return <div className="ticket-list" aria-live="polite">{loading && <div className="ticket-loading"><Spinner/> Refreshing tickets</div>}{!tickets.length && !loading ? <div className="empty-state"><div className="empty-illustration">✉</div><strong>No matching tickets</strong><p>Try a different filter, or create a new ticket.</p></div> : tickets.map((t) => <button key={t.id} className={`ticket-row ${selectedId === t.id ? 'active' : ''}`} onClick={() => onOpen(t.id)}><div className="ticket-row-top"><span className="ticket-id">{t.ticketNumber}</span><PriorityPill priority={t.priority}/><span className="ticket-time">{shortDate(t.updatedAt)}</span></div><div className="ticket-subject">{t.title}</div><div className="ticket-customer">{t.customerName} <span>·</span> {t.customerEmail}</div><div className="ticket-row-bottom"><StatusPill status={t.status}/>{t.sla?.paused ? <span className="sla-chip paused">◷ SLA paused</span> : (t.sla?.firstResponseOverdue || t.sla?.resolutionOverdue) ? <span className="sla-chip overdue">● Overdue</span> : <span className="sla-chip good">✓ On track</span>}<span className="ticket-assignee">{t.assignedAgent ? initialsAvatar(t.assignedAgent.name, 2) : <span className="unassigned-icon">–</span>}</span></div></button>)}{pageCount > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => onPage(page-1)}>← Previous</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount} onClick={() => onPage(page+1)}>Next →</button></div>}</div>;
}

function Timeline({ ticket }) {
  const friendly = { TICKET_CREATED: 'Ticket created', TICKET_CLAIMED: 'Ticket claimed', ASSIGNMENT_CHANGED: 'Assignment changed', PRIORITY_CHANGED: 'Priority changed', STATUS_CHANGED: 'Status updated', PUBLIC_REPLY_POSTED: 'Public reply sent', INTERNAL_NOTE_POSTED: 'Internal team note added', CUSTOMER_REPLIED: 'Customer replied', SLA_PAUSED: 'SLA timer paused', SLA_RESUMED: 'SLA timer resumed', TICKET_RESOLVED: 'Ticket resolved', TICKET_REOPENED: 'Ticket reopened', TICKET_AUTO_CLOSED: 'Automatically closed' };
  return <div className="timeline">{(ticket.events || []).length === 0 && <p className="muted">No events recorded.</p>}{[...(ticket.events || [])].reverse().map((event) => <div className="event" key={event.id}><div className="event-marker"/><div className="event-body"><div><strong>{friendly[event.action] || event.action}</strong><time>{fmt(event.occurredAt)}</time></div><p>By {event.actorLabel}</p>{event.action === 'PRIORITY_CHANGED' && <small>{event.details?.from} → {event.details?.to}</small>}</div></div>)}</div>;
}

function TicketDetail({ ticket, user, agents, onAction, busy, onClose, onError }) {
  const [tab, setTab] = useState('conversation');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [drafts, setDrafts] = useState({ PUBLIC: '', INTERNAL: '' });
  const draft = drafts[visibility];
  function setDraft(value) {
    setDrafts((previous) => ({ ...previous, [visibility]: value }));
  }
  const replyField = useRef(null);
  const focusReply = useRef(false);
  const canManage = ticket.assignedAgentId === user.id || user.role === 'SUPPORT_LEAD';
  const active = !['RESOLVED', 'CLOSED'].includes(ticket.status);
  const canReply = canManage && active;
  const replyBlocked = !active
    ? (ticket.canReopen ? 'Reopen this ticket before replying.' : 'This ticket is closed to new replies.')
    : (ticket.assignedAgentId ? 'Only the assigned agent or a support lead can reply.' : 'Claim this ticket to send a reply.');

  useEffect(() => {
    if (tab === 'conversation' && focusReply.current && replyField.current) {
      focusReply.current = false;
      replyField.current.focus();
    }
  }, [tab]);

  function openPublicReply() {
    focusReply.current = true;
    setVisibility('PUBLIC');
    setTab('conversation');
  }

  async function action(method, ...args) { try { await onAction(method, ...args); } catch (err) { onError(err.message); } }
  async function send(e) { e.preventDefault(); if (!canReply || busy || !draft.trim()) return; try { await onAction('message', ticket.id, draft.trim(), visibility); setDraft(''); } catch (err) { onError(err.message); } }
  return <section className="detail"><div className="detail-head"><div><div className="detail-topline"><span className="ticket-id">{ticket.ticketNumber}</span><StatusPill status={ticket.status}/></div><h2>{ticket.title}</h2><p>Opened by {ticket.customerName} · {fmt(ticket.createdAt)}</p></div><div className="detail-head-actions">{tab === 'activity' && canReply && <button type="button" className="btn primary outline" onClick={openPublicReply}>Public reply</button>}<button className="icon-button detail-close" onClick={onClose} title="Close details" aria-label="Close details">×</button></div></div><div className="detail-scroll" role="region" aria-label="Ticket details" tabIndex={0}><div className="detail-quick"><div><span>PRIORITY</span><PriorityPill priority={ticket.priority}/></div><div><span>ASSIGNEE</span><strong>{ticket.assignedAgent?.name || 'Unassigned'}</strong></div><div><span>RESOLUTION DUE</span><strong className={ticket.sla?.resolutionOverdue ? 'text-danger' : ''}>{fmt(ticket.slaResolutionDueAt)}</strong></div></div>{ticket.sla?.paused && <div className="info-banner">◷ Customer waiting period active. The SLA clock is paused until a reply arrives.</div>}{(ticket.sla?.firstResponseOverdue || ticket.sla?.resolutionOverdue) && !ticket.sla?.paused && <div className="warning-banner">● This ticket has breached an SLA deadline.</div>}
  <div className="detail-actions">{!ticket.assignedAgentId && active && <button className="btn primary" disabled={busy} onClick={() => action('claim', ticket.id)}>Claim ticket</button>}{canManage && active && <><label className="inline-select">Status<select disabled={busy} value={ticket.status} onChange={(e) => action('change', ticket.id, { status: e.target.value })}><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="WAITING_ON_CUSTOMER">Waiting on customer</option></select></label><label className="inline-select">Priority<select disabled={busy} value={ticket.priority} onChange={(e) => action('change', ticket.id, { priority: e.target.value })}><option value="URGENT">Urgent</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label><button className="btn primary outline" disabled={busy} onClick={() => action('resolve', ticket.id)}>✓ Resolve</button></>}{canManage && ticket.canReopen && <button disabled={busy} className="btn primary" onClick={() => action('reopen', ticket.id)}>↶ Reopen</button>}{user.role === 'SUPPORT_LEAD' && active && <label className="inline-select">Assign to<select disabled={busy} value={ticket.assignedAgentId || ''} onChange={(e) => action('assign', ticket.id, e.target.value)}><option value="" disabled>Select agent</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}</div><div className="detail-description"><div className="section-caption">ORIGINAL REQUEST</div><p>{ticket.description}</p></div><div className="detail-tabs"><button className={tab === 'conversation' ? 'on' : ''} onClick={() => setTab('conversation')}>Conversation <span>{ticket.messages?.length || 0}</span></button><button className={tab === 'activity' ? 'on' : ''} onClick={() => setTab('activity')}>Activity log <span>{ticket.events?.length || 0}</span></button></div>{tab === 'activity' ? <Timeline ticket={ticket}/> : <div className="conversation">{!ticket.messages?.length && <div className="conversation-empty">No replies yet.</div>}{ticket.messages?.map((msg) => <div className={`message ${msg.visibility === 'INTERNAL' ? 'message-internal' : ''}`} key={msg.id}><div className="message-mark">{initialsAvatar(msg.senderType === 'CUSTOMER' ? ticket.customerName : msg.author?.name || 'System', msg.senderType === 'CUSTOMER' ? 3 : 0)}</div><div className="message-content"><div className="message-meta"><strong>{msg.senderType === 'CUSTOMER' ? ticket.customerName : msg.author?.name || 'System'}</strong>{msg.visibility === 'INTERNAL' && <span className="private-badge">🔒 Internal only</span>}<time>{fmt(msg.createdAt)}</time></div><p>{msg.body}</p></div></div>)}</div>}</div>{tab === 'conversation' && (canReply ? <form className="composer" onSubmit={send}><div className="composer-tabs"><button type="button" aria-pressed={visibility === 'PUBLIC'} className={visibility === 'PUBLIC' ? 'on' : ''} onClick={() => setVisibility('PUBLIC')}>↗ Public reply</button><button type="button" aria-pressed={visibility === 'INTERNAL'} className={visibility === 'INTERNAL' ? 'on internal-on' : ''} onClick={() => setVisibility('INTERNAL')}>▣ Internal note</button></div><textarea ref={replyField} aria-label={visibility === 'PUBLIC' ? 'Public reply to customer' : 'Internal note'} required value={draft} maxLength={15000} onChange={(e) => setDraft(e.target.value)} placeholder={visibility === 'PUBLIC' ? 'Write a response to the customer…' : 'Write a private note visible to your team only…'}/><div className="composer-footer"><span>{visibility === 'INTERNAL' ? '🔒 Never visible in customer portal or public API' : 'Customer-visible reply · Counts as first response'}</span><button className="btn primary" disabled={busy || !draft.trim()}>Send {visibility === 'PUBLIC' ? 'reply' : 'note'} ↗</button></div></form> : <p className="reply-unavailable">{replyBlocked}</p>)}</section>;
}

function NewTicket({ onClose, onCreated, customers }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', customerMode: 'existing', customerId: '', customerName: '', customerEmail: '' });
  const [result, setResult] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  const change = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  async function create(e) { e.preventDefault(); setBusy(true); setError(''); try { const input = { title: form.title, description: form.description, priority: form.priority, ...(form.customerMode === 'existing' ? { customerId: form.customerId } : { customerName: form.customerName, customerEmail: form.customerEmail }) }; const ticket = await api.createTicket(input); setResult(ticket); onCreated(ticket, false); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  const link = result && `${window.location.origin}/#/customer?ticket=${encodeURIComponent(result.ticketNumber)}&token=${encodeURIComponent(result.customerAccessToken)}`;
  return <Modal title={result ? 'Ticket created successfully' : 'Create a new ticket'} onClose={() => { if (result) onCreated(result, true); onClose(); }}><ErrorNotice error={error} onClose={() => setError('')}/>{result ? <div className="success-panel"><div className="success-symbol">✓</div><h3>{result.ticketNumber}</h3><p>The ticket is ready. Send the secure access link to your customer to allow public replies and reopening within the allowed window.</p><label className="field">Customer access link<textarea className="link-field" readOnly value={link} rows="3"/></label><button className="btn primary full" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setError('Unable to copy automatically; select and copy the link above.'); } }}>{copied ? '✓ Copied' : 'Copy customer link'}</button><p className="small-note">This token appears only once. Treat it like a password and deliver it privately.</p></div> : <form onSubmit={create} className="new-ticket-form"><label className="field">Subject<input required maxLength={255} placeholder="Briefly describe the issue" value={form.title} onChange={(e) => change('title', e.target.value)}/></label><label className="field">Description<textarea required rows="4" placeholder="What happened? What help is needed?" value={form.description} onChange={(e) => change('description', e.target.value)}/></label><label className="field">Priority<select value={form.priority} onChange={(e) => change('priority', e.target.value)}><option value="LOW">Low — general question</option><option value="MEDIUM">Medium — reduced function</option><option value="URGENT">Urgent — unable to work</option></select></label><div className="divider-label">CUSTOMER DETAILS</div><div className="radio-line"><label><input type="radio" checked={form.customerMode === 'existing'} onChange={() => change('customerMode', 'existing')}/> Existing customer</label><label><input type="radio" checked={form.customerMode === 'new'} onChange={() => change('customerMode', 'new')}/> Enter manually</label></div>{form.customerMode === 'existing' ? <label className="field">Customer<select required value={form.customerId} onChange={(e) => change('customerId', e.target.value)}><option value="">Select customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.company}</option>)}</select></label> : <div className="form-grid"><label className="field">Name<input required value={form.customerName} onChange={(e) => change('customerName', e.target.value)} placeholder="Full name"/></label><label className="field">Email<input required type="email" value={form.customerEmail} onChange={(e) => change('customerEmail', e.target.value)} placeholder="name@company.com"/></label></div>}<div className="modal-footer"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? <Spinner/> : 'Create ticket'} →</button></div></form>}</Modal>;
}

function TeamPage() { const [items, setItems] = useState([]), [error, setError] = useState(''); useEffect(() => { api.workload().then((d) => setItems(d.workload)).catch((e) => setError(e.message)); }, []); return <section className="management-panel"><div className="panel-heading"><div><h2>Team workload</h2><p>Active ownership and attention-needed tickets across support agents.</p></div></div><ErrorNotice error={error} onClose={() => setError('')}/><div className="table-scroll"><table><thead><tr><th>Agent</th><th>Role</th><th>Active tickets</th><th>Resolved</th><th>Overdue</th></tr></thead><tbody>{items.map((a, i) => <tr key={a.id}><td><div className="table-person">{initialsAvatar(a.name, i)}<strong>{a.name}</strong></div></td><td>{a.role === 'SUPPORT_LEAD' ? 'Lead' : 'Agent'}</td><td>{a.assigned}</td><td>{a.resolved}</td><td><span className={a.overdue ? 'text-danger' : ''}>{a.overdue}</span></td></tr>)}</tbody></table></div></section>; }
function CustomersPage({ customers, refresh }) {
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const removing = dialog && dialog !== 'add';

  function openDialog(next) {
    setError('');
    setDialog(next);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (removing) await api.removeCustomer(dialog.id);
      else {
        await api.createCustomer(form);
        setForm({ name: '', email: '', company: '', phone: '' });
      }
      setDialog(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="management-panel">
      <div className="panel-heading">
        <div><h2>Customer directory</h2><p>Organizations and customer contacts.</p></div>
        <button className="btn primary" onClick={() => openDialog('add')}>+ Add customer</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Customer</th><th>Company</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead>
          <tbody>
            {customers.map((customer, i) => (
              <tr key={customer.id}>
                <td><div className="table-person">{initialsAvatar(customer.name, i)}<strong>{customer.name}</strong></div></td>
                <td>{customer.company}</td><td>{customer.email}</td><td>{customer.phone || '—'}</td>
                <td><button type="button" className="customer-remove" aria-label={`Remove ${customer.name}`} onClick={() => openDialog(customer)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog && (
        <Modal title={removing ? 'Remove customer' : 'Add customer'} onClose={() => { if (!busy) setDialog(null); }}>
          <ErrorNotice error={error} onClose={() => setError('')}/>
          <form onSubmit={submit} className="new-ticket-form">
            {removing ? (
              <>
                <p className="customer-remove-note">Remove <strong>{dialog.name}</strong> from the customer directory? Existing tickets and their activity history stay available.</p>
                <div className="modal-footer">
                  <button type="button" className="btn secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</button>
                  <button className="btn danger" disabled={busy}>Remove customer</button>
                </div>
              </>
            ) : (
              <>
                {['name', 'email', 'company', 'phone'].map((field) => (
                  <label className="field" key={field}>
                    {field[0].toUpperCase() + field.slice(1)}
                    <input required={field !== 'phone'} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'} value={form[field]} onChange={(e) => setForm((previous) => ({ ...previous, [field]: e.target.value }))}/>
                  </label>
                ))}
                <button className="btn primary full" disabled={busy}>Create customer</button>
              </>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}

function HolidayPage() { const [items, setItems] = useState([]), [form, setForm] = useState({ name: '', date: '' }), [error, setError] = useState(''), [busy, setBusy] = useState(false); const refresh = () => api.holidays().then((d) => setItems(d.holidays)).catch((e) => setError(e.message)); useEffect(() => { refresh(); }, []); async function add(e) { e.preventDefault(); setBusy(true); try { await api.addHoliday(form); setForm({ name: '', date: '' }); setError(''); refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); } } return <section className="management-panel"><div className="panel-heading"><div><h2>Business holiday calendar</h2><p>Dates entered here are excluded from future SLA and customer-wait calculations. Update ahead of time.</p></div></div><ErrorNotice error={error} onClose={() => setError('')}/><form className="holiday-form" onSubmit={add}><label className="field">Holiday name<input required placeholder="Festival / public holiday" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}/></label><label className="field">Date<input required type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}/></label><button className="btn primary" disabled={busy}>+ Add holiday</button></form><div className="table-scroll"><table><thead><tr><th>Date</th><th>Holiday</th></tr></thead><tbody>{items.map((h) => <tr key={h.id}><td>{h.holidayDate?.slice(0,10)}</td><td>{h.name}</td></tr>)}</tbody></table></div></section>; }

function CustomerPortal({ ticketNumber, token }) {
  const [ticket, setTicket] = useState(null), [draft, setDraft] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { try { setTicket(await api.customerTicket(ticketNumber, token)); setError(''); } catch (e) { setError(e.message); } }, [ticketNumber, token]);
  useEffect(() => { refresh(); }, [refresh]);
  async function send(e) { e.preventDefault(); setBusy(true); try { await api.customerReply(ticketNumber, token, draft); setDraft(''); await refresh(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  async function reopen() { setBusy(true); try { await api.customerReopen(ticketNumber, token); await refresh(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  const reopenAllowed = ticket?.status === 'RESOLVED' && ticket.reopenUntil && new Date(ticket.reopenUntil) >= new Date();
  return <div className="portal-page"><header className="portal-header"><BrandMark/><strong>Arvo <span>Customer portal</span></strong></header><main className="portal-main"><p className="eyebrow">SUPPORT CONVERSATION</p><h1>{ticket?.title || ticketNumber}</h1><ErrorNotice error={error} onClose={() => setError('')}/>{ticket ? <><div className="portal-summary"><span>{ticket.ticketNumber}</span><StatusPill status={ticket.status}/><PriorityPill priority={ticket.priority}/></div><div className="portal-description">{ticket.description}</div><section className="portal-messages"><h2>Conversation</h2>{ticket.messages.map((m) => <article key={m.id} className="portal-message"><strong>{m.senderType === 'CUSTOMER' ? 'You' : m.author?.name || 'Support team'}</strong><time>{fmt(m.createdAt)}</time><p>{m.body}</p></article>)}</section>{['OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER'].includes(ticket.status) && <form className="portal-reply" onSubmit={send}><label className="field">Add a reply<textarea rows="4" required value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write your reply to the support team…"/></label><button disabled={busy || !draft.trim()} className="btn primary">Send reply ↗</button></form>}{reopenAllowed && <div className="portal-action"><strong>Need more assistance?</strong><p>You can reopen this ticket until {fmt(ticket.reopenUntil)}.</p><button className="btn primary" disabled={busy} onClick={reopen}>Reopen ticket</button></div>}{(ticket.status === 'CLOSED' || (ticket.status === 'RESOLVED' && !reopenAllowed)) && <div className="portal-action"><strong>This conversation has ended.</strong><p>Please contact support to open a new ticket.</p></div>}</> : !error ? <Spinner/> : null}<p className="portal-note">Only public replies are shown here. Your secure link grants access to this conversation.</p></main></div>;
}

export default function App() {
  // Store the secret in URL fragment, never sent to the static hosting server.
  const params = window.location.hash.startsWith('#/customer?')
    ? new URLSearchParams(window.location.hash.slice('#/customer?'.length))
    : new URLSearchParams(window.location.search);
  const ticketNumber = params.get('ticket'), token = params.get('token');
  const [user, setUser] = useState(null), [initializing, setInitializing] = useState(true), [section, setSection] = useState('all');
  const [tickets, setTickets] = useState([]), [page, setPage] = useState(1), [pageCount, setPageCount] = useState(1), [stats, setStats] = useState(null), [agents, setAgents] = useState([]), [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null), [selectedId, setSelectedId] = useState(null), [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState(''), [status, setStatus] = useState(''), [priority, setPriority] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { if (!ticketNumber || !token) api.me().then((d) => setUser(d.user)).catch(() => {}).finally(() => setInitializing(false)); }, [ticketNumber, token]);
  const refreshDirectory = useCallback(() => { api.customers().then((d) => setCustomers(d.customers)).catch((e) => setError(e.message)); }, []);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try { const [result, overview] = await Promise.all([api.tickets({ page, q: search, scope: ['mine', 'unassigned', 'waiting', 'overdue'].includes(section) ? section : '', status: section === 'all' ? status : '', priority }), api.stats()]); setTickets(result.tickets); setPageCount(result.pageCount); setStats(overview); }
    catch (err) { setError(err.message); if (err.status === 401) setUser(null); }
    finally { setLoading(false); }
  }, [user, search, section, status, priority, page]);
  useEffect(() => { if (user) { load(); api.agents().then((d) => setAgents(d.agents)).catch((e) => setError(e.message)); refreshDirectory(); } }, [user, load, refreshDirectory]);
  const open = async (id) => { setSelectedId(id); try { setSelected(await api.ticket(id)); } catch (e) { setError(e.message); } };
  const action = async (method, ...args) => { setBusy(true); setError(''); try { const result = await api[method](...args); await Promise.all([load(), open(args[0])]); return result; } finally { setBusy(false); } };
  async function logout() {
    try {
      await api.logout();
      setUser(null);
      setSection('all');
      setPage(1);
      setSelected(null);
      setSelectedId(null);
    } catch (e) {
      setError(e.message);
    }
  }
  const heading = useMemo(() => ({ all: 'Ticket inbox', mine: 'My tickets', unassigned: 'Unassigned', waiting: 'Waiting on customer', overdue: 'Overdue tickets', team: 'Team workload', customers: 'Customers', holidays: 'Holiday calendar' })[section], [section]);
  if (ticketNumber && token) return <CustomerPortal ticketNumber={ticketNumber} token={token}/>;
  if (initializing) return <div className="splash"><Spinner/>Loading workspace…</div>;
  if (!user) return <Login onLogin={setUser}/>;
  const management = section === 'team' || section === 'customers' || section === 'holidays';
  return <div className="app-shell"><Sidebar user={user} section={section} setSection={(view) => { setSection(view); setPage(1); setSelected(null); setSelectedId(null); }} stats={stats} onLogout={logout} onCreate={() => setShowCreate(true)}/><div className="main-shell"><header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <strong>{heading}</strong></div><div className="topbar-right"><span className="live-indicator"><i/> Live workspace</span><span className="topbar-user">{initialsAvatar(user.name, 0)}</span></div></header><main className="workspace-main"><div className="page-title"><div><p className="eyebrow">YOUR SUPPORT WORKSPACE</p><h1>{heading}</h1><p>Track every conversation, deadline and customer promise in one place.</p></div><button className="btn primary create-button" onClick={() => setShowCreate(true)}>+ New ticket</button></div><ErrorNotice error={error} onClose={() => setError('')}/><MetricCards stats={stats} onSelect={(view) => { setSection(view); setPage(1); setSelected(null); }}/>{management ? (section === 'team' ? <TeamPage/> : section === 'holidays' ? <HolidayPage/> : <CustomersPage customers={customers} refresh={refreshDirectory}/>) : <div className={`inbox-container ${selected ? 'detail-open' : ''}`}><div className="inbox-left"><div className="inbox-heading"><div><h2>{heading}</h2><span className="count-bubble">{pageCount > 1 ? `${(page-1)*50+1}–${(page-1)*50+tickets.length}` : tickets.length}</span></div><button className="refresh-button" title="Refresh inbox" onClick={load} aria-label="Refresh tickets">↻</button></div><div className="filters"><label className="search"><span>⌕</span><input aria-label="Search tickets" placeholder="Search tickets, customers…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}/></label><div className="filter-selects"><select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); if (section !== 'all') setSection('all'); }}><option value="">All statuses</option>{Object.entries(STATUS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select><select aria-label="Filter by priority" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}><option value="">All priorities</option>{Object.entries(PRIORITY).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div></div><TicketList tickets={tickets} selectedId={selectedId} onOpen={open} loading={loading} page={page} pageCount={pageCount} onPage={setPage}/></div>{selected ? <TicketDetail key={selected.id} ticket={selected} user={user} agents={agents} onAction={action} busy={busy} onClose={() => { setSelected(null); setSelectedId(null); }} onError={setError}/> : <div className="detail-placeholder"><div className="placeholder-art">✦</div><h3>Make room for better support</h3><p>Select a ticket to see its conversation, SLA deadlines, and complete activity history.</p></div>}</div>}</main></div>{showCreate && <NewTicket onClose={() => setShowCreate(false)} customers={customers} onCreated={(ticket, openAfter = true) => { load(); if (openAfter) { open(ticket.id); } }}/>}</div>;
}
