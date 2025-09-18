// Global variables
let currentPDF = null;
let pdfDoc = null;
let pageNum = 1;
let scale = 1.5;
let questions = [];
let uploadedFiles = [];
let currentTheme = localStorage.getItem('theme') || 'light';
let questionCounter = 0;
let currentQuote = null;
let savedQuotes = JSON.parse(localStorage.getItem('savedQuotes')) || [];
let isAdminAuthenticated = false;
let adminPassword = '1989'; // Hardcoded admin password
let adminUploadedFiles = []; // Separate storage for admin PDFs

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
    },
    typefit: {
        url: 'https://type.fit/api/quotes',
        format: (data, index) => ({
            text: data[index].text,
            author: data[index].author || 'Unknown',
            source: 'Type.fit'
        })
    }
};

// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Theme management
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

// Set initial theme
if (currentTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    document.getElementById('themeIcon').textContent = '☀️';
    document.getElementById('themeText').textContent = 'Light Mode';
}

// Admin Authentication
function showAdminLogin() {
    const adminTab = document.getElementById('adminTab');
    const adminLoginModal = document.getElementById('adminLoginModal');
    
    if (!adminLoginModal) {
        // Create modal if it doesn't exist
        createAdminLoginModal();
    }
    
    adminLoginModal.style.display = 'flex';
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
                <p>Enter admin password to access document management:</p>
                <div class="password-input-container">
                    <input type="password" id="adminPasswordInput" class="admin-password-input" 
                           placeholder="Enter password..." maxlength="4" autofocus>
                    <div class="password-hint">Hint: Four digits</div>
                </div>
                <div class="admin-login-actions">
                    <button class="btn btn-primary" onclick="authenticateAdmin()">Login</button>
                    <button class="btn btn-secondary" onclick="closeAdminLogin()">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const passwordInput = document.getElementById('adminPasswordInput');
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            authenticateAdmin();
        }
    });
    
    passwordInput.addEventListener('input', function(e) {
        // Only allow numeric input
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
}

function authenticateAdmin() {
    const passwordInput = document.getElementById('adminPasswordInput');
    const enteredPassword = passwordInput.value;
    
    if (enteredPassword === adminPassword) {
        isAdminAuthenticated = true;
        closeAdminLogin();
        document.getElementById('adminTab').classList.add('admin-authenticated');
        renderAdminFiles();
        showNotification('Admin access granted! 👨‍💼', 'success');
        
        // Store authentication temporarily (expires in 30 minutes)
        localStorage.setItem('adminAuthTime', Date.now());
        localStorage.setItem('adminAuthenticated', 'true');
        
        setTimeout(() => {
            logoutAdmin();
        }, 30 * 60 * 1000); // 30 minutes
        
    } else {
        passwordInput.style.borderColor = 'var(--danger-color)';
        passwordInput.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
        showNotification('❌ Incorrect password', 'error');
        
        setTimeout(() => {
            passwordInput.style.borderColor = 'var(--border-color)';
            passwordInput.style.boxShadow = 'none';
            passwordInput.value = '';
            passwordInput.focus();
        }, 2000);
    }
}

function closeAdminLogin() {
    const adminLoginModal = document.getElementById('adminLoginModal');
    if (adminLoginModal) {
        adminLoginModal.style.display = 'none';
    }
}

function logoutAdmin() {
    isAdminAuthenticated = false;
    document.getElementById('adminTab').classList.remove('admin-authenticated');
    localStorage.removeItem('adminAuthenticated');
    localStorage.removeItem('adminAuthTime');
    adminUploadedFiles = [];
    showNotification('Admin session expired', 'warning');
}

// Check for existing admin session
function checkAdminSession() {
    const authTime = localStorage.getItem('adminAuthTime');
    const isAuthenticated = localStorage.getItem('adminAuthenticated');
    
    if (isAuthenticated === 'true' && authTime) {
        const timeDiff = Date.now() - parseInt(authTime);
        const thirtyMinutes = 30 * 60 * 1000;
        
        if (timeDiff < thirtyMinutes) {
            isAdminAuthenticated = true;
            document.getElementById('adminTab').classList.add('admin-authenticated');
            adminUploadedFiles = JSON.parse(localStorage.getItem('adminFiles')) || [];
            renderAdminFiles();
        } else {
            logoutAdmin();
        }
    }
}

// Admin PDF Management
function handleAdminFileUpload(e) {
    if (!isAdminAuthenticated) {
        showNotification('Admin access required', 'error');
        return;
    }
    
    const files = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
    
    files.forEach(file => {
        if (file.size > 50 * 1024 * 1024) { // 50MB limit for admin
            showNotification(`File ${file.name} is too large (max 50MB)`, 'error');
            return;
        }
        
        if (adminUploadedFiles.length >= 20) { // Max 20 admin files
            showNotification('Maximum 20 admin files allowed', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const fileData = {
                name: file.name,
                size: formatFileSize(file.size),
                data: e.target.result,
                id: Date.now() + Math.random(),
                uploadedAt: new Date().toLocaleString(),
                isAdmin: true
            };
            
            adminUploadedFiles.push(fileData);
            localStorage.setItem('adminFiles', JSON.stringify(adminUploadedFiles));
            renderAdminFiles();
            showNotification(`Admin uploaded: ${file.name}`, 'success');
        };
        reader.readAsArrayBuffer(file);
    });

    e.target.value = '';
}

function renderAdminFiles() {
    if (!isAdminAuthenticated) return;
    
    const adminFileList = document.getElementById('adminFileList');
    if (!adminFileList) return;
    
    adminFileList.innerHTML = adminUploadedFiles.length > 0 ? 
        adminUploadedFiles.map(file => `
            <div class="admin-file-item">
                <div class="admin-file-info">
                    <div class="admin-file-icon">🔐</div>
                    <div>
                        <div class="admin-file-name">${file.name}</div>
                        <div class="admin-file-details">
                            <span class="admin-file-size">${file.size}</span>
                            <span class="admin-file-date">${file.uploadedAt}</span>
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
                    <button class="btn btn-danger" onclick="removeAdminFile(${file.id})" title="Remove from admin">
                        🗑️ Remove
                    </button>
                </div>
            </div>
        `).join('') : 
        '<div class="admin-empty-state">
            <div class="admin-empty-icon">📚</div>
            <p>No admin documents yet</p>
            <p class="admin-empty-subtext">Upload PDFs to make them available for download</p>
        </div>';
}

function loadAdminPDF(fileId) {
    if (!isAdminAuthenticated) return;
    
    const file = adminUploadedFiles.find(f => f.id === fileId);
    if (!file) return;

    currentPDF = file;
    const loadingTask = pdfjsLib.getDocument({ data: file.data });
    
    loadingTask.promise.then(function(pdf) {
        pdfDoc = pdf;
        pageNum = 1;
        document.getElementById('totalPages').textContent = pdf.numPages;
        renderPage(pageNum);
        showNotification(`Loaded admin document: ${file.name}`, 'info');
    }).catch(error => {
        console.error('Error loading admin PDF:', error);
        showNotification('Error loading admin PDF', 'error');
    });
}

function downloadAdminPDF(fileId) {
    if (!isAdminAuthenticated) {
        showNotification('Admin access required to download', 'error');
        return;
    }
    
    const file = adminUploadedFiles.find(f => f.id === fileId);
    if (!file) return;
    
    const link = document.createElement('a');
    link.href = file.data;
    link.download = `admin-${file.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Admin download: ${file.name}`, 'success');
}

function removeAdminFile(fileId) {
    if (!isAdminAuthenticated) return;
    
    if (confirm('Are you sure you want to remove this admin document?')) {
        adminUploadedFiles = adminUploadedFiles.filter(f => f.id !== fileId);
        localStorage.setItem('adminFiles', JSON.stringify(adminUploadedFiles));
        renderAdminFiles();
        showNotification('Admin document removed', 'info');
        
        // Also remove from main viewer if currently loaded
        if (currentPDF && currentPDF.id === fileId) {
            currentPDF = null;
            pdfDoc = null;
            document.getElementById('viewerContainer').innerHTML = 
                '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">Select a PDF to view</div>';
            document.getElementById('currentPage').textContent = '1';
            document.getElementById('totalPages').textContent = '1';
        }
    }
}

// Modified download functions for regular users
function downloadCurrentPDF() {
    if (!currentPDF) {
        showNotification('No PDF loaded', 'error');
        return;
    }
    
    // Check if current PDF is admin-only
    if (currentPDF.isAdmin) {
        showNotification('🔒 Admin documents can only be downloaded by administrators', 'warning');
        showAdminLogin();
        return;
    }
    
    const link = document.createElement('a');
    link.href = currentPDF.data;
    link.download = currentPDF.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Download started', 'success');
}

function downloadPDF(fileId) {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file) return;
    
    // Check if file is admin-only
    if (file.isAdmin) {
        showNotification('🔒 Admin documents can only be downloaded by administrators', 'warning');
        showAdminLogin();
        return;
    }
    
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Download started', 'success');
}

