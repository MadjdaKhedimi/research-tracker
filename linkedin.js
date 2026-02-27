// linkedin.js — Extracts profile data from LinkedIn profile pages

(function () {
  // Only run on profile pages
  if (!window.location.href.includes('/in/')) return;

  // Wait for the page to be sufficiently loaded
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

  async function extractLinkedInProfile() {
    try {
      await waitForElement('h1');
    } catch (e) {
      console.log('Research Tracker: LinkedIn profile not ready');
      return null;
    }

    const profile = {};

    // Name
    const nameEl = document.querySelector('h1');
    profile.name = nameEl ? nameEl.textContent.trim() : '';

    // Headline
    const headlineEl = document.querySelector('.text-body-medium.break-words') ||
                       document.querySelector('[data-generated-suggestion-target]') ||
                       document.querySelector('.pv-text-details__left-panel .text-body-medium');
    profile.headline = headlineEl ? headlineEl.textContent.trim() : '';

    // Current position
    const positionEl = document.querySelector('.experience-section li:first-child .t-bold span') ||
                       document.querySelector('[data-field="experience_company_logo"] ~ div .t-bold span');
    profile.currentPosition = positionEl ? positionEl.textContent.trim() : '';

    // About / Summary
    const aboutEl = document.querySelector('#about ~ div .full-width span[aria-hidden="true"]') ||
                    document.querySelector('section[data-section="summary"] .pv-shared-text-with-see-more span') ||
                    document.querySelector('.pv-about__summary-text');
    profile.about = aboutEl ? aboutEl.textContent.trim() : '';

    // Skills
    const skillEls = document.querySelectorAll(
      '.pv-skill-category-entity__name span[aria-hidden="true"], ' +
      '[data-field="skill_page_skill_topic"] span[aria-hidden="true"], ' +
      '.pvs-list__item--line-separated .t-bold span[aria-hidden="true"]'
    );
    const skills = [];
    skillEls.forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length < 60 && !skills.includes(text)) {
        skills.push(text);
      }
    });
    profile.skills = skills.slice(0, 30);

    // Education
    const eduEls = document.querySelectorAll(
      '[data-field="education_school"] span[aria-hidden="true"], ' +
      '.education-section .pv-entity__school-name'
    );
    const education = [];
    eduEls.forEach(el => {
      const text = el.textContent.trim();
      if (text && !education.includes(text)) education.push(text);
    });
    profile.education = education.slice(0, 5);

    // Extract keywords from all text
    const allText = [
      profile.headline,
      profile.about,
      profile.currentPosition,
      ...profile.skills,
      ...profile.education
    ].join(' ').toLowerCase();

    profile.keywords = extractKeywords(allText);
    profile.source = 'linkedin';
    profile.profileUrl = window.location.href.split('?')[0];
    profile.importedAt = new Date().toISOString();

    return profile;
  }

  function extractKeywords(text) {
    // Research domain keywords to look for
    const domainKeywords = [
      // CS / AI
      'machine learning', 'deep learning', 'neural network', 'artificial intelligence',
      'natural language processing', 'nlp', 'computer vision', 'reinforcement learning',
      'data science', 'data mining', 'knowledge graph', 'graph neural', 'transformer',
      'large language model', 'llm', 'generative ai', 'diffusion model',
      // Bio / Medicine
      'bioinformatics', 'genomics', 'proteomics', 'computational biology', 'systems biology',
      'clinical trial', 'drug discovery', 'biomarker', 'cancer', 'immunology',
      'neuroscience', 'epidemiology', 'public health', 'medical imaging', 'radiology',
      // Physics / Engineering
      'quantum computing', 'robotics', 'signal processing', 'optimization',
      'computer graphics', 'hci', 'human computer interaction', 'cybersecurity',
      // General
      'statistics', 'algorithm', 'simulation', 'modeling', 'research', 'phd',
      'professor', 'postdoc', 'scientist', 'engineer', 'software'
    ];

    const found = [];
    domainKeywords.forEach(kw => {
      if (text.includes(kw) && !found.includes(kw)) {
        found.push(kw);
      }
    });

    // Also grab individual significant words
    const words = text.split(/\W+/).filter(w =>
      w.length > 4 &&
      !['about', 'their', 'there', 'where', 'which', 'these', 'those',
        'years', 'since', 'after', 'before', 'would', 'could', 'should',
        'have', 'been', 'with', 'from', 'that', 'this', 'will', 'more'].includes(w)
    );

    const wordFreq = {};
    words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
    const topWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([w]) => w);

    return [...new Set([...found, ...topWords])];
  }

  // Inject a subtle "Import Profile" button into the LinkedIn page
  function injectImportButton() {
    if (document.getElementById('rt-linkedin-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'rt-linkedin-btn';
    btn.textContent = '📚 Import to Research Tracker';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(37,99,235,0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: background 0.2s, transform 0.2s;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.background = '#1d4ed8'; btn.style.transform = 'scale(1.03)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#2563eb'; btn.style.transform = 'scale(1)'; });

    btn.addEventListener('click', async () => {
      btn.textContent = '⏳ Importing...';
      btn.disabled = true;

      const profile = await extractLinkedInProfile();
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
        const merged = { ...existing, ...profile };
        chrome.storage.sync.set({ userProfile: merged }, () => {
          btn.textContent = '✅ Profile Imported!';
          setTimeout(() => { btn.remove(); }, 2500);
        });
      });
    });

    document.body.appendChild(btn);
  }

  // Run after slight delay to let LinkedIn's SPA render
  setTimeout(injectImportButton, 2500);
})();
