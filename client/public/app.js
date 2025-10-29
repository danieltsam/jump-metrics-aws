// AI GENERATED FILE - This file was created by an AI assistant
let authToken = null;
let currentUser = null;
let currentVideoId = '';
let currentSessionId = '';
let lastOutputs = [];
let jumps = [];
let player = null;

const $ = (id) => document.getElementById(id);

// Modern section visibility management
function setSectionVisible(id, visible) { 
  const section = $(id);
  if (section) {
    if (visible) {
      section.classList.remove('hidden');
      section.classList.add('fade-in');
    } else {
      section.classList.add('hidden');
      section.classList.remove('fade-in');
    }
  }
}

// Navigation management
function initializeNavigation() {
  // Handle sidebar navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      
      // Update active nav item
      document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active', 'bg-primary-50', 'text-primary-700', 'border-primary-200');
        nav.classList.add('text-gray-700', 'hover:bg-gray-50', 'hover:text-gray-900');
      });
      
      item.classList.add('active', 'bg-primary-50', 'text-primary-700', 'border-primary-200');
      item.classList.remove('text-gray-700', 'hover:bg-gray-50', 'hover:text-gray-900');
      
      // Show corresponding section
      showSection(section);
    });
  });
}

function showSection(sectionName) {
  // Hide all sections
  ['authSection', 'uploadSection', 'sessionSection', 'jumpsSection', 'analyzeSection', 'resultsSection', 'adminSection'].forEach(id => {
    setSectionVisible(id, false);
  });
  
  // Show requested section
  setSectionVisible(sectionName + 'Section', true);
  
  // Update active nav state
  updateActiveNav(sectionName + 'Section');
  
  // Load data for specific sections
  if (sectionName === 'jumps' && currentSessionId) {
    loadSessionJumps();
  }
  
  console.log(`📍 Switched to section: ${sectionName}`);
}

// Update active navigation state
function updateActiveNav(sectionId) {
  // Remove active state from all nav items
  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.classList.remove('active', 'bg-primary-50', 'text-primary-700', 'border-primary-200');
    nav.classList.add('text-gray-700', 'hover:bg-gray-50', 'hover:text-gray-900');
  });
  
  // Map section IDs to navigation data-section values
  const sectionMap = {
    'uploadSection': 'upload',
    'sessionSection': 'session', 
    'jumpsSection': 'jumps',
    'analyzeSection': 'analyze',
    'resultsSection': 'results',
    'adminSection': 'admin'
  };
  
  const navSection = sectionMap[sectionId];
  if (navSection) {
    const activeNavItem = document.querySelector(`[data-section="${navSection}"]`);
    if (activeNavItem) {
      activeNavItem.classList.remove('text-gray-700', 'hover:bg-gray-50', 'hover:text-gray-900');
      activeNavItem.classList.add('active', 'bg-primary-50', 'text-primary-700', 'border-primary-200');
      console.log(`🎯 Updated nav highlight to: ${navSection}`);
    }
  }
}

