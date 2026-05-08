FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG PUBLIC_API_URL
ARG PUBLIC_MP_PUBLIC_KEY
ENV PUBLIC_API_URL=$PUBLIC_API_URL
ENV PUBLIC_MP_PUBLIC_KEY=$PUBLIC_MP_PUBLIC_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80