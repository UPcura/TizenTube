// KM3 loader: the KM3 Cobalt build loads this file from jsDelivr (the URL is baked into the APK).
// jsDelivr caches a branch for up to 12 hours and purges do not reliably reach every edge, so this
// asks the GitHub API (on Cobalt's CSP allow list) which commit km3 is at and loads the bundle,
// t.js, pinned to that commit. If GitHub does not answer quickly, the branch URL is used instead.
(function () {
    var base = 'https://cdn.jsdelivr.net/gh/UPcura/TizenTube@';
    var loaded = false;

    function load(ref) {
        if (loaded) return;
        loaded = true;
        var script = document.createElement('script');
        script.src = base + ref + '/t.js';
        (document.head || document.documentElement).appendChild(script);
    }

    var timer = setTimeout(function () { load('km3'); }, 4000);
    fetch('https://api.github.com/repos/UPcura/TizenTube/commits/km3', { headers: { Accept: 'application/vnd.github.sha' } })
        .then(function (res) {
            if (!res.ok) throw new Error('GitHub answered ' + res.status);
            return res.text();
        })
        .then(function (sha) {
            clearTimeout(timer);
            load(/^[0-9a-f]{40}$/.test(sha) ? sha : 'km3');
        })
        .catch(function () {
            clearTimeout(timer);
            load('km3');
        });
})();
