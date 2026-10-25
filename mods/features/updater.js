// TizenTube Cobalt Update Checker
//
// KM3: this build is installed and updated by the Cobalt Updater app, which re-applies the icon,
// banner, name and its own signature. An APK fetched by InstallAppFromURL would carry the upstream
// signature and could not install over it, so there is no startup check and no download here:
// a manual check only tells whether a new release is out and points to the app.

import { buttonItem, showModal, showToast, overlayPanelItemListRenderer, overlayMessageRenderer } from '../ui/ytUI.js';
import { t } from 'i18next';

function getLatestRelease() {
    return fetch('https://api.github.com/repos/reisxd/TizenTubeCobalt/releases/latest')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        });
}

function checkForUpdates(showNoUpdateToast) {
    const currentAppVersion = window.h5vcc.tizentube.GetVersion();

    getLatestRelease()
        .then(release => {
            const latestVersion = release.tag_name.replace('v', '');
            const releaseDate = new Date(release.published_at).getTime() / 1000;

            if (latestVersion !== currentAppVersion) {
                console.info(`New version available: ${latestVersion} (current: ${currentAppVersion})`);
                const msg = `${t('settings.options.updater.releaseDate', { date: new Date(releaseDate * 1000).toLocaleString() })}\n${release.body}`.replace(/#/g, '').replace(/\*/g, '').trim();

                const buttons = [
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
