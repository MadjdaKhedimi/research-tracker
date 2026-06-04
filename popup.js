// Research Tracker v2.3.1
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${targetTab}-tab`).classList.add('active');
    if (targetTab === 'library')   loadPapers();
    if (targetTab === 'deadlines') loadDeadlines();
    if (targetTab === 'discover')  { discoverCache = null; discoverCacheKeywords = null; loadRecommendations(); }
    if (targetTab === 'profile')   loadProfile();
  });
});

document.addEventListener('DOMContentLoaded', () => {
  loadPapers();
  updatePaperCount();
  loadProfile();
});

// ========== METRICS CACHE ==========
const metricsCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000;

async function fetchJournalMetrics(venueName, venueId = null) {
  const cacheKey = venueId || venueName;
  const cached = metricsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) return cached.data;
  try {
    let openAlexData = null;
    if (venueId) {
      const r = await fetch(`https://api.openalex.org/sources/${venueId}?mailto=researcher@example.com`);
      if (r.ok) openAlexData = await r.json();
    } else {
      const r = await fetch(`https://api.openalex.org/sources?search=${encodeURIComponent(venueName)}&mailto=researcher@example.com`);
      if (r.ok) { const d = await r.json(); openAlexData = d.results?.[0] || null; }
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
    if (metrics.hIndex) {
      if (metrics.hIndex >= 100) metrics.quartile = 'Q1';
      else if (metrics.hIndex >= 50) metrics.quartile = 'Q2';
      else if (metrics.hIndex >= 25) metrics.quartile = 'Q3';
      else metrics.quartile = 'Q4';
    }
    if (openAlexData.is_in_doaj) metrics.indexed.push('DOAJ');
    if (openAlexData.works_count > 1000) metrics.indexed.push('Scopus');
    if (metrics.hIndex > 20) metrics.indexed.push('Web of Science');
    metricsCache.set(cacheKey, { data: metrics, timestamp: Date.now() });
    return metrics;
  } catch { return null; }
}

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
          <p>${searchQuery ? 'No papers match your search' : 'No papers saved yet'}</p>
          <span class="hint">Visit arXiv, PubMed, IEEE, or any supported publisher</span>
        </div>`;
      return;
    }
    container.innerHTML = papers.map(p => renderPaperCard(p)).join('');
    attachPaperCardListeners(container, papers);
  });
}

function renderPaperCard(paper) {
  const statusOptions = ['To Read', 'Reading', 'Done'];
  const currentStatus = paper.status || 'To Read';
  const statusClass = { 'To Read': 'status-toread', 'Reading': 'status-reading', 'Done': 'status-done' }[currentStatus];
  const stars = [1,2,3,4,5].map(i =>
    `<span class="star ${(paper.rating||0) >= i ? 'star-filled' : ''}" data-star="${i}" data-id="${paper.id}">★</span>`
  ).join('');
  const notePreview = paper.notes
    ? `<p class="paper-notes">${escapeHtml(paper.notes.substring(0, 100))}${paper.notes.length > 100 ? '…' : ''}</p>`
    : '';
  return `
    <div class="paper-card" data-id="${paper.id}">
      <div class="paper-card-header">
        <span class="paper-source-badge">${escapeHtml(paper.source || 'Unknown')}</span>
        <div class="paper-meta-right">
          <select class="status-select ${statusClass}" data-id="${paper.id}">
            ${statusOptions.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <h3 class="paper-title">
        <a href="${escapeHtml(paper.url)}" target="_blank">${escapeHtml(paper.title)}</a>
      </h3>
      ${paper.authors ? `<p class="paper-authors">${escapeHtml(paper.authors.substring(0,120))}${paper.authors.length>120?'…':''}</p>` : ''}
      ${notePreview}
      <div class="paper-footer">
        <div class="star-rating">${stars}</div>
        <div class="paper-actions">
          <button class="btn-cite btn-sm" data-id="${paper.id}" title="Copy citation">📋 Cite</button>
          <button class="btn-delete btn-sm" data-id="${paper.id}" title="Delete">🗑</button>
        </div>
      </div>
      <div class="cite-panel hidden" id="cite-${paper.id}">
        <div class="cite-tabs">
          <button class="cite-tab-btn active" data-format="apa" data-id="${paper.id}">APA</button>
          <button class="cite-tab-btn" data-format="mla" data-id="${paper.id}">MLA</button>
          <button class="cite-tab-btn" data-format="bibtex" data-id="${paper.id}">BibTeX</button>
        </div>
        <div class="cite-text" id="cite-text-${paper.id}">${generateCitation(paper, 'apa')}</div>
        <button class="btn-copy-cite btn-sm" data-id="${paper.id}">Copy</button>
      </div>
    </div>`;
}

function attachPaperCardListeners(container, papers) {
  container.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      const id = parseInt(star.dataset.id);
      const rating = parseInt(star.dataset.star);
      // Update visuals instantly
      container.querySelectorAll(`.star[data-id="${id}"]`).forEach(s => {
        s.classList.toggle('star-filled', parseInt(s.dataset.star) <= rating);
      });
      updatePaperField(id, 'rating', rating);
    });
    star.addEventListener('mouseenter', () => {
      const id = star.dataset.id;
      const hoverRating = parseInt(star.dataset.star);
      container.querySelectorAll(`.star[data-id="${id}"]`).forEach(s => {
        s.style.color = parseInt(s.dataset.star) <= hoverRating ? '#f59e0b' : '';
      });
    });
    star.addEventListener('mouseleave', () => {
      const id = star.dataset.id;
      container.querySelectorAll(`.star[data-id="${id}"]`).forEach(s => {
        s.style.color = '';
      });
    });
  });
  container.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', () => {
      updatePaperField(parseInt(sel.dataset.id), 'status', sel.value);
      sel.className = `status-select ${{ 'To Read': 'status-toread', 'Reading': 'status-reading', 'Done': 'status-done' }[sel.value]}`;
    });
  });
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deletePaper(parseInt(btn.dataset.id)));
  });
  container.querySelectorAll('.btn-cite').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = document.getElementById(`cite-${btn.dataset.id}`);
      panel.classList.toggle('hidden');
    });
  });
  container.querySelectorAll('.cite-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const format = btn.dataset.format;
      btn.closest('.cite-tabs').querySelectorAll('.cite-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const paper = papers.find(p => p.id === id);
      document.getElementById(`cite-text-${id}`).textContent = generateCitation(paper, format);
    });
  });
  container.querySelectorAll('.btn-copy-cite').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = document.getElementById(`cite-text-${btn.dataset.id}`).textContent;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✅ Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
      });
    });
  });
}

function generateCitation(paper, format) {
  const title = paper.title || 'Untitled';
  const authors = paper.authors || '[Authors unknown]';
  const year = paper.savedAt ? new Date(paper.savedAt).getFullYear() : new Date().getFullYear();
  const source = paper.source || 'Unknown Source';
  const url = paper.url || '';
  const doi = paper.doi || null;
  const accessed = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  function parseAuthors(authorStr) {
    if (!authorStr || authorStr === '[Authors unknown]') return [];
    // Try semicolon split first (IEEE style), then comma split
    const sep = authorStr.includes(';') ? ';' : ',';
    return authorStr.split(sep).map(a => a.trim()).filter(Boolean);
  }

  if (format === 'apa') {
    const authorList = parseAuthors(authors);
    let authorAPA = '[Authors unknown]';
    if (authorList.length > 0) {
      const formatted = authorList.slice(0, 3).map(name => {
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0];
        const last = parts[parts.length - 1];
        const initials = parts.slice(0, -1).map(n => n[0].toUpperCase() + '.').join(' ');
        return `${last}, ${initials}`;
      });
      authorAPA = formatted.join(', ') + (authorList.length > 3 ? ', et al.' : '');
    }
    return `${authorAPA} (${year}). ${title}. ${source}. ${doi ? 'https://doi.org/' + doi : url}`;
  }
  if (format === 'mla') {
    const authorList = parseAuthors(authors);
    let firstAuthor = '[Authors unknown]';
    if (authorList.length > 0) {
      const parts = authorList[0].trim().split(/\s+/);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const rest = parts.slice(0, -1).join(' ');
        firstAuthor = `${last}, ${rest}`;
      } else {
        firstAuthor = authorList[0];
      }
    }
    const otherAuthors = authorList.length > 1 ? ', et al.' : '';
    return `${firstAuthor}${otherAuthors}. "${title}." ${source}, ${year}. ${doi ? 'https://doi.org/' + doi : url}. Accessed ${accessed}.`;
  }
  if (format === 'bibtex') {
    const key = (authors.split(',')[0].split(' ').pop() || 'Unknown').toLowerCase() + year;
    const authorsClean = authors !== '[Authors unknown]' ? authors : 'Unknown';
    return `@article{${key},\n  author  = {${authorsClean}},\n  title   = {${title}},\n  journal = {${source}},\n  year    = {${year}},\n  url     = {${doi ? 'https://doi.org/' + doi : url}}\n}`;
  }
  return '';
}

function updatePaperField(id, field, value) {
  chrome.storage.sync.get(['papers'], (result) => {
    const papers = result.papers || [];
    const idx = papers.findIndex(p => p.id === id);
    if (idx === -1) return;
    papers[idx][field] = value;
    chrome.storage.sync.set({ papers });
  });
}

function deletePaper(id) {
  chrome.storage.sync.get(['papers'], (result) => {
    const papers = (result.papers || []).filter(p => p.id !== id);
    chrome.storage.sync.set({ papers }, () => { loadPapers(); updatePaperCount(); });
  });
}

function updatePaperCount() {
  chrome.storage.sync.get(['papers'], (result) => {
    document.getElementById('paper-count').textContent = (result.papers || []).length;
  });
}

document.getElementById('search-input').addEventListener('input', (e) => {
  loadPapers(e.target.value.trim());
});

function loadDeadlines() {
  chrome.storage.sync.get(['deadlines'], (result) => {
    const deadlines = (result.deadlines || []).sort((a, b) => new Date(a.date) - new Date(b.date));
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
    container.innerHTML = deadlines.map(d => renderDeadlineCard(d)).join('');
    container.querySelectorAll('.deadline-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        chrome.storage.sync.get(['deadlines'], (r) => {
          const updated = (r.deadlines || []).filter(d => d.id != btn.dataset.id);
          chrome.storage.sync.set({ deadlines: updated }, loadDeadlines);
        });
      });
    });
  });
}

function renderDeadlineCard(d) {
  const daysLeft = calculateDaysLeft(d.date);
  const urgencyClass = daysLeft === null ? '' : daysLeft < 0 ? 'deadline-overdue' : daysLeft <= 7 ? 'deadline-urgent' : daysLeft <= 30 ? 'deadline-soon' : 'deadline-ok';
  const typeLabels = { conference: '🎤 Conference', journal: '📰 Journal', workshop: '🔬 Workshop', other: '📌 Other' };
  const typeBadge = d.type ? `<span class="deadline-type-badge">${typeLabels[d.type] || d.type}</span>` : '';
  const linkHtml = d.url ? `<a class="deadline-link" href="${escapeHtml(d.url)}" target="_blank">🔗 CFP</a>` : '';
  const disclaimerHtml = `<p class="deadline-disclaimer">⚠ Please recheck this deadline - dates may have changed since it was saved.</p>`;
  return `
    <div class="deadline-card ${urgencyClass}">
      <div class="deadline-header">
        <div class="deadline-title-row">
          ${typeBadge}
          <span class="deadline-title">${escapeHtml(d.title)}</span>
        </div>
        <button class="deadline-delete-btn" data-id="${d.id}" title="Delete">×</button>
      </div>
      <div class="deadline-footer">
        <span class="deadline-date">📅 ${formatDate(d.date)}</span>
        <span class="deadline-days ${urgencyClass}">${formatDaysLeft(daysLeft)}</span>
        ${linkHtml}
      </div>
      ${d.notes ? `<p class="deadline-notes">${escapeHtml(d.notes)}</p>` : ''}
      ${disclaimerHtml}
    </div>`;
}

// Search conferences/journals for deadline suggestions
let _deadlineSearchTimer = null;
function debounce(fn, ms) {
  return (...args) => {
    clearTimeout(_deadlineSearchTimer);
    _deadlineSearchTimer = setTimeout(() => fn(...args), ms);
  };
}

async function searchDeadlineSuggestions(query) {
  const container = document.getElementById('deadline-suggestions');
  if (!query || query.length < 2) { container.innerHTML = ''; return; }
  container.innerHTML = '<div class="suggestions-loading">Searching conferences and journals...</div>';

  try {
    // Fire DBLP + OpenAlex in parallel for name/metadata
    const [dblpRes, openAlexRes] = await Promise.all([
      fetch(`https://dblp.org/search/venue/api?q=${encodeURIComponent(query)}&h=8&format=json`).catch(() => null),
      fetch(`https://api.openalex.org/sources?search=${encodeURIComponent(query)}&filter=type:conference,type:journal&per-page=6&sort=cited_by_count:desc&mailto=researcher@example.com`).catch(() => null)
    ]);

    const suggestions = [];
    const seen = new Set();

    // Parse DBLP results
    if (dblpRes?.ok) {
      const data = await dblpRes.json();
      const hits = data?.result?.hits?.hit || [];
      for (const h of hits.slice(0, 6)) {
        const name = h.info?.venue;
        const acronym = h.info?.acronym || '';
        const key = (name || acronym).toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          suggestions.push({
            name: name || acronym,
            acronym,
            url: h.info?.url || null,
            source: 'DBLP',
            type: 'conference',
            deadline: null,
            deadlineSource: null
          });
        }
      }
    }

    // Parse OpenAlex results
    if (openAlexRes?.ok) {
      const data = await openAlexRes.json();
      for (const s of (data.results || [])) {
        const key = s.display_name?.toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          suggestions.push({
            name: s.display_name,
            acronym: '',
            url: s.homepage_url || null,
            source: 'OpenAlex',
            type: s.type === 'journal' ? 'journal' : 'conference',
            hIndex: s.summary_stats?.h_index || null,
            deadline: null,
            deadlineSource: null
          });
        }
      }
    }

    if (suggestions.length === 0) {
      container.innerHTML = '<div class="suggestions-empty">No results found. Try a shorter name or acronym.</div>';
      return;
    }

    // Render suggestions immediately so user sees results fast
    renderSuggestions(suggestions, container);

    const confSuggestions = suggestions.filter(s => s.type === 'conference');
    if (confSuggestions.length > 0) {
      container.querySelector('.suggestions-footer')?.remove();
      const footer = document.createElement('div');
      footer.className = 'suggestions-footer';
      footer.textContent = 'Fetching submission deadlines from WikiCFP...';
      container.appendChild(footer);

      try {
        const wikicfpRes = await fetch(
          `https://wikicfp.com/cfp/servlet/tool.search?q=${encodeURIComponent(query)}&year=f`,
          { headers: { 'Accept': 'text/html' } }
        ).catch(() => null);

        if (wikicfpRes?.ok) {
          const html = await wikicfpRes.text();
          const deadlineMap = parseWikiCFPDeadlines(html);

          // Match deadlines back to suggestions
          suggestions.forEach(s => {
            if (s.type !== 'conference') return;
            const searchKey = (s.acronym || s.name).toLowerCase();
            for (const [cfpName, info] of Object.entries(deadlineMap)) {
              if (cfpName.toLowerCase().includes(searchKey) ||
                  searchKey.includes(cfpName.toLowerCase()) ||
                  cfpName.toLowerCase().includes(s.name.toLowerCase().split(' ')[0])) {
                s.deadline = info.deadline;
                s.deadlineSource = 'WikiCFP';
                s.cfpUrl = info.url;
                if (!s.url && info.url) s.url = info.url;
                break;
              }
            }
          });

          renderSuggestions(suggestions, container);
        }
      } catch(e) {
      }

      const footerEl = container.querySelector('.suggestions-footer');
      if (footerEl) footerEl.remove();
    }

  } catch (e) {
    container.innerHTML = '<div class="suggestions-empty">Search failed. Check your connection.</div>';
  }
}

function parseWikiCFPDeadlines(html) {
  const results = {};
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const currentYear = now.getFullYear();

  try {
    // WikiCFP search page structure:
    // We strip HTML tags from each cell to get clean text

    // Split into rows
    const rowMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];

    for (const row of rowMatches) {
      // Must contain a showcfp link to be a conference row
      const linkMatch = row.match(/href="(\/cfp\/servlet\/event\.showcfp[^"]*)"[^>]*>\s*([^<]{2,100})\s*<\/a>/i);
      if (!linkMatch) continue;

      // Strip all HTML tags to get plain text cells
      const plainText = row.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      // Find ALL dates in this row
      const datePattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+(\d{4})/gi;
      const allDates = [];
      let m;
      while ((m = datePattern.exec(plainText)) !== null) {
        allDates.push(m[0]);
      }

      if (allDates.length === 0) continue;

      // The LAST date in the row is the submission deadline column
      // (WikiCFP order: When date, Deadline date)
      const deadlineStr = allDates[allDates.length - 1];
      const deadlineDate = new Date(deadlineStr);
      if (isNaN(deadlineDate)) continue;
      deadlineDate.setHours(0, 0, 0, 0);

      // STRICT: only include if:
      // 1. Deadline is today or in the future
      if (deadlineDate < now) continue;
      if (deadlineDate.getFullYear() < currentYear) continue;

      const cfpName = linkMatch[2].trim();
      const cfpPath = linkMatch[1];

      const nameYearMatch = cfpName.match(/(20\d{2})/);
      if (nameYearMatch && parseInt(nameYearMatch[1]) < currentYear - 1) continue;

      results[cfpName] = {
        deadline: deadlineDate.toISOString().split('T')[0],
        url: 'https://wikicfp.com' + cfpPath
      };
    }
  } catch(e) {}

  return results;
}

