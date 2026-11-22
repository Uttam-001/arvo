// Immutable database rows. See MySQL migration triggers for UPDATE/DELETE rejection.
export async function recordEvent(tx, ticketId, agent, action, details = {}, label = null) {
  const actorAgentId = agent?.id ?? (typeof agent === 'string' ? agent : null);
  let actorLabel = label;
  if (!actorLabel && actorAgentId) {
    const dbAgent = await tx.agent.findUnique({ where: { id: actorAgentId }, select: { name: true, email: true } });
    actorLabel = dbAgent ? `${dbAgent.name} <${dbAgent.email}>` : `Agent ${actorAgentId}`;
  }
  return tx.ticketEvent.create({ data: { ticketId, actorAgentId, actorLabel: actorLabel || 'System', action, details } });
}
