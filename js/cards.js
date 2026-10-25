/* ==========================================================================
   Registan Travel — cards.js (3D-карточки туров)
   --------------------------------------------------------------------------
   1. Наклон: карточка поворачивается вслед за курсором, как стеклянная
      плитка. JS только считает углы и передаёт их в CSS-переменные
      --rx, --ry, --mx, --my; сам поворот и блик делает CSS.
   2. Клик в любом месте карточки открывает тур. Настоящая ссылка
      <a class="card-link"> остаётся в разметке — её видит клавиатура
      и скринридер, по ней работает «открыть в новой вкладке».
   3. «Влёт» в тур — короткий фильм из четырёх кадров (≈3 с):
      а) карточка приподнимается к зрителю, соседние уходят в размытие;
      б) её фото раскрывается из своей рамки на весь экран
         (clip-path — «окно» растёт, а само фото растягивается вместе
         с окном, поэтому стык незаметен) и медленно «наезжает» камерой;
      в) всплывает название тура, кадр держится — успеть прочитать;
      г) всё растворяется в тёмно-синем, и открывается booking.html?tour=…,
         где страница проявляется из того же синего (js/main.js)

   Анимация — только с мышью (hover: hover) и без «уменьшить движение».
   На телефоне и с «меньше движения» тур открывается сразу.
   ========================================================================== */

