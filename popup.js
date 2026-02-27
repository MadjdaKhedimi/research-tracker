// Research Tracker v2.3.0 — Dynamic Metrics & Improved Matching

// ========== TAB NAVIGATION ==========
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${targetTab}-tab`).classList.add('active');
    if (targetTab === 'library')   loadPapers();
    if (targetTab === 'deadlines') loadDeadlines();
    if (targetTab === 'discover')  loadRecommendations();
    if (targetTab === 'profile')   loadProfile();
  });
});

document.addEventListener('DOMContentLoaded', () => {
  loadPapers();
  updatePaperCount();
  loadProfile();
});

// ========== DYNAMIC METRICS CACHE ==========
const metricsCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function fetchJournalMetrics(venueName, venueId = null) {
  const cacheKey = venueId || venueName;
  const cached = metricsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }

  try {
    let openAlexData = null;
    if (venueId) {
      const response = await fetch(`https://api.openalex.org/sources/${venueId}?mailto=researcher@example.com`);
      if (response.ok) openAlexData = await response.json();
    } else {
      const searchResponse = await fetch(`https://api.openalex.org/sources?search=${encodeURIComponent(venueName)}&mailto=researcher@example.com`);
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.results && searchData.results.length > 0) {
          openAlexData = searchData.results[0];
        }
      }
    }

    if (!openAlexData) return null;

    const metrics = {
      impactFactor: openAlexData.summary_stats?.['2yr_mean_citedness'] || null,
      hIndex: openAlexData.summary_stats?.h_index || null,
      quartile: null,
      citedByCount: openAlexData.cited_by_count || 0,
      worksCount: openAlexData.works_count || 0,
      isOA: openAlexData.is_oa || false,
      publisher: openAlexData.host_organization_name || null,
      issn: openAlexData.issn_l || (openAlexData.issn?.[0] || null),
      homepage: openAlexData.homepage_url || null,
      apcUsd: openAlexData.apc_usd || null,
      indexed: [],
      concepts: (openAlexData.x_concepts || []).slice(0, 6).map(c => c.display_name),
      lastUpdated: openAlexData.updated_date || new Date().toISOString()
    };

    // Infer quartile from h-index
    if (metrics.hIndex) {
      if (metrics.hIndex >= 100) metrics.quartile = 'Q1';
      else if (metrics.hIndex >= 50) metrics.quartile = 'Q2';
      else if (metrics.hIndex >= 25) metrics.quartile = 'Q3';
      else metrics.quartile = 'Q4';
    }

    // Check indexing
    if (openAlexData.is_in_doaj) metrics.indexed.push('DOAJ');
    if (openAlexData.works_count > 1000) metrics.indexed.push('Scopus');
    if (metrics.hIndex > 20) metrics.indexed.push('Web of Science');

    metricsCache.set(cacheKey, { data: metrics, timestamp: Date.now() });
    return metrics;
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return null;
  }
}

// ========== LIBRARY ==========
function loadPapers(searchQuery = '') {
  chrome.storage.sync.get(['papers'], (result) => {
    let papers = result.papers || [];
    const container = document.getElementById('papers-list');

    if (searchQuery) {
      papers = papers.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (papers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
          <p>No papers found</p>
          <span class="hint">Visit arXiv or PubMed and click "Save"</span>
        </div>`;
      return;
    }

    papers.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    container.innerHTML = papers.map(paper => `
      <div class="paper-card" data-paper-id="${paper.id}">
        <h3 class="paper-title">${escapeHtml(paper.title)}</h3>
        <div class="paper-meta">
          ${paper.source ? `<span class="badge">${escapeHtml(paper.source)}</span>` : ''}
          <span>${formatDate(paper.savedAt)}</span>
        </div>
        ${paper.notes ? `<div class="paper-notes">${escapeHtml(paper.notes)}</div>` : ''}
        <div class="paper-actions">
          <button class="btn-primary btn-sm open-paper-btn" data-url="${escapeHtml(paper.url)}">Open</button>
          <button class="btn-secondary btn-sm delete-paper-btn" data-id="${paper.id}">Delete</button>
        </div>
      </div>`).join('');

    document.querySelectorAll('.open-paper-btn').forEach(btn => {
      btn.addEventListener('click', () => chrome.tabs.create({ url: btn.dataset.url }));
    });
    document.querySelectorAll('.delete-paper-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this paper?')) {
          const id = parseInt(btn.dataset.id);
          chrome.storage.sync.get(['papers'], (r) => {
            const papers = (r.papers || []).filter(p => p.id !== id);
            chrome.storage.sync.set({ papers }, () => { loadPapers(); updatePaperCount(); });
          });
        }
      });
    });
  });
}

function updatePaperCount() {
  chrome.storage.sync.get(['papers'], (result) => {
    document.getElementById('paper-count').textContent = (result.papers || []).length;
  });
}

document.getElementById('search-input').addEventListener('input', e => loadPapers(e.target.value));

// ========== DEADLINES ==========
function loadDeadlines() {
  chrome.storage.sync.get(['deadlines'], (result) => {
    const deadlines = result.deadlines || [];
    const container = document.getElementById('deadlines-list');

    if (deadlines.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <p>No deadlines tracked</p>
        </div>`;
      return;
    }

    deadlines.sort((a, b) => new Date(a.date) - new Date(b.date));
    container.innerHTML = deadlines.map(deadline => {
      const daysLeft = calculateDaysLeft(deadline.date);
      const isUrgent = daysLeft >= 0 && daysLeft <= 7;
      const isOverdue = daysLeft < 0;
      return `
        <div class="deadline-card ${isUrgent ? 'urgent' : ''}">
          <h3 class="deadline-title">${escapeHtml(deadline.title)}</h3>
          <div class="deadline-date ${isOverdue ? 'overdue' : ''}">
            ${formatDate(deadline.date)} — ${formatDaysLeft(daysLeft)}
          </div>
          <button class="btn-danger btn-sm delete-deadline-btn" data-id="${deadline.id}">Delete</button>
        </div>`;
    }).join('');

    document.querySelectorAll('.delete-deadline-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        chrome.storage.sync.get(['deadlines'], (r) => {
          const deadlines = (r.deadlines || []).filter(d => d.id !== id);
          chrome.storage.sync.set({ deadlines }, loadDeadlines);
        });
      });
    });
  });
}

document.getElementById('add-deadline-btn').addEventListener('click', () => {
  document.getElementById('deadline-form').classList.toggle('hidden');
});

document.getElementById('save-deadline').addEventListener('click', () => {
  const title = document.getElementById('deadline-title').value.trim();
  const date  = document.getElementById('deadline-date').value;
  if (!title || !date) { alert('Please fill in all fields'); return; }

  chrome.storage.sync.get(['deadlines'], (r) => {
    const deadlines = r.deadlines || [];
    deadlines.push({ id: Date.now(), title, date, createdAt: new Date().toISOString() });
    chrome.storage.sync.set({ deadlines }, () => {
      document.getElementById('deadline-form').classList.add('hidden');
      document.getElementById('deadline-title').value = '';
      document.getElementById('deadline-date').value = '';
      loadDeadlines();
    });
  });
});

document.getElementById('cancel-deadline').addEventListener('click', () => {
  document.getElementById('deadline-form').classList.add('hidden');
  document.getElementById('deadline-title').value = '';
  document.getElementById('deadline-date').value = '';
});

