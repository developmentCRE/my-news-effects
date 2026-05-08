# backend/Dockerfile
FROM python:3.11-slim

# Устанавливаем системные библиотеки (для requests + Flask)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc libgomp1 libffi-dev libssl-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .
EXPOSE 8080
CMD ["python", "server.py"]