// Drag and drop functionality for file upload
function initializeDragAndDrop() {
  const dropZone = $('dropZone');
  const fileInput = $('videoFile');
  const fileInfo = $('fileInfo');
  const fileName = $('fileName');
  const fileSize = $('fileSize');
  const removeFile = $('removeFile');

  if (!dropZone || !fileInput) return;

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop area when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
  });

  // Handle dropped files
  dropZone.addEventListener('drop', handleDrop, false);
  
  // Handle click to browse
  dropZone.addEventListener('click', () => fileInput.click());
  
  // Handle file input change
  fileInput.addEventListener('change', handleFileSelect);
  
  // Handle remove file
  if (removeFile) {
    removeFile.addEventListener('click', clearFileSelection);
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight() {
    dropZone.classList.add('drop-zone-active', 'border-primary-400', 'bg-primary-50');
  }

  function unhighlight() {
    dropZone.classList.remove('drop-zone-active', 'border-primary-400', 'bg-primary-50');
  }

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
  }
  
  function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
  }

  function handleFiles(files) {
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('video/')) {
        displayFileInfo(file);
      } else {
        alert('Please select a valid video file.');
        clearFileSelection();
      }
    }
  }

  function displayFileInfo(file) {
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.classList.remove('hidden');
    dropZone.style.display = 'none';
  }
  
  function clearFileSelection() {
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    dropZone.style.display = 'block';
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
// Load jumps from the current session
async function loadSessionJumps() {
  if (!currentSessionId) {
    console.log('No current session ID, trying to load most recent session...');
    // If no current session ID, try to load the most recent session
    try {
      const { json } = await api('/sessions');
      if (json.items && json.items.length > 0) {
        // Sort by created date and get the most recent
        const sortedSessions = json.items.sort((a, b) => 
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        currentSessionId = sortedSessions[0].sessionId;
        console.log('✅ Loaded most recent session:', currentSessionId);
      }
    } catch (err) {
      console.log('No sessions found for user');
      return;
    }
  }
  
  if (!currentSessionId) {
    console.log('Still no session ID, cannot load jumps');
    return;
  }
  
  try {
    console.log('🔄 Loading jumps for session:', currentSessionId);
    const { json } = await api(`/sessions/${currentSessionId}/jumps`);
    
    // Convert the API response format to match our local jumps array format
    jumps = (json.items || []).map(jump => ({
      takeoffMs: jump.takeoffMs,
      landingMs: jump.landingMs,
      jumpId: jump.jumpId,
      method: jump.method,
      createdAt: jump.createdAt
    }));
    
    console.log(`✅ Loaded ${jumps.length} jumps from session:`, jumps);
    
    // Update all displays with the loaded jumps
    displayJumpMetrics();
    updateJumpTimeline();
    updateCurrentJumpInfo();
    updateUndoButton();
    
  } catch (err) {
    console.error('❌ Failed to load session jumps:', err);
    // Don't show error to user, just log it
    // The jumps array will remain empty and show the empty state
  }
}

function setText(id, text) { $(id).textContent = text; }

// Local jump metrics computation
function computeJumpMetrics(takeoffMs, landingMs) {
  const dtMs = Math.max(0, landingMs - takeoffMs);
  const tSeconds = dtMs / 1000;
  const g = 9.81;
  const heightMetres = (g * tSeconds * tSeconds) / 8;
  const heightCm = Math.round(heightMetres * 100);
  const heightInches = Math.round(heightMetres * 39.3701);
  const takeoffVelocityMs = (g * tSeconds) / 2;
  const takeoffVelocityKmh = Math.round(takeoffVelocityMs * 3.6); // Convert m/s to km/h
  return { tSeconds, heightMetres, heightCm, heightInches, tMs: dtMs, takeoffVelocityMs, takeoffVelocityKmh };
}

function displayJumpMetrics() {
  const tbody = $('jumpsTable');
  const emptyState = $('emptyJumpsState');
  const summaryCard = $('jumpSummaryCard');
  
  if (!tbody) {
    console.error('jumpsTable tbody not found');
    return;
  }
  
  console.log('Displaying metrics for jumps:', jumps);
  
  tbody.innerHTML = '';
  
  // Show/hide empty state
  if (jumps.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (summaryCard) summaryCard.classList.add('hidden');
    return;
  } else {
    if (emptyState) emptyState.style.display = 'none';
  }
  
  jumps.forEach((j, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'table-row hover:bg-gray-50 transition-colors';
    
    if (j.takeoffMs != null && j.landingMs != null) {
      const metrics = computeJumpMetrics(j.takeoffMs, j.landingMs);
      tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${idx + 1}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">${j.takeoffMs}ms</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">${j.landingMs}ms</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary-600">${metrics.heightCm}cm</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${metrics.tMs}ms</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm">
          <div class="font-bold text-gray-900">${metrics.takeoffVelocityMs.toFixed(1)} m/s</div>
          <div class="text-xs text-gray-500">(${metrics.takeoffVelocityKmh} km/h)</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm">
          <div class="flex space-x-2">
            <button data-idx="${idx}" class="edit text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
              <i data-lucide="edit-2" class="w-4 h-4"></i>
            </button>
            <button data-idx="${idx}" class="delete text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${idx + 1}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${j.takeoffMs ?? '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${j.landingMs ?? '-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">-</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">-</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">-</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm">
          <div class="flex space-x-2">
            <button data-idx="${idx}" class="edit text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
              <i data-lucide="edit-2" class="w-4 h-4"></i>
            </button>
            <button data-idx="${idx}" class="delete text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      `;
    }
    tbody.appendChild(tr);
  });
  
  // Refresh Lucide icons for new buttons
  lucide.createIcons();
  
  // Add event listeners to the new buttons
  tbody.querySelectorAll('button.edit').forEach(btn => btn.addEventListener('click', () => editJump(Number(btn.dataset.idx))));
  tbody.querySelectorAll('button.delete').forEach(btn => btn.addEventListener('click', () => deleteJump(Number(btn.dataset.idx))));
  
  // Display summary if we have jumps
  displayJumpSummary();
  updateQuickStats();
}

// Display summary of all jumps with velocity
function displayJumpSummary() {
  const summaryCard = $('jumpSummaryCard');
  if (!summaryCard) return;
  
  if (jumps.length === 0) {
    summaryCard.classList.add('hidden');
    return;
  }
  
  const completedJumps = jumps.filter(j => j.takeoffMs != null && j.landingMs != null);
  if (completedJumps.length === 0) {
    summaryCard.classList.add('hidden');
    return;
  }
  
  const allMetrics = completedJumps.map(j => computeJumpMetrics(j.takeoffMs, j.landingMs));
  const avgHeight = allMetrics.reduce((sum, m) => sum + m.heightCm, 0) / allMetrics.length;
  const avgVelocity = allMetrics.reduce((sum, m) => sum + m.takeoffVelocityMs, 0) / allMetrics.length;
  const bestHeight = Math.max(...allMetrics.map(m => m.heightCm));
  const bestVelocity = Math.max(...allMetrics.map(m => m.takeoffVelocityMs));
  
  // Update summary card values
  const elements = {
    summaryTotalJumps: completedJumps.length,
    summaryAvgHeight: avgHeight.toFixed(1),
    summaryBestHeight: bestHeight,
    summaryAvgVelocity: avgVelocity.toFixed(1),
    summaryBestVelocity: bestVelocity.toFixed(1)
  };
  
  Object.entries(elements).forEach(([id, value]) => {
    const el = $(id);
    if (el) el.textContent = value;
  });
  
  summaryCard.classList.remove('hidden');
}

// Update quick stats in video analysis section
function updateQuickStats() {
  const completedJumps = jumps.filter(j => j.takeoffMs != null && j.landingMs != null);
  
  // Update total jumps
  const totalJumpsEl = $('totalJumps');
  if (totalJumpsEl) totalJumpsEl.textContent = completedJumps.length;
  
  if (completedJumps.length === 0) {
    ['bestHeight', 'avgHeight', 'bestVelocity'].forEach(id => {
      const el = $(id);
      if (el) el.textContent = '-';
    });
    return;
  }
  
  const allMetrics = completedJumps.map(j => computeJumpMetrics(j.takeoffMs, j.landingMs));
  const avgHeight = allMetrics.reduce((sum, m) => sum + m.heightCm, 0) / allMetrics.length;
  const bestHeight = Math.max(...allMetrics.map(m => m.heightCm));
  const bestVelocity = Math.max(...allMetrics.map(m => m.takeoffVelocityMs));
  
  const updates = {
    bestHeight: `${bestHeight} cm`,
    avgHeight: `${avgHeight.toFixed(1)} cm`,
    bestVelocity: `${bestVelocity.toFixed(1)} m/s`
  };
  
  Object.entries(updates).forEach(([id, value]) => {
    const el = $(id);
    if (el) el.textContent = value;
  });
}

async function api(path, { method = 'GET', body, isMultipart } = {}) {
  const headers = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (!isMultipart) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    body: isMultipart ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    throw new Error(json?.message || res.statusText);
  }
  return { res, json };
}

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitButton = e.target.querySelector('button[type="submit"]');
  const originalText = submitButton.innerHTML;
  
  try {
    // Show loading state
    submitButton.classList.add('btn-loading');
    submitButton.disabled = true;
    
    const username = $('username').value;
    const password = $('password').value;
    const { json } = await api('/auth/login', { method: 'POST', body: { username, password } });
    authToken = json.token;
    currentUser = json.user;
    
    // Update user info in navbar
    const userDisplayName = $('userDisplayName');
    const userRole = $('userRole');
    const navActions = $('navActions');
    
    if (userDisplayName) userDisplayName.textContent = currentUser.username;
    if (userRole) {
      // Show "admin" if user is admin by role or groups, otherwise show role
      const isAdmin = currentUser.role === 'admin' || (currentUser.groups && currentUser.groups.includes('admin'));
      userRole.textContent = isAdmin ? 'admin' : currentUser.role;
    }
    if (navActions) navActions.style.display = 'flex';
    
    // Show sidebar and main content
    const sidebar = $('sidebar');
    const contentWithSidebar = $('contentWithSidebar');
    if (sidebar) sidebar.style.setProperty('display', 'block', 'important');
    if (contentWithSidebar) contentWithSidebar.style.setProperty('display', 'block', 'important');
    
    // Show admin nav item if user is admin (check both role and groups)
    console.log('🔍 Frontend user object:', currentUser);
    console.log('📋 User groups:', currentUser.groups);
    console.log('👑 User role:', currentUser.role);
    
    const isAdmin = currentUser.role === 'admin' || (currentUser.groups && currentUser.groups.includes('admin'));
    console.log('🔐 Is admin:', isAdmin);
    
    if (isAdmin) {
      const adminNavItem = document.querySelector('.admin-only');
      console.log('🎛️ Admin nav item found:', adminNavItem);
      if (adminNavItem) {
        adminNavItem.style.setProperty('display', 'flex', 'important');
        console.log('✅ Admin panel shown');
      }
    } else {
      console.log('❌ User is not admin, hiding admin panel');
      const adminNavItem = document.querySelector('.admin-only');
      if (adminNavItem) {
        adminNavItem.style.setProperty('display', 'none', 'important');
      }
    }
    
    // Update current user display
    const currentUserElement = $('currentUser');
    if (currentUserElement) {
      currentUserElement.textContent = currentUser.username;
    }
    
    // Hide auth section and show upload section
    console.log('🔄 Hiding auth section and showing upload section...');
    const authSection = $('authSection');
    const uploadSection = $('uploadSection');
    
    console.log('🔍 Auth section before hide:', authSection);
    console.log('🔍 Upload section before show:', uploadSection);
    
    setSectionVisible('authSection', false);
    setSectionVisible('uploadSection', true);
    
    // Force hide auth section with inline style as backup
    if (authSection) {
      authSection.style.setProperty('display', 'none', 'important');
      console.log('✅ Auth section hidden with inline style');
    }
    
    // Force show upload section with inline style as backup
    if (uploadSection) {
      uploadSection.style.display = 'block';
      console.log('✅ Upload section shown with inline style');
    }
    
    // Initialize navigation and other features
    initializeNavigation();
    initializeDragAndDrop();
    initializeJumpControls();
    
    // Show success message
    const loginInfo = $('loginInfo');
    if (loginInfo) {
      loginInfo.innerHTML = `
        <div class="text-green-600 font-medium">
          <i data-lucide="check-circle" class="w-4 h-4 inline mr-1"></i>
          Welcome, ${currentUser.username}!
        </div>
      `;
      lucide.createIcons();
    }
    
  } catch (err) {
    // Show error message
    const loginInfo = $('loginInfo');
    if (loginInfo) {
      loginInfo.innerHTML = `
        <div class="text-red-600 font-medium">
          <i data-lucide="alert-circle" class="w-4 h-4 inline mr-1"></i>
          ${err.message}
        </div>
      `;
      lucide.createIcons();
    }
  } finally {
    // Reset button state
    submitButton.classList.remove('btn-loading');
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
  }
});

