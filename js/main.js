/* ==========================================================================
   Registan Travel — main.js (страница бронирования)
   --------------------------------------------------------------------------
   Что делает скрипт:
     1. Живой расчёт цены: при смене тура или количества людей сразу
        показывает «Total: 3 × 120 USD = 360 USD». От 5 человек — скидка 10%.
     2. Проверка формы при отправке: без перезагрузки страницы.
        Ошибка  → красное сообщение + подсветка поля.
        Всё ок  → зелёное подтверждение с именем и суммой.
     3. Если пришли с главной по ссылке booking.html?tour=khiva —
        нужный тур уже выбран в списке.

   Базы данных нет: всё проверяется и подтверждается только в браузере.
   ========================================================================== */

'use strict';

/* ---------- Настройки ---------- */
const DISCOUNT_FROM  = 5;     // скидка начинается с этого числа путешественников
const DISCOUNT_RATE  = 0.10;  // размер скидки (10%)
const MIN_TRAVELLERS = 1;
const MAX_TRAVELLERS = 12;

/* ---------- Элементы страницы ---------- */
const form             = document.getElementById('booking-form');
const nameInput        = document.getElementById('name');
const emailInput       = document.getElementById('email');
const tourSelect       = document.getElementById('tour');
const travellersInput  = document.getElementById('travellers');
const dateInput        = document.getElementById('date');
const priceTotal       = document.getElementById('price-total');
const priceNote        = document.getElementById('price-note');
const formMessage      = document.getElementById('form-message');
const submitBtn        = document.getElementById('submit-btn');
const SUBMIT_TEXT      = 'Send booking request';


/* ==========================================================================
   1. РАСЧЁТ ЦЕНЫ
   ========================================================================== */

/**
 * Считает стоимость. Отдельная «чистая» функция: на вход числа,
 * на выход числа — её легко проверить и объяснить.
 * @param {number} price  цена тура за одного человека
 * @param {number} people количество путешественников
 * @returns {{subtotal:number, discount:number, total:number}}
 */
function calculateTotal(price, people) {
    const subtotal = price * people;
    // Округляем до центов: дробные числа в JS бывают неточными (0.1 + 0.2)
    const discount = people >= DISCOUNT_FROM
        ? Math.round(subtotal * DISCOUNT_RATE * 100) / 100
        : 0;
    return {
        subtotal: subtotal,
        discount: discount,
        total: subtotal - discount
    };
}

/**
 * 157.5 → «157.50 USD», 360 → «360 USD» (без лишних нулей у целых).
 */
function formatUSD(amount) {
    const text = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    return text + ' USD';
}

/** Цена выбранного тура — из атрибута data-price у <option>. */
function getTourPrice() {
    const option = tourSelect.options[tourSelect.selectedIndex];
    return Number(option.dataset.price);
}

/** Название выбранного тура без длительности: «Khiva Itchan Kala». */
function getTourName() {
    const option = tourSelect.options[tourSelect.selectedIndex];
    return option.textContent.split(' — ')[0];
}

/** Количество людей как число (пустое поле → NaN).
 *  Number, а не parseInt: parseInt('2.5') молча дал бы 2,
 *  а Number('2.5') = 2.5 — и проверка isInteger его честно отклонит. */
function getTravellers() {
    if (travellersInput.value === '') {
        return NaN;
    }
    return Number(travellersInput.value);
}

/** Количество людей в допустимом диапазоне 1–12? */
function isValidTravellers(people) {
    return Number.isInteger(people) && people >= MIN_TRAVELLERS && people <= MAX_TRAVELLERS;
}

/** Пользователь попросил в системе «меньше движения»? Тогда без анимаций. */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Последняя показанная сумма — чтобы реагировать только на настоящие изменения */
let lastTotal = '';

/** Сумма изменилась → короткий «подскок» строки.
 *  element.animate() — встроенный в браузер Web Animations API:
 *  список кадров + длительность, без отдельной библиотеки.
 *  При первой загрузке страницы ничего не делаем — пользователь ещё ничего не менял */
