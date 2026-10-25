// KM3: Yandex voice-over translation, played in sync with the video.
// The page cannot send the headers Yandex wants, so requests go through the vot-worker proxy;
// the KM3 Cobalt build puts that host on Cobalt's CSP allow list, nothing else may reach it.

import VOTClient from '@vot.js/core';
import { VOTNextWorkerProvider } from '@vot.js/core/providers/votworker';
import { availableLangs } from '@vot.js/shared/consts';
import { configRead } from '../../config.js';
import { showToast } from '../../ui/ytUI.js';
import { t } from 'i18next';
import { Mp3Track } from './mp3.js';

export const WORKER_HOST = 'vot-worker.eu.cc';
const AUDIO_SOURCE = 'https://vtrans.s3-private.mds.yandex.net/tts/prod/';
const AUDIO_PROXY = `https://${WORKER_HOST}/video-translation/audio-proxy/`;
const STATUS_FAILED = 0;
const STATUS_PART_CONTENT = 5;

const SEGMENT = 15;      // seconds of audio decoded at a time
const LOOKAHEAD = 30;    // seconds kept scheduled ahead of the playhead
const MAX_DRIFT = 0.35;  // seconds the voice-over may drift from the video before it is re-synced

// vot.js aborts after 3 s by default, too short for a TLS handshake on a TV box
const client = new VOTClient({ provider: VOTNextWorkerProvider, host: WORKER_HOST, fetchOpts: { timeout: 20000 } });

// videoId -> { lang, duration }, read from player responses as they pass through JSON.parse.
// The language of YouTube's auto captions ("asr") is the language spoken in the video.
const videoInfo = {};
const origParse = JSON.parse;
JSON.parse = function () {
    const res = origParse.apply(this, arguments);
    try {
        const details = res && res.videoDetails;
        if (details && details.videoId) {
            const tracks = res.captions && res.captions.playerCaptionsTracklistRenderer &&
                res.captions.playerCaptionsTracklistRenderer.captionTracks;
            const asr = tracks && tracks.find(track => track.kind === 'asr');
            videoInfo[details.videoId] = {
                lang: asr ? asr.languageCode.split('-')[0] : null,
                duration: Number(details.lengthSeconds) || 0,
            };
        }
    } catch (_) { /* not a player response */ }
    return res;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const toast = text => showToast(t('km3.voiceOver.title'), text);
const video = () => document.querySelector('video');

export function currentVideoId() {
    const match = /[?&]v=([\w-]{11})/.exec(location.hash);
    return match ? match[1] : null;
}

let ctx = null;
let gain = null;

// Everything about the translation of one video. A new session (or stop) bumps `generation`,
// which makes the async work of the previous one drop its results.
let generation = 0;
let session = null;

function audioContext() {
    if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        gain = ctx.createGain();
        gain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    gain.gain.value = configRead('voiceOverVolume') / 100;
    return ctx;
}

async function requestTranslation(videoId, gen) {
    const info = videoInfo[videoId] || {};
    const lang = availableLangs.indexOf(info.lang) !== -1 ? info.lang : 'auto';
    const videoData = { url: `https://youtu.be/${videoId}`, videoId, host: 'youtube', duration: info.duration || undefined };
    let lastToast = 0;
    for (;;) {
        const res = await client.translateVideo({ videoData, requestLang: lang, responseLang: 'ru' });
        if (gen !== generation) return null;
        if (res.translated) return res;
        if (res.status === STATUS_FAILED) throw new Error('failed');
        // a video nobody translated before takes Yandex a few minutes
        if (Date.now() - lastToast > 30000) {
            lastToast = Date.now();
            const minutes = res.remainingTime > 0 ? Math.max(1, Math.round(res.remainingTime / 60)) : null;
            toast(minutes ? t('km3.voiceOver.waitingMinutes', { minutes }) : t('km3.voiceOver.waiting'));
        }
        await sleep(Math.min(Math.max(res.remainingTime || 10, 5), 30) * 1000);
        if (gen !== generation) return null;
    }
}

async function loadTrack(url, gen) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(url.replace(AUDIO_SOURCE, AUDIO_PROXY));
            if (!res.ok) throw new Error(`audio proxy answered ${res.status}`);
            const bytes = new Uint8Array(await res.arrayBuffer());
            if (gen !== generation) return null;
            const track = new Mp3Track(bytes);
            await track.ready();
            return track;
        } catch (e) {
            lastError = e;
            await sleep(2000);
        }
    }
    throw lastError;
}

// ---------------------------------------------------------------- playback

/** Stops what is scheduled; the next sync() starts over from where the video is. */
function silence(s) {
    s.syncId++;
    s.anchor = null;
    s.scheduledUntil = null;
    s.sources.forEach(src => { try { src.stop(); } catch (_) { /* never started */ } });
    s.sources = [];
}

async function segment(s, index) {
    if (!s.cache.has(index)) {
        s.cache.set(index, s.track.decode(ctx, index * SEGMENT, (index + 1) * SEGMENT));
    }
    // keep the previous segment too, for small seeks back
    for (const key of s.cache.keys()) if (key < index - 1) s.cache.delete(key);
    return s.cache.get(index);
}

/** ctx time at which the video reaches `time`, from the anchor taken when playback (re)started */
const ctxTimeOf = (s, time) => s.anchor.ctx + (time - s.anchor.video) / s.anchor.rate;

