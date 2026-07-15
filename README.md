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

## Impressao termica

A impressao usa jobs persistentes na API e um Cain Print Agent local. O navegador nao acessa impressoras. A entrega inclui roteamento por produto/categoria, fila, leases, retry, reimpressao auditada, templates ESC/POS 58/80 mm, dry-run e driver de rede TCP.

O driver Windows/spooler ainda nao foi implementado e nenhuma impressora fisica foi acessada nesta validacao. A solucao esta pronta para piloto supervisionado, nao para producao autonoma.

Documentacao inicial:

- `docs/printing/ARCHITECTURE.md`
- `docs/printing/PRINT_AGENT.md`
- `docs/printing/LOCAL_TESTING.md`
- `docs/printing/REAL_PRINTER_VALIDATION.md`
- `docs/printing/OPERATIONAL_RUNBOOK.md`

## Cain Garçom

`apps/waiter-app` é uma PWA React/TypeScript independente para operação de salão. Garçom e gerente autenticados consultam mesas, abrem sessão, montam rascunho, enviam itens para produção, acompanham cozinha/impressão, cancelam, entregam, transferem mesa e solicitam fechamento. Preço, disponibilidade, permissões, ownership, tenant, idempotência e versões são validados na API.

O app preserva somente leitura recente e rascunho quando offline; nenhuma mutação recebe confirmação falsa. O primeiro envio e as adições posteriores criam eventos de impressão distintos. Pagamento e liberação da mesa permanecem no caixa/admin.

```powershell
Set-Location apps/waiter-app
npm.cmd install
npm.cmd run dev
```

Documentação: `docs/waiter/`. Estado atual: pronto para piloto supervisionado em staging, ainda sem homologação em dispositivo, rede ou impressora físicos.

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
npm.cmd run print-agent:typecheck
npm.cmd run print-agent:test
npm.cmd run print-agent:build
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

O build web ainda emite aviso conhecido de chunks grandes, principalmente no mapa de motoboys.
