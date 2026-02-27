// scholar.js — Extracts researcher profile from Google Scholar citations pages

(function () {
  // Only run on profile/citations pages, not search
  if (!window.location.href.includes('citations')) return;

  function extractScholarProfile() {
    const profile = {};

    // Researcher name
    const nameEl = document.getElementById('gsc_prf_in') ||
                   document.querySelector('#gsc_prf_in');
    profile.name = nameEl ? nameEl.textContent.trim() : '';

    // Affiliation
    const affEl = document.querySelector('.gsc_prf_il') ||
                  document.querySelector('#gsc_prf_ivh');
    profile.affiliation = affEl ? affEl.textContent.trim() : '';

    // Research interests / keywords listed on profile
    const interestEls = document.querySelectorAll('#gsc_prf_int a, .gsc_prf_inta');
    const interests = [];
    interestEls.forEach(el => {
      const text = el.textContent.trim();
      if (text) interests.push(text.toLowerCase());
    });
    profile.interests = interests;

    // Citation metrics
    const metricEls = document.querySelectorAll('.gsc_rsb_std');
    if (metricEls.length >= 4) {
      profile.metrics = {
        totalCitations: metricEls[0].textContent.trim(),
        hIndex: metricEls[2].textContent.trim(),
        i10Index: metricEls[4] ? metricEls[4].textContent.trim() : ''
      };
    }

    // Paper titles from the publications table
    const paperEls = document.querySelectorAll('.gsc_a_at');
    const papers = [];
    paperEls.forEach(el => {
      const title = el.textContent.trim();
      if (title) papers.push(title);
    });
    profile.recentPapers = papers.slice(0, 20);

    // Co-authors / collaborators listed
    const coauthorEls = document.querySelectorAll('#gsc_rsb_co a');
    const coauthors = [];
    coauthorEls.forEach(el => {
      const name = el.textContent.trim();
      if (name) coauthors.push(name);
    });
    profile.coauthors = coauthors.slice(0, 10);

    // Extract keywords from all available text
    const allText = [
      ...interests,
      ...papers,
      profile.affiliation
    ].join(' ').toLowerCase();

    profile.keywords = extractKeywords(allText, interests);
    profile.source = 'google_scholar';
    profile.profileUrl = window.location.href.split('&')[0];
    profile.importedAt = new Date().toISOString();

    return profile;
  }

  function extractKeywords(text, explicitInterests) {
    const domainKeywords = [
      'machine learning', 'deep learning', 'neural network', 'artificial intelligence',
      'natural language processing', 'nlp', 'computer vision', 'reinforcement learning',
      'data science', 'data mining', 'knowledge graph', 'graph neural', 'transformer',
      'large language model', 'generative ai', 'diffusion',
      'bioinformatics', 'genomics', 'proteomics', 'computational biology', 'systems biology',
      'clinical', 'drug discovery', 'biomarker', 'cancer', 'immunology',
      'neuroscience', 'epidemiology', 'public health', 'medical imaging',
      'quantum', 'robotics', 'signal processing', 'optimization', 'cybersecurity',
      'statistics', 'algorithm', 'simulation', 'modeling', 'network', 'graph',
      'classification', 'regression', 'clustering', 'detection', 'segmentation',
      'protein', 'rna', 'dna', 'genome', 'sequence', 'structure', 'evolution'
    ];

    const found = [...explicitInterests]; // start with Scholar's own interest tags
    domainKeywords.forEach(kw => {
      if (text.includes(kw) && !found.includes(kw)) found.push(kw);
    });

    // Frequent words from paper titles
    const words = text.split(/\W+/).filter(w =>
      w.length > 4 &&
      !['using', 'based', 'model', 'paper', 'study', 'method', 'approach',
        'analysis', 'system', 'learning', 'toward', 'novel', 'efficient',
        'large', 'small', 'high', 'deep', 'with', 'from', 'that', 'this',
        'have', 'been', 'their', 'which', 'where', 'there'].includes(w)
    );

    const wordFreq = {};
    words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
    const topWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([w]) => w);

    return [...new Set([...found, ...topWords])];
  }

  function injectImportButton() {
    if (document.getElementById('rt-scholar-btn')) return;

    // Try to place button near the profile header
    const profilePanel = document.getElementById('gsc_prf') ||
                         document.querySelector('#gsc_prf_w');

    const btn = document.createElement('button');
    btn.id = 'rt-scholar-btn';
    btn.textContent = '📚 Import to Research Tracker';
    btn.style.cssText = `
      display: block;
      margin-top: 12px;
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: Arial, sans-serif;
      transition: background 0.2s;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = '#1d4ed8'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#2563eb'; });

    btn.addEventListener('click', () => {
      btn.textContent = '⏳ Importing...';
      btn.disabled = true;

      const profile = extractScholarProfile();
      if (!profile || (!profile.name && profile.interests.length === 0)) {
        btn.textContent = '❌ Could not read profile';
        setTimeout(() => {
          btn.textContent = '📚 Import to Research Tracker';
          btn.disabled = false;
        }, 2500);
        return;
      }

      chrome.storage.sync.get(['userProfile'], (result) => {
        const existing = result.userProfile || {};
        // Merge: Scholar interests are high-signal so give them priority
        const merged = {
          ...existing,
          ...profile,
          // Merge keyword arrays from both sources
          keywords: [...new Set([
            ...(existing.keywords || []),
            ...(profile.keywords || [])
          ])],
          interests: [...new Set([
            ...(existing.interests || []),
            ...(profile.interests || [])
          ])]
        };
        chrome.storage.sync.set({ userProfile: merged }, () => {
          btn.textContent = '✅ Profile Imported!';
          btn.style.background = '#16a34a';
          setTimeout(() => { btn.remove(); }, 3000);
        });
      });
    });

    if (profilePanel) {
      profilePanel.appendChild(btn);
    } else {
      // Fallback: fixed position
      btn.style.cssText += 'position:fixed;bottom:24px;right:24px;z-index:999999;box-shadow:0 4px 12px rgba(37,99,235,0.4);';
      document.body.appendChild(btn);
    }
  }

  // Scholar is mostly server-rendered so no long wait needed
  if (document.readyState === 'complete') {
    injectImportButton();
  } else {
    window.addEventListener('load', injectImportButton);
  }
})();
