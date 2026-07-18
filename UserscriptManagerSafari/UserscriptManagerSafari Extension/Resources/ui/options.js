const api = globalThis.browser || globalThis.chrome;
const statusEl = document.querySelector('#status');
const listEl = document.querySelector('#scriptList');
const sourceEl = document.querySelector('#scriptSource');
const urlEl = document.querySelector('#scriptUrl');

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

function createCard(script) {
  const card = document.createElement('article');
  card.className = 'script-card';
  const meta = script.meta || {};
  card.innerHTML = `
    <div class="script-main">
      <div>
        <div class="script-name"></div>
        <div class="meta"></div>
      </div>
      <div class="card-actions">
        <button class="toggle secondary"></button>
        <button class="delete danger">删除</button>
      </div>
    </div>
    <p class="description"></p>
    <pre class="matches"></pre>
  `;
  card.querySelector('.script-name').textContent = meta.name || script.id;
  card.querySelector('.meta').textContent = metaLine(script);
  card.querySelector('.description').textContent = meta.description || '无描述';
  card.querySelector('.matches').textContent = matchLine(script);
  card.querySelector('.toggle').textContent = script.enabled === false ? '启用' : '停用';
  card.querySelector('.toggle').addEventListener('click', async () => {
    await sendMessage({ type: 'scripts:update', id: script.id, patch: { enabled: script.enabled === false } });
    await render();
  });
  card.querySelector('.delete').addEventListener('click', async () => {
    await sendMessage({ type: 'scripts:delete', id: script.id });
    await render();
  });
  return card;
}

async function render() {
  const response = await sendMessage({ type: 'scripts:list' });
  const scripts = response && response.scripts ? response.scripts : [];
  listEl.innerHTML = '';
  if (scripts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '还没有安装脚本。可以从 .user.js 链接或源码安装。';
    listEl.appendChild(empty);
    return;
  }
  scripts.forEach((script) => listEl.appendChild(createCard(script)));
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
