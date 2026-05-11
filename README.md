# Cain Delivery Admin

Frontend admin em React/Vite e API em NestJS/Fastify, com integração real já preparada para `orders`, `catalog` e `cash`.

## Setup local rápido

### Frontend

O frontend lê:

- `VITE_API_BASE_URL`
- fallback compatível: `VITE_API_URL`
- `VITE_DATA_SOURCE=api`

Arquivo local já criado:

- [`.env`](</C:/Users/henrique.araujo/Downloads/Cain Delivery/.env>)

### Backend

O backend lê:

- `DATABASE_URL`
- `API_PORT`
- `WEB_ORIGIN`

Arquivo local já criado:

- [`apps/api/.env`](</C:/Users/henrique.araujo/Downloads/Cain Delivery/apps/api/.env>)

### Banco

Há duas opções de banco local:

1. `docker compose up -d` em [`apps/api`](</C:/Users/henrique.araujo/Downloads/Cain Delivery/apps/api/docker-compose.yml>) se Docker estiver disponível.
2. `npx prisma dev` em [`apps/api`](</C:/Users/henrique.araujo/Downloads/Cain Delivery/apps/api>) para rodar Prisma Postgres local quando Docker não estiver disponível.

## Comandos principais

Backend:

```bash
cd apps/api
npx prisma validate
npx prisma migrate dev
npm run seed
npm run dev
```

Frontend:

```bash
npm run dev
```

Checks:

```bash
npm run build
npm run lint
npm run api:build
npm run api:lint
```
