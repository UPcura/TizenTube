// KM3 probe: checks, on the real TV, every piece the Yandex voice-over feature depends on.
// Results go to the console, which Cobalt mirrors to logcat as INFO:CONSOLE lines.

import VOTClient from '@vot.js/core';
import { VOTNextWorkerProvider } from '@vot.js/core/providers/votworker';

const TEST_VIDEO = { url: 'https://youtu.be/dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ', host: 'youtube', duration: 212 };
const AUDIO_PROXY = 'https://vot-worker.toil.cc/video-translation/audio-proxy/';

function log(...args) {
    console.info('[KM3PROBE]', ...args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function translate(client) {
    for (let i = 0; i < 20; i++) {
        const res = await client.translateVideo({ videoData: TEST_VIDEO, requestLang: 'en', responseLang: 'ru' });
        log('translate', { translated: res.translated, status: res.status, remainingTime: res.remainingTime, url: res.url });
        if (res.translated) return res.url;
        await sleep(Math.min(Math.max(res.remainingTime || 10, 5), 30) * 1000);
    }
    throw new Error('translation did not finish');
}

async function fetchAudio(url) {
    const candidates = [url];
    const m = url.match(/^https:\/\/vtrans\.s3-private\.mds\.yandex\.net\/tts\/prod\/(.+)$/);
    if (m) candidates.push(AUDIO_PROXY + m[1]);
    for (const u of candidates) {
        try {
            const r = await fetch(u);
            const buf = await r.arrayBuffer();
            log('audio fetch', { url: u, status: r.status, bytes: buf.byteLength, type: r.headers.get('content-type') });
            if (r.ok && buf.byteLength > 1000) return buf;
        } catch (e) {
            log('audio fetch ERR', { url: u, error: String(e) });
        }
    }
    throw new Error('no audio source worked');
}

async function play(buf) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const decoded = await ctx.decodeAudioData(buf);
    log('decoded', { duration: decoded.duration, channels: decoded.numberOfChannels, rate: decoded.sampleRate });
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

async function run() {
    log('env', {
        subtle: !!(window.crypto && crypto.subtle),
        audioContext: typeof (window.AudioContext || window.webkitAudioContext),
        mp3: document.createElement('audio').canPlayType('audio/mpeg'),
        href: location.href,
    });
    const client = new VOTClient({ provider: VOTNextWorkerProvider });
    const url = await translate(client);
    const buf = await fetchAudio(url);
    await play(buf);
    log('DONE ok');
}

if (location.hostname === 'www.youtube.com') {
    setTimeout(() => run().catch(e => log('FAILED', String(e && e.stack || e))), 8000);
}
