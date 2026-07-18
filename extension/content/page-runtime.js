(function () {
  'use strict';

  let currentUrl = location.href;

  function emitUrlChange(oldUrl, newUrl) {
    const event = new CustomEvent('urlchange', {
      detail: { oldURL: oldUrl, newURL: newUrl },
      bubbles: false,
      cancelable: false
    });
    window.dispatchEvent(event);
    if (typeof window.onurlchange === 'function') {
      try {
        window.onurlchange(event);
      } catch (error) {
        console.error('[UserScript Manager] window.onurlchange failed', error);
      }
    }
  }

  function notifyUrlChange() {
    const nextUrl = location.href;
    if (nextUrl === currentUrl) return;
    const oldUrl = currentUrl;
    currentUrl = nextUrl;
    setTimeout(() => emitUrlChange(oldUrl, nextUrl), 0);
  }

  ['pushState', 'replaceState'].forEach((method) => {
    const original = history[method];
    if (typeof original !== 'function') return;
    history[method] = function () {
      const result = original.apply(this, arguments);
      notifyUrlChange();
      return result;
    };
  });

  window.addEventListener('popstate', notifyUrlChange);
  window.addEventListener('hashchange', notifyUrlChange);

  function injectInlineScript(source, sourceUrl) {
    const node = document.createElement('script');
    node.textContent = String(source || '') + '\n//# sourceURL=' + sourceUrl;
    (document.head || document.documentElement).appendChild(node);
    node.remove();
  }

  function reportScriptError(script, detail) {
    window.postMessage({
      scope: 'userscript-manager-page',
      type: 'logs:add',
      scriptId: script.id,
      scriptName: script.meta.name || script.id,
      level: 'error',
      url: location.href,
      message: detail.message,
      stack: detail.stack
    }, '*');
  }

  async function runScript(script) {
    const api = window.__USM_createGMApi(script);
    const names = Object.keys(api);
    const values = names.map((name) => api[name]);
    try {
      delete window.__USM_LAST_ERROR;
      delete document.documentElement.dataset.userscriptManagerError;
      (script.requireSources || []).forEach((requirement) => {
        const requireName = requirement.url || script.id;
        injectInlineScript(requirement.source, 'userscript-manager-require://' + encodeURIComponent(requireName));
      });
      const fn = new Function(...names, script.source + '\n//# sourceURL=userscript-manager://' + encodeURIComponent(script.meta.name || script.id));
      const result = fn(...values);
      if (result && typeof result.then === 'function') await result;
      document.documentElement.dataset.userscriptManagerLoaded = 'true';
    } catch (error) {
      const detail = {
        script: script.meta.name || script.id,
        message: String(error && error.message ? error.message : error),
        stack: String(error && error.stack ? error.stack : '')
      };
      window.__USM_LAST_ERROR = detail;
      document.documentElement.dataset.userscriptManagerError = detail.message;
      reportScriptError(script, detail);
      console.error('[UserScript Manager] script failed:', script.meta.name, error);
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.scope !== 'userscript-manager-runtime' || message.type !== 'run') return;
    runScript(message.script);
  });
})();
