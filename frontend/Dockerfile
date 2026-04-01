FROM node:20-alpine AS build

ARG REACT_APP_API_BASE=/api
ENV REACT_APP_API_BASE=$REACT_APP_API_BASE

WORKDIR /app

COPY package.json ./package.json
RUN npm install

COPY public ./public
COPY src ./src

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
