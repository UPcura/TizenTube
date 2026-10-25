// KM3 strings, added at runtime so the fork does not touch upstream's translation files
// (they change often, and edits there would make every upstream sync conflict).

import i18n from 'i18next';

const strings = {
    en: {
        "voiceOver": {
            "title": "Video translation",
            "button": "Translate",
            "requesting": "Requesting a translation from Yandex…",
            "waiting": "Yandex is preparing the translation, this takes a few minutes",
            "waitingMinutes": "Yandex is preparing the translation, about {{minutes}} min left",
            "started": "Voice-over translation on",
            "stopped": "Voice-over translation off",
            "alreadyRussian": "This video is already in Russian",
            "failed": "Yandex could not translate this video",
            "networkError": "Cannot reach the translation server",
            "settings": {
                "title": "Video translation (Yandex)",
                "subtitle": "Russian voice-over by Yandex",
                "button": "\"Translate\" button in the player",
                "auto": "Translate every video automatically",
                "originalVolume": "Original volume",
                "originalVolumeSubtitle": "How much to lower the video's own sound under the translation",
                "volume": "Translation volume",
                "volumeSubtitle": "Volume of the Yandex voice"
            }
        },
        "updater": {
            "menuSubtitle": "Updates are rebuilt into the KM3 version right on this device",
            "updateNowSubtitle": "Download the release, rebuild it into the KM3 version and install it",
            "busy": "An update is already running",
            "reinstall": {
                "title": "Rebuild this version",
                "subtitle": "Download this release again and reinstall the KM3 build"
            },
            "stage": {
                "download": "Downloading the update… {{percent}}%",
                "patch": "Building the KM3 version…",
                "sign": "Signing…",
                "install": "Confirm the installation on screen",
                "error": "Update failed: {{error}}"
            },
            "ok": {
                "title": "Got it",
                "subtitle": "This build cannot update itself yet: install a KM3 build with the built-in updater"
            }
        }
    },
    ru: {
        "voiceOver": {
            "title": "Перевод видео",
            "button": "Перевод",
            "requesting": "Запрашиваю перевод у Яндекса…",
            "waiting": "Яндекс готовит перевод, это займёт несколько минут",
            "waitingMinutes": "Яндекс готовит перевод, осталось около {{minutes}} мин",
            "started": "Закадровый перевод включён",
            "stopped": "Закадровый перевод выключен",
            "alreadyRussian": "Видео уже на русском",
            "failed": "Яндекс не смог перевести это видео",
            "networkError": "Нет связи с сервером перевода",
            "settings": {
                "title": "Перевод видео (Яндекс)",
                "subtitle": "Закадровый перевод на русский от Яндекса",
                "button": "Кнопка «Перевод» в плеере",
                "auto": "Переводить каждое видео автоматически",
                "originalVolume": "Громкость оригинала",
                "originalVolumeSubtitle": "Насколько приглушать звук видео под переводом",
                "volume": "Громкость перевода",
                "volumeSubtitle": "Громкость голоса Яндекса"
            }
        },
        "updater": {
            "menuSubtitle": "Обновление собирается в KM3-версию прямо на приставке",
            "updateNowSubtitle": "Скачать релиз, собрать из него KM3-версию и установить",
            "busy": "Обновление уже идёт",
            "reinstall": {
                "title": "Пересобрать текущую версию",
                "subtitle": "Скачать этот релиз заново и переустановить KM3-сборку"
            },
            "stage": {
                "download": "Скачиваю обновление… {{percent}}%",
                "patch": "Собираю KM3-версию…",
                "sign": "Подписываю…",
                "install": "Подтвердите установку на экране",
                "error": "Не удалось обновить: {{error}}"
            },
            "ok": {
                "title": "Понятно",
                "subtitle": "Эта сборка пока не умеет обновляться сама: поставьте KM3-сборку со встроенным обновлением"
            }
        }
    },
};

function add() {
    for (const lang of Object.keys(strings)) {
        i18n.addResourceBundle(lang, 'translation', { km3: strings[lang] }, true, true);
    }
}

// module order does not guarantee translations/index.js has initialised i18next yet
if (i18n.isInitialized) add();
else i18n.on('initialized', add);
