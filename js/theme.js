/* ==========================================================================
   Registan Travel — theme.js (светлая / тёмная тема)
   --------------------------------------------------------------------------
   Подключается в <head> — ДО отрисовки страницы, чтобы тёмная тема
   не «моргала» белым при загрузке.
     • Тема хранится в атрибуте <html data-theme="light|dark">,
       все цвета в CSS переключаются через этот атрибут.
     • data-bs-theme — то же самое для Bootstrap 5.3 (index-bootstrap.html).
     • Выбор запоминается в localStorage; если выбора нет —
       светлая тема (настройки системы не учитываются).
     • При смене отправляем событие 'themechange' — его слушает 3D-сцена
       и запускает закат или рассвет.
   ========================================================================== */

(function () {
    'use strict';

    const root = document.documentElement;
    const STORAGE_KEY = 'registan-theme';

    // localStorage может быть недоступен (приватный режим) — поэтому try/catch
    function loadTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            return null;
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (error) {
            /* не получилось сохранить — не страшно */
        }
    }

    /** Ставит тему и сообщает об этом остальным скриптам */
    function applyTheme(theme, animate) {
        root.dataset.theme = theme;
        root.setAttribute('data-bs-theme', theme);
        document.dispatchEvent(new CustomEvent('themechange', {
            detail: { theme: theme, animate: animate }
        }));
    }

    // Порядок выбора: ?theme= в адресе → сохранённый выбор → светлая тема по умолчанию
    const fromUrl = new URLSearchParams(window.location.search).get('theme');
    const initial = (fromUrl === 'dark' || fromUrl === 'light') ? fromUrl : loadTheme();
    applyTheme(initial || 'light', false);

    // Интро уже видели в этой сессии (ключ пишет registan-3d.js) — ставим класс
    // здесь, в <head>, до отрисовки: фото не мелькнёт, пока 3D-скрипт ещё грузится
    try {
        if (sessionStorage.getItem('registan-intro-seen') === '1') {
            root.classList.add('intro-seen');
        }
    } catch (error) {
        /* хранилище закрыто — интро покажем как обычно */
    }

    // Прилёт с карточки тура (booking.html?tour=…): ставим класс до отрисовки,
    // чтобы страница не мелькнула светлой до шторки из style.css (раздел 7)
    if (/booking\.html$/.test(window.location.pathname) &&
        new URLSearchParams(window.location.search).has('tour')) {
        root.classList.add('arrive-from-card');
    }

    // Кнопка в шапке появляется в DOM позже — ждём загрузки страницы
    document.addEventListener('DOMContentLoaded', function () {
        const button = document.getElementById('theme-toggle');
        if (!button) {
            return;
        }

        /** Подпись кнопки для скринридера: что произойдёт по нажатию */
        function updateButton() {
            const dark = root.dataset.theme === 'dark';
            button.setAttribute('aria-label', dark ? 'Switch to day' : 'Switch to night');
        }
        updateButton();

        button.addEventListener('click', function () {
            const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
            // Класс theme-anim включает плавный переход цветов всей страницы
            root.classList.add('theme-anim');
            applyTheme(next, true);
            saveTheme(next);
            updateButton();
            window.setTimeout(function () {
                root.classList.remove('theme-anim');
            }, 2400);
        });
    });
})();
