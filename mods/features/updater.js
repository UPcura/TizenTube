// TizenTube Cobalt Update Checker
//
// KM3: the app rebuilds a TizenTube Cobalt release into this build itself (window.KM3Updater, Java
// in the APK): it downloads the release, applies the changes and the user's choice of name, package
// and launcher art, signs the result with the key the APK carries and hands it to the system
// installer. An APK fetched by InstallAppFromURL would carry the upstream signature and could not
// install over this one. APKs from before KM3Updater can only be told that a release is out.

import { buttonItem, showModal, showToast, overlayPanelItemListRenderer, overlayMessageRenderer } from '../ui/ytUI.js';
import { configRead, configWrite } from '../config.js';
import { t } from 'i18next';

const RELEASES = 'https://api.github.com/repos/reisxd/TizenTubeCobalt/releases';

// If TizenTube is not running on Cobalt, do nothing
// Add a timeout since reloading the home page while the updater pop up is shown causes the pop up to instantly disappear.
setTimeout(() => {
    if (window.h5vcc && window.h5vcc.tizentube && km3Updater() && configRead('enableUpdater')) {
        const currentEpoch = Math.floor(Date.now() / 1000);
        if (configRead('dontCheckUpdateUntil') > currentEpoch) {
            console.info('Skipping update check until', new Date(configRead('dontCheckUpdateUntil') * 1000).toLocaleString());
        } else checkForUpdates();
    }
}, 2500);

export function km3Updater() {
    try {
        return window.KM3Updater && window.KM3Updater.version() >= 1 ? window.KM3Updater : null;
    } catch (_) {
        return null;
    }
}

const CHOICES = { updaterIconSet: 'set', updaterAppName: 'label', updaterPackage: 'package' };

/** What the installed APK was built with, and the art sets it carries; null on APKs without the choices. */
export function installedSettings() {
    const updater = km3Updater();
    if (!updater || updater.version() < 2) return null;
    try {
        return JSON.parse(updater.settings());
    } catch (_) {
        return null;
    }
}

// The choices start out as what this APK was built with (a new package starts with empty storage).
const installed = installedSettings();
if (installed) {
    for (const key of Object.keys(CHOICES)) {
        if (configRead(key) === null && installed[CHOICES[key]] !== undefined) configWrite(key, installed[CHOICES[key]]);
    }
}

function getRelease(path) {
    return fetch(`${RELEASES}/${path}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        });
}

/** The release APK for this install's ABI */
function downloadUrl(release) {
    const name = `cobalt-${km3Updater().abi()}.apk`;
    const asset = release.assets.find(asset => asset.name === name);
    if (!asset) throw new Error(`no ${name} in ${release.tag_name}`);
    return asset.browser_download_url;
}

const toast = text => showToast(t('settings.options.updater.title'), text);

/** Rebuilds and installs the release APK at url, reporting progress in toasts. */
export function startUpdate(url) {
    const updater = km3Updater();
    const choices = {};
    for (const key of Object.keys(CHOICES)) if (configRead(key) !== null) choices[CHOICES[key]] = configRead(key);
    const started = updater.version() >= 2 ? updater.start(url, JSON.stringify(choices)) : updater.start(url);
    if (!started) return toast(t('km3.updater.busy'));
    let lastStage = null;
    let lastPercent = -1;
    const timer = setInterval(() => {
        let status;
        try {
            status = JSON.parse(updater.status());
        } catch (_) {
            return;
        }
        if (status.stage === 'download') {
            const percent = status.total > 0 ? Math.floor(status.done * 4 / status.total) * 25 : 0;
            if (percent !== lastPercent) {
                lastPercent = percent;
                toast(t('km3.updater.stage.download', { percent }));
            }
        } else if (status.stage !== lastStage) {
            toast(t(`km3.updater.stage.${status.stage}`, { error: status.error }));
        }
        lastStage = status.stage;
        // after "install" the system installer takes over, and replaces this app if the user agrees
        if (status.stage === 'install' || status.stage === 'error') clearInterval(timer);
    }, 1000);
}

/** Builds this very version again, to repair the install. */
export function reinstallCurrent() {
    getRelease(`tags/v${window.h5vcc.tizentube.GetVersion()}`)
        .then(release => startUpdate(downloadUrl(release)))
        .catch(error => {
            console.error('Error fetching the current release:', error);
            showToast(t('settings.options.updater.checkFailed.title'), t('settings.options.updater.checkFailed.subtitle'), null);
        });
}

function checkForUpdates(showNoUpdateToast) {
    const currentAppVersion = window.h5vcc.tizentube.GetVersion();
    const currentEpoch = Math.floor(Date.now() / 1000);

    getRelease('latest')
        .then(release => {
            const latestVersion = release.tag_name.replace('v', '');
            const releaseDate = new Date(release.published_at).getTime() / 1000;

            if (latestVersion !== currentAppVersion) {
                console.info(`New version available: ${latestVersion} (current: ${currentAppVersion})`);
                const msg = `${t('settings.options.updater.releaseDate', { date: new Date(releaseDate * 1000).toLocaleString() })}\n${release.body}`.replace(/#/g, '').replace(/\*/g, '').trim();

                const buttons = km3Updater() ? [
                    buttonItem(
                        { title: t('settings.options.updater.updateNow.title'), subtitle: t('km3.updater.updateNowSubtitle') },
                        { icon: 'DOWN_ARROW' },
                        [
                            {
                                customAction: {
                                    action: 'KM3_UPDATE_START',
                                    parameters: downloadUrl(release)
                                }
                            },
                            {
                                signalAction: {
                                    signal: 'POPUP_BACK'
                                }
                            }
                        ]
                    ),
                    buttonItem(
                        { title: t('settings.options.updater.remindLater.title'), subtitle: t('settings.options.updater.remindLater.subtitle') },
                        { icon: 'SEARCH_HISTORY' },
                        [
                            {
                                customAction: {
                                    action: 'UPDATE_REMIND_LATER',
                                    parameters: currentEpoch + 86400
                                }
                            },
                            {
                                signalAction: {
                                    signal: 'POPUP_BACK'
                                }
                            }
                        ]
                    )
                ] : [
                    buttonItem(
                        { title: t('km3.updater.ok.title'), subtitle: t('km3.updater.ok.subtitle') },
                        { icon: 'SYSTEM_UPDATE' },
                        [
                            {
                                signalAction: {
                                    signal: 'POPUP_BACK'
                                }
                            }
                        ]
                    )
                ];

                // Add an empty message so the CSS doesn't get screwed after user input
                buttons.push(overlayMessageRenderer(' '));
                buttons.push(overlayMessageRenderer(msg));

                showModal(
                    {
                        title: t('settings.options.updater.updateAvailable.title'),
                        subtitle: t('settings.options.updater.updateAvailable.subtitle', { latestVersion, currentVersion: currentAppVersion })
                    },
                    overlayPanelItemListRenderer(buttons),
                    'tt-update-modal',
                    false
                )
            } else {
                console.info('You are using the latest version of TizenTube.');
                if (showNoUpdateToast) {
                    showToast(t('settings.options.updater.upToDate.title'), t('settings.options.updater.upToDate.subtitle', { version: currentAppVersion }), null);
                }
            }
        })
        .catch(error => {
            console.error('Error fetching the latest release:', error);
            showToast(t('settings.options.updater.checkFailed.title'), t('settings.options.updater.checkFailed.subtitle'), null);
        });
}

export default checkForUpdates;
