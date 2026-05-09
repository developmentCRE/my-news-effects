# backend/Dockerfile
FROM python:3.11-slim

# Системные зависимости (gcc для pandas/numpy)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc libgomp1 libffi-dev libssl-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Устанавливаем Python‑зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем всё остальное (server.py, код, возможно, utils)
COPY . .

EXPOSE 8000

# Production‑сервер (Gunicorn)
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "server:app"]