function renderSuggestions(suggestions, container) {
  const now = new Date(); now.setHours(0,0,0,0);

  suggestions = suggestions
    .filter(s => !s.deadline || new Date(s.deadline) >= now)
    .sort((a, b) => {
      if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

  if (suggestions.length === 0) {
    container.innerHTML = '<div class="suggestions-empty">No open calls found. Try a different name.</div>';
    return;
  }

  container.innerHTML = suggestions.map(s => {
    const daysLeft = s.deadline ? Math.round((new Date(s.deadline) - now) / 86400000) : null;
    const urgency = daysLeft !== null
      ? daysLeft <= 7  ? 'deadline-urgent'
      : daysLeft <= 30 ? 'deadline-soon'
      : 'deadline-ok'
      : '';
    const deadlineHtml = s.deadline
      ? `<span class="suggestion-deadline ${urgency}">
           📅 Submission: ${formatDate(s.deadline)} · ${daysLeft === 0 ? 'due today' : daysLeft === 1 ? '1 day left' : daysLeft + ' days left'}
           <span class="deadline-warning" title="Always verify on the official website">⚠ verify</span>
         </span>`
      : `<span class="suggestion-no-deadline">No deadline found - check official site</span>`;

    return `
      <div class="suggestion-item"
           data-name="${escapeHtml(s.name)}"
           data-url="${escapeHtml(s.cfpUrl || s.url || '')}"
           data-type="${s.type}"
           data-deadline="${escapeHtml(s.deadline || '')}">
        <div class="suggestion-main">
          <span class="suggestion-name">${escapeHtml(s.name)}${s.acronym && s.acronym !== s.name ? ` <span class="suggestion-acronym">(${escapeHtml(s.acronym)})</span>` : ''}</span>
          <span class="suggestion-type-badge ${s.type === 'journal' ? 'badge-journal' : 'badge-conference'}">${s.type}</span>
        </div>
        <div class="suggestion-details">
          ${s.type === 'conference' ? deadlineHtml : '<span class="suggestion-no-deadline">Check journal website for submission windows</span>'}
          ${s.hIndex ? `<span class="suggestion-hindex">h-index: ${s.hIndex}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  // Add global disclaimer at bottom
  const disclaimer = document.createElement('div');
  disclaimer.className = 'suggestions-disclaimer';
  disclaimer.innerHTML = '⚠ Deadlines are fetched automatically and may have changed. Always verify on the official conference/journal website before submitting.';
  container.appendChild(disclaimer);

  container.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('deadline-title').value = item.dataset.name;
      document.getElementById('deadline-url').value = item.dataset.url;
      document.getElementById('deadline-type').value = item.dataset.type;
      if (item.dataset.deadline) {
        document.getElementById('deadline-date').value = item.dataset.deadline;
        // Pre-fill notes with disclaimer
        const notesEl = document.getElementById('deadline-notes');
        if (!notesEl.value) {
          notesEl.value = 'Deadline auto-detected - please verify on the official website before submitting.';
        }
      }
      container.innerHTML = '';
    });
  });
}

