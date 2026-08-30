# Stage 1: build the React app
FROM node:22-alpine AS web
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# Stage 2: FastAPI serving the API and the built frontend on one port
FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY server/app ./app
COPY --from=web /build/dist ./static

ENV FITNESS_DATA_DIR=/data \
    PYTHONUNBUFFERED=1
VOLUME ["/data"]
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
