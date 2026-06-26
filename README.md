# 📚 Research Tracker

> **Your second brain for academic research.** Save papers, track deadlines, and find the right journal to publish in, all without leaving your browser.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/research-tracker/noabcbnomflikmeopokbfiibbgiaafih)
[![Version](https://img.shields.io/badge/version-2.3.4-blue?style=for-the-badge)](https://chromewebstore.google.com/detail/research-tracker/noabcbnomflikmeopokbfiibbgiaafih)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20local-success?style=for-the-badge&logo=shieldsdotio)](https://madjdakhedimi.github.io/privacy-policy/)

<br/>

---

## 🎬 See It in Action

![Research Tracker demo](https://raw.githubusercontent.com/MadjdaKhedimi/research-tracker/main/assets/demo.gif)

<table>
  <tr>
    <td align="center"><b>📚 Library</b></td>
    <td align="center"><b>📡 Discover</b></td>
  </tr>
  <tr>
    <td><img src="assets/screenshot-library.png" width="280" alt="Library tab - saved papers with reading status, star ratings, and citation export"/></td>
    <td><img src="assets/screenshot-discover.jpg" width="280" alt="Discover tab - personalized journal and conference recommendations"/></td>
  </tr>
  <tr>
    <td align="center"><b>📅 Deadlines</b></td>
    <td align="center"><b>👤 Profile</b></td>
  </tr>
  <tr>
    <td><img src="assets/screenshot-deadlines.png" width="280" alt="Deadlines tab - add and track submission deadlines with urgency colors"/></td>
    <td><img src="assets/screenshot-profile.png" width="280" alt="Profile tab - imported from LinkedIn and Google Scholar with research interests"/></td>
  </tr>
</table>

---

## Why it exists

You're a few papers deep into a rabbit hole at midnight, your browser has 40 tabs open, a submission deadline is next Tuesday, and you've just realized the journal you were aiming for isn't the right fit. Research Tracker is built for exactly that moment. It quietly captures what you read, keeps your deadlines in view, and points you toward venues that actually match your work.

---

## What it does

**🗂️ Save papers as you read.** Open a paper on a supported publisher and a little "paper detected" prompt slides in. One click saves it to your library, with full-text search, notes, reading status, and star ratings. Copy a clean citation in APA, MLA, or BibTeX anytime. Author, title, year, and DOI are read straight from each page's citation metadata, so the citations come out right instead of guessed.

**📡 Find where to publish.** Tell it your research interests or import your academic profile, and the Discover tab queries [OpenAlex](https://openalex.org) to surface the journals and conferences most relevant to you. Each result shows real metrics: 2-year citedness, h-index, citation counts, quartile ranking, open-access status, and a live relevance score. The matching weighs keyword specificity, breadth, and venue quality, not just plain string search.

**📅 Never miss a deadline.** Add conference and journal deadlines in a couple of clicks, tag them, and watch them color-code by urgency as the date gets closer. Type a venue name and get live suggestions from DBLP and OpenAlex, with submission dates pulled from WikiCFP. Every card reminds you to confirm on the official site.

**👤 Import your profile once.** Visit your profile on LinkedIn, Google Scholar, or ResearchGate and click the floating import button. Your name, affiliation, and research interests are pulled in locally and merged across sources with deduplication. You can also add interests like `federated learning` or `CRISPR` by hand, and they're weighted in right away.

---

## 🔒 Privacy first

Every byte of your data stays in your browser.

| Data | Where it lives | Who can see it |
|---|---|---|
| Saved papers | `chrome.storage.sync` (your device) | Only you |
| Deadlines | `chrome.storage.sync` (your device) | Only you |
| Profile | `chrome.storage.sync` (your device) | Only you |
| Venue queries | Anonymous search terms | Public databases only |

No servers, no telemetry, no ads. The only outbound requests are anonymous keyword queries to public academic databases like `api.openalex.org` and `dblp.org`. No cookies, no tracking, no analytics.

See the [full privacy policy](https://madjdakhedimi.github.io/privacy-policy/).

---

## 🚀 Getting started

1. **Install** from the [Chrome Web Store](https://chromewebstore.google.com/detail/research-tracker/noabcbnomflikmeopokbfiibbgiaafih).
2. **Visit any paper** on a supported site. The save prompt appears on its own.
3. **Build your profile** (optional but worth it): import from Google Scholar, LinkedIn, or ResearchGate, or just type a few interests under **Profile → Manual Interests**.
4. **Open Discover** for live journal and conference recommendations.
5. **Add deadlines** so nothing slips past you.

Running from source: clone the repo, open `chrome://extensions`, turn on Developer mode, and choose **Load unpacked**.

---

## 🌐 Where it works

**Paper detection:** arXiv, PubMed, Nature, Science, IEEE Xplore, Springer, Wiley, PLOS, MDPI, and ScienceDirect.

**Profile import:** LinkedIn, Google Scholar, and ResearchGate.

**Venue data:** OpenAlex, DBLP, and WikiCFP (all anonymous, read-only).

---

## 🛠️ Under the hood

- **Manifest V3**, pure vanilla JavaScript, no runtime dependencies.
- **One permission only:** `storage`.
- **Citation-metadata extraction:** reads standard Highwire citation tags, so paper details stay accurate across publishers and survive site redesigns.
- **Patient detection:** retries at 500ms, 1500ms, 3000ms, and 5000ms to handle slow-loading pages and single-page-app publishers.
- **Smart profile merging:** combines and deduplicates interests across all three import sources.
- **XSS-safe rendering:** all user and API content is escaped before it touches the DOM.
- **Graceful degradation:** if a database is unreachable, the rest of the extension keeps working.

---

## 🗺️ Roadmap

- [ ] Export library to BibTeX, CSV, or Zotero
- [ ] Browser notifications for approaching deadlines
- [ ] arXiv category filtering in recommendations
- [ ] Bulk import from `.bib` files
- [ ] Shareable reading lists
- [ ] Dark mode

Have an idea? Open an issue or say hi on [LinkedIn](https://www.linkedin.com/in/madjda-khedimi-336154162/).

---

## 👩‍💻 Author

**Madjda Khedimi** · [LinkedIn](https://www.linkedin.com/in/madjda-khedimi-336154162/) · [Chrome Web Store](https://chromewebstore.google.com/detail/research-tracker/noabcbnomflikmeopokbfiibbgiaafih)

## 📄 License

MIT. Do whatever you want, just keep the attribution.

---

<div align="center">

**If Research Tracker saves you time, a ⭐ review on the [Chrome Web Store](https://chromewebstore.google.com/detail/research-tracker/noabcbnomflikmeopokbfiibbgiaafih) helps other researchers find it.**

</div>
