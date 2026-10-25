// KM3 diagnostics: logs the page's network requests and video events to a dev server on the box.
(function () {
    var t0 = Date.now();
    function log(m) {
        try { fetch('http://127.0.0.1:8013/log', { method: 'POST', body: ((Date.now() - t0) / 1000).toFixed(1) + ' ' + m }).catch(function () {}); } catch (e) {}
    }
    function short(u) { u = String(u); return u.length > 140 ? u.slice(0, 140) + '…' : u; }
    log('start ' + location.href);
    var of = window.fetch;
    window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url), s = Date.now();
        if (String(url).indexOf('127.0.0.1:8013') !== -1) return of.apply(this, arguments);
        return of.apply(this, arguments).then(function (r) { log('fetch ' + r.status + ' ' + (Date.now() - s) + 'ms ' + short(url)); return r; },
            function (e) { log('fetch ERR ' + e + ' ' + (Date.now() - s) + 'ms ' + short(url)); throw e; });
    };
    var oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__u = m + ' ' + u; return oo.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () {
        var x = this, s = Date.now();
        x.addEventListener('loadend', function () { log('xhr ' + x.status + ' ' + (Date.now() - s) + 'ms ' + short(x.__u)); });
        return os.apply(this, arguments);
    };
    window.addEventListener('hashchange', function () { log('hash ' + location.hash.slice(0, 80)); });
    window.addEventListener('error', function (e) { log('error ' + e.message); });
    setInterval(function () {
        var v = document.querySelector('video');
        if (v) log('video t=' + v.currentTime.toFixed(1) + ' paused=' + v.paused + ' rs=' + v.readyState + ' ns=' + v.networkState + ' err=' + (v.error && v.error.code));
    }, 5000);
})();
