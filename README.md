# Cain Delivery

Plataforma de operacao de delivery com admin React/Vite, API NestJS/Fastify, PostgreSQL/Prisma e app do motoboy.

## Integracao WhatsApp e IA

A integracao principal e a Meta WhatsApp Cloud API oficial, com webhook HMAC, eventos normalizados, outbox persistente, status de entrega/leitura, janela de 24 horas e templates. O atendente usa NVIDIA NIM com tool calling validado no backend; pedidos reais so nascem depois de confirmacao explicita e revalidacao de catalogo/precos.

O modo Evolution continua disponivel somente como legado explicitamente selecionado. Nao existe fallback automatico.

Documentacao:

- `docs/integrations/WHATSAPP_CLOUD_API.md`
- `docs/integrations/NVIDIA_AI_ATTENDANT.md`
- `docs/integrations/MESSAGING_OUTBOX.md`
- `docs/integrations/CONVERSATION_FLOW.md`
- `docs/integrations/ORDER_NOTIFICATIONS.md`
- `docs/integrations/PUBLIC_TRACKING.md`
- `docs/integrations/LOCAL_SETUP.md`

## Setup

Use Node compativel com o `package-lock.json`, instale as dependencias e configure os arquivos locais a partir dos exemplos. `.env` e credenciais nunca devem ser commitados.

```powershell
npm.cmd install
npm.cmd run api:prisma:generate
npm.cmd run api:prisma:deploy
npm.cmd run api:dev
```

Em outro terminal:

```powershell
npm.cmd run dev
```

Para desenvolvimento sem Meta/NVIDIA, deixe `WHATSAPP_PROVIDER` e `AI_PROVIDER` vazios. A selecao de um provider ativa validacao fail-fast das variaveis obrigatorias.

## Validacao

```powershell
npm.cmd run api:test
npm.cmd run api:test:integration
npm.cmd run api:build
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

O build web ainda emite aviso conhecido de chunks grandes, principalmente no mapa de motoboys.
