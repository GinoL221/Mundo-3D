const { applyTheme } = require('../../public/js/theme');

describe('Theme Toggle Functionality', () => {
  let mockHtml;
  let mockButtonText;

  beforeEach(() => {
    mockHtml = {
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      getAttribute(name) {
        return this.attributes[name];
      },
      removeAttribute(name) {
        delete this.attributes[name];
      },
    };

    mockButtonText = {
      textContent: '',
    };

    global.document = {
      documentElement: mockHtml,
      querySelector(selector) {
        if (selector === '.theme-toggle-btn__icon') {
          return mockButtonText;
        }
        return null;
      },
    };

    const store = {};
    global.localStorage = {
      getItem(key) {
        return store[key] || null;
      },
      setItem(key, value) {
        store[key] = value.toString();
      },
      clear() {
        for (let k in store) delete store[k];
      },
    };
  });

  afterEach(() => {
    delete global.document;
    delete global.localStorage;
  });

  test('should apply light theme correctly to documentElement and update button icon', () => {
    applyTheme('light');
    expect(mockHtml.getAttribute('data-theme')).toBe('light');
    expect(mockButtonText.textContent).toBe('☀️');
  });

  test('should apply dark theme correctly to documentElement and update button icon', () => {
    applyTheme('dark');
    expect(mockHtml.getAttribute('data-theme')).toBe('dark');
    expect(mockButtonText.textContent).toBe('🌙');
  });

  test('should bind click listener on DOMContentLoaded and toggle theme when clicked', () => {
    jest.resetModules();

    let clickCallback;
    const mockButton = {
      addEventListener(event, callback) {
        if (event === 'click') {
          clickCallback = callback;
        }
      },
    };

    let domContentLoadedCallback;
    global.document = {
      documentElement: mockHtml,
      addEventListener(event, callback) {
        if (event === 'DOMContentLoaded') {
          domContentLoadedCallback = callback;
        }
      },
      getElementById(id) {
        if (id === 'theme-toggle') {
          return mockButton;
        }
        return null;
      },
      querySelector(selector) {
        if (selector === '.theme-toggle-btn__icon') {
          return mockButtonText;
        }
        return null;
      },
    };

    // Requiring registers the listener
    require('../../public/js/theme');

    // Simulate DOMContentLoaded
    expect(domContentLoadedCallback).toBeDefined();
    domContentLoadedCallback();

    // Verify click event bound
    expect(clickCallback).toBeDefined();

    // Verify clicking toggles theme light <-> dark
    clickCallback();
    expect(mockHtml.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');

    clickCallback();
    expect(mockHtml.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
