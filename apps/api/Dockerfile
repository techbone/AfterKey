FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --ignore-scripts
COPY apps/api apps/api
COPY packages/program packages/program
COPY tsconfig.json tsconfig.json
ENV NODE_ENV=production API_STORAGE=postgres API_HOST=0.0.0.0
USER node
EXPOSE 8080
CMD ["npm", "run", "start:api"]
