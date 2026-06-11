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
  let unsubscribeFromStatus = null;

  quantityInput.addEventListener('input', () => {
    quantityValue.textContent = quantityInput.value;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await startGeneration();
  });

  async function startGeneration() {
    const formData = new FormData(form);

    const quantity = parseInt(formData.get('quantity'));
    if (isNaN(quantity) || quantity < 1) return;

    const minRatingValue = formData.get('minRating');

    const request = {
      niche: formData.get('niche'),
      keywords: formData.get('keywords') || undefined,
      location: {
        city: formData.get('city') || undefined,
        state: formData.get('state') || undefined,
        country: formData.get('country'),
      },
      quantity,
      options: {
        extractWebsiteContacts: formData.get('extractWebsiteContacts') === 'on',
        minRating: minRatingValue ? parseFloat(minRatingValue) : undefined,
        requirePhone: formData.get('requirePhone') === 'on',
        requireWebsite: formData.get('requireWebsite') === 'on',
        requireEmail: formData.get('requireEmail') === 'on',
      },
    };

    // Clean up previous SSE connection
    if (unsubscribeFromStatus) {
      unsubscribeFromStatus();
      unsubscribeFromStatus = null;
    }

    hideError();
    hideResults();
    hideProgress();
    showProgress();
    setGenerating(true);

    try {
      const response = await ApiClient.generateLeads(request);
      currentJobId = response.jobId;

      unsubscribeFromStatus = ApiClient.subscribeToStatus(currentJobId, {
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

    if (leads.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="9" style="text-align:center;padding:2rem;color:#888;">Nenhum lead encontrado</td>';
      resultsBody.appendChild(row);
      showResults();
      return;
    }

    for (const lead of leads) {
      const ratingDisplay = typeof lead.rating === 'number' && !isNaN(lead.rating)
        ? `<span class="rating-stars">${lead.rating.toFixed(1)} ★</span>`
        : '<span class="empty-cell">-</span>';

      const socialBadges = [];
      if (lead.facebook) socialBadges.push(`<a href="${escapeHtml(lead.facebook)}" target="_blank" rel="noopener noreferrer" class="social-badge social-fb">FB</a>`);
      if (lead.instagram) socialBadges.push(`<a href="${escapeHtml(lead.instagram)}" target="_blank" rel="noopener noreferrer" class="social-badge social-ig">IG</a>`);
      if (lead.linkedin) socialBadges.push(`<a href="${escapeHtml(lead.linkedin)}" target="_blank" rel="noopener noreferrer" class="social-badge social-li">LI</a>`);
      if (lead.twitter) socialBadges.push(`<a href="${escapeHtml(lead.twitter)}" target="_blank" rel="noopener noreferrer" class="social-badge social-tw">TW</a>`);
      const socialDisplay = socialBadges.length > 0
        ? `<div class="social-links">${socialBadges.join('')}</div>`
        : '<span class="empty-cell">-</span>';

      const whatsappDigits = lead.whatsapp ? lead.whatsapp.replace(/\D/g, '') : '';
      const whatsappDisplay = whatsappDigits
        ? `<a href="https://wa.me/${whatsappDigits}" target="_blank" rel="noopener noreferrer">${escapeHtml(lead.whatsapp)}</a>`
        : '<span class="empty-cell">-</span>';

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(lead.name)}</td>
        <td>${lead.category ? escapeHtml(lead.category) : '<span class="empty-cell">-</span>'}</td>
        <td>${lead.email ? `<a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a>` : '<span class="empty-cell">-</span>'}</td>
        <td>${lead.phone ? escapeHtml(lead.phone) : '<span class="empty-cell">-</span>'}</td>
        <td>${whatsappDisplay}</td>
        <td>${lead.website ? `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener noreferrer">Visitar</a>` : '<span class="empty-cell">-</span>'}</td>
        <td>${lead.address ? escapeHtml(lead.address) : '<span class="empty-cell">-</span>'}</td>
        <td>${socialDisplay}</td>
        <td>${ratingDisplay}</td>
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
