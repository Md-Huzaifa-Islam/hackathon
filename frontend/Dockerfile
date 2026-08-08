FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_DATA_MODE=mock
ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_MOCK_SCENARIO=success
ARG VITE_MOCK_PAYMENT_RESULT=success
ARG VITE_MOCK_HOLD_TTL_SECONDS=30
ENV VITE_DATA_MODE=${VITE_DATA_MODE}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_MOCK_SCENARIO=${VITE_MOCK_SCENARIO}
ENV VITE_MOCK_PAYMENT_RESULT=${VITE_MOCK_PAYMENT_RESULT}
ENV VITE_MOCK_HOLD_TTL_SECONDS=${VITE_MOCK_HOLD_TTL_SECONDS}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV VITE_DATA_MODE=mock
ENV VITE_API_BASE_URL=http://localhost:8000
ENV VITE_MOCK_SCENARIO=success
ENV VITE_MOCK_PAYMENT_RESULT=success
ENV VITE_MOCK_HOLD_TTL_SECONDS=30
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