document.getElementById('add-deadline-btn').addEventListener('click', () => {
  document.getElementById('deadline-form').classList.toggle('hidden');
});

const debouncedDeadlineSearch = debounce((q) => searchDeadlineSuggestions(q), 400);
document.getElementById('deadline-title').addEventListener('input', (e) => {
  debouncedDeadlineSearch(e.target.value.trim());
});

document.getElementById('save-deadline').addEventListener('click', () => {
  const title = document.getElementById('deadline-title').value.trim();
  const date  = document.getElementById('deadline-date').value;
  const type  = document.getElementById('deadline-type').value;
  const url   = document.getElementById('deadline-url').value.trim();
  const notes = document.getElementById('deadline-notes').value.trim();
  if (!title || !date) { alert('Please fill in title and date'); return; }
  chrome.storage.sync.get(['deadlines'], (r) => {
    const deadlines = r.deadlines || [];
    deadlines.push({ id: Date.now(), title, date, type, url, notes, createdAt: new Date().toISOString() });
    chrome.storage.sync.set({ deadlines }, () => {
      document.getElementById('deadline-form').classList.add('hidden');
      document.getElementById('deadline-title').value = '';
      document.getElementById('deadline-date').value = '';
      document.getElementById('deadline-type').value = 'conference';
      document.getElementById('deadline-url').value = '';
      document.getElementById('deadline-notes').value = '';
      document.getElementById('deadline-suggestions').innerHTML = '';
      loadDeadlines();
    });
  });
});

document.getElementById('cancel-deadline').addEventListener('click', () => {
  document.getElementById('deadline-form').classList.add('hidden');
  document.getElementById('deadline-title').value = '';
  document.getElementById('deadline-date').value = '';
  document.getElementById('deadline-type').value = 'conference';
  document.getElementById('deadline-url').value = '';
  document.getElementById('deadline-notes').value = '';
  document.getElementById('deadline-suggestions').innerHTML = '';
});

