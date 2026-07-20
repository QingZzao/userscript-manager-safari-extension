(function () {
  'use strict';

  const scope = 'userscript-manager-page';
  const pending = new Map();
  let requestId = 0;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.scope !== scope || message.type !== 'response') return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error));
    else entry.resolve(message.value);
  });

  function request(type, payload) {
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      window.postMessage({ scope, type, id, ...payload }, '*');
      setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error(type + ' timeout'));
      }, 15000);
    });
  }

  window.__USM_createGMApi = function createGMApi(script) {
    const resources = script.meta.resource || {};
    const values = { ...(script.values || {}) };
    const menu = new Map();
    const valueListeners = new Map();
    let nextMenuId = 0;
    let nextValueListenerId = 0;

    function addStyle(cssText) {
      const style = document.createElement('style');
      style.textContent = String(cssText || '');
      (document.head || document.documentElement).appendChild(style);
      return style;
    }

    function xmlhttpRequest(details) {
      request('gm:xmlhttpRequest', {
        scriptId: script.id,
        url: details.url,
        method: details.method || 'GET',
        headers: details.headers || {},
        body: details.data,
        credentials: details.anonymous ? 'omit' : 'include'
      }).then((response) => {
        const result = {
          readyState: 4,
          responseText: response.responseText,
          status: response.status,
          statusText: response.statusText,
          finalUrl: response.finalUrl,
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

    function addValueChangeListener(key, callback) {
      const id = ++nextValueListenerId;
      valueListeners.set(id, { key: String(key), callback });
      return id;
    }

    function removeValueChangeListener(id) {
      return valueListeners.delete(Number(id));
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

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const message = event.data;
      if (!message || message.scope !== scope || message.type !== 'gm:valueChanged') return;
      if (message.scriptId !== script.id) return;
      notifyValueListeners(message.key, message.oldValue, message.newValue, message.remote);
    });

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

    function renderMenu() {
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

    function registerMenuCommand(name, callback) {
      const id = ++nextMenuId;
      menu.set(id, { name: String(name || ''), callback });
      renderMenu();
      return id;
    }

    function unregisterMenuCommand(id) {
      const deleted = menu.delete(Number(id));
      renderMenu();
      return deleted;
    }

    function openInTab(url, options) {
      const opts = typeof options === 'object' && options ? options : {};
      request('gm:openInTab', { scriptId: script.id, url: String(url || ''), active: opts.active !== false });
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
      textarea.style.cssText = [
        'position:fixed',
        'left:-999999px',
        'top:-999999px',
        'opacity:0'
      ].join(';');
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
        version: '0.1.10'
      },
      addStyle,
      getValue: (key, fallback) => request('gm:getValue', { scriptId: script.id, key }).then((value) => typeof value === 'undefined' ? fallback : value),
      setValue: (key, value) => {
        const oldValue = values[key];
        values[key] = value;
        return request('gm:setValue', { scriptId: script.id, key, value }).then((result) => {
          notifyValueListeners(key, oldValue, value, false);
          return result;
        });
      },
      deleteValue: (key) => {
        delete values[key];
        return request('gm:deleteValue', { scriptId: script.id, key });
      },
      listValues: () => request('gm:listValues', { scriptId: script.id }),
      xmlHttpRequest: xmlhttpRequest,
      getResourceUrl: getResourceURL,
      getResourceURL,
      getResourceText: (name) => request('gm:getResourceText', { scriptId: script.id, name, url: resources[name] }),
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
        request('gm:setValue', { scriptId: script.id, key, value }).then(() => {
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
  };
})();
