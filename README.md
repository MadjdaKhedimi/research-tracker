# Research Tracker

A Chrome extension for researchers to save papers, track submission deadlines, and discover relevant journals and conferences.

---

## What's New in v2.3.1

**Library**
- Reading status on each paper: To Read, Reading, or Done
- Star ratings from 1 to 5
- Copy citation in APA, MLA, or BibTeX format with one click

**Deadlines**
- Tag each deadline as Conference, Journal, Workshop, or Other
- Color-coded urgency: red when under 7 days, orange under 30, yellow under 60, green otherwise
- Type a conference or journal name and get live suggestions from DBLP and OpenAlex
- Submission deadlines fetched from WikiCFP automatically, only future dates shown
- Every deadline card shows a reminder to verify the date on the official site
- Track Deadline button on every Discover venue card

**Discover**
- Recommendations based on your imported profiles and saved papers
- All API calls run in parallel so results load faster
- Relevance score based on how many of your research topics a venue covers

**Profile**
- Import from LinkedIn, Google Scholar, and ResearchGate at the same time
- All three sources merge into one profile
- Import buttons always visible so you can add or update sources anytime
- After first import, each button goes directly to your saved profile page
- Remove individual imported sources with one click
- Remove individual keywords and interests from the profile card
- Only meaningful research domain terms are stored and shown as keywords

**Content scripts**
- Close button on the import bar across LinkedIn, Google Scholar, and ResearchGate
- Profile extraction uses page text instead of DOM class selectors, so it works even when sites redesign

---

## Features

**Library** -- Save papers from arXiv, PubMed, IEEE, Nature, Springer, Wiley, PLOS, MDPI, ScienceDirect, and Science. Tag reading status, rate papers, and copy citations.

**Discover** -- Personalized journal and conference recommendations based on your research profile and saved papers. Pulls live data from OpenAlex and DBLP.

**Deadlines** -- Track submission deadlines with type tags and urgency colors. Search for venues and get deadlines auto-filled from WikiCFP.

**Profile** -- Import from LinkedIn, Google Scholar, and ResearchGate. All sources merge together. Add manual interests anytime to improve recommendations.

---

## Supported Publishers

arXiv, PubMed, IEEE Xplore, Nature, Science, Springer, Wiley, PLOS, MDPI, ScienceDirect

---

## Privacy

All data is stored locally in Chrome sync storage. No data is sent to any external server owned by this extension. See privacy-policy.html for details.
