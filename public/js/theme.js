function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  const toggleBtnIcon = document.querySelector('.theme-toggle-btn__icon');
  if (toggleBtnIcon) {
    toggleBtnIcon.textContent = theme === 'light' ? '☀️' : '🌙';
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    const toggleBtn = document.getElementById('theme-toggle');

    const currentTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(currentTheme);

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        const activeTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
        const newTheme = activeTheme === 'light' ? 'dark' : 'light';

        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
      });
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { applyTheme };
}
