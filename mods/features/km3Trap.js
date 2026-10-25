// KM3 probe: Cobalt does not mirror JS console output to logcat, so surface
// uncaught errors as a native dialog that shows up on a screenshot.

function show(title, text) {
    try {
        window.h5vcc.tizentube.ShowAlertDialog(title, String(text).slice(0, 1500));
    } catch (e) { /* not on Cobalt */ }
}

// YouTube's own code throws plenty of its own errors; only report ones from our bundle
const ours = text => /cdn\.jsdelivr\.net\/gh\//.test(String(text));

window.addEventListener('error', e => {
    const text = (e.error && e.error.stack) || e.message;
    if (ours(text) || ours(e.filename)) show('KM3 error', text);
});
window.addEventListener('unhandledrejection', e => {
    const text = (e.reason && e.reason.stack) || e.reason;
    if (ours(text)) show('KM3 rejection', text);
});

window.km3Show = show;
