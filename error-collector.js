// EdgeFocus Error Pulse — Landing Page Collector
// Captures JS errors and network failures, sends to EdgeFocus Error Pulse.
// Zero dependencies, vanilla JS.
(function () {
  'use strict';

  var ENDPOINT = 'https://edgefocus.ru/api/v1/error-reports/public';
  var FLUSH_INTERVAL = 15000;
  var MAX_BATCH = 20;
  var MAX_MSG = 500;
  var MAX_STACK = 600;

  var buffer = [];
  var seen = {};
  var timer = null;
  var originalFetch = window.fetch;

  function truncate(s, max) {
    return s && s.length > max ? s.slice(0, max) : s || '';
  }

  function pageUrl() {
    return location.pathname;
  }

  function lang() {
    try { return localStorage.getItem('lang') || navigator.language || ''; }
    catch (e) { return navigator.language || ''; }
  }

  function fingerprint(str) {
    // Simple string hash (DJB2) — server recomputes canonical SHA-256 fingerprint anyway.
    // This is only for client-side dedup within a single flush interval.
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return 'l' + (hash >>> 0).toString(36);
  }

  function baseContext() {
    return {
      page_url: pageUrl(),
      user_agent: navigator.userAgent,
      referrer: document.referrer || '',
      language: lang()
    };
  }

  function collect(errorType, message, extra) {
    var msg = truncate(message, MAX_MSG);
    var fp = fingerprint(errorType + '|' + pageUrl() + '|' + (extra.action || ''));
    if (seen[fp]) return;
    seen[fp] = true;

    var ctx = baseContext();
    ctx.action = extra.action || 'unknown';
    if (extra.stack) ctx.stack = truncate(extra.stack, MAX_STACK);
    if (extra.api_url) ctx.api_url = extra.api_url;
    if (extra.status_code != null) ctx.status_code = extra.status_code;
    if (extra.method) ctx.method = extra.method;

    buffer.push({ error_type: errorType, message: msg, context: ctx });
    if (buffer.length >= MAX_BATCH) flush();
  }

  function flush() {
    if (!buffer.length) return;
    var batch = buffer.splice(0, MAX_BATCH);
    seen = {};
    var body = JSON.stringify({ errors: batch });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      } else {
        originalFetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        });
      }
    } catch (e) { /* silent */ }
  }

  function getErrorType(err) {
    if (err instanceof TypeError) return 'TypeError';
    if (err instanceof RangeError) return 'RangeError';
    if (err instanceof SyntaxError) return 'SyntaxError';
    if (err instanceof ReferenceError) return 'ReferenceError';
    if (err instanceof URIError) return 'URIError';
    if (err instanceof Error && err.name && err.name !== 'Error') return err.name;
    if (typeof err === 'string') return 'StringError';
    return 'UnknownError';
  }

  // Global error handler
  window.addEventListener('error', function (event) {
    // Filter cross-origin script errors (no useful info)
    if (event.message === 'Script error.' || event.filename === '') return;
    var err = event.error;
    var type = err ? getErrorType(err) : 'UnknownError';
    var msg = err ? (err.message || String(err)) : event.message || 'Unknown error';
    collect(type, msg, { action: 'uncaught_error', stack: err && err.stack });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    var type = reason ? getErrorType(reason) : 'UnknownError';
    var msg = reason instanceof Error ? reason.message : String(reason || 'Unhandled rejection');
    collect(type, msg, { action: 'unhandled_rejection', stack: reason && reason.stack });
  });

  // Wrap fetch to capture network errors
  window.fetch = function (url, opts) {
    var method = (opts && opts.method) || 'GET';
    var urlStr = typeof url === 'string' ? url : (url && url.url) || String(url);
    // Don't intercept our own error reporting calls
    if (urlStr.indexOf('/error-reports/') !== -1) {
      return originalFetch.apply(this, arguments);
    }
    return originalFetch.apply(this, arguments).then(function (response) {
      if (!response.ok) {
        collect('FetchError', method + ' ' + urlStr + ' \u2192 ' + response.status, {
          action: 'fetch_error',
          api_url: urlStr,
          status_code: response.status,
          method: method
        });
      }
      return response;
    }).catch(function (err) {
      collect('FetchError', method + ' ' + urlStr + ' failed: ' + (err.message || err), {
        action: 'fetch_network_error',
        api_url: urlStr,
        method: method,
        stack: err && err.stack
      });
      throw err;
    });
  };

  // Periodic flush
  timer = setInterval(flush, FLUSH_INTERVAL);

  // Flush before page unload
  window.addEventListener('beforeunload', flush);
})();
