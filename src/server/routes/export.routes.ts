import { Hono } from 'hono';
import { leadGenerationService, exportService } from '../../services/index.js';

export const exportRoutes = new Hono();

exportRoutes.get('/:id/csv', async (c) => {
  const jobId = c.req.param('id');
  const job = leadGenerationService.getJob(jobId);

  if (!job) {
    return c.json({ error: 'Tarefa não encontrada' }, 404);
  }

  if (job.status !== 'completed') {
    return c.json({ error: 'Tarefa ainda não foi concluída' }, 400);
  }

  if (job.leads.length === 0) {
    return c.json({ error: 'Nenhum lead para exportar' }, 400);
  }

  const csv = exportService.exportToCSV(job.leads);
  const filename = `leads_${job.request.niche.replace(/\s+/g, '_')}_${Date.now()}.csv`;

  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', `attachment; filename="${filename}"`);

  return c.body(csv);
});
