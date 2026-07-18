const api = globalThis.browser || globalThis.chrome;
const statusEl = document.querySelector('#status');
const listEl = document.querySelector('#scriptList');
const detailEl = document.querySelector('#scriptDetail');
const sourceEl = document.querySelector('#scriptSource');
const urlEl = document.querySelector('#scriptUrl');
let scriptsCache = [];
let selectedScriptId = '';
let selectedTab = 'overview';

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#d33c32' : '#1769e0';
}

function sendMessage(message) {
  const result = api.runtime.sendMessage({ scope: 'userscript-manager', ...message });
  if (result && typeof result.then === 'function') return result;
  return new Promise((resolve) => api.runtime.sendMessage({ scope: 'userscript-manager', ...message }, resolve));
}

async function fetchText(url) {
  const response = await sendMessage({ type: 'net:fetchText', url, credentials: 'omit' });
  if (!response || !response.ok) throw new Error(response && response.error ? response.error : '下载失败');
  return response.value.responseText;
}

function buildScript(source, sourceUrl = '') {
  const meta = UserScriptMetadata.parseUserscriptMetadata(source);
  const id = UserScriptMetadata.createScriptId(meta, source);
  return {
    id,
    source,
    sourceUrl,
    meta,
    enabled: true,
    installedAt: Date.now(),
    updatedAt: Date.now()
  };
}

async function hydrateRequirements(script) {
  const requirements = (script.meta && script.meta.require) || [];
  script.requireSources = [];
  for (let index = 0; index < requirements.length; index += 1) {
    const url = requirements[index];
    setStatus('正在缓存依赖 ' + (index + 1) + '/' + requirements.length + '...');
    const response = await sendMessage({ type: 'net:fetchText', url, credentials: 'omit' });
    if (!response || !response.ok) throw new Error('依赖下载失败：' + url);
    script.requireSources.push({
      url,
      source: response.value.responseText
    });
  }
  return script;
}

async function installFromSource(source, sourceUrl = '') {
  if (!source.trim()) throw new Error('脚本源码为空');
  const script = buildScript(source, sourceUrl);
  await hydrateRequirements(script);
  await sendMessage({ type: 'scripts:save', script });
  sourceEl.value = '';
  urlEl.value = '';
  setStatus('已安装：' + script.meta.name);
  await render();
}

function metaLine(script) {
  const meta = script.meta || {};
  return [
    meta.version ? '版本 ' + meta.version : '',
    meta.author ? '作者 ' + meta.author : '',
    script.enabled === false ? '已停用' : '已启用'
  ].filter(Boolean).join(' · ');
}

function matchLine(script) {
  const meta = script.meta || {};
  const parts = [];
  if (meta.match && meta.match.length) parts.push('@match ' + meta.match.join('  '));
  if (meta.include && meta.include.length) parts.push('@include ' + meta.include.join('  '));
  if (meta.exclude && meta.exclude.length) parts.push('@exclude ' + meta.exclude.join('  '));
  return parts.join('\n') || '未声明匹配规则';
}

function countLine(label, values) {
  const count = values && values.length ? values.length : 0;
  return label + ' ' + count + ' 条';
}

function listSummary(script) {
  const meta = script.meta || {};
  return [
    countLine('@match', meta.match),
    countLine('@include', meta.include),
    countLine('@exclude', meta.exclude)
  ].join(' · ');
}

function formatDate(value) {
  if (!value) return '未知';
  return new Date(value).toLocaleString('zh-CN');
}

function createListItem(script) {
  const item = document.createElement('button');
  item.className = 'script-item' + (script.id === selectedScriptId ? ' selected' : '');
  item.type = 'button';
  const meta = script.meta || {};
  item.innerHTML = `
    <div class="script-item-name"></div>
    <div class="script-item-meta"></div>
    <div class="script-item-summary"></div>
  `;
  item.querySelector('.script-item-name').textContent = meta.name || script.id;
  item.querySelector('.script-item-meta').textContent = metaLine(script);
  item.querySelector('.script-item-summary').textContent = listSummary(script);
  item.addEventListener('click', () => {
    selectedScriptId = script.id;
    selectedTab = 'overview';
    render();
  });
  return item;
}

