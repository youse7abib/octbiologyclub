/* ============================================================
   10. THEME TOGGLE – Dark / Light mode
   ============================================================ */
(function () {
  var STORAGE_KEY = 'bio-club-theme';
  var body = document.body;

  var btn        = document.getElementById('themeToggle');
  var btnMobile  = document.getElementById('themeToggleMobile');

  // Moon SVG path (dark mode icon)
  var moonPath = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  // Sun SVG path (light mode icon)
  var sunPath  = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';

  function setIcons(isDark) {
    var icon = document.getElementById('themeIcon');
    var iconM = document.getElementById('themeIconMobile');
    if (icon)  icon.innerHTML  = isDark ? sunPath  : moonPath;
    if (iconM) iconM.innerHTML = isDark ? sunPath  : moonPath;
  }

  function setLabels(isDark) {
    var label  = document.getElementById('themeLabel');
    var labelM = document.getElementById('themeLabelMobile');
    if (label)  label.textContent  = isDark ? 'Light' : 'Dark';
    if (labelM) labelM.textContent = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }

  function applyTheme(isDark) {
    if (isDark) {
      body.classList.add('dark-mode');
    } else {
      body.classList.remove('dark-mode');
    }
    setIcons(isDark);
    setLabels(isDark);
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
  }

  // Load saved preference
  var saved = localStorage.getItem(STORAGE_KEY);
  applyTheme(saved === 'dark');

  // Button click handlers
  if (btn)       btn.addEventListener('click',       function () { applyTheme(!body.classList.contains('dark-mode')); });
  if (btnMobile) btnMobile.addEventListener('click', function () { applyTheme(!body.classList.contains('dark-mode')); });
})();