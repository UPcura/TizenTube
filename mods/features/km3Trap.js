// KM3 probe: Cobalt does not mirror JS console output to logcat, so surface
// uncaught errors as a native dialog that shows up on a screenshot.

function show(title, text) {
    try {
        window.h5vcc.tizentube.ShowAlertDialog(title, String(text).slice(0, 1500));
    } catch (e) { /* not on Cobalt */ }
}

window.addEventListener('error', e => show('KM3 error', (e.error && e.error.stack) || e.message));
window.addEventListener('unhandledrejection', e => show('KM3 rejection', (e.reason && e.reason.stack) || e.reason));

window.km3Show = show;