// Quote functionality
async function getRandomQuote() {
    const quoteLoading = document.getElementById('quoteLoading');
    const quoteContent = document.getElementById('quoteContent');
    
    quoteLoading.style.display = 'flex';
    quoteContent.style.display = 'none';
    
    try {
        // Randomly select a source
        const sources = Object.keys(quoteSources);
        const randomSource = sources[Math.floor(Math.random() * sources.length)];
        const source = quoteSources[randomSource];
        
        const response = await fetch(source.url);
        const data = await response.json();
        
        if (randomSource === 'typefit') {
            // Type.fit returns an array, pick random
            const randomIndex = Math.floor(Math.random() * data.length);
            currentQuote = source.format(data, randomIndex);
        } else {
            currentQuote = source.format(data);
        }
        
        displayQuote();
        showNotification('New inspiration loaded!', 'success');
        
    } catch (error) {
        console.error('Error fetching quote:', error);
        // Fallback to local quotes
        displayFallbackQuote();
        showNotification('Using local inspiration', 'info');
    }
}

function displayQuote() {
    const quoteLoading = document.getElementById('quoteLoading');
    const quoteText = document.getElementById('quoteText');
    const quoteAuthor = document.getElementById('quoteAuthor');
    const quoteSource = document.getElementById('quoteSource');
    const quoteContent = document.getElementById('quoteContent');
    
    quoteText.textContent = `"${currentQuote.text}"`;
    quoteAuthor.textContent = `— ${currentQuote.author}`;
    quoteSource.textContent = currentQuote.source;
    
    quoteLoading.style.display = 'none';
    quoteContent.style.display = 'block';
    
    // Animate the quote appearance
    quoteContent.style.opacity = '0';
    quoteContent.style.transform = 'translateY(20px)';
    setTimeout(() => {
        quoteContent.style.transition = 'all 0.5s ease';
        quoteContent.style.opacity = '1';
        quoteContent.style.transform = 'translateY(0)';
    }, 100);
}

