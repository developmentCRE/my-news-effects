# backend/server.py
import os
import json
from flask import Flask, request, jsonify, send_from_directory, abort
from dotenv import load_dotenv
import requests

load_dotenv()               # читаем .env (BOT_TOKEN, MAX_BOT_TOKEN, OLLAMA_ORIGINS)

app = Flask(__name__, static_folder='../frontend', static_url_path='')

# ---------- 1️⃣ Статический фронтенд ----------
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)

# ---------- 2️⃣ Прокси‑обёртка к Ollama ----------
OLLAMA_URL = 'http://ollama:11434/api/generate'   # hostname = service name из docker‑compose
MODEL_NAME = 'gpt-oss:120b-cloud'

def ollama_generate(prompt: str, stream: bool = False, max_tokens: int = 800):
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": stream,
        "options": {"temperature": 0.0, "num_predict": max_tokens}
    }
    r = requests.post(OLLAMA_URL, json=payload, timeout=30)
    r.raise_for_status()
    # Ответ может быть один JSON‑объект, а может быть поток (много строк)
    # Мы возвращаем только текст последнего `response`.
    try:
        data = r.json()
        return data.get('response', '')
    except json.JSONDecodeError:
        # поток: разбираем каждую строку, берём последнюю
        last = ''
        for line in r.text.splitlines():
            try:
                obj = json.loads(line)
                if 'response' in obj:
                    last = obj['response']
            except Exception:
                pass
        return last

# ---------- 3️⃣ API‑эндпоинт, который использует Ollama ----------
@app.route('/api/generate-css', methods=['POST'])
def generate_css():
    """
    Принимает JSON:
    {
        "description": "текст, описывающий желаемый эффект"
    }
    Возвращает:
    {
        "css": "<сгенерированный CSS>"
    }
    """
    data = request.get_json(force=True)
    description = data.get('description', '').strip()
    if not description:
        return jsonify({"error": "description required"}), 400

    prompt = f'''
Сгенерируй CSS‑анимацию, полностью соответствующую следующему описанию:
"{description}"
Требования:
1. Объяви @keyframes с именем "customAiAnimation".
2. Объяви класс ".customAiEffect", использующий эту анимацию,
   длительность 3 сек, бесконечный цикл, linear.
3. Верни **только** CSS‑текст без каких‑либо пояснений,
   без markdown‑обрамления (без ```css … ```).
'''
    try:
        raw_css = ollama_generate(prompt, stream=False, max_tokens=1000)
        # убираем возможные markdown‑обрамления
        css = raw_css.strip()
        css = css.replace('```css', '').replace('```', '').strip()
        return jsonify({"css": css})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------- 4️⃣ Telegram webhook ----------
TELEGRAM_TOKEN = os.getenv('BOT_TOKEN')
if TELEGRAM_TOKEN:
    from telegram import Update, Bot
    from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes

    bot_app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()

    async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text('👋 Привет! Я бот‑визуализатор. Пиши /news, /help …')

    # простейший /news – запрос к нашему API
    async def news_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
        # здесь мы отправляем простой запрос к нашему генератору CSS‑эффектов
        # (пример: фиксированный эффект “fade”)
        await update.message.reply_text('🔹 Тестовый эффект: fade')
        # Если хотите использовать ИИ‑эффекты – делайте POST /api/generate-css из бота

    bot_app.add_handler(CommandHandler('start', start_cmd))
    bot_app.add_handler(CommandHandler('news',  news_cmd))

    @app.route(f'/telegram/{TELEGRAM_TOKEN}', methods=['POST'])
    def telegram_webhook():
        """Telegram отправляет сюда обновления через webhook."""
        bot_app.update_queue.put(request.get_json(force=True))
        return 'OK'

# ---------- 5️⃣ Max messenger webhook (пример) ----------
MAX_TOKEN = os.getenv('MAX_BOT_TOKEN')
if MAX_TOKEN:
    @app.route('/max/webhook', methods=['POST'])
    def max_webhook():
        """
        Max‑мессенджер, как правило, отправляет JSON:
        {
            "user_id": "...",
            "text": "..."
        }
        Мы отвечаем тем же форматом.
        """
        data = request.get_json(force=True)
        user_id = data.get('user_id')
        text = data.get('text', '')

        # Простейший ответ – эхо + фиксированный эффект
        reply = {
            "user_id": user_id,
            "text": f"🌀 Твой запрос получен: {text}\nЭффект: bounce"
        }
        return jsonify(reply)

# ---------- 6️⃣ Запуск ----------
if __name__ == '__main__':
    # В Render/Fly порт берётся из env‑переменной PORT (по‑умолчанию 8080)
    port = int(os.getenv('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