function createTabButton(id, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tab-button' + (selectedTab === id ? ' selected' : '');
  button.textContent = label;
  button.addEventListener('click', () => {
    selectedTab = id;
    renderDetail().catch((error) => setStatus(String(error.message || error), true));
  });
  return button;
}

function createKeyValue(label, value) {
  const row = document.createElement('div');
  row.className = 'kv-row';
  row.innerHTML = '<dt></dt><dd></dd>';
  row.querySelector('dt').textContent = label;
  row.querySelector('dd').textContent = value || '无';
  return row;
}

function createRuleBlock(label, values) {
  const block = document.createElement('section');
  block.className = 'rule-block';
  const title = document.createElement('h3');
  const pre = document.createElement('pre');
  const lines = normalizeLines(values);
  title.textContent = label + ' (' + lines.length + ')';
  pre.textContent = lines.length ? lines.join('\n') : '无';
  block.append(title, pre);
  return block;
}

function normalizeLines(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => {
    if (item && typeof item === 'object') return Object.values(item).join(' ');
    return String(item);
  });
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => {
    if (item && typeof item === 'object') return key + ' ' + Object.values(item).join(' ');
    return key + ' ' + String(item);
  });
  return [String(value)];
}

function stringifyValue(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function parseValueInput(text) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return text;
  }
}

function sourceWithLineNumbers(source, keyword = '') {
  const lowerKeyword = keyword.trim().toLowerCase();
  return source.split('\n').map((line, index) => {
    const row = document.createElement('div');
    row.className = 'code-line';
    if (lowerKeyword && line.toLowerCase().includes(lowerKeyword)) row.classList.add('hit');
    const number = document.createElement('span');
    number.className = 'line-number';
    number.textContent = String(index + 1);
    const code = document.createElement('span');
    code.className = 'line-code';
    code.textContent = line || ' ';
    row.append(number, code);
    return row;
  });
}

async function copySource(script) {
  await navigator.clipboard.writeText(script.source || '');
  setStatus('源码已复制');
}

