# Cain Delivery - Contexto Canonico Para IA

Atualizado em: 2026-07-15
Objetivo: este arquivo deve permitir que qualquer IA entenda o sistema, continue o trabalho com seguranca e evite reabrir decisoes ja tomadas.

## Atualizacao RC3 - caixa auditavel v2

Em 2026-07-17 foi iniciada a branch `feat/cash-register-v2` a partir de `integration/commerce-communications-v1`.

Escopo desta branch:

- caixa auditavel;
- terminal por loja;
- sessao de caixa;
- movimentos imutaveis;
- saldo esperado calculado no backend;
- fechamento com diferenca;
- idempotencia;
- constraint PostgreSQL para uma sessao aberta por terminal;
- interface Admin responsiva;
- testes unitarios e teste PostgreSQL opcional.

Fora do escopo:

- provider de pagamento real;
- WhatsApp;
- IA;
- Meta;
- NVIDIA;
- deploy;
- merge em `main`.

Documentacao nova:

- `docs/cash/CASH_REGISTER_CURRENT_STATE.md`
- `docs/cash/CASH_REGISTER.md`
- `docs/cash/CASH_MOVEMENTS.md`
- `docs/cash/CASH_CLOSING.md`
- `docs/cash/CASH_RECONCILIATION.md`
- `docs/cash/CASH_PERMISSIONS.md`
- `docs/cash/CASH_REGISTER_TEST_PLAN.md`
- `docs/releases/RC3_PLAN.md`

## 1. Resumo executivo

Cain Delivery e uma plataforma operacional para restaurantes e delivery.

Nao e apenas um CRUD administrativo. O produto deve parecer e funcionar como uma central de operacao em tempo real para:

- pedidos
- cozinha / KDS
- salao / mesas
- caixa
- motoboys
- tracking
- ETA
- despacho
- catalogo
- relatorios
- administracao da loja

O foco principal e operacao real: fluxo de pedidos, estado consistente, API como fonte principal, tracking logistico e experiencia premium dark.

Regra de ouro para qualquer IA:

- Nao empurrar mock como solucao.
- Nao esconder erro de TypeScript com `any`.
- Nao criar tela bonita nova se o problema for funcional.
- Nao remover funcionalidade real apenas para compilar.
- Sempre preferir API real, Prisma e contratos existentes.

## 2. Estado atual verificado

Estado validado em 2026-05-14:

- Admin web compila com `npm run build`.
- API compila com `npm run api:build`.
- App do motoboy passa no typecheck com `npm run driver:typecheck`.
- Lint geral passa com `npm run lint`, mas ainda exibe warnings.
- API lint passa com `npm run api:lint`.
- Driver app lint passa com `npm run driver:lint`.

Scripts que existem no `package.json` raiz:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`
- `npm run driver:dev`
- `npm run driver:web`
- `npm run driver:build`
- `npm run driver:lint`
- `npm run driver:typecheck`
- `npm run api:dev`
- `npm run api:build`
- `npm run api:lint`
- `npm run api:prisma:generate`
- `npm run api:prisma:migrate`
- `npm run api:seed`

Scripts que nao existem atualmente:

- `npm run web:typecheck`
- `npm run web:build`
- `npm run typecheck`

Para typecheck/build do admin, usar `npm run build`, pois ele roda `tsc -b && vite build`.

## 3. Estrutura do repositorio

Raiz:

- `src/` - admin web em React + Vite
- `apps/api/` - API real em NestJS + Prisma
- `apps/driver-app/` - app do motoboy em Expo / React Native
- `apps/print-agent/` - agente local de impressao termica ESC/POS
- `docs/printing/` - arquitetura, seguranca, testes e runbook de impressao
- `public/` - assets publicos do admin
- `PROJECT_HANDOFF_CONTEXT.md` - este arquivo, fonte principal para handoff entre IAs

Arquivos raiz importantes:

- `package.json`
- `vite.config.ts`
- `tailwind.config.js`
- `eslint.config.js`
- `.env`
- `.env.example`

Backend:

- `apps/api/package.json`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/seed.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/shared/store-context.ts`

Driver app:

- `apps/driver-app/package.json`
- `apps/driver-app/app.json`
- `apps/driver-app/App.tsx`
- `apps/driver-app/src/types/assets.d.ts`

## 4. Stack

Admin web:

- React
- TypeScript
- Vite
- Tailwind CSS
- Radix UI
- Zustand
- TanStack Query
- Framer Motion
- Recharts
- Lucide React
- MapLibre GL JS
- react-virtual / TanStack Virtual

API:

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- Zod
- JWT auth

Tracking / rotas:

- MapLibre GL JS no admin
- OpenStreetMap / OpenFreeMap como base conceitual
- OSRM para rota e ETA
- arquitetura preparada para fallback e futuro Valhalla

Driver app:

- Expo
- React Native
- React
- TypeScript
- TanStack Query
- AsyncStorage
- Expo Location
- Lucide React Native

## 5. Direcao visual

O admin ja tem linguagem visual consolidada. Preserve.

Direcao:

- dark premium
- operacional/logistico
- moderno
- estilo Linear / Stripe / Uber Fleet
- glassmorphism leve
- glow operacional controlado
- bordas suaves
- motion refinado

Evitar:

- visual gamer
- dashboard bootstrap
- CRUD generico
- cards gigantes sem funcao
- excesso de cores vibrantes
- landing pages desnecessarias

Paleta conceitual:

- fundo azul petroleo/preto
- laranja operacional
- azul realtime
- verde status operacional
- amarelo alerta
- vermelho atraso/critico

Componentes base:

- `src/components/shared/PageShell.tsx`
- `src/components/shared/SectionHeader.tsx`
- `src/components/shared/EmptyState.tsx`
- `src/components/shared/StatCard.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/styles/globals.css`

## 6. Arquitetura mental do sistema

Fluxo principal:

1. Admin cria ou recebe pedidos.
2. `orders` e a fonte de verdade operacional.
3. Cozinha consome pedidos em preparo/prontos.
4. Salao consome mesas/sessoes/pedidos.
5. Caixa registra movimentos ligados a vendas.
6. Motoboys consomem entregas e enviam localizacao.
7. Tracking calcula rota/ETA.
8. Relatorios consolidam pedidos, caixa, entregas e operacao.
9. Realtime invalida queries e atualiza telas sem refresh manual.

Regra importante:

- Nao criar segunda fonte de verdade para pedido, status, rota ou ETA.
- Se um modulo precisa de estado de pedido, deve consumir `orders` ou endpoint derivado da API.

## 7. Modulos implementados

Modulos com backend real ou base real:

- Auth admin
- Users list
- Orders
- Customers
- Kitchen
- Dining / mesas / sessoes
- Waiters
- Drivers
- Driver locations
- Driver routes
- Delivery assignments
- ETA snapshots
- Cash
- Catalog categories
- Catalog products
- Reports
- Store settings
- Operational settings
- SSE realtime para feed logistico/admin

Modulos ainda incompletos:

- Users CRUD completo ainda nao existe. Existe `GET /users` real.
- Promotions ainda nao tem modelo/endpoints Prisma reais.
- Coupons ainda nao tem modelo/endpoints Prisma reais.
- App do cliente nao existe.
- Motor comercial completo nao existe.
- Fidelidade/cashback/assinatura nao existem.
- WebSocket completo ainda nao e a espinha dorsal de todo o sistema.
- Background tracking mobile de producao ainda precisa validacao em device real.

## 8. Rotas do admin

Fonte:

- `src/app/navigation.ts`
- `src/app/router/index.tsx`
- `src/app/layout/AdminLayout.tsx`

Rotas principais:

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
- `/settings/printing`
- `/login`

## 9. Backend e banco

Fonte de verdade do banco:

- `apps/api/prisma/schema.prisma`

Store fixa de desenvolvimento:

- `DEFAULT_STORE_ID = 'store_main'`
- arquivo: `apps/api/src/shared/store-context.ts`

Modelos principais:

- `Store`
- `User`
- `StoreUser`
- `DriverProfile`
- `WaiterProfile`
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

Enums importantes:

- `AdminRole`
- `UserStatus`
- `OrderStatus`
- `OrderChannel`
- `PaymentMethod`
- `DriverAvailabilityStatus`
- `DriverLocationSource`
- `DeliveryAssignmentStatus`
- `DiningTableStatus`
- `TableSessionStatus`
- `WaiterOperationalStatus`

## 10. Auth e permissoes

Modulo:

- `apps/api/src/modules/auth`

Endpoints:

- `POST /auth/login`
- `GET /auth/me`

Permissoes:

- fonte: `apps/api/src/modules/auth/auth.permissions.ts`

Roles:

- `owner`
- `manager`
- `attendant`
- `cashier`
- `kitchen`
- `waiter`
- `driver`
- `supervisor`

O app do motoboy deve usar a mesma auth JWT. Nao criar auth paralela.

## 11. Endpoints reais por dominio

### Auth

- `POST /auth/login`
- `GET /auth/me`

### Users

Modulo:

- `apps/api/src/modules/users`

Endpoint real:

- `GET /users`

Observacao:

- A tela `src/pages/UsersSettingsPage.tsx` consome esse endpoint.
- Ainda nao existe CRUD completo de usuarios.

### Orders

Modulo:

- `apps/api/src/modules/orders`

Endpoints:

- `GET /orders`
- `GET /orders/:id`
- `POST /orders`
- `PATCH /orders/:id/status`
- `POST /orders/:id/repeat`
- `GET /orders/:id/tracking`

Status esperados:

- `in_analysis`
- `in_preparation`
- `ready`
- `out_for_delivery`
- `completed`
- `cancelled`

Acoes principais:

- `accept`
- `start_preparation`
- `ready`
- `dispatch`
- `complete`
- `cancel`

### Customers

Modulo:

- `apps/api/src/modules/customers`

Endpoint:

- `GET /customers`

### Kitchen

Modulo:

- `apps/api/src/modules/kitchen`

Endpoints:

- `GET /kitchen/queue`
- `PATCH /kitchen/orders/:id/ready`

### Catalog

Modulo:

- `apps/api/src/modules/catalog`

Endpoints reais para categorias/produtos:

- `GET /catalog/categories`
- `GET /catalog/products`
- `POST /catalog/products`
- `PATCH /catalog/products/:id`
- `PATCH /catalog/products/:id/sold-out`
- `PATCH /catalog/products/:id/channels`

Nao existem ainda endpoints reais para:

- `promotions`
- `coupons`

No admin, em modo API, promocoes e cupons nao devem exibir mock como se fosse dado real. Hoje retornam lista vazia e empty state honesto.

### Drivers

Modulo:

- `apps/api/src/modules/drivers`

Endpoints administrativos:

- `GET /drivers`
- `GET /drivers/locations/active`
- `GET /drivers/stream/live`
- `GET /drivers/:id`
- `GET /drivers/:id/tracking-policy`
- `GET /drivers/:id/location`
- `GET /drivers/:id/route`
- `GET /drivers/:id/dispatch-candidates`
- `POST /drivers/:id/route-preview`
- `POST /drivers`
- `POST /drivers/:id/location`
- `POST /drivers/:id/simulate-location`
- `PATCH /drivers/:id`
- `PATCH /drivers/:id/queue`

Endpoints do app do motoboy:

- `GET /drivers/me/app-state`
- `GET /drivers/me/tracking-policy`
- `GET /drivers/me/location`
- `GET /drivers/me/route`
- `POST /drivers/me/location`
- `PATCH /drivers/me/status`
- `POST /drivers/me/delivery/start`
- `POST /drivers/me/delivery/complete`

Regra:

- O app do motoboy deve usar `drivers/me/*`, nao endpoints administrativos por ID.

### Dining

Modulo:

- `apps/api/src/modules/dining`

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

Modulo:

- `apps/api/src/modules/waiters`

Endpoints:

- `GET /waiters`
- `GET /waiters/:id`
- `POST /waiters`
- `PATCH /waiters/:id`
- `PATCH /waiters/:id/status`

### Cash

Modulo:

- `apps/api/src/modules/cash`

Endpoints:

- `GET /cash/register`
- `POST /cash/register/movement`
- `POST /cash/register/close`

### Reports

Modulo:

- `apps/api/src/modules/reports`

Endpoint:

- `GET /reports/operational`

### Settings

Modulo:

- `apps/api/src/modules/settings`

Endpoints:

- `GET /settings/store`
- `PATCH /settings/store/operational`

## 12. Frontend admin: padroes de dados

Contratos:

- `src/contracts`

Services:

- `src/services`

Queries/mutations:

- `src/hooks/queries`

Tipos de dominio:

- `src/types/domain.ts`

Regra:

- UI nao deve importar `src/mocks` diretamente.
- Produto deve consumir hooks de query.
- Hooks devem consumir services.
- Services devem consumir API quando `VITE_DATA_SOURCE` nao for `mock`.

`shouldUseApi`:

- arquivo: `src/services/http/api-client.ts`
- valor: `VITE_DATA_SOURCE !== 'mock'`

Modo API:

- fonte principal deve ser backend real.

Modo mock:

- permitido apenas para demo/desenvolvimento explicito.
- nao deve ser silencioso em tela de produto.

## 13. Realtime

Arquivos importantes:

- `src/app/providers/AppProviders.tsx`
- `src/services/realtime/admin-realtime-stream.ts`
- `src/services/realtime/events.ts`
- `src/services/realtime/mock-realtime.ts`
- `apps/api/src/shared/realtime/admin-realtime.service.ts`

Estado atual:

- Em modo API, o admin usa SSE via `GET /drivers/stream/live`.
- Em modo mock, o admin usa `mockRealtimeBus`.
- Eventos de realtime invalidam queries do React Query.

Eventos conhecidos no frontend:

- `order.created`
- `order.updated`
- `order.status_changed`
- `driver.location_updated`
- `driver.queue_updated`
- `driver.status_updated`
- `cash.updated`
- `catalog.product_updated`
- `dining.session_updated`

Atencao:

- O realtime ainda nao cobre todo o produto como espinha dorsal completa.
- O proximo passo arquitetural e ampliar eventos reais e reduzir dependencias de polling/manual refetch.

## 14. Tracking, rota e ETA

Servico central de rotas:

- `apps/api/src/shared/routing/routing.service.ts`

Provider:

- OSRM
- env opcional: `OSRM_BASE_URL`

Fallback:

- Se OSRM falhar, a API calcula distancia aproximada por haversine e ETA simplificado.

Entidades importantes:

- `driver_locations`
- `delivery_assignments`
- `eta_snapshots`

Regras de tracking:

- Motoboy so deve enviar localizacao quando estiver em entrega.
- Intervalo esperado: aproximadamente 1 minuto.
- Evitar tracking desnecessario.
- Backend deve bloquear tracking automatico fora de entrega ativa.

Mapa admin:

- pagina: `src/pages/DriverLocationPage.tsx`
- componentes: `src/features/drivers/components`
- mapa: MapLibre GL JS

Funcionalidades atuais:

- mapa realtime
- markers de motoboys
- marcador da loja
- rota desenhada
- ETA
- distancia restante
- tracking automatico/simulado
- preview de rota
- central de despacho
- lista virtualizada
- painel operacional
- modal de despacho
- calculo de impacto operacional
- reorder de rota base via fila do motoboy

Pendencias importantes:

- smooth movement real completo
- consumir rota ja percorrida
- snap leve na via
- clustering inteligente
- replay operacional
- otimizacao multi-stop mais avancada

## 15. Novo pedido

Pagina:

- `src/pages/NewOrderPage.tsx`

Store:

- `src/stores/new-order-store.ts`

Estado atual:

- Nao nasce mais com `cus_1` / `addr_1`.
- Cliente e endereco precisam vir da API/clientes carregados.
- Rascunho e salvo automaticamente via Zustand persist.
- Botao fake de cupom foi removido.
- Botao fake de "Salvar rascunho" foi removido e substituido por indicacao passiva de auto-save.

Atencao:

- Motor real de cupons ainda nao existe.
- Nao reintroduzir input/botao de cupom ate haver backend/contrato real.

## 16. Promocoes e cupons

Paginas:

- `src/pages/PromotionsPage.tsx`
- `src/pages/CouponsPage.tsx`

Estado atual:

- Em modo API, nao usam mock silencioso.
- Como nao ha backend real, exibem empty state honesto.

Service:

- `src/services/catalog/catalog-service.ts`

Pendente para virar produto real:

1. Criar modelos Prisma para promotion/coupon.
2. Criar migrations.
3. Criar contracts Zod na API.
4. Criar controllers/services Nest.
5. Criar contracts frontend.
6. Atualizar services frontend para chamar API.
7. Implementar criacao/edicao/validacao.
8. Integrar cupons ao fluxo de novo pedido.

## 17. Users

Pagina:

- `src/pages/UsersSettingsPage.tsx`

Backend:

- `apps/api/src/modules/users`

Frontend:

- `src/contracts/users`
- `src/services/users/users-service.ts`
- `src/hooks/queries/users.ts`

