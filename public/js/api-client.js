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
      let message = 'Falha ao iniciar tarefa';
      try {
        const error = await response.json();
        message = error.error || message;
      } catch {
        // Response is not JSON
      }
      throw new Error(message);
    }

    return response.json();
  },

  subscribeToStatus(jobId, callbacks) {
    let eventSource = null;
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 1000;
    let isClosed = false;

    const safeParse = (data) => {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    };

    const connect = () => {
      if (isClosed) return;

      eventSource = new EventSource(`${this.baseUrl}/leads/status/${jobId}`);

      eventSource.addEventListener('status', (event) => {
        retryCount = 0;
        const data = safeParse(event.data);
        if (data) callbacks.onStatus?.(data);
      });

      eventSource.addEventListener('completed', (event) => {
        const data = safeParse(event.data);
        isClosed = true;
        eventSource.close();
        if (data) callbacks.onCompleted?.(data);
      });

      eventSource.addEventListener('failed', (event) => {
        const data = safeParse(event.data);
        isClosed = true;
        eventSource.close();
        if (data) callbacks.onFailed?.(data);
      });

      eventSource.addEventListener('error', (event) => {
        if (event.data) {
          const data = safeParse(event.data);
          isClosed = true;
          eventSource.close();
          if (data) callbacks.onError?.(data.error);
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
      let message = 'Falha ao obter resultados';
      try {
        const error = await response.json();
        message = error.error || message;
      } catch {
        // Response is not JSON
      }
      throw new Error(message);
    }

    return response.json();
  },

  getExportUrl(jobId) {
    return `${this.baseUrl}/export/${jobId}/csv`;
  },
};
