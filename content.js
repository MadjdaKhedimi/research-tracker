// Content script - Auto-detects papers with comprehensive publisher support

// Configuration
const AUTO_DETECT_ENABLED = true;
const DEBUG_MODE = true; // Set to false to reduce console logs

// State management
let hasDetected = false;
let currentPaperUrl = null;
let isProcessing = false;
let detectionAttempts = 0;
const MAX_ATTEMPTS = 3;

// Logging helper
function log(message, data = null) {
  if (DEBUG_MODE) {
    console.log(`[Research Tracker] ${message}`, data || '');
  }
}

// Multiple detection attempts with increasing delays
function scheduleDetection() {
  const delays = [500, 1500, 3000]; // Try at 0.5s, 1.5s, and 3s
  
  delays.forEach((delay, index) => {
    setTimeout(() => {
      if (!hasDetected && detectionAttempts <= index) {
        detectionAttempts = index + 1;
        log(`Detection attempt ${detectionAttempts} at ${delay}ms`);
        detectAndProcess();
      }
    }, delay);
  });
}

// Run on load
window.addEventListener('load', () => {
  log('Page loaded, starting detection');
  scheduleDetection();
});

// Also try on DOMContentLoaded for faster detection
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    log('DOM ready, attempting early detection');
    if (!hasDetected) {
      detectAndProcess();
    }
  });
}

function detectAndProcess() {
  if (isProcessing) {
    log('Already processing, skipping');
    return;
  }
  isProcessing = true;
  
  const url = window.location.href;
  log(`Checking URL: ${url}`);
  
  if (currentPaperUrl === url && hasDetected) {
    log('Already processed this URL');
    isProcessing = false;
    return;
  }
  
  let paperInfo = null;
  let source = 'Unknown';

  // Check each publisher
  if (url.includes('arxiv.org/abs/')) {
    source = 'arXiv';
    paperInfo = extractArxiv();
  } else if (url.includes('pubmed.ncbi.nlm.nih.gov')) {
    source = 'PubMed';
    paperInfo = extractPubmed();
  } else if (url.includes('nature.com/articles/')) {
    source = 'Nature';
    paperInfo = extractNature();
  } else if (url.includes('science.org/doi/')) {
    source = 'Science';
    paperInfo = extractScience();
  } else if (url.includes('ieeexplore.ieee.org/document/')) {
    source = 'IEEE';
    paperInfo = extractIEEE();
  } else if (url.includes('springer.com/article/') || url.includes('link.springer.com/article/')) {
    source = 'Springer';
    paperInfo = extractSpringer();
  } else if (url.includes('onlinelibrary.wiley.com/doi/')) {
    source = 'Wiley';
    paperInfo = extractWiley();
  } else if (url.includes('journals.plos.org/')) {
    source = 'PLOS';
    paperInfo = extractPLOS();
  } else if (url.includes('mdpi.com/')) {
    source = 'MDPI';
    paperInfo = extractMDPI();
  } else if (url.includes('sciencedirect.com/science/article/')) {
    source = 'ScienceDirect';
    paperInfo = extractScienceDirect();
  } else if (url.includes('scholar.google.com')) {
    log('Google Scholar - skipping (multiple papers)');
    isProcessing = false;
    return;
  } else {
    log('URL does not match any known publisher');
    isProcessing = false;
    return;
  }

  log(`Matched publisher: ${source}`);

  if (paperInfo) {
    log(`✅ Paper detected: ${paperInfo.title.substring(0, 60)}...`);
    hasDetected = true;
    currentPaperUrl = url;
    
    if (AUTO_DETECT_ENABLED) {
      showAutoDetectNotification(paperInfo);
    } else {
      injectButton(paperInfo);
    }
  } else {
    log(`❌ Failed to extract paper info from ${source}`);
    log('This could mean:');
    log('  1. The page is still loading (will retry)');
    log('  2. The site structure has changed');
    log('  3. This is not an article page');
  }
  
  isProcessing = false;
}