document.getElementById('export-btn').addEventListener('click', () => {
  chrome.storage.sync.get(['papers', 'deadlines', 'userProfile'], (result) => {
    const blob = new Blob([JSON.stringify({ ...result, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `research-tracker-${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
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
    const importSection = document.getElementById('profile-import-section');
    if (importSection) importSection.style.display = 'block';
    if (profile) {
      const sources = profile.allSources || (profile.source ? [profile.source] : []);
      const btnMap = { linkedin: 'open-linkedin-btn', google_scholar: 'open-scholar-btn', researchgate: 'open-researchgate-btn' };
      const labelMap = { linkedin: 'LinkedIn', google_scholar: 'Google Scholar', researchgate: 'ResearchGate' };
      Object.entries(btnMap).forEach(([src, btnId]) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const svg = btn.querySelector('svg')?.outerHTML || '';
        if (sources.includes(src)) {
          btn.innerHTML = svg + ' ' + labelMap[src] + ' (imported)';
          btn.style.opacity = '0.75';
        } else {
          btn.innerHTML = svg + ' ' + labelMap[src];
          btn.style.opacity = '1';
        }
      });
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

  // Show ALL imported sources
  const sourcesEl = document.getElementById('profile-sources');
  const sourceMap = Array.isArray(profile.allSources) ? profile.allSources : [profile.source].filter(Boolean);
  const sourceLabels = { linkedin: 'LinkedIn', google_scholar: 'Google Scholar', researchgate: 'ResearchGate' };
  sourcesEl.innerHTML = sourceMap.map(s =>
    `<span class="source-badge source-${s.replace('_','-')}">
      ${sourceLabels[s] || s}
      <button class="source-remove-btn" data-source="${s}" title="Remove this source">×</button>
    </span>`
  ).join('');
  sourcesEl.querySelectorAll('.source-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeProfileSource(btn.dataset.source));
  });

  const interests = profile.interests || [];
  const intContainer = document.getElementById('profile-interests');
  if (interests.length > 0) {
    intContainer.innerHTML = interests.slice(0, 12).map(i =>
      `<span class="tag tag-removable">
        ${escapeHtml(i)}
        <button class="tag-remove-kw" data-kw="${escapeHtml(i)}" data-field="interests" title="Remove">×</button>
      </span>`
    ).join('');
    intContainer.querySelectorAll('.tag-remove-kw').forEach(btn => {
      btn.addEventListener('click', () => {
        chrome.storage.sync.get(['userProfile'], (r) => {
          const p = r.userProfile || {};
          p.interests = (p.interests || []).filter(k => k !== btn.dataset.kw);
          chrome.storage.sync.set({ userProfile: p }, () => showProfileCard(p));
        });
      });
    });
  } else {
    intContainer.innerHTML = '<span style="color:var(--text-tertiary);font-size:12px">None listed</span>';
  }

  if (profile.metrics) {
    document.getElementById('profile-metrics-section').style.display = 'block';
    document.getElementById('profile-metrics').innerHTML = `
      <div class="metric-item"><span class="metric-value">${profile.metrics.totalCitations || profile.metrics.citations || "--"}</span><span class="metric-label">Citations</span></div>
      <div class="metric-item"><span class="metric-value">${profile.metrics.hIndex || "--"}</span><span class="metric-label">h-index</span></div>
      ${profile.metrics.i10Index ? `<div class="metric-item"><span class="metric-value">${profile.metrics.i10Index}</span><span class="metric-label">i10-index</span></div>` : ''}`;
  } else {
    document.getElementById('profile-metrics-section').style.display = 'none';
  }

  const MEANINGFUL = new Set([
    'machine learning','deep learning','artificial intelligence','neural network',
    'computer vision','natural language processing','nlp','reinforcement learning',
    'transformer','generative ai','large language model','federated learning',
    'transfer learning','data science','data mining','bioinformatics','genomics',
    'computational biology','clinical','drug discovery','biomarker','cancer',
    'neuroscience','medical imaging','parkinson','gait analysis','speech analysis',
    'signal processing','optimization','cybersecurity','bioengineering','diagnosis',
    'multimodal','health informatics','pattern recognition','classification',
    'disease detection','time series','wearable','robotics','immunology',
    'ai in medicine','machine learning medicine','deep learning healthcare',
  ]);
  const rawKw = profile.keywords || [];
  const keywords = rawKw.filter(k =>
    MEANINGFUL.has(k.toLowerCase()) ||
    k.includes(' ') // keep any multi-word phrase
  );
  const kwContainer = document.getElementById('profile-keywords');
  if (keywords.length > 0) {
    kwContainer.innerHTML = keywords.slice(0, 30).map(k =>
      `<span class="tag small-tag tag-removable">
        ${escapeHtml(k)}
        <button class="tag-remove-kw" data-kw="${escapeHtml(k)}" title="Remove">×</button>
      </span>`
    ).join('');
    kwContainer.querySelectorAll('.tag-remove-kw').forEach(btn => {
      btn.addEventListener('click', () => {
        chrome.storage.sync.get(['userProfile'], (r) => {
          const p = r.userProfile || {};
          p.keywords = (p.keywords || []).filter(k => k !== btn.dataset.kw);
          chrome.storage.sync.set({ userProfile: p }, () => showProfileCard(p));
        });
      });
    });
  } else {
    kwContainer.innerHTML = '<span style="color:var(--text-tertiary);font-size:12px">None extracted</span>';
  }
}

function removeProfileSource(source) {
  if (!confirm(`Remove ${source === 'google_scholar' ? 'Google Scholar' : source.charAt(0).toUpperCase() + source.slice(1)} from your profile?`)) return;
  chrome.storage.sync.get(['userProfile'], (result) => {
    const profile = result.userProfile || {};
    const allSources = (profile.allSources || []).filter(s => s !== source);

    if (allSources.length === 0) {
      // No sources left - clear the whole profile
      chrome.storage.sync.remove('userProfile', () => loadProfile());
      return;
    }

    // and clear fields that came specifically from this source
    const updated = { ...profile, allSources, source: allSources[0] };

    if (profile.source === source) {
      if (source === 'linkedin') {
        delete updated.headline; delete updated.location; delete updated.about;
      } else if (source === 'google_scholar') {
        delete updated.metrics; delete updated.coauthors;
      } else if (source === 'researchgate') {
        delete updated.metrics;
      }
    }

    chrome.storage.sync.set({ userProfile: updated }, () => loadProfile());
  });
}

function renderManualInterests(interests) {
  const container = document.getElementById('manual-interests-tags');
  container.innerHTML = interests.length > 0
    ? interests.map(i => `
        <span class="tag">${escapeHtml(i)}
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
          renderManualInterests(interests); e.target.value = '';
        });
      } else { e.target.value = ''; }
    });
  }
});

document.getElementById('clear-profile-btn').addEventListener('click', () => {
  if (confirm('Clear your imported profile data? Manual interests will be kept.')) {
    chrome.storage.sync.remove('userProfile', () => loadProfile());
  }
});

