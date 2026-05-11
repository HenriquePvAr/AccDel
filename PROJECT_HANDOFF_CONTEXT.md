# Cain Delivery - Handoff Tecnico Completo

Atualizado em: 2026-05-07  
Objetivo deste arquivo: permitir que outro chat/assistente entenda o projeto com o mesmo contexto operacional e tecnico acumulado ate aqui, sem precisar reconstruir tudo por tentativa e erro.

## 1. Visao geral do produto

O projeto deixou de ser apenas um painel admin e hoje deve ser entendido como a base de uma plataforma de operacao para restaurante/delivery, com estes eixos:

1. Admin / Operacao web
2. API backend real
3. Tracking e ETA de motoboys
4. Base inicial do app do motoboy
5. Estrutura futura para app do cliente, app do garcom, motor comercial, fidelidade e assinatura

Hoje o foco implementado de verdade esta no **Admin/Operacao** + **API real** + **tracking/ETA**.  
O **app do motoboy** esta em implementacao inicial dentro de `apps/driver-app`.

## 2. Estrutura real do repositorio

Raiz:

- `src/` -> frontend admin web em React + Vite
- `apps/api/` -> backend real em NestJS + Fastify + Prisma + PostgreSQL
- `apps/driver-app/` -> novo app mobile do motoboy em Expo / React Native
- `public/` -> assets publicos do admin
- `docs/` -> material auxiliar antigo, nao e a fonte principal

Arquivos importantes na raiz:

- `package.json`
- `.env`
- `.env.example`
- `vite.config.ts`
- `tailwind.config.js`
- `eslint.config.js`

Arquivos importantes do backend:

- `apps/api/package.json`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`
- `apps/api/.env.example`
- `apps/api/src/app.module.ts`

Arquivos importantes do mobile driver app:

- `apps/driver-app/package.json`
- `apps/driver-app/app.json`
- `apps/driver-app/.env.example`
- `apps/driver-app/App.tsx`

## 3. Stack atual

### Frontend admin

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Radix UI
- Zustand
- TanStack Query
- Recharts
- Framer Motion
- Lucide React
- MapLibre GL JS

### Backend

- Node.js
- NestJS 11
- Fastify
- Prisma
- PostgreSQL
- Zod para validacao de contratos
- JWT auth

### Mapa / tracking / ETA

- MapLibre GL JS no admin
- base de mapa open source / OpenStreetMap-friendly
- OSRM para calculo de rota e ETA
- fallback de rota quando OSRM falha

### App do motoboy

- Expo SDK 54
- React Native 0.81
- React 19
- TanStack Query
- AsyncStorage
- Expo Location
- Expo Linear Gradient
- Lucide React Native

## 4. Shell visual e identidade

O admin ja tem um shell visual consolidado e esse shell deve ser preservado:

- fundo dark navy/preto
- cards escuros premium
- acento laranja Cain
- bordas suaves e brilho controlado
- sidebar fixa escura
- topbar consistente
- `PageShell`, `SectionHeader`, `StatCard`, `Card`, `Button` e derivados formam o design system base

Arquivos importantes do design system atual:

- `src/styles/globals.css`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/shared/PageShell.tsx`
- `src/components/shared/SectionHeader.tsx`
- `src/components/shared/StatCard.tsx`

Asset visual oficial do login/admin:

- `public/auth/login-brand-panel.png`

Esse mesmo asset ja foi copiado para o app do motoboy em:

- `apps/driver-app/assets/brand/login-brand-panel.png`

## 5. Navegacao real do admin

Fonte de verdade da navegacao:

- `src/app/navigation.ts`
- `src/app/router/index.tsx`
- `src/app/layout/AdminLayout.tsx`

Rotas internas reais hoje:

- `/dashboard`
- `/orders`
- `/orders/new`
- `/orders/:orderId`
- `/dining/tables`
- `/dining/waiters`
- `/kitchen`
- `/drivers`
- `/drivers/location`
- `/catalog/categories`
- `/catalog/products`
- `/catalog/promotions`
- `/catalog/coupons`
- `/catalog/preview`
- `/cash-register`
- `/history/orders`
- `/reports`
- `/settings/store`
- `/settings/users`
- `/settings/delivery`
- `/settings/preferences`
- `/login`

## 6. Estado real dos modulos

