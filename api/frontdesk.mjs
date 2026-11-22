import { app } from '../backend/src/app.js';

export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/frontdesk') {
    const route = url.searchParams.get('frontdeskRoute');
    if (!route || !/^[\w/-]+$/.test(route)) {
      res.statusCode = 404;
      return res.end();
    }
    url.pathname = `/api/${route}`;
  }
  url.searchParams.delete('frontdeskRoute');
  req.url = url.pathname + url.search;
  return app(req, res);
}
