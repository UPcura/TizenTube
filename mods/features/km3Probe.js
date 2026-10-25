// KM3 probe: checks, on the real TV, every piece the Yandex voice-over feature depends on.
// Cobalt does not mirror JS console output to logcat, so the summary is shown as a native dialog.

import VOTClient from '@vot.js/core';
import { VOTNextWorkerProvider } from '@vot.js/core/providers/votworker';
import { MPEGDecoder } from 'mpg123-decoder';

// vot.js aborts requests after 3 s by default, too short for the first TLS handshake on a TV box.
// vot-worker.toil.cc is gone; this is the host the voice-over-translation extension uses now.
// Cobalt only lets the page reach it because the KM3 build puts it on its CSP host allow list.
const WORKER_HOST = 'vot-worker.eu.cc';
const AUDIO_SOURCE = 'https://vtrans.s3-private.mds.yandex.net/tts/prod/';
const AUDIO_PROXY = `https://${WORKER_HOST}/video-translation/audio-proxy/`;
const TEST_VIDEO = { url: 'https://youtu.be/dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ', host: 'youtube', duration: 212 };

const lines = [];

function log(...args) {
    const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    lines.push(line);
    console.error('[KM3PROBE]', line);
    // dev only: a busybox nc server on the box collects these (YouTube's CSP allows 127.0.0.1)
    fetch('http://127.0.0.1:8013/log', { method: 'POST', body: line }).catch(() => {});
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function translate(client) {
    for (let i = 0; i < 20; i++) {
        const res = await client.translateVideo({ videoData: TEST_VIDEO, requestLang: 'en', responseLang: 'ru' });
        log('translate', { translated: res.translated, status: res.status, remainingTime: res.remainingTime });
        if (res.translated) return res.url;
        await sleep(Math.min(Math.max(res.remainingTime || 10, 5), 30) * 1000);
    }
    throw new Error('translation did not finish');
}

async function fetchAudio(url) {
    // the S3 host is too long for Cobalt's allow list, so audio goes through the worker's proxy
    const proxied = url.replace(AUDIO_SOURCE, AUDIO_PROXY);
    const t0 = Date.now();
    const r = await fetch(proxied);
    const buf = await r.arrayBuffer();
    log('audio fetch', { status: r.status, bytes: buf.byteLength, ms: Date.now() - t0 });
    if (!r.ok) throw new Error('audio proxy returned ' + r.status);
    return buf;
}

async function decode(ctx, buf) {
    try {
        const d = await ctx.decodeAudioData(buf.slice(0));
        log('decodeAudioData OK', { duration: d.duration.toFixed(1) });
        return d;
    } catch (e) {
        log('decodeAudioData ERR', String(e));
    }
    const t0 = Date.now();
    const dec = new MPEGDecoder();
    await dec.ready;
    const { channelData, samplesDecoded, sampleRate } = dec.decode(new Uint8Array(buf));
    dec.free();
    log('mpg123 OK', { seconds: (samplesDecoded / sampleRate).toFixed(1), rate: sampleRate, ms: Date.now() - t0 });
    const out = ctx.createBuffer(channelData.length, samplesDecoded, sampleRate);
    channelData.forEach((ch, i) => out.copyToChannel(ch, i));
    return out;
}

async function play(buf) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const decoded = await decode(ctx, buf);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.6;
    src.buffer = decoded;
    src.connect(gain).connect(ctx.destination);
    const t0 = ctx.currentTime;
    src.start(0, 20);
    await sleep(8000);
    src.stop();
    log('played', { ctxState: ctx.state, advanced: (ctx.currentTime - t0).toFixed(2) });
}

async function timed(name, url, opts) {
    const t0 = Date.now();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
        const r = await fetch(url, Object.assign({ signal: ctl.signal }, opts || {}));
        log('net', name, r.status, (Date.now() - t0) + 'ms');
    } catch (e) {
        log('net', name, 'ERR ' + e, (Date.now() - t0) + 'ms');
    } finally {
        clearTimeout(timer);
    }
}

function xhr(name, url, method, body) {
    return new Promise(resolve => {
        const t0 = Date.now();
        const x = new XMLHttpRequest();
        x.open(method || 'GET', url);
        x.timeout = 15000;
        x.onload = () => { log('xhr', name, x.status, (Date.now() - t0) + 'ms'); resolve(); };
        x.onerror = () => { log('xhr', name, 'error', (Date.now() - t0) + 'ms'); resolve(); };
        x.ontimeout = () => { log('xhr', name, 'timeout', (Date.now() - t0) + 'ms'); resolve(); };
        x.send(body || null);
    });
}

async function netMatrix() {
    log('fetch is', String(window.fetch).slice(0, 90), 'XHR is', String(XMLHttpRequest.prototype.open).slice(0, 60));
    await xhr('same-origin', '/tv/manifest.json');
    await xhr('googleapis', 'https://www.googleapis.com/discovery/v1/apis?name=youtube');
    await timed('github no-cors', 'https://api.github.com/', { mode: 'no-cors' });
    await timed('jsdelivr cors', 'https://cdn.jsdelivr.net/gh/UPcura/TizenTube@main/README.md');
}

async function run() {
    log('start');
    await netMatrix();
    log('env', {
        subtle: !!(window.crypto && crypto.subtle),
        audioContext: typeof (window.AudioContext || window.webkitAudioContext),
        wasm: typeof WebAssembly,
    });
    const client = new VOTClient({ provider: VOTNextWorkerProvider, host: WORKER_HOST, fetchOpts: { timeout: 20000 } });
    const url = await translate(client);
    const buf = await fetchAudio(url);
    await play(buf);
    log('DONE ok');
}

if (location.hostname === 'www.youtube.com') {
    setTimeout(() => {
        run()
            .catch(e => log('FAILED', String(e && e.message || e), JSON.stringify(e && e.data || null).slice(0, 300)))
            .then(() => window.km3Show && window.km3Show('KM3 probe', lines.join('\n')));
    }, 8000);
}
