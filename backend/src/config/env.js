import 'dotenv/config';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing. Copy backend/.env.example to backend/.env.');
export const env = Object.freeze({
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  businessTimezone: process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'frontdesk_session',
  csrfCookieName: process.env.CSRF_COOKIE_NAME || 'frontdesk_csrf',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 12),
  demoModeEnabled: process.env.DEMO_MODE_ENABLED !== 'false'
});
