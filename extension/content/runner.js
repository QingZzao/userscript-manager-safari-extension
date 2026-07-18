(function () {
  'use strict';

  const api = window.browser || window.chrome;
  const pageScope = 'userscript-manager-page';

  function injectInline(source) {
    const script = document.createElement('script');
    script.textContent = source;
    (document.documentElement || document.head).appendChild(script);
    script.remove();
  }

  function installEarlyAcBaiduBridge() {
    if (!/(^|\.)((ac-baidu\.)?90dao|tujidu)\.com$/.test(location.hostname) && location.hostname !== 'localhost') return;
    injectInline(`
      (function () {
        if (window.AC_GM_Interface) return;
        var bridge = {};
        function waitForRealInterface() {
          return new Promise(function (resolve, reject) {
            var started = Date.now();
            var timer = setInterval(function () {
              var real = window.AC_GM_Interface;
              if (real && real !== bridge && typeof real.get === 'function') {
                clearInterval(timer);
                resolve(real);
              } else if (Date.now() - started > 10000) {
                clearInterval(timer);
                reject(new Error('AC_GM_Interface timeout'));
              }
            }, 10);
          });
        }
        ['get', 'save', 'change'].forEach(function (name) {
          bridge[name] = function () {
            var args = arguments;
            return waitForRealInterface().then(function (real) {
              return real[name].apply(real, args);
            });
          };
        });
        window.AC_GM_Interface = bridge;
      })();
    `);
  }

  installEarlyAcBaiduBridge();

  function installGoogleReadabilityFix() {
    if (!/(^|\.)google\./.test(location.hostname) || location.pathname !== '/search') return;
    const style = document.createElement('style');
    style.id = 'usm-ac-baidu-google-readability';
    style.textContent = `
      html body {
        background: #f8fafc !important;
        color: #202124 !important;
      }
      #search,
      #rso,
      #rcnt,
      #center_col {
        color: #202124 !important;
      }
      #search [style],
      #rso [style] {
        text-shadow: none !important;
      }
      #search .g,
      #search .MjjYud,
      #search .kvH3mc,
      #rso > div,
      div[data-sokoban-container] {
        color: #202124 !important;
      }
      #search .g,
      #search .MjjYud,
      #rso > div {
        background: rgba(255,255,255,.96) !important;
        border-color: rgba(32,33,36,.16) !important;
      }
      #search h3,
      #search a h3,
      #rso h3 {
        color: #1a5fd0 !important;
      }
      #search a,
      #rso a {
        color: #1a5fd0 !important;
      }
      #search cite,
      #search cite *,
      #search .qLRx3b,
      #search .NJjxre,
      #search .TbwUpd,
      #rso cite,
      #rso cite * {
        color: #3c4043 !important;
      }
      #search .VwiC3b,
      #search .IsZvec,
      #search .yXK7lf,
      #search .MUxGbd,
      #search .lyLwlc,
      #search span,
      #search div,
      #rso .VwiC3b,
      #rso .IsZvec,
      #rso .MUxGbd,
      #rso span,
      #rso div {
        color: #3c4043;
      }
      #search em,
      #rso em {
        color: #d93025 !important;
        font-weight: 700 !important;
      }
      #rhs,
      #rhs * {
        color: #3c4043 !important;
      }
      #rhs h2,
      #rhs h3,
      #rhs a {
        color: #1a5fd0 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  installGoogleReadabilityFix();

  function sendMessage(message) {
    const result = api.runtime.sendMessage({ ...message, scope: 'userscript-manager' });
    if (result && typeof result.then === 'function') return result;
    return new Promise((resolve) => api.runtime.sendMessage({ ...message, scope: 'userscript-manager' }, resolve));
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.scope !== pageScope) return;
    try {
      let response;
      if (message.type === 'gm:xmlhttpRequest') {
        response = await sendMessage({ type: 'net:fetchText', url: message.url, method: message.method, headers: message.headers, body: message.body, credentials: message.credentials });
      } else if (message.type === 'gm:openInTab') {
        response = await sendMessage({ type: 'tabs:open', url: message.url, active: message.active });
      } else {
        response = await sendMessage(message);
      }
      window.postMessage({ scope: pageScope, type: 'response', id: message.id, value: response && response.value }, '*');
    } catch (error) {
      window.postMessage({ scope: pageScope, type: 'response', id: message.id, error: String(error && error.message ? error.message : error) }, '*');
    }
  });

  api.runtime.onMessage.addListener((message) => {
    if (!message || message.scope !== 'userscript-manager-content' || message.type !== 'gm:valueChanged') return;
    window.postMessage({ scope: pageScope, type: 'gm:valueChanged', ...message }, '*');
  });

  function injectFile(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = api.runtime.getURL(path);
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error('load failed: ' + path));
      (document.documentElement || document.head).appendChild(script);
    });
  }

  function runAt(script) {
    return (script.meta && script.meta.runAt) || 'document-end';
  }

  function onReady(mode, callback) {
    if (mode === 'document-start') {
      callback();
    } else if (mode === 'document-idle') {
      window.addEventListener('load', () => setTimeout(callback, 1), { once: true });
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  async function main() {
    const response = await sendMessage({ type: 'scripts:list' });
    const scripts = ((response && response.scripts) || []).filter((script) => {
      return window.UserScriptMatcher.shouldRunScript(script, location.href);
    });
    if (scripts.length === 0) return;
    await injectFile('core/gm-page-api.js');
    await injectFile('content/page-runtime.js');
    await Promise.all(scripts.map(async (script) => {
      const values = await sendMessage({ type: 'gm:getAllValues', scriptId: script.id });
      script.values = values && values.value ? values.value : {};
    }));
    scripts.forEach((script) => {
      onReady(runAt(script), () => {
        window.postMessage({ scope: 'userscript-manager-runtime', type: 'run', script }, '*');
      });
    });
  }

  main().catch((error) => console.error('[UserScript Manager] runner failed', error));
})();