document.getElementById('open-linkedin-btn').addEventListener('click', () => {
  chrome.storage.sync.get(['userProfile'], (result) => {
    const profile = result.userProfile || {};
    const savedUrl = profile.source === 'linkedin' && profile.profileUrl;
    const url = savedUrl || 'https://www.linkedin.com/in/';
    chrome.tabs.create({ url });
  });
});
document.getElementById('open-scholar-btn').addEventListener('click', () => {
  chrome.storage.sync.get(['userProfile'], (result) => {
    const profile = result.userProfile || {};
    // If Scholar was imported, go directly to their citations page
    const allSources = profile.allSources || (profile.source ? [profile.source] : []);
    const savedUrl = allSources.includes('google_scholar') && profile.profileUrl && profile.profileUrl.includes('citations')
      ? profile.profileUrl : null;
    chrome.tabs.create({ url: savedUrl || 'https://scholar.google.com/citations' });
  });
});
document.getElementById('open-researchgate-btn').addEventListener('click', () => {
  chrome.storage.sync.get(['userProfile'], (result) => {
    const profile = result.userProfile || {};
    const allSources = profile.allSources || (profile.source ? [profile.source] : []);
    // If ResearchGate was imported, go directly to their profile
    const savedUrl = allSources.includes('researchgate') && profile.profileUrl && profile.profileUrl.includes('/profile/')
      ? profile.profileUrl : null;
    chrome.tabs.create({ url: savedUrl || 'https://www.researchgate.net' });
  });
});

let discoverCache = null;
let discoverCacheKeywords = null;

async function loadRecommendations() {
  const container = document.getElementById('recommendations-list');

  const stored = await new Promise(resolve => {
    chrome.storage.sync.get(['userProfile', 'papers', 'manualInterests'], resolve);
  });

  const userProfile = stored.userProfile || {};
  const savedPapers = stored.papers || [];
  const manualInterests = stored.manualInterests || [];

  const DOMAIN_WHITELIST = new Set([
    // AI / ML
    'machine learning','deep learning','artificial intelligence','neural network',
    'computer vision','natural language processing','nlp','reinforcement learning',
    'transformer','generative ai','large language model','llm','federated learning',
    'transfer learning','convolutional neural network','cnn','recurrent neural network',
    'graph neural network','self-supervised','semi-supervised','unsupervised',
    // Medical / Clinical
    'parkinson','parkinson disease','medical imaging','biomedical','clinical',
    'disease detection','diagnosis','neurology','neuroscience','brain',
    'gait analysis','speech analysis','tremor','motor symptoms','rehabilitation',
    'electronic health records','ehr','telemedicine','wearable','biosignal',
    // Bioengineering
    'bioengineering','bioinformatics','genomics','proteomics','computational biology',
    'systems biology','drug discovery','biomarker','cancer','immunology',
    // Signal / Data
    'signal processing','time series','feature extraction','data mining',
    'pattern recognition','anomaly detection','sensor fusion','multimodal',
    'eeg','ecg','emg','accelerometer',
    // Research areas from profile
    'ai in medicine','machine learning medicine','deep learning healthcare',
    'computer aided diagnosis','medical ai','health informatics',
    'ieee','acm','nature','springer','elsevier','mdpi','frontiers',
  ]);

  const DOMAIN_WORDS = new Set([
    'learning','intelligence','neural','medical','clinical','health','disease',
    'parkinson','brain','imaging','signal','detection','diagnosis','biomedical',
    'bioengineering','bioinformatics','genomics','multimodal','deep','vision',
    'language','network','model','classification','recognition','analysis',
  ]);

  const rawKeywords = [
    ...manualInterests,
    ...(userProfile.interests || []),
    ...(userProfile.keywords || []),
  ];

  const focused = [...new Set(
    rawKeywords
      .map(k => k.toLowerCase().trim())
      .filter(k => {
        if (k.length < 4) return false;
        // Accept if it's in the whitelist
        if (DOMAIN_WHITELIST.has(k)) return true;
        // Accept multi-word phrases if they contain a domain word
        if (k.includes(' ') && k.split(' ').some(w => DOMAIN_WORDS.has(w))) return true;
        // Accept single domain words
        if (DOMAIN_WORDS.has(k)) return true;
        return false;
      })
      .sort((a, b) => {
        // Phrases first, then by length
        const aScore = (a.includes(' ') ? 20 : 0) + a.length;
        const bScore = (b.includes(' ') ? 20 : 0) + b.length;
        return bScore - aScore;
      })
  )].slice(0, 10);

  if (focused.length === 0 && savedPapers.length > 0) {
    const titleWords = savedPapers.flatMap(p => extractKeywordsFromTitle(p.title));
    focused.push(...[...new Set(titleWords.filter(w => DOMAIN_WORDS.has(w)))].slice(0, 8));
  }

  if (focused.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Import your profile from LinkedIn, Google Scholar, or ResearchGate, or add manual interests, to get personalized recommendations.</p>
      </div>`;
    return;
  }

  const debugEl = document.createElement('p');
  debugEl.style.cssText = 'font-size:10px;color:#9ca3af;text-align:center;padding:4px 8px;margin:0;';
  debugEl.textContent = 'Searching with: ' + focused.slice(0,5).join(', ') + (focused.length > 5 ? '...' : '');
  container.appendChild(debugEl);
  console.log('[Research Tracker] Discover focused keywords:', focused);

  const cacheKey = focused.slice(0,8).join(',');
  if (discoverCache && discoverCacheKeywords === cacheKey) {
    renderCachedRecommendations(discoverCache, container);
    return;
  }

  container.innerHTML = `<div class="loading-spinner"></div>
    <p style="text-align:center;font-size:12px;color:var(--text-secondary);margin-top:8px;">Finding venues for: ${focused.slice(0,3).join(', ')}${focused.length > 3 ? '...' : ''}</p>`;

  try {
    const venues = await fetchRelevantVenuesFast(focused);
    if (venues.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No recommendations found. Try adding more interests.</p></div>`;
      return;
    }
    const scored = venues
      .map(v => ({ ...v, score: computeMatchScore(v, focused) }))
      .filter(v => v.score >= 0) // Show all results, best first
      .sort((a, b) => b.score - a.score);

    discoverCache = scored;
    discoverCacheKeywords = cacheKey;
    await renderVenueRecommendations(scored, container);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="empty-state"><p>Error loading recommendations. Please try again.</p></div>`;
  }
}

async function fetchRelevantVenuesFast(keywords) {
  const seen = new Set();
  const venues = [];

  const searchTerms = keywords
    .filter(k => k.length >= 3)
    .sort((a, b) => {
      const aScore = (a.includes(' ') ? 20 : 0) + a.length;
      const bScore = (b.includes(' ') ? 20 : 0) + b.length;
      return bScore - aScore;
    })
    .slice(0, 6);

  console.log('[RT Discover] Fetching for terms:', searchTerms);

  const allRequests = searchTerms.flatMap(term => [
    fetch(`https://api.openalex.org/sources?search=${encodeURIComponent(term)}&filter=type:journal&per-page=8&sort=cited_by_count:desc&mailto=researcher@example.com`).catch(() => null),
    fetch(`https://api.openalex.org/sources?search=${encodeURIComponent(term)}&filter=type:conference&per-page=5&sort=cited_by_count:desc&mailto=researcher@example.com`).catch(() => null),
  ]);

  const dblpRequests = searchTerms.slice(0, 3).map(term =>
    fetch(`https://dblp.org/search/venue/api?q=${encodeURIComponent(term)}&h=6&format=json`).catch(() => null)
  );

  const allResponses = await Promise.all([...allRequests, ...dblpRequests]);

  for (let i = 0; i < allRequests.length; i++) {
    const res = allResponses[i];
    if (!res?.ok) continue;
    try {
      const data = await res.json();
      const type = i % 2 === 0 ? 'journal' : 'conference';
      for (const s of (data.results || [])) {
        if (s.id && !seen.has(s.id)) {
          seen.add(s.id);
          venues.push(parseOpenAlexSource(s, type));
        }
      }
    } catch(e) { console.log('[RT Discover] parse error:', e); }
  }

  for (let i = 0; i < dblpRequests.length; i++) {
    const res = allResponses[allRequests.length + i];
    if (!res?.ok) continue;
    try {
      const data = await res.json();
      for (const h of (data?.result?.hits?.hit || [])) {
        const name = h.info?.venue;
        if (!name) continue;
        const key = 'dblp:' + name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          venues.push({
            name, type: 'conference', openAlexId: null,
            url: h.info?.url || null, publisher: 'DBLP',
            issn: null, isOA: false, apcUsd: null,
            citedByCount: 0, worksCount: 0, hIndex: null,
            twoYearCitedness: null, concepts: [], lastUpdated: null
          });
        }
      }
    } catch {}
  }

  console.log('[RT Discover] Total venues fetched:', venues.length);
  return venues;
}

