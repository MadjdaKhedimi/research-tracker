// Injects import bar on Google Scholar profile pages

(function () {
  if (!window.location.href.includes('/citations')) return;

  function extractScholarProfile() {
    const profile = {};

    const nameEl = document.getElementById('gsc_prf_in');
    profile.name = nameEl ? nameEl.textContent.trim() : '';

    const affEl = document.querySelector('.gsc_prf_il') || document.querySelector('#gsc_prf_ivh');
    profile.affiliation = affEl ? affEl.textContent.trim() : '';

    const interestEls = document.querySelectorAll('#gsc_prf_int a, .gsc_prf_inta');
    const interests = [];
    interestEls.forEach(el => {
      const t = el.textContent.trim();
      if (t) interests.push(t.toLowerCase());
    });
    profile.interests = interests;

    const metricEls = document.querySelectorAll('.gsc_rsb_std');
    if (metricEls.length >= 3) {
      profile.metrics = {
        totalCitations: metricEls[0].textContent.trim(),
        hIndex: metricEls[2].textContent.trim(),
        i10Index: metricEls[4] ? metricEls[4].textContent.trim() : ''
      };
    }

    const paperEls = document.querySelectorAll('.gsc_a_at');
    const papers = [];
    paperEls.forEach(el => {
      const t = el.textContent.trim();
      if (t) papers.push(t);
    });
    profile.recentPapers = papers.slice(0, 20);

    const coauthorEls = document.querySelectorAll('#gsc_rsb_co a');
    const coauthors = [];
    coauthorEls.forEach(el => {
      const n = el.textContent.trim();
      if (n) coauthors.push(n);
    });
    profile.coauthors = coauthors.slice(0, 10);

    const allText = [...interests, ...papers, profile.affiliation || ''].join(' ').toLowerCase();
    profile.keywords = extractKeywords(allText, interests);

    profile.source = 'google_scholar';
    profile.profileUrl = window.location.href.split('&')[0];
    profile.importedAt = new Date().toISOString();

    return profile;
  }

  function extractKeywords(text, explicitInterests) {
    const domainKeywords = [
      'machine learning','deep learning','neural network','artificial intelligence',
      'natural language processing','computer vision','reinforcement learning',
      'data science','data mining','knowledge graph','transformer',
      'large language model','generative ai','federated learning',
      'bioinformatics','genomics','proteomics','computational biology',
      'clinical','drug discovery','biomarker','cancer','immunology',
      'neuroscience','epidemiology','public health','medical imaging',
      'parkinson','gait analysis','speech analysis','multimodal',
      'robotics','signal processing','optimization','cybersecurity',
      'bioengineering','diagnosis','health informatics','wearable',
      'pattern recognition','classification','disease detection','time series'
    ];
    const found = [...explicitInterests];
    domainKeywords.forEach(kw => {
      if (text.includes(kw) && !found.includes(kw)) found.push(kw);
    });
    return found;
  }

  function injectImportButton() {
    if (document.getElementById('rt-scholar-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'rt-scholar-bar';
    bar.style.cssText = `
      position: fixed; bottom: 24px; right: 24px;
      display: inline-flex; align-items: center;
      background: #2563eb; border-radius: 20px;
      box-shadow: 0 3px 12px rgba(37,99,235,0.4);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    `;

    const btn = document.createElement('button');
    btn.innerHTML = '<span style="font-size:14px;line-height:1">📚</span><span> Import to Research Tracker</span>';
    btn.style.cssText = `
      background: transparent; color: white; border: none;
      font-size: 13px; font-weight: 600; cursor: pointer;
      padding: 8px 10px 8px 14px; white-space: nowrap;
      display: flex; align-items: center; gap: 6px;
    `;

    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px; height:16px; background:rgba(255,255,255,0.3); flex-shrink:0;';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Dismiss';
    closeBtn.style.cssText = `
      background: transparent; color: rgba(255,255,255,0.85); border: none;
      font-size: 16px; line-height: 1; font-weight: 400;
      cursor: pointer; padding: 8px 12px 8px 10px;
      display: flex; align-items: center; justify-content: center;
    `;

    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = 'white'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = 'rgba(255,255,255,0.85)'; });
    closeBtn.addEventListener('click', () => bar.remove());

    btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.85'; });
    btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });

    btn.addEventListener('click', () => {
      btn.textContent = 'Importing...';
      btn.disabled = true;

      const profile = extractScholarProfile();

      if (!profile || (!profile.name && profile.interests.length === 0)) {
        btn.textContent = 'Could not read profile';
        setTimeout(() => {
          btn.innerHTML = '<span style="font-size:15px">📚</span> Import to Research Tracker';
          btn.disabled = false;
        }, 2500);
        return;
      }

      chrome.storage.sync.get(['userProfile'], (result) => {
        const existing = result.userProfile || {};
        const allSources = [...new Set([
          ...(existing.allSources || (existing.source ? [existing.source] : [])),
          'google_scholar'
        ])];
        const merged = {
          ...existing, ...profile, allSources,
          keywords: [...new Set([...(existing.keywords || []), ...(profile.keywords || [])])],
          interests: [...new Set([...(existing.interests || []), ...(profile.interests || [])])]
        };
        chrome.storage.sync.set({ userProfile: merged }, () => {
          btn.textContent = 'Profile Imported!';
          btn.style.background = 'rgba(255,255,255,0.15)';
          setTimeout(() => bar.remove(), 3000);
        });
      });
    });

    bar.appendChild(btn);
    bar.appendChild(sep);
    bar.appendChild(closeBtn);
    document.body.appendChild(bar);
  }

  if (document.readyState === 'complete') {
    setTimeout(injectImportButton, 800);
  } else {
    window.addEventListener('load', () => setTimeout(injectImportButton, 800));
  }

})();