async function scheduleAhead(s, syncId) {
    if (s.scheduling) return;
    s.scheduling = true;
    try {
        for (;;) {
            const v = video();
            if (!v || syncId !== s.syncId || s.scheduledUntil >= Math.min(v.currentTime + LOOKAHEAD, s.track.duration)) break;
            const from = s.scheduledUntil;
            const index = Math.floor(from / SEGMENT + 1e-6);
            const seg = await segment(s, index);
            if (syncId !== s.syncId) return;
            const segEnd = (index + 1) * SEGMENT;
            s.scheduledUntil = segEnd;
            if (!seg) continue;

            const src = ctx.createBufferSource();
            src.buffer = seg.buffer;
            src.playbackRate.value = s.anchor.rate;
            src.connect(gain);
            let when = ctxTimeOf(s, Math.max(from, seg.start));
            let offset = Math.max(0, from - seg.start);
            if (when < ctx.currentTime) { // decoding took longer than the lead time
                offset += (ctx.currentTime - when) * s.anchor.rate;
                when = ctx.currentTime;
            }
            if (offset >= seg.buffer.duration) continue;
            src.start(when, offset);
            src.stop(ctxTimeOf(s, segEnd)); // segments overlap by up to one frame
            src.onended = () => { s.sources = s.sources.filter(x => x !== src); };
            s.sources.push(src);
        }
    } catch (e) {
        console.warn('KM3 voice-over: decoding failed', e);
    } finally {
        s.scheduling = false;
    }
}

function applyVolumes(s, v) {
    if (gain) gain.gain.value = configRead('voiceOverVolume') / 100;
    const target = configRead('voiceOverOriginalVolume') / 100;
    if (s.savedVolume === null) s.savedVolume = v.volume;
    if (Math.abs(v.volume - target) > 0.01) v.volume = target;
}

function sync() {
    const s = session;
    const v = video();
    if (!s || !s.track || !v) return;
    if (currentVideoId() !== s.videoId) return stop();
    applyVolumes(s, v);

    if (v.paused || v.seeking || v.readyState < 3) return s.anchor && silence(s);

    const now = ctx.currentTime;
    const rate = v.playbackRate || 1;
    if (s.anchor) {
        const expected = s.anchor.video + (now - s.anchor.ctx) * s.anchor.rate;
        if (rate !== s.anchor.rate || Math.abs(expected - v.currentTime) > MAX_DRIFT) silence(s);
    }
    if (!s.anchor) {
        const lead = 0.15; // time to decode and start the first segment
        s.anchor = { ctx: now + lead, video: v.currentTime + lead * rate, rate };
        s.scheduledUntil = s.anchor.video;
    }
    scheduleAhead(s, s.syncId);
}

// ---------------------------------------------------------------- session

export function isVoiceOverActive() {
    return !!session && session.videoId === currentVideoId();
}

export async function startVoiceOver() {
    const videoId = currentVideoId();
    if (!videoId) return;
    stop();
    const gen = ++generation;
    const info = videoInfo[videoId];
    if (info && info.lang === 'ru') return toast(t('km3.voiceOver.alreadyRussian'));

    const s = session = {
        videoId, track: null, sources: [], cache: new Map(), anchor: null, scheduledUntil: null,
        syncId: 0, scheduling: false, savedVolume: null, timer: null, refresh: null,
    };
    toast(t('km3.voiceOver.requesting'));
    try {
        const res = await requestTranslation(videoId, gen);
        if (!res) return;
        s.track = await loadTrack(res.url, gen);
        if (!s.track || gen !== generation) return s.track && s.track.free();
        audioContext();
        s.timer = setInterval(sync, 250);
        sync();
        toast(t('km3.voiceOver.started'));
        if (res.status === STATUS_PART_CONTENT) s.refresh = setTimeout(() => refresh(s, gen), Math.max(res.remainingTime, 30) * 1000);
    } catch (e) {
        if (gen !== generation) return;
        console.warn('KM3 voice-over failed', e);
        stop();
        toast(e && e.message === 'failed' ? t('km3.voiceOver.failed') : t('km3.voiceOver.networkError'));
    }
}

/** Yandex first returns part of a long video's translation; swap in the full track when it is done. */
async function refresh(s, gen) {
    try {
        const res = await requestTranslation(s.videoId, gen);
        if (!res || gen !== generation) return;
        const track = await loadTrack(res.url, gen);
        if (!track || gen !== generation) return track && track.free();
        silence(s);
        s.track.free();
        s.track = track;
        s.cache.clear();
        if (res.status === STATUS_PART_CONTENT) s.refresh = setTimeout(() => refresh(s, gen), Math.max(res.remainingTime, 30) * 1000);
    } catch (e) {
        console.warn('KM3 voice-over: refresh failed', e);
    }
}

export function stop() {
    generation++;
    const s = session;
    session = null;
    if (!s) return;
    clearInterval(s.timer);
    clearTimeout(s.refresh);
    silence(s);
    const v = video();
    if (v && s.savedVolume !== null) v.volume = s.savedVolume;
    if (s.track) s.track.free();
}

export function toggleVoiceOver() {
    if (isVoiceOverActive()) {
        stop();
        toast(t('km3.voiceOver.stopped'));
    } else {
        startVoiceOver();
    }
}

let lastVideoId = null;
window.addEventListener('hashchange', () => {
    const videoId = currentVideoId();
    if (videoId === lastVideoId) return;
    lastVideoId = videoId;
    if (session && session.videoId !== videoId) stop();
    // give the player response (and with it the spoken language) a moment to arrive
    if (videoId && configRead('voiceOverAuto')) setTimeout(() => currentVideoId() === videoId && !session && startVoiceOver(), 2000);
});