function displayFallbackQuote() {
    const fallbackQuotes = [
        {
            text: "The only way to do great work is to love what you do.",
            author: "Steve Jobs",
            source: "Local Wisdom"
        },
        {
            text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
            author: "Winston Churchill",
            source: "Local Wisdom"
        },
        {
            text: "Innovation distinguishes between a leader and a follower.",
            author: "Steve Jobs",
            source: "Local Wisdom"
        },
        {
            text: "The future belongs to those who believe in the beauty of their dreams.",
            author: "Eleanor Roosevelt",
            source: "Local Wisdom"
        },
        {
            text: "It does not matter how slowly you go as long as you do not stop.",
            author: "Confucius",
            source: "Local Wisdom"
        }
    ];
    
    const randomQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
    currentQuote = randomQuote;
    displayQuote();
}

async function getQuoteByCategory(category) {
    try {
        // Using Quotable API with tags
        const response = await fetch(`https://api.quotable.io/random?tags=${category}`);
        const data = await response.json();
        
        currentQuote = {
            text: data.content,
            author: data.author,
            source: `Quotable - ${category.charAt(0).toUpperCase() + category.slice(1)}`
        };
        
        displayQuote();
        showNotification(`${category} quote loaded!`, 'info');
        
    } catch (error) {
        console.error('Error fetching category quote:', error);
        displayFallbackQuote();
        showNotification('Category quote unavailable, showing random inspiration', 'warning');
    }
}