// ========== SETTINGS ==========
document.getElementById('export-btn').addEventListener('click', () => {
  chrome.storage.sync.get(['papers', 'deadlines', 'userProfile'], (result) => {
    const blob = new Blob([JSON.stringify({ ...result, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-tracker-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

document.getElementById('clear-all-btn').addEventListener('click', () => {
  if (confirm('This will delete all papers, deadlines, and your profile. Are you sure?')) {
    chrome.storage.sync.clear(() => {
      loadPapers(); loadDeadlines(); loadProfile(); updatePaperCount();
      alert('All data cleared');
    });
  }
});

document.getElementById('privacy-policy-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://madjdakhedimi.github.io/privacy-policy/' });
});

document.getElementById('contact-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.linkedin.com/in/madjda-khedimi-336154162/' });
});

// ========== PROFILE TAB ==========
function loadProfile() {
  chrome.storage.sync.get(['userProfile', 'manualInterests'], (result) => {
    const profile = result.userProfile || null;
    const manualInterests = result.manualInterests || [];

    renderManualInterests(manualInterests);

    if (profile && (profile.name || (profile.interests?.length > 0) || (profile.keywords?.length > 0))) {
      showProfileCard(profile);
    } else {
      document.getElementById('profile-card').classList.add('hidden');
      document.getElementById('profile-empty').classList.remove('hidden');
    }
  });
}

function showProfileCard(profile) {
  document.getElementById('profile-empty').classList.add('hidden');
  document.getElementById('profile-card').classList.remove('hidden');

  const name = profile.name || 'Unknown';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('profile-avatar').textContent = initials;
  document.getElementById('profile-name').textContent = name;
  document.getElementById('profile-affiliation').textContent = profile.affiliation || profile.headline || 'Researcher';

  const sources = [];
  if (profile.source === 'linkedin')       sources.push('<span class="source-badge source-linkedin">LinkedIn</span>');
  if (profile.source === 'google_scholar') sources.push('<span class="source-badge source-scholar">Google Scholar</span>');
  if (profile.source === 'researchgate')   sources.push('<span class="source-badge source-researchgate">ResearchGate</span>');
  document.getElementById('profile-sources').innerHTML = sources.join('');

  const interests = profile.interests || [];
  document.getElementById('profile-interests').innerHTML = interests.length > 0
    ? interests.slice(0, 12).map(i => `<span class="tag">${escapeHtml(i)}</span>`).join('')
    : '<span style="color:var(--text-tertiary);font-size:12px">None listed</span>';

  if (profile.metrics) {
    document.getElementById('profile-metrics-section').style.display = 'block';
    document.getElementById('profile-metrics').innerHTML = `
      <div class="metric-item">
        <span class="metric-value">${profile.metrics.totalCitations || profile.metrics.citations || '—'}</span>
        <span class="metric-label">Citations</span>
      </div>
      <div class="metric-item">
        <span class="metric-value">${profile.metrics.hIndex || '—'}</span>
        <span class="metric-label">h-index</span>
      </div>
      ${profile.metrics.i10Index ? `
      <div class="metric-item">
        <span class="metric-value">${profile.metrics.i10Index}</span>
        <span class="metric-label">i10-index</span>
      </div>` : ''}
    `;
  } else {
    document.getElementById('profile-metrics-section').style.display = 'none';
  }

  const keywords = profile.keywords || [];
  document.getElementById('profile-keywords').innerHTML = keywords.length > 0
    ? keywords.slice(0, 30).map(k => `<span class="tag small-tag">${escapeHtml(k)}</span>`).join('')
    : '<span style="color:var(--text-tertiary);font-size:12px">None extracted</span>';
}

function renderManualInterests(interests) {
  const container = document.getElementById('manual-interests-tags');
  container.innerHTML = interests.length > 0
    ? interests.map(i => `
        <span class="tag">
          ${escapeHtml(i)}
          <button class="tag-remove" data-interest="${escapeHtml(i)}">×</button>
        </span>`).join('')
    : '';

  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const interest = btn.dataset.interest;
      chrome.storage.sync.get(['manualInterests'], (r) => {
        const updated = (r.manualInterests || []).filter(i => i !== interest);
        chrome.storage.sync.set({ manualInterests: updated }, () => renderManualInterests(updated));
      });
    });
  });
}

document.getElementById('interest-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const value = e.target.value.trim().toLowerCase();
    if (!value) return;
    chrome.storage.sync.get(['manualInterests'], (r) => {
      const interests = r.manualInterests || [];
      if (!interests.includes(value)) {
        interests.push(value);
        chrome.storage.sync.set({ manualInterests: interests }, () => {
          renderManualInterests(interests);
          e.target.value = '';
        });
      } else {
        e.target.value = '';
      }
    });
  }
});

document.getElementById('clear-profile-btn').addEventListener('click', () => {
  if (confirm('Clear your imported profile data? Manual interests will be kept.')) {
    chrome.storage.sync.remove('userProfile', () => loadProfile());
  }
});

document.getElementById('open-linkedin-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.linkedin.com' });
});

document.getElementById('open-scholar-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://scholar.google.com/citations' });
});

document.getElementById('open-researchgate-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.researchgate.net' });
});

// ========== DISCOVER / RECOMMENDATIONS ==========
async function loadRecommendations() {
  const container = document.getElementById('recommendations-list');
  container.innerHTML = '<div class="loading-spinner"></div>';

  const profile = await new Promise(resolve => {
    chrome.storage.sync.get(['userProfile', 'papers', 'manualInterests'], resolve);
  });

  const userProfile = profile.userProfile || {};
  const savedPapers = profile.papers || [];
  const manualInterests = profile.manualInterests || [];

  const userKeywords = [
    ...(userProfile.keywords || []),
    ...(userProfile.interests || []),
    ...manualInterests,
    ...savedPapers.flatMap(p => extractKeywordsFromTitle(p.title))
  ];

  if (userKeywords.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Add interests in the Profile tab to get personalized recommendations</p>
      </div>`;
    return;
  }

  try {
    const venues = await fetchRelevantVenues(userKeywords);
    
    if (venues.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No recommendations found. Try adding more interests in your profile.</p>
        </div>`;
      return;
    }

    const scored = venues.map(v => ({
      ...v,
      score: computeMatchScore(v, userKeywords)
    })).sort((a, b) => b.score - a.score);

    await renderVenueRecommendations(scored, container);

  } catch (error) {
    console.error('Error loading recommendations:', error);
    container.innerHTML = `
      <div class="empty-state">
        <p>Error loading recommendations. Please try again later.</p>
      </div>`;
  }
}

async function fetchRelevantVenues(keywords) {
  const venues = [];
  const seen = new Set();

  const topKeywords = [...new Set(keywords)].slice(0, 5);
  const query = topKeywords.join(' OR ');

  try {
    const journalResponse = await fetch(
      `https://api.openalex.org/sources?search=${encodeURIComponent(query)}&filter=type:journal&per-page=20&mailto=researcher@example.com`
    );
    
    if (journalResponse.ok) {
      const data = await journalResponse.json();
      for (const source of data.results || []) {
        if (!seen.has(source.id)) {
          venues.push(parseOpenAlexSource(source, 'journal'));
          seen.add(source.id);
        }
      }
    }

    const confResponse = await fetch(
      `https://api.openalex.org/sources?search=${encodeURIComponent(query)}&filter=type:conference&per-page=10&mailto=researcher@example.com`
    );
    
    if (confResponse.ok) {
      const data = await confResponse.json();
      for (const source of data.results || []) {
        if (!seen.has(source.id)) {
          venues.push(parseOpenAlexSource(source, 'conference'));
          seen.add(source.id);
        }
      }
    }

  } catch (error) {
    console.error('Error fetching venues:', error);
  }

  return venues;
}

function parseOpenAlexSource(source, type) {
  return {
    name: source.display_name,
    type: type,
    openAlexId: source.id,
    url: source.homepage_url,
    publisher: source.host_organization_name,
    issn: source.issn_l || (source.issn?.[0] || null),
    isOA: source.is_oa || false,
    apcUsd: source.apc_usd,
    citedByCount: source.cited_by_count || 0,
    worksCount: source.works_count || 0,
    hIndex: source.summary_stats?.h_index || null,
    twoYearCitedness: source.summary_stats?.['2yr_mean_citedness'] || null,
    concepts: (source.x_concepts || []).slice(0, 6).map(c => c.display_name),
    lastUpdated: source.updated_date
  };
}

// ========== IMPROVED MATCHING ALGORITHM ==========
function computeMatchScore(venue, userKeywords) {
  if (!userKeywords || userKeywords.length === 0) return 0;
  
  const venueName = venue.name.toLowerCase();
  const venueConcepts = (venue.concepts || []).map(c => c.toLowerCase());
  const venuePublisher = (venue.publisher || '').toLowerCase();
  const venueText = [venueName, ...venueConcepts, venuePublisher].join(' ');
  
  let totalScore = 0;
  let maxPossibleScore = 0;
  let matchedKeywords = 0;
  
  // Deduplicate and normalize user keywords
  const normalizedKeywords = [...new Set(userKeywords.map(k => k.toLowerCase().trim()))].filter(k => k.length >= 2);
  
  for (const keyword of normalizedKeywords) {
    let keywordScore = 0;
    const keywordWeight = keyword.length > 6 ? 1.3 : 1.0; // Longer keywords are more specific
    
    // Exact match in venue name (highest weight)
    if (venueName.includes(keyword)) {
      if (venueName === keyword) {
        keywordScore = 10; // Perfect match
        matchedKeywords++;
      } else if (venueName.split(/\W+/).includes(keyword)) {
        keywordScore = 8; // Exact word match
        matchedKeywords++;
      } else {
        keywordScore = 5; // Partial match
        matchedKeywords++;
      }
    }
    // Match in concepts/topics
    else if (venueConcepts.some(c => c.includes(keyword))) {
      const exactConceptMatch = venueConcepts.some(c => c === keyword || c.split(/\W+/).includes(keyword));
      keywordScore = exactConceptMatch ? 7 : 4;
      matchedKeywords++;
    }
    // Match anywhere in venue text
    else if (venueText.includes(keyword)) {
      keywordScore = 2;
      matchedKeywords++;
    }
    
    totalScore += keywordScore * keywordWeight;
    maxPossibleScore += 10 * keywordWeight;
  }
  
  if (maxPossibleScore === 0) return 0;
  
  // Base score (0-1)
  let normalizedScore = totalScore / maxPossibleScore;
  
  // Boost for match breadth (percentage of keywords matched)
  const matchBreadth = matchedKeywords / normalizedKeywords.length;
  normalizedScore *= (0.65 + 0.35 * matchBreadth); // Up to 35% boost for matching many keywords
  
  // Quality boost based on venue metrics
  let qualityMultiplier = 1.0;
  
  if (venue.hIndex) {
    if (venue.hIndex >= 150) qualityMultiplier = 1.20;      // Top tier
    else if (venue.hIndex >= 100) qualityMultiplier = 1.15; // High tier
    else if (venue.hIndex >= 50) qualityMultiplier = 1.08;  // Good tier
    else if (venue.hIndex >= 25) qualityMultiplier = 1.03;  // Decent tier
  }
  
  // Boost for highly cited venues
  if (venue.citedByCount > 500000) qualityMultiplier *= 1.08;
  else if (venue.citedByCount > 100000) qualityMultiplier *= 1.04;
  
  // Small boost for Open Access
  if (venue.isOA) qualityMultiplier *= 1.02;
  
  // Apply quality multiplier
  normalizedScore *= qualityMultiplier;
  
  // Cap at 1.0
  return Math.min(normalizedScore, 1.0);
}

function extractKeywordsFromTitle(title) {
  const stopWords = ['the', 'and', 'for', 'with', 'from', 'using', 'based', 'a', 'an', 'in', 'on', 'of', 'to', 'via'];
  return title.toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3 && !stopWords.includes(w))
    .slice(0, 5);
}

async function renderVenueRecommendations(venues, container) {
  const cards = [];
  
  for (const venue of venues) {
    const metrics = await fetchJournalMetrics(venue.name, venue.openAlexId);
    cards.push(renderVenueCardWithMetrics(venue, metrics, venue.score));
  }

  container.innerHTML = cards.join('');

  container.querySelectorAll('.open-url-btn').forEach(btn => {
    btn.addEventListener('click', () => chrome.tabs.create({ url: btn.dataset.url }));
  });
}

function renderVenueCardWithMetrics(venue, metrics, matchScore) {
  const isConference = venue.type === 'conference';
  const typeBadge = isConference
    ? '<span class="badge badge-conference">Conference</span>'
    : '<span class="badge badge-journal">Journal</span>';

  const impactFactor = metrics?.impactFactor || venue.twoYearCitedness;
  const hIndex = metrics?.hIndex || venue.hIndex;
  const quartile = metrics?.quartile;
  const isOA = metrics?.isOA !== undefined ? metrics.isOA : venue.isOA;
  const publisher = metrics?.publisher || venue.publisher;
  const issn = metrics?.issn || venue.issn;
  const apcUsd = metrics?.apcUsd !== undefined ? metrics.apcUsd : venue.apcUsd;

  const quartileBadge = quartile
    ? `<span class="badge badge-quartile-${quartile.toLowerCase()}">${quartile}</span>`
    : '';

  const oaBadge = isOA
    ? '<span class="badge badge-success" title="Open Access">Open Access</span>'
    : '';

  const apcInfo = apcUsd != null
    ? `<div class="detail-row"><span class="icon">💰</span><span style="font-size:12px">APC: $${apcUsd.toLocaleString()}</span></div>`
    : '';

  const publisherRow = (publisher || issn)
    ? `<div class="publisher-info">
        ${publisher ? `<span class="publisher-name">${escapeHtml(publisher)}</span>` : ''}
        ${issn ? `<span class="issn">ISSN ${escapeHtml(issn)}</span>` : ''}
       </div>`
    : '';

  let metricsGrid = '';
  if (!isConference && (impactFactor || hIndex)) {
    metricsGrid = `
      <div class="journal-metrics-grid" style="grid-template-columns: repeat(3,1fr);gap:8px;margin:12px 0;">
        <div class="metric-item">
          <span class="metric-value">${impactFactor ? impactFactor.toFixed(2) : '—'}</span>
          <span class="metric-label">2yr Citedness</span>
        </div>
        <div class="metric-item">
          <span class="metric-value">${hIndex || '—'}</span>
          <span class="metric-label">h-index</span>
        </div>
        <div class="metric-item">
          <span class="metric-value">${venue.citedByCount >= 1000 ? (venue.citedByCount / 1000).toFixed(0) + 'K' : venue.citedByCount || '—'}</span>
          <span class="metric-label">Citations</span>
        </div>
      </div>`;
  } else {
    const citeStr = venue.citedByCount >= 1_000_000
      ? (venue.citedByCount / 1_000_000).toFixed(1) + 'M'
      : venue.citedByCount >= 1000
        ? (venue.citedByCount / 1000).toFixed(0) + 'K'
        : venue.citedByCount || '—';
    
    const worksStr = venue.worksCount >= 1000
      ? (venue.worksCount / 1000).toFixed(0) + 'K'
      : venue.worksCount || '—';

    metricsGrid = `
      <div class="journal-metrics-grid" style="grid-template-columns: repeat(2,1fr);gap:8px;margin:10px 0;">
        <div class="metric-item">
          <span class="metric-value">${citeStr}</span>
          <span class="metric-label">Total Citations</span>
        </div>
        <div class="metric-item">
          <span class="metric-value">${worksStr}</span>
          <span class="metric-label">Works Published</span>
        </div>
      </div>`;
  }

  let indexingInfo = '';
  if (metrics?.indexed && metrics.indexed.length > 0) {
    const indexBadges = metrics.indexed.map(idx => 
      `<span class="index-badge">${escapeHtml(idx)}</span>`
    ).join('');
    indexingInfo = `
      <div class="indexing-info">
        <strong>Indexed in:</strong>
        <div class="indexing-badges" style="margin-top:6px">${indexBadges}</div>
      </div>`;
  }

  const conceptTags = (venue.concepts || []).slice(0, 4)
    .map(c => `<span class="index-badge">${escapeHtml(c)}</span>`).join('');

  const lastUpdated = metrics?.lastUpdated || venue.lastUpdated;
  const updateInfo = lastUpdated 
    ? `<div style="font-size:10px;color:var(--text-tertiary);margin-top:8px;">Metrics updated: ${formatDate(lastUpdated)}</div>`
    : '';

  const url = venue.url || `https://openalex.org/${venue.openAlexId}`;

  return `
    <div class="recommendation-card">
      <div class="card-meta">
        ${typeBadge}
        ${quartileBadge}
        ${oaBadge}
      </div>
      <h3 class="card-title">${escapeHtml(venue.name)}</h3>
      ${publisherRow}
      ${metricsGrid}
      ${indexingInfo}
      ${conceptTags ? `<div class="indexing-info"><strong>Topics:</strong><div class="indexing-badges" style="margin-top:4px">${conceptTags}</div></div>` : ''}
      ${apcInfo}
      ${matchBar(matchScore)}
      ${updateInfo}

      <div class="paper-actions" style="margin-top:10px;">
        ${url ? `<button class="btn-secondary btn-sm open-url-btn" data-url="${escapeHtml(url)}">Visit →</button>` : ''}
        <a href="https://openalex.org/${encodeURIComponent(venue.openAlexId || '')}" 
           target="_blank"
           style="font-size:11px;color:var(--text-tertiary);align-self:center;">
          via OpenAlex
        </a>
      </div>
    </div>`;
}

