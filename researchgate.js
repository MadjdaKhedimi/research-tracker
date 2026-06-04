// Injects import bar on ResearchGate profile pages

(function () {
  if (!window.location.href.includes('researchgate.net/profile/')) return;

  async function extractResearchGateProfile() {
    await new Promise(r => setTimeout(r, 2000));

    const profile = {};

    // ResearchGate title format: "Name - Affiliation | ResearchGate"
    const titleRaw = document.title || '';
    const titleName = titleRaw.split('|')[0].split(' - ')[0].trim();
    if (titleName && titleName !== 'ResearchGate' && titleName.length > 1) {
      profile.name = titleName;
    }

    const rawText = document.body.innerText || '';
    const allPageText = rawText.toLowerCase();

    const titleParts = titleRaw.split('|')[0].split(' - ');
    if (titleParts.length >= 2) {
      profile.affiliation = titleParts[1].trim();
    }
    if (!profile.affiliation) {
      // Try first few lines of page text
      const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 3);
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        if (lines[i].toLowerCase().includes('university') ||
            lines[i].toLowerCase().includes('institute') ||
            lines[i].toLowerCase().includes('college') ||
            lines[i].toLowerCase().includes('hospital') ||
            lines[i].toLowerCase().includes('laboratory')) {
          profile.affiliation = lines[i];
          break;
        }
      }
    }

    const skills = [];

    const skillsSectionPatterns = [
      'Skills and Expertise\n',
      'Research Interests\n',
      'Topics\n',
      'Disciplines\n'
    ];

    for (const pattern of skillsSectionPatterns) {
      const idx = rawText.indexOf(pattern);
      if (idx !== -1) {
        const block = rawText.substring(idx + pattern.length, idx + pattern.length + 1500);
        // Skills end at the next major section
        const endIdx = block.search(/\n(Publications|Experience|Education|About|Co-authors|Projects|Questions)\n/);
        const skillBlock = endIdx > 0 ? block.substring(0, endIdx) : block.substring(0, 800);
        skillBlock.split('\n').forEach(line => {
          const clean = line.trim();
          if (clean.length >= 2 && clean.length <= 60 &&
              !clean.match(/^(Show|See|Add|Edit|Follow|\d+|View all)/i) &&
              !clean.includes('·') &&
              !skills.includes(clean)) {
            skills.push(clean);
          }
        });
        if (skills.length > 0) break;
      }
    }
    profile.skills = skills.slice(0, 30);

    let about = '';
    const aboutIdx = rawText.indexOf('\nAbout\n');
    if (aboutIdx !== -1) {
      const block = rawText.substring(aboutIdx + 8, aboutIdx + 1500);
      const endIdx = block.search(/\n(Publications|Experience|Education|Skills|Co-authors|Questions)\n/);
      about = (endIdx > 0 ? block.substring(0, endIdx) : block.substring(0, 600))
        .replace(/\n+/g, ' ').trim();
    }
    profile.about = about;

    const publications = [];
    const pubPatterns = ['\nPublications\n', '\nResearch\n'];
    for (const pat of pubPatterns) {
      const pubIdx = rawText.indexOf(pat);
      if (pubIdx !== -1) {
        const block = rawText.substring(pubIdx + pat.length, pubIdx + pat.length + 3000);
        block.split('\n').forEach(line => {
          const clean = line.trim();
          if (clean.length > 20 && clean.length < 250 &&
              !clean.match(/^(Show|See|Add|View|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d+|Article|Chapter|Conference)/i) &&
              !clean.includes('·') &&
              !publications.includes(clean)) {
            publications.push(clean);
          }
        });
        if (publications.length > 0) break;
      }
    }
    profile.recentPapers = publications.slice(0, 15);

    const statsPatterns = {
      reads: /(\d[\d,]*)\s*(?:Reads|reads)/,
      citations: /(\d[\d,]*)\s*(?:Citations|citations)/,
      hIndex: /(?:h-index|h index)[:\s]*(\d+)/i
    };
    const metrics = {};
    for (const [key, pattern] of Object.entries(statsPatterns)) {
      const match = rawText.match(pattern);
      if (match) metrics[key] = match[1];
    }
    if (Object.keys(metrics).length > 0) profile.metrics = metrics;

    const interestKeywords = [
      'machine learning','deep learning','neural network','artificial intelligence',
      'computer vision','natural language processing','data science','signal processing',
      'bioengineering','medical imaging','healthcare','parkinson','neuroscience',
      'optimization','robotics','cybersecurity','bioinformatics','genomics',
      'reinforcement learning','transformer','generative ai','large language model',
      'classification','detection','diagnosis','clinical','drug discovery'
    ];
    const interests = [];
    interestKeywords.forEach(kw => {
      if (allPageText.includes(kw)) interests.push(kw);
    });
    profile.skills.forEach(s => {
      const sl = s.toLowerCase();
      if (!interests.includes(sl)) interests.push(sl);
    });
    profile.interests = [...new Set(interests)];

    const allText = [
      profile.affiliation || '',
      profile.about || '',
      ...profile.skills,
      ...profile.recentPapers,
      ...profile.interests
    ].join(' ').toLowerCase();

    profile.keywords = buildKeywords(allText, allPageText);
    profile.source = 'researchgate';
    profile.profileUrl = window.location.href.split('?')[0];
    profile.importedAt = new Date().toISOString();

    return profile;
  }

  function buildKeywords(profileText, fullPageText) {
    const domainKeywords = [
      'machine learning','deep learning','neural network','artificial intelligence',
      'natural language processing','computer vision','reinforcement learning',
      'transfer learning','federated learning','transformer','generative ai',
      'data science','data mining','knowledge graph','graph neural network',
      'large language model','self-supervised learning',
      'bioinformatics','genomics','proteomics','computational biology',
      'clinical','drug discovery','biomarker','cancer','immunology',
      'neuroscience','epidemiology','public health','medical imaging',
      'parkinson','gait analysis','speech analysis','disease detection',
      'robotics','signal processing','optimization','cybersecurity',
      'bioengineering','diagnosis','multimodal','health informatics',
      'pattern recognition','feature extraction','classification','time series',
      'wearable','biosensor','eeg','ecg','brain computer interface'
    ];
    const found = [];
    domainKeywords.forEach(kw => {
      if (fullPageText.includes(kw) && !found.includes(kw)) found.push(kw);
    });
    return found;
  }

  function injectImportButton() {
    if (document.getElementById('rt-researchgate-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'rt-researchgate-bar';
    bar.style.cssText = `
      position: fixed; bottom: 24px; right: 24px;
      display: inline-flex; align-items: center;
      background: #00d0b1; border-radius: 20px;
      box-shadow: 0 3px 12px rgba(0,208,177,0.4);
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

    btn.addEventListener('click', async () => {
      btn.innerHTML = '<span style="font-size:15px">⏳</span> Reading profile...';
      btn.disabled = true;

      const profile = await extractResearchGateProfile();

      if (!profile || !profile.name) {
        btn.innerHTML = '<span style="font-size:15px">❌</span> Could not read - reload and try again';
        btn.style.fontSize = '11px';
        setTimeout(() => {
          btn.innerHTML = '<span style="font-size:15px">📚</span> Import to Research Tracker';
          btn.style.fontSize = '13px';
          btn.disabled = false;
        }, 3500);
        return;
      }

      chrome.storage.sync.get(['userProfile'], (result) => {
        const existing = result.userProfile || {};
        const allSources = [...new Set([
          ...(existing.allSources || (existing.source ? [existing.source] : [])),
          'researchgate'
        ])];
        const merged = {
          ...existing, ...profile, allSources,
          keywords: [...new Set([...(existing.keywords || []), ...(profile.keywords || [])])],
          interests: [...new Set([...(existing.interests || []), ...(profile.interests || [])])]
        };
        chrome.storage.sync.set({ userProfile: merged }, () => {
          btn.innerHTML = '<span style="font-size:15px">✅</span> Profile Imported!';
          setTimeout(() => bar.remove(), 2500);
        });
      });
    });

    bar.appendChild(btn);
    bar.appendChild(sep);
    bar.appendChild(closeBtn);
    document.body.appendChild(bar);
  }

  setTimeout(injectImportButton, 4000);

  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl && url.includes('/profile/')) {
      lastUrl = url;
      document.getElementById('rt-researchgate-bar')?.remove();
      setTimeout(injectImportButton, 4000);
    }
  }).observe(document, { subtree: true, childList: true });
})();
