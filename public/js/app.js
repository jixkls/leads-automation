document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('lead-form');
  const generateBtn = document.getElementById('generate-btn');
  const quantityInput = document.getElementById('quantity');
  const quantityValue = document.getElementById('quantity-value');
  const progressSection = document.getElementById('progress-section');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const progressCount = document.getElementById('progress-count');
  const resultsSection = document.getElementById('results-section');
  const resultsBody = document.getElementById('results-body');
  const exportBtn = document.getElementById('export-btn');
  const errorSection = document.getElementById('error-section');
  const errorMessage = document.getElementById('error-message');

  let currentJobId = null;

  quantityInput.addEventListener('input', () => {
    quantityValue.textContent = quantityInput.value;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await startGeneration();
  });

  async function startGeneration() {
    const formData = new FormData(form);

    const request = {
      niche: formData.get('niche'),
      keywords: formData.get('keywords') || undefined,
      location: {
        city: formData.get('city') || undefined,
        state: formData.get('state') || undefined,
        country: formData.get('country'),
      },
      quantity: parseInt(formData.get('quantity')),
    };

    hideError();
    hideResults();
    showProgress();
    setGenerating(true);

    try {
      const response = await ApiClient.generateLeads(request);
      currentJobId = response.jobId;

      ApiClient.subscribeToStatus(currentJobId, {
        onStatus: (data) => {
          updateProgress(data.progress, data.currentStep, data.leadsCount);
        },
        onCompleted: async (data) => {
          updateProgress(100, 'Concluído!', data.leadsCount);
          await loadResults();
          setGenerating(false);
        },
        onFailed: (data) => {
          showError(data.error || 'Tarefa falhou');
          hideProgress();
          setGenerating(false);
        },
        onError: (error) => {
          showError(error);
          hideProgress();
          setGenerating(false);
        },
      });
    } catch (error) {
      showError(error.message);
      hideProgress();
      setGenerating(false);
    }
  }

  async function loadResults() {
    if (!currentJobId) return;

    try {
      const job = await ApiClient.getJobResults(currentJobId);
      displayResults(job.leads);
    } catch (error) {
      showError(error.message);
    }
  }

  function displayResults(leads) {
    resultsBody.innerHTML = '';

    for (const lead of leads) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(lead.name)}</td>
        <td>${lead.email ? `<a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a>` : '<span class="empty-cell">-</span>'}</td>
        <td>${lead.phone ? escapeHtml(lead.phone) : '<span class="empty-cell">-</span>'}</td>
        <td>${lead.website ? `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener">Visitar</a>` : '<span class="empty-cell">-</span>'}</td>
        <td>${lead.address ? escapeHtml(lead.address) : '<span class="empty-cell">-</span>'}</td>
        <td>${lead.rating ? `<span class="rating-stars">${lead.rating.toFixed(1)} ★</span>` : '<span class="empty-cell">-</span>'}</td>
      `;
      resultsBody.appendChild(row);
    }

    showResults();
  }

  exportBtn.addEventListener('click', () => {
    if (currentJobId) {
      window.location.href = ApiClient.getExportUrl(currentJobId);
    }
  });

  function showProgress() {
    progressSection.hidden = false;
    updateProgress(0, 'Iniciando...', 0);
  }

  function hideProgress() {
    progressSection.hidden = true;
  }

  function updateProgress(percent, step, count) {
    progressFill.style.width = `${percent}%`;
    progressText.textContent = step;
    progressCount.textContent = `${count} leads encontrados`;
  }

  function showResults() {
    resultsSection.hidden = false;
  }

  function hideResults() {
    resultsSection.hidden = true;
    resultsBody.innerHTML = '';
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorSection.hidden = false;
  }

  function hideError() {
    errorSection.hidden = true;
  }

  function setGenerating(generating) {
    generateBtn.disabled = generating;
    generateBtn.textContent = generating ? 'Gerando...' : 'Gerar Leads';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