function shareQuote() {
    if (!currentQuote) {
        showNotification('No quote to share', 'error');
        return;
    }
    
    const shareText = `"${currentQuote.text}" — ${currentQuote.author}\n#DailyMotivation #${currentQuote.source}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Daily Motivation',
            text: shareText,
            url: window.location.href
        });
    } else {
        // Fallback to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
            showNotification('Quote copied to clipboard!', 'success');
        }).catch(() => {
            // Ultimate fallback - open email
            const mailtoLink = `mailto:?subject=Daily Motivation&body=${encodeURIComponent(shareText)}`;
            window.location.href = mailtoLink;
        });
    }
}

function saveQuote() {
    if (!currentQuote) {
        showNotification('No quote to save', 'error');
        return;
    }
    
    // Check if already saved
    const isDuplicate = savedQuotes.some(q => 
        q.text === currentQuote.text && q.author === currentQuote.author
    );
    
    if (isDuplicate) {
        showNotification('Quote already saved!', 'warning');
        return;
    }
    
    const quoteToSave = {
        id: Date.now(),
        ...currentQuote,
        savedAt: new Date().toLocaleString()
    };
    
    savedQuotes.unshift(quoteToSave);
    
    // Limit to 10 saved quotes
    if (savedQuotes.length > 10) {
        savedQuotes = savedQuotes.slice(0, 10);
    }
    
    localStorage.setItem('savedQuotes', JSON.stringify(savedQuotes));
    renderSavedQuotes();
    showNotification('Quote saved to favorites!', 'success');
}

function removeSavedQuote(quoteId) {
    savedQuotes = savedQuotes.filter(q => q.id !== quoteId);
    localStorage.setItem('savedQuotes', JSON.stringify(savedQuotes));
    renderSavedQuotes();
    showNotification('Quote removed from favorites', 'info');
}

function renderSavedQuotes() {
    const container = document.getElementById('savedQuotesList');
    
    if (savedQuotes.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px; font-style: italic;">No saved quotes yet</div>';
        return;
    }
    
    container.innerHTML = savedQuotes.map(quote => `
        <div class="saved-quote-item" onclick="loadSavedQuote(${quote.id})">
            <div>
                <div class="saved-quote-text">${quote.text}</div>
                <div class="saved-quote-author">${quote.author}</div>
            </div>
            <button class="saved-quote-remove" onclick="event.stopPropagation(); removeSavedQuote(${quote.id})">×</button>
        </div>
    `).join('');
}

function loadSavedQuote(quoteId) {
    const quote = savedQuotes.find(q => q.id === quoteId);
    if (quote) {
        currentQuote = quote;
        displayQuote();
        showNotification('Loaded saved quote!', 'info');
    }
}

function getNewQuote() {
    getRandomQuote();
}

// Regular user upload functionality (unchanged)
document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFiles);

    // Admin file upload setup
    const adminFileInput = document.getElementById('adminFileInput');
    if (adminFileInput) {
        adminFileInput.addEventListener('change', handleAdminFileUpload);
    }

    // Initialize admin session
    checkAdminSession();

    // Initialize quotes
    renderSavedQuotes();
    getRandomQuote();

    // Initialize with sample questions
    addQuestion('text', 'What is the main topic of this document?');
    addQuestion('multiple', 'Which of the following is mentioned in the document?');
    
    // Responsive adjustments
    adjustViewerHeight();
    window.addEventListener('resize', adjustViewerHeight);
    
    // Mobile sidebar toggle
    const sidebar = document.querySelector('.sidebar');
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1200 && !sidebar.contains(e.target) && !e.target.closest('.sidebar-toggle')) {
            sidebar.classList.remove('open');
        }
    });
});

function handleDragOver(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    document.getElementById('uploadArea').classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
    handleFiles({ target: { files } });
}

function handleFiles(e) {
    const files = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
    
    files.forEach(file => {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            showNotification(`File ${file.name} is too large (max 10MB)`, 'error');
            return;
        }
        
        if (uploadedFiles.length >= 5) {
            showNotification('Maximum 5 files allowed', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const fileData = {
                name: file.name,
                size: formatFileSize(file.size),
                data: e.target.result,
                id: Date.now() + Math.random(),
                isAdmin: false
            };
            
            uploadedFiles.push(fileData);
            renderFileList();
            showNotification(`Uploaded: ${file.name}`, 'success');
        };
        reader.readAsArrayBuffer(file);
    });

    e.target.value = '';
}

function renderFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = uploadedFiles.map(file => `
        <div class="file-item">
            <div class="file-info">
                <div class="file-icon ${file.isAdmin ? 'admin-file' : ''}">
                    ${file.isAdmin ? '🔐' : 'PDF'}
                </div>
                <div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${file.size}</div>
                </div>
            </div>
            <div class="file-actions">
                <button class="btn btn-primary" onclick="loadPDF(${file.id})">View</button>
                ${!file.isAdmin ? 
                    `<button class="btn btn-success" onclick="downloadPDF(${file.id})">Download</button>` : 
                    `<button class="btn btn-secondary" onclick="showAdminLogin()" title="Admin access required">🔒 Admin</button>`
                }
                <button class="btn btn-danger" onclick="removeFile(${file.id})">Remove</button>
            </div>
        </div>
    `).join('');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function loadPDF(fileId) {
    // Allow viewing of both regular and admin PDFs
    const file = [...uploadedFiles, ...adminUploadedFiles].find(f => f.id === fileId);
    if (!file) return;

    currentPDF = file;
    const loadingTask = pdfjsLib.getDocument({ data: file.data });
    
    loadingTask.promise.then(function(pdf) {
        pdfDoc = pdf;
        pageNum = 1;
        document.getElementById('totalPages').textContent = pdf.numPages;
        renderPage(pageNum);
        showNotification(`Loaded: ${file.name}`, 'info');
    }).catch(error => {
        console.error('Error loading PDF:', error);
        showNotification('Error loading PDF', 'error');
    });
}

function renderPage(num) {
    pageNum = num;
    document.getElementById('currentPage').textContent = pageNum;
    document.getElementById('prevPage').disabled = pageNum <= 1;
    document.getElementById('nextPage').disabled = pageNum >= pdfDoc.numPages;

    const viewerContainer = document.getElementById('viewerContainer');
    viewerContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%;"><div class="loading"></div></div>';

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
            
            const existingPages = viewerContainer.querySelectorAll('.pdf-page');
            existingPages.forEach(page => page.remove());
            
            viewerContainer.appendChild(pageDiv);
        });
    });
}

function previousPage() {
    if (pageNum <= 1) return;
    renderPage(pageNum - 1);
}

function nextPage() {
    if (pageNum >= pdfDoc.numPages) return;
    renderPage(pageNum + 1);
}

function removeFile(fileId) {
    uploadedFiles = uploadedFiles.filter(f => f.id !== fileId);
    if (currentPDF && currentPDF.id === fileId) {
        currentPDF = null;
        pdfDoc = null;
        document.getElementById('viewerContainer').innerHTML = 
            '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">Select a PDF to view</div>';
        document.getElementById('currentPage').textContent = '1';
        document.getElementById('totalPages').textContent = '1';
    }
    renderFileList();
    showNotification('File removed', 'info');
}

// Questions functionality
function addQuestion(type = 'text', text = '') {
    questionCounter++;
    const questionId = `q${questionCounter}`;
    const question = {
        id: questionId,
        type: type,
        text: text || `Question ${questionCounter}`,
        answer: ''
    };
    
    questions.push(question);
    renderQuestions();
}

function renderQuestions() {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = questions.map((question, index) => `
        <div class="question-item" data-id="${question.id}">
            <div class="question-header">
                <div class="question-number">${index + 1}</div>
                <div style="flex: 1;">
                    <input type="text" class="question-text" value="${question.text}" 
                           placeholder="Enter your question here..." 
                           oninput="updateQuestion('${question.id}', 'text', this.value)">
                </div>
                <div class="question-actions">
                    <select class="question-type-select" onchange="updateQuestion('${question.id}', 'type', this.value)">
                        <option value="text" ${question.type === 'text' ? 'selected' : ''}>Text</option>
                        <option value="multiple" ${question.type === 'multiple' ? 'selected' : ''}>Multiple Choice</option>
                        <option value="yesno" ${question.type === 'yesno' ? 'selected' : ''}>Yes/No</option>
                    </select>
                    <button class="remove-question" onclick="removeQuestion('${question.id}')">Remove</button>
                </div>
            </div>
            <textarea class="question-input" placeholder="Enter your answer here..."
                      oninput="updateQuestion('${question.id}', 'answer', this.value)">${question.answer}</textarea>
        </div>
    `).join('');
}

function updateQuestion(id, field, value) {
    const question = questions.find(q => q.id === id);
    if (question) {
        question[field] = value;
    }
}

function removeQuestion(id) {
    questions = questions.filter(q => q.id !== id);
    renderQuestions();
    showNotification('Question removed', 'info');
}

function saveQuestions() {
    if (questions.length === 0) {
        showNotification('No questions to save', 'warning');
        return;
    }
    
    const questionsData = JSON.stringify(questions, null, 2);
    const blob = new Blob([questionsData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `questions-${currentPDF ? currentPDF.name.replace('.pdf', '') : 'document'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('Questions saved successfully!', 'success');
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
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
            case 'Enter':
                if (e.shiftKey) addQuestion();
                break;
            case 'q':
                if (e.shiftKey) getNewQuote();
                break;
            case 'a':
                if (e.shiftKey) showAdminLogin();
                break;
        }
    }
});

