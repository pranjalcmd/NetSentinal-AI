/**
 * NetSentinel browser agent — drop-in network telemetry for any website.
 *
 * One tag, no build step, no dependency, any backend language:
 *
 *   <script src="/netsentinel.js"
 *           data-server="https://netsentinel.example.com"
 *           data-client-id="shop-frontend"
 *           data-key="YOUR_AGENT_KEY"></script>
 *
 * Or configure it by hand:  NetSentinel.start({ server: '...', apiKey: '...' })
 *
 * What it can and cannot see: a web page cannot read packets, so this reports
 * what the browser genuinely measures — PerformanceObserver 'resource' entries,
 * i.e. every fetch/XHR/image/script/stylesheet the page requests, with wire
 * bytes and duration. `packets` is therefore a count of observed requests, and
 * every flow is tagged metadata.source = 'browser-rum' so nothing downstream
 * mistakes it for packet capture. For packet-level data use a network sensor or
 * the backend agent (client/capture_agent.py).
 *
 * Byte counts read 0 for cross-origin responses unless that server sends
 * Timing-Allow-Origin — a browser restriction, not a bug. Volume-based
 * detectors therefore only see third parties that opt in; request counts and
 * destination patterns are reliable either way.
 *
 * Privacy (PRD §8): only the destination hostname leaves the page. Paths, query
 * strings, headers, cookies and bodies are never read — a URL is reduced to its
 * hostname before it is ever stored.
 *
 * ponytail: no retry queue and no compression. An undelivered batch stays in
 * the buckets and rides along with the next flush; add a durable queue when a
 * lost batch actually matters.
 */
(function (global) {
  'use strict';

  var config = {
    server: '',
    clientId: 'web-agent',
    apiKey: '',
    flushInterval: 10000,
    // sendBeacon silently refuses oversized bodies, so flush early rather than
    // growing a batch the browser will never accept.
    maxBuckets: 200
  };

  var buckets = {};
  var bucketCount = 0;
  var lastFlush = 0;
  var lastError = null;
  var observer = null;
  var timer = null;
  var ingestUrl = null;

  function record(host, port, app, bytes, ms) {
    var key = port + '>' + host + '>' + app;
    var bucket = buckets[key];
    if (!bucket) {
      bucket = buckets[key] = {
        flow_id: key + '>' + Math.random().toString(16).slice(2, 10),
        timestamp: new Date().toISOString(),
        // Left empty on purpose: the server stamps the peer address, because
        // a page cannot see the address it is talking from.
        source_ip: '',
        destination_ip: host,
        source_port: 0,
        destination_port: port,
        transport: 'TCP',
        application: app,
        packets: 0,
        bytes: 0,
        duration_seconds: 0,
        ndpi_risks: [],
        metadata: { source: 'browser-rum', page: global.location.hostname }
      };
      bucketCount += 1;
    }
    bucket.packets += 1;
    bucket.bytes += bytes;
    bucket.duration_seconds += ms / 1000;

    if (bucketCount >= config.maxBuckets) flush();
  }

  function onEntries(list) {
    var entries = list.getEntries();
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var url;
      try {
        url = new URL(entry.name, global.location.href);
      } catch (err) {
        continue;
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      // Never observe our own flush: each batch would create the entry that
      // feeds the next one, and the agent would report itself forever.
      if (ingestUrl && url.origin + url.pathname === ingestUrl) continue;
      var secure = url.protocol === 'https:';
      // hostname only — see the privacy note above.
      record(
        url.hostname,
        Number(url.port) || (secure ? 443 : 80),
        secure ? 'HTTPS' : 'HTTP',
        entry.transferSize || 0,
        entry.duration || 0
      );
    }
  }

  /** Absolute URL of the ingest endpoint, or null when unconfigured. */
  function endpoint() {
    if (!config.server) return null;
    try {
      return new URL(
        config.server.replace(/\/+$/, '') + '/api/agent/ingest',
        global.location.href
      ).href;
    } catch (err) {
      return null;
    }
  }

  function pending() {
    var flows = [];
    for (var key in buckets) {
      if (Object.prototype.hasOwnProperty.call(buckets, key)) flows.push(buckets[key]);
    }
    return flows;
  }

  function flush() {
    var flows = pending();
    if (!flows.length) return false;
    var url = endpoint();
    if (!url) {
      lastError = 'no server configured';
      return false;
    }

    var body = JSON.stringify({
      client_id: config.clientId,
      api_key: config.apiKey,
      flows: flows
    });

    var sent = false;
    try {
      // text/plain keeps this a CORS-simple request: no preflight and no
      // Access-Control-Allow-Origin needed, which is what lets the agent run
      // on a site whose API origin it does not control. sendBeacon also
      // survives the page being closed mid-flush.
      sent = global.navigator.sendBeacon(
        url, new Blob([body], { type: 'text/plain' })
      );
    } catch (err) {
      lastError = String(err);
      return false;
    }

    if (sent) {
      buckets = {};
      bucketCount = 0;
      lastFlush = Date.now();
      lastError = null;
    } else {
      // Queue full or body too large — keep the buckets for the next attempt.
      lastError = 'sendBeacon refused the batch';
    }
    return sent;
  }

  function start(options) {
    for (var key in options || {}) {
      if (Object.prototype.hasOwnProperty.call(options, key)) config[key] = options[key];
    }
    if (observer) return;
    ingestUrl = endpoint();
    if (typeof global.PerformanceObserver !== 'function' || !global.navigator.sendBeacon) {
      lastError = 'browser lacks PerformanceObserver or sendBeacon';
      return;
    }

    observer = new global.PerformanceObserver(onEntries);
    // buffered:true replays the requests that happened before this script ran,
    // so page load is measured even though the agent starts after it.
    observer.observe({ type: 'resource', buffered: true });

    timer = global.setInterval(flush, config.flushInterval);
    global.document.addEventListener('visibilitychange', function () {
      if (global.document.visibilityState === 'hidden') flush();
    });
  }

  function stop() {
    if (observer) { observer.disconnect(); observer = null; }
    if (timer) { global.clearInterval(timer); timer = null; }
  }

  /** Queue depth, last flush and last error — the health surface of PRD §8. */
  function status() {
    return {
      running: !!observer,
      queued: bucketCount,
      lastFlush: lastFlush ? new Date(lastFlush).toISOString() : null,
      lastError: lastError,
      server: config.server,
      clientId: config.clientId
    };
  }

  global.NetSentinel = {
    start: start,
    stop: stop,
    flush: flush,
    status: status,
    pending: pending
  };

  // Auto-start from the script tag's data attributes, so the whole install is
  // one line of HTML with nothing to call.
  var tag = global.document.currentScript;
  if (tag && tag.getAttribute('data-server')) {
    start({
      server: tag.getAttribute('data-server'),
      clientId: tag.getAttribute('data-client-id') || global.location.hostname,
      apiKey: tag.getAttribute('data-key') || '',
      flushInterval: Number(tag.getAttribute('data-interval')) || 10000
    });
  }
})(window);