function onPriceChanged(totalText) {
    const firstRun = lastTotal === '';
    const changed = totalText !== lastTotal;
    lastTotal = totalText;
    if (firstRun || !changed) {
        return;
    }
    if (!reduceMotion && priceTotal.animate) {      // старые браузеры без animate() — пропускаем
        priceTotal.animate(
            [{ opacity: 0.4, translate: '0 4px' }, { opacity: 1, translate: '0 0' }],
            { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
        );
    }
}

/**
 * Обновляет блок с ценой. Вызывается при каждом изменении тура
 * или количества людей — поэтому сумма видна ДО отправки формы.
 */
function updatePrice() {
    const people = getTravellers();

    // Пока в поле что-то неправильное — не показываем странную сумму
    if (!isValidTravellers(people)) {
        priceTotal.textContent = 'Total: —';
        priceNote.textContent = 'Enter from 1 to 12 travellers.';
        return;
    }

    const price = getTourPrice();
    const result = calculateTotal(price, people);

    if (result.discount > 0) {
        // «Total: 6 × 120 USD = 720 USD − 10% = 648 USD»
        priceTotal.textContent =
            'Total: ' + people + ' × ' + formatUSD(price) + ' = ' + formatUSD(result.subtotal) +
            ' − 10% = ' + formatUSD(result.total);
        priceNote.textContent = 'Group discount applied: you save ' + formatUSD(result.discount) + '.';
    } else {
        // «Total: 3 × 120 USD = 360 USD»
        priceTotal.textContent =
            'Total: ' + people + ' × ' + formatUSD(price) + ' = ' + formatUSD(result.total);

        // Подсказываем, сколько людей не хватает до скидки
        const missing = DISCOUNT_FROM - people;
        priceNote.textContent = 'Add ' + missing + ' more traveller' + (missing > 1 ? 's' : '') +
            ' to get 10% off.';
    }

    onPriceChanged(priceTotal.textContent);
}


/* ==========================================================================
   2. ПРОВЕРКА ФОРМЫ
   ========================================================================== */

/** Показывает ошибку у конкретного поля: красная рамка + текст под ним. */
function showFieldError(input, message) {
    const field = input.closest('.field');
    // Снять класс → прочитать offsetWidth (браузер пересчитывает раскладку) →
    // снова поставить класс. Так анимация «встряхивания» проигрывается
    // заново даже при повторной ошибке в том же поле
    field.classList.remove('is-error');
    void field.offsetWidth;
    field.classList.add('is-error');
    input.setAttribute('aria-invalid', 'true');
    document.getElementById(input.id + '-error').textContent = message;
}

/** Убирает ошибку с поля. */
function clearFieldError(input) {
    input.closest('.field').classList.remove('is-error');
    input.removeAttribute('aria-invalid');
    document.getElementById(input.id + '-error').textContent = '';
}

/** Показывает общее сообщение над формой: type = 'error' | 'success'. */
function showMessage(type, text) {
    formMessage.className = 'alert alert-' + type;
    formMessage.textContent = text;   // textContent, а не innerHTML — имя
                                      // пользователя не сможет вставить HTML
    formMessage.hidden = false;
}

/**
 * Простая проверка email по заданию: должен быть символ @,
 * и он не может стоять первым или последним («@mail.ru», «ivan@» — ошибка).
 */
function isValidEmail(email) {
    const at = email.indexOf('@');
    return at > 0 && at < email.length - 1;
}

/** Сегодняшняя дата в формате YYYY-MM-DD по ЛОКАЛЬНОМУ времени
 *  (toISOString() дал бы дату по UTC — в Ташкенте ночью это вчера). */
function todayISO() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
}

/** «2026-11-01» → «1 November 2026» — так дату читать приятнее.
 *  'T00:00' в конце — чтобы дата считалась по местному времени, а не по UTC. */
function formatDate(isoDate) {
    return new Date(isoDate + 'T00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

/** Возвращает форму в обычное состояние, как только человек что-то меняет:
 *  прячем старое сообщение (иначе там висела бы устаревшая сумма)
 *  и снова включаем кнопку отправки. */
function resetFormState() {
    formMessage.hidden = true;
    submitBtn.disabled = false;
    submitBtn.textContent = SUBMIT_TEXT;
}

/**
 * Обработчик отправки формы.
 * event.preventDefault() отменяет стандартную отправку — страница
 * не перезагружается, всё происходит на месте.
 */
function handleSubmit(event) {
    event.preventDefault();

    const name = nameInput.value.trim();     // trim(): строка из пробелов = пустая
    const email = emailInput.value.trim();
    const people = getTravellers();
    let firstInvalid = null;                 // сюда поставим курсор после проверки

    // Сначала снимаем старые ошибки
    [nameInput, emailInput, travellersInput, dateInput].forEach(clearFieldError);

    if (name === '') {
        showFieldError(nameInput, 'Please enter your name.');
        firstInvalid = firstInvalid || nameInput;
    }

    if (!isValidEmail(email)) {
        showFieldError(emailInput, 'Enter an email with @ in the middle, e.g. you@example.com');
        firstInvalid = firstInvalid || emailInput;
    }

    if (!isValidTravellers(people)) {
        showFieldError(travellersInput, 'Choose from 1 to 12 travellers.');
        firstInvalid = firstInvalid || travellersInput;
    }

    // Строки YYYY-MM-DD можно сравнивать как текст — порядок совпадает с датами
    if (dateInput.value === '') {
        showFieldError(dateInput, 'Choose a date for your tour.');
        firstInvalid = firstInvalid || dateInput;
    } else if (dateInput.value < todayISO()) {
        showFieldError(dateInput, 'This date has passed. Pick today or a later date.');
        firstInvalid = firstInvalid || dateInput;
    }

    // Есть ошибки → красное сообщение и фокус на первое неправильное поле
    // (aria-describedby у поля зачитает и текст его ошибки)
    if (firstInvalid) {
        showMessage('error', 'Please fix the highlighted fields and try again.');
        firstInvalid.focus();
        return;
    }

    // Всё в порядке → зелёное подтверждение с именем и суммой
    const result = calculateTotal(getTourPrice(), people);
    showMessage('success',
        'Thank you, ' + name + '! Your request for "' + getTourName() + '" on ' +
        formatDate(dateInput.value) + ' (' + people + ' traveller' + (people > 1 ? 's' : '') +
        ') is received. Total: ' + formatUSD(result.total) +
        '. We will email you within one working day.');

    // Кнопка показывает, что запрос ушёл, и не даёт отправить его дважды
    submitBtn.disabled = true;
    submitBtn.textContent = 'Request sent';         // галочку ✓ добавляет CSS (::before)

    // Фокус на сообщение: страница сама прокрутится к нему,
    // а пользователь клавиатуры/скринридера окажется прямо на подтверждении
    formMessage.focus();
}


/* ==========================================================================
   3. ЗАПУСК
   ========================================================================== */

/** Выбирает тур из адреса страницы: booking.html?tour=samarkand */
function preselectTourFromUrl() {
    const tour = new URLSearchParams(window.location.search).get('tour');
    const exists = Array.from(tourSelect.options).some(function (option) {
        return option.value === tour;
    });
    if (exists) {
        tourSelect.value = tour;
        // Пришли из карточки тура — страница проявится из тёмно-синего,
        // в котором закончился «влёт» (style.css, раздел 7)
        document.body.classList.add('is-arriving');
    }
}

// Скрипт подключён только на booking.html. Если формы на странице нет
// (например, скрипт случайно подключили к другой странице) — ничего не делаем.
if (form) {
    dateInput.min = todayISO();    // в календаре нельзя выбрать прошедший день
    preselectTourFromUrl();
    updatePrice();                 // первый расчёт сразу при загрузке

    // 'change' — для списка, 'input' — срабатывает на каждую цифру и стрелки
    tourSelect.addEventListener('change', updatePrice);
    travellersInput.addEventListener('input', updatePrice);

    // Как только человек начал исправлять поле — убираем красную подсветку
    [nameInput, emailInput, travellersInput, dateInput].forEach(function (input) {
        input.addEventListener('input', function () {
            clearFieldError(input);
        });
    });

    // Любая правка в форме убирает старое сообщение и включает кнопку.
    // 'input' — для текстовых полей, 'change' — для списка и календаря
    form.addEventListener('input', resetFormState);
    form.addEventListener('change', resetFormState);

    form.addEventListener('submit', handleSubmit);
}
