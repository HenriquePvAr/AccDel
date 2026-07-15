# Setup local do Cain Garçom

## Requisitos

Node compatível com os lockfiles, PostgreSQL e as variáveis descritas em `apps/api/.env.example`. Credenciais ficam apenas em arquivos locais ignorados.

## Banco e API

```powershell
npm.cmd install
npm.cmd run api:prisma:generate
npm.cmd run api:prisma:deploy
npm.cmd run api:dev
```

## PWA

```powershell
Set-Location apps/waiter-app
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev
```

Defina `VITE_API_URL` para a API. Em produção, publique `dist` em HTTPS com fallback de SPA e mantenha a API na origem configurada pela CSP.

## Validação do app

```powershell
Set-Location apps/waiter-app
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

O E2E sobe a aplicação com API simulada e usa Chrome local. Para validar a integração real, execute API e banco isolados, crie uma loja de teste e use contas `waiter`/`manager` sem credenciais de produção.
