const api = globalThis.browser || globalThis.chrome;
const summary = document.querySelector('#summary');

function sendMessage(message) {
  const result = api.runtime.sendMessage({ scope: 'userscript-manager', ...message });
  if (result && typeof result.then === 'function') return result;
  return new Promise((resolve) => api.runtime.sendMessage({ scope: 'userscript-manager', ...message }, resolve));
}

document.querySelector('#openOptions').addEventListener('click', () => {
  if (api.runtime.openOptionsPage) {
    api.runtime.openOptionsPage();
  }
});

sendMessage({ type: 'scripts:list' }).then((response) => {
  const scripts = response && response.scripts ? response.scripts : [];
  const enabled = scripts.filter((script) => script.enabled !== false).length;
  summary.textContent = '已安装 ' + scripts.length + ' 个脚本，启用 ' + enabled + ' 个。';
}).catch((error) => {
  summary.textContent = '读取失败：' + String(error.message || error);
});
