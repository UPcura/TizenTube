// The Yandex voice-over track is a constant-bitrate MP3. Cobalt cannot decode MP3 itself,
// so the track is cut at frame boundaries and decoded with mpg123 (WASM) a segment at a time,
// right before it plays: a whole hour of PCM would not fit in a TV box's memory.

import { MPEGDecoder } from 'mpg123-decoder';

// layer III bitrates (kbps) by bitrate index, for MPEG-1 and for MPEG-2/2.5
const BITRATES = {
    1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
// sample rates by version bits (3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5)
const SAMPLE_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

// decoding starts this much earlier and the extra is dropped: the first frames after a cut
// lack the bit reservoir they borrow from and come out broken or silent
const PREROLL = 0.5;

function id3Size(b) {
    if (b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return 0; // "ID3"
    const size = ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
    return 10 + size + (b[5] & 0x10 ? 10 : 0);
}

function parseHeader(b, o) {
    if (o + 4 > b.length || b[o] !== 0xff || (b[o + 1] & 0xe0) !== 0xe0) return null;
    const version = (b[o + 1] >> 3) & 3;
    const layer = (b[o + 1] >> 1) & 3;
    if (version === 1 || layer !== 1) return null; // reserved version, or not layer III
    const kbps = BITRATES[version === 3 ? 1 : 2][b[o + 2] >> 4];
    const sampleRate = SAMPLE_RATES[version][(b[o + 2] >> 2) & 3];
    if (!kbps || !sampleRate) return null;
    const samples = version === 3 ? 1152 : 576;
    const padding = (b[o + 2] >> 1) & 1;
    return { bitrate: kbps * 1000, sampleRate, samples, length: Math.floor((samples / 8) * kbps * 1000 / sampleRate) + padding };
}

export class Mp3Track {
    constructor(bytes) {
        this.bytes = bytes;
        const start = this.findFrame(id3Size(bytes));
        if (start === null) throw new Error('no MP3 frames in the voice-over track');
        const header = parseHeader(bytes, start);
        this.header = header;
        this.dataStart = start;
        // a LAME "Info"/"Xing" frame carries metadata, not audio
        const head = String.fromCharCode.apply(null, bytes.subarray(start, start + Math.min(64, header.length)));
        if (head.indexOf('Info') !== -1 || head.indexOf('Xing') !== -1) this.dataStart += header.length;
        this.bytesPerSecond = header.bitrate / 8;
        this.duration = (bytes.length - this.dataStart) / this.bytesPerSecond;
        this.decoder = new MPEGDecoder({ enableGapless: false });
    }

    ready() {
        return this.decoder.ready;
    }

    free() {
        this.decoder.free();
    }

    /** First offset >= from where a frame starts and the next one follows it. */
    findFrame(from) {
        const b = this.bytes;
        for (let o = from; o < b.length - 4; o++) {
            const h = parseHeader(b, o);
            if (!h) continue;
            if (o + h.length >= b.length || parseHeader(b, o + h.length)) return o;
        }
        return null;
    }

    offsetOf(time) {
        return this.dataStart + Math.max(0, Math.floor(time * this.bytesPerSecond));
    }

    timeOf(offset) {
        return (offset - this.dataStart) / this.bytesPerSecond;
    }

    /**
     * Decodes [from, to) seconds into an AudioBuffer. The cut is placed by the end of the decoded
     * range, which is a known frame boundary, so frames mpg123 drops at the start do not shift it.
     */
    async decode(ctx, from, to) {
        const start = this.findFrame(this.offsetOf(from - PREROLL)) ?? this.bytes.length;
        const end = to >= this.duration ? this.bytes.length : (this.findFrame(this.offsetOf(to)) ?? this.bytes.length);
        if (start >= end) return null;

        await this.decoder.reset();
        const { channelData, samplesDecoded, sampleRate } = this.decoder.decode(this.bytes.subarray(start, end));
        if (!samplesDecoded) return null;

        const firstSampleTime = Math.min(this.timeOf(end), this.duration) - samplesDecoded / sampleRate;
        const skip = Math.max(0, Math.round((from - firstSampleTime) * sampleRate));
        const length = samplesDecoded - skip;
        if (length <= 0) return null;

        const buffer = ctx.createBuffer(channelData.length, length, sampleRate);
        channelData.forEach((channel, i) => buffer.copyToChannel(channel.subarray(skip, samplesDecoded), i));
        return { buffer, start: firstSampleTime + skip / sampleRate };
    }
}