### Modulos reais com backend integrado

- Auth admin
- Orders
- Catalogo: categorias/produtos
- Cash
- Drivers
- Waiters
- Dining / tables / sessions
- Kitchen
- Reports operacionais
- Settings da loja / settings operacionais
- Tracking/ETA de motoboy

### Modulos ainda front-only, mockados ou parciais

- `settings/users` ainda esta mockado no frontend; nao existe hoje um modulo backend real de usuarios CRUD
- `catalog/promotions` ainda nao esta fechado como dominio real
- `catalog/coupons` ainda nao esta fechado como dominio real
- app do cliente nao existe ainda
- motor comercial completo (promocoes/fidelidade/cashback/assinatura) nao existe ainda
- realtime por websocket ainda nao e a base principal; o projeto usa polling/refresh e alguns mocks internos

### Paginas importantes que ja estao operacionais no admin

- Pedidos / Delivery
- Detalhe do pedido
- Novo pedido
- Salao / Mesas
- Garcons
- Motoboys
- Localizacao dos motoboys com mapa real
- Cozinha / KDS operacional
- Caixa
- Historico de pedidos
- Relatorios
- Produtos
- Login admin

## 7. Auth e permissoes

Modulo:

- `apps/api/src/modules/auth`

Endpoints reais:

- `POST /auth/login`
- `GET /auth/me`

Tecnologia:

- JWT access token
- senha com hash bcrypt
- sessao baseada em `storeUser`

Roles reais hoje:

- `owner`
- `manager`
- `attendant`
- `cashier`
- `kitchen`
- `waiter`
- `driver`
- `supervisor`

Fonte da matriz de permissoes:

- `apps/api/src/modules/auth/auth.permissions.ts`

Observacao importante:

- role `driver` hoje tem permissao `drivers:view`
- por causa disso foram adicionados endpoints `drivers/me/...` para o app do motoboy nao depender de endpoints administrativos por ID

## 8. Banco e modelagem real

Fonte de verdade:

- `apps/api/prisma/schema.prisma`

Enums principais:

- `OrderStatus`
- `OrderChannel`
- `PaymentMethod`
- `AdminRole`
- `DriverAvailabilityStatus`
- `WaiterOperationalStatus`
- `DiningTableStatus`
- `TableSessionStatus`
- `DriverLocationSource`
- `DeliveryAssignmentStatus`

Modelos principais implementados:

- `Store`
- `User`
- `StoreUser`
- `DriverProfile`
- `WaiterProfile`
- `WaiterHistoryEntry`
- `Customer`
- `CustomerAddress`
- `Category`
- `Product`
- `ProductChannelAvailability`
- `Order`
- `OrderItem`
- `OrderStatusHistory`
- `DriverLocation`
- `DeliveryAssignment`
- `EtaSnapshot`
- `CashRegister`
- `CashMovement`
- `DiningArea`
- `DiningTable`
- `TableSession`
- `TableSessionItem`
- `TableSessionEvent`

Store padrao fixa do projeto:

- `DEFAULT_STORE_ID = 'store_main'`
- arquivo: `apps/api/src/shared/store-context.ts`

## 9. Seed e contas de desenvolvimento

Fonte:

- `apps/api/prisma/seed.ts`

Loja seed:

- nome: `Cain Delivery`
- trade name: `Cain Burger House`
- cidade: `Manaus`
- coordenadas da loja: `-3.1019, -60.0217`

Senha padrao dos usuarios seed:

- `Demo@123456`

Contas principais seed:

- `owner@cain.local`
- `manager@cain.local`
- `attendant@cain.local`
- `cashier@cain.local`
- `kitchen@cain.local`
- `waiter@cain.local`
- `driver@cain.local`
- `ana.driver@cain.local`
- `igo.driver@cain.local`
- `rafa.driver@cain.local`
- `supervisor@cain.local`

Motoboy seed principal em entrega:

- usuario: `driver@cain.local`
- nome: `Diego Paz`
- status seed: `delivering`
- pedido seed em rota: `#1004`

Pedido delivery seed importante:

- `ord_1004`
- numero `#1004`
- status `out_for_delivery`
- `driverId = usr_driver_diego`
- assignment ativa: `assign_1004_diego`

## 10. Backend real por dominio

### Orders

Controller:

- `apps/api/src/modules/orders/orders.controller.ts`

Endpoints:

- `GET /orders`
- `GET /orders/:id`
- `POST /orders`
- `PATCH /orders/:id/status`
- `POST /orders/:id/repeat`
- `GET /orders/:id/tracking` (publico)

Observacoes:

- `accept` leva pedido para `in_preparation`
- `ready` leva para `ready`
- `dispatch` leva para `out_for_delivery` e vincula motoboy
- `complete` finaliza
- `cancel` cancela

### Catalogo

Endpoints reais existentes para categorias/produtos:

- `GET /catalog/categories`
- `GET /catalog/products`
- `POST /catalog/products`
- `PATCH /catalog/products/:id`
- `PATCH /catalog/products/:id/sold-out`
- `PATCH /catalog/products/:id/channels`

### Cash

Endpoints:

- `GET /cash/register`
- `POST /cash/register/movement`
- `POST /cash/register/close`

### Drivers

Controller:

- `apps/api/src/modules/drivers/drivers.controller.ts`

Endpoints administrativos:

- `GET /drivers`
- `GET /drivers/locations/active`
- `GET /drivers/:id`
- `GET /drivers/:id/tracking-policy`
- `GET /drivers/:id/location`
- `GET /drivers/:id/route`
- `POST /drivers`
- `POST /drivers/:id/location`
- `POST /drivers/:id/simulate-location`
- `PATCH /drivers/:id`

Endpoints especificos do app do motoboy adicionados agora:

- `GET /drivers/me/app-state`
- `GET /drivers/me/tracking-policy`
- `GET /drivers/me/location`
- `GET /drivers/me/route`
- `POST /drivers/me/location`
- `PATCH /drivers/me/status`
- `POST /drivers/me/delivery/start`
- `POST /drivers/me/delivery/complete`

Observacoes importantes:

- `drivers/me/*` exige que o usuario autenticado seja role `driver`
- o app do motoboy deve usar os endpoints `me`, nao os endpoints administrativos por ID
- `POST /drivers/me/location` usa a mesma regra de tracking seguro do backend

### Dining

Controller:

- `apps/api/src/modules/dining/dining.controller.ts`

Endpoints:

- `GET /dining/areas`
- `GET /dining/tables`
- `GET /dining/tables/:id`
- `POST /dining/tables`
- `PATCH /dining/tables/:id`
- `PATCH /dining/tables/:id/status`
- `POST /dining/tables/:id/open-session`
- `PATCH /dining/sessions/:id`
- `POST /dining/sessions/:id/add-item`
- `POST /dining/sessions/:id/close`
- `POST /dining/sessions/:id/transfer`
- `POST /dining/sessions/:id/split`

### Waiters

Controller:

- `apps/api/src/modules/waiters/waiters.controller.ts`

Endpoints:

- `GET /waiters`
- `GET /waiters/:id`
- `POST /waiters`
- `PATCH /waiters/:id`
- `PATCH /waiters/:id/status`

### Kitchen

Controller:

- `apps/api/src/modules/kitchen/kitchen.controller.ts`

Endpoints:

- `GET /kitchen/queue`
- `PATCH /kitchen/orders/:id/ready`

### Reports

Controller:

- `apps/api/src/modules/reports/reports.controller.ts`

Endpoints:

- `GET /reports/operational`

### Settings

Controller:

- `apps/api/src/modules/settings/settings.controller.ts`

Endpoints reais hoje:

- `GET /settings/store`
- `PATCH /settings/store/operational`

Observacao:

- `settings/users` ainda nao tem backend real

## 11. Tracking, rota e ETA

Arquivo central:

- `apps/api/src/shared/routing/routing.service.ts`

Provider principal:

- OSRM
- base URL default: `https://router.project-osrm.org`
- sobrescrevivel por `OSRM_BASE_URL`

Comportamento:

- se OSRM responder corretamente, provider = `osrm`
- se OSRM falhar, o sistema cai para `fallback`
- fallback calcula distancia por haversine e tempo estimado com velocidade media simplificada

Arquivos principais do tracking:

- `apps/api/src/modules/drivers/drivers.service.ts`
- `apps/api/src/modules/orders/orders.service.ts`

Regras reais importantes:

1. Localizacao automatica so e aceita quando o motoboy esta em entrega ativa.
2. O backend exige:
   - membership ativa
   - user status `active`
   - `driverProfile.active === true`
   - `driverProfile.availability === 'delivering'`
   - pelo menos um pedido delivery com status `out_for_delivery`
3. Se o payload vier com status `available` ou `paused`, o backend bloqueia tracking automatico.
4. `getDriverTrackingPolicy` retorna hoje:
   - `trackingEnabled`
   - `intervalSeconds = 60`
   - `minDistanceMeters = 35`
   - `reason`
   - `currentOrderId`
5. `getDriverRoute` devolve:
   - localizacao da loja
   - localizacao atual do motoboy
   - lista de paradas
   - geometria da rota
   - ETA total
   - distancia total
   - provider
6. `getOrderTracking` e publico e nao expoe rota completa nem outros clientes.

## 12. Mapa real no admin

Pagina:

- `/drivers/location`

Stack:

- MapLibre GL JS
- base de mapa open source
- OSRM para rota/ETA

Status atual:

- o mapa real ja aparece e funciona
- loja aparece
- motoboys aparecem
- rota aparece quando ha coordenadas suficientes
- popups/cards mostram dados operacionais

## 13. Cozinha / KDS

Status:

- modulo real, nao placeholder
- consome pedidos em preparo e prontos
- mostra SLA / atraso / canal / cliente-mesa / itens
- permite marcar pedido como pronto
- reflete de volta no fluxo de pedidos

Arquivos centrais:

- `src/pages/KitchenPage.tsx`
- `src/services/kitchen/kitchen-service.ts`
- `src/hooks/queries/kitchen.ts`
- `apps/api/src/modules/kitchen/*`

## 14. Users settings: estado real

Pagina:

- `src/pages/UsersSettingsPage.tsx`

Estado real atual:

- ainda renderiza `usersMock`
- nao existe hoje um modulo backend `users` no `apps/api/src/modules`
- portanto o CRUD real de usuarios administrativos nao esta fechado

Isso e importante para qualquer novo chat nao assumir que essa parte ja esta pronta.

## 15. App do motoboy: estado atual exato

Diretorio:

- `apps/driver-app`

Stack:

- Expo / React Native

Scripts:

- `npm --prefix apps/driver-app run start`
- `npm --prefix apps/driver-app run web`
- `npm --prefix apps/driver-app run build`
- `npm --prefix apps/driver-app run lint`
- `npm --prefix apps/driver-app run typecheck`

Arquivos criados nesta rodada:

- `apps/driver-app/App.tsx`
- `apps/driver-app/src/lib/theme.ts`
- `apps/driver-app/src/lib/format.ts`
- `apps/driver-app/src/types/api.ts`
- `apps/driver-app/src/api/client.ts`
- `apps/driver-app/src/api/auth.ts`
- `apps/driver-app/src/api/driver.ts`
- `apps/driver-app/src/providers/auth-context.ts`
- `apps/driver-app/src/providers/auth-provider.tsx`
- `apps/driver-app/src/hooks/use-driver-auth.ts`
- `apps/driver-app/src/hooks/use-driver-state.ts`
- `apps/driver-app/src/hooks/use-tracking-scheduler.ts`
- `apps/driver-app/src/components/action-pill.tsx`
- `apps/driver-app/src/components/delivery-stop-row.tsx`
- `apps/driver-app/src/components/metric-chip.tsx`
- `apps/driver-app/src/components/section-card.tsx`
- `apps/driver-app/src/screens/driver-login-screen.tsx`
- `apps/driver-app/src/screens/driver-home-screen.tsx`
- `apps/driver-app/assets/brand/login-brand-panel.png`

O que o app ja tenta fazer:

- login real com `/auth/login`
- sessao persistida com AsyncStorage
- validacao de sessao com `/auth/me`
- tela de login com acabamento premium dark alinhado ao login do admin
- home operacional do motoboy
- leitura do estado atual via `GET /drivers/me/app-state`
- acoes:
  - iniciar entrega
  - finalizar entrega
  - pausar/disponivel
- scheduler de localizacao com `expo-location`
- envio automatico de localizacao em intervalo baseado na policy
- invalida o estado no React Query apos envio

Status de validacao do mobile neste momento:

- backend necessario para o app foi adicionado e `api:build` + `api:lint` passaram
- `apps/driver-app` ja foi scaffoldado e `typecheck` passou
- o app ainda estava em fase de ajuste fino de lint/validacao final quando este handoff foi gerado
- portanto o app do motoboy deve ser entendido como **WIP funcional**, nao como modulo completamente homologado

## 16. Env e execucao local

### Frontend admin

Arquivo exemplo:

- `.env.example`

Valores:

- `VITE_API_BASE_URL=http://localhost:3333`
- `VITE_API_URL=http://localhost:3333`
- `VITE_DATA_SOURCE=api`

### Backend

Arquivo exemplo:

- `apps/api/.env.example`

Valores principais:

- `DATABASE_URL`
- `DIRECT_URL`
- `API_PORT=3333`
- `WEB_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173`
- `JWT_ACCESS_SECRET`
- `JWT_ACCESS_EXPIRES_IN=8h`

### Driver app

Arquivo exemplo:

- `apps/driver-app/.env.example`

Valor:

- `EXPO_PUBLIC_API_BASE_URL=http://localhost:3333`

Observacao importante para device fisico:

- em celular real, `localhost` nao aponta para a maquina do backend
- nesse caso sera necessario trocar para o IP local da maquina

## 17. Comandos principais

Na raiz:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`
- `npm run api:dev`
- `npm run api:build`
- `npm run api:lint`
- `npm run api:prisma:migrate`
- `npm run api:seed`
- `npm run driver:dev`
- `npm run driver:web`
- `npm run driver:build`
- `npm run driver:lint`
- `npm run driver:typecheck`

## 18. Estado de qualidade conhecido

Ultimas validacoes conhecidas antes deste handoff:

- frontend admin: build e lint ja passaram em rodadas anteriores
- backend API: build e lint passaram apos a adicao dos endpoints `drivers/me/*`
- kitchen estava funcional em runtime
- mapa de motoboys estava aparecendo e funcionando em `/drivers/location`
- driver app: `typecheck` passou; lint/build final do mobile ainda precisam ser reexecutados apos os ultimos ajustes

## 19. Pendencias reais

Pendencias importantes, sem romantizacao:

1. `settings/users` ainda nao tem backend CRUD real.
2. `promotions` e `coupons` ainda nao foram levados para backend real.
3. app do cliente nao existe.
4. app do motoboy esta em implementacao inicial e precisa de validacao final de runtime.
5. tracking do motoboy ainda deve ser entendido como base inicial; background tracking real de producao ainda pode exigir evolucao adicional.
6. realtime amplo via websocket/SSE ainda nao e a espinha dorsal do sistema.
7. motor comercial completo de fidelidade/cashback/assinatura ainda nao foi implementado.

## 20. Melhor forma de continuar o projeto em outro chat

Se outro chat for continuar daqui, ele deve partir destas premissas:

1. Nao refazer admin shell, auth ou modulos core.
2. Tratar `orders`, `catalog`, `cash`, `drivers`, `waiters`, `dining`, `kitchen`, `reports`, `settings/store` como base ja real.
3. Tratar `settings/users`, `promotions`, `coupons`, app cliente e motor comercial como frentes ainda abertas.
4. Tratar `apps/driver-app` como a frente atual em progresso.
5. Preservar o visual premium dark do admin como linguagem oficial do produto.
6. Reaproveitar auth JWT existente; nao criar auth paralela para mobile.
7. Usar os endpoints `drivers/me/*` no app do motoboy, nao os endpoints administrativos por ID.

## 21. Recomendacao imediata de continuidade

Se a proxima conversa for continuar a execucao, a ordem mais segura e:

1. finalizar lint/build do `apps/driver-app`
2. validar login do motoboy em runtime
3. validar `GET /drivers/me/app-state`
4. validar `POST /drivers/me/location`
5. validar `POST /drivers/me/delivery/start`
6. validar `POST /drivers/me/delivery/complete`
7. abrir `/drivers/location` no admin e confirmar reflexo do tracking

---

Se for necessario pedir continuidade em outro chat, a frase mais util e:

> "Use `PROJECT_HANDOFF_CONTEXT.md` como fonte principal de verdade do estado atual. Preserve a arquitetura atual. O foco agora e continuar a partir do ponto exato descrito no handoff, sem reabrir frentes ja fechadas."
