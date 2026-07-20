(function () {
  'use strict';

  function parseUserscriptMetadata(source) {
    const text = String(source || '');
    const block = text.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
    const meta = {
      name: '未命名脚本',
      namespace: '',
      version: '',
      description: '',
      author: '',
      match: [],
      include: [],
      exclude: [],
      grant: [],
      require: [],
      resource: {},
      runAt: 'document-end',
      sandbox: ''
    };
    if (!block) return meta;

    block[1].split(/\r?\n/).forEach((line) => {
      const parsed = line.match(/^\s*\/\/\s*@(\S+)\s*(.*)$/);
      if (!parsed) return;
      const key = parsed[1];
      const value = parsed[2].trim();
      if (key === 'name') meta.name = value || meta.name;
      else if (key === 'namespace') meta.namespace = value;
      else if (key === 'version') meta.version = value;
      else if (key === 'description') meta.description = value;
      else if (key === 'author') meta.author = value;
      else if (key === 'match') meta.match.push(value);
      else if (key === 'include') meta.include.push(value);
      else if (key === 'exclude') meta.exclude.push(value);
      else if (key === 'grant') meta.grant.push(value);
      else if (key === 'require') meta.require.push(value);
      else if (key === 'run-at') meta.runAt = value || meta.runAt;
      else if (key === 'resource') {
        const resource = value.match(/^(\S+)\s+(.+)$/);
        if (resource) meta.resource[resource[1]] = resource[2];
      } else if (key === 'sandbox') meta.sandbox = value;
    });

    if (meta.match.length === 0 && meta.include.length === 0) {
      meta.match.push('*://*/*');
    }
    return meta;
  }

  function createScriptId(meta, source) {
    const basis = [meta.namespace, meta.name, meta.version, source.length].join('\n');
    let hash = 2166136261;
    for (let i = 0; i < basis.length; i += 1) {
      hash ^= basis.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return 'script-' + (hash >>> 0).toString(16);
  }

  globalThis.UserScriptMetadata = {
    parseUserscriptMetadata,
    createScriptId
  };
})();
