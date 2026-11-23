# syntax=docker/dockerfile:1.7-labs
FROM node:26-alpine3.23

RUN mkdir -p /opt/app
RUN mkdir -p /opt/data && chown node:node /opt/data

VOLUME /opt/data

WORKDIR /opt/app
COPY --exclude=build --exclude=node_modules deps ./deps
COPY src ./src
COPY package.json .
COPY package-lock.json .
COPY config.template.toml .

RUN apk add --no-cache --virtual .build-deps python3 make g++ \
	&& npm ci --omit=dev \
	&& apk del .build-deps

USER node

ENTRYPOINT ["node", "src/run.js", "--config", "/opt/data/config.toml"]