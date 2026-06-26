// Applies the saved theme as early as possible to avoid a flash of the
// wrong theme when the popup opens. Loaded in <head> before the body.
//
// Synchronous step: immediately honor the OS preference (matchMedia is
// sync) so the very first paint is close to correct. Async step: once
// chrome.storage resolves, apply the user's explicit choice if they made
// one. CSP in MV3 forbids inline scripts, so this lives in its own file.

(function () {
  function systemPrefersDark() {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function apply(theme) {
    // theme is the resolved value: "light" or "dark"
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // First paint: assume "auto" and follow the OS until storage tells us otherwise.
  apply(systemPrefersDark() ? 'dark' : 'light');

  // Then read the saved choice and correct if needed.
  try {
    chrome.storage.sync.get(['themeChoice'], function (result) {
      const choice = result.themeChoice || 'auto';
      if (choice === 'auto') {
        apply(systemPrefersDark() ? 'dark' : 'light');
      } else {
        apply(choice);
      }
    });
  } catch (e) {
    // chrome.storage unavailable for any reason: leave OS-based default in place.
  }
})();
