(function () {
  'use strict';

  function escapeRegExp(value) {
    return String(value).replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }

  function wildcardToRegExp(pattern) {
    return new RegExp('^' + escapeRegExp(pattern).replace(/\*/g, '.*') + '$');
  }

  function matchWebExtensionPattern(pattern, url) {
    if (pattern === '<all_urls>') return /^(https?|file):\/\//.test(url);
    const parsed = pattern.match(/^(\*|http|https|file):\/\/([^/]*)(\/.*)$/);
    if (!parsed) return wildcardToRegExp(pattern).test(url);

    const target = new URL(url);
    const scheme = parsed[1];
    const host = parsed[2];
    const path = parsed[3] || '/*';
    if (scheme !== '*' && target.protocol.replace(':', '') !== scheme) return false;
    if (scheme === '*' && !['http:', 'https:'].includes(target.protocol)) return false;
    if (host !== '*') {
      if (host.startsWith('*.')) {
        const base = host.slice(2);
        if (target.hostname !== base && !target.hostname.endsWith('.' + base)) return false;
      } else if (target.hostname !== host) {
        return false;
      }
    }
    return wildcardToRegExp(path).test(target.pathname + target.search + target.hash);
  }

  function matchesAny(patterns, url) {
    return (patterns || []).some((pattern) => {
      try {
        return matchWebExtensionPattern(pattern, url);
      } catch (_error) {
        return false;
      }
    });
  }

  function matchesAnyGlob(patterns, url) {
    return (patterns || []).some((pattern) => {
      try {
        return wildcardToRegExp(pattern).test(url);
      } catch (_error) {
        return false;
      }
    });
  }

  function shouldRunScript(script, url) {
    if (!script || script.enabled === false) return false;
    const meta = script.meta || {};
    if (matchesAnyGlob(meta.exclude, url)) return false;
    if (matchesAny(meta.match, url)) return true;
    return matchesAnyGlob(meta.include, url);
  }

  globalThis.UserScriptMatcher = {
    shouldRunScript,
    matchWebExtensionPattern
  };
})();