Estado atual:

- `GET /users` real existe e lista usuarios da loja via Prisma.
- Tela de usuarios nao usa mais `usersMock`.

Pendente:

- CRUD completo de usuarios.
- Edicao de role.
- Ativacao/desativacao pela tela.
- Reset de senha/convite.
- Auditoria de permissoes.

## 18. App do motoboy

Diretorio:

- `apps/driver-app`

Objetivo:

- App operacional do motoboy, nao painel admin.
- Deve usar auth real e endpoints `drivers/me/*`.
- Deve enviar localizacao somente quando policy permitir.

Arquivos importantes:

- `apps/driver-app/App.tsx`
- `apps/driver-app/src/screens/driver-login-screen.tsx`
- `apps/driver-app/src/screens/driver-home-screen.tsx`
- `apps/driver-app/src/api/client.ts`
- `apps/driver-app/src/api/auth.ts`
- `apps/driver-app/src/api/driver.ts`
- `apps/driver-app/src/hooks/use-tracking-scheduler.ts`
- `apps/driver-app/src/types/assets.d.ts`

Correcao importante:

- Imports de imagem `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg` sao tipados em `apps/driver-app/src/types/assets.d.ts`.

Validado:

- `npm run driver:typecheck` passa.
- `npm run driver:lint` passa.

Pendente:

- Validar runtime em device/emulador.
- Validar permissao real de localizacao.
- Validar background tracking em plataforma real.
- Validar fluxo iniciar/finalizar entrega ponta a ponta com admin aberto.

## 19. Seeds e credenciais de desenvolvimento

Seed:

- `apps/api/prisma/seed.ts`

Loja:

- nome: Cain Delivery
- trade name: Cain Burger House
- cidade: Manaus
- coordenadas aproximadas: latitude `-3.1019`, longitude `-60.0217`

Senha padrao seed:

- `Demo@123456`

Contas seed comuns:

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

Motoboy seed principal:

- email: `driver@cain.local`
- nome: Diego Paz
- papel: `driver`

## 20. Ambiente

Admin `.env`:

- `VITE_API_BASE_URL=http://localhost:3333`
- `VITE_API_URL=http://localhost:3333`
- `VITE_DATA_SOURCE=api`

API `.env`:

- `DATABASE_URL`
- `DIRECT_URL`
- `API_PORT=3333`
- `WEB_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173`
- `JWT_ACCESS_SECRET`
- `JWT_ACCESS_EXPIRES_IN=8h`
- `OSRM_BASE_URL` opcional

Driver app `.env`:

- `EXPO_PUBLIC_API_BASE_URL=http://localhost:3333`

Atencao para celular fisico:

- `localhost` no celular aponta para o proprio celular.
- Para device real, usar IP local da maquina que roda a API.

## 21. Comandos de desenvolvimento

Instalar dependencias:

```bash
npm install
```

Rodar API:

```bash
npm run api:dev
```

Rodar admin:

```bash
npm run dev
```

Rodar app do motoboy:

```bash
npm run driver:dev
```

Build/typecheck admin:

```bash
npm run build
```

Build API:

```bash
npm run api:build
```

Typecheck driver app:

```bash
npm run driver:typecheck
```

Lint:

```bash
npm run lint
npm run api:lint
npm run driver:lint
```

Prisma:

```bash
npm run api:prisma:generate
npm run api:prisma:migrate
npm run api:seed
```

## 22. Ultimas validacoes conhecidas

Em 2026-05-14:

```bash
npm run build
```

Resultado:

- passou
- observacao: Vite avisou sobre chunks grandes, principalmente `DriverLocationPage`

```bash
npm run api:build
```

Resultado:

- passou

```bash
npm run driver:typecheck
```

Resultado:

- passou

```bash
npm run lint
```

Resultado:

- passou com warnings

Warnings conhecidos:

- `DriverCompactList.tsx`: React Compiler avisa sobre `useVirtualizer`.
- `DriverMapPanel.tsx`: cleanup de ref em animation frame.
- `DriverOrdersModal.tsx`: `assignedStops` poderia ser memoizado antes de outros `useMemo`.

```bash
npm run api:lint
npm run driver:lint
```

Resultado:

- ambos passaram

## 23. O que foi estabilizado recentemente

Admin web:

