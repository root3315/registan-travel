/* ==========================================================================
   Registan Travel — registan-3d.js
   --------------------------------------------------------------------------
   3D-площадь Регистан внутри арки на главной странице.
   Библиотека: Three.js r149 (лежит в js/vendor/three.min.js, даёт объект THREE).

   Как устроено:
     1. Модель собрана из простых фигур (коробки, цилиндры, полусферы),
        узоры изразцов нарисованы кодом на <canvas> — никаких 3D-файлов.
     2. Небо — большая сфера со своим шейдером: градиент + диск солнца/луны.
     3. Всё освещение зависит от одного числа t: 0 = день, 1 = ночь.
        При смене темы t плавно едет 0 → 1 (закат) или 1 → 0 (рассвет):
        солнце садится за медресе, небо краснеет, загораются звёзды,
        фонари, подсветка фасадов и окна — по одному.
     4. Если WebGL недоступен или скрипт упал — в арке остаётся фото.
   ========================================================================== */

(function () {
    'use strict';

    const host = document.getElementById('registan-3d');
    if (!host || !window.THREE) {
        return;                                   // нет контейнера или библиотеки — остаётся фото
    }

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (error) {
        return;                                   // нет WebGL — остаётся фото
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- Рендерер ---------- */
    THREE.ColorManagement.legacyMode = false;     // цвета в hex = обычные sRGB-цвета, как в CSS
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    document.documentElement.classList.add('has-3d');   // CSS прячет фото и показывает canvas

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xdce9f5, 120, 420);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 1200);


    /* ======================================================================
       1. ТЕКСТУРЫ — рисуем узоры на canvas
       ====================================================================== */

    /** Создаёт canvas-текстуру: draw(ctx, size) рисует узор */
    function makeTexture(size, draw) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        draw(canvas.getContext('2d'), size);
        const texture = new THREE.CanvasTexture(canvas);
        texture.encoding = THREE.sRGBEncoding;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = 4;
        return texture;
    }

    // Изразцы порталов: синяя «решётка» ромбов с бирюзовыми звёздочками
    const tileTexture = makeTexture(256, function (ctx, s) {
        ctx.fillStyle = '#d8b88a';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#1f4f9a';
        ctx.lineWidth = 10;
        for (let i = -s; i <= s * 2; i += 64) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i, s); ctx.lineTo(i + s, 0); ctx.stroke();
        }
        ctx.fillStyle = '#2fa3a8';
        for (let x = 0; x <= s; x += 64) {
            for (let y = 0; y <= s; y += 64) {
                ctx.beginPath(); ctx.arc(x, y + 32, 9, 0, Math.PI * 2); ctx.fill();
            }
        }
    });

    // Купол: бирюзовые «рёбра» с узкими тёмными полосками
    const domeTexture = makeTexture(256, function (ctx, s) {
        for (let i = 0; i < 24; i++) {
            ctx.fillStyle = i % 2 ? '#1f8f8f' : '#2aa39b';
            ctx.fillRect(i * s / 24, 0, s / 24, s);
        }
        ctx.fillStyle = 'rgba(18, 58, 90, 0.7)';        // тёмные бороздки между рёбрами
        for (let i = 0; i < 24; i++) {
            ctx.fillRect(i * s / 24, 0, 2, s);
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';    // мелкий узор на рёбрах
        for (let y = 8; y < s; y += 22) {
            for (let i = 0; i < 24; i++) {
                ctx.fillRect(i * s / 24 + 4, y, 3, 3);
            }
        }
    });


    // «Банаи» — кладка стен, в которую вложены синие ромбы из глазурованного кирпича
    const bannaiTexture = makeTexture(256, function (ctx, s) {
        ctx.fillStyle = '#c49a6c';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(120, 82, 46, 0.55)';
        ctx.lineWidth = 1.5;
        for (let y = 0; y < s; y += 8) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
        }
        ctx.strokeStyle = '#2a5ea8';
        ctx.lineWidth = 6;
        for (let i = -s; i <= s * 2; i += 64) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + s, s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i, s); ctx.lineTo(i + s, 0); ctx.stroke();
        }
        ctx.fillStyle = '#2fa3a8';
        for (let x = 32; x < s; x += 64) {
            for (let y = 0; y <= s; y += 64) {
                ctx.fillRect(x - 5, y - 5, 10, 10);
            }
        }
    });

    // Гирих портала: восьмиконечные звёзды на кобальте — главный узор порталов
    const girihTexture = makeTexture(512, function (ctx, s) {
        ctx.fillStyle = '#1d3f8a';
        ctx.fillRect(0, 0, s, s);
        const cell = 128;
        function star(cx, cy, r, color) {
            ctx.fillStyle = color;
            for (let k = 0; k < 2; k++) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(k * Math.PI / 4);
                ctx.fillRect(-r, -r, r * 2, r * 2);
                ctx.restore();
            }
        }
        for (let x = 0; x <= s; x += cell) {
            for (let y = 0; y <= s; y += cell) {
                star(x, y, 40, '#f1e6c8');           // белая звезда-рамка
                star(x, y, 33, '#2aa6b0');           // бирюза
                star(x, y, 14, '#d9a441');           // золотой центр
                star(x + cell / 2, y + cell / 2, 12, '#f1e6c8');
            }
        }
        ctx.strokeStyle = 'rgba(241, 230, 200, 0.55)';
        ctx.lineWidth = 3;
        for (let i = 0; i <= s; i += cell / 2) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
        }
    });

    // Каллиграфическая лента: белые «буквы» на кобальте вокруг порталов
    const calligraphyTexture = makeTexture(512, function (ctx, s) {
        ctx.fillStyle = '#1b3a8c';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = '#f3efe6';
        ctx.lineCap = 'round';
        let seed = 7;
        function rnd() {                              // свой «случайный» генератор —
            seed = (seed * 9301 + 49297) % 233280;    // узор одинаковый при каждой загрузке
            return seed / 233280;
        }
        for (let row = 0; row < 8; row++) {
            const y = row * 64 + 44;
            for (let x = 8; x < s; x += 14 + rnd() * 10) {
                ctx.lineWidth = 3 + rnd() * 3;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y - 14 - rnd() * 22);   // вертикальные «алифы»
                ctx.stroke();
                if (rnd() > 0.5) {
                    ctx.beginPath();
                    ctx.arc(x + 6, y - 4, 6, 0, Math.PI);
                    ctx.stroke();
                }
            }
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, y + 4); ctx.lineTo(s, y + 4); ctx.stroke();
        }
    });

    /** Тимпан (над аркой портала): фон и рисунок у каждого медресе свой */
    function spandrelTexture(kind) {
        return makeTexture(512, function (ctx, s) {
            ctx.fillStyle = '#1d3f8a';
            ctx.fillRect(0, 0, s, s);
            // бирюзовые растительные завитки
            ctx.strokeStyle = '#2aa6b0';
            ctx.lineWidth = 6;
            for (let i = 0; i < 9; i++) {
                ctx.beginPath();
                ctx.arc((i % 3) * 200 + 40, Math.floor(i / 3) * 190 + 60, 70, 0.2, Math.PI * 1.3);
                ctx.stroke();
            }
            if (kind === 'tigers') {
                // Шердор: тигр, несущий на спине солнце с лицом, догоняет лань
                [1, -1].forEach(function (dir) {
                    ctx.save();
                    ctx.translate(dir === 1 ? 120 : s - 120, 330);
                    ctx.scale(dir, 1);                // зеркально — оба смотрят к центру
                    ctx.fillStyle = '#f3efe6';        // лань
                    ctx.beginPath(); ctx.ellipse(150, 30, 40, 22, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(192, 4, 12, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#e8a33a';        // тигр
                    ctx.beginPath(); ctx.ellipse(0, 40, 78, 32, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(76, 20, 26, 0, Math.PI * 2); ctx.fill();
                    ctx.fillRect(-60, 60, 14, 46); ctx.fillRect(40, 60, 14, 46);
                    ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 6;
                    for (let k = -50; k < 60; k += 20) {
                        ctx.beginPath(); ctx.moveTo(k, 14); ctx.lineTo(k + 8, 60); ctx.stroke();
                    }
                    ctx.strokeStyle = '#e8a33a'; ctx.lineWidth = 10;
                    ctx.beginPath(); ctx.moveTo(-76, 34); ctx.quadraticCurveTo(-130, 0, -110, -40); ctx.stroke();
                    ctx.fillStyle = '#f6c945';        // солнце с лучами
                    for (let r = 0; r < 16; r++) {
                        ctx.save(); ctx.translate(0, -40); ctx.rotate(r * Math.PI / 8);
                        ctx.fillRect(-4, -62, 8, 22); ctx.restore();
                    }
                    ctx.beginPath(); ctx.arc(0, -40, 40, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#f5e2c0';
                    ctx.beginPath(); ctx.arc(0, -40, 26, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                });
            } else if (kind === 'stars') {
                // Улугбек: «звёздное небо» — астроном Улугбек строил обсерваторию
                for (let i = 0; i < 60; i++) {
                    const x = (i * 97) % s, y = (i * 57) % s, r = 6 + (i % 3) * 4;
                    ctx.fillStyle = i % 4 ? '#f1e6c8' : '#e0a526';
                    for (let k = 0; k < 2; k++) {
                        ctx.save(); ctx.translate(x, y); ctx.rotate(k * Math.PI / 4);
                        ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
                    }
                }
            } else {
                // Тилля-Кари («позолоченная»): золотой растительный орнамент
                ctx.strokeStyle = '#e0a526';
                ctx.lineWidth = 5;
                for (let i = 0; i < 14; i++) {
                    ctx.beginPath();
                    ctx.arc((i * 83) % s, (i * 131) % s, 34 + (i % 4) * 10, 0, Math.PI * 1.6);
                    ctx.stroke();
                }
            }
        });
    }

    // Брусчатка площади: плиты с небольшим разбросом тона и швами
    const pavingTexture = makeTexture(512, function (ctx, s) {
        const slab = s / 8;
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                const tone = 186 + ((x * 37 + y * 53) % 13) - 6;
                ctx.fillStyle = 'rgb(' + tone + ',' + (tone - 8) + ',' + (tone - 22) + ')';
                ctx.fillRect(x * slab, y * slab, slab, slab);
            }
        }
        ctx.strokeStyle = '#968a76';
        ctx.lineWidth = 2;
        for (let i = 0; i <= s; i += slab) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
        }
    });


    /* ======================================================================
       2. МАТЕРИАЛЫ
       ====================================================================== */

    /** Материал с текстурой, повторённой repeatX × repeatY раз */
    function texturedMaterial(texture, repeatX, repeatY) {
        const map = texture.clone();
        map.needsUpdate = true;
        map.repeat.set(repeatX, repeatY);
        return new THREE.MeshStandardMaterial({ map: map, roughness: 0.9 });
    }

    const calligraphyMaterial = new THREE.MeshStandardMaterial({ map: calligraphyTexture, roughness: 0.6 });
    const turquoiseMaterial = new THREE.MeshStandardMaterial({ color: 0x2aa7b0, roughness: 0.4 });
    const plainDomeMaterial = new THREE.MeshStandardMaterial({ color: 0xb8875a, roughness: 0.95 });
    const plazaMaterial = new THREE.MeshStandardMaterial({ color: 0xa9a08f, roughness: 1 });   // серо-бежевый камень
    const squareMaterial = texturedMaterial(pavingTexture, 6, 5);
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0xe8d7b4, roughness: 0.9 });
    const nicheFrameMaterial = new THREE.MeshStandardMaterial({ color: 0xead9b0, roughness: 0.8 });
    const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xe0a526, metalness: 0.6, roughness: 0.35 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.6 });
    const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x4b7a3c, roughness: 1 });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });

    // Большая ниша портала: ночью внутри разгорается тёплый свет
    const nicheMaterial = new THREE.MeshStandardMaterial({
        color: 0x3b2a1e, roughness: 1, emissive: 0xffa94d, emissiveIntensity: 0
    });

    // Окна-ниши: у каждого свой материал, чтобы загорались по очереди
    const windows = [];
    function windowMaterial() {
        const material = new THREE.MeshStandardMaterial({
            color: 0x2e2118, roughness: 1, emissive: 0xffb45e, emissiveIntensity: 0
        });
        windows.push({ material: material, threshold: 0.5 + Math.random() * 0.4 });
        return material;
    }

    /** Меш с тенями — короткая запись */
    function mesh(geometry, material) {
        const m = new THREE.Mesh(geometry, material);
        m.castShadow = true;
        m.receiveShadow = true;
        return m;
    }


    /* ======================================================================
       3. ДЕТАЛИ АРХИТЕКТУРЫ
       ====================================================================== */

    /** Плоская стрельчатая арка шириной w и высотой h (основание в y = 0) */
    function archGeometry(w, h) {
        const half = w / 2;
        const spring = h - w * 0.62;            // где начинается изгиб
        const shape = new THREE.Shape();
        shape.moveTo(-half, 0);
        shape.lineTo(-half, spring);
        shape.quadraticCurveTo(-half, h - w * 0.12, 0, h);   // левая дуга к острию
        shape.quadraticCurveTo(half, h - w * 0.12, half, spring);
        shape.lineTo(half, 0);
        shape.lineTo(-half, 0);
        return new THREE.ShapeGeometry(shape, 12);
    }

    /**
     * Купол на барабане. style:
     *   'ribbed' — луковица с рёбрами (Шердор): профиль вращается вокруг оси
     *              (LatheGeometry), а потом каждую точку слегка «выдавливаем»
     *              наружу по косинусу — получаются рёбра, как у дыни
     *   'smooth' — гладкая бирюзовая полусфера (Тилля-Кари)
     *   'plain'  — невысокий кирпичный купол без глазури (Улугбек)
     */
    function dome(radius, drumHeight, style) {
        const group = new THREE.Group();
        const drum = mesh(new THREE.CylinderGeometry(radius * 0.86, radius * 0.86, drumHeight, 32),
            style === 'plain' ? plainDomeMaterial : texturedMaterial(girihTexture, 4, 1));
        drum.position.y = drumHeight / 2;
        group.add(drum);
        if (style !== 'plain') {
            // кобальтовый пояс с надписью под куполом
            const band = mesh(new THREE.CylinderGeometry(radius * 0.88, radius * 0.88, drumHeight * 0.22, 32),
                calligraphyMaterial);
            band.position.y = drumHeight * 0.86;
            group.add(band);
        }

        let cap;
        let top;
        if (style === 'ribbed') {
            const profile = [[0.86, 0], [0.99, 0.3], [1.0, 0.6], [0.9, 1.0], [0.68, 1.38],
                [0.38, 1.7], [0.1, 1.92], [0, 1.98]].map(function (p) {
                return new THREE.Vector2(p[0] * radius, p[1] * radius);
            });
            const geometry = new THREE.LatheGeometry(new THREE.SplineCurve(profile).getPoints(18), 72);
            const position = geometry.attributes.position;
            for (let i = 0; i < position.count; i++) {
                const angle = Math.atan2(position.getZ(i), position.getX(i));
                const k = 1 + 0.05 * Math.abs(Math.cos(angle * 12));
                position.setX(i, position.getX(i) * k);
                position.setZ(i, position.getZ(i) * k);
            }
            geometry.computeVertexNormals();
            cap = mesh(geometry, new THREE.MeshStandardMaterial({ map: domeTexture, roughness: 0.35, metalness: 0.1 }));
            top = radius * 1.98;
        } else {
            cap = mesh(new THREE.SphereGeometry(radius, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
                style === 'plain' ? plainDomeMaterial : turquoiseMaterial);
            cap.scale.y = style === 'plain' ? 0.9 : 1.15;
            top = radius * cap.scale.y;
        }
        cap.position.y = drumHeight;
        group.add(cap);

        if (style !== 'plain') {
            const spire = mesh(new THREE.CylinderGeometry(0.05, 0.14, radius * 0.5, 8), goldMaterial);
            spire.position.y = drumHeight + top + radius * 0.22;
            const ball = mesh(new THREE.SphereGeometry(0.16, 12, 8), goldMaterial);
            ball.position.y = drumHeight + top + radius * 0.12;
            group.add(spire, ball);
        }
        return group;
    }

    /** Минарет: цоколь, ствол в ромбах «банаи», пояс надписи,
     *  расширяющийся «сталактитовый» венец (шурфа) и плоская площадка сверху */
    function minaret(height) {
        const group = new THREE.Group();
        const plinth = mesh(new THREE.CylinderGeometry(1.5, 1.55, 1.6, 24), stoneMaterial);
        plinth.position.y = 0.8;
        const shaft = mesh(new THREE.CylinderGeometry(1.15, 1.35, height, 32), texturedMaterial(bannaiTexture, 2, 7));
        shaft.position.y = height / 2;
        const band = mesh(new THREE.CylinderGeometry(1.18, 1.18, 1.0, 32), calligraphyMaterial);
        band.position.y = height - 1.4;
        const crown = mesh(new THREE.CylinderGeometry(1.7, 1.16, 1.4, 32), texturedMaterial(girihTexture, 3, 0.6));
        crown.position.y = height + 0.7;
        const rim = mesh(new THREE.CylinderGeometry(1.78, 1.78, 0.22, 32), stoneMaterial);
        rim.position.y = height + 1.5;
        const deck = mesh(new THREE.CylinderGeometry(1.55, 1.6, 0.4, 32), texturedMaterial(tileTexture, 3, 0.3));
        deck.position.y = height + 1.8;
        group.add(plinth, shaft, band, crown, rim, deck);
        return group;
    }

    /**
     * Медресе: корпус, высокий портал (пештак) с нишей, два яруса окон,
     * угловые башенки, купола и (по желанию) два больших минарета.
     * Фасад смотрит в сторону +z, середина фасада — в точке (0, 0, 0).
     */
    function madrasah(o) {
        const group = new THREE.Group();

        // Корпус
        const body = mesh(new THREE.BoxGeometry(o.width, o.height, o.depth),
            texturedMaterial(bannaiTexture, o.width / 6, o.height / 6));
        body.position.set(0, o.height / 2, -o.depth / 2);
        group.add(body);

        // Изразцовый карниз по верху
        const cornice = mesh(new THREE.BoxGeometry(o.width, 0.9, 0.5), texturedMaterial(tileTexture, o.width / 3, 0.3));
        cornice.position.set(0, o.height - 0.45, 0.2);
        group.add(cornice);

        // Портал (пештак) — выступает вперёд и поднимается выше корпуса.
        // Лицевая сторона портала — на z = 2.8
        const H = o.portalHeight;
        const W = o.portalWidth;
        const portal = mesh(new THREE.BoxGeometry(W, H, 3.2), texturedMaterial(girihTexture, W / 5, H / 5));
        portal.position.set(0, H / 2, 1.2);
        group.add(portal);

        // Тимпан над аркой: рисунок свой у каждого медресе (тигры, звёзды, золото).
        // Стоит ЗА рамкой арки — видны только «плечи» над её изгибом
        const spandrel = mesh(new THREE.PlaneGeometry(W * 0.66, H * 0.31),
            new THREE.MeshStandardMaterial({ map: spandrelTexture(o.spandrel), roughness: 0.6 }));
        spandrel.position.set(0, H * 0.705, 2.805);
        group.add(spandrel);

        // Светлая рамка арки, тёмная глубокая ниша, внутри — изразцовая стена
        // с дверью и окнами (дверь и окна ночью светятся)
        const frame = mesh(archGeometry(W * 0.66, H * 0.8), nicheFrameMaterial);
        frame.position.set(0, 0, 2.81);
        const niche = mesh(archGeometry(W * 0.55, H * 0.74), nicheMaterial);
        niche.position.set(0, 0, 2.82);
        const inner = mesh(archGeometry(W * 0.4, H * 0.6), texturedMaterial(tileTexture, 2, 3));
        inner.position.set(0, 0, 2.83);
        const door = mesh(archGeometry(W * 0.14, H * 0.24), windowMaterial());
        door.position.set(0, 0, 2.84);
        group.add(frame, niche, inner, door);
        [-1, 1].forEach(function (side) {
            const win = mesh(archGeometry(W * 0.07, H * 0.14), windowMaterial());
            win.position.set(side * W * 0.11, H * 0.32, 2.84);
            group.add(win);
        });

        // П-образная лента с надписью вокруг арки и колонны-«пилястры» по краям
        const bandTop = mesh(new THREE.BoxGeometry(W * 0.86, H * 0.07, 0.12), calligraphyMaterial);
        bandTop.position.set(0, H * 0.9, 2.86);
        group.add(bandTop);
        [-1, 1].forEach(function (side) {
            const bandSide = mesh(new THREE.BoxGeometry(W * 0.07, H * 0.9, 0.12), calligraphyMaterial);
            bandSide.position.set(side * W * 0.395, H * 0.45, 2.86);
            const pilaster = mesh(new THREE.CylinderGeometry(0.32, 0.32, H, 16), texturedMaterial(tileTexture, 1, 6));
            pilaster.position.set(side * W / 2, H / 2, 2.8);
            group.add(bandSide, pilaster);
        });
        // Карниз-сталактиты по верху портала
        const portalTop = mesh(new THREE.BoxGeometry(W + 0.6, 0.6, 3.6), stoneMaterial);
        portalTop.position.set(0, H + 0.3, 1.2);
        group.add(portalTop);

        // Окна-ниши (худжры) в два яруса: у каждого — светлая рамка
        // и тёмная ниша, которая ночью загорается
        const columns = [];
        if (o.singleBay) {
            columns.push((W / 2 + o.width / 2) / 2);   // по одному пролёту на крыло
        } else {
            for (let x = W / 2 + 1.9; x < o.width / 2 - 1; x += o.winStep || 2.7) {
                columns.push(x);
            }
        }
        const winWidth = o.singleBay ? 2.6 : 1.5;
        [0.9, o.height * 0.5].forEach(function (y) {
            columns.forEach(function (x) {
                [-1, 1].forEach(function (side) {
                    const rim = mesh(archGeometry(winWidth + 0.5, o.height * 0.4), nicheFrameMaterial);
                    rim.position.set(side * x, y - 0.2, 0.015);
                    const win = mesh(archGeometry(winWidth, o.height * 0.36), windowMaterial());
                    win.position.set(side * x, y, 0.02);
                    group.add(rim, win);
                });
            });
        });

        // Угловые башенки (гульдасты) с маленькими куполками —
        // только если по углам нет больших минаретов
        [-1, 1].forEach(function (side) {
            if (o.minaretHeight) {
                return;
            }
            const tower = mesh(new THREE.CylinderGeometry(0.9, 1, o.height + 2.4, 16), texturedMaterial(tileTexture, 1.5, 3));
            tower.position.set(side * o.width / 2, (o.height + 2.4) / 2, 0);
            const cap = mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), stoneMaterial);
            cap.position.set(side * o.width / 2, o.height + 2.4, 0);
            group.add(tower, cap);
        });

        // Купола на крыше
        o.domes.forEach(function (d) {
            const dm = dome(d.radius, d.drum, o.domeStyle);
            dm.position.set(d.x, o.height, d.z);
            group.add(dm);
        });

        // Большие минареты по углам фасада
        if (o.minaretHeight) {
            [-1, 1].forEach(function (side) {
                const m = minaret(o.minaretHeight);
                m.position.set(side * o.width / 2, 0, 0.6);
                m.rotation.z = -side * 0.012;     // настоящие минареты заметно наклонены
                group.add(m);
            });
        }

        // Прожектор у портала: ночью снизу подсвечивает фасад
        const flood = new THREE.SpotLight(0xffc27a, 0, 70, 0.55, 0.7, 1.2);
        flood.position.set(0, 0.6, 16);
        flood.target.position.set(0, o.portalHeight * 0.55, 0);
        group.add(flood, flood.target);
        floodLights.push(flood);

        return group;
    }

    const floodLights = [];


    /* ======================================================================
       4. СБОРКА ПЛОЩАДИ
       ====================================================================== */
    const world = new THREE.Group();
    scene.add(world);

    // Земля и сама площадь
    const ground = mesh(new THREE.PlaneGeometry(600, 600), texturedMaterial(pavingTexture, 120, 120));
    ground.rotation.x = -Math.PI / 2;
    world.add(ground);
    const square = mesh(new THREE.PlaneGeometry(30, 26), squareMaterial);
    square.rotation.x = -Math.PI / 2;
    square.position.set(0, 0.02, -2);
    world.add(square);
    // Светлая дорожка к порталу Тилля-Кари и два газона
    const walkway = mesh(new THREE.PlaneGeometry(3.2, 24), stoneMaterial);
    walkway.rotation.x = -Math.PI / 2;
    walkway.position.set(0, 0.03, -2);
    world.add(walkway);
    const lawnMaterial = new THREE.MeshStandardMaterial({ color: 0x6f8f4e, roughness: 1 });
    [-8, 8].forEach(function (x) {
        const lawn = mesh(new THREE.BoxGeometry(9, 0.15, 1.6), lawnMaterial);
        lawn.position.set(x, 0.08, 8.8);
        world.add(lawn);
    });
    // Бордюр площади
    [[0, 11, 30, 0.6], [0, -15, 30, 0.6], [-15, -2, 0.6, 26], [15, -2, 0.6, 26]].forEach(function (b) {
        const kerb = mesh(new THREE.BoxGeometry(b[2], 0.35, b[3]), stoneMaterial);
        kerb.position.set(b[0], 0.17, b[1]);
        world.add(kerb);
    });

    // Тилля-Кари — в глубине, фасадом к зрителю
    const tillaKari = madrasah({
        width: 38, height: 7.4, depth: 9, portalWidth: 14.5, portalHeight: 14, winStep: 2.3,
        spandrel: 'gold', domeStyle: 'smooth',
        domes: [{ x: -15, z: -5, radius: 3.1, drum: 3.2 }]
    });
    tillaKari.position.set(0, 0, -22);
    world.add(tillaKari);

    // Улугбек — слева, фасадом вправо
    const ulugbek = madrasah({
        width: 30, height: 9, depth: 12, portalWidth: 14, portalHeight: 21, minaretHeight: 17,
        singleBay: true, spandrel: 'stars', domeStyle: 'plain',
        domes: [{ x: -11, z: -10.5, radius: 2.6, drum: 0.3 }, { x: 11, z: -10.5, radius: 2.6, drum: 0.3 }]
    });
    ulugbek.position.set(-21, 0, -3);
    ulugbek.rotation.y = Math.PI / 2;
    world.add(ulugbek);

    // Шердор — справа, фасадом влево, с двумя ребристыми куполами
    const sherDor = madrasah({
        width: 30, height: 9, depth: 12, portalWidth: 14, portalHeight: 21, minaretHeight: 17,
        singleBay: true, spandrel: 'tigers', domeStyle: 'ribbed',
        domes: [{ x: -12.5, z: -3.5, radius: 2.7, drum: 3.6 }, { x: 12.5, z: -3.5, radius: 2.7, drum: 3.6 }]
    });
    sherDor.position.set(21, 0, -3);
    sherDor.rotation.y = -Math.PI / 2;
    world.add(sherDor);

    // Деревья по краям площади
    [[-11, -17], [11, -17], [-14, -18.5], [14, -18.5], [-16, -15], [16, -15], [-30, 14], [30, 14]].forEach(function (p) {
        const trunk = mesh(new THREE.CylinderGeometry(0.18, 0.25, 2.2, 8), trunkMaterial);
        trunk.position.set(p[0], 1.1, p[1]);
        const crown = mesh(new THREE.IcosahedronGeometry(1.6, 1), leafMaterial);
        crown.position.set(p[0], 3.2, p[1]);
        crown.scale.set(1, 1.15, 1);
        world.add(trunk, crown);
    });

    // Фонари: столб + светящийся плафон. Настоящий свет — только у четырёх,
    // остальные просто светятся (много источников света тормозят видеокарту)
    const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffc06a, emissiveIntensity: 0 });
    const lampLights = [];
    [[-13, 12], [-5, 12], [5, 12], [13, 12], [-13, -1], [13, -1], [-13, -14], [13, -14]].forEach(function (p, i) {
        const pole = mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 8), darkMetal);
        pole.position.set(p[0], 1.6, p[1]);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10), lampMaterial);
        lamp.position.set(p[0], 3.35, p[1]);
        world.add(pole, lamp);
        if (i < 4) {
            const light = new THREE.PointLight(0xffb85c, 0, 16, 2);
            light.position.set(p[0], 3.2, p[1]);
            world.add(light);
            lampLights.push(light);
        }
    });


    /* ======================================================================
       5. НЕБО, СОЛНЦЕ, ЛУНА, ЗВЁЗДЫ
       ====================================================================== */
    const skyUniforms = {
        topColor: { value: new THREE.Color() },
        horizonColor: { value: new THREE.Color() },
        sunDirection: { value: new THREE.Vector3() },
        sunColor: { value: new THREE.Color() },
        moonDirection: { value: new THREE.Vector3() },
        moonStrength: { value: 0 }
    };
    // Шейдер неба: смешиваем цвет горизонта и зенита по высоте взгляда,
    // добавляем яркий диск и мягкое сияние вокруг солнца и луны
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(800, 32, 16),
        new THREE.ShaderMaterial({
            uniforms: skyUniforms,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false,
            vertexShader: [
                'varying vec3 vDir;',
                'void main() {',
                '  vDir = normalize(position);',
                '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform vec3 topColor; uniform vec3 horizonColor;',
                'uniform vec3 sunDirection; uniform vec3 sunColor;',
                'uniform vec3 moonDirection; uniform float moonStrength;',
                'varying vec3 vDir;',
                'void main() {',
                '  vec3 d = normalize(vDir);',
                '  float h = clamp(d.y, 0.0, 1.0);',
                '  vec3 color = mix(horizonColor, topColor, pow(h, 0.55));',
                '  float s = max(dot(d, normalize(sunDirection)), 0.0);',
                '  color += sunColor * (smoothstep(0.9988, 0.9992, s) * 1.6 + pow(s, 14.0) * 0.5);',
                '  float m = max(dot(d, normalize(moonDirection)), 0.0);',
                '  color += vec3(0.96, 0.94, 0.86) * moonStrength * (smoothstep(0.9990, 0.9993, m) * 1.2 + pow(m, 80.0) * 0.08);',
                '  gl_FragColor = linearToOutputTexel(vec4(color, 1.0));',
                '}'
            ].join('\n')
        })
    );
    scene.add(sky);

    // Звёзды — случайные точки на верхней полусфере
    const starPositions = [];
    for (let i = 0; i < 900; i++) {
        const theta = Math.random() * Math.PI * 2;
        const y = 0.08 + Math.random() * 0.92;
        const r = Math.sqrt(1 - y * y);
        starPositions.push(Math.cos(theta) * r * 700, y * 700, Math.sin(theta) * r * 700);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false
    });
    scene.add(new THREE.Points(starGeometry, starMaterial));

    // Свет
    const hemi = new THREE.HemisphereLight(0xcfe3ff, 0xb39060, 0.8);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -60;
    sun.shadow.camera.right = sun.shadow.camera.top = 60;
    sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0005;
    scene.add(sun, sun.target);

    const moon = new THREE.DirectionalLight(0x9fb6ff, 0);
    scene.add(moon);


    /* ======================================================================
       6. ДЕНЬ ↔ НОЧЬ: всё зависит от одного числа t (0 — день, 1 — ночь)
       ====================================================================== */

    // Цвета неба в трёх «опорных» точках: день, закат, ночь
    const palette = {
        top:     [new THREE.Color(0x6fa6e0), new THREE.Color(0x3a4c92), new THREE.Color(0x050b1f)],
        horizon: [new THREE.Color(0xdcebf7), new THREE.Color(0xf4a35a), new THREE.Color(0x1b2a58)],
        hemiSky: [new THREE.Color(0xcfe3ff), new THREE.Color(0xf0b38a), new THREE.Color(0x2b3b70)],
        hemiGround: [new THREE.Color(0xb39060), new THREE.Color(0x8a5a3a), new THREE.Color(0x15110d)]
    };

    /** Цвет между тремя опорными: t от 0 до 1 (0.5 — закат) */
    function threeStop(stops, t, target) {
        if (t < 0.5) {
            return target.copy(stops[0]).lerp(stops[1], t * 2);
        }
        return target.copy(stops[1]).lerp(stops[2], (t - 0.5) * 2);
    }

    function smoothstep(edge0, edge1, x) {
        const k = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
        return k * k * (3 - 2 * k);
    }

    function lerp(a, b, k) {
        return a + (b - a) * k;
    }

    /** Направление на светило по высоте (elevation) и азимуту (azimuth), в радианах */
    function direction(elevation, azimuth, target) {
        return target.set(
            Math.sin(azimuth) * Math.cos(elevation),
            Math.sin(elevation),
            -Math.cos(azimuth) * Math.cos(elevation)
        );
    }

    const sunsetOrange = new THREE.Color(0xff8a3d);
    const white = new THREE.Color(0xffffff);
    let flicker = 1;

    /* --- Небесная ось: солнце и луна на одном круге, напротив друг друга ---
       Угол солнца на круге — angle (в радианах), луна всегда на angle + π.
       Каждая смена темы проворачивает круг на пол-оборота ПО ЧАСОВОЙ:
       днём → ночью солнце уходит вправо за горизонт, а луна поднимается
       слева; ночью → днём луна уходит вправо, солнце встаёт слева.
       Движение всегда слева направо, как на настоящем небе */
    const NOON = 2.2;                  // угол солнца днём: вверху слева, не за заголовком

    /** Точка на небесном круге перед камерой (камера смотрит в −z).
     *  Круг сплюснут, чтобы солнце и луна шли дугой ВНУТРИ арки:
     *  в полдень ~23° над горизонтом, садятся и встают у краёв кадра */
    function skyPoint(angle, target) {
        return target.set(Math.cos(angle) * 0.75, Math.sin(angle) * 0.56 + 0.02, -1).normalize();
    }

    /**
     * Расставляет солнце, луну, цвета неба и огни.
     * turn — сколько пол-оборотов сделало небо (0 — день, 1 — ночь, 2 — снова день…)
     */
    function applySky(turn) {
        const angle = NOON - Math.PI * turn;
        const sunDir = skyPoint(angle, skyUniforms.sunDirection.value);
        const moonDir = skyPoint(angle + Math.PI, skyUniforms.moonDirection.value);

        // «Темнота» t считается по высоте солнца: высоко — день, под горизонтом — ночь
        const t = 1 - smoothstep(-0.28, 0.32, sunDir.y);

        // Солнце: у горизонта оранжевое, высоко — белое
        // Свет падает «из-за спины» зрителя (z со знаком плюс): диск солнца
        // мы видим на небе впереди, а фасады при этом освещены, а не в тени.
        // Небольшая художественная вольность — так делают и в кино
        sun.position.set(sunDir.x, sunDir.y, Math.abs(sunDir.z)).multiplyScalar(150);
        const sunUp = Math.max(sunDir.y, 0);
        sun.intensity = Math.min(sunUp * 4, 1) * 1.25;
        sun.color.copy(sunsetOrange).lerp(white, Math.min(sunUp * 2.2, 1));
        skyUniforms.sunColor.value.copy(sun.color).multiplyScalar(smoothstep(-0.12, 0.05, sunDir.y));

        // Луна: светит, когда поднялась над горизонтом
        const moonUp = smoothstep(-0.08, 0.25, moonDir.y);
        moon.position.set(moonDir.x, moonDir.y, Math.abs(moonDir.z)).multiplyScalar(150);
        moon.intensity = moonUp * 0.45;
        skyUniforms.moonStrength.value = moonUp;

        // Небо, туман и рассеянный свет
        threeStop(palette.top, t, skyUniforms.topColor.value);
        threeStop(palette.horizon, t, skyUniforms.horizonColor.value);
        scene.fog.color.copy(skyUniforms.horizonColor.value);
        threeStop(palette.hemiSky, t, hemi.color);
        threeStop(palette.hemiGround, t, hemi.groundColor);
        hemi.intensity = lerp(0.85, 0.32, t);
        starMaterial.opacity = smoothstep(0.62, 0.95, t);

        // Огни: фонари и прожекторы, потом ниши, потом окна по одному
        const lamps = smoothstep(0.45, 0.72, t);
        lampMaterial.emissiveIntensity = lamps * 3 * flicker;
        lampLights.forEach(function (light) { light.intensity = lamps * 1.6 * flicker; });
        floodLights.forEach(function (light) { light.intensity = lamps * 2.4; });
        nicheMaterial.emissiveIntensity = smoothstep(0.55, 0.85, t) * 0.22;
        windows.forEach(function (w) {
            w.material.emissiveIntensity = smoothstep(w.threshold, w.threshold + 0.05, t) * 0.9;
        });
        realModelNight(t);
        return t;
    }


    /* ======================================================================
       7. РЕАЛЬНАЯ МОДЕЛЬ (фотограмметрия), если она подключена
       Файл js/registan-model.js кладёт сжатую модель в window.REGISTAN_GLB
       (строкой base64 — так она открывается даже без сервера, с диска).
       Пока файла нет — показывается модель из фигур выше.
       ====================================================================== */
    const MODEL = { scale: 1, x: 0, y: 0, z: 0, rotationY: 0 };   // подгонка под кадр
    const realMaterials = [];

    function loadRealModel() {
        if (!window.REGISTAN_GLB || !THREE.GLTFLoader) {
            return;
        }
        // base64 → байты → ArrayBuffer, который понимает GLTFLoader
        const binary = atob(window.REGISTAN_GLB);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const loader = new THREE.GLTFLoader();
        if (window.MeshoptDecoder) {
            loader.setMeshoptDecoder(window.MeshoptDecoder);
        }
        loader.parse(bytes.buffer, '', function (gltf) {
            const model = gltf.scene;
            model.scale.setScalar(MODEL.scale);
            model.position.set(MODEL.x, MODEL.y, MODEL.z);
            model.rotation.y = MODEL.rotationY;
            model.traverse(function (child) {
                if (child.isMesh) {
                    child.receiveShadow = true;
                    if (child.material) {
                        realMaterials.push(child.material);
                    }
                }
            });
            world.visible = false;            // прячем модель из фигур
            scene.add(model);
        });
    }

    /** У фотограмметрии свет «запечён» в текстуру — ночью просто темним её */
    function realModelNight(t) {
        realMaterials.forEach(function (material) {
            material.color.setScalar(lerp(1, 0.16, t));
        });
    }


    /* ======================================================================
       8. КАМЕРА: «архитектурный объектив»
       Камера смотрит строго горизонтально (вертикали зданий остаются
       вертикальными, как на фото), а кадр сдвигается вниз через
       setViewOffset — горизонт оказывается низко, сверху много неба
       под заголовок. Так снимают архитектуру объективом со сдвигом.
       ====================================================================== */
    const EYE = 1.8;                    // высота глаз: смотровая площадка
    let cameraZ = 45;
    let pointerX = 0;

    function resize() {
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (!width || !height) {
            return;
        }
        renderer.setSize(width, height, false);
        const aspect = width / height;
        // k — где горизонт от верха кадра (0.78 = на 78% высоты)
        const k = aspect < 1 ? 0.82 : 0.78;
        const fullHeight = height * 2 * k;
        camera.aspect = width / fullHeight;
        // Горизонтальный угол обзора фиксирован: tan(половины угла) = 0.7
        camera.fov = 2 * Math.atan(0.7 * fullHeight / width) * 180 / Math.PI;
        camera.setViewOffset(width, fullHeight, 0, 0, width, height);
        // На узкой высокой арке отходим чуть дальше
        cameraZ = 58 + Math.max(0, 1.5 - aspect) * 16;
        camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(host);
    resize();

    /* --- Вращение мышкой (или пальцем по горизонтали) ---
       Тянем по арке: влево-вправо — облёт площади по кругу (на все 360°),
       вверх-вниз — камера поднимается и смотрит на площадь сверху.
       Двойной клик возвращает исходный вид. Пока тянем, текст в арке
       становится почти прозрачным, чтобы не мешал смотреть */
    const frameElement = host.parentElement;            // .portal-frame
    const CENTER = new THREE.Vector3(0, 0, -8);         // центр площади
    const MAX_HEIGHT = 42;
    let yaw = 0;              // целевой угол облёта (радианы)
    let height = EYE;         // целевая высота камеры
    let shownYaw = 0;         // текущие (плавно догоняют целевые)
    let shownHeight = EYE;
    let userMoved = false;
    let drag = null;

    frameElement.addEventListener('pointerdown', function (event) {
        if (event.target.closest('a, button')) {
            return;                                     // кнопка в арке работает как обычно
        }
        drag = { x: event.clientX, y: event.clientY, moved: 0 };
        // «Захват» только для мыши: на телефоне он мог бы «съесть» нажатие кнопки
        if (event.pointerType === 'mouse') {
            try {
                frameElement.setPointerCapture(event.pointerId);   // тянем, даже если курсор вышел за арку
            } catch (error) {
                /* старые браузеры — не страшно */
            }
        }
    });

    frameElement.addEventListener('pointermove', function (event) {
        const rect = host.getBoundingClientRect();
        pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        if (!drag) {
            return;
        }
        drag.moved += Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y);
        if (drag.moved > 8) {
            frameElement.classList.add('is-orbiting');   // текст гаснет, только когда реально крутим
        }
        yaw -= (event.clientX - drag.x) * 0.006;
        height = Math.min(Math.max(height + (event.clientY - drag.y) * 0.09, EYE), MAX_HEIGHT);
        drag.x = event.clientX;
        drag.y = event.clientY;
        userMoved = true;
    });

    function endDrag() {
        drag = null;
        frameElement.classList.remove('is-orbiting');
    }
    frameElement.addEventListener('pointerup', endDrag);
    frameElement.addEventListener('pointercancel', endDrag);
    frameElement.addEventListener('pointerleave', function () { pointerX = 0; });

    frameElement.addEventListener('dblclick', function () {
        // доворачиваем до ближайшего «целого» оборота, чтобы не крутиться назад
        yaw = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2;
        height = EYE;
        userMoved = false;
    });


    /* ======================================================================
       9. АНИМАЦИЯ
       ====================================================================== */
    // turn — пол-обороты неба: чётное число — день, нечётное — ночь
    let turn = document.documentElement.dataset.theme === 'dark' ? 1 : 0;
    let turnFrom = turn;
    let turnTo = turn;
    let tweenStart = 0;
    const TWEEN_MS = 4200;

    function easeInOut(k) {
        return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    }

    // Смена темы (событие отправляет js/theme.js): небо делает ещё
    // пол-оборота вперёд — всегда в одну сторону, слева направо
    document.addEventListener('themechange', function (event) {
        const wantNight = event.detail.theme === 'dark';
        const isNight = turnTo % 2 === 1;
        if (wantNight === isNight) {
            return;
        }
        turnFrom = turn;
        turnTo = turnTo + 1;
        tweenStart = performance.now();
        if (reduceMotion || !event.detail.animate) {
            turn = turnFrom = turnTo;
        }
    });

    // Рисуем только когда сцена видна на экране — бережём батарею
    let visible = true;
    new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
    }).observe(host);

    let camX = 0;
    function frame(now) {
        requestAnimationFrame(frame);
        if (!visible || document.hidden) {
            return;
        }
        if (turn !== turnTo) {
            const k = Math.min((now - tweenStart) / TWEEN_MS, 1);
            turn = lerp(turnFrom, turnTo, easeInOut(k));
            if (k === 1) {
                turn = turnTo;
            }
        }
        // Фонари чуть «дышат», как живой огонь
        flicker = reduceMotion ? 1 : 0.94 + Math.sin(now * 0.011) * 0.03 + Math.sin(now * 0.023) * 0.03;
        applySky(turn);

        // Камера: облёт по кругу вокруг центра площади.
        // Пока пользователь ничего не крутил — лёгкое покачивание и параллакс
        const radius = cameraZ - CENTER.z;
        const idle = userMoved || reduceMotion ? 0 : (Math.sin(now * 0.00011) * 2 + pointerX * 3) / radius;
        camX += (idle - camX) * 0.04;
        shownYaw += (yaw - shownYaw) * 0.12;
        shownHeight += (height - shownHeight) * 0.12;
        const angle = shownYaw + camX;
        camera.position.set(
            CENTER.x + Math.sin(angle) * radius,
            shownHeight,
            CENTER.z + Math.cos(angle) * radius
        );
        // На уровне глаз смотрим горизонтально (вертикали ровные),
        // чем выше камера — тем сильнее она смотрит вниз, на площадь
        const lift = (shownHeight - EYE) / (MAX_HEIGHT - EYE);
        camera.lookAt(CENTER.x, lerp(shownHeight, 3, Math.min(lift * 1.6, 1)), CENTER.z);
        renderer.render(scene, camera);
    }

    // Интро: 3 секунды показываем настоящее фото, потом оно растворяется
    // и под ним — живая 3D-сцена (CSS-класс scene-live). Если человек
    // начал крутить площадь раньше — показываем 3D сразу
    function goLive() {
        host.classList.add('scene-live');
    }
    // Интро показываем один раз за сессию: при возврате (например, с booking.html)
    // сразу включаем 3D, а no-intro отключает затухание фото
    let introSeen = false;
    try {
        introSeen = sessionStorage.getItem('registan-intro-seen') === '1';
        sessionStorage.setItem('registan-intro-seen', '1');
    } catch (e) { /* хранилище закрыто — просто покажем интро */ }
    if (introSeen) {
        host.classList.add('no-intro');
        goLive();
    } else {
        window.setTimeout(goLive, 3000);
    }
    frameElement.addEventListener('pointerdown', goLive);

    loadRealModel();
    requestAnimationFrame(frame);
})();
