import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
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

serve({
  fetch: app.fetch,
  port: CONFIG.server.port,
  hostname: CONFIG.server.host,
});

console.log(`Servidor rodando em http://${CONFIG.server.host}:${CONFIG.server.port}`);
