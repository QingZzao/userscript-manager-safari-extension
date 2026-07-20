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

  function createContentGMApi(script) {
    const resources = script.meta.resource || {};
    const values = { ...(script.values || {}) };
    const valueListeners = new Map();
    let nextValueListenerId = 0;
    let nextMenuId = 0;

    function addStyle(cssText) {
      const style = document.createElement('style');
      style.textContent = String(cssText || '');
      (document.head || document.documentElement).appendChild(style);
      return style;
    }

    function xmlhttpRequest(details) {
      sendMessage({
        type: 'net:fetchText',
        url: details.url,
        method: details.method || 'GET',
        headers: details.headers || {},
        body: details.data,
        credentials: details.anonymous ? 'omit' : 'include'
      }).then((response) => {
        const value = response && response.value ? response.value : {};
        const result = {
          readyState: 4,
          responseText: value.responseText,
          status: value.status,
          statusText: value.statusText,
          finalUrl: value.finalUrl,
          responseHeaders: ''
        };
        if (typeof details.onload === 'function') details.onload(result);
      }).catch((error) => {
        if (typeof details.onerror === 'function') details.onerror(error);
      });
    }

    function getResourceURL(name) {
      return resources[name] || '';
    }

    function notifyValueListeners(key, oldValue, newValue, remote) {
      values[key] = newValue;
      valueListeners.forEach((entry) => {
        if (entry.key !== key || typeof entry.callback !== 'function') return;
        try {
          entry.callback(key, oldValue, newValue, !!remote);
        } catch (error) {
          console.error('[UserScript Manager] value change listener failed:', error);
        }
      });
    }

    function addValueChangeListener(key, callback) {
      const id = ++nextValueListenerId;
      valueListeners.set(id, { key: String(key), callback });
      return id;
    }

    function removeValueChangeListener(id) {
      return valueListeners.delete(Number(id));
    }

    function ensureMenuRoot() {
      let root = document.querySelector('#usm-menu-root');
      if (root) return root;
      addStyle(`
        #usm-menu-root {
          position: fixed;
          right: 16px;
          top: 72px;
          z-index: 2147483647;
          font: 13px -apple-system, BlinkMacSystemFont, sans-serif;
        }
        #usm-menu-root[hidden] {
          display: none !important;
        }
        #usm-menu-root > button {
          border: 0;
          border-radius: 999px;
          padding: 7px 11px;
          color: #fff;
          background: #1769e0;
          box-shadow: 0 6px 18px rgba(0,0,0,.22);
          cursor: pointer;
        }
        #usm-menu-root[data-open="false"] .usm-menu-panel {
          display: none;
        }
        .usm-menu-panel {
          width: 260px;
          max-height: 420px;
          overflow: auto;
          margin-top: 8px;
          padding: 8px;
          border: 1px solid rgba(0,0,0,.12);
          border-radius: 8px;
          background: #fff;
          color: #202124;
          box-shadow: 0 12px 34px rgba(0,0,0,.24);
        }
        .usm-menu-script {
          margin: 6px 0 4px;
          color: #61656b;
          font-size: 12px;
          font-weight: 700;
        }
        .usm-menu-item {
          display: block;
          width: 100%;
          margin: 0;
          padding: 7px 8px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }
        .usm-menu-item:hover {
          background: rgba(23,105,224,.12);
        }
      `);
      root = document.createElement('div');
      root.id = 'usm-menu-root';
      root.dataset.open = 'false';
      root.hidden = true;
      root.innerHTML = '<button type="button" title="打开用户脚本菜单">USM</button><div class="usm-menu-panel"></div>';
      root.querySelector('button').addEventListener('click', () => {
        root.dataset.open = root.dataset.open === 'true' ? 'false' : 'true';
      });
      document.documentElement.appendChild(root);
      return root;
    }

    function renderMenu(menu) {
      const root = ensureMenuRoot();
      const panel = root.querySelector('.usm-menu-panel');
      const entries = Array.from(menu.entries());
      const oldGroup = panel.querySelector('[data-script-id="' + CSS.escape(script.id) + '"]');
      if (oldGroup) oldGroup.remove();
      if (entries.length === 0) {
        root.hidden = panel.children.length === 0;
        if (root.hidden) root.dataset.open = 'false';
        return;
      }
      const group = document.createElement('div');
      group.dataset.scriptId = script.id;
      const title = document.createElement('div');
      title.className = 'usm-menu-script';
      title.textContent = script.meta.name || script.id;
      group.appendChild(title);
      entries.forEach(([id, item]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'usm-menu-item';
        button.textContent = item.name;
        button.addEventListener('click', () => item.callback());
        group.appendChild(button);
      });
      panel.appendChild(group);
      root.hidden = false;
    }

    const menu = new Map();

    function registerMenuCommand(name, callback) {
      const id = ++nextMenuId;
      menu.set(id, { name: String(name || ''), callback });
      renderMenu(menu);
      return id;
    }

    function unregisterMenuCommand(id) {
      const deleted = menu.delete(Number(id));
      renderMenu(menu);
      return deleted;
    }

    function openInTab(url, options) {
      const opts = typeof options === 'object' && options ? options : {};
      sendMessage({ type: 'tabs:open', url: String(url || ''), active: opts.active !== false });
      return { close: function () {} };
    }

    function notification(details, title, image, onclick) {
      const config = typeof details === 'object' && details ? details : { text: String(details || ''), title, image, onclick };
      const box = document.createElement('div');
      box.textContent = config.text || config.title || '';
      box.style.cssText = [
        'position:fixed',
        'right:16px',
        'bottom:16px',
        'z-index:2147483647',
        'max-width:320px',
        'padding:11px 13px',
        'border-radius:8px',
        'background:#202124',
        'color:white',
        'font:13px -apple-system,BlinkMacSystemFont,sans-serif',
        'box-shadow:0 8px 24px rgba(0,0,0,.28)',
        'cursor:pointer'
      ].join(';');
      box.addEventListener('click', () => {
        if (typeof config.onclick === 'function') config.onclick();
        if (typeof onclick === 'function') onclick();
        box.remove();
      });
      document.documentElement.appendChild(box);
      setTimeout(() => box.remove(), Number(config.timeout || 4000));
    }

    function setClipboard(text) {
      const value = String(text || '');
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        const result = navigator.clipboard.writeText(value);
        if (result && typeof result.catch === 'function') {
          result.catch(() => fallbackSetClipboard(value));
        }
        return result;
      }
      fallbackSetClipboard(value);
      return undefined;
    }

    function fallbackSetClipboard(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.cssText = 'position:fixed;left:-999999px;top:-999999px;opacity:0';
      document.documentElement.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    const gm = {
      info: {
        script: {
          name: script.meta.name,
          version: script.meta.version,
          description: script.meta.description,
          author: script.meta.author
        },
        scriptHandler: 'UserScript Manager Safari',
        version: '0.1.11'
      },
      addStyle,
      getValue: (key, fallback) => sendMessage({ type: 'gm:getValue', scriptId: script.id, key }).then((response) => {
        const value = response && response.value;
        return typeof value === 'undefined' ? fallback : value;
      }),
      setValue: (key, value) => {
        const oldValue = values[key];
        values[key] = value;
        return sendMessage({ type: 'gm:setValue', scriptId: script.id, key, value }).then((result) => {
          notifyValueListeners(key, oldValue, value, false);
          return result;
        });
      },
      deleteValue: (key) => {
        delete values[key];
        return sendMessage({ type: 'gm:deleteValue', scriptId: script.id, key });
      },
      listValues: () => sendMessage({ type: 'gm:listValues', scriptId: script.id }),
      xmlHttpRequest: xmlhttpRequest,
      getResourceUrl: getResourceURL,
      getResourceURL,
      getResourceText: (name) => sendMessage({ type: 'gm:getResourceText', scriptId: script.id, name, url: resources[name] }).then((response) => response && response.value),
      registerMenuCommand,
      unregisterMenuCommand,
      addValueChangeListener,
      removeValueChangeListener,
      openInTab,
      notification,
      setClipboard
    };

    return {
      unsafeWindow: window,
      GM_info: gm.info,
      GM_addStyle: addStyle,
      GM_getValue: (key, fallback) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback,
      GM_setValue: (key, value) => {
        const oldValue = values[key];
        values[key] = value;
        sendMessage({ type: 'gm:setValue', scriptId: script.id, key, value }).then(() => {
          notifyValueListeners(key, oldValue, value, false);
        });
        return value;
      },
      GM_deleteValue: gm.deleteValue,
      GM_listValues: () => Object.keys(values),
      GM_xmlhttpRequest: xmlhttpRequest,
      GM_getResourceURL: getResourceURL,
      GM_getResourceUrl: getResourceURL,
      GM_getResourceText: gm.getResourceText,
      GM_registerMenuCommand: registerMenuCommand,
      GM_unregisterMenuCommand: unregisterMenuCommand,
      GM_addValueChangeListener: addValueChangeListener,
      GM_removeValueChangeListener: removeValueChangeListener,
      GM_openInTab: openInTab,
      GM_notification: notification,
      GM_setClipboard: setClipboard,
      GM: gm
    };
  }

  function reportScriptError(script, error) {
    sendMessage({
      type: 'logs:add',
      scriptId: script.id,
      scriptName: script.meta.name || script.id,
      level: 'error',
      url: location.href,
      message: String(error && error.message ? error.message : error),
      stack: String(error && error.stack ? error.stack : '')
    }).catch(() => {});
  }

  async function runContentScript(script) {
    const api = createContentGMApi(script);
    const names = Object.keys(api);
    const values = names.map((name) => api[name]);
    try {
      names.forEach((name) => {
        window[name] = api[name];
      });
      (script.requireSources || []).forEach((requirement) => {
        const requireApi = createContentGMApi({ ...script, source: requirement.source });
        const requireNames = Object.keys(requireApi);
        const requireValues = requireNames.map((name) => requireApi[name]);
        requireNames.forEach((name) => {
          window[name] = requireApi[name];
        });
        const requireFn = new Function(...requireNames, requirement.source + '\n//# sourceURL=userscript-manager-content-require://' + encodeURIComponent(requirement.url || script.id));
        requireFn(...requireValues);
      });
      const fn = new Function(...names, script.source + '\n//# sourceURL=userscript-manager-content://' + encodeURIComponent(script.meta.name || script.id));
      const result = fn(...values);
      if (result && typeof result.then === 'function') await result;
      document.documentElement.dataset.userscriptManagerLoaded = 'true';
    } catch (error) {
      document.documentElement.dataset.userscriptManagerError = String(error && error.message ? error.message : error);
      reportScriptError(script, error);
      console.error('[UserScript Manager] content-world script failed:', script.meta.name, error);
    }
  }

  function prefersContentWorld(script) {
    const sandbox = String(script.meta && script.meta.sandbox || '').toLowerCase();
    return sandbox === 'javascript' || sandbox === 'js';
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
        if (prefersContentWorld(script)) {
          runContentScript(script);
        } else {
          window.postMessage({ scope: 'userscript-manager-runtime', type: 'run', script }, '*');
        }
      });
    });
  }

  main().catch((error) => console.error('[UserScript Manager] runner failed', error));
})();
