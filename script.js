// Global variables
let currentPDF = null;
let pdfDoc = null;
let pageNum = 1;
let scale = 1.5;
let questions = [];
let userUploadedFiles = [];
let adminUploadedFiles = [];
let downloadedFiles = JSON.parse(localStorage.getItem('downloadedFiles')) || [];
let currentTheme = localStorage.getItem('theme') || 'light';
let questionCounter = 0;
let currentQuote = null;
let savedQuotes = JSON.parse(localStorage.getItem('savedQuotes')) || [];
let isAdminAuthenticated = false;
let adminPassword = '1989';
let adminSessionTimeout = null;
let currentTab = 'viewer';

// Quote sources configuration
const quoteSources = {
    zenquotes: {
        url: 'https://zenquotes.io/api/random',
        format: (data) => ({
            text: data[0].q,
            author: data[0].a || 'Unknown',
            source: 'ZenQuotes'
        })
    },
    quotable: {
        url: 'https://api.quotable.io/random',
        format: (data) => ({
            text: data.content,
            author: data.author,
            source: 'Quotable'
        })
    }
};

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Theme management
    setupTheme();
    
    // Event listeners
    setupEventListeners();
    
    // Admin session check
    checkAdminSession();
    
    // Initialize components
    renderSavedQuotes();
    getRandomQuote();
    initializeQuestions();
    renderUserFileList();
    renderAdminFiles();
    renderDownloadHistory();
    updateDownloadCount();
    updateAdminFileCount();
    
    // Responsive adjustments
    adjustViewerHeight();
    window.addEventListener('resize', adjustViewerHeight);
    
    // Mobile interactions
    setupMobileInteractions();
}

// Theme Management
function setupTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    
    if (currentTheme === 'dark') {
        body.setAttribute('data-theme', 'dark');
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light Mode';
    }
}

function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    
    if (currentTheme === 'light') {
        body.setAttribute('data-theme', 'dark');
        currentTheme = 'dark';
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light Mode';
    } else {
        body.removeAttribute('data-theme');
        currentTheme = 'light';
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Dark Mode';
    }
    
    localStorage.setItem('theme', currentTheme);
}

// Tab Management
function switchTab(tabName) {
    if (currentTab === tabName) return;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    currentTab = tabName;
    
    // Close admin panel if open
    if (tabName !== 'admin' && isAdminAuthenticated) {
        document.getElementById('adminTabContent').classList.remove('open');
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // User upload functionality
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleUserDragOver);
    uploadArea.addEventListener('dragleave', handleUserDragLeave);
    uploadArea.addEventListener('drop', handleUserDrop);
    fileInput.addEventListener('change', handleUserFiles);
    
    // Admin file upload
    const adminFileInput = document.getElementById('adminFileInput');
    const adminUploadArea = document.getElementById('adminUploadArea');
    
    if (adminFileInput) {
        adminFileInput.addEventListener('change', handleAdminFiles);
    }
    
    if (adminUploadArea) {
        adminUploadArea.addEventListener('dragover', handleAdminDragOver);
        adminUploadArea.addEventListener('dragleave', handleAdminDragLeave);
        adminUploadArea.addEventListener('drop', handleAdminDrop);
    }
    
    // Keyboard shortcuts
    setupKeyboardShortcuts();
}

function setupMobileInteractions() {
    const sidebar = document.querySelector('.sidebar');
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1200 && !sidebar.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

// Admin Authentication
function showAdminLogin() {
    if (isAdminAuthenticated) {
        // Toggle admin panel
        const adminTabContent = document.getElementById('adminTabContent');
        adminTabContent.classList.toggle('open');
        if (adminTabContent.classList.contains('open')) {
            renderAdminFiles();
            startAdminSessionTimer();
        }
    } else {
        const modal = document.getElementById('adminLoginModal');
        if (!modal) {
            createAdminLoginModal();
        }
        document.getElementById('adminLoginModal').classList.add('show');
    }
}

function createAdminLoginModal() {
    const modal = document.createElement('div');
    modal.id = 'adminLoginModal';
    modal.className = 'admin-modal-overlay';
    modal.innerHTML = `
        <div class="admin-modal">
            <div class="admin-modal-header">
                <h3>🔐 Admin Access Required</h3>
                <button class="close-modal-btn" onclick="closeAdminLogin()">&times;</button>
            </div>
            <div class="admin-modal-body">
                <p>Enter admin password to upload and manage documents:</p>
                <div class="password-input-container">
                    <input type="password" id="adminPasswordInput" class="admin-password-input" 
                           placeholder="••••" maxlength="4" autofocus>
                    <div class="password-hint">Four-digit PIN required</div>
                </div>
                <div class="admin-login-actions">
                    <button class="btn btn-primary" onclick="authenticateAdmin()">Enter</button>
                    <button class="btn btn-secondary" onclick="closeAdminLogin()">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const passwordInput = document.getElementById('adminPasswordInput');
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            authenticateAdmin();
        }
    });
    
    passwordInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
}

function authenticateAdmin() {
    const passwordInput = document.getElementById('adminPasswordInput');
    const enteredPassword = passwordInput.value;
    
    if (enteredPassword === adminPassword) {
        isAdminAuthenticated = true;
        closeAdminLogin();
        document.querySelector('.admin-tab-btn').classList.add('admin-authenticated');
        document.getElementById('adminTabContent').classList.add('open');
        adminUploadedFiles = JSON.parse(localStorage.getItem('adminFiles')) || [];
        renderAdminFiles();
        updateAdminFileCount();
        startAdminSessionTimer();
        showNotification('✅ Admin access granted!', 'success');
        
        localStorage.setItem('adminAuthTime', Date.now());
        localStorage.setItem('adminAuthenticated', 'true');
        
    } else {
        passwordInput.classList.add('error');
        showNotification('❌ Access denied - Incorrect PIN', 'error');
        
        setTimeout(() => {
            passwordInput.classList.remove('error');
            passwordInput.value = '';
            passwordInput.focus();
        }, 2000);
    }
}

function closeAdminLogin() {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function startAdminSessionTimer() {
    let timeLeft = 30 * 60; // 30 minutes
    const timerElement = document.getElementById('adminSessionTimer');
    
    if (adminSessionTimeout) {
        clearInterval(adminSessionTimeout);
    }
    
    adminSessionTimeout = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(adminSessionTimeout);
            logoutAdmin();
            return;
        }
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        timeLeft--;
    }, 1000);
}

function logoutAdmin() {
    isAdminAuthenticated = false;
    document.querySelector('.admin-tab-btn').classList.remove('admin-authenticated');
    document.getElementById('adminTabContent').classList.remove('open');
    
    if (adminSessionTimeout) {
        clearInterval(adminSessionTimeout);
        adminSessionTimeout = null;
    }
    
    localStorage.removeItem('adminAuthenticated');
    localStorage.removeItem('adminAuthTime');
    document.getElementById('adminSessionTimer').textContent = '30:00';
    showNotification('🔒 Admin session expired', 'warning');
}

function checkAdminSession() {
    const authTime = localStorage.getItem('adminAuthTime');
    const isAuthenticated = localStorage.getItem('adminAuthenticated');
    
    if (isAuthenticated === 'true' && authTime) {
        const timeDiff = Date.now() - parseInt(authTime);
        const thirtyMinutes = 30 * 60 * 1000;
        
        if (timeDiff < thirtyMinutes) {
            isAdminAuthenticated = true;
            document.querySelector('.admin-tab-btn').classList.add('admin-authenticated');
            adminUploadedFiles = JSON.parse(localStorage.getItem('adminFiles')) || [];
            renderAdminFiles();
            updateAdminFileCount();
        } else {
            logoutAdmin();
        }
    }
}

// Admin File Management
function handleAdminFiles(e) {
    if (!isAdminAuthenticated) {
        showNotification('Admin access required', 'error');
        return;
    }
    
    const files = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
    
    files.forEach(file => {
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
            showNotification(`❌ ${file.name} is too large (max 50MB)`, 'error');
            return;
        }
        
        if (adminUploadedFiles.length >= 20) {
            showNotification('⚠️ Maximum 20 admin files allowed', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const fileData = {
                id: Date.now() + Math.random(),
                name: file.name,
                size: formatFileSize(file.size),
                originalSize: file.size,
                data: e.target.result,
                uploadedAt: new Date().toLocaleString(),
                isAdmin: true,
                downloadCount: 0
            };
            
            adminUploadedFiles.unshift(fileData);
            localStorage.setItem('adminFiles', JSON.stringify(adminUploadedFiles));
            renderAdminFiles();
            updateAdminFileCount();
            showNotification(`✅ ${file.name} uploaded successfully`, 'success');
        };
        
        reader.onerror = function() {
            showNotification(`❌ Failed to read ${file.name}`, 'error');
        };
        
        reader.readAsArrayBuffer(file);
    });

    e.target.value = '';
}

function handleAdminDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleAdminDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
}

function handleAdminDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
    const adminFileInput = document.getElementById('adminFileInput');
    adminFileInput.files = files;
    handleAdminFiles({ target: adminFileInput });
}

function renderAdminFiles() {
    if (!isAdminAuthenticated) return;
    
    const adminFileList = document.getElementById('adminFileList');
    if (!adminFileList) return;
    
    if (adminUploadedFiles.length === 0) {
        adminFileList.innerHTML = `
            <div class="admin-empty-state">
                <div class="admin-empty-icon">📚</div>
                <p>No documents available</p>
                <p class="admin-empty-subtext">Upload PDFs using the upload area above</p>
            </div>
        `;
        return;
    }
    
    adminFileList.innerHTML = adminUploadedFiles.map(file => `
        <div class="admin-file-item">
            <div class="admin-file-info">
                <div class="admin-file-icon">📄</div>
                <div>
                    <div class="admin-file-name">${file.name}</div>
                    <div class="admin-file-details">
                        <span class="admin-file-size">${file.size}</span>
                        <span class="admin-file-date">${formatDate(file.uploadedAt)}</span>
                        <span class="admin-download-count">${file.downloadCount} downloads</span>
                    </div>
                </div>
            </div>
            <div class="admin-file-actions">
                <button class="btn btn-primary" onclick="loadAdminPDF(${file.id})" title="View in main viewer">
                    👁️ View
                </button>
                <button class="btn btn-success" onclick="downloadAdminPDF(${file.id})" title="Download PDF">
                    ⬇️ Share
                </button>
                <button class="btn btn-danger" onclick="removeAdminFile(${file.id})" title="Remove document">
                    🗑️ Remove
                </button>
            </div>
        </div>
    `).join('');
}

function loadAdminPDF(fileId) {
    const file = adminUploadedFiles.find(f => f.id === fileId);
    if (!file) return;

    currentPDF = { ...file, source: 'admin' };
    const loadingTask = pdfjsLib.getDocument({ data: file.data });
    
    showLoadingState(`Loading ${file.name}...`);
    
    loadingTask.promise.then(function(pdf) {
        pdfDoc = pdf;
        pageNum = 1;
        document.getElementById('totalPages').textContent = pdf.numPages;
        renderPage(pageNum);
        showNotification(`📖 ${file.name} loaded`, 'info');
        switchTab('viewer');
    }).catch(error => {
        console.error('Error loading admin PDF:', error);
        showNotification('❌ Error loading document', 'error');
        resetViewer();
    });
}

function downloadAdminPDF(fileId) {
    const file = adminUploadedFiles.find(f => f.id === fileId);
    if (!file) return;
    
    // Increment download count
    file.downloadCount = (file.downloadCount || 0) + 1;
    localStorage.setItem('adminFiles', JSON.stringify(adminUploadedFiles));
    renderAdminFiles();
    updateAdminFileCount();
    
    // Trigger download
    const link = document.createElement('a');
    link.href = file.data;
    link.download = `admin-${Date.now()}-${file.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Log download
    logDownload(file);
    showNotification(`✅ ${file.name} shared successfully`, 'success');
}

function removeAdminFile(fileId) {
    if (confirm('Are you sure you want to permanently remove this document?')) {
        adminUploadedFiles = adminUploadedFiles.filter(f => f.id !== fileId);
        localStorage.setItem('adminFiles', JSON.stringify(adminUploadedFiles));
        renderAdminFiles();
        updateAdminFileCount();
        showNotification('🗑️ Document removed', 'info');
        
        if (currentPDF && currentPDF.id === fileId) {
            resetViewer();
        }
    }
}

function updateAdminFileCount() {
    const countElement = document.getElementById('adminFileCount');
    if (countElement) {
        countElement.textContent = adminUploadedFiles.length;
    }
}

// User File Management
function handleUserFiles(e) {
    const files = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
    
    files.forEach(file => {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            showNotification(`❌ ${file.name} is too large (max 10MB)`, 'error');
            return;
        }
        
        if (userUploadedFiles.length >= 5) {
            showNotification('⚠️ Maximum 5 files allowed', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const fileData = {
                id: Date.now() + Math.random(),
                name: file.name,
                size: formatFileSize(file.size),
                originalSize: file.size,
                data: e.target.result,
                uploadedAt: new Date().toLocaleString(),
                isAdmin: false,
                downloadCount: 0
            };
            
            userUploadedFiles.unshift(fileData);
            renderUserFileList();
            showNotification(`✅ ${file.name} uploaded`, 'success');
        };
        
        reader.onerror = function() {
            showNotification(`❌ Failed to read ${file.name}`, 'error');
        };
        
        reader.readAsArrayBuffer(file);
    });

    e.target.value = '';
}

function handleUserDragOver(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.add('dragover');
}

function handleUserDragLeave(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.remove('dragover');
}

function handleUserDrop(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
    handleUserFiles({ target: { files } });
}

function renderUserFileList() {
    const fileList = document.getElementById('fileList');
    
    if (userUploadedFiles.length === 0) {
        fileList.innerHTML = `
            <div class="file-empty-state">
                <div class="empty-icon">📁</div>
                <p>No files uploaded</p>
                <p class="empty-subtext">Drag and drop PDF files above to get started</p>
            </div>
        `;
        return;
    }
    
    fileList.innerHTML = userUploadedFiles.map(file => `
        <div class="file-item">
            <div class="file-info">
                <div class="file-icon">📄</div>
                <div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-details">
                        <span class="file-size">${file.size}</span>
                        <span class="file-date">${formatDate(file.uploadedAt)}</span>
                        <span class="file-downloads">${file.downloadCount || 0} downloads</span>
                    </div>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-primary" onclick="loadUserPDF(${file.id})">View</button>
                <button class="btn btn-success" onclick="downloadUserPDF(${file.id})">Download</button>
                <button class="btn btn-danger" onclick="removeUserFile(${file.id})">Remove</button>
            </div>
        </div>
    `).join('');
}

function loadUserPDF(fileId) {
    const file = userUploadedFiles.find(f => f.id === fileId);
    if (!file) return;

    currentPDF = { ...file, source: 'user' };
    const loadingTask = pdfjsLib.getDocument({ data: file.data });
    
    showLoadingState(`Loading ${file.name}...`);
    
    loadingTask.promise.then(function(pdf) {
        pdfDoc = pdf;
        pageNum = 1;
        document.getElementById('totalPages').textContent = pdf.numPages;
        renderPage(pageNum);
        showNotification(`📖 ${file.name} loaded`, 'info');
    }).catch(error => {
        console.error('Error loading PDF:', error);
        showNotification('❌ Error loading document', 'error');
        resetViewer();
    });
}

function downloadUserPDF(fileId) {
    const file = userUploadedFiles.find(f => f.id === fileId);
    if (!file) return;
    
    // Increment download count
    file.downloadCount = (file.downloadCount || 0) + 1;
    renderUserFileList();
    
    // Trigger download
    const link = document.createElement('a');
    link.href = file.data;
    link.download = `user-${Date.now()}-${file.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Log download
    logDownload(file);
    showNotification(`✅ ${file.name} downloaded`, 'success');
}

function removeUserFile(fileId) {
    if (confirm('Remove this file from your uploads?')) {
        userUploadedFiles = userUploadedFiles.filter(f => f.id !== fileId);
        renderUserFileList();
        showNotification('🗑️ File removed', 'info');
        
        if (currentPDF && currentPDF.id === fileId) {
            resetViewer();
        }
    }
}

// Download Tracking
function logDownload(file) {
    const downloadRecord = {
        id: Date.now(),
        name: file.name,
        size: file.size,
        originalSize: file.originalSize,
        source: file.isAdmin ? 'admin' : 'user',
        downloadedAt: new Date().toLocaleString(),
        timestamp: Date.now()
    };
    
    downloadedFiles.unshift(downloadRecord);
    
    // Keep only last 100 downloads
    if (downloadedFiles.length > 100) {
        downloadedFiles = downloadedFiles.slice(0, 100);
    }
    
    localStorage.setItem('downloadedFiles', JSON.stringify(downloadedFiles));
    renderDownloadHistory();
    updateDownloadCount();
}

function renderDownloadHistory() {
    const downloadsList = document.getElementById('downloadsList');
    
    if (downloadedFiles.length === 0) {
        downloadsList.innerHTML = `
            <div class="download-empty-state">
                <div class="empty-icon">📥</div>
                <p>No downloads yet</p>
                <p class="empty-subtext">Download PDFs from the Viewer tab to see them here</p>
            </div>
        `;
        return;
    }
    
    downloadsList.innerHTML = downloadedFiles.map(download => `
        <div class="download-item">
            <div class="download-file-info">
                <div class="download-icon">📄</div>
                <div class="download-filename">${download.name}</div>
            </div>
            <div class="download-size">${download.size}</div>
            <div class="download-date">${formatDate(download.downloadedAt)}</div>
            <div class="download-source ${download.source}">${download.source}</div>
            <div class="download-actions">
                <button class="btn btn-secondary" onclick="reDownload(${download.id})" title="Download again">↻</button>
                <button class="btn btn-danger" onclick="removeDownload(${download.id})" title="Remove from history">×</button>
            </div>
        </div>
    `).join('');
}

function reDownload(downloadId) {
    const download = downloadedFiles.find(d => d.id === downloadId);
    if (!download) return;
    
    // This would typically trigger a re-download, but since we don't store the actual file data in history,
    // we'll just log it as a re-download
    logDownload({
        name: download.name,
        size: download.size,
        originalSize: download.originalSize,
        isAdmin: download.source === 'admin',
        source: download.source
    });
    
    showNotification(`🔄 ${download.name} re-downloaded`, 'info');
}

function removeDownload(downloadId) {
    if (confirm('Remove this download from history?')) {
        downloadedFiles = downloadedFiles.filter(d => d.id !== downloadId);
        localStorage.setItem('downloadedFiles', JSON.stringify(downloadedFiles));
        renderDownloadHistory();
        updateDownloadCount();
        showNotification('🗑️ Download removed from history', 'info');
    }
}

function clearDownloads() {
    if (confirm('Clear all download history? This cannot be undone.')) {
        downloadedFiles = [];
        localStorage.removeItem('downloadedFiles');
        renderDownloadHistory();
        updateDownloadCount();
        showNotification('🗑️ Download history cleared', 'info');
    }
}

function exportDownloads() {
    if (downloadedFiles.length === 0) {
        showNotification('No downloads to export', 'warning');
        return;
    }
    
    const exportData = {
        exportedAt: new Date().toLocaleString(),
        totalDownloads: downloadedFiles.length,
        downloads: downloadedFiles
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `download-history-${formatDate(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('📤 Download history exported', 'success');
}

function updateDownloadCount() {
    const countElement = document.getElementById('downloadCount');
    if (countElement) {
        countElement.textContent = downloadedFiles.length;
    }
}

// PDF Viewer Functions
function downloadCurrentPDF() {
    if (!currentPDF) {
        showNotification('No PDF loaded', 'warning');
        return;
    }
    
    if (currentPDF.isAdmin && !isAdminAuthenticated) {
        showNotification('🔒 Admin documents require authentication', 'warning');
        showAdminLogin();
        return;
    }
    
    const fileForDownload = {
        ...currentPDF,
        isAdmin: currentPDF.source === 'admin'
    };
    
    const link = document.createElement('a');
    link.href = currentPDF.data;
    link.download = `${currentPDF.source}-${Date.now()}-${currentPDF.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Log the download
    logDownload(fileForDownload);
    
    if (currentPDF.source === 'admin') {
        // Update admin file download count
        const adminFile = adminUploadedFiles.find(f => f.id === currentPDF.id);
        if (adminFile) {
            adminFile.downloadCount = (adminFile.downloadCount || 0) + 1;
            localStorage.setItem('adminFiles', JSON.stringify(adminUploadedFiles));
            renderAdminFiles();
        }
    } else {
        // Update user file download count
        const userFile = userUploadedFiles.find(f => f.id === currentPDF.id);
        if (userFile) {
            userFile.downloadCount = (userFile.downloadCount || 0) + 1;
            renderUserFileList();
        }
    }
    
    showNotification(`✅ ${currentPDF.name} downloaded`, 'success');
}

function showLoadingState(message) {
    const viewerContainer = document.getElementById('viewerContainer');
    viewerContainer.innerHTML = `
        <div class="viewer-loading">
            <div class="loading-spinner-large"></div>
            <p>${message}</p>
        </div>
    `;
}

function renderPage(num) {
    if (!pdfDoc) return;
    
    pageNum = num;
    document.getElementById('currentPage').textContent = pageNum;
    const totalPages = document.getElementById('totalPages');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    prevBtn.disabled = pageNum <= 1;
    nextBtn.disabled = pageNum >= pdfDoc.numPages;
    
    const viewerContainer = document.getElementById('viewerContainer');
    showLoadingState('Rendering page...');

    pdfDoc.getPage(num).then(function(page) {
        const viewport = page.getViewport({ scale: scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        const renderTask = page.render(renderContext);
        renderTask.promise.then(function () {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'pdf-page';
            pageDiv.appendChild(canvas);
            
            viewerContainer.innerHTML = '';
            viewerContainer.appendChild(pageDiv);
        }).catch(error => {
            console.error('Error rendering page:', error);
            viewerContainer.innerHTML = `
                <div class="viewer-placeholder">
                    <div class="placeholder-icon">⚠️</div>
                    <p>Error rendering page ${pageNum}</p>
                    <p class="placeholder-subtext">Please try again</p>
                </div>
            `;
        });
    });
}

function previousPage() {
    if (pageNum <= 1 || !pdfDoc) return;
    renderPage(pageNum - 1);
}

function nextPage() {
    if (pageNum >= pdfDoc.numPages || !pdfDoc) return;
    renderPage(pageNum + 1);
}

function resetViewer() {
    const viewerContainer = document.getElementById('viewerContainer');
    viewerContainer.innerHTML = `
        <div class="viewer-placeholder">
            <div class="placeholder-icon">📄</div>
            <p>Select a PDF to view</p>
            <p class="placeholder-subtext">Upload files or contact admin for access</p>
        </div>
    `;
    document.getElementById('currentPage').textContent = '1';
    document.getElementById('totalPages').textContent = '1';
    document.getElementById('prevPage').disabled = true;
    document.getElementById('nextPage').disabled = true;
    currentPDF = null;
    pdfDoc = null;
}

// Questions Management
function initializeQuestions() {
    // Start with empty questions
    renderQuestions();
}

function addQuestion(type = 'text', text = 'New note...') {
    questionCounter++;
    const questionId = `q${questionCounter}`;
    const question = {
        id: questionId,
        type: type,
        text: text,
        answer: '',
        createdAt: new Date().toLocaleString()
    };
    
    questions.unshift(question);
    renderQuestions();
    showNotification('📝 New note added', 'info');
}

function renderQuestions() {
    const container = document.getElementById('questionsContainer');
    
    if (questions.length === 0) {
        container.innerHTML = `
            <div class="question-placeholder">
                <div class="placeholder-icon">📝</div>
                <p>No notes yet</p>
                <p class="placeholder-subtext">Click "Add Note" to start taking notes about your document</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = questions.map((question, index) => `
        <div class="question-item" data-id="${question.id}">
            <div class="question-header">
                <div class="question-number">${index + 1}</div>
                <div class="question-main">
                    <input type="text" class="question-text" value="${question.text}" 
                           placeholder="Enter note title..." 
                           oninput="updateQuestion('${question.id}', 'text', this.value)">
                    <textarea class="question-input" placeholder="Enter your notes here..."
                              oninput="updateQuestion('${question.id}', 'answer', this.value)">${question.answer}</textarea>
                </div>
                <div class="question-actions">
                    <select class="question-type-select" onchange="updateQuestion('${question.id}', 'type', this.value)">
                        <option value="text" ${question.type === 'text' ? 'selected' : ''}>Note</option>
                        <option value="question" ${question.type === 'question' ? 'selected' : ''}>Question</option>
                        <option value="highlight" ${question.type === 'highlight' ? 'selected' : ''}>Highlight</option>
                    </select>
                    <button class="remove-question" onclick="removeQuestion('${question.id}')">×</button>
                </div>
            </div>
            <div class="question-meta">
                <span class="question-date">${formatDate(question.createdAt)}</span>
                <span class="question-type-badge ${question.type}">${question.type}</span>
            </div>
        </div>
    `).join('');
}

function updateQuestion(id, field, value) {
    const question = questions.find(q => q.id === id);
    if (question) {
        question[field] = value;
        if (field === 'text' && question.text.trim() === '') {
            removeQuestion(id);
        }
    }
}

function removeQuestion(id) {
    questions = questions.filter(q => q.id !== id);
    renderQuestions();
    showNotification('🗑️ Note removed', 'info');
}

function saveQuestions() {
    if (questions.length === 0) {
        showNotification('No notes to save', 'warning');
        return;
    }
    
    const exportData = {
        document: currentPDF ? currentPDF.name : 'General Notes',
        createdAt: new Date().toLocaleString(),
        totalNotes: questions.length,
        notes: questions
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notes-${currentPDF ? currentPDF.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'general'}-${formatDate(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('📝 Notes exported successfully', 'success');
}

// Quote Management
async function getRandomQuote() {
    const quoteLoading = document.getElementById('quoteLoading');
    const quoteContent = document.getElementById('quoteContent');
    
    quoteLoading.classList.add('active');
    quoteContent.classList.remove('show');
    
    try {
        const sources = Object.keys(quoteSources);
        const randomSource = sources[Math.floor(Math.random() * sources.length)];
        const source = quoteSources[randomSource];
        
        const response = await fetch(source.url);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        currentQuote = source.format(data);
        
        displayQuote();
        
    } catch (error) {
        console.error('Error fetching quote:', error);
        displayFallbackQuote();
    }
}

function displayQuote() {
    const quoteText = document.getElementById('quoteText');
    const quoteAuthor = document.getElementById('quoteAuthor');
    const quoteSource = document.getElementById('quoteSource');
    const quoteContent = document.getElementById('quoteContent');
    const quoteLoading = document.getElementById('quoteLoading');
    
    quoteText.textContent = `"${currentQuote.text}"`;
    quoteAuthor.textContent = `— ${currentQuote.author}`;
    quoteSource.textContent = currentQuote.source;
    
    quoteLoading.classList.remove('active');
    quoteContent.classList.add('show');
}

function displayFallbackQuote() {
    const fallbackQuotes = [
        { text: "The only way to do great work is to love what you do.", author: "Steve Jobs", source: "Timeless Wisdom" },
        { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs", source: "Innovation" },
        { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt", source: "Dreams" },
        { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill", source: "Perseverance" },
        { text: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt", source: "Potential" }
    ];
    
    currentQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    displayQuote();
}

async function getQuoteByCategory(category) {
    try {
        const response = await fetch(`https://api.quotable.io/random?tags=${category}`);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        currentQuote = {
            text: data.content,
            author: data.author,
            source: `Inspiration - ${category.charAt(0).toUpperCase() + category.slice(1)}`
        };
        
        displayQuote();
        
    } catch (error) {
        console.error('Error fetching category quote:', error);
        displayFallbackQuote();
    }
}

function shareQuote() {
    if (!currentQuote) {
        showNotification('No quote to share', 'warning');
        return;
    }
    
    const shareText = `"${currentQuote.text}" — ${currentQuote.author}\n\n${currentQuote.source}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Daily Inspiration',
            text: shareText
        }).catch(() => {
            copyToClipboard(shareText);
        });
    } else {
        copyToClipboard(shareText);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('📋 Quote copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback to prompt
        prompt('Copy this quote:', text);
        showNotification('📋 Quote ready to copy', 'info');
    });
}

function saveQuote() {
    if (!currentQuote) {
        showNotification('No quote to save', 'warning');
        return;
    }
    
    const isDuplicate = savedQuotes.some(q => 
        q.text === currentQuote.text && q.author === currentQuote.author
    );
    
    if (isDuplicate) {
        showNotification('Quote already in favorites', 'warning');
        return;
    }
    
    const quoteToSave = {
        id: Date.now(),
        ...currentQuote,
        savedAt: new Date().toLocaleString()
    };
    
    savedQuotes.unshift(quoteToSave);
    
    if (savedQuotes.length > 20) {
        savedQuotes = savedQuotes.slice(0, 20);
    }
    
    localStorage.setItem('savedQuotes', JSON.stringify(savedQuotes));
    renderSavedQuotes();
    showNotification('⭐ Quote saved to favorites', 'success');
}

function renderSavedQuotes() {
    const container = document.querySelector('.quote-categories');
    const savedSection = container.querySelector('.saved-quotes-section');
    
    if (!savedSection) {
        container.innerHTML += `
            <div class="saved-quotes-section">
                <h4>Favorites (${savedQuotes.length})</h4>
                <div class="saved-quotes-list"></div>
            </div>
        `;
    }
    
    const savedList = container.querySelector('.saved-quotes-list');
    
    if (savedQuotes.length === 0) {
        savedList.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px; font-style: italic;">No favorite quotes yet</div>';
        return;
    }
    
    savedList.innerHTML = savedQuotes.slice(0, 4).map(quote => `
        <div class="saved-quote-item" onclick="loadSavedQuote(${quote.id})" title="Click to view">
            <div class="saved-quote-text">${quote.text.substring(0, 60)}${quote.text.length > 60 ? '...' : ''}</div>
            <div class="saved-quote-author">— ${quote.author}</div>
        </div>
    `).join('');
}

function loadSavedQuote(quoteId) {
    const quote = savedQuotes.find(q => q.id === quoteId);
    if (quote) {
        currentQuote = quote;
        displayQuote();
        showNotification('⭐ Loaded favorite quote', 'info');
    }
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function adjustViewerHeight() {
    const viewerContainer = document.getElementById('viewerContainer');
    const availableHeight = window.innerHeight - 200;
    viewerContainer.style.height = Math.max(400, availableHeight) + 'px';
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Only trigger shortcuts when not in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    previousPage();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    nextPage();
                    break;
                case '1':
                    e.preventDefault();
                    switchTab('viewer');
                    break;
                case '2':
                    e.preventDefault();
                    switchTab('downloads');
                    break;
                case '3':
                    e.preventDefault();
                    showAdminLogin();
                    break;
                case 'Enter':
                    if (e.shiftKey) {
                        e.preventDefault();
                        addQuestion();
                    }
                    break;
                case 's':
                    if (e.shiftKey) {
                        e.preventDefault();
                        saveQuestions();
                    }
                    break;
            }
        }
    });
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Global Functions for onclick handlers
window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.showAdminLogin = showAdminLogin;
window.authenticateAdmin = authenticateAdmin;
window.closeAdminLogin = closeAdminLogin;
window.logoutAdmin = logoutAdmin;
window.getNewQuote = getNewQuote;
window.getQuoteByCategory = getQuoteByCategory;
window.shareQuote = shareQuote;
window.saveQuote = saveQuote;
window.loadSavedQuote = loadSavedQuote;
window.addQuestion = addQuestion;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.downloadCurrentPDF = downloadCurrentPDF;
window.removeUserFile = removeUserFile;
window.saveQuestions = saveQuestions;
window.removeQuestion = removeQuestion;
window.updateQuestion = updateQuestion;
window.loadAdminPDF = loadAdminPDF;
window.downloadAdminPDF = downloadAdminPDF;
window.removeAdminFile = removeAdminFile;
window.clearDownloads = clearDownloads;
window.exportDownloads = exportDownloads;
window.reDownload = reDownload;
window.removeDownload = removeDownload;
window.loadUserPDF = loadUserPDF;
window.downloadUserPDF = downloadUserPDF;