$('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitButton = e.target.querySelector('button[type="submit"]');
  const originalText = submitButton.innerHTML;
  const uploadResult = $('uploadResult');
  const buttonText = $('uploadButtonText');
  
  try {
    // Show loading state
    submitButton.disabled = true;
    if (buttonText) buttonText.textContent = 'Uploading...';
    
    const fd = new FormData();
    const file = $('videoFile').files[0];
    if (!file) throw new Error('Please select a video file');
    fd.append('video', file);
    
    const { json } = await api('/videos', { method: 'POST', body: fd, isMultipart: true });
    currentVideoId = json.videoId || '';
    
    // Show success message
    if (uploadResult) {
      uploadResult.classList.remove('hidden');
      uploadResult.innerHTML = `
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center">
            <div class="bg-green-100 rounded-full p-2 mr-3">
              <i data-lucide="check" class="w-5 h-5 text-green-600"></i>
            </div>
            <div>
              <h4 class="font-medium text-green-900">Upload Successful!</h4>
              <p class="text-sm text-green-700">Your video has been uploaded and a session is being created...</p>
            </div>
          </div>
        </div>
      `;
      lucide.createIcons();
    }
    
    // Auto-create session and show video player
    await autoCreateSession(currentVideoId);
    
  } catch (err) {
    // Show error message
    if (uploadResult) {
      uploadResult.classList.remove('hidden');
      uploadResult.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-center">
            <div class="bg-red-100 rounded-full p-2 mr-3">
              <i data-lucide="alert-circle" class="w-5 h-5 text-red-600"></i>
            </div>
            <div>
              <h4 class="font-medium text-red-900">Upload Failed</h4>
              <p class="text-sm text-red-700">${err.message}</p>
            </div>
          </div>
        </div>
      `;
      lucide.createIcons();
    }
  } finally {
    // Reset button state
    submitButton.disabled = false;
    if (buttonText) buttonText.textContent = 'Upload Video';
  }
});

// Auto-create session after video upload
async function autoCreateSession(videoId) {
  try {
    console.log('🔄 Auto-creating session for video:', videoId);
    
    const { json } = await api('/sessions', { 
      method: 'POST', 
      body: { videoId } 
    });
    
    console.log('✅ Session created:', json);
    currentSessionId = json.sessionId;
    
    // Update session info
    const sessionInfo = $('sessionInfo');
    if (sessionInfo) {
      sessionInfo.textContent = `Session ${json.sessionId} created for video ${videoId}`;
    }
    
    // Load video into player
    const videoUrl = `/api/v1/videos/${encodeURIComponent(videoId)}/original?token=${encodeURIComponent(authToken)}`;
    player = $('player'); // Assign the video element to the global player variable
    player.src = videoUrl;
    
    console.log('🎬 Player element assigned:', player);
    console.log('🎬 Video URL set:', videoUrl);
    
    // Initialize player time ticker and enhanced controls
    initPlayerTimeTicker();
    initEnhancedVideoControls();
    
    // Prefill admin stress test session id
    if ($('stressSessionId')) $('stressSessionId').value = currentSessionId;
    
    // Auto-navigate to video analysis section
    setTimeout(() => {
      showSection('session');
    }, 500);
    
    console.log('🎬 Video loaded into player, ready for jump marking');
    
  } catch (err) {
    console.error('❌ Auto-session creation failed:', err);
    const sessionInfo = $('sessionInfo');
    if (sessionInfo) {
      sessionInfo.textContent = `Session creation failed: ${err.message}`;
    }
  }
}

// Session form is no longer needed - sessions are auto-created on upload

function initPlayerTimeTicker() {
  const currentTimeEl = $('currentTime');
  const currentFrameEl = $('currentFrame');
  
  if (!player) return;
  
  // Simple time update
  const update = () => {
    if (player && !player.error) {
      const currentTime = player.currentTime || 0;
      
      if (currentTimeEl) {
        currentTimeEl.textContent = `${currentTime.toFixed(3)}s`;
      }
      if (currentFrameEl) {
        currentFrameEl.textContent = Math.floor(currentTime * 30); // Assuming 30fps
      }
      
      // Update jump markers and info less frequently to avoid performance issues
      if (Math.floor(currentTime * 10) !== Math.floor((player.previousTime || 0) * 10)) {
        updateTimelineMarkers();
        updateCurrentJumpInfo();
      }
      player.previousTime = currentTime;
    }
    
    requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// Initialize simplified video controls
function initEnhancedVideoControls() {
  const frameForwardBtn = $('frameForward');
  const frameBackwardBtn = $('frameBackward');
  const stepForwardBtn = $('stepForward');
  const stepBackwardBtn = $('stepBackward');
  const playbackSpeedSelect = $('playbackSpeed');
  const saveJumpsBtn = $('saveJumpsBtn');
  
  if (!player) return;
  
  // Frame-by-frame controls (1/30th second precision)
  const frameStep = 1/30;
  
  if (frameForwardBtn) {
    frameForwardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (player && player.duration) {
        player.currentTime = Math.min(player.currentTime + frameStep, player.duration);
        console.log('Frame forward to:', player.currentTime);
      }
    });
  }
  
  if (frameBackwardBtn) {
    frameBackwardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (player) {
        player.currentTime = Math.max(player.currentTime - frameStep, 0);
        console.log('Frame backward to:', player.currentTime);
      }
    });
  }
  
  // Step controls (1 second precision)
  if (stepForwardBtn) {
    stepForwardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (player && player.duration) {
        player.currentTime = Math.min(player.currentTime + 1, player.duration);
        console.log('Step forward to:', player.currentTime);
      }
    });
  }
  
  if (stepBackwardBtn) {
    stepBackwardBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (player) {
        player.currentTime = Math.max(player.currentTime - 1, 0);
        console.log('Step backward to:', player.currentTime);
      }
    });
  }
  
  // Playback speed control
  if (playbackSpeedSelect) {
    playbackSpeedSelect.addEventListener('change', (e) => {
      if (player) {
        const speed = parseFloat(playbackSpeedSelect.value);
        player.playbackRate = speed;
        console.log('Playback speed changed to:', speed);
      }
    });
  }
  
  // Save jumps button
  if (saveJumpsBtn) {
    saveJumpsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const originalSaveButton = $('saveJumps');
      if (originalSaveButton) {
        originalSaveButton.click();
      }
    });
  }
  
  // Keyboard shortcuts (more reliable)
  let keydownHandler = (e) => {
    // Only if video player section is active and no input/select is focused
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'SELECT' || 
      activeElement.tagName === 'TEXTAREA'
    );
    
    if (!$('sessionSection').classList.contains('hidden') && !isInputFocused) {
      switch(e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey && frameBackwardBtn) {
            frameBackwardBtn.click();
          } else if (stepBackwardBtn) {
            stepBackwardBtn.click();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey && frameForwardBtn) {
            frameForwardBtn.click();
          } else if (stepForwardBtn) {
            stepForwardBtn.click();
          }
          break;
        case 't':
        case 'T':
          e.preventDefault();
          const takeoffBtn = $('markTakeoff');
          if (takeoffBtn) takeoffBtn.click();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          const landingBtn = $('markLanding');
          if (landingBtn) landingBtn.click();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          if (saveJumpsBtn) saveJumpsBtn.click();
          break;
      }
    }
  };
  
  // Remove any existing keydown listeners and add new one
  document.removeEventListener('keydown', keydownHandler);
  document.addEventListener('keydown', keydownHandler);
}

// Format time for display
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update timeline markers for jumps
function updateTimelineMarkers() {
  const timelineMarkers = $('timelineMarkers');
  const duration = player?.duration || 0;
  
  if (!timelineMarkers || duration === 0) return;
  
  timelineMarkers.innerHTML = '';
  
  jumps.forEach((jump, index) => {
    if (jump.takeoffMs != null) {
      const takeoffPercent = (jump.takeoffMs / 1000 / duration) * 100;
      const takeoffMarker = document.createElement('div');
      takeoffMarker.className = 'absolute w-1 h-2 bg-green-500 rounded-full';
      takeoffMarker.style.left = `${takeoffPercent}%`;
      takeoffMarker.title = `Takeoff ${index + 1}: ${jump.takeoffMs}ms`;
      timelineMarkers.appendChild(takeoffMarker);
    }
    
    if (jump.landingMs != null) {
      const landingPercent = (jump.landingMs / 1000 / duration) * 100;
      const landingMarker = document.createElement('div');
      landingMarker.className = 'absolute w-1 h-2 bg-red-500 rounded-full';
      landingMarker.style.left = `${landingPercent}%`;
      landingMarker.title = `Landing ${index + 1}: ${jump.landingMs}ms`;
      timelineMarkers.appendChild(landingMarker);
    }
  });
}

// Update current jump info panel
function updateCurrentJumpInfo() {
  const currentJumpInfo = $('currentJumpInfo');
  if (!currentJumpInfo) return;
  
  const currentTime = (player?.currentTime || 0) * 1000; // Convert to ms
  const lastJump = jumps[jumps.length - 1];
  
  if (lastJump && (lastJump.takeoffMs != null || lastJump.landingMs != null)) {
    const hasComplete = lastJump.takeoffMs != null && lastJump.landingMs != null;
    
    currentJumpInfo.innerHTML = hasComplete ? 
      (() => {
        const metrics = computeJumpMetrics(lastJump.takeoffMs, lastJump.landingMs);
        return `
          <div class="bg-green-50 border border-green-200 rounded-lg p-3">
            <h4 class="font-medium text-green-900 mb-2">Jump ${jumps.length} Complete</h4>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span class="text-green-700">Takeoff:</span>
                <span class="font-mono text-green-900">${lastJump.takeoffMs}ms</span>
              </div>
              <div class="flex justify-between">
                <span class="text-green-700">Landing:</span>
                <span class="font-mono text-green-900">${lastJump.landingMs}ms</span>
              </div>
              <div class="flex justify-between">
                <span class="text-green-700">Height:</span>
                <span class="font-bold text-green-900">${metrics.heightCm}cm</span>
              </div>
              <div class="flex justify-between">
                <span class="text-green-700">Flight Time:</span>
                <span class="font-bold text-green-900">${metrics.tMs}ms</span>
              </div>
            </div>
          </div>
        `;
      })() :
      `
        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 class="font-medium text-yellow-900 mb-2">Jump ${jumps.length} In Progress</h4>
          <div class="space-y-1 text-sm">
            ${lastJump.takeoffMs != null ? 
              `<div class="flex justify-between">
                <span class="text-yellow-700">Takeoff:</span>
                <span class="font-mono text-yellow-900">${lastJump.takeoffMs}ms</span>
              </div>
              <div class="text-yellow-700">⏳ Waiting for landing...</div>` :
              '<div class="text-yellow-700">⏳ Mark takeoff to begin</div>'
            }
          </div>
        </div>
      `;
  } else {
    currentJumpInfo.innerHTML = `
      <div class="text-center text-gray-500">
        <i data-lucide="target" class="w-8 h-8 mx-auto mb-2"></i>
        <p>Mark takeoff and landing to see jump details</p>
      </div>
    `;
  }
  
  lucide.createIcons();
}

// Update jump timeline display with edit/delete controls
function updateJumpTimeline() {
  const jumpTimeline = $('jumpTimeline');
  const clearAllBtn = $('clearAllJumps');
  
  if (!jumpTimeline) return;
  
  // Show/hide clear all button
  if (clearAllBtn) {
    clearAllBtn.style.display = jumps.length > 0 ? 'block' : 'none';
  }
  
  if (jumps.length === 0) {
    jumpTimeline.innerHTML = `
      <div class="text-center text-gray-500">
        <i data-lucide="clock" class="w-6 h-6 mx-auto mb-2"></i>
        <p class="text-sm">Marked jumps will appear here</p>
      </div>
    `;
  } else {
    jumpTimeline.innerHTML = jumps.map((jump, index) => {
      const hasComplete = jump.takeoffMs != null && jump.landingMs != null;
      const status = hasComplete ? 'Complete' : 
                    jump.takeoffMs != null ? 'Needs Landing' : 'Needs Takeoff';
      const statusColor = hasComplete ? 'green' : 
                         jump.takeoffMs != null ? 'yellow' : 'gray';
      
      return `
        <div class="bg-${statusColor}-50 border border-${statusColor}-200 rounded-lg p-3">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center space-x-2">
              <span class="w-6 h-6 bg-${statusColor}-100 text-${statusColor}-800 rounded-full flex items-center justify-center text-xs font-bold">
                ${index + 1}
              </span>
              <div class="text-sm">
                <div class="font-medium text-${statusColor}-900">Jump ${index + 1}</div>
                <div class="text-${statusColor}-700 text-xs">${status}</div>
              </div>
            </div>
            <div class="text-xs text-gray-500">
              Jump ${index + 1}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="text-${statusColor}-700">
              <span class="font-medium">Takeoff:</span>
              <span class="font-mono ${jump.takeoffMs != null ? '' : 'text-gray-400'}">${jump.takeoffMs != null ? jump.takeoffMs + 'ms' : 'Not marked'}</span>
            </div>
            <div class="text-${statusColor}-700">
              <span class="font-medium">Landing:</span>
              <span class="font-mono ${jump.landingMs != null ? '' : 'text-gray-400'}">${jump.landingMs != null ? jump.landingMs + 'ms' : 'Not marked'}</span>
            </div>
          </div>
          ${hasComplete ? (() => {
            const metrics = computeJumpMetrics(jump.takeoffMs, jump.landingMs);
            return `
              <div class="mt-2 pt-2 border-t border-${statusColor}-200">
                <div class="grid grid-cols-3 gap-2 text-xs text-${statusColor}-800">
                  <div><span class="font-medium">Height:</span> <span class="font-bold">${metrics.heightCm}cm</span></div>
                  <div><span class="font-medium">Time:</span> <span class="font-bold">${metrics.tMs}ms</span></div>
                  <div><span class="font-medium">Velocity:</span> <span class="font-bold">${metrics.takeoffVelocityMs.toFixed(1)}m/s</span></div>
                </div>
              </div>
            `;
          })() : ''}
        </div>
      `;
    }).join('');
  }
  
  lucide.createIcons();
}

// Edit jump from timeline
function editJumpFromTimeline(index) {
  const jump = jumps[index];
  if (!jump) return;
  
  const takeoffInput = prompt('Edit Takeoff Time (ms):', jump.takeoffMs || '');
  const landingInput = prompt('Edit Landing Time (ms):', jump.landingMs || '');
  
  // Update values if user didn't cancel
  if (takeoffInput !== null) {
    const takeoffValue = parseFloat(takeoffInput);
    jump.takeoffMs = isNaN(takeoffValue) ? null : takeoffValue;
  }
  
  if (landingInput !== null) {
    const landingValue = parseFloat(landingInput);
    jump.landingMs = isNaN(landingValue) ? null : landingValue;
  }
  
  // Refresh displays
  displayJumpMetrics();
  updateJumpTimeline();
  updateCurrentJumpInfo();
  
  console.log(`✏️ Edited jump ${index + 1}:`, jump);
}

// Delete jump from timeline
function deleteJumpFromTimeline(index) {
  if (confirm(`Are you sure you want to delete Jump ${index + 1}?`)) {
    jumps.splice(index, 1);
    
    // Refresh displays
    displayJumpMetrics();
    updateJumpTimeline();
    updateCurrentJumpInfo();
    
    console.log(`🗑️ Deleted jump ${index + 1}`);
  }
}

// Seek to jump position in video
function seekToJump(index) {
  const jump = jumps[index];
  if (!jump || !player) return;
  
  let seekTime = null;
  
  if (jump.takeoffMs != null) {
    seekTime = jump.takeoffMs / 1000;
  } else if (jump.landingMs != null) {
    seekTime = jump.landingMs / 1000;
  }
  
  if (seekTime !== null) {
    player.currentTime = seekTime;
    console.log(`🎯 Seeking to jump ${index + 1} at ${seekTime}s`);
    
    // Brief visual feedback
    const btn = event.target.closest('button');
    if (btn) {
      btn.classList.add('bg-purple-200');
      setTimeout(() => btn.classList.remove('bg-purple-200'), 200);
    }
  }
}

// Clear all jumps
function clearAllJumps() {
  if (confirm('Are you sure you want to delete ALL jumps? This cannot be undone.')) {
    jumps.length = 0; // Clear array
    
    // Refresh displays
    displayJumpMetrics();
    updateJumpTimeline();
    updateCurrentJumpInfo();
    
    console.log('🗑️ Cleared all jumps');
  }
}

// Undo last jump action
function undoLastJump() {
  if (jumps.length === 0) return;
  
  const lastJump = jumps[jumps.length - 1];
  
  // If the last jump has both takeoff and landing, remove just the landing
  if (lastJump.takeoffMs != null && lastJump.landingMs != null) {
    lastJump.landingMs = null;
    console.log('🔄 Undid landing for jump', jumps.length);
  }
  // If the last jump only has takeoff, remove the entire jump
  else if (lastJump.takeoffMs != null) {
    jumps.pop();
    console.log('🔄 Undid takeoff, removed jump', jumps.length + 1);
  }
  // If somehow we have a jump with only landing, remove it
  else {
    jumps.pop();
    console.log('🔄 Removed incomplete jump', jumps.length + 1);
  }
  
  // Refresh displays
  displayJumpMetrics();
  updateJumpTimeline();
  updateCurrentJumpInfo();
  updateUndoButton();
}

// Update undo button visibility
function updateUndoButton() {
  const undoBtn = $('undoLastJump');
  if (undoBtn) {
    undoBtn.style.display = jumps.length > 0 ? 'block' : 'none';
  }
}

// Initialize jump control event listeners
function initializeJumpControls() {
  const clearAllBtn = $('clearAllJumps');
  const undoBtn = $('undoLastJump');
  
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllJumps);
  }
  
  if (undoBtn) {
    undoBtn.addEventListener('click', undoLastJump);
  }
}

$('markTakeoff').addEventListener('click', () => {
  console.log('🎯 Mark takeoff clicked, player state:', player);
  if (!player) {
    console.error('❌ Player not initialized');
    console.error('❌ Player variable:', player);
    console.error('❌ Player element exists:', !!$('player'));
    return;
  }
  const currentTime = player.currentTime || 0;
  const ms = Math.round(currentTime * 1000);
  console.log('✅ Marking takeoff at:', currentTime, 's =', ms, 'ms');
  jumps.push({ takeoffMs: ms, landingMs: null });
  console.log('📊 Jumps array now:', jumps);
  displayJumpMetrics();
  updateJumpTimeline();
  updateCurrentJumpInfo();
  updateUndoButton();
});

$('markLanding').addEventListener('click', () => {
  console.log('🎯 Mark landing clicked, player state:', player);
  if (!player) {
    console.error('❌ Player not initialized');
    console.error('❌ Player variable:', player);
    console.error('❌ Player element exists:', !!$('player'));
    return;
  }
  const currentTime = player.currentTime || 0;
  const ms = Math.round(currentTime * 1000);
  console.log('✅ Marking landing at:', currentTime, 's =', ms, 'ms');
  const last = jumps[jumps.length - 1];
  if (!last) {
    console.error('❌ No takeoff marked yet');
    return;
  }
  last.landingMs = ms;
  console.log('📊 Jumps array now:', jumps);
  displayJumpMetrics();
  updateJumpTimeline();
  updateCurrentJumpInfo();
  updateUndoButton();
});

$('saveJumps').addEventListener('click', async () => {
  try {
    console.log('💾 Saving jumps to session:', currentSessionId);
    
    let savedCount = 0;
    for (const j of jumps) {
      if (j.takeoffMs != null && j.landingMs != null) {
        await api(`/sessions/${currentSessionId}/jumps`, { method: 'POST', body: { takeoffMs: j.takeoffMs, landingMs: j.landingMs, method: 'manual' } });
        savedCount++;
      }
    }
    
    console.log(`✅ Saved ${savedCount} jumps successfully`);
    
    // Clear local jumps array since they're now saved to the server
    jumps = [];
    
    // Show success message
    const saveButton = $('saveJumps');
    const originalText = saveButton.textContent;
    saveButton.textContent = '✅ Saved!';
    saveButton.disabled = true;
    
    // Reset button after 2 seconds
    setTimeout(() => {
      saveButton.textContent = originalText;
      saveButton.disabled = false;
    }, 2000);
    
    // Auto-navigate to Process Video section for video analysis
    setTimeout(() => {
      showSection('analyze');
    }, 1000);
    
    console.log('🎯 Automatically moving to Process Video section');
    
  } catch (err) {
    console.error('❌ Save jumps failed:', err);
    alert(`Save failed: ${err.message}`);
  }
});

function renderJumpsTable() {
  displayJumpMetrics();
}

function editJump(idx) {
  const j = jumps[idx];
  const take = prompt('Edit Takeoff (ms):', j.takeoffMs ?? '');
  const land = prompt('Edit Landing (ms):', j.landingMs ?? '');
  
  if (take !== null) {
    const takeoffValue = parseFloat(take);
    j.takeoffMs = isNaN(takeoffValue) ? null : takeoffValue;
  }
  if (land !== null) {
    const landingValue = parseFloat(land);
    j.landingMs = isNaN(landingValue) ? null : landingValue;
  }
  
  // Refresh all displays
  displayJumpMetrics();
  updateJumpTimeline();
  updateCurrentJumpInfo();
  
  console.log(`✏️ Edited jump ${idx + 1} from table:`, j);
}

function deleteJump(idx) {
  if (confirm(`Are you sure you want to delete Jump ${idx + 1}?`)) {
  jumps.splice(idx, 1);
    
    // Refresh all displays
  displayJumpMetrics();
    updateJumpTimeline();
    updateCurrentJumpInfo();
    
    console.log(`🗑️ Deleted jump ${idx + 1} from table`);
  }
}

$('analyzeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    console.log('Starting analyze job...');
    const interpolationFps = Number($('interpolationFps').value);
    const workFactor = Number($('workFactor').value);
    const slowFactor = Number($('slowFactor')?.value || 4);
    const preset = $('preset')?.value || 'medium';
    console.log('Options:', { interpolationFps, workFactor, slowFactor, preset });

    const options = { interpolationFps, workFactor, slowFactor, preset };
    const { json } = await api('/jobs/analyze', { method: 'POST', body: { targetType: 'session', targetId: currentSessionId, options } });
    console.log('Job created:', json);
    
    const jobId = json.jobId;
    console.log('Starting to poll job:', jobId);
    
    setSectionVisible('analyzeSection', true);
    pollJob(jobId);
  } catch (err) {
    console.error('Analyze failed:', err);
    $('jobStatus').textContent = `Analyze start failed: ${err.message}`;
  }
});

$('refreshResults').addEventListener('click', async () => {
  await loadSessionResults();
});

$('refreshAdminOutputs')?.addEventListener('click', async () => {
  console.log('🔄 Manually refreshing admin outputs...');
  
  // Clear current display first
  const container = $('stressResult');
  if (container) {
    container.innerHTML = '🔄 Refreshing video outputs...\n';
  }
  
  // Collect and display fresh outputs
  await collectAndDisplayAllOutputs();
});

$('downloadFirstClip').addEventListener('click', () => {
  const first = (lastOutputs || [])[0];
  if (!first) return alert('No clips yet');
  const url = `/api/v1/media/${first}?token=${encodeURIComponent(authToken)}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clip.mp4';
  document.body.appendChild(a);
  a.click();
  a.remove();
});

async function pollJob(jobId) {
  const startTime = Date.now();
  let lastStatus = null;
  let checkCount = 0;
  let durationInterval = null;
  
  const poll = async () => {
    try {
      checkCount++;
      const { json } = await api(`/jobs/${jobId}`);
      const elapsed = Date.now() - startTime;
      
      // Log status changes
      if (json.status !== lastStatus) {
        console.log(`🔄 Job ${jobId}: ${lastStatus || 'initial'} → ${json.status} (${(elapsed/1000).toFixed(1)}s elapsed)`);
        lastStatus = json.status;
        
        // Start/stop duration timer based on status
        if (json.status === 'running' && !durationInterval) {
          durationInterval = setInterval(() => {
            updateDurationDisplay(startTime);
          }, 1000);
        } else if ((json.status === 'succeeded' || json.status === 'failed' || json.status === 'cancelled') && durationInterval) {
          clearInterval(durationInterval);
          durationInterval = null;
        }
      }
      
      // Log progress updates
      if (json.progress && json.progress.pct > 0) {
        console.log(`📊 Job ${jobId}: ${json.progress.pct}% complete (${(elapsed/1000).toFixed(1)}s elapsed)`);
      }
      
      // Log stderr if available
      if (json.stderrTail) {
        console.warn(`⚠️ Job ${jobId} stderr:`, json.stderrTail);
      }
      
      // Check for stuck jobs (running for over 2 minutes with no progress)
      if (json.status === 'running' && elapsed > 120000 && json.progress && json.progress.completed === 0) {
        console.error(`🚨 Job ${jobId} appears stuck - running for ${(elapsed/1000).toFixed(1)}s with no progress`);
        console.log(`💡 Consider canceling and retrying with lower settings`);
        
        // Show cancel button for stuck jobs
        const cancelBtn = $('cancelJobBtn');
        if (cancelBtn) {
          cancelBtn.classList.remove('hidden');
          cancelBtn.onclick = () => cancelJob(jobId);
        }
      }
      
      // Check for extremely stuck jobs (over 5 minutes)
      if (json.status === 'running' && elapsed > 300000) {
        console.error(`🔥 Job ${jobId} is extremely stuck - ${(elapsed/1000).toFixed(1)}s elapsed`);
        console.log(`🛑 Auto-attempting to cancel stuck job...`);
        // Auto-cancel extremely stuck jobs
        setTimeout(() => cancelJob(jobId), 1000);
      }
      
      // Log detailed info every 5th check
      if (checkCount % 5 === 0) {
        console.log(`🔍 Job ${jobId} detailed status:`, {
          status: json.status,
          progress: json.progress,
          elapsed: `${(elapsed/1000).toFixed(1)}s`,
          outputs: json.outputs?.length || 0,
          summary: json.summary
        });
      }
      
      // Update job status display
      updateJobStatusDisplay(json);
      
      if (json.status === 'succeeded' || json.status === 'failed' || json.status === 'cancelled') {
        const totalElapsed = Date.now() - startTime;
        console.log(`✅ Job ${jobId} ${json.status} in ${(totalElapsed/1000).toFixed(1)}s`);
        
        // Clear duration interval
        if (durationInterval) {
          clearInterval(durationInterval);
          durationInterval = null;
        }
        
        if (json.status === 'succeeded') {
          lastOutputs = json.outputs || [];
          console.log(`🎬 Job ${jobId} produced ${json.outputs?.length || 0} outputs:`, json.outputs);
          await loadSessionResults();
          await showClips(json.outputs || []);
          
          // Auto-navigate to Results section
          setTimeout(() => {
            showSection('results');
          }, 1000);
        }
        return;
      }
      
      // Continue polling
      setTimeout(poll, 1500);
      
    } catch (err) {
      console.error(`❌ Job poll failed for ${jobId}:`, err);
      const jobStatusEl = $('jobStatus');
      if (jobStatusEl) {
        jobStatusEl.textContent = `Job poll failed: ${err.message}`;
      }
      // Retry after 3s on error
      setTimeout(poll, 3000);
    }
  };
  
  poll();
}

async function loadSessionResults() {
  try {
    const { json } = await api(`/sessions/${currentSessionId}/results`);
    displaySessionStatistics(json);
  } catch (err) {
    console.error('Load results failed:', err.message);
    showNoStatsMessage();
  }
}

// Display session statistics with clean UI
function displaySessionStatistics(data) {
  const sessionStats = $('sessionStats');
  const noStatsMessage = $('noStatsMessage');
  
  if (!data || !data.count && data.count !== 0) {
    showNoStatsMessage();
    return;
  }
  
  // The data IS the stats (backend spreads stats directly)
  const stats = data;
  
  // Show stats and hide empty message
  if (sessionStats) sessionStats.style.display = 'block';
  if (noStatsMessage) noStatsMessage.style.display = 'none';
  
  // Update overview cards - map to correct field names from computeSessionStats
  updateElement('statsJumpCount', stats.count || 0);
  updateElement('statsAvgHeight', stats.average ? `${(stats.average * 100).toFixed(1)} cm` : '-'); // Convert meters to cm
  updateElement('statsMaxHeight', stats.best ? `${(stats.best * 100).toFixed(1)} cm` : '-'); // Convert meters to cm
  
  // Calculate average flight time from perJump data
  const avgFlightTime = stats.perJump && stats.perJump.length > 0 ? 
    stats.perJump.reduce((sum, jump) => sum + jump.metrics.flightTimeMs, 0) / stats.perJump.length : 0;
  updateElement('statsAvgFlight', avgFlightTime ? `${avgFlightTime.toFixed(0)} ms` : '-');
  
  // Update performance breakdown
  updateElement('statsSessionDuration', '-'); // Not available in current data
  updateElement('statsVideoLength', '-'); // Not available in current data
  updateElement('statsJumpDensity', stats.count ? `${stats.count} jumps` : '-');
  
  // Update performance metrics
  const minHeight = stats.perJump && stats.perJump.length > 0 ? 
    Math.min(...stats.perJump.map(j => j.metrics.heightMetres)) : 0;
  const maxVelocity = stats.perJump && stats.perJump.length > 0 ? 
    Math.max(...stats.perJump.map(j => j.metrics.velocityMs)) : 0;
  const maxFlightTime = stats.perJump && stats.perJump.length > 0 ? 
    Math.max(...stats.perJump.map(j => j.metrics.flightTimeMs)) : 0;
    
  updateElement('statsMinHeight', minHeight ? `${(minHeight * 100).toFixed(1)} cm` : '-');
  updateElement('statsBestVelocity', maxVelocity ? `${maxVelocity.toFixed(1)} m/s` : '-');
  updateElement('statsLongestFlight', maxFlightTime ? `${maxFlightTime.toFixed(0)} ms` : '-');
}

function showNoStatsMessage() {
  const sessionStats = $('sessionStats');
  const noStatsMessage = $('noStatsMessage');
  
  if (sessionStats) sessionStats.style.display = 'none';
  if (noStatsMessage) noStatsMessage.style.display = 'block';
}

function updateElement(id, value) {
  const element = $(id);
  if (element) {
    element.textContent = value;
  }
}

function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// Original showClips function - replaced by enhanced version below

// Admin stress test
$('stressForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const sessionId = $('stressSessionId').value || currentSessionId;
    const jobs = Number($('stressJobs').value) || 10;
    const interpolationFps = Number($('stressFps').value) || 60;
    const workFactor = Number($('stressWork').value) || 1;
    const slowFactor = Number($('stressSlow').value) || 4;
    const preset = $('stressPreset').value || 'medium';
    
    console.log('🚀 Starting admin stress test...');
    console.log('📋 Stress test config:', { sessionId, jobs, interpolationFps, workFactor, slowFactor, preset });
    
    const startTime = Date.now();
    const { json } = await api('/admin/stress-test', { 
      method: 'POST', 
      body: { 
        sessionId, 
        jobs, 
        options: { interpolationFps, workFactor, slowFactor, preset } 
      } 
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Stress test initiated in ${elapsed}ms`);
    console.log('📊 Response:', json);
    
    $('stressResult').textContent = JSON.stringify(json, null, 2);
    
    // Start monitoring all jobs if we have job IDs
    if (json.jobIds && json.jobIds.length > 0) {
      console.log(`🔍 Monitoring ${json.jobIds.length} jobs for progress...`);
      monitorStressTestJobs(json.jobIds, startTime);
    }
    
  } catch (err) {
    console.error('❌ Stress test failed:', err);
    $('stressResult').textContent = `Stress test failed: ${err.message}`;
  }
});

// Monitor multiple stress test jobs
async function monitorStressTestJobs(jobIds, startTime) {
  const totalJobs = jobIds.length;
  let completedJobs = 0;
  let failedJobs = 0;
  let runningJobs = new Set(jobIds);
  
  console.log(`📈 Starting monitoring of ${totalJobs} jobs...`);
  
  // Monitor each job
  jobIds.forEach(jobId => {
    monitorSingleJob(jobId, startTime, (status) => {
      if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
        runningJobs.delete(jobId);
        completedJobs++;
        if (status === 'failed') failedJobs++;
        
        const elapsed = Date.now() - startTime;
        const successRate = ((completedJobs - failedJobs) / completedJobs * 100).toFixed(1);
        console.log(`📊 Progress: ${completedJobs}/${totalJobs} jobs completed (${successRate}% success) in ${(elapsed/1000).toFixed(1)}s`);
        console.log(`🔄 Still running: ${runningJobs.size} jobs`);
        
        if (runningJobs.size === 0) {
          const totalElapsed = Date.now() - startTime;
          console.log(`🎉 All ${totalJobs} jobs completed in ${(totalElapsed/1000).toFixed(1)}s`);
          console.log(`📈 Final stats: ${completedJobs - failedJobs} succeeded, ${failedJobs} failed`);
          
          // Update admin panel with completion message
          updateAdminCompletionMessage(totalJobs, completedJobs - failedJobs, failedJobs, totalElapsed);
          
          // Hide progress bar
          hideProgressBar();
          
          // Collect all outputs and display them
          collectAndDisplayAllOutputs();
        }
      }
    });
  });
}

// Update admin panel with progress
function updateAdminProgress(completedJobs, totalJobs, runningJobs, elapsed) {
  const container = $('stressResult');
  if (!container) return;
  
  const successRate = ((completedJobs / totalJobs) * 100).toFixed(1);
  const elapsedSeconds = (elapsed / 1000).toFixed(1);
  
  // Update progress message
  let currentContent = container.innerHTML;
  
  // Check if we already have a progress section
  if (currentContent.includes('📊 Progress:')) {
    // Update existing progress
    currentContent = currentContent.replace(
      /📊 Progress:.*?🔄 Still running:.*?jobs/gs,
      `📊 Progress: ${completedJobs}/${totalJobs} jobs completed (${successRate}% success) in ${elapsedSeconds}s\n🔄 Still running: ${runningJobs} jobs`
    );
  } else {
    // Add new progress section
    currentContent += `\n\n📊 Progress: ${completedJobs}/${totalJobs} jobs completed (${successRate}% success) in ${elapsedSeconds}s\n🔄 Still running: ${runningJobs} jobs\n`;
  }
  
  container.innerHTML = currentContent;
  
  // Update progress bar
  updateProgressBar(completedJobs, totalJobs);
}

// Update the visual progress bar
function updateProgressBar(completedJobs, totalJobs) {
  const progressBar = $('stressProgress');
  const progressFill = $('progressFill');
  const progressText = $('progressText');
  
  if (!progressBar || !progressFill || !progressText) return;
  
  // Show progress bar
  progressBar.style.display = 'block';
  
  // Calculate percentage
  const percentage = Math.round((completedJobs / totalJobs) * 100);
  
  // Update progress bar fill
  progressFill.style.width = `${percentage}%`;
  
  // Update progress text
  progressText.textContent = `${percentage}% Complete (${completedJobs}/${totalJobs} jobs)`;
}

// Hide the progress bar
function hideProgressBar() {
  const progressBar = $('stressProgress');
  if (progressBar) {
    progressBar.style.display = 'none';
  }
}

// Monitor a single job with detailed logging
async function monitorSingleJob(jobId, startTime, onComplete) {
  let lastStatus = null;
  let checkCount = 0;
  let lastElapsed = 0;
  
  const checkJob = async () => {
    try {
      checkCount++;
      const { json } = await api(`/jobs/${jobId}`);
      const elapsed = Date.now() - startTime;
      
      // Log status changes
      if (json.status !== lastStatus) {
        console.log(`🔄 Job ${jobId}: ${lastStatus || 'initial'} → ${json.status} (${(elapsed/1000).toFixed(1)}s elapsed)`);
        lastStatus = json.status;
      }
      
      // Log timing updates every second for running jobs
      if (json.status === 'running' && elapsed - lastElapsed >= 1000) {
        console.log(`⏱️  Job ${jobId}: running - ${(elapsed/1000).toFixed(1)}s`);
        lastElapsed = elapsed;
      }
      
      // Log detailed info every 10th check
      if (checkCount % 10 === 0) {
        console.log(`🔍 Job ${jobId} detailed status:`, {
          status: json.status,
          progress: json.progress,
          elapsed: `${(elapsed/1000).toFixed(1)}s`,
          outputs: json.outputs?.length || 0,
          summary: json.summary
        });
      }
      
      if (json.status === 'succeeded' || json.status === 'failed' || json.status === 'cancelled') {
        const totalElapsed = Date.now() - startTime;
        console.log(`✅ Job ${jobId} ${json.status} in ${(totalElapsed/1000).toFixed(1)}s`);
        if (json.outputs && json.outputs.length > 0) {
          console.log(`🎬 Job ${jobId} produced ${json.outputs.length} outputs:`, json.outputs);
        }
        onComplete(json.status);
        return;
      }
      
      // Continue monitoring
      setTimeout(checkJob, 2000);
      
    } catch (err) {
      console.error(`❌ Error monitoring job ${jobId}:`, err);
      setTimeout(checkJob, 5000); // Retry after 5s
    }
  };
  
  checkJob();
}

// Collect and display all outputs from completed jobs
async function collectAndDisplayAllOutputs() {
  try {
    console.log('🎬 Collecting all outputs from completed jobs...');
    
    // Get all jobs to find outputs (use high limit to get all jobs)
    const { json: response } = await api('/jobs?limit=1000&offset=0');
    console.log('📋 API response:', response);
    
    // Handle the correct response format: { items: [...], limit: X, offset: Y }
    const jobs = response.items || response;
    console.log('📋 Retrieved jobs:', jobs.length, 'total jobs');
    
    if (!Array.isArray(jobs)) {
      console.error('❌ Jobs response is not an array:', typeof jobs, jobs);
      displayAdminOutputs([]);
      return;
    }
    
    // Get the current stress test session ID from the admin panel
    const stressSessionId = $('stressSessionId')?.value || currentSessionId;
    console.log('🎯 Filtering for current stress test session:', stressSessionId);
    
    // Filter jobs to only include those from the current stress test session
    const currentSessionJobs = jobs.filter(job => 
      job.targetId === stressSessionId && 
      job.targetType === 'session'
    );
    
    console.log('📊 Jobs for current session:', currentSessionJobs.length);
    
    const completedJobs = currentSessionJobs.filter(job => 
      job.status === 'succeeded' && 
      job.outputs && 
      job.outputs.length > 0
    );
    const succeededJobs = currentSessionJobs.filter(job => job.status === 'succeeded');
    const failedJobs = currentSessionJobs.filter(job => job.status === 'failed');
    
    console.log('✅ Completed jobs with outputs:', completedJobs.length);
    console.log('✅ Total succeeded jobs:', succeededJobs.length);
    console.log('❌ Failed jobs:', failedJobs.length);
    
    if (completedJobs.length === 0) {
      console.log('❌ No completed jobs with outputs found for current session');
      
      // Check if jobs succeeded but have no outputs
      if (succeededJobs.length > 0) {
        console.log('⚠️  Jobs succeeded but have no outputs. This might indicate:');
        console.log('   - FFmpeg processing failed');
        console.log('   - No valid jumps in session');
        console.log('   - File system issues');
        
        // Show details of succeeded jobs without outputs
        succeededJobs.forEach(job => {
          console.log(`   Job ${job.jobId}: status=${job.status}, outputs=${job.outputs?.length || 0}, summary=`, job.summary);
        });
      }
      
      // Still update the admin panel to show no outputs
      displayAdminOutputs([]);
      return;
    }
    
    const allOutputs = completedJobs.flatMap(job => job.outputs);
    console.log(`📊 Found ${allOutputs.length} total outputs from ${completedJobs.length} completed jobs for current session`);
    console.log('🎬 Output media IDs:', allOutputs);
    
    // Display all outputs in admin panel
    displayAdminOutputs(allOutputs);
    
  } catch (err) {
    console.error('❌ Error collecting outputs:', err);
    // Show error in admin panel
    const container = $('stressResult');
    if (container) {
      container.innerHTML += '\n\n❌ Error collecting outputs: ' + err.message;
    }
  }
}

// Update admin panel with completion message
function updateAdminCompletionMessage(totalJobs, succeededJobs, failedJobs, totalElapsed) {
  const container = $('stressResult');
  if (!container) return;
  
  const successRate = ((succeededJobs / totalJobs) * 100).toFixed(1);
  const elapsedSeconds = (totalElapsed / 1000).toFixed(1);
  
  // Add completion message at the top
  let currentContent = container.innerHTML;
  const completionMessage = `
🎉 STRESS TEST COMPLETED! 🎉

⏱️  Total Time: ${elapsedSeconds} seconds
📊 Jobs: ${totalJobs} total
✅ Succeeded: ${succeededJobs}
❌ Failed: ${failedJobs}
📈 Success Rate: ${successRate}%

🎬 Collecting video outputs...
`;

  // Insert completion message at the beginning
  container.innerHTML = completionMessage + currentContent;
  
  console.log('🎉 Admin panel updated with completion message');
}

// Display all outputs in the admin panel
function displayAdminOutputs(mediaIds) {
  const container = $('stressResult');
  if (!container) return;
  
  console.log('🎬 Updating admin panel with outputs:', mediaIds);
  
  // Find the completion message section and update it
  let currentContent = container.innerHTML;
  
  // Replace the "Collecting video outputs..." message with actual results
  if (currentContent.includes('🎬 Collecting video outputs...')) {
    if (mediaIds.length === 0) {
      currentContent = currentContent.replace(
        '🎬 Collecting video outputs...',
        '🎬 Video Outputs Collected!\n❌ No videos were generated for current session (check job logs for errors)'
      );
    } else {
      currentContent += '\n\n🎬 Video Outputs Collected!\n';
      currentContent += `✅ Total: ${mediaIds.length} videos generated successfully for current session\n`;
      currentContent += `📊 Session: ${$('stressSessionId')?.value || currentSessionId}\n`;
    }
  }
  
  // Add video details
  if (mediaIds.length > 0) {
    currentContent += '\n\n📹 Current Session Videos:\n';
    currentContent += `Total: ${mediaIds.length} videos\n\n`;
    
    mediaIds.forEach((mediaId, index) => {
      currentContent += `Video ${index + 1} (ID: ${mediaId}):\n`;
      currentContent += `- Stream: <a href="/api/v1/media/${mediaId}?token=${encodeURIComponent(authToken)}" target="_blank">Stream Video</a>\n\n`;
    });
  } else {
    currentContent += '\n\n❌ No videos generated for current session. Possible reasons:\n';
    currentContent += '- Jobs failed during processing\n';
    currentContent += '- FFmpeg errors occurred\n';
    currentContent += '- No valid jumps were found in the session\n';
    currentContent += '- Check console logs for detailed error messages\n';
  }
  
  container.innerHTML = currentContent;
  
  // Also log to console
  console.log('🎬 Admin panel updated with video outputs:', mediaIds);
}

// Update duration display every second
function updateDurationDisplay(startTime) {
  const jobDuration = $('jobDuration');
  if (jobDuration) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    jobDuration.textContent = duration;
  }
}

// Update progress display with clean UI elements
function updateProgressDisplay(jobData) {
  const jobStatusDisplay = $('jobStatusDisplay');
  const jobDuration = $('jobDuration');
  const jumpCount = $('jumpCount');
  const jobSettings = $('jobSettings');
  
  // Update status display
  if (jobStatusDisplay) {
    jobStatusDisplay.textContent = jobData.status === 'queued' ? 'Queued' : jobData.status === 'running' ? 'Processing' : 'Completed';
  }
  
  if (jumpCount) {
    const total = jobData.progress?.total || '-';
    jumpCount.textContent = total.toString();
  }
  
  if (jobSettings) {
    const options = jobData.options || {};
    const fps = options.interpolationFps || 60;
    const factor = options.workFactor || 1;
    const slow = options.slowFactor ?? '-';
    const preset = options.preset || '-';
    const count = options.jobCount || 1;
    jobSettings.textContent = `${fps}fps, ${factor}x, slow=${slow}, preset=${preset}, jobs=${count}`;
  }
  
  // Update additional job details
  updateElement('jobId', jobData.jobId || '-');
  updateElement('targetType', jobData.targetType || '-');
  updateElement('jobOwner', jobData.owner || '-');
  updateElement('displayWorkFactor', jobData.options?.workFactor || '-');
  updateElement('displayInterpolationFps', jobData.options?.interpolationFps || '-');
  updateElement('displaySlowFactor', jobData.options?.slowFactor ?? '-');
  updateElement('displayPreset', jobData.options?.preset || '-');
  
  // Format and display queue time
  if (jobData.queuedAt) {
    const queuedTime = new Date(jobData.queuedAt);
    updateElement('queueTime', queuedTime.toLocaleTimeString());
  } else {
    updateElement('queueTime', '-');
  }
  
  // Show stderr output if available
  const stderrContainer = $('stderrContainer');
  if (jobData.stderrTail && stderrContainer) {
    updateElement('stderrTail', jobData.stderrTail);
    stderrContainer.style.display = 'flex';
  } else if (stderrContainer) {
    stderrContainer.style.display = 'none';
  }
}

// Update job status display with modern UI
function updateJobStatusDisplay(jobData) {
  const noJobsMessage = $('noJobsMessage');
  const jobStatus = $('jobStatus');
  const jobSuccess = $('jobSuccess');
  const jobError = $('jobError');
  const jobErrorText = $('jobErrorText');
  
  // Hide all status containers first
  [noJobsMessage, jobStatus, jobSuccess, jobError].forEach(el => {
    if (el) el.classList.add('hidden');
  });
  
  if (jobData.status === 'pending' || jobData.status === 'running') {
    if (jobStatus) {
      // Update clean progress display
      updateProgressDisplay(jobData);
      jobStatus.classList.remove('hidden');
    }
  } else if (jobData.status === 'succeeded') {
    if (jobSuccess) {
      jobSuccess.classList.remove('hidden');
    }
  } else if (jobData.status === 'failed') {
    if (jobError && jobErrorText) {
      jobErrorText.textContent = jobData.error || 'An error occurred during processing.';
      jobError.classList.remove('hidden');
    }
  }
}

// Enhanced showClips function for modern UI
async function showClips(mediaIds) {
  const container = $('clips');
  const noClipsMessage = $('noClipsMessage');
  
  if (!container) return;
  
  container.innerHTML = '';
  
  if (mediaIds.length === 0) {
    if (noClipsMessage) noClipsMessage.style.display = 'block';
    return;
  } else {
    if (noClipsMessage) noClipsMessage.style.display = 'none';
  }
  
  mediaIds.forEach((id, index) => {
    const clipDiv = document.createElement('div');
    clipDiv.className = 'bg-gray-50 rounded-lg p-4 space-y-3';
    
    clipDiv.innerHTML = `
      <div class="flex items-center justify-between">
        <h4 class="font-medium text-gray-900">Video Clip ${index + 1}</h4>
        <a href="/api/v1/media/${id}?token=${encodeURIComponent(authToken)}" 
           target="_blank" 
           class="text-primary-600 hover:text-primary-700 font-medium">
          <i data-lucide="external-link" class="w-4 h-4 inline mr-1"></i>
          Open in New Tab
        </a>
      </div>
      <div class="aspect-video bg-gray-900 rounded-lg overflow-hidden">
        <video controls class="w-full h-full object-contain">
          <source src="/api/v1/media/${id}?token=${encodeURIComponent(authToken)}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      </div>
      <div class="text-xs text-gray-500">ID: ${id}</div>
    `;
    
    container.appendChild(clipDiv);
  });
  
  // Refresh icons
  lucide.createIcons();
}

// Cancel a running job
async function cancelJob(jobId) {
  if (!confirm('Are you sure you want to cancel this job?')) {
    return;
  }
  
  try {
    console.log(`🛑 Canceling job ${jobId}...`);
    await api(`/jobs/${jobId}/cancel`, { method: 'POST' });
    
    // Hide cancel button
    const cancelBtn = $('cancelJobBtn');
    if (cancelBtn) {
      cancelBtn.classList.add('hidden');
    }
    
    // Update status display
    updateJobStatusDisplay({
      status: 'cancelled',
      error: 'Job was manually cancelled'
    });
    
    console.log(`✅ Job ${jobId} cancelled successfully`);
    
  } catch (err) {
    console.error('❌ Cancel job failed:', err);
    alert(`Failed to cancel job: ${err.message}`);
  }
}

// Clear all stuck jobs (running for over 2 minutes)
async function clearStuckJobs() {
  if (!confirm('This will cancel all jobs that have been running for over 2 minutes without progress. Continue?')) {
    return;
  }
  
  try {
    console.log('🧹 Fetching all jobs to identify stuck ones...');
    const { json: response } = await api('/jobs');
    
    // Handle the correct response format: { items: [...], limit: X, offset: Y }
    const jobs = response.items || response;
    
    if (!Array.isArray(jobs)) {
      console.error('❌ Jobs response is not an array:', typeof jobs, jobs);
      alert('Failed to fetch jobs: Invalid response format');
      return;
    }
    
    const now = Date.now();
    const stuckJobs = jobs.filter(job => {
      if (job.status !== 'running') return false;
      
      const startTime = new Date(job.startedAt).getTime();
      const elapsed = now - startTime;
      
      // Consider stuck if running for over 2 minutes with no progress
      return elapsed > 120000 && (!job.progress || job.progress.completed === 0);
    });
    
    if (stuckJobs.length === 0) {
      alert('No stuck jobs found!');
      return;
    }
    
    console.log(`🛑 Found ${stuckJobs.length} stuck jobs, canceling...`);
    
    let canceledCount = 0;
    for (const job of stuckJobs) {
      try {
        await api(`/jobs/${job.jobId}/cancel`, { method: 'POST' });
        canceledCount++;
        console.log(`✅ Canceled stuck job: ${job.jobId}`);
      } catch (err) {
        console.error(`❌ Failed to cancel job ${job.jobId}:`, err);
      }
    }
    
    alert(`Successfully canceled ${canceledCount} out of ${stuckJobs.length} stuck jobs.`);
    
    // Refresh the page to clean up UI state
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (err) {
    console.error('❌ Clear stuck jobs failed:', err);
    alert(`Failed to clear stuck jobs: ${err.message}`);
  }
}

// Sign out function
function signOut() {
  console.log('🚪 Signing out...');
  
  // Clear authentication data
  authToken = null;
  currentUser = null;
  
  // Clear localStorage to remove old JWT tokens
  localStorage.clear();
  
  // Hide sidebar and show auth section
  const sidebar = $('sidebar');
  const contentWithSidebar = $('contentWithSidebar');
  const authSection = $('authSection');
  
  if (sidebar) sidebar.style.display = 'none';
  if (contentWithSidebar) contentWithSidebar.style.display = 'none';
  if (authSection) authSection.style.display = 'flex';
  
  // Hide admin nav item
  const adminNavItem = document.querySelector('.admin-only');
  if (adminNavItem) adminNavItem.style.setProperty('display', 'none', 'important');
  
  // Clear current user display in sidebar
  const currentUserElement = $('currentUser');
  if (currentUserElement) {
    currentUserElement.textContent = '';
  }
  
  // Clear top navigation bar user info
  const userDisplayName = $('userDisplayName');
  const userRole = $('userRole');
  const navActions = $('navActions');
  
  if (userDisplayName) userDisplayName.textContent = 'User';
  if (userRole) userRole.textContent = 'Member';
  if (navActions) navActions.style.display = 'none';
  
  // Clear any welcome messages or success messages
  const welcomeMessage = document.querySelector('.text-green-600');
  if (welcomeMessage) {
    welcomeMessage.remove();
  }
  
  // Reset forms
  const loginForm = $('loginForm');
  const registerForm = $('registerForm');
  if (loginForm) loginForm.reset();
  if (registerForm) registerForm.reset();
  
  // Show login form by default
  console.log('🔄 Showing login form...');
  const loginFormEl = $('loginForm');
  const registerFormEl = $('registerForm');
  const authSubtitle = $('authSubtitle');
  
  if (loginFormEl) loginFormEl.classList.remove('hidden');
  if (registerFormEl) registerFormEl.classList.add('hidden');
  if (authSubtitle) authSubtitle.textContent = 'Sign in to analyze your athletic performance';
  
  // Debug: Check auth section visibility
  console.log('🔍 Auth section after signout:', authSection);
  console.log('🔍 Auth section display style:', authSection ? authSection.style.display : 'not found');
  console.log('🔍 Auth section classList:', authSection ? authSection.classList.toString() : 'not found');
  
  console.log('✅ Signed out successfully');
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Jump Metrics application starting...');
  
  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
    console.log('✅ Lucide icons initialized');
  }
  
  // Only initialize navigation and drag-drop after login
  // These will be called from the login success handler
  
  // Initialize admin controls
  const clearStuckJobsBtn = $('clearStuckJobs');
  if (clearStuckJobsBtn) {
    clearStuckJobsBtn.addEventListener('click', clearStuckJobs);
  }

  // Auth form toggles
  const showRegister = $('showRegister');
  const showLogin = $('showLogin');
  
  // Sign out button
  const signOutBtn = $('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', signOut);
  }
  const loginFormEl = $('loginForm');
  const registerFormEl = $('registerForm');
  const authSubtitle = $('authSubtitle');
  if (showRegister && showLogin && loginFormEl && registerFormEl) {
    showRegister.addEventListener('click', () => {
      loginFormEl.classList.add('hidden');
      registerFormEl.classList.remove('hidden');
      if (authSubtitle) authSubtitle.textContent = 'Create an account to get started';
    });
    showLogin.addEventListener('click', () => {
      registerFormEl.classList.add('hidden');
      loginFormEl.classList.remove('hidden');
      if (authSubtitle) authSubtitle.textContent = 'Sign in to analyze your athletic performance';
    });
  }

  // Register form submit
  if (registerFormEl) {
    registerFormEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitButton = e.target.querySelector('button[type="submit"]');
      const originalText = submitButton.innerHTML;
      try {
        submitButton.disabled = true;
        submitButton.classList.add('btn-loading');
    const username = $('regUsername').value;
    const email = $('regEmail').value;
    const password = $('regPassword').value;
    const { json } = await api('/auth/register', { method: 'POST', body: { username, email, password } });
    const info = $('loginInfo');
    if (info) {
      if (json.userConfirmed) {
        info.innerHTML = '<div class="text-green-600">Account created and confirmed. Please sign in.</div>';
        showLogin?.click();
      } else {
        info.innerHTML = `
          <div class="text-green-600">Account created. Check your email for a verification code.</div>
          <div class="mt-3 space-y-2">
            <input type="text" id="confirmCode" placeholder="Enter confirmation code"
              class="w-full px-3 py-2 border border-gray-300 rounded" />
            <div class="flex space-x-2">
              <button id="confirmBtn" class="px-3 py-2 bg-primary-600 text-white rounded">Confirm</button>
              <button id="resendBtn" class="px-3 py-2 bg-gray-200 rounded">Resend Code</button>
            </div>
          </div>`;
        // Wire confirmation handlers
        $('confirmBtn')?.addEventListener('click', async () => {
          try {
            const code = $('confirmCode').value;
            await api('/auth/confirm', { method: 'POST', body: { username, code } });
            info.innerHTML = '<div class="text-green-600">Email confirmed. Please sign in.</div>';
            showLogin?.click();
          } catch (err2) {
            info.innerHTML = `<div class=\"text-red-600\">${err2.message}</div>`;
          }
        });
        $('resendBtn')?.addEventListener('click', async () => {
          try {
            await api('/auth/resend', { method: 'POST', body: { username } });
            info.innerHTML = '<div class="text-green-600">Code resent. Check your email.</div>' + info.innerHTML;
          } catch (err3) {
            info.innerHTML = `<div class=\"text-red-600\">${err3.message}</div>` + info.innerHTML;
          }
        });
      }
    }
      } catch (err) {
        const info = $('loginInfo');
        if (info) {
          info.innerHTML = `<div class="text-red-600">${err.message}</div>`;
        }
      } finally {
        submitButton.disabled = false;
        submitButton.classList.remove('btn-loading');
        submitButton.innerHTML = originalText;
      }
    });
  }
  
  console.log('✅ Jump Metrics application ready');
});
