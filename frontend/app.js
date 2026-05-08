/* --------------------------------------------------------------
   3️⃣ UI + запрос к Ollama (gpt‑oss:120b‑cloud)
   -------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    // ── UI‑элементы -------------------------------------------------
    const txtInput      = document.getElementById('inputText');
    const selectEff     = document.getElementById('effectSelect');
    const btnToggle     = document.getElementById('toggleBtn');

    const aiContainer   = document.getElementById('aiContainer');
    const aiPrompt      = document.getElementById('aiPrompt');
    const btnGenerateAI = document.getElementById('generateAiBtn');
    const toggleCodeBtn = document.getElementById('toggleCodeBtn');
    const aiResult      = document.getElementById('aiResult');

    const output        = document.getElementById('output');
    const workspace     = document.querySelector('.workspace');

    // ── Состояние ---------------------------------------------------
    let isRunning = false;
    let currentEffect = 'none';
    let activeInteractive = null;   // имя текущего интерактивного эффекта

    // ── Показ/скрытие блока ИИ‑описания -----------------------------
    const updateAIVisibility = () => {
        if (selectEff.value === 'ai') {
            aiContainer.classList.remove('hidden');
        } else {
            aiContainer.classList.add('hidden');
            aiResult.classList.add('hidden');
            aiResult.textContent = '';
            toggleCodeBtn.classList.add('hidden');
            output.classList.remove('customAiEffect');
        }
    };
    selectEff.addEventListener('change', () => {
        // Если в процессе работы меняем эффект – очистим прежний интерактивный
        if (isRunning) {
            cleanupInteractiveEffect();      // уберём прошлый обработчик
            applyEffect(selectEff.value);    // применим новый (css‑класс или interactive)
            initInteractiveEffect(selectEff.value);
        }
        updateAIVisibility();
    });
    updateAIVisibility();   // запуск

    // ── Параметры Ollama -------------------------------------------
    const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';
    const MODEL_NAME = 'gpt-oss:120b-cloud';

    /**
     * Делает запрос к Ollama и возвращает чистый CSS‑текст.
     * @param {string} description – описание желаемого эффекта.
     * @returns {Promise<string>}
     */
    async function generateCssFromAI(description) {
        const prompt = `
Сгенерируй CSS‑анимацию, полностью соответствующую следующему описанию:
"${description}"
Требования:
1. Объяви @keyframes с именем "customAiAnimation".
2. Объяви класс ".customAiEffect", использующий эту анимацию,
   длительность 3 сек, бесконечный цикл, linear.
3. Верни **только** CSS‑текст без каких‑либо пояснений,
   без markdown‑обрамления (без \`\`\`css … \`\`\`).
`;

        const payload = {
            model: MODEL_NAME,
            prompt: prompt,
            // Пытаемся отключить потоковый вывод, но будем готовы к fallback‑варианту.
            stream: false,
            options: { temperature: 0.0, num_predict: 800 }
        };

        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`Ollama error ${response.status}: ${txt}`);
        }

        // Получаем полностью как текст – может быть один JSON‑объект или несколько.
        const raw = await response.text();

        // Попытка разобрать единый объект.
        let css = '';
        try {
            const parsed = JSON.parse(raw);
            if (parsed.response) css = parsed.response;
        } catch (e) {
            // Если не удалось – обрабатываем как поток (много строк JSON)
            const lines = raw.split('\n').filter(l => l.trim().startsWith('{'));
            for (const line of lines) {
                try {
                    const obj = JSON.parse(line);
                    if (obj.response) css = obj.response; // берём последнюю часть
                } catch (_) { /* ignore */ }
            }
        }

        if (!css) {
            console.error('Ответ Ollama не содержит CSS:', raw);
            throw new Error('Не удалось извлечь CSS из ответа Ollama.');
        }

        // Убираем markdown‑обрамления, если вдруг они есть
        css = css
            .replace(/^```(css)?\n?/, '')
            .replace(/```$/g, '')
            .trim();

        return css;
    }

    // ── Кнопка «Сгенерировать CSS» ---------------------------------
    btnGenerateAI.addEventListener('click', async () => {
        const description = aiPrompt.value.trim();
        if (!description) {
            alert('Опишите желаемый эффект.');
            return;
        }

        btnGenerateAI.disabled = true;
        btnGenerateAI.textContent = 'Генерируем…';
        aiResult.classList.add('hidden');
        aiResult.textContent = '';

        try {
            const css = await generateCssFromAI(description);

            // Показать код пользователю
            aiResult.textContent = css;
            aiResult.classList.remove('hidden');

            // Сделать кнопку «Показать/Скрыть код» видимой
            toggleCodeBtn.classList.remove('hidden');
            toggleCodeBtn.textContent = 'Скрыть код';

            // Вставляем/обновляем <style id="dynamicAi">
            let styleTag = document.getElementById('dynamicAi');
            if (!styleTag) {
                styleTag = document.createElement('style');
                styleTag.id = 'dynamicAi';
                document.head.appendChild(styleTag);
            }
            styleTag.textContent = css;

            // Применяем класс к выводу
            output.classList.remove('customAiEffect');
            output.classList.add('customAiEffect');
            currentEffect = 'customAiEffect';
        } catch (err) {
            console.error(err);
            alert('Не удалось сгенерировать CSS. Смотрите консоль браузера.');
        } finally {
            btnGenerateAI.disabled = false;
            btnGenerateAI.textContent = 'Сгенерировать CSS';
        }
    });

    // ── Кнопка «Показать/Скрыть код» --------------------------------
    toggleCodeBtn.addEventListener('click', () => {
        if (aiResult.classList.contains('hidden')) {
            aiResult.classList.remove('hidden');
            toggleCodeBtn.textContent = 'Скрыть код';
        } else {
            aiResult.classList.add('hidden');
            toggleCodeBtn.textContent = 'Показать код';
        }
    });

    // ── Применение обычных (не‑интерактивных) эффектов -------------
    const applyEffect = (eff) => {
        // Убираем все известные CSS‑классы (включая кастомный ИИ‑эффект)
        output.classList.remove(
            'fade', 'rotate', 'scale', 'color', 'bounce',
            'customAiEffect'
        );
        if (eff && eff !== 'none') output.classList.add(eff);
    };

    // ── Интерактивные эффекты (runaway / follow) --------------------
    const interactiveEffects = {
        runaway: {
            start() {
                // Делаем элемент абсолютным
                output.style.position = 'absolute';
                output.style.display = 'inline-block';
                output.style.width = 'auto';
                output.style.height = 'auto';

                const ws = workspace.getBoundingClientRect();
                const out = output.getBoundingClientRect();

                // Центрируем внутри рабочей зоны
                const initLeft = (ws.width - out.width) / 2;
                const initTop  = (ws.height - out.height) / 2;
                output.style.left = `${initLeft}px`;
                output.style.top  = `${initTop}px`;

                // Обработчик перемещения
                interactiveEffects.runaway._handler = (e) => {
                    const ws = workspace.getBoundingClientRect();
                    const out = output.getBoundingClientRect();

                    const centerX = out.left + out.width / 2;
                    const centerY = out.top + out.height / 2;

                    const dx = centerX - e.clientX;
                    const dy = centerY - e.clientY;

                    // Шаг отдаления – можно менять
                    const step = 5;
                    const moveX = dx > 0 ? step : -step;
                    const moveY = dy > 0 ? step : -step;

                    // Текущие координаты относительно workspace
                    const curLeft = parseFloat(output.style.left) || 0;
                    const curTop  = parseFloat(output.style.top)  || 0;

                    let newLeft = curLeft + moveX;
                    let newTop  = curTop  + moveY;

                    // Ограничиваем границы workspace
                    newLeft = Math.max(0, Math.min(newLeft, ws.width  - out.width));
                    newTop  = Math.max(0, Math.min(newTop,  ws.height - out.height));

                    output.style.left = `${newLeft}px`;
                    output.style.top  = `${newTop}px`;
                };

                workspace.addEventListener('mousemove', interactiveEffects.runaway._handler);
                activeInteractive = 'runaway';
            },
            stop() {
                workspace.removeEventListener('mousemove', interactiveEffects.runaway._handler);
                // Возврат к исходному виду (flex‑центрирование)
                output.style.position = '';
                output.style.left = '';
                output.style.top = '';
                output.style.display = '';
                output.style.width = '';
                output.style.height = '';
                // Пересчитаем позицию в flex‑режиме (браузер сам центрирует)
            }
        },

        follow: {
            start() {
                output.style.position = 'absolute';
                output.style.display = 'inline-block';
                output.style.width = 'auto';
                output.style.height = 'auto';

                interactiveEffects.follow._handler = (e) => {
                    const ws = workspace.getBoundingClientRect();
                    const out = output.getBoundingClientRect();

                    // Позиция курсора внутри workspace
                    let x = e.clientX - ws.left - out.width / 2;
                    let y = e.clientY - ws.top  - out.height / 2;

                    // Ограничиваем границы
                    x = Math.max(0, Math.min(x, ws.width  - out.width));
                    y = Math.max(0, Math.min(y, ws.height - out.height));

                    output.style.left = `${x}px`;
                    output.style.top  = `${y}px`;
                };

                workspace.addEventListener('mousemove', interactiveEffects.follow._handler);
                activeInteractive = 'follow';
            },
            stop() {
                workspace.removeEventListener('mousemove', interactiveEffects.follow._handler);
                output.style.position = '';
                output.style.left = '';
                output.style.top = '';
                output.style.display = '';
                output.style.width = '';
                output.style.height = '';
            }
        }
    };

    /** Запуск интерактивного эффекта, если он поддерживается */
    function initInteractiveEffect(name) {
        if (interactiveEffects[name]) {
            interactiveEffects[name].start();
        }
    }

    /** Остановка текущего интерактивного эффекта */
    function cleanupInteractiveEffect() {
        if (activeInteractive && interactiveEffects[activeInteractive]) {
            interactiveEffects[activeInteractive].stop();
            activeInteractive = null;
        }
    }

    // ── Кнопка Старт / Стоп ---------------------------------------
    btnToggle.addEventListener('click', () => {
        if (!isRunning) {                                   // ---------- Старт ----------
            const txt = txtInput.value.trim() || 'Текст по умолчанию…';
            output.textContent = txt;

            // Если выбран ИИ‑эффект, но пользователь ещё не сгенерировал CSS
            if (selectEff.value === 'ai' && !output.classList.contains('customAiEffect')) {
                alert('Сначала нажмите «Сгенерировать CSS».');
                return;
            }

            const eff = selectEff.value;
            currentEffect = (eff === 'ai') ? 'customAiEffect' : eff;

            // Применяем обычный CSS‑класс (если есть)
            if (eff !== 'runaway' && eff !== 'follow') {
                applyEffect(currentEffect);
            }

            // Запускаем интерактивный, если нужен
            initInteractiveEffect(eff);

            btnToggle.textContent = 'Стоп';
            btnToggle.classList.remove('start');
            btnToggle.classList.add('stop');
            isRunning = true;
        } else {                                            // ---------- Стоп ----------
            cleanupInteractiveEffect();      // убираем обработчики мыши
            applyEffect('none');            // сбрасываем CSS‑классы
            output.textContent = '';
            btnToggle.textContent = 'Старт';
            btnToggle.classList.remove('stop');
            btnToggle.classList.add('start');
            isRunning = false;
        }
    });

    // ── Если пользователь меняет обычный эффект «на лету» (не ИИ) ----
    // Обработано выше в обработчике `selectEff` (очищаем интерактивный эффект).
});