function matchBar(score) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#2563eb' : '#9ca3af';
  return `
    <div class="match-info">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:11px;color:var(--text-secondary);min-width:60px">Relevance</span>
        <div style="flex:1;height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width 0.4s"></div>
        </div>
        <span style="font-size:11px;font-weight:600;color:${color};min-width:30px;text-align:right">${pct}%</span>
      </div>
    </div>`;
}

// Filter tabs
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    const filter = tab.dataset.filter;
    const cards = document.querySelectorAll('.recommendation-card');
    
    cards.forEach(card => {
      const isConference = card.querySelector('.badge-conference');
      const isJournal = card.querySelector('.badge-journal');
      
      if (filter === 'all') {
        card.style.display = 'block';
      } else if (filter === 'conferences' && isConference) {
        card.style.display = 'block';
      } else if (filter === 'journals' && isJournal) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

// ========== UTILITIES ==========
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function calculateDaysLeft(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr); target.setHours(0,0,0,0);
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((target - now) / 86400000);
}

function formatDaysLeft(daysLeft) {
  if (daysLeft === null) return '';
  if (daysLeft < 0)  return `Overdue by ${Math.abs(daysLeft)}d`;
  if (daysLeft === 0) return 'Due today!';
  if (daysLeft === 1) return '1 day left';
  return `${daysLeft} days left`;
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(text);
  return d.innerHTML;
}
