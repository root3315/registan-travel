// Кнопка «Choose a tour»: плавная прокрутка к заголовку секции #tours
// и спокойная «анимация прибытия» (подсветка карточек, CSS — раздел 10).
(function () {
    'use strict';

    const tours = document.getElementById('tours');
    const button = document.querySelector('.portal-copy a[href="#tours"]');
    const head = tours && tours.querySelector('h2');
    if (!tours || !button || !head) return;

    // «Меньше движения» в системе: прыгаем сразу и ничего не анимируем
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cards = tours.querySelectorAll('.card');
    const lastCard = cards[cards.length - 1];

    // Куда прокручивать: заголовок h2 «Three routes» должен встать сразу под
    // стеклянной шапкой (80px) с небольшим зазором, чтобы карточки были видны
    const GAP = 16;
    function targetTop() {
        // высота шапки уже лежит в CSS (scroll-padding-top у html) — не дублируем число
        const space = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 80;
        return Math.max(0, Math.round(window.scrollY + head.getBoundingClientRect().top - space - GAP));
    }

    // Класс is-arriving включает CSS-анимацию; снимаем его по окончании,
    // чтобы она не мешала hover и анимации появления карточек при прокрутке
    function arrive() {
        tours.classList.remove('is-arriving');
        void tours.offsetWidth; // сброс, чтобы повторный клик проиграл анимацию заново
        tours.classList.add('is-arriving');
        // запасной таймер: если анимация не стартовала, класс всё равно уйдёт
        window.clearTimeout(arrive.timer);
        arrive.timer = window.setTimeout(function () {
            tours.classList.remove('is-arriving');
        }, 5000);
    }

    // Карточки стартуют по очереди — класс снимаем, только когда доиграла
    // ПОСЛЕДНЯЯ (animationend всплывает и от заголовка, и от первой карточки)
    tours.addEventListener('animationend', function (e) {
        if (e.animationName === 'tours-glow' && e.target === lastCard) {
            tours.classList.remove('is-arriving');
        }
    });

    button.addEventListener('click', function (e) {
        e.preventDefault(); // прокручиваем сами: якорь #tours останавливался бы выше заголовка
        const top = targetTop();
        if (reduce.matches) {
            window.scrollTo(0, top);
            return;
        }
        let done = false;
        function finish() {
            if (done) return;
            window.removeEventListener('scrollend', finish);
            // ленивые картинки могли сдвинуть вёрстку за время прокрутки — донастраиваем
            const miss = targetTop() - window.scrollY;
            if (Math.abs(miss) > 4 && !finish.retried) {
                finish.retried = true;
                window.addEventListener('scrollend', finish);
                window.scrollTo({ top: targetTop(), behavior: 'smooth' });
                return;
            }
            done = true;
            arrive();
        }
        finish.retried = false;
        window.addEventListener('scrollend', finish);
        window.setTimeout(finish, 1800); // запасной таймер: scrollend есть не везде
        window.scrollTo({ top: top, behavior: 'smooth' });
    });
})();