function downloadSource(script) {
  const meta = script.meta || {};
  const safeName = (meta.name || script.id || 'userscript').replace(/[\\/:*?"<>|]+/g, '-');
  const blob = new Blob([script.source || ''], { type: 'text/javascript;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = safeName + '.user.js';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function renderOverview(script) {
  const meta = script.meta || {};
  const dl = document.createElement('dl');
  dl.className = 'kv-list';
  dl.append(
    createKeyValue('描述', meta.description || '无描述'),
    createKeyValue('版本', meta.version),
    createKeyValue('作者', meta.author),
    createKeyValue('安装来源', script.sourceUrl),
    createKeyValue('安装时间', formatDate(script.installedAt)),
    createKeyValue('更新时间', formatDate(script.updatedAt)),
    createKeyValue('脚本 ID', script.id)
  );
  return dl;
}

function renderRules(script) {
  const meta = script.meta || {};
  const wrap = document.createElement('div');
  wrap.className = 'rule-grid';
  wrap.append(
    createRuleBlock('@match', meta.match),
    createRuleBlock('@include', meta.include),
    createRuleBlock('@exclude', meta.exclude)
  );
  return wrap;
}

function renderGrants(script) {
  const meta = script.meta || {};
  const wrap = document.createElement('div');
  wrap.className = 'rule-grid';
  wrap.append(
    createRuleBlock('@grant', meta.grant),
    createRuleBlock('@require', meta.require),
    createRuleBlock('@resource', meta.resource)
  );
  return wrap;
}

function renderSource(script) {
  const wrap = document.createElement('div');
  wrap.className = 'source-panel';
  wrap.innerHTML = `
    <div class="source-toolbar">
      <input id="sourceSearch" type="search" placeholder="搜索源码">
      <button id="copySource" class="secondary">复制源码</button>
      <button id="downloadSource" class="secondary">下载 .user.js</button>
    </div>
    <pre class="source-view" aria-label="脚本源码"></pre>
  `;
  const pre = wrap.querySelector('.source-view');
  const search = wrap.querySelector('#sourceSearch');
  const paint = () => {
    pre.replaceChildren(...sourceWithLineNumbers(script.source || '', search.value));
  };
  search.addEventListener('input', paint);
  wrap.querySelector('#copySource').addEventListener('click', () => copySource(script).catch((error) => setStatus(String(error.message || error), true)));
  wrap.querySelector('#downloadSource').addEventListener('click', () => downloadSource(script));
  paint();
  return wrap;
}

async function renderStorage(script) {
  const response = await sendMessage({ type: 'gm:getAllValues', scriptId: script.id });
  const values = response && response.value ? response.value : {};
  const entries = Object.entries(values).sort(([left], [right]) => left.localeCompare(right));
  const wrap = document.createElement('div');
  wrap.className = 'storage-panel';
  wrap.innerHTML = `
    <div class="panel-toolbar">
      <button id="refreshStorage" class="secondary">刷新</button>
      <button id="copyStorage" class="secondary">复制全部</button>
    </div>
    <div class="storage-list"></div>
  `;
  const list = wrap.querySelector('.storage-list');
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '这个脚本还没有 GM 存储值。';
    list.appendChild(empty);
  } else {
    entries.forEach(([key, value]) => {
      const row = document.createElement('section');
      row.className = 'storage-row';
      row.innerHTML = `
        <label></label>
        <textarea spellcheck="false"></textarea>
        <div class="row-actions">
          <button class="save secondary">保存</button>
          <button class="delete danger">删除</button>
        </div>
      `;
      row.querySelector('label').textContent = key;
      row.querySelector('textarea').value = stringifyValue(value);
      row.querySelector('.save').addEventListener('click', async () => {
        await sendMessage({ type: 'gm:setValue', scriptId: script.id, key, value: parseValueInput(row.querySelector('textarea').value) });
        setStatus('已保存 GM 值：' + key);
        await renderDetail();
      });
      row.querySelector('.delete').addEventListener('click', async () => {
        await sendMessage({ type: 'gm:deleteValue', scriptId: script.id, key });
        setStatus('已删除 GM 值：' + key);
        await renderDetail();
      });
      list.appendChild(row);
    });
  }
  wrap.querySelector('#refreshStorage').addEventListener('click', () => renderDetail().catch((error) => setStatus(String(error.message || error), true)));
  wrap.querySelector('#copyStorage').addEventListener('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify(values, null, 2));
    setStatus('GM 存储已复制');
  });
  return wrap;
}

async function renderLogs(script) {
  const response = await sendMessage({ type: 'logs:list', scriptId: script.id });
  const logs = response && response.value ? response.value : [];
  const wrap = document.createElement('div');
  wrap.className = 'logs-panel';
  wrap.innerHTML = `
    <div class="panel-toolbar">
      <button id="refreshLogs" class="secondary">刷新</button>
      <button id="clearLogs" class="danger">清空日志</button>
    </div>
    <div class="logs-list"></div>
  `;
  const list = wrap.querySelector('.logs-list');
  if (!logs.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '暂时没有记录到脚本错误。';
    list.appendChild(empty);
  } else {
    logs.forEach((log) => {
      const entry = document.createElement('article');
      entry.className = 'log-entry';
      entry.innerHTML = `
        <div class="log-head">
          <strong></strong>
          <span></span>
        </div>
        <div class="log-url"></div>
        <pre></pre>
      `;
      entry.querySelector('strong').textContent = log.message || '未知错误';
      entry.querySelector('span').textContent = formatDate(log.time);
      entry.querySelector('.log-url').textContent = log.url || '未知页面';
      entry.querySelector('pre').textContent = log.stack || log.message || '';
      list.appendChild(entry);
    });
  }
  wrap.querySelector('#refreshLogs').addEventListener('click', () => renderDetail().catch((error) => setStatus(String(error.message || error), true)));
  wrap.querySelector('#clearLogs').addEventListener('click', async () => {
    await sendMessage({ type: 'logs:clear', scriptId: script.id });
    setStatus('错误日志已清空');
    await renderDetail();
  });
  return wrap;
}

async function renderDetail() {
  const script = scriptsCache.find((item) => item.id === selectedScriptId);
  detailEl.innerHTML = '';
  if (!script) {
    detailEl.className = 'script-detail empty-detail';
    const placeholder = document.createElement('div');
    placeholder.className = 'detail-placeholder';
    placeholder.textContent = scriptsCache.length ? '选择一个脚本查看详情和源码。' : '还没有安装脚本。';
    detailEl.appendChild(placeholder);
    return;
  }
  const meta = script.meta || {};
  detailEl.className = 'script-detail';
  detailEl.innerHTML = `
    <header class="detail-header">
      <div>
        <h2 class="detail-title"></h2>
        <p class="detail-meta"></p>
      </div>
      <div class="detail-actions">
        <button class="toggle secondary"></button>
        <button class="delete danger">删除</button>
      </div>
    </header>
    <nav class="tabs" aria-label="脚本详情"></nav>
    <div class="tab-content"></div>
  `;
  detailEl.querySelector('.detail-title').textContent = meta.name || script.id;
  detailEl.querySelector('.detail-meta').textContent = metaLine(script);
  detailEl.querySelector('.toggle').textContent = script.enabled === false ? '启用' : '停用';
  detailEl.querySelector('.toggle').addEventListener('click', async () => {
    await sendMessage({ type: 'scripts:update', id: script.id, patch: { enabled: script.enabled === false } });
    await render();
  });
  detailEl.querySelector('.delete').addEventListener('click', async () => {
    await sendMessage({ type: 'scripts:delete', id: script.id });
    selectedScriptId = '';
    await render();
  });
  const tabs = detailEl.querySelector('.tabs');
  tabs.append(
    createTabButton('overview', '概览'),
    createTabButton('rules', '匹配规则'),
    createTabButton('grants', '权限/API'),
    createTabButton('storage', '存储'),
    createTabButton('logs', '错误日志'),
    createTabButton('source', '源码')
  );
  const content = detailEl.querySelector('.tab-content');
  try {
    const body = selectedTab === 'rules'
      ? renderRules(script)
      : selectedTab === 'grants'
        ? renderGrants(script)
        : selectedTab === 'storage'
          ? await renderStorage(script)
          : selectedTab === 'logs'
            ? await renderLogs(script)
            : selectedTab === 'source'
              ? renderSource(script)
              : renderOverview(script);
    content.appendChild(body);
  } catch (error) {
    const box = document.createElement('div');
    box.className = 'empty';
    box.textContent = String(error && error.message ? error.message : error);
    content.appendChild(box);
    setStatus(box.textContent, true);
  }
}

async function render() {
  const response = await sendMessage({ type: 'scripts:list' });
  const scripts = response && response.scripts ? response.scripts : [];
  scriptsCache = scripts;
  if (!selectedScriptId && scripts[0]) selectedScriptId = scripts[0].id;
  if (selectedScriptId && !scripts.some((script) => script.id === selectedScriptId)) selectedScriptId = scripts[0] ? scripts[0].id : '';
  listEl.innerHTML = '';
  if (scripts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '还没有安装脚本。可以从 .user.js 链接或源码安装。';
    listEl.appendChild(empty);
    await renderDetail();
    return;
  }
  scripts.forEach((script) => listEl.appendChild(createListItem(script)));
  await renderDetail();
}

document.querySelector('#installUrl').addEventListener('click', async () => {
  try {
    setStatus('正在下载...');
    const url = urlEl.value.trim();
    if (!url) throw new Error('请输入 .user.js 链接');
    await installFromSource(await fetchText(url), url);
  } catch (error) {
    setStatus(String(error.message || error), true);
  }
});

document.querySelector('#installSource').addEventListener('click', async () => {
  try {
    await installFromSource(sourceEl.value);
  } catch (error) {
    setStatus(String(error.message || error), true);
  }
});

document.querySelector('#clearEditor').addEventListener('click', () => {
  sourceEl.value = '';
  urlEl.value = '';
});

document.querySelector('#refresh').addEventListener('click', render);

render().catch((error) => setStatus(String(error.message || error), true));
