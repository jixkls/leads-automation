import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { leadGenerationService } from '../../services/index.js';
import { validateGenerateRequest } from '../../utils/validators.js';

export const leadsRoutes = new Hono();

leadsRoutes.post('/generate', async (c) => {
  const body = await c.req.json();
  const validation = validateGenerateRequest(body);

  if (!validation.success) {
    return c.json({ error: validation.error }, 400);
  }

  const job = await leadGenerationService.startJob(validation.data!);

  return c.json({
    jobId: job.id,
    status: job.status,
    message: 'Tarefa iniciada com sucesso',
  });
});

leadsRoutes.get('/status/:id', async (c) => {
  const jobId = c.req.param('id');

  return streamSSE(c, async (stream) => {
    const job = leadGenerationService.getJob(jobId);
    if (!job) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: 'Tarefa não encontrada' }),
      });
      return;
    }

    await stream.writeSSE({
      event: 'status',
      data: JSON.stringify({
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        leadsCount: job.leads.length,
      }),
    });

    if (job.status === 'completed' || job.status === 'failed') {
      await stream.writeSSE({
        event: job.status,
        data: JSON.stringify({
          status: job.status,
          leadsCount: job.leads.length,
          error: job.error,
        }),
      });
      return;
    }

    const unsubscribe = leadGenerationService.subscribeToJob(jobId, async (updatedJob) => {
      try {
        await stream.writeSSE({
          event: 'status',
          data: JSON.stringify({
            status: updatedJob.status,
            progress: updatedJob.progress,
            currentStep: updatedJob.currentStep,
            leadsCount: updatedJob.leads.length,
          }),
        });

        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
          await stream.writeSSE({
            event: updatedJob.status,
            data: JSON.stringify({
              status: updatedJob.status,
              leadsCount: updatedJob.leads.length,
              error: updatedJob.error,
            }),
          });
        }
      } catch {
        // Stream closed
      }
    });

    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const currentJob = leadGenerationService.getJob(jobId);
        if (!currentJob || currentJob.status === 'completed' || currentJob.status === 'failed') {
          clearInterval(checkInterval);
          unsubscribe();
          resolve();
        }
      }, 1000);
    });
  });
});

leadsRoutes.get('/:id', async (c) => {
  const jobId = c.req.param('id');
  const job = leadGenerationService.getJob(jobId);

  if (!job) {
    return c.json({ error: 'Tarefa não encontrada' }, 404);
  }

  return c.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    leads: job.leads,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
});
