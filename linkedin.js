// Injects import bar on LinkedIn profile pages

(function () {
  if (!window.location.href.includes('/in/')) return;

  async function extractLinkedInProfile() {
    await new Promise(r => setTimeout(r, 2000));

    const profile = {};

        const titleRaw = document.title || '';
    const titleName = titleRaw.replace('| LinkedIn', '').replace('- LinkedIn', '').trim();
    if (titleName && titleName.length > 1) profile.name = titleName;

        const rawText = document.body.innerText || '';

        if (profile.name) {
      const afterName = rawText.split(profile.name)[1] || '';
      const lines = afterName.split('\n').map(l => l.trim()).filter(l => l.length > 3);
      // First non-empty line after name is usually the headline
      if (lines[0] && lines[0].length < 200 && !lines[0].includes('connections')) {
        profile.headline = lines[0];
      }
    }

        const allPageText = rawText.toLowerCase();

        const skills = [];
    
    const skillsIdx = rawText.indexOf('\nSkills\n');
    if (skillsIdx !== -1) {
      const block = rawText.substring(skillsIdx + 8, skillsIdx + 2000);
      block.split('\n').forEach(line => {
        const clean = line.trim();
        if (clean.length >= 2 && clean.length <= 50 &&
            !clean.match(/^(Show|See|Add|Edit|\d+|Endorsed|Top|endorsement)/i) &&
            !clean.includes('·') && !clean.includes('connections') &&
            !skills.includes(clean)) {
          skills.push(clean);
        }
      });
    }

if (skills.length === 0) {
      const domainTerms = [
        'Python','MATLAB','TensorFlow','PyTorch','Keras','Scikit-learn','NumPy','Pandas',
        'Machine Learning','Deep Learning','Computer Vision','NLP','Data Science',
        'Signal Processing','Bioengineering','Healthcare','Medical Imaging',
        'Research','Algorithm','Neural Network','Classification','Detection',
        'Java','C++','JavaScript','SQL','R programming','Statistics',
        'Project Management','Leadership','Communication','Problem Solving'
      ];
      domainTerms.forEach(term => {
        if (rawText.includes(term) && !skills.includes(term)) skills.push(term);
      });
    }
    profile.skills = skills.slice(0, 30);

        let about = '';
    const aboutIdx = rawText.indexOf('\nAbout\n');
    if (aboutIdx !== -1) {
      const block = rawText.substring(aboutIdx + 8, aboutIdx + 1500);
      // Take text until next major section
      const nextSection = block.search(/\n(Activity|Experience|Education|Skills|Publications|Courses)\n/);
      about = (nextSection > 0 ? block.substring(0, nextSection) : block)
        .replace(/\n+/g, ' ').trim();
    }
    profile.about = about;

        const education = [];
    const eduIdx = rawText.indexOf('\nEducation\n');
    if (eduIdx !== -1) {
      const block = rawText.substring(eduIdx + 12, eduIdx + 1500);
      block.split('\n').forEach(line => {
        const clean = line.trim();
        if (clean.length > 3 && clean.length < 100 &&
            !clean.match(/^(Show|See|Bachelor|Master|PhD|\d{4}|Jan|Feb|Mar)/i) &&
            !education.includes(clean)) {
          education.push(clean);
        }
      });
    }
    profile.education = education.slice(0, 5);

        const publications = [];
    const pubIdx = rawText.indexOf('\nPublications\n');
    if (pubIdx !== -1) {
      const block = rawText.substring(pubIdx + 15, pubIdx + 2000);
      block.split('\n').forEach(line => {
        const clean = line.trim();
        if (clean.length > 20 && clean.length < 250 &&
            !clean.match(/^(Show|See|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d)/i) &&
            !publications.includes(clean)) {
          publications.push(clean);
        }
      });
    }
    profile.recentPapers = publications.slice(0, 10);

        const interestKeywords = [
      'machine learning','deep learning','neural network','artificial intelligence',
      'computer vision','natural language processing','data science','signal processing',
      'bioengineering','medical imaging','healthcare','parkinson','neuroscience',
      'optimization','robotics','cybersecurity','bioinformatics','genomics',
      'reinforcement learning','transformer','large language model','generative ai'
    ];
    const interests = [];
    interestKeywords.forEach(kw => {
      if (allPageText.includes(kw)) interests.push(kw);
    });
    // Also add skills as interests
    profile.skills.forEach(s => {
      const sl = s.toLowerCase();
      if (!interests.includes(sl)) interests.push(sl);
    });
    profile.interests = [...new Set(interests)];

        const allText = [
      profile.headline || '',
      profile.about || '',
      ...profile.skills,
      ...profile.education,
      ...profile.recentPapers,
      ...profile.interests
    ].join(' ').toLowerCase();

    profile.keywords = buildKeywords(allText, allPageText);
    profile.source = 'linkedin';
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
    if (document.getElementById('rt-linkedin-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'rt-linkedin-bar';
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

    btn.addEventListener('click', async () => {
      btn.textContent = 'Reading profile...';
      btn.disabled = true;

      const profile = await extractLinkedInProfile();

      if (!profile || !profile.name) {
        btn.textContent = 'Could not read - reload the page and try again';
        btn.style.fontSize = '11px';
        setTimeout(() => {
          btn.innerHTML = '<span style="font-size:15px">📚</span> Import to Research Tracker';
          btn.disabled = false;
        }, 3500);
        return;
      }

      chrome.storage.sync.get(['userProfile'], (result) => {
        const existing = result.userProfile || {};
        const allSources = [...new Set([
          ...(existing.allSources || (existing.source ? [existing.source] : [])),
          'linkedin'
        ])];
        const merged = {
          ...existing, ...profile, allSources,
          keywords: [...new Set([...(existing.keywords || []), ...(profile.keywords || [])])],
          interests: [...new Set([...(existing.interests || []), ...(profile.interests || [])])]
        };
        chrome.storage.sync.set({ userProfile: merged }, () => {
          btn.textContent = 'Profile Imported!';
          setTimeout(() => bar.remove(), 2500);
        });
      });
    });

    bar.appendChild(btn);
    bar.appendChild(sep);
    bar.appendChild(closeBtn);
    document.body.appendChild(bar);
  }

  setTimeout(injectImportButton, 3500);

  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl && url.includes('/in/')) {
      lastUrl = url;
      document.getElementById('rt-linkedin-bar')?.remove();
      setTimeout(injectImportButton, 3500);
    }
  }).observe(document, { subtree: true, childList: true });
})();