function extractArxiv() {
  log('Extracting from arXiv...');
  const titleEl = document.querySelector('h1.title');
  
  if (!titleEl) {
    log('arXiv: Title element not found');
    return null;
  }
  
  const authorsEl = document.querySelector('.authors');
  const abstractEl = document.querySelector('.abstract');
  
  return {
    title: titleEl.textContent.replace('Title:', '').trim(),
    authors: authorsEl ? authorsEl.textContent.replace('Authors:', '').trim() : '',
    abstract: abstractEl ? abstractEl.textContent.replace('Abstract:', '').trim() : '',
    url: window.location.href,
    source: 'arXiv'
  };
}

function extractPubmed() {
  log('Extracting from PubMed...');
  const selectors = [
    'h1.heading-title',
    'h1.title',
    '.article-details h1',
    '.full-view h1'
  ];
  
  let titleEl = null;
  for (const selector of selectors) {
    titleEl = document.querySelector(selector);
    if (titleEl) {
      log(`PubMed: Found title with selector: ${selector}`);
      break;
    }
  }
  
  if (!titleEl) {
    log('PubMed: Title element not found. Tried selectors:', selectors);
    return null;
  }
  
  const authorsEl = document.querySelector('.authors-list, .authors');
  const abstractEl = document.querySelector('.abstract-content, #enc-abstract');
  
  return {
    title: titleEl.textContent.trim(),
    authors: authorsEl ? authorsEl.textContent.trim() : '',
    abstract: abstractEl ? abstractEl.textContent.trim() : '',
    url: window.location.href,
    source: 'PubMed'
  };
}

function extractNature() {
  log('Extracting from Nature...');
  const selectors = [
    'h1.c-article-title',
    'h1[data-test="article-title"]',
    'h1.c-article__title',
    '.c-article-header h1',
    'header h1',
    'article h1'
  ];
  
  let titleEl = null;
  for (const selector of selectors) {
    titleEl = document.querySelector(selector);
    if (titleEl) {
      log(`Nature: Found title with selector: ${selector}`);
      break;
    }
  }
  
  if (!titleEl) {
    log('Nature: Title element not found. Tried selectors:', selectors);
    return null;
  }
  
  const authorsEl = document.querySelector('.c-article-author-list, [data-test="author-list"], .c-article-authors');
  const abstractEl = document.querySelector('#Abs1-content, .c-article-section__content, .c-article-body__section');
  
  return {
    title: titleEl.textContent.trim(),
    authors: authorsEl ? authorsEl.textContent.trim() : '',
    abstract: abstractEl ? abstractEl.textContent.trim() : '',
    url: window.location.href,
    source: 'Nature'
  };
}

function extractScience() {
  log('Extracting from Science...');
  const selectors = [
    'h1.article-title',
    'h1[property="name"]',
    'h1.highwire-cite-title',
    '.article__header h1',
    'header.article__header h1',
    'article h1'
  ];
  
  let titleEl = null;
  for (const selector of selectors) {
    titleEl = document.querySelector(selector);
    if (titleEl) {
      log(`Science: Found title with selector: ${selector}`);
      break;
    }
  }
  
  if (!titleEl) {
    log('Science: Title element not found. Tried selectors:', selectors);
    return null;
  }
  
  const authorsEl = document.querySelector('.contributors, .author-list, .highwire-citation-authors');
  const abstractEl = document.querySelector('.abstract, [role="doc-abstract"], .section.abstract');
  
  return {
    title: titleEl.textContent.trim(),
    authors: authorsEl ? authorsEl.textContent.trim() : '',
    abstract: abstractEl ? abstractEl.textContent.trim() : '',
    url: window.location.href,
    source: 'Science'
  };
}