function parseOpenAlexSource(source, type) {
  return {
    name: source.display_name,
    type,
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

function computeMatchScore(venue, userKeywords) {
  if (!userKeywords?.length) return 0;

  const venueName = venue.name.toLowerCase();
  const venueConcepts = (venue.concepts || []).map(t => t.toLowerCase());
  const venueFullText = [venueName, ...venueConcepts, (venue.publisher||'').toLowerCase()].join(' ');

  const topicGroups = {
    'ai_ml':    ['artificial intelligence','machine learning','deep learning','neural network',
                 'ai in medicine','ai','ml','cnn','rnn','lstm','transformer','generative',
                 'reinforcement','llm','ensemble','classification','detection','prediction'],
    'medical':  ['medicine','medical','clinical','health','disease','parkinson','diagnosis',
                 'biomedical','patient','healthcare','therapeutic','neurology','motor',
                 'severity','symptom','rehabilitation','gait','tremor','voice','speech'],
    'imaging':  ['imaging','image','vision','computer vision','visual','mri','scan','radiology',
                 'microscopy','segmentation','detection','recognition'],
    'signal':   ['signal','audio','speech','voice','sound','acoustic','eeg','ecg','waveform',
                 'frequency','spectrum','processing','feature extraction'],
    'bio':      ['bioengineering','biology','bioinformatics','genomics','neural','brain',
                 'neuroscience','physiology','biomechanics','biosensor'],
    'data':     ['data science','data mining','analytics','statistics','pattern','feature',
                 'dataset','benchmark','evaluation','accuracy','performance'],
  };

  const userText = userKeywords.join(' ').toLowerCase();
  const userTopicSet = new Set();
  for (const [topic, terms] of Object.entries(topicGroups)) {
    if (terms.some(t => userText.includes(t))) userTopicSet.add(topic);
  }

  let topicMatches = 0;
  let directKeywordMatches = 0;

  for (const topic of userTopicSet) {
    if (topicGroups[topic].some(t => venueFullText.includes(t))) topicMatches++;
  }

  for (const kw of userKeywords) {
    if (kw.length >= 3 && venueFullText.includes(kw.toLowerCase())) directKeywordMatches++;
  }

  if (topicMatches === 0 && directKeywordMatches === 0) return 0;

  const topicCoverage = userTopicSet.size > 0 ? topicMatches / userTopicSet.size : 0;
  const keywordCoverage = Math.min(directKeywordMatches / Math.max(userKeywords.length, 1), 1);

  let score = topicCoverage > 0
    ? (topicCoverage * 0.65) + (keywordCoverage * 0.35)
    : keywordCoverage * 0.4; // keyword-only match gets partial score

  if (venue.hIndex >= 150) score *= 1.25;
  else if (venue.hIndex >= 100) score *= 1.18;
  else if (venue.hIndex >= 50)  score *= 1.10;
  else if (venue.hIndex >= 25)  score *= 1.05;

  if (venue.citedByCount > 500000) score *= 1.10;
  else if (venue.citedByCount > 100000) score *= 1.05;

  if (venue.isOA) score *= 1.03;

  return Math.min(score, 1.0);
}

function extractKeywordsFromTitle(title) {
  const stopWords = ['the','and','for','with','from','using','based','a','an','in','on','of','to','via'];
  return title.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !stopWords.includes(w)).slice(0, 5);
}

function renderCachedRecommendations(scored, container) {
  const cards = scored.map(v => renderVenueCardWithMetrics(v, null, v.score));
  container.innerHTML = cards.join('');
  attachVenueListeners(container);
}

async function renderVenueRecommendations(venues, container) {
  const cards = venues.map(v => renderVenueCardWithMetrics(v, null, v.score));
  container.innerHTML = cards.join('');
  attachVenueListeners(container);

  const enriched = venues.filter(v => v.openAlexId);
  const metricResults = await Promise.all(
    enriched.map(v => fetchJournalMetrics(v.name, v.openAlexId))
  );
  enriched.forEach((v, i) => {
    const metrics = metricResults[i];
    if (!metrics) return;
    const el = container.querySelector(`[data-venue-id="${CSS.escape(v.openAlexId)}"]`);
    if (el) el.outerHTML = renderVenueCardWithMetrics(v, metrics, v.score);
  });
  attachVenueListeners(container);
}

function attachVenueListeners(container) {
  container.querySelectorAll('.open-url-btn').forEach(btn => {
    btn.addEventListener('click', () => chrome.tabs.create({ url: btn.dataset.url }));
  });
  container.querySelectorAll('.add-deadline-from-venue').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelector('.tab[data-tab="deadlines"]').classList.add('active');
      document.getElementById('deadlines-tab').classList.add('active');
      document.getElementById('deadline-form').classList.remove('hidden');
      document.getElementById('deadline-title').value = btn.dataset.name;
      document.getElementById('deadline-type').value = btn.dataset.type || 'conference';
      document.getElementById('deadline-url').value = btn.dataset.url || '';
      loadDeadlines();
    });
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
  const quartileBadge = quartile ? `<span class="badge badge-quartile-${quartile.toLowerCase()}">${quartile}</span>` : '';
  const oaBadge = isOA ? '<span class="badge badge-success">Open Access</span>' : '';
  const apcInfo = apcUsd != null
    ? `<div class="detail-row"><span class="icon">💰</span><span style="font-size:12px">APC: $${apcUsd.toLocaleString()}</span></div>` : '';
  const publisherRow = (publisher||issn)
    ? `<div class="publisher-info">${publisher?`<span class="publisher-name">${escapeHtml(publisher)}</span>`:''}${issn?`<span class="issn">ISSN ${escapeHtml(issn)}</span>`:''}</div>` : '';
  let metricsGrid = '';
  if (!isConference && (impactFactor || hIndex)) {
    metricsGrid = `<div class="journal-metrics-grid" style="grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0;">
      <div class="metric-item"><span class="metric-value">${impactFactor?impactFactor.toFixed(2):"--"}</span><span class="metric-label">2yr Citedness</span></div>
      <div class="metric-item"><span class="metric-value">${hIndex||"--"}</span><span class="metric-label">h-index</span></div>
      <div class="metric-item"><span class="metric-value">${venue.citedByCount>=1000?(venue.citedByCount/1000).toFixed(0)+'K':venue.citedByCount||"--"}</span><span class="metric-label">Citations</span></div>
    </div>`;
  } else {
    const cStr = venue.citedByCount>=1e6?(venue.citedByCount/1e6).toFixed(1)+'M':venue.citedByCount>=1000?(venue.citedByCount/1000).toFixed(0)+'K':venue.citedByCount||"--";
    const wStr = venue.worksCount>=1000?(venue.worksCount/1000).toFixed(0)+'K':venue.worksCount||"--";
    metricsGrid = `<div class="journal-metrics-grid" style="grid-template-columns:repeat(2,1fr);gap:8px;margin:10px 0;">
      <div class="metric-item"><span class="metric-value">${cStr}</span><span class="metric-label">Total Citations</span></div>
      <div class="metric-item"><span class="metric-value">${wStr}</span><span class="metric-label">Works Published</span></div>
    </div>`;
  }
  const indexingInfo = (metrics?.indexed?.length > 0)
    ? `<div class="indexing-info"><strong>Indexed in:</strong><div class="indexing-badges" style="margin-top:6px">${metrics.indexed.map(i=>`<span class="index-badge">${escapeHtml(i)}</span>`).join('')}</div></div>` : '';
  const conceptTags = (venue.concepts||[]).slice(0,4).map(c=>`<span class="index-badge">${escapeHtml(c)}</span>`).join('');
  const url = venue.url || (venue.openAlexId ? `https://openalex.org/${venue.openAlexId}` : '');
  return `
    <div class="recommendation-card" ${venue.openAlexId ? `data-venue-id="${escapeHtml(venue.openAlexId)}"` : ''}>
      <div class="card-meta">${typeBadge}${quartileBadge}${oaBadge}</div>
      <h3 class="card-title">${escapeHtml(venue.name)}</h3>
      ${publisherRow}${metricsGrid}${indexingInfo}
      ${conceptTags ? `<div class="indexing-info"><strong>Topics:</strong><div class="indexing-badges" style="margin-top:4px">${conceptTags}</div></div>` : ''}
      ${apcInfo}${matchBar(matchScore)}
      <div class="paper-actions" style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${url ? `<button class="btn-secondary btn-sm open-url-btn" data-url="${escapeHtml(url)}">Visit →</button>` : ''}
        <button class="btn-secondary btn-sm add-deadline-from-venue" data-name="${escapeHtml(venue.name)}" data-type="${venue.type}" data-url="${escapeHtml(url)}" title="Track deadline for this venue">📅 Track Deadline</button>
      </div>
    </div>`;
}

function matchBar(score) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#2563eb' : '#9ca3af';
  return `<div class="match-info"><div style="display:flex;align-items:center;gap:8px;">
    <span style="font-size:11px;color:var(--text-secondary);min-width:60px">Relevance</span>
    <div style="flex:1;height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width 0.4s"></div>
    </div>
    <span style="font-size:11px;font-weight:600;color:${color};min-width:30px;text-align:right">${pct}%</span>
  </div></div>`;
}

document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const filter = tab.dataset.filter;
    document.querySelectorAll('.recommendation-card').forEach(card => {
      const isConf = card.querySelector('.badge-conference');
      const isJournal = card.querySelector('.badge-journal');
      card.style.display = (filter === 'all' || (filter === 'conferences' && isConf) || (filter === 'journals' && isJournal)) ? 'block' : 'none';
    });
  });
});

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
