/**
 * Dashboard functionality for Love Life Now Admin Panel
 */
document.addEventListener('DOMContentLoaded', () => {
  // State
  let currentFormType = 'contact';
  let currentSubmission = null;
  let submissions = [];

  // Form type labels
  const formLabels = {
    contact: 'Contact Form Submissions',
    volunteer: 'Volunteer Sign-ups',
    speaker: 'Book A Speaker Requests',
    getsafe: 'Get Safe Fund Applications',
    donate: 'Donations'
  };

  // DOM Elements
  const pageTitle = document.getElementById('pageTitle');
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const emptyState = document.getElementById('emptyState');
  const submissionsTable = document.getElementById('submissionsTable');
  const submissionsBody = document.getElementById('submissionsBody');
  const navItems = document.querySelectorAll('.nav-item');
  const refreshBtn = document.getElementById('refreshBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // Modal elements
  const detailModal = document.getElementById('detailModal');
  const closeModal = document.getElementById('closeModal');
  const replyBtn = document.getElementById('replyBtn');
  const replyModal = document.getElementById('replyModal');
  const closeReplyModal = document.getElementById('closeReplyModal');
  const cancelReply = document.getElementById('cancelReply');
  const replyForm = document.getElementById('replyForm');

  // Initialize
  init();

  function init() {
    setupNavigation();
    setupLogout();
    setupRefresh();
    setupModals();
    loadSubmissions(currentFormType);
  }

  // Navigation
  function setupNavigation() {
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const formType = item.dataset.form;
        if (formType !== currentFormType) {
          currentFormType = formType;
          updateActiveNav(item);
          loadSubmissions(formType);
        }
      });
    });
  }

  function updateActiveNav(activeItem) {
    navItems.forEach(item => item.classList.remove('active'));
    activeItem.classList.add('active');
  }

  // Logout
  function setupLogout() {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (e) {
        console.error('Logout error:', e);
      }
      window.location.href = '/';
    });
  }

  // Refresh
  function setupRefresh() {
    refreshBtn.addEventListener('click', () => {
      loadSubmissions(currentFormType);
    });
  }

  // Load submissions
  async function loadSubmissions(formType) {
    showLoading();
    pageTitle.textContent = formLabels[formType];

    try {
      const response = await fetch(`/api/submissions/${formType}`, {
        credentials: 'include'
      });

      if (response.status === 401) {
        window.location.href = '/';
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load submissions');
      }

      const data = await response.json();
      submissions = data.submissions || [];

      if (submissions.length === 0) {
        showEmpty();
      } else {
        renderSubmissions(submissions);
        showTable();
      }
    } catch (error) {
      console.error('Load error:', error);
      showError(error.message);
    }
  }

  // Render submissions table using safe DOM manipulation
  function renderSubmissions(submissionsList) {
    // Clear existing content
    submissionsBody.textContent = '';

    submissionsList.forEach(sub => {
      const tr = document.createElement('tr');

      // Date cell
      const dateCell = document.createElement('td');
      dateCell.className = 'date-cell';
      dateCell.textContent = formatDate(sub.date);
      tr.appendChild(dateCell);

      // Name cell
      const nameCell = document.createElement('td');
      nameCell.textContent = sub.constituent?.name || 'Unknown';
      tr.appendChild(nameCell);

      // Email cell
      const emailCell = document.createElement('td');
      emailCell.textContent = sub.constituent?.email || '-';
      tr.appendChild(emailCell);

      // Subject cell
      const subjectCell = document.createElement('td');
      subjectCell.className = 'subject-cell';
      subjectCell.textContent = sub.subject;
      tr.appendChild(subjectCell);

      // Actions cell
      const actionsCell = document.createElement('td');
      const viewBtn = document.createElement('button');
      viewBtn.className = 'view-btn';
      viewBtn.textContent = 'View';
      viewBtn.addEventListener('click', () => showDetail(sub));
      actionsCell.appendChild(viewBtn);
      tr.appendChild(actionsCell);

      submissionsBody.appendChild(tr);
    });
  }

  // State display helpers
  function showLoading() {
    loadingState.style.display = 'block';
    errorState.style.display = 'none';
    emptyState.style.display = 'none';
    submissionsTable.style.display = 'none';
  }

  function showTable() {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    emptyState.style.display = 'none';
    submissionsTable.style.display = 'block';
  }

  function showEmpty() {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    emptyState.style.display = 'block';
    submissionsTable.style.display = 'none';
  }

  function showError(message) {
    loadingState.style.display = 'none';
    errorState.querySelector('.error-message').textContent = message;
    errorState.style.display = 'block';
    emptyState.style.display = 'none';
    submissionsTable.style.display = 'none';
  }

  // Modal handling
  function setupModals() {
    // Detail modal
    closeModal.addEventListener('click', hideDetailModal);
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) hideDetailModal();
    });

    // Reply button
    replyBtn.addEventListener('click', () => {
      if (currentSubmission?.constituent?.email) {
        showReplyModal();
      }
    });

    // Reply modal
    closeReplyModal.addEventListener('click', hideReplyModal);
    cancelReply.addEventListener('click', hideReplyModal);
    replyModal.addEventListener('click', (e) => {
      if (e.target === replyModal) hideReplyModal();
    });

    // Reply form submit
    replyForm.addEventListener('submit', handleReplySubmit);

    // Escape key closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideDetailModal();
        hideReplyModal();
      }
    });
  }

  function showDetail(submission) {
    currentSubmission = submission;

    // Populate detail fields using textContent (safe from XSS)
    document.getElementById('detailName').textContent = submission.constituent?.name || 'Unknown';
    document.getElementById('detailEmail').textContent = submission.constituent?.email || '-';
    document.getElementById('detailPhone').textContent = submission.constituent?.phone || '-';
    document.getElementById('detailDate').textContent = formatDate(submission.date);
    document.getElementById('detailSubject').textContent = submission.subject;
    document.getElementById('detailMessage').textContent = submission.note || 'No message content';

    // Custom fields - use safe DOM manipulation
    const customFieldsSection = document.getElementById('customFieldsSection');
    const customFieldsGrid = document.getElementById('customFieldsGrid');
    customFieldsGrid.textContent = ''; // Clear existing content

    if (submission.customFields && submission.customFields.length > 0) {
      submission.customFields.forEach(field => {
        const detailItem = document.createElement('div');
        detailItem.className = 'detail-item';

        const label = document.createElement('label');
        label.textContent = field.Name || 'Field';
        detailItem.appendChild(label);

        const span = document.createElement('span');
        span.textContent = field.Value || '-';
        detailItem.appendChild(span);

        customFieldsGrid.appendChild(detailItem);
      });
      customFieldsSection.style.display = 'block';
    } else {
      customFieldsSection.style.display = 'none';
    }

    // Enable/disable reply button based on email availability
    replyBtn.disabled = !submission.constituent?.email;

    detailModal.style.display = 'flex';
  }

  function hideDetailModal() {
    detailModal.style.display = 'none';
    currentSubmission = null;
  }

  function showReplyModal() {
    if (!currentSubmission?.constituent?.email) return;

    document.getElementById('replyTo').value = currentSubmission.constituent.email;
    document.getElementById('replySubject').value = `Re: ${currentSubmission.subject}`;
    document.getElementById('replyMessage').value = '';
    document.getElementById('replyError').style.display = 'none';
    document.getElementById('replySuccess').style.display = 'none';

    hideDetailModal();
    replyModal.style.display = 'flex';
  }

  function hideReplyModal() {
    replyModal.style.display = 'none';
  }

  async function handleReplySubmit(e) {
    e.preventDefault();

    const sendBtn = document.getElementById('sendReplyBtn');
    const errorDiv = document.getElementById('replyError');
    const successDiv = document.getElementById('replySuccess');

    const to = document.getElementById('replyTo').value;
    const subject = document.getElementById('replySubject').value;
    const message = document.getElementById('replyMessage').value;

    if (!to || !subject || !message) {
      errorDiv.textContent = 'Please fill in all fields';
      errorDiv.style.display = 'block';
      return;
    }

    // Set loading state
    sendBtn.disabled = true;
    sendBtn.querySelector('.btn-text').style.display = 'none';
    sendBtn.querySelector('.btn-loading').style.display = 'inline';
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    try {
      const response = await fetch('/api/email/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          to,
          subject,
          message,
          submissionId: currentSubmission?.id
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        successDiv.textContent = 'Email sent successfully!';
        successDiv.style.display = 'block';

        // Close modal after a short delay
        setTimeout(() => {
          hideReplyModal();
        }, 1500);
      } else {
        errorDiv.textContent = data.error || 'Failed to send email';
        errorDiv.style.display = 'block';
      }
    } catch (error) {
      console.error('Send error:', error);
      errorDiv.textContent = 'Unable to send email. Please try again.';
      errorDiv.style.display = 'block';
    } finally {
      sendBtn.disabled = false;
      sendBtn.querySelector('.btn-text').style.display = 'inline';
      sendBtn.querySelector('.btn-loading').style.display = 'none';
    }
  }

  // Utility functions
  function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
});
