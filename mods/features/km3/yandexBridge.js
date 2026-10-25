// KM3: fetch() for Yandex through window.KM3Yandex, the Java bridge KM3 Cobalt builds carry
// (cobalt-updater/bridge). Java is free of CORS and may set any header; it only reaches Yandex hosts.
// Bridge calls are synchronous, so a request runs in the background on the Java side and is polled.

const POLL_MS = 50;
const CHUNK = 1 << 20;            // bytes of the response body read per bridge call
const GIVE_UP_MS = 5 * 60 * 1000; // Java times out on its own; this only guards against a lost request

const bridge = () => window.KM3Yandex;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function bridgeAvailable() {
    try {
        return !!bridge() && bridge().version() >= 1;
    } catch (_) {
        return false;
    }
}

// KM3 debug: why the bridge is not used (YouTube silences the console, so this goes to a toast)
export function bridgeDiagnosis() {
    const b = bridge();
    const parts = ['KM3Yandex: ' + typeof b, 'HTMLMediaElementExtension: ' + typeof window.HTMLMediaElementExtension];
    if (b) {
        try {
            parts.push('version: ' + typeof b.version + ' = ' + b.version());
        } catch (e) {
            parts.push('version threw ' + (e && e.message));
        }
        try {
            parts.push('keys: ' + Object.getOwnPropertyNames(Object.getPrototypeOf(b) || {}).concat(Object.keys(b)).join(','));
        } catch (_) { /* opaque object */ }
    }
    return parts.join('; ');
}

function toBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

function fromBase64(text, into, offset) {
    const binary = atob(text);
    for (let i = 0; i < binary.length; i++) into[offset + i] = binary.charCodeAt(i);
    return binary.length;
}

async function bodyBytes(body) {
    if (body == null) return null;
    if (typeof body === 'string') return new TextEncoder().encode(body);
    if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
    if (body instanceof ArrayBuffer) return new Uint8Array(body);
    if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    throw new Error('KM3Yandex: unsupported body type');
}

/** fetch(url, { method, headers, body, timeout }) answered with a real Response */
export async function bridgeFetch(url, options = {}) {
    const b = bridge();
    const headers = {};
    new Headers(options.headers || {}).forEach((value, name) => { headers[name] = value; });
    const body = await bodyBytes(options.body);
    const id = b.request(options.method || 'GET', String(url), JSON.stringify(headers),
        body ? toBase64(body) : '', options.timeout || 20000);
    try {
        const started = Date.now();
        let result;
        while (!(result = b.poll(id))) {
            if (Date.now() - started > GIVE_UP_MS) throw new Error('KM3Yandex: no answer');
            await sleep(POLL_MS);
        }
        result = JSON.parse(result);
        if (result.error) throw new TypeError(`KM3Yandex: ${result.error}`);

        const bytes = new Uint8Array(result.length);
        for (let offset = 0; offset < result.length;) {
            const read = fromBase64(b.read(id, offset, CHUNK), bytes, offset);
            if (!read) throw new Error('KM3Yandex: body cut short');
            offset += read;
        }
        const resHeaders = new Headers();
        for (const name in result.headers) {
            try { resHeaders.append(name, result.headers[name]); } catch (_) { /* not a valid header value */ }
        }
        const nullBody = result.status === 204 || result.status === 304;
        return new Response(nullBody ? null : bytes, { status: result.status, headers: resHeaders });
    } finally {
        b.release(id);
    }
}
