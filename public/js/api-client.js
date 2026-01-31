const ApiClient = {
  baseUrl: '/api',

  async generateLeads(request) {
    const response = await fetch(`${this.baseUrl}/leads/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Falha ao iniciar tarefa');
    }

    return response.json();
  },

  subscribeToStatus(jobId, callbacks) {
    let eventSource = null;
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 1000;
    let isClosed = false;

    const connect = () => {
      if (isClosed) return;

      eventSource = new EventSource(`${this.baseUrl}/leads/status/${jobId}`);

      eventSource.addEventListener('status', (event) => {
        retryCount = 0;
        const data = JSON.parse(event.data);
        callbacks.onStatus?.(data);
      });

      eventSource.addEventListener('completed', (event) => {
        const data = JSON.parse(event.data);
        callbacks.onCompleted?.(data);
        isClosed = true;
        eventSource.close();
      });

      eventSource.addEventListener('failed', (event) => {
        const data = JSON.parse(event.data);
        callbacks.onFailed?.(data);
        isClosed = true;
        eventSource.close();
      });

      eventSource.addEventListener('error', (event) => {
        if (event.data) {
          const data = JSON.parse(event.data);
          callbacks.onError?.(data.error);
          isClosed = true;
          eventSource.close();
        }
      });

      eventSource.onerror = () => {
        eventSource.close();

        if (isClosed) return;

        if (retryCount < maxRetries) {
          retryCount++;
          const delay = baseDelay * Math.pow(2, retryCount - 1);
          console.log(`Conexão perdida. Tentando reconectar em ${delay}ms (tentativa ${retryCount}/${maxRetries})...`);
          setTimeout(connect, delay);
        } else {
          isClosed = true;
          callbacks.onError?.('Conexão perdida. Por favor, verifique se o navegador está instalado e tente novamente.');
        }
      };
    };

    connect();

    return () => {
      isClosed = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  },

  async getJobResults(jobId) {
    const response = await fetch(`${this.baseUrl}/leads/${jobId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Falha ao obter resultados');
    }

    return response.json();
  },

  getExportUrl(jobId) {
    return `${this.baseUrl}/export/${jobId}/csv`;
  },
};