(function () {
    'use strict';

    const cards = document.querySelectorAll('.card');
    const fancy = window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches;
    const MAX_TILT = 8;            // максимальный наклон в градусах

    // Кривые скорости: мягкий подъём, «киношный» разгон с плавной посадкой
    // и быстрое появление с долгим торможением (для текста)
    const LIFT_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
    const FLY_EASE = 'cubic-bezier(0.7, 0, 0.15, 1)';
    const SOFT_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

    let flying = false;            // второй клик во время полёта игнорируем

    cards.forEach(function (card) {
        const link = card.querySelector('.card-link');
        const photo = card.querySelector('img');
        if (!link || !photo) {
            return;
        }

        /* ---------- 1. Наклон за курсором ---------- */
        if (fancy) {
            card.addEventListener('pointermove', function (event) {
                const rect = card.getBoundingClientRect();
                const x = (event.clientX - rect.left) / rect.width;    // от 0 до 1
                const y = (event.clientY - rect.top) / rect.height;
                card.style.setProperty('--ry', ((x - 0.5) * 2 * MAX_TILT).toFixed(2) + 'deg');
                card.style.setProperty('--rx', ((0.5 - y) * 2 * MAX_TILT).toFixed(2) + 'deg');
                card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
                card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
            });

            card.addEventListener('pointerleave', function () {
                card.style.setProperty('--rx', '0deg');
                card.style.setProperty('--ry', '0deg');
            });
        }

        /* ---------- 2. Клик по всей карточке ----------
           Один обработчик на .card ловит клики и по ссылке (всплытие),
           и по фото, тексту, цене. Enter на ссылке — тоже событие click */
        card.addEventListener('click', function (event) {
            const onLink = link.contains(event.target);

            // Ctrl/Cmd/Shift + клик — человек хочет новую вкладку или окно.
            // На ссылке браузер сделает это сам, на остальной карточке — ничего
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) {
                return;
            }
            // Человек выделял текст мышью — это не клик «открыть тур»
            if (!onLink && window.getSelection().toString() !== '') {
                return;
            }
            // Без анимации: ссылка откроется сама, остальная карточка — через JS
            if (!fancy || !document.body.animate) {
                if (!onLink) {
                    window.location.href = link.href;
                }
                return;
            }

            event.preventDefault();
            if (!flying) {
                flying = true;
                flyInto(card, photo, link.href);
            }
        });
    });

    /* ---------- 3. «Влёт» в тур ---------- */
    function flyInto(card, photo, href) {
        function go() {
            window.location.href = href;
        }
        // Страховка: если анимацию прервут (свернули вкладку) — всё равно переходим
        window.setTimeout(go, 3600);

        card.classList.add('is-flying');           // CSS гасит блик

        // Копию фото для слоя «влёта» готовим заранее, пока идёт подъём:
        // decode() распаковывает картинку, и в первом кадре раскрытия
        // не мелькнёт пустой синий прямоугольник
        const image = document.createElement('img');
        image.src = photo.currentSrc || photo.src;
        image.alt = '';
        const ready = image.decode ? image.decode().catch(function () {}) : Promise.resolve();

        // а) Подъём: карточка выпрямляется и выезжает к зрителю
        //    (translateZ при perspective = «ближе к глазу», то есть крупнее)
        const rx = card.style.getPropertyValue('--rx') || '0deg';
        const ry = card.style.getPropertyValue('--ry') || '0deg';
        const lift = card.animate([
            { transform: 'perspective(900px) translateY(-8px) rotateX(' + rx + ') rotateY(' + ry + ') translateZ(0px)' },
            {
                transform: 'perspective(900px) translateY(-16px) rotateX(0deg) rotateY(0deg) translateZ(70px)',
                boxShadow: '0 40px 90px rgba(7, 20, 47, 0.45)'
            }
        ], { duration: 340, easing: LIFT_EASE, fill: 'forwards' });

        // Фото в карточке возвращаем к масштабу 1 (при наведении оно 1.04),
        // а бейдж прячем — иначе на стыке со слоем «влёта» будет скачок
        photo.animate([{ transform: 'scale(1)' }], { duration: 340, easing: LIFT_EASE, fill: 'forwards' });
        const badge = card.querySelector('.badge');
        if (badge) {
            badge.animate([{ opacity: 0 }], { duration: 250, fill: 'forwards' });
        }

        // Соседние карточки отступают вглубь и расплываются — фокус на одной
        cards.forEach(function (other) {
            if (other !== card) {
                other.animate([{ transform: 'scale(0.9)', filter: 'blur(6px)', opacity: 0.35 }],
                    { duration: 700, easing: SOFT_EASE, fill: 'forwards' });
            }
        });

        lift.onfinish = function () {
            ready.then(function () {
                expand(card, photo, image);
                window.setTimeout(go, 2760);       // 0,34 + 2,76 ≈ 3,1 с всего
            });
        };
    }

    // б) + в) Раскрытие фото на весь экран и название тура
    function expand(card, photo, image) {
        const rect = photo.getBoundingClientRect();     // где фото сейчас (уже поднятое)
        const W = document.documentElement.clientWidth;
        const H = document.documentElement.clientHeight;

        // Итоговая рамка фото — «cover» на весь экран с тем же соотношением
        // сторон, что у фото в карточке. Одинаковые пропорции = фото
        // растягивается без искажений, а кадр совпадает с карточкой
        const ratio = rect.width / rect.height;
        let boxW = W;
        let boxH = W / ratio;
        if (boxH < H) {
            boxH = H;
            boxW = H * ratio;
        }
        const boxLeft = (W - boxW) / 2;
        const boxTop = (H - boxH) / 2;

        // Скругление верхних углов как у карточки (с учётом её увеличения)
        const radius = parseFloat(getComputedStyle(card).borderTopLeftRadius) * (rect.width / photo.offsetWidth) || 0;

        // Слой на весь экран: рамка с фото, затемнение и подпись
        const flight = document.createElement('div');
        flight.className = 'flight';
        flight.setAttribute('aria-hidden', 'true');

        const frame = document.createElement('div');
        frame.className = 'flight-photo';
        frame.style.left = boxLeft + 'px';
        frame.style.top = boxTop + 'px';
        frame.style.width = boxW + 'px';
        frame.style.height = boxH + 'px';
        frame.appendChild(image);

        const shade = document.createElement('div');
        shade.className = 'flight-shade';

        // Тёмно-синяя «шторка» для финального растворения
        const veil = document.createElement('div');
        veil.className = 'flight-veil';

        const meta = card.querySelector('.card-meta, .card-body p');
        const caption = document.createElement('div');
        caption.className = 'flight-caption';
        caption.innerHTML = '<span class="flight-meta"></span><span class="flight-line"></span><strong><span></span></strong>';
        const metaText = caption.querySelector('.flight-meta');
        const line = caption.querySelector('.flight-line');
        const title = caption.querySelector('strong span');
        metaText.textContent = meta ? meta.textContent : '';
        title.textContent = card.querySelector('h3').textContent;

        flight.append(frame, shade, caption, veil);
        document.body.appendChild(flight);

        // «Окно» сначала точно по фото карточки, потом — во весь экран
        const fromClip = 'inset(' + rect.top + 'px ' + (W - rect.right) + 'px ' + (H - rect.bottom) + 'px ' +
            rect.left + 'px round ' + radius + 'px ' + radius + 'px 0px 0px)';
        const toClip = 'inset(0px 0px 0px 0px round 0px 0px 0px 0px)';
        const fly = { duration: 760, easing: FLY_EASE, fill: 'both' };
        flight.animate([{ clipPath: fromClip }, { clipPath: toClip }], fly);

        // Само фото растёт вместе с окном (та же длительность и кривая),
        // поэтому в первый кадр оно лежит ровно поверх фото карточки
        const startMove = 'translate(' + (rect.left - boxLeft) + 'px, ' + (rect.top - boxTop) + 'px) scale(' + (rect.width / boxW) + ')';
        frame.animate([{ transform: startMove }, { transform: 'translate(0px, 0px) scale(1)' }], fly);

        // «Камера» продолжает медленно лететь внутрь кадра всё время,
        // пока он на экране, — пауза не выглядит застывшей картинкой
        image.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }],
            { duration: 2800, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)', fill: 'both' });

        // Затемнение снизу проявляется, когда фото уже большое
        shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 250, fill: 'both' });

        // Подпись: золотая линия прочерчивается, город поднимается,
        // название «выезжает» из-под невидимой кромки (у strong overflow: hidden)
        line.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
            { duration: 600, delay: 400, easing: SOFT_EASE, fill: 'both' });
        metaText.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 500, delay: 440, easing: SOFT_EASE, fill: 'both' });
        title.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }],
            { duration: 600, delay: 480, easing: SOFT_EASE, fill: 'both' });

        // г) После паузы (~1,3 с полного кадра) — плавно в тёмно-синий.
        //    booking.html начнёт с того же цвета — переход выглядит одним движением
        veil.animate([{ opacity: 0 }, { opacity: 1 }],
            { duration: 700, delay: 2060, easing: 'ease-in-out', fill: 'both' });
    }

    // Кнопка «Назад» может вернуть страницу из кэша вместе со слоем
    // «влёта» — убираем его и возвращаем карточки как были
    window.addEventListener('pageshow', function (event) {
        if (!event.persisted) {
            return;
        }
        flying = false;
        document.querySelectorAll('.flight').forEach(function (layer) { layer.remove(); });
        cards.forEach(function (card) {
            card.classList.remove('is-flying');
            // subtree: true — заодно и анимации фото и бейджа внутри карточки
            card.getAnimations({ subtree: true }).forEach(function (animation) { animation.cancel(); });
        });
    });
})();