- corrigido build/typecheck em `DeliveryDetailsPanel.tsx`
- corrigido build/typecheck em `DriverMapPanel.tsx`
- corrigido build/typecheck em `DriverLocationPage.tsx`
- corrigida tipagem de eventos realtime
- corrigida sincronizacao de draft de rota para satisfazer lint/React Compiler

Driver app:

- adicionada declaracao de assets em `apps/driver-app/src/types/assets.d.ts`
- corrigido problema de import de imagem em `driver-home-screen.tsx` e `driver-login-screen.tsx`

Mocks/produto:

- `UsersSettingsPage` deixou de usar `usersMock`.
- Criado `GET /users` real.
- Promocoes/cupons nao mostram mais mock em modo API.
- Novo pedido nao tem mais cupom fake nem botao fake de salvar rascunho.
- Novo pedido nao inicia mais com IDs seed fixos.

Realtime:

- `AppProviders` agora usa SSE em modo API.
- `mockRealtimeBus` fica para modo mock.

## 24. Pendencias reais de produto

Alta prioridade:

1. Criar backend real para promocoes.
2. Criar backend real para cupons.
3. Integrar cupom real ao novo pedido.
4. Finalizar CRUD/convite de usuarios.
5. Evoluir realtime para ser base transversal do admin.
6. Melhorar smooth movement de motoboys.
7. Fazer rota consumir trecho ja percorrido.
8. Validar app do motoboy em device real.
9. Testar ponta a ponta pedido -> cozinha -> pronto -> despacho -> entrega -> finalizacao.

Media prioridade:

1. Otimizacao multi-stop real.
2. Reorder drag-and-drop com impacto operacional.
3. Clustering inteligente no mapa.
4. Analytics logisticos.
5. Heatmap operacional.
6. Previsao de atraso.

Futuro:

1. IA operacional.
2. Recomendacao automatica de motoboy.
3. Previsao de demanda.
4. Valhalla.
5. App do cliente.
6. Fidelidade/cashback/assinatura.

## 25. Regras para futuras IAs

Antes de editar:

1. Leia este arquivo.
2. Leia `package.json`.
3. Leia o modulo especifico antes de mudar.
4. Rode `rg` antes de assumir que algo nao existe.
5. Preserve padroes do projeto.

Ao implementar:

1. Use contratos existentes.
2. Prefira API real.
3. Se faltar backend, diga claramente e implemente backend se a tarefa pedir produto real.
4. Nao coloque mock em tela de produto sem deixar explicito.
5. Nao use `any` para calar erro.
6. Nao comente codigo quebrado para compilar.
7. Nao remova feature real para passar build.
8. Nao redesenhe UI sem necessidade.
9. Rode os scripts reais do `package.json`.

Ao finalizar:

1. Informe comandos rodados.
2. Informe o que passou.
3. Informe warnings/residuos.
4. Informe pendencias reais sem maquiagem.

## 26. Melhor pedido para continuar em outro chat

Use esta frase:

```text
Use PROJECT_HANDOFF_CONTEXT.md como fonte principal de verdade do projeto Cain Delivery. Preserve a arquitetura atual, nao reintroduza mocks silenciosos e continue a partir do estado verificado em 2026-05-14.
```

## 27. WhatsApp Cloud API e atendente NVIDIA (14/07/2026)

Branch: `feature/whatsapp-cloud-ai-attendant`, baseada em `f04b335`.

Estado implementado:

- Meta WhatsApp Cloud API oficial como provider principal e Evolution como legado explicito;
- GET/POST `/webhooks/whatsapp`, raw body e HMAC `X-Hub-Signature-256`;
- conta de mensageria, identidade de canal, inbound deduplicado, outbox, audit de IA/tools, notificacoes e tracking tokenizado;
- NVIDIA NIM OpenAI-compatible com timeout, fila, RPM, concorrencia, retry e circuit breaker;
- allowlist de onze tools, sem Prisma exposto ao modelo e sem catalogo completo no prompt;
- rascunho controlado, reprecificacao e confirmacao explicita/idempotente antes do pedido `source=whatsapp`;
- handoff persistente com usuario derivado do JWT;
- notificacoes deterministicas por transicao, janela de 24 horas e templates;
- `/tracking/:token` sem PII, com hash, TTL, revogacao e coordenada arredondada;
- interface Cloud sem QR Code e com status `queued/sent/delivered/read/failed`.

Documentos operacionais estao em `docs/integrations`. O arquivo `.env` permanece local/ignorado; use apenas `apps/api/.env.example` como lista de variaveis.

Validacao atual desta branch: 50 testes unitarios API, 2 testes persistentes de integracao, 5 testes web, builds API/admin, lint API/driver, typecheck driver, Prisma validate e 21 migrations aplicadas do zero em PostgreSQL isolado. Nao houve chamada real a Meta/NVIDIA por ausencia de credenciais locais.

## 28. Revisao de prontidao das integracoes (14/07/2026)

A revisao profunda dos 72 arquivos encontrou e corrigiu problemas concretos de concorrencia, timezone, sandbox, status fora de ordem, atomicidade inbound, handoff, idempotencia de tools, tenant e tracking. A outbox agora usa claim PostgreSQL atomico com `SKIP LOCKED`, preserva a ordem por conversa e recupera locks antigos. O sandbox e aplicado no worker a todas as origens de mensagem.

Foram adicionados testes locais com PostgreSQL para duas instancias do worker, status concorrente, isolamento por loja, chave idempotente divergente, allowlist e disputa entre humanos. As 21 migrations aplicam em banco vazio; as duas migrations da integracao aplicam sobre as 19 anteriores.

O estado externo permanece honesto:

- NVIDIA real: nao executado, credencial local ausente;
- Meta real: nao executado, credenciais locais ausentes;
- E2E real: nao executado;
- templates: cinco nomes propostos, aprovacao ainda nao verificada;
- staging: bloqueado ate conta de teste, sandbox, templates, observabilidade e rollback;
- producao: nao pronta.

Relatorios e procedimentos atuais:

- `docs/integrations/REAL_VALIDATION_REPORT.md`
- `docs/integrations/META_TEST_ACCOUNT_SETUP.md`
- `docs/integrations/NVIDIA_REAL_TEST.md`
- `docs/integrations/TEMPLATE_APPROVAL_CHECKLIST.md`
- `docs/integrations/STAGING_ROLLOUT.md`

## 29. Sistema de impressao termica (15/07/2026)

Branch: `feature/thermal-printing-agent`.

Arquitetura implementada:

- API e PostgreSQL sao a fonte da verdade;
- eventos reais de pedido/pagamento criam `PrintJob` na mesma transacao do dominio;
- snapshot e template ficam imutaveis no job;
- claim usa `FOR UPDATE SKIP LOCKED`, lease, prioridade com aging e tentativas persistidas;
- agente local autentica por token proprio, recebe somente impressoras vinculadas e mantem ledger atomico;
- navegador nunca acessa a impressora;
- reimpressao exige permissao/motivo, cria job novo e imprime marca visivel.

Modelos principais adicionados:

- `PrintingSettings`
- `PrinterStation`
- `Printer`
- `PrinterRoutingRule`
- `PrintTemplate`
- `PrintAgent`
- `PrintAgentHeartbeat`
- `PrintJob`
- `PrintJobAttempt`
- `PrintAuditLog`

Eventos conectados:

- entrada em producao -> `ORDER_INITIAL`;
- novos itens de comanda -> `ORDER_ADDITION`;
- pedido pronto -> `DISPATCH_ORDER`;
- pagamento confirmado -> `CASHIER_RECEIPT`;
- cancelamento -> `ORDER_CANCELLATION`;
- reimpressao administrativa -> novo job `REPRINT`.

Validacao concluida sem hardware:

- API build/lint e 59 testes unitarios;
- integracao PostgreSQL com isolamento, replay, concorrencia de claim/confirmacao, lease e reimpressao;
- simulacao de 40 pedidos com dois setores, falhas temporarias e uma queda ambigua;
- carga de 500 jobs;
- 22 migrations em banco vazio e migration termica incremental sobre as 21 anteriores;
- agente com typecheck/lint/build e 10 testes;
- admin web build/lint e 5 testes;
- dry-run TXT/BIN/JSON e TCP apenas contra loopback simulado.

Limites que devem permanecer explicitos:

- nenhuma impressora fisica foi acessada ou homologada;
- `WINDOWS_PRINTER`/spooler RAW nao esta implementado;
- exactly-once fisico nao e possivel; `PRINT_RESULT_UNKNOWN` exige decisao humana;
- ledger nao tem criptografia de aplicacao e depende de ACL/disco protegido;
- nao ha metrica/alerta externo nem instalador de servico Windows nesta entrega;
- status atual: pronto para teste supervisionado em restaurante, nao pronto para producao.

Documentacao canonica: `docs/printing/`. O primeiro teste fisico deve seguir `REAL_PRINTER_VALIDATION.md` e `OPERATIONAL_RUNBOOK.md` sem contornar o driver por scripts locais.

## 30. Cain Garçom (15/07/2026)

Branch: `feature/waiter-pwa`, baseada em `317d6c5`.

Foi adicionado `apps/waiter-app`, PWA React/TypeScript para garçom e gerente. O app tem login operacional, salas/mesas, abertura de sessão, catálogo pesquisável, modificadores obrigatórios, rascunho isolado, envio inicial e adições, acompanhamento de cozinha/impressão, cancelamento auditado, entrega, transferência e solicitação de fechamento. Offline mantém apenas leitura recente e rascunho; todas as mutações são bloqueadas.

A API recebeu módulo `/waiter` de superfície mínima, permissões próprias, guard que revalida usuário/membership/perfil, ownership de sessão, tenant obrigatório, idempotência, rate limit, versões otimistas e SSE por loja. Itens da sessão agora apontam para `Order`/`OrderItem` reais; primeiro envio, adição e remoção produzem eventos de impressão distintos. Preço, disponibilidade e total continuam calculados no servidor.

Validação automatizada inclui API, PWA, fluxos E2E A–G, 12 cenários visuais e cargas sintéticas. Nenhum hardware, rede de restaurante ou impressora física foi usado. Classificação: pronto para piloto supervisionado em staging, não homologado para produção autônoma.

Documentação canônica: `docs/waiter/`. O próximo gate está descrito em `docs/waiter/TESTING.md` e `docs/waiter/LIMITATIONS.md`.

## 31. Hardening de dependências do RC1 (15/07/2026)

Branch local: `security/dependency-hardening-rc1`, baseada em `release/pilot-rc1` (`d9a9b93`).

Os cinco installs npm foram auditados e reproduzidos. O Admin atualizou React Router e Vite dentro dos mesmos majors; a API atualizou a cadeia NestJS/Fastify/fast-uri dentro do Nest 11; o Driver atualizou patches do Expo SDK 54 e removeu as vulnerabilidades crítica/altas de `shell-quote`, `undici` e `ws`. Waiter e Print Agent permaneceram sem alterações e com audit limpo.

Matriz final: Admin 0; API 1 baixa de desenvolvimento em `tsx → esbuild`; Waiter 0; Print Agent 0; Driver 11 moderadas agregadas em duas cadeias do toolchain Expo (`postcss` e `uuid`). Total: 0 críticas e 0 altas. Não houve major, override, `npm audit fix --force`, `expo install --fix`, mudança de schema/migration, push ou merge.

O upgrade Expo SDK 54 → 57 foi separado porque exige migração própria e validação em dispositivo. O estado atual está pronto para continuar desenvolvimento e para laboratório supervisionado, mas não adiciona homologação de restaurante ou produção.

Documentação canônica:

- `docs/security/DEPENDENCY_AUDIT_RC1.md`
- `docs/security/DEPENDENCY_UPDATE_PLAN.md`
- `docs/security/DRIVER_APP_DEPENDENCY_RISKS.md`

## 32. GitHub Actions do RC2 (15/07/2026)

Branch: `ci/pilot-rc2-validation`, baseada exatamente em `release/pilot-rc2` (`20ca789120d9374155710c19eab0f40cda02df47`). O RC2 permanece sem novos commits.

Foram definidos workflows independentes para Admin, API, Waiter PWA, Print Agent e Driver App. A API possui jobs separados para validação unitária e PostgreSQL temporário. Os jobs usam Node `24.16.0`, installs npm independentes, lockfiles v3, permissões somente de leitura e actions oficiais fixadas por SHA completo.

O CI não usa secrets reais, Meta, NVIDIA, EAS, impressora física, banco de produção ou deploy. Fluxos completos com seed/API/Print Agent, matriz incremental dependente do Compose e backup/restore permanecem gates de laboratório. CI verde não autoriza restaurante fechado ou produção.

Documentação canônica:

- `docs/ci/GITHUB_ACTIONS.md`
- `docs/ci/CI_MATRIX.md`
- `docs/ci/TROUBLESHOOTING.md`

