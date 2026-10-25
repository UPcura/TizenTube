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
            "menuSubtitle": "The new version is built right on this device, with the voice-over and your choices below",
            "updateNowSubtitle": "Download the release, build it with your settings and install it",
            "busy": "An update is already running",
            "reinstall": {
                "title": "Rebuild this version",
                "subtitle": "Download this release again and reinstall it, e.g. to apply the choices below"
            },
            "original": "TizenTube's own",
            "icon": {
                "title": "Icon and banner",
                "subtitle": "Applied with the next update or rebuild",
                "sets": {
                    "YouTube_Red": "YouTube, red",
                    "YouTube_White": "YouTube, white",
                    "YouTube_Dark": "YouTube, dark"
                }
            },
            "name": {
                "title": "App name",
                "subtitle": "Applied with the next update or rebuild"
            },
            "package": {
                "title": "Package",
                "subtitle": "Like the YouTube TV app, the remote's YouTube button and casting open it. Another package installs as a separate app: sign in again, then remove the old one",
                "youtube": "As the YouTube TV app"
            },
            "stage": {
                "download": "Downloading the update… {{percent}}%",
                "patch": "Building the new version…",
                "sign": "Signing…",
                "install": "Confirm the installation on screen",
                "error": "Update failed: {{error}}"
            },
            "ok": {
                "title": "Got it",
                "subtitle": "This version cannot update itself yet: install one with the built-in updater"
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
            "menuSubtitle": "Новая версия собирается прямо на приставке, с переводом и вашими настройками ниже",
            "updateNowSubtitle": "Скачать релиз, собрать его с вашими настройками и установить",
            "busy": "Обновление уже идёт",
            "reinstall": {
                "title": "Пересобрать текущую версию",
                "subtitle": "Скачать этот релиз заново и переустановить, например чтобы применить настройки ниже"
            },
            "original": "Как у TizenTube",
            "icon": {
                "title": "Иконка и баннер",
                "subtitle": "Применится при следующем обновлении или пересборке",
                "sets": {
                    "YouTube_Red": "YouTube, красная",
                    "YouTube_White": "YouTube, белая",
                    "YouTube_Dark": "YouTube, тёмная"
                }
            },
            "name": {
                "title": "Название приложения",
                "subtitle": "Применится при следующем обновлении или пересборке"
            },
            "package": {
                "title": "Пакет",
                "subtitle": "Как у YouTube для ТВ — тогда его открывают кнопка YouTube на пульте и трансляция с телефона. Другой пакет ставится отдельным приложением: войдите в аккаунт заново и удалите старое",
                "youtube": "Как у YouTube для ТВ"
            },
            "stage": {
                "download": "Скачиваю обновление… {{percent}}%",
                "patch": "Собираю новую версию…",
                "sign": "Подписываю…",
                "install": "Подтвердите установку на экране",
                "error": "Не удалось обновить: {{error}}"
            },
            "ok": {
                "title": "Понятно",
                "subtitle": "Эта версия пока не умеет обновляться сама: поставьте версию со встроенным обновлением"
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
