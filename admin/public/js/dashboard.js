/**
 * Dashboard functionality for Love Life Now Admin Panel
 */
document.addEventListener('DOMContentLoaded', () => {
  // State
  let currentFormType = 'contact';
  let currentSubmission = null;
  let submissions = [];
  let selectedIds = new Set();
  let showArchived = false;

  // Local storage keys
  const STORAGE_KEY = 'lln_submission_status';

  // Get submission statuses from localStorage
  function getSubmissionStatuses() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  // Save submission statuses to localStorage
  function saveSubmissionStatuses(statuses) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  }

  // Get status for a specific submission
  function getStatus(submissionId) {
    const statuses = getSubmissionStatuses();
    return statuses[submissionId] || { read: false, archived: false };
  }

  // Update status for a submission
  function updateStatus(submissionId, updates) {
    const statuses = getSubmissionStatuses();
    statuses[submissionId] = { ...getStatus(submissionId), ...updates };
    saveSubmissionStatuses(statuses);
  }

  // Update status for multiple submissions
  function updateMultipleStatuses(ids, updates) {
    const statuses = getSubmissionStatuses();
    ids.forEach(id => {
      statuses[id] = { ...statuses[id] || { read: false, archived: false }, ...updates };
    });
    saveSubmissionStatuses(statuses);
  }

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
  const bulkToolbar = document.getElementById('bulkToolbar');
  const selectedCount = document.getElementById('selectedCount');
  const archiveToggle = document.getElementById('archiveToggle');
  const logoutBtn = document.getElementById('logoutBtn');

  // Panel elements
  const contentBody = document.querySelector('.content-body');
  const detailPanel = document.getElementById('detailPanel');
  const closePanel = document.getElementById('closePanel');
  const sendReplyBtn = document.getElementById('sendReplyBtn');
  const notifyMeBtn = document.getElementById('notifyMeBtn');
  const replyForm = document.getElementById('replyForm');

  // Sidebar elements
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');

  // Initialize
  init();

  function init() {
    setupSidebar();
    setupNavigation();
    setupLogout();
    setupRefresh();
    setupPanel();
    setupBulkActions();
    loadSubmissions(currentFormType);
  }

  // Bulk actions toolbar
  function setupBulkActions() {
    // Archive toggle
    if (archiveToggle) {
      archiveToggle.addEventListener('click', () => {
        showArchived = !showArchived;
        archiveToggle.classList.toggle('active', showArchived);
        archiveToggle.textContent = showArchived ? 'Hide Archived' : 'Show Archived';
        renderSubmissions(submissions);
      });
    }

    // Mark as read
    document.getElementById('markReadBtn')?.addEventListener('click', () => {
      if (selectedIds.size > 0) {
        updateMultipleStatuses([...selectedIds], { read: true });
        clearSelection();
        renderSubmissions(submissions);
      }
    });

    // Mark as unread
    document.getElementById('markUnreadBtn')?.addEventListener('click', () => {
      if (selectedIds.size > 0) {
        updateMultipleStatuses([...selectedIds], { read: false });
        clearSelection();
        renderSubmissions(submissions);
      }
    });

    // Archive
    document.getElementById('archiveBtn')?.addEventListener('click', () => {
      if (selectedIds.size > 0) {
        updateMultipleStatuses([...selectedIds], { archived: true });
        clearSelection();
        renderSubmissions(submissions);
      }
    });

    // Unarchive
    document.getElementById('unarchiveBtn')?.addEventListener('click', () => {
      if (selectedIds.size > 0) {
        updateMultipleStatuses([...selectedIds], { archived: false });
        clearSelection();
        renderSubmissions(submissions);
      }
    });

    // Select all
    document.getElementById('selectAllBtn')?.addEventListener('click', () => {
      const visibleSubmissions = getVisibleSubmissions();
      visibleSubmissions.forEach(sub => selectedIds.add(String(sub.id)));
      updateBulkToolbar();
      renderSubmissions(submissions);
    });

    // Deselect all
    document.getElementById('deselectAllBtn')?.addEventListener('click', () => {
      clearSelection();
      renderSubmissions(submissions);
    });
  }

  function clearSelection() {
    selectedIds.clear();
    updateBulkToolbar();
  }

  function updateBulkToolbar() {
    if (bulkToolbar) {
      if (selectedIds.size > 0) {
        bulkToolbar.classList.add('visible');
        if (selectedCount) {
          selectedCount.textContent = `${selectedIds.size} selected`;
        }
      } else {
        bulkToolbar.classList.remove('visible');
      }
    }
  }

  function getVisibleSubmissions() {
    return submissions.filter(sub => {
      const status = getStatus(String(sub.id));
      return showArchived ? status.archived : !status.archived;
    });
  }

  // Sidebar collapse/expand
  function setupSidebar() {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
    }

    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    });
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
          hideDetailPanel();
          clearSelection();
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

  // Render submissions list
  function renderSubmissions(submissionsList) {
    submissionsBody.textContent = '';

    // Filter based on archived status
    const visibleSubmissions = submissionsList.filter(sub => {
      const status = getStatus(String(sub.id));
      return showArchived ? status.archived : !status.archived;
    });

    if (visibleSubmissions.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-list-message';
      emptyMsg.textContent = showArchived ? 'No archived submissions' : 'No submissions found';
      submissionsBody.appendChild(emptyMsg);
      return;
    }

    visibleSubmissions.forEach((sub, index) => {
      const subId = String(sub.id);
      const status = getStatus(subId);
      const isSelected = selectedIds.has(subId);
      const isViewing = currentSubmission && String(currentSubmission.id) === subId;

      const item = document.createElement('div');
      item.className = 'submission-item';
      if (!status.read) item.classList.add('unread');
      if (isSelected) item.classList.add('selected');
      if (isViewing) item.classList.add('viewing');
      item.dataset.index = index;
      item.dataset.id = subId;

      // Checkbox
      const checkbox = document.createElement('div');
      checkbox.className = 'submission-checkbox';
      checkbox.innerHTML = isSelected ? '☑' : '☐';
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSelection(subId);
        renderSubmissions(submissions);
      });
      item.appendChild(checkbox);

      // Content wrapper
      const content = document.createElement('div');
      content.className = 'submission-content';

      const dateEl = document.createElement('div');
      dateEl.className = 'submission-date';
      dateEl.textContent = formatDate(sub.date);
      content.appendChild(dateEl);

      const nameEl = document.createElement('div');
      nameEl.className = 'submission-name';
      nameEl.textContent = sub.constituent?.name || 'Unknown';
      content.appendChild(nameEl);

      item.appendChild(content);

      // Click on content opens the submission and marks as read
      content.addEventListener('click', () => {
        // Mark as read
        updateStatus(subId, { read: true });
        selectSubmission(sub, item);
        renderSubmissions(submissions);
      });

      submissionsBody.appendChild(item);
    });

    updateBulkToolbar();
  }

  function toggleSelection(subId) {
    if (selectedIds.has(subId)) {
      selectedIds.delete(subId);
    } else {
      selectedIds.add(subId);
    }
    updateBulkToolbar();
  }

  // Select a submission and show in side panel
  function selectSubmission(sub, rowElement) {
    // Highlight the currently viewed item
    const allRows = submissionsBody.querySelectorAll('.submission-item');
    allRows.forEach(r => r.classList.remove('viewing'));
    rowElement.classList.add('viewing');

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

  // Panel handling
  function setupPanel() {
    closePanel.addEventListener('click', hideDetailPanel);

    // Tab switching
    document.querySelectorAll('.stack-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        document.querySelectorAll('.stack-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(tabName === 'details' ? 'tabDetails' : 'tabHistory').classList.add('active');
      });
    });

    // Reply form submit
    replyForm.addEventListener('submit', handleReplySubmit);

    // Notify me button - send submission to admin's email
    notifyMeBtn.addEventListener('click', handleNotifyMe);

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

    // Escape key closes panel
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideDetailPanel();
      }
    });
  }

  function showDetailPanel(submission) {
    currentSubmission = submission;

    // Populate Details tab
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

    // Constituent demographics
    const constituentFieldsSection = document.getElementById('constituentFieldsSection');
    const constituentFieldsGrid = document.getElementById('constituentFieldsGrid');
    constituentFieldsGrid.textContent = '';

    if (submission.constituentCustomFields && submission.constituentCustomFields.length > 0) {
      submission.constituentCustomFields.forEach(field => {
        const detailItem = document.createElement('div');
        detailItem.className = 'detail-item';

        const label = document.createElement('label');
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

    // Custom fields (form data)
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

    // Populate History tab
    document.getElementById('historyName').textContent = submission.constituent?.name || 'Unknown';
    document.getElementById('historyDate').textContent = formatDate(submission.date);
    document.getElementById('historyMessage').textContent = submission.note || 'No message content';

    // Reset tabs to show Details first
    document.querySelectorAll('.stack-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.stack-tab[data-tab="details"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tabDetails').classList.add('active');

    // Setup reply form
    const hasEmail = !!submission.constituent?.email;
    document.getElementById('templateSelect').value = '';
    document.getElementById('replyTo').value = submission.constituent?.email || '';
    document.getElementById('replySubject').value = `Re: ${submission.subject}`;
    document.getElementById('replyMessage').value = '';
    document.getElementById('replyError').style.display = 'none';
    document.getElementById('replySuccess').style.display = 'none';
    sendReplyBtn.disabled = !hasEmail;

    // Show panel
    detailPanel.style.display = 'flex';
    detailPanel.classList.add('open');
    contentBody.classList.add('panel-open');
  }

  function hideDetailPanel() {
    detailPanel.classList.remove('open');
    contentBody.classList.remove('panel-open');

    const allItems = submissionsBody.querySelectorAll('.submission-item');
    allItems.forEach(item => item.classList.remove('viewing'));

    setTimeout(() => {
      if (!detailPanel.classList.contains('open')) {
        detailPanel.style.display = 'none';
        currentSubmission = null;
      }
    }, 300);
  }

  async function handleReplySubmit(e) {
    e.preventDefault();

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

    sendReplyBtn.disabled = true;
    sendReplyBtn.querySelector('.btn-text').style.display = 'none';
    sendReplyBtn.querySelector('.btn-loading').style.display = 'inline';
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
          submissionId: currentSubmission?.id,
          originalMessage: currentSubmission?.note || '',
          originalDate: currentSubmission?.date,
          originalName: currentSubmission?.constituent?.name || 'Unknown'
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        successDiv.textContent = 'Email sent successfully!';
        successDiv.style.display = 'block';

        // Clear the form after success
        document.getElementById('replyMessage').value = '';
        document.getElementById('templateSelect').value = '';
      } else {
        errorDiv.textContent = data.error || 'Failed to send email';
        errorDiv.style.display = 'block';
      }
    } catch (error) {
      console.error('Send error:', error);
      errorDiv.textContent = 'Unable to send email. Please try again.';
      errorDiv.style.display = 'block';
    } finally {
      sendReplyBtn.disabled = false;
      sendReplyBtn.querySelector('.btn-text').style.display = 'inline';
      sendReplyBtn.querySelector('.btn-loading').style.display = 'none';
    }
  }

  // Send submission notification to admin's email
  async function handleNotifyMe() {
    if (!currentSubmission) {
      alert('No submission selected');
      return;
    }

    notifyMeBtn.disabled = true;
    notifyMeBtn.querySelector('.btn-text').style.display = 'none';
    notifyMeBtn.querySelector('.btn-loading').style.display = 'inline';

    try {
      const response = await fetch('/api/notify-submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          submissionId: currentSubmission.id,
          formType: currentFormType
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`✅ Submission sent to your email!\n\nSent to: ${data.sentTo}\nReply-To: ${data.replyTo || 'Not available'}`);
      } else {
        alert(`❌ Failed to send: ${data.error || 'Unknown error'}\n\n${data.details || ''}`);
      }
    } catch (error) {
      console.error('Notify error:', error);
      alert('❌ Unable to send notification. Please check your email settings.');
    } finally {
      notifyMeBtn.disabled = false;
      notifyMeBtn.querySelector('.btn-text').style.display = 'inline';
      notifyMeBtn.querySelector('.btn-loading').style.display = 'none';
    }
  }

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
