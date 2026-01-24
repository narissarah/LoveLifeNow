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

  // Saved reply templates
  const replyTemplates = [
    {
      id: 'thank-you',
      title: 'Thank You for Contacting Us',
      subject: 'Thank You for Reaching Out - Love Life Now Foundation',
      message: `Dear {{name}},

Thank you for contacting Love Life Now Foundation. We have received your message and appreciate you taking the time to reach out to us.

Our team will review your inquiry and get back to you as soon as possible, typically within 1-2 business days.

If you need immediate assistance, please call our office at [phone number].

With gratitude,
Love Life Now Foundation Team`
    },
    {
      id: 'volunteer-welcome',
      title: 'Volunteer Application Received',
      subject: 'Welcome! Your Volunteer Application - Love Life Now Foundation',
      message: `Dear {{name}},

Thank you for your interest in volunteering with Love Life Now Foundation! We are thrilled that you want to join our mission to support domestic violence survivors.

We have received your volunteer application and will be in touch soon with next steps, including our volunteer orientation schedule.

Your compassion and willingness to help makes a real difference in the lives of survivors.

Warmly,
Love Life Now Foundation Team`
    },
    {
      id: 'speaker-confirm',
      title: 'Speaker Request Received',
      subject: 'Your Speaker Request - Love Life Now Foundation',
      message: `Dear {{name}},

Thank you for requesting a speaker from Love Life Now Foundation for your event. We are honored by your interest in raising awareness about domestic violence.

We have received your request and our team will review the details. We will contact you within 3-5 business days to discuss availability, logistics, and any specific topics you'd like us to cover.

Thank you for helping us spread awareness and education.

Best regards,
Love Life Now Foundation Team`
    },
    {
      id: 'getsafe-received',
      title: 'Get Safe Application Received',
      subject: 'Your Application Has Been Received - Love Life Now Foundation',
      message: `Dear {{name}},

We have received your Get Safe Fund application. Please know that reaching out takes courage, and we are here to support you.

Our team will review your application carefully and confidentially. We will contact you within 5-7 business days regarding the status of your application.

If you are in immediate danger, please call 911 or the National Domestic Violence Hotline at 1-800-799-7233.

You are not alone.

With care and support,
Love Life Now Foundation Team`
    },
    {
      id: 'donation-thanks',
      title: 'Thank You for Your Donation',
      subject: 'Thank You for Your Generous Gift - Love Life Now Foundation',
      message: `Dear {{name}},

Thank you so much for your generous donation to Love Life Now Foundation. Your support directly helps domestic violence survivors rebuild their lives with dignity and hope.

Your contribution will be used to provide essential services including emergency assistance, advocacy, and educational programs.

A tax receipt will be sent to you separately for your records.

With heartfelt gratitude,
Love Life Now Foundation Team`
    }
  ];

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

  // Panel elements
  const contentBody = document.querySelector('.content-body');
  const detailPanel = document.getElementById('detailPanel');
  const closePanel = document.getElementById('closePanel');
  const closePanelReply = document.getElementById('closePanelReply');
  const replyBtn = document.getElementById('replyBtn');

  // Panel modes
  const viewMode = document.getElementById('viewMode');
  const replyMode = document.getElementById('replyMode');
  const backToView = document.getElementById('backToView');
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
          hideDetailPanel(); // Close panel when switching form types
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
        await fetch('/api/auth-logout', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (e) {
        console.error('Logout error:', e);
      }
      window.location.href = '/admin/';
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
      const response = await fetch(`/api/submissions?type=${formType}`, {
        credentials: 'include'
      });

      if (response.status === 401) {
        window.location.href = '/admin/';
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

    submissionsList.forEach((sub, index) => {
      const tr = document.createElement('tr');
      tr.dataset.index = index;

      // Click on row to show detail in side panel
      tr.addEventListener('click', () => {
        selectSubmission(sub, tr);
      });

      // Date cell
      const dateCell = document.createElement('td');
      dateCell.className = 'date-cell';
      dateCell.textContent = formatDate(sub.date);
      tr.appendChild(dateCell);

      // Name cell
      const nameCell = document.createElement('td');
      nameCell.textContent = sub.constituent?.name || 'Unknown';
      tr.appendChild(nameCell);

      submissionsBody.appendChild(tr);
    });
  }

  // Select a submission and show in side panel
  function selectSubmission(sub, rowElement) {
    // Update selected row styling
    const allRows = submissionsBody.querySelectorAll('tr');
    allRows.forEach(r => r.classList.remove('selected'));
    rowElement.classList.add('selected');

    // Show detail in side panel
    showDetailPanel(sub);
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

  // Panel and Modal handling
  function setupModals() {
    // Detail panel close buttons
    closePanel.addEventListener('click', hideDetailPanel);
    closePanelReply.addEventListener('click', hideDetailPanel);

    // Reply button - switch to reply mode
    replyBtn.addEventListener('click', () => {
      if (currentSubmission?.constituent?.email) {
        showReplyMode();
      }
    });

    // Back button - return to view mode
    backToView.addEventListener('click', showViewMode);

    // Reply form submit
    replyForm.addEventListener('submit', handleReplySubmit);

    // Template selector - populate options
    const templateSelect = document.getElementById('templateSelect');
    replyTemplates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.title;
      templateSelect.appendChild(option);
    });

    // Template selector - handle change
    templateSelect.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      if (!selectedId) return;

      const template = replyTemplates.find(t => t.id === selectedId);
      if (template) {
        const name = currentSubmission?.constituent?.name || 'Valued Friend';
        document.getElementById('replySubject').value = template.subject;
        document.getElementById('replyMessage').value = template.message.replace(/\{\{name\}\}/g, name);
      }
    });

    // Escape key closes panel or goes back to view
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (replyMode.style.display !== 'none') {
          showViewMode();
        } else {
          hideDetailPanel();
        }
      }
    });
  }

  // Switch to reply mode in panel
  function showReplyMode() {
    if (!currentSubmission?.constituent?.email) return;

    // Reset form
    document.getElementById('templateSelect').value = '';
    document.getElementById('replyTo').value = currentSubmission.constituent.email;
    document.getElementById('replySubject').value = `Re: ${currentSubmission.subject}`;
    document.getElementById('replyMessage').value = '';
    document.getElementById('replyError').style.display = 'none';
    document.getElementById('replySuccess').style.display = 'none';

    // Switch modes
    viewMode.style.display = 'none';
    replyMode.style.display = 'flex';
  }

  // Switch back to view mode
  function showViewMode() {
    replyMode.style.display = 'none';
    viewMode.style.display = 'flex';
  }

  function showDetailPanel(submission) {
    currentSubmission = submission;

    // Populate detail fields using textContent (safe from XSS)
    document.getElementById('detailName').textContent = submission.constituent?.name || 'Unknown';
    document.getElementById('detailEmail').textContent = submission.constituent?.email || '-';
    document.getElementById('detailPhone').textContent = submission.constituent?.phone || '-';
    document.getElementById('detailDate').textContent = formatDate(submission.date);
    document.getElementById('detailSubject').textContent = submission.subject;
    document.getElementById('detailMessage').textContent = submission.note || 'No message content';

    // Address section
    const addressSection = document.getElementById('addressSection');
    const detailAddress = document.getElementById('detailAddress');
    const addr = submission.constituent?.address;
    if (addr && (addr.street || addr.city)) {
      let addressParts = [];
      if (addr.street) addressParts.push(addr.street);
      if (addr.city) addressParts.push(addr.city);
      if (addr.state) addressParts.push(addr.state);
      if (addr.zip) addressParts.push(addr.zip);
      if (addr.country) addressParts.push(addr.country);
      detailAddress.textContent = addressParts.join(', ');
      addressSection.style.display = 'block';
    } else {
      addressSection.style.display = 'none';
    }

    // Constituent demographics (age, race, ethnicity, etc.)
    const constituentFieldsSection = document.getElementById('constituentFieldsSection');
    const constituentFieldsGrid = document.getElementById('constituentFieldsGrid');
    constituentFieldsGrid.textContent = '';

    if (submission.constituentCustomFields && submission.constituentCustomFields.length > 0) {
      submission.constituentCustomFields.forEach(field => {
        const detailItem = document.createElement('div');
        detailItem.className = 'detail-item';

        const label = document.createElement('label');
        // Capitalize first letter of field name
        const fieldName = field.name || 'Field';
        label.textContent = fieldName.charAt(0).toUpperCase() + fieldName.slice(1) + ':';
        detailItem.appendChild(label);

        const span = document.createElement('span');
        span.textContent = field.value || '-';
        detailItem.appendChild(span);

        constituentFieldsGrid.appendChild(detailItem);
      });
      constituentFieldsSection.style.display = 'block';
    } else {
      constituentFieldsSection.style.display = 'none';
    }

    // Custom fields from the interaction (form submission data)
    const customFieldsSection = document.getElementById('customFieldsSection');
    const customFieldsGrid = document.getElementById('customFieldsGrid');
    customFieldsGrid.textContent = '';

    if (submission.customFields && submission.customFields.length > 0) {
      submission.customFields.forEach(field => {
        const detailItem = document.createElement('div');
        detailItem.className = 'detail-item';

        const label = document.createElement('label');
        const fieldName = field.name || 'Field';
        label.textContent = fieldName.charAt(0).toUpperCase() + fieldName.slice(1) + ':';
        detailItem.appendChild(label);

        const span = document.createElement('span');
        span.textContent = field.value || '-';
        detailItem.appendChild(span);

        customFieldsGrid.appendChild(detailItem);
      });
      customFieldsSection.style.display = 'block';
    } else {
      customFieldsSection.style.display = 'none';
    }

    // Enable/disable reply button based on email availability
    replyBtn.disabled = !submission.constituent?.email;

    // Ensure view mode is shown (not reply mode)
    viewMode.style.display = 'flex';
    replyMode.style.display = 'none';

    // Show panel
    detailPanel.style.display = 'flex';
    detailPanel.classList.add('open');
    contentBody.classList.add('panel-open');
  }

  function hideDetailPanel() {
    detailPanel.classList.remove('open');
    contentBody.classList.remove('panel-open');

    // Clear row selection
    const allRows = submissionsBody.querySelectorAll('tr');
    allRows.forEach(r => r.classList.remove('selected'));

    // Hide after animation
    setTimeout(() => {
      if (!detailPanel.classList.contains('open')) {
        detailPanel.style.display = 'none';
        currentSubmission = null;
      }
    }, 300);
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
      const response = await fetch('/api/email-reply', {
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

        // Go back to view mode after a short delay
        setTimeout(() => {
          showViewMode();
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