// Responsive adjustments
function adjustViewerHeight() {
    const viewerContainer = document.getElementById('viewerContainer');
    const headerHeight = document.querySelector('.header').offsetHeight;
    const controlsHeight = document.querySelector('.viewer-controls').offsetHeight;
    const availableHeight = window.innerHeight - headerHeight - 200;
    viewerContainer.style.height = Math.max(400, availableHeight) + 'px';
}

// Export functions for global access
window.showAdminLogin = showAdminLogin;
window.authenticateAdmin = authenticateAdmin;
window.closeAdminLogin = closeAdminLogin;
window.loadAdminPDF = loadAdminPDF;
window.downloadAdminPDF = downloadAdminPDF;
window.removeAdminFile = removeAdminFile;
window.getNewQuote = getNewQuote;
window.getQuoteByCategory = getQuoteByCategory;
window.shareQuote = shareQuote;
window.saveQuote = saveQuote;
window.removeSavedQuote = removeSavedQuote;
window.loadSavedQuote = loadSavedQuote;
window.addQuestion = addQuestion;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.downloadCurrentPDF = downloadCurrentPDF;
window.downloadPDF = downloadPDF;
window.removeFile = removeFile;
window.saveQuestions = saveQuestions;
window.removeQuestion = removeQuestion;
window.updateQuestion = updateQuestion;
window.toggleTheme = toggleTheme;
