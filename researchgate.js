// researchgate.js – Extracts researcher profile from ResearchGate pages

(function () {
  // Only run on profile pages
  if (!window.location.href.includes('researchgate.net/profile/')) return;

  function waitForElement(selector, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error('Timeout')); }, timeout);
    });
  }

  async function extractResearchGateProfile() {
    try {
      await waitForElement('h1');
    } catch (e) {
      console.log('Research Tracker: ResearchGate profile not ready');
      return null;
    }

    const profile = {};

    // Name
    const nameEl = document.querySelector('h1.nova-legacy-e-text') ||
                   document.querySelector('.profile-header h1') ||
                   document.querySelector('[itemprop="name"]');
    profile.name = nameEl ? nameEl.textContent.trim() : '';

    // Affiliation / Institution
    const affiliationEl = document.querySelector('.nova-legacy-e-text.nova-legacy-e-text--size-m.nova-legacy-e-text--family-sans-serif.nova-legacy-e-text--spacing-none.nova-legacy-e-text--color-inherit') ||
                         document.querySelector('.nova-legacy-l-flex__item a[href*="/institution/"]') ||
                         document.querySelector('[itemprop="affiliation"]');
    profile.affiliation = affiliationEl ? affiliationEl.textContent.trim() : '';

    // About / Bio
    const aboutEl = document.querySelector('.nova-legacy-o-stack__item .nova-legacy-e-text--spacing-xs') ||
                    document.querySelector('.profile-about-me') ||
                    document.querySelector('[data-test-id="profile-about"]');
    profile.about = aboutEl ? aboutEl.textContent.trim() : '';

    // Research interests / Skills
    const skillEls = document.querySelectorAll(
      '.nova-legacy-c-card__body--spacing-inherit a[href*="/topic/"]',
      '.nova-legacy-l-flex__item a.nova-legacy-e-link--theme-bare',
      '[data-test-id="skill-item"]'
    );
    const skills = [];
    skillEls.forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length < 80 && !skills.includes(text)) {
        skills.push(text);
      }
    });
    profile.skills = skills.slice(0, 30);

    // Research items / Publications (titles)
    const pubEls = document.querySelectorAll(
      'a[href*="/publication/"] .nova-legacy-v-publication-item__title',
      '.nova-legacy-e-text--size-l a',
      '[data-test-id="publication-title"]'
    );
    const publications = [];
    pubEls.forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length > 10 && !publications.includes(text)) {
        publications.push(text);
      }
    });
    profile.recentPapers = publications.slice(0, 15);

    // Stats (optional)
    const statsEls = document.querySelectorAll('.nova-legacy-o-grid__column .nova-legacy-e-text--size-l');
    if (statsEls.length >= 3) {
      profile.metrics = {
        reads: statsEls[0]?.textContent.trim() || '—',
        citations: statsEls[1]?.textContent.trim() || '—',
        hIndex: statsEls[2]?.textContent.trim() || '—'
      };
    }

    // Extract keywords from all available text
    const allText = [
      profile.name,
      profile.affiliation,
      profile.about,
      ...profile.skills,
      ...profile.recentPapers
    ].join(' ').toLowerCase();

    profile.keywords = extractKeywords(allText, profile.skills);
    profile.interests = [...profile.skills]; // ResearchGate skills are interests
    profile.source = 'researchgate';
    profile.profileUrl = window.location.href.split('?')[0];
    profile.importedAt = new Date().toISOString();

    return profile;
  }

  function extractKeywords(text, explicitSkills) {
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

    const found = [...explicitSkills.map(s => s.toLowerCase())]; // Start with RG skills
    domainKeywords.forEach(kw => {
      if (text.includes(kw) && !found.includes(kw)) found.push(kw);
    });

    // Extract frequent words from publications
    const words = text.split(/\W+/).filter(w =>
      w.length > 4 &&
      !['using', 'based', 'model', 'paper', 'study', 'method', 'approach',
        'analysis', 'system', 'toward', 'novel', 'efficient', 'research',
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
    if (document.getElementById('rt-researchgate-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'rt-researchgate-btn';
    btn.textContent = '📚 Import to Research Tracker';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #00d0b1;
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,208,177,0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: background 0.2s, transform 0.2s;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = '#00b89f'; btn.style.transform = 'scale(1.03)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#00d0b1'; btn.style.transform = 'scale(1)'; });

    btn.addEventListener('click', async () => {
      btn.textContent = '⏳ Importing...';
      btn.disabled = true;

      const profile = await extractResearchGateProfile();
      if (!profile || !profile.name) {
        btn.textContent = '❌ Could not read profile';
        setTimeout(() => {
          btn.textContent = '📚 Import to Research Tracker';
          btn.disabled = false;
        }, 2500);
        return;
      }

      chrome.storage.sync.get(['userProfile'], (result) => {
        const existing = result.userProfile || {};
        // Merge intelligently
        const merged = {
          ...existing,
          ...profile,
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

    document.body.appendChild(btn);
  }

  // ResearchGate is heavily client-rendered, so wait a bit
  setTimeout(injectImportButton, 3000);
})();
