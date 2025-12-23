FROM node:20-alpine AS build
WORKDIR /app

# Bağımlılıkları kopyala ve kur
COPY package*.json ./
RUN npm ci --no-fund --no-audit

# Kaynakları kopyala ve üretim build'i al
COPY . .
RUN npm run build

# Static dosyaları Nginx ile servis et
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Basit healthcheck dosyası
RUN printf 'ok\n' > /usr/share/nginx/html/health.txt

# Nginx default port
EXPOSE 80

