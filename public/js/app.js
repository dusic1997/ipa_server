// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const appsList = document.getElementById('appsList');
const loadingApps = document.getElementById('loadingApps');
const emptyState = document.getElementById('emptyState');
const installModal = document.getElementById('installModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose = document.getElementById('modalClose');
const confirmModal = document.getElementById('confirmModal');
const confirmBackdrop = document.getElementById('confirmBackdrop');
const confirmCancel = document.getElementById('confirmCancel');
const confirmOk = document.getElementById('confirmOk');
const noticeClose = document.getElementById('noticeClose');
const certNotice = document.getElementById('certNotice');

// State
let apps = [];
let appToDelete = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadApps();
    setupEventListeners();
    checkCertNotice();
});

// Event Listeners
function setupEventListeners() {
    // Upload area click
    uploadArea.addEventListener('click', () => {
        if (!uploadArea.classList.contains('uploading')) {
            fileInput.click();
        }
    });

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // Modal
    modalBackdrop.addEventListener('click', closeModal);
    modalClose.addEventListener('click', closeModal);

    // Confirm Modal
    confirmBackdrop.addEventListener('click', closeConfirmModal);
    confirmCancel.addEventListener('click', closeConfirmModal);
    confirmOk.addEventListener('click', executeDelete);

    // Certificate notice
    noticeClose.addEventListener('click', () => {
        certNotice.classList.add('hidden');
        localStorage.setItem('certNoticeDismissed', 'true');
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeConfirmModal();
        }
    });
}

// Check if cert notice should be shown
function checkCertNotice() {
    if (localStorage.getItem('certNoticeDismissed') === 'true') {
        certNotice.classList.add('hidden');
    }
}

// Drag and Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

// File Handlers
function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.ipa')) {
        showToast('请选择 .ipa 文件', 'error');
        return;
    }

    uploadFile(file);
}

// Upload File
async function uploadFile(file) {
    uploadArea.classList.add('uploading');
    progressFill.style.width = '0%';
    progressText.textContent = '准备上传...';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = `${percent}%`;
                progressText.textContent = `上传中... ${percent}%`;
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                if (response.success) {
                    showToast('上传成功！', 'success');
                    loadApps();
                } else {
                    showToast(response.error || '上传失败', 'error');
                }
            } else {
                const response = JSON.parse(xhr.responseText);
                showToast(response.error || '上传失败', 'error');
            }
            resetUpload();
        });

        xhr.addEventListener('error', () => {
            showToast('上传失败，请重试', 'error');
            resetUpload();
        });

        xhr.open('POST', '/api/upload');
        xhr.send(formData);
    } catch (error) {
        showToast('上传失败: ' + error.message, 'error');
        resetUpload();
    }
}

function resetUpload() {
    uploadArea.classList.remove('uploading');
    fileInput.value = '';
    progressFill.style.width = '0%';
}

// Load Apps
async function loadApps() {
    try {
        loadingApps.style.display = 'block';
        emptyState.style.display = 'none';

        // Remove existing app cards
        document.querySelectorAll('.app-card').forEach(el => el.remove());

        const response = await fetch('/api/apps');
        apps = await response.json();

        loadingApps.style.display = 'none';

        if (apps.length === 0) {
            emptyState.style.display = 'block';
        } else {
            renderApps();
        }
    } catch (error) {
        loadingApps.style.display = 'none';
        showToast('加载应用列表失败', 'error');
    }
}

// Render Apps
function renderApps() {
    apps.forEach(app => {
        const card = createAppCard(app);
        appsList.appendChild(card);
    });
}

function createAppCard(app) {
    const card = document.createElement('div');
    card.className = 'app-card';
    card.innerHTML = `
    <div class="app-icon">
      ${app.icon
            ? `<img src="${app.icon}" alt="${app.name}" onerror="this.parentElement.innerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/></svg>'">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`
        }
    </div>
    <div class="app-info">
      <h3 class="app-name">${escapeHtml(app.name)}</h3>
      <div class="app-meta">
        <span>版本 ${escapeHtml(app.version)}</span>
        <span>${formatSize(app.size)}</span>
        <span>${formatDate(app.uploadedAt)}</span>
      </div>
    </div>
    <div class="app-actions">
      <button class="btn btn-primary" onclick="openInstallModal('${app.id}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        安装
      </button>
      <button class="btn btn-icon" onclick="deleteApp('${app.id}')" title="删除">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;
    return card;
}

// Install Modal
async function openInstallModal(appId) {
    const app = apps.find(a => a.id === appId);
    if (!app) return;

    // Set modal content
    document.getElementById('modalAppName').textContent = app.name;
    document.getElementById('modalAppVersion').textContent = `版本 ${app.version} (${app.buildVersion})`;

    const modalIcon = document.getElementById('modalIcon');
    if (app.icon) {
        modalIcon.src = app.icon;
        modalIcon.style.display = 'block';
    } else {
        modalIcon.style.display = 'none';
    }

    // Set install link - use the actual host (IP address for LAN access)
    const host = window.location.host;
    const manifestUrl = encodeURIComponent(`https://${host}/manifest/${app.id}`);
    const installUrl = `itms-services://?action=download-manifest&url=${manifestUrl}`;

    const installButton = document.getElementById('installButton');
    installButton.href = installUrl;

    // Store the URL for direct click handling
    installButton.dataset.installUrl = installUrl;

    // Remove old handler and add new one
    installButton.onclick = function (e) {
        e.preventDefault();
        window.location.href = this.dataset.installUrl;
        return false;
    };

    // Get QR code
    try {
        const response = await fetch(`/api/qrcode/${app.id}`);
        const data = await response.json();
        document.getElementById('qrCode').src = data.qrcode;
    } catch (error) {
        console.error('Failed to load QR code:', error);
    }

    // Show modal
    installModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    installModal.classList.remove('active');
    document.body.style.overflow = '';
}

// Delete App
function deleteApp(appId) {
    appToDelete = appId;
    confirmModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeConfirmModal() {
    confirmModal.classList.remove('active');
    document.body.style.overflow = '';
    appToDelete = null;
}

async function executeDelete() {
    if (!appToDelete) return;

    const appId = appToDelete;
    closeConfirmModal();

    try {
        const response = await fetch(`/api/apps/${appId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('删除成功', 'success');
            loadApps();
        } else {
            showToast('删除失败', 'error');
        }
    } catch (error) {
        showToast('删除失败', 'error');
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success'
            ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
            : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
        }
    </svg>
    <p>${escapeHtml(message)}</p>
  `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Helpers
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';

    return date.toLocaleDateString('zh-CN');
}
