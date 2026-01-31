import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import { leadsRoutes } from './routes/leads.routes.js';
import { exportRoutes } from './routes/export.routes.js';
import { CONFIG } from '../config/constants.js';

const app = new Hono();

app.use('*', cors());

app.use('/*', serveStatic({ root: './public' }));

app.route('/api/leads', leadsRoutes);
app.route('/api/export', exportRoutes);

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.onError((err, c) => {
  console.error('Erro do servidor:', err);
  return c.json({ error: 'Erro interno do servidor' }, 500);
});

console.log(`Servidor iniciando em http://${CONFIG.server.host}:${CONFIG.server.port}`);

export default {
  port: CONFIG.server.port,
  fetch: app.fetch,
  idleTimeout: 120,
};
