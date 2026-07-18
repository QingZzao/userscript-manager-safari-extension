const api = globalThis.browser || globalThis.chrome;
const SCRIPT_STORE_KEY = 'usm:scripts';
const RESOURCE_PREFIX = 'usm:resource:';
const VALUE_PREFIX = 'usm:value:';

function storageGet(key) {
  const result = api.storage.local.get(key);
  if (result && typeof result.then === 'function') {
    return result.then((items) => items ? items[key] : undefined);
  }
  return new Promise((resolve) => api.storage.local.get(key, (items) => resolve(items ? items[key] : undefined)));
}

function storageSet(items) {
  const result = api.storage.local.set(items);
  if (result && typeof result.then === 'function') return result;
  return new Promise((resolve) => api.storage.local.set(items, resolve));
}

function storageRemove(keys) {
  const result = api.storage.local.remove(keys);
  if (result && typeof result.then === 'function') return result;
  return new Promise((resolve) => api.storage.local.remove(keys, resolve));
}

async function getScripts() {
  return Array.isArray(await storageGet(SCRIPT_STORE_KEY)) ? await storageGet(SCRIPT_STORE_KEY) : [];
}

async function saveScripts(scripts) {
  await storageSet({ [SCRIPT_STORE_KEY]: scripts });
}

function scriptValueKey(scriptId, key) {
  return VALUE_PREFIX + scriptId + ':' + key;
}

function resourceKey(scriptId, name) {
  return RESOURCE_PREFIX + scriptId + ':' + name;
}

async function handleRuntimeMessage(message) {
  if (!message || message.scope !== 'userscript-manager') return undefined;

  if (message.type === 'scripts:list') {
    return { ok: true, scripts: await getScripts() };
  }

  if (message.type === 'scripts:save') {
    const scripts = await getScripts();
    const incoming = message.script;
    const next = scripts.filter((script) => script.id !== incoming.id);
    next.unshift(incoming);
    await saveScripts(next);
    return { ok: true, scripts: next };
  }

  if (message.type === 'scripts:update') {
    const scripts = await getScripts();
    const next = scripts.map((script) => script.id === message.id ? { ...script, ...message.patch, updatedAt: Date.now() } : script);
    await saveScripts(next);
    return { ok: true, scripts: next };
  }

  if (message.type === 'scripts:delete') {
    const scripts = await getScripts();
    await saveScripts(scripts.filter((script) => script.id !== message.id));
    return { ok: true };
  }

  if (message.type === 'net:fetchText') {
    const response = await fetch(message.url, {
      method: message.method || 'GET',
      headers: message.headers || {},
      body: message.body,
      credentials: message.credentials || 'omit'
    });
    return {
      ok: true,
      value: {
        responseText: await response.text(),
        status: response.status,
        statusText: response.statusText,
        finalUrl: response.url
      }
    };
  }

  if (message.type === 'tabs:open') {
    if (!api.tabs || !api.tabs.create) {
      return { ok: false, error: 'tabs.create is not available' };
    }
    const createProperties = {
      url: message.url,
      active: message.active !== false
    };
    const created = api.tabs.create(createProperties);
    const tab = created && typeof created.then === 'function' ? await created : undefined;
    return { ok: true, value: tab || null };
  }

  if (message.type === 'gm:getValue') {
    return { ok: true, value: await storageGet(scriptValueKey(message.scriptId, message.key)) };
  }

  if (message.type === 'gm:setValue') {
    await storageSet({ [scriptValueKey(message.scriptId, message.key)]: message.value });
    return { ok: true };
  }

  if (message.type === 'gm:deleteValue') {
    await storageRemove(scriptValueKey(message.scriptId, message.key));
    return { ok: true };
  }

  if (message.type === 'gm:listValues') {
    const all = await new Promise((resolve) => api.storage.local.get(null, resolve));
    const prefix = VALUE_PREFIX + message.scriptId + ':';
    return { ok: true, value: Object.keys(all || {}).filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length)) };
  }

  if (message.type === 'gm:getAllValues') {
    const all = await new Promise((resolve) => api.storage.local.get(null, resolve));
    const prefix = VALUE_PREFIX + message.scriptId + ':';
    const values = {};
    Object.entries(all || {}).forEach(([key, value]) => {
      if (key.startsWith(prefix)) values[key.slice(prefix.length)] = value;
    });
    return { ok: true, value: values };
  }

  if (message.type === 'gm:getResourceText') {
    const cached = await storageGet(resourceKey(message.scriptId, message.name));
    if (typeof cached === 'string') return { ok: true, value: cached };
    const response = await fetch(message.url, { credentials: 'omit' });
    const text = await response.text();
    await storageSet({ [resourceKey(message.scriptId, message.name)]: text });
    return { ok: true, value: text };
  }

  return { ok: false, error: 'Unknown message type: ' + message.type };
}

function broadcastValueChange(scriptId, key, oldValue, newValue) {
  if (!api.tabs || !api.tabs.query || !api.tabs.sendMessage) return;
  const queryResult = api.tabs.query({});
  const send = (tabs) => {
    (tabs || []).forEach((tab) => {
      if (!tab || typeof tab.id === 'undefined') return;
      try {
        api.tabs.sendMessage(tab.id, {
          scope: 'userscript-manager-content',
          type: 'gm:valueChanged',
          scriptId,
          key,
          oldValue,
          newValue,
          remote: true
        });
      } catch (error) {
        // Some tabs cannot receive content script messages.
      }
    });
  };
  if (queryResult && typeof queryResult.then === 'function') queryResult.then(send);
  else api.tabs.query({}, send);
}

api.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  Object.entries(changes || {}).forEach(([key, change]) => {
    if (!key.startsWith(VALUE_PREFIX)) return;
    const rest = key.slice(VALUE_PREFIX.length);
    const splitAt = rest.indexOf(':');
    if (splitAt === -1) return;
    broadcastValueChange(rest.slice(0, splitAt), rest.slice(splitAt + 1), change.oldValue, change.newValue);
  });
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleRuntimeMessage(message).then(sendResponse).catch((error) => {
    sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
  });
  return true;
});
