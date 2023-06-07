# build js files
FROM node:17-alpine as build
WORKDIR /app/

COPY --chown=node:node \
  package.json \
  package-lock.json \
  .env \
  ormconfig.json \
  ./
COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node bin/ ./bin/
COPY --chown=node:node src/ ./src/
COPY --chown=node:node config/ ./config/
COPY --chown=node:node templates/ ./templates/

RUN NODE_ENV=production npm run build
COPY --chown=node:node frontend/build/ ./dist/public/


# npm install with --omit=dev & copy from build
FROM node:17-alpine
WORKDIR /app/

COPY --chown=node:node \
  package.json \
  package-lock.json \
  ./
RUN npm --omit=dev install

COPY --from=build --chown=node:node /app/dist/ ./dist/

EXPOSE 8030

WORKDIR /app/dist/
CMD ["/usr/local/bin/node", "src/index.js"]