function extractIEEE() {
  log('Extracting from IEEE...');
  const selectors = [
    'h1.document-title',
    'h1[class*="title"]',
    '.document-title h1',
    '.document-header h1',
    'xpl-document-header h1',
    'h1'
  ];
  
  let titleEl = null;
  for (const selector of selectors) {
    titleEl = document.querySelector(selector);
    if (titleEl && titleEl.textContent.trim().length > 10) {
      log(`IEEE: Found title with selector: ${selector}`);
      break;
    }
  }
  
  if (!titleEl || titleEl.textContent.trim().length < 10) {
    log('IEEE: Title element not found or too short. Tried selectors:', selectors);
    return null;
  }
  
  const authorsEl = document.querySelector('.authors-info, .authors-container, .authors-info-container');
  const abstractEl = document.querySelector('.abstract-text, div.abstract, .abstract-content');
  
  return {
    title: titleEl.textContent.trim(),
    authors: authorsEl ? authorsEl.textContent.trim() : '',
    abstract: abstractEl ? abstractEl.textContent.trim() : '',
    url: window.location.href,
    source: 'IEEE'
  };
}

function extractSpringer() {
  log('Extracting from Springer...');
  const selectors = [
    'h1.c-article-title',
    'h1[data-test="article-title"]',
    'h1.ArticleTitle',
    '.c-article-header h1',
    'header h1',
    'article h1',
    '#title h1'
  ];
  
  let titleEl = null;
  for (const selector of selectors) {
    titleEl = document.querySelector(selector);
    if (titleEl) {
      log(`Springer: Found title with selector: ${selector}`);
      break;
    }
  }
  
  if (!titleEl) {
    log('Springer: Title element not found. Tried selectors:', selectors);
    return null;
  }
  
  const authorsEl = document.querySelector('.c-article-author-list, #article-author-list, .c-article-authors-list');
  const abstractEl = document.querySelector('#Abs1-content, .c-article-section__content, .Abstract');
  
  return {
    title: titleEl.textContent.trim(),
    authors: authorsEl ? authorsEl.textContent.trim() : '',
    abstract: abstractEl ? abstractEl.textContent.trim() : '',
    url: window.location.href,
    source: 'Springer'
  };
}

function extractWiley() {
  log('Extracting from Wiley...');
  const selectors = [
    'h1.citation__title',
    'h1.article-header__title',
    'h1[class*="articleTitle"]',
    '.article-header h1',
    'header h1',
    'article h1'
  ];
  
  let titleEl = null;
  for (const selector of selectors) {
    titleEl = document.querySelector(selector);
    if (titleEl) {
      log(`Wiley: Found title with selector: ${selector}`);
      break;
    }
  }
  
  if (!titleEl) {
    log('Wiley: Title element not found. Tried selectors:', selectors);
    return null;
  }
  
  const authorsEl = document.querySelector('.author-list, .loa-authors-trunc, .article-header__authors');
  const abstractEl = document.querySelector('.article-section__content, section[class*="abstract"]');
  
  return {
    title: titleEl.textContent.trim(),
    authors: authorsEl ? authorsEl.textContent.trim() : '',
    abstract: abstractEl ? abstractEl.textContent.trim() : '',
    url: window.location.href,
    source: 'Wiley'
  };
}

function extractPLOS() {
  log('Extracting from PLOS...');
  const selectors = [
    'h1#artTitle',
    'h1.title',
    'h1[id*="title"]',
    'h1.article-title',
    '.article-title h1',
    'header h1',
    'article h1'
  ];
  
  let titleEl = null;
  for (const selector of selectors) {
    titleEl = document.querySelector(selector);
    if (titleEl) {
      log(`PLOS: Found title with selector: ${selector}`);
      break;
    }
  }
  
  if (!titleEl) {
    log('PLOS: Title element not found. Tried selectors:', selectors);
    return null;
  }
  
  const authorsEl = document.querySelector('.author-list, #authList, .contrib-group');
  const abstractEl = document.querySelector('.abstract, div[id*="abstract"]');
  
  return {
    title: titleEl.textContent.trim(),
    authors: authorsEl ? authorsEl.textContent.trim() : '',
    abstract: abstractEl ? abstractEl.textContent.trim() : '',
    url: window.location.href,
    source: 'PLOS'
  };
}

function extractMDPI() {
  log('Extracting from MDPI...');
  const selectors = [
    'h1.title',
    'h1[class*="title"]',
    '.article-title h1',
    'h1.hypothesis_container',
    'header h1',
    '.art-title h1',
    '.html-p h1',
    'article h1',
    '.article-content h1',
    'main h1'
  ];
  
  let titleEl = null;
  for (const selector of selectors) {
    titleEl = document.querySelector(selector);
    if (titleEl && titleEl.textContent.trim().length > 10) {
      log(`MDPI: Found title with selector: ${selector}`);
      log(`MDPI: Title text: ${titleEl.textContent.trim().substring(0, 50)}...`);
      break;
    }
  }
  
  if (!titleEl || titleEl.textContent.trim().length < 10) {
    log('MDPI: Title element not found or too short. Tried selectors:', selectors);
    log('MDPI: Available h1 elements:', document.querySelectorAll('h1').length);
    // Log what h1 elements exist
    document.querySelectorAll('h1').forEach((h1, i) => {
      log(`  h1[${i}]: "${h1.textContent.trim().substring(0, 50)}" class="${h1.className}"`);
    });
    return null;
  }
  
  const authorsEl = document.querySelector('.art-authors, .authors, .article-authors, .sciprofiles-link, div[class*="author"], .art-authors-list');
  const abstractEl = document.querySelector('.art-abstract, section.abstract, .article-content .abstract, div[class*="abstract"]');
  
  return {
    title: titleEl.textContent.trim(),
    authors: authorsEl ? authorsEl.textContent.trim() : '',
    abstract: abstractEl ? abstractEl.textContent.trim() : '',
    url: window.location.href,
    source: 'MDPI'
  };
}

function extractScienceDirect() {
  log('Extracting from ScienceDirect...');
  const selectors = [
    'h1.title-text',
    'span.title-text',
    'h1[class*="title"]',
    '.title-heading',
    'h1.article-title',
    'header h1',
    'article h1'
  ];
  
  let titleEl = null;
  for (const selector of selectors) {
    titleEl = document.querySelector(selector);
    if (titleEl) {
      log(`ScienceDirect: Found title with selector: ${selector}`);
      break;
    }
  }
  
  if (!titleEl) {
    log('ScienceDirect: Title element not found. Tried selectors:', selectors);
    return null;
  }
  
  const authorsEl = document.querySelector('.author-group, #author-group, div[class*="author"], .authors-list');
  const abstractEl = document.querySelector('.abstract.author, div[id*="abstract"], section.abstract, .Abstracts');
  
  return {
    title: titleEl.textContent.trim(),
    authors: authorsEl ? authorsEl.textContent.trim() : '',
    abstract: abstractEl ? abstractEl.textContent.trim() : '',
    url: window.location.href,
    source: 'ScienceDirect'
  };
}

function showAutoDetectNotification(paperInfo) {
  if (document.getElementById('research-tracker-notification')) {
    log('Notification already showing');
    return;
  }
  
  chrome.storage.sync.get(['papers'], (result) => {
    const papers = result.papers || [];
    const alreadySaved = papers.some(p => p.url === paperInfo.url);
    
    if (alreadySaved) {
      showSimpleNotification('✅ Already in your library', 'info');
      return;
    }

    const notification = document.createElement('div');
    notification.id = 'research-tracker-notification';
    notification.className = 'rt-auto-notification';
    notification.innerHTML = `
      <div class="rt-notification-content">
        <div class="rt-notification-header">
          <span class="rt-notification-icon">📚</span>
          <span class="rt-notification-title">Paper Detected</span>
          <button class="rt-notification-close" id="rt-close-notification">×</button>
        </div>
        <div class="rt-notification-body">
          <p class="rt-notification-paper-title">${escapeHtml(paperInfo.title.substring(0, 80))}${paperInfo.title.length > 80 ? '...' : ''}</p>
          <p class="rt-notification-source">${paperInfo.source}</p>
        </div>
        <div class="rt-notification-actions">
          <button class="rt-btn-save" id="rt-save-paper">Save to Library</button>
          <button class="rt-btn-save-notes" id="rt-save-with-notes">Save with Notes</button>
          <button class="rt-btn-dismiss" id="rt-dismiss">Dismiss</button>
        </div>
      </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);

    document.getElementById('rt-save-paper').addEventListener('click', () => {
      savePaper(paperInfo, '');
      removeNotification(notification);
    }, { once: true });

    document.getElementById('rt-save-with-notes').addEventListener('click', () => {
      removeNotification(notification);
      showSaveDialog(paperInfo);
    }, { once: true });

    document.getElementById('rt-dismiss').addEventListener('click', () => {
      removeNotification(notification);
    }, { once: true });

    document.getElementById('rt-close-notification').addEventListener('click', () => {
      removeNotification(notification);
    }, { once: true });

    setTimeout(() => {
      if (document.getElementById('research-tracker-notification')) {
        removeNotification(notification);
      }
    }, 12000);
  });
}

function removeNotification(notification) {
  if (!notification || !notification.parentNode) return;
  notification.classList.remove('show');
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 300);
}

function injectButton(paperInfo) {
  if (document.getElementById('research-tracker-btn')) return;
  
  const button = document.createElement('button');
  button.id = 'research-tracker-btn';
  button.className = 'rt-save-btn';
  button.innerHTML = '📚 Save to Research Tracker';
  
  button.addEventListener('click', () => {
    showSaveDialog(paperInfo);
  }, { once: true });

  button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(37,99,235,0.4);
  `;
  document.body.appendChild(button);
}

function showSaveDialog(paperInfo) {
  if (document.getElementById('rt-dialog')) return;
  
  const dialog = document.createElement('div');
  dialog.id = 'rt-dialog';
  dialog.innerHTML = `
    <div class="rt-overlay">
      <div class="rt-modal">
        <h3>Save Paper</h3>
        <p class="rt-title">${escapeHtml(paperInfo.title)}</p>
        <textarea id="rt-notes" placeholder="Add your notes here..." rows="4"></textarea>
        <div class="rt-actions">
          <button id="rt-save-btn" class="rt-btn-primary">Save</button>
          <button id="rt-cancel-btn" class="rt-btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
  setTimeout(() => document.getElementById('rt-notes').focus(), 100);

  document.getElementById('rt-save-btn').addEventListener('click', () => {
    const notes = document.getElementById('rt-notes').value.trim();
    savePaper(paperInfo, notes);
    document.body.removeChild(dialog);
  }, { once: true });

  document.getElementById('rt-cancel-btn').addEventListener('click', () => {
    document.body.removeChild(dialog);
  }, { once: true });
  
  document.querySelector('.rt-overlay').addEventListener('click', (e) => {
    if (e.target.classList.contains('rt-overlay')) {
      document.body.removeChild(dialog);
    }
  }, { once: true });
}

function savePaper(paperInfo, notes) {
  const paper = {
    id: Date.now(),
    title: paperInfo.title,
    url: paperInfo.url,
    source: paperInfo.source,
    notes: notes,
    savedAt: new Date().toISOString()
  };

  chrome.storage.sync.get(['papers'], (result) => {
    const papers = result.papers || [];
    
    const exists = papers.some(p => p.url === paper.url);
    if (exists) {
      showSimpleNotification('📚 Paper already in library', 'info');
      return;
    }

    papers.push(paper);
    chrome.storage.sync.set({ papers }, () => {
      log('Paper saved successfully');
      showSimpleNotification('✅ Paper saved successfully!', 'success');
    });
  });
}

let lastNotification = null;
let notificationTimeout = null;

function showSimpleNotification(message, type = 'success') {
  if (lastNotification && lastNotification.parentNode) {
    lastNotification.parentNode.removeChild(lastNotification);
  }
  
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }
  
  const notification = document.createElement('div');
  notification.className = `rt-simple-notification rt-notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  lastNotification = notification;
  setTimeout(() => notification.classList.add('show'), 100);

  notificationTimeout = setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      if (lastNotification === notification) {
        lastNotification = null;
      }
    }, 300);
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Log initial state
log('Extension loaded and ready');
log(`Auto-detect: ${AUTO_DETECT_ENABLED ? 'ON' : 'OFF'}`);
log(`Debug mode: ${DEBUG_MODE ? 'ON' : 'OFF'}`);
