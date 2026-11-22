import { getSessionUser } from '../services/sessionService.js';

export async function requireAuth(request, response, next) {
  try {
    const user = await getSessionUser(request);
    if (!user) return response.status(401).json({ error: 'Authentication is required.' });
    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireLead(request, response, next) {
  if (request.user.role !== 'SUPPORT_LEAD') return response.status(403).json({ error: 'Support Lead permission is required.' });
  next();
}
