# Blueprint do Admin/Operação

> Este documento agora representa o blueprint detalhado do módulo Admin / Operação.
> A visão oficial e ampliada da plataforma completa está em [plataforma-blueprint.md](./plataforma-blueprint.md).

## 1. Visão do produto

Objetivo: transformar o Admin no cockpit operacional da loja, com foco em velocidade de atendimento, leitura instantânea de status e base técnica reaproveitável para web, desktop e mobile.

Princípios do produto:

- operação primeiro, analytics depois
- tempo real por padrão
- uma fonte única de verdade para pedidos, salão, delivery e caixa
- identidade visual própria, sem copiar concorrente
- módulos desacoplados, mas com experiência unificada
- regras de negócio centralizadas no backend
- frontend preparado para shell web e shell desktop

## 2. MVP vs fase futura

### MVP forte

- Pedidos em kanban operacional com realtime
- Lançar Pedido manual
- Salão/Mesas com abertura, consumo, adição de itens e fechamento simples
- Cardápio com categorias, produtos, opcionais, disponibilidade por canal e esgotamento rápido
- Cupons simples
- Motoboys com cadastro, status, vínculo ao pedido e mapa básico
- Caixa com abertura, movimentações e fechamento
- Histórico de pedidos
- Usuários e permissões por perfil
- Configurações essenciais da loja
- Prévia do cardápio digital com reaproveitamento do frontend
- Dashboard enxuto com KPIs operacionais

### Fase 2

- Promoções avançadas: leve 2 pague 1, combos temporais, regras por faixa horária
- Roteirização multi-entrega com otimização por ETA
- Reserva de mesas
- Separação de conta avançada por pessoa/item
- Multi-caixa por turno com conciliação ampliada
- Relatórios avançados com comparativos e metas
- Motor de regras promocionais mais flexível
- Gestão de impressoras, comandas e estações de produção
- App/portal de motoboy mais robusto
- Alertas proativos e automações

## 3. Arquitetura do Admin

### Arquitetura funcional

O Admin deve ser organizado em quatro blocos:

1. Operação
   - Pedidos
   - Salão / Mesas
   - Lançar Pedido
   - Motoboys
   - Caixa
2. Catálogo e vendas
   - Cardápio
   - Promoções
   - Cupons
   - Prévia do cardápio digital
3. Gestão
   - Dashboard
   - Relatórios
   - Histórico de pedidos
4. Administração
   - Configurações da loja
   - Usuários e permissões

### Recomendação prática de menu

Menu lateral fixo, com grupos e ordem baseada em frequência real de uso:

1. Pedidos
2. Salão / Mesas
3. Lançar Pedido
4. Motoboys
5. Caixa
6. Dashboard
7. Cardápio
8. Promoções
9. Cupons
10. Histórico de pedidos
11. Relatórios
12. Prévia do cardápio digital
13. Configurações da loja
14. Usuários e permissões

Observação importante: `Categorias` e `Produtos` não devem ser itens soltos no menu lateral no MVP. Eles entram como abas internas do módulo `Cardápio`, porque a operação diária precisa de um menu curto. Se virarem itens laterais, o menu perde velocidade.

### Landing recomendada

- rota inicial do admin: `/orders`
- Dashboard continua existindo, mas não como primeira tela
- quem opera restaurante entra para agir, não para contemplar gráfico

## 4. Sitemap / menu do Admin

```text
/orders
/dining/tables
/dining/areas
/manual-order
/drivers
/drivers/location
/cash
/cash/history
/dashboard
/catalog
/catalog/categories
/catalog/products
/catalog/options
/catalog/availability
/promotions
/coupons
/orders/history
/reports/overview
/reports/orders
/reports/dining
/reports/delivery
/reports/drivers
/reports/products
/reports/coupons
/reports/financial
/preview/menu
/settings/store
/settings/channels
/settings/delivery
/settings/users
/settings/roles
```

## 5. Lista de telas

### Operação

- Tela de Pedidos Kanban
- Drawer de detalhes do pedido
- Painel de filtros salvos
- Tela de Salão com mapa de mesas
- Tela de Salão em lista
- Drawer da sessão da mesa
- Fluxo de transferir mesa
- Fluxo de transferir itens
- Fluxo de separar conta
- Fluxo de fechar conta
- Tela de Lançar Pedido
- Tela de Motoboys
- Subaba Localização
- Tela de Caixa atual
- Tela de histórico de caixas

### Catálogo e vendas

- Visão geral do Cardápio
- Lista de Categorias
- Editor de categoria
- Lista de Produtos
- Editor de produto
- Lista de grupos de opcionais
- Editor de opcionais
- Painel de disponibilidade por canal
- Tela de Promoções
- Editor de promoção
- Tela de Cupons
- Editor de cupom
- Prévia do cardápio digital

### Gestão

- Dashboard operacional
- Histórico de pedidos com filtros avançados
- Detalhe do pedido histórico com linha do tempo
- Relatório geral
- Relatório de pedidos
- Relatório de salão
- Relatório de delivery
- Relatório de motoboys
- Relatório de produtos
- Relatório de cupons
- Relatório financeiro

### Administração

- Configurações da loja
- Canais e horários
- Entrega e raio/zonas
- Usuários
- Perfis e permissões

## 6. Fluxo de navegação

### Fluxo principal da operação

1. Operador entra em `Pedidos`
2. Analisa novos pedidos ou exceções
3. Abre o drawer do pedido
4. Aceita, edita, envia para preparo, vincula motoboy ou conclui
5. Se for salão, pode navegar para a mesa vinculada
6. Se for delivery, pode abrir rastreio/rota do motoboy

### Fluxo de salão

1. Abrir `Salão / Mesas`
2. Ver mapa com status das mesas
3. Clicar em mesa livre para abrir sessão
4. Definir número de pessoas
5. Lançar itens
6. Enviar para produção
7. Adicionar itens extras conforme consumo
8. Separar conta ou transferir itens se necessário
9. Fechar conta
10. Encerrar sessão da mesa

### Fluxo de pedido manual

1. Abrir `Lançar Pedido`
2. Escolher canal: balcão, salão, delivery, retirada
3. Selecionar ou cadastrar cliente
4. Escolher mesa ou endereço, conforme o canal
5. Montar carrinho
6. Definir pagamento
7. Escolher `manter em análise` ou `enviar para produção`
8. Confirmar e direcionar para fluxo operacional

## 7. Tela principal: Pedidos

### Estrutura

Kanban operacional com colunas:

- Em análise
- Em preparo / produção
- Prontos
- Em rota / saiu para entrega
- Finalizados / histórico recente

### Conteúdo do card

- número do pedido
- nome do cliente
- origem: salão, balcão, delivery, cardápio digital, WhatsApp
- horário
- forma de pagamento
- valor total
- endereço resumido quando for entrega
- mesa quando for salão
- tags: atraso, prioridade, pago, reembolso pendente, retirada, cupom, recorrente

### Ações do card

- aceitar
- iniciar preparo
- marcar pronto
- vincular motoboy
- marcar saiu
- concluir
- cancelar
- abrir detalhe

### Regras de UX

- card compacto em modo padrão
- detalhe completo só no drawer lateral
- drag-and-drop permitido apenas quando a transição for válida
- botões de ação rápida sempre visíveis no hover e no drawer
- coluna `Finalizados` limitada aos últimos minutos/últimos N pedidos para não poluir

### Filtros e busca

Filtros de topo:

- origem
- status
- motoboy
- forma de pagamento
- período
- atraso
- prioridade

Busca global por:

- número do pedido
- cliente
- telefone

### Atualização em tempo real

Modelo recomendado:

- backend publica eventos de domínio
- gateway de realtime distribui apenas eventos relevantes por loja
- frontend mantém lista viva por colunas
- mudanças pequenas atualizam só o card afetado

Eventos essenciais:

- `order.created`
- `order.updated`
- `order.status.changed`
- `order.priority.changed`
- `order.driver.assigned`
- `payment.updated`

### Como lidar com muitos pedidos

- virtualização por coluna
- limite de cards renderizados por coluna com paginação de histórico recente
- modo de densidade: confortável e compacto
- agrupamento opcional por atraso ou origem
- auto-scroll só para novos pedidos em `Em análise`
- sons/notificações apenas para exceção importante

### Como evitar poluição visual

- usar cor apenas para status e alerta
- não mostrar item completo no card; mostrar resumo tipo `3 itens`
- endereço em uma linha com truncamento
- prioridade em badge única, não em múltiplos selos
- detalhes completos no drawer direito

## 8. Drawer lateral do pedido

Conteúdo recomendado:

- cabeçalho com número, canal, SLA e status
- dados do cliente
- endereço ou mesa
- linha do tempo do pedido
- itens e opcionais
- pagamento
- cupom/desconto
- observações
- botões de ação
- bloco de auditoria enxuto: quem aceitou, quando entrou em preparo, quem finalizou

Largura sugerida:

- 440px a 520px

## 9. Módulo Salão / Mesas

### Estrutura de telas

1. `Mapa de mesas`
   - visão visual por setor
2. `Lista de mesas`
   - visão tabular para operação rápida
3. `Sessão da mesa`
   - consumo e gestão da conta
4. `Cadastro de áreas/setores`
5. `Cadastro de mesas`

### Status da mesa

- livre
- ocupada
- reservada
- aguardando fechamento
- conta fechada

### Fluxo completo da mesa

1. Mesa livre
2. Abrir sessão
3. Informar quantidade de pessoas
4. Criar consumo inicial
5. Enviar itens para produção
6. Adicionar itens posteriores
7. Aplicar desconto ou taxa
8. Transferir mesa ou itens, se necessário
9. Separar conta, se necessário
10. Registrar pagamento
11. Fechar conta
12. Encerrar sessão
13. Mesa volta para `livre`

### Funcionalidades MVP

- abrir mesa
- alterar quantidade de pessoas
- lançar pedido na mesa
- adicionar itens depois
- editar quantidade antes do envio para produção
- aplicar desconto simples
- fechar conta
- imprimir ou gerar resumo

### Fase 2

- transferência parcial de itens
- transferência total de mesa
- separação por pessoa/item
- reserva com agenda
- múltiplas comandas por mesa

### Decisão de modelagem recomendada

No MVP, cada mesa aberta possui uma `table_session` e um `order` principal aberto do tipo `dine_in`. Isso simplifica:

- cozinha
- caixa
- histórico
- relatórios

Na fase 2, a mesma sessão pode ter múltiplos tickets ou comandas vinculadas.

## 10. Módulo Lançar Pedido

### UX recomendada

Tela em 3 painéis:

1. Painel esquerdo
   - tipo do pedido
   - cliente
   - telefone
   - endereço ou mesa
   - origem
2. Painel central
   - busca de produtos
   - categorias
   - grid/lista de itens
   - customização do item
3. Painel direito
   - carrinho
   - cupom
   - observações
   - pagamento
   - total
   - ação final

### Por que essa UX funciona

- evita wizard longo
- reduz troca de contexto
- permite operação por teclado e mouse
- funciona para todos os canais no mesmo fluxo

### Atalhos importantes

- `F2`: focar busca do cliente
- `F3`: focar busca de produto
- `Enter`: adicionar item selecionado
- `Ctrl + Backspace`: remover linha do carrinho
- `Ctrl + Enter`: confirmar pedido

### Regras práticas

- delivery exige cliente e endereço válidos
- salão exige mesa aberta ou criação de sessão
- balcão e retirada podem sair sem endereço
- pagamento pode ficar pendente apenas se o perfil tiver permissão

## 11. Gestão de Cardápio

### Estrutura de telas

#### Cardápio

- aba `Visão geral`
- aba `Categorias`
- aba `Produtos`
- aba `Opcionais`
- aba `Disponibilidade`
- aba `Prévia`

#### Promoções

- lista
- calendário/períodos
- editor

#### Cupons

- lista
- editor

### Organização para não ficar confuso

- um módulo principal de cardápio com tudo que afeta produto
- promoções e cupons em módulos separados porque mexem em regra comercial, não no cadastro-base
- disponibilidade por canal visível no produto e em uma grade operacional dedicada

### Regras de gestão do cardápio

- `ativo/inativo` controla existência operacional
- `visível/oculto` controla exibição temporária por canal
- `esgotado` bloqueia venda imediata, mas não apaga o item
- `disponível por canal` controla salão, delivery, cardápio digital e balcão

### Modelagem recomendada

- `products` guarda o item canônico
- `product_channels` guarda disponibilidade, visibilidade, preço por canal e esgotamento
- `product_option_groups` e `product_options` tratam adicionais/variações
- `categories.sort_order` e `products.sort_order` resolvem reordenação

## 12. Cupons e Promoções

### Cupons

Casos do MVP:

- percentual
- valor fixo
- validade
- limite total
- limite por cliente
- valor mínimo
- canal elegível
- categoria/produto elegível

### Modelo recomendado para cupons

Tabela `coupons`:

- `code`
- `discount_type`
- `discount_value`
- `max_discount_amount`
- `valid_from`
- `valid_until`
- `usage_limit_total`
- `usage_limit_per_customer`
- `min_order_amount`
- `eligible_channels`
- `status`
- `rules_json`

Tabelas auxiliares futuras:

- `coupon_redemptions`
- `coupon_products`
- `coupon_categories`

### Promoções

Casos:

- desconto automático
- combo promocional
- leve 2 pague 1
- horário promocional
- promoção por categoria
- promoção por produto

### Modelo recomendado para promoções

Tabela `promotions`:

- `type`
- `name`
- `status`
- `priority`
- `stackable`
- `starts_at`
- `ends_at`
- `eligible_channels`
- `conditions_json`
- `benefits_json`

### Regra de motor comercial

Ordem sugerida de aplicação:

1. preço base por canal
2. promoção automática elegível
3. cupom elegível
4. taxa de entrega
5. arredondamentos/regras fiscais

No MVP, cupom não acumula com outra regra manual, salvo se `stackable = true`.

## 13. Módulo Motoboys

### Telas

- lista de motoboys
- cadastro/edição
- painel operacional do entregador
- subaba `Localização`
- histórico de entregas

### Dados exibidos

- nome
- telefone
- status online/offline
- disponibilidade: disponível, em entrega, pausado
- pedido atual
- fila de pedidos
- tempo médio
- distância percorrida

### Subaba Localização

Deve mostrar:

- mapa com posição da loja
- pinos dos motoboys ativos
- pedidos em rota
- lote/rota atual
- ligação entre motoboy e pedidos atribuídos

### MVP

- cadastro
- status
- vínculo ao pedido
- mapa com última localização
- histórico básico

### Fase 2

- fila inteligente
- taxa por entrega
- ranking e produtividade por turno
- prova de entrega

## 14. Lógica de roteirização

### Regra de negócio inicial

Quando mais de um pedido sair junto:

1. a loja cria um `delivery_batch`
2. o sistema sugere uma ordem
3. operador ou motoboy pode ajustar
4. a ordem final fica registrada
5. a execução real também fica registrada

### Algoritmo inicial sugerido

Heurística simples e eficiente:

1. No momento de saída da loja:
   - calcular distância/tempo da loja para cada pedido
   - ordenar por menor tempo a partir da loja
   - aplicar penalidade de prioridade/SLA quando necessário
2. Depois que o motoboy está em rota:
   - para os pedidos restantes, recalcular usando a posição atual do motoboy
   - aplicar `nearest next stop` com peso de atraso

Fórmula prática de score:

`score = tempo_estimado + penalidade_por_atraso - bonus_prioridade`

### Por que essa heurística é boa para o MVP

- simples de explicar para a operação
- barata computacionalmente
- já melhora muito o processo manual
- não exige engine complexa de roteirização

### Como evoluir depois

- clustering por bairro/zona
- ETA por trânsito real
- janela de entrega
- capacidade do motoboy
- otimização global multi-rota

### Visão interna da loja

Exibir:

- pedidos do lote
- ordem sugerida
- ordem final
- ordem real concluída
- mapa completo da rota

### Visão do cliente

Regras:

- se o pedido não for a próxima parada: `Motoboy em rota`
- quando virar a próxima parada: `Motoboy a caminho do seu pedido`
- nunca mostrar nome, endereço ou sequência de outros clientes

### Como evitar confusão

- sempre mostrar `pedido 2 de 3 na rota` apenas internamente
- no cliente, nunca expor posição relativa detalhada
- registrar separadamente:
  - `suggested_sequence`
  - `final_sequence`
  - `actual_sequence`

## 15. Relatórios

### KPIs essenciais do MVP

- faturamento bruto
- faturamento líquido
- quantidade de pedidos
- ticket médio
- vendas por canal
- cancelamentos
- tempo médio de preparo
- tempo médio até despacho
- tempo médio de entrega
- pedidos atrasados
- top produtos
- taxa de uso de cupons
- divergência de caixa

### Relatórios necessários

- Geral
- Pedidos
- Salão / mesas
- Delivery
- Motoboys
- Produtos
- Cupons
- Financeiro / faturamento
- Cancelamentos
- Tempo médio de preparo
- Tempo médio de entrega

### Filtros

- período
- canal
- status
- motoboy
- produto
- categoria
- forma de pagamento

### Gráficos e tabelas que fazem sentido

- cards KPI para visão inicial
- linha temporal por dia/hora
- barras por canal e categoria
- tabela detalhada com drill-down para pedidos
- heatmap por hora para pico operacional

### Como evitar relatório bonito porém inútil

- todo gráfico precisa responder uma decisão operacional
- sempre oferecer tabela exportável abaixo do gráfico
- comparar realizado vs período anterior
- permitir clicar no KPI e abrir a lista real de pedidos que compõem o número

## 16. Caixa e fechamento

### Fluxo completo

1. Abrir caixa
2. Informar valor inicial
3. Registrar entradas automáticas por venda
4. Registrar retirada ou suprimento manual
5. Acompanhar resumo parcial
6. Iniciar fechamento
7. Informar valores contados por forma de pagamento
8. Comparar com valores esperados
9. Exigir justificativa se houver divergência
10. Encerrar caixa

### Permissões

- atendente: visualiza resumo e registra venda se permitido
- operador de caixa: abre, movimenta e fecha o próprio caixa
- gerente/supervisor: fecha com divergência e reabre exceções
- dono: acesso total

### Auditoria

Registrar:

- quem abriu
- quem fez cada retirada/suprimento
- quem fechou
- divergência encontrada
- justificativa
- timestamp

### Modelagem básica

`cash_registers`

- abertura/fechamento
- valores esperados e informados
- status

`cash_movements`

- vendas
- retirada
- suprimento
- estorno
- ajuste manual

## 17. Histórico de pedidos

### Recursos necessários

- busca avançada
- filtros por canal, data, cliente, status, pagamento, motoboy
- detalhe com linha do tempo
- itens
- origem
- pagamentos
- cancelamentos
- observações

### Ações úteis

- repetir pedido
- reabrir como rascunho quando aplicável
- imprimir resumo

### Regra recomendada

`reabrir pedido` no MVP não altera o pedido antigo. O sistema cria um novo rascunho com base no original, para manter a trilha de auditoria limpa.

## 18. Prévia do cardápio digital

### Como integrar sem duplicar frontend

Estratégia recomendada:

- criar componentes compartilhados do storefront em um pacote comum
- o admin consome o mesmo pacote em uma rota interna de preview
- a preview usa dados da loja em modo `preview`

### Implementação prática

- `packages/catalog-ui`
- `packages/ordering-core`
- `apps/admin-web`
- `apps/storefront-web` no futuro

No Admin, a rota `/preview/menu` renderiza a mesma árvore visual do cardápio digital, com um header discreto de `Modo de prévia`.

Benefícios:

- zero duplicação de componente de catálogo
- consistência visual entre preview e experiência pública
- evolução conjunta dos dois canais

## 19. UX, design system e proposta visual

### Direção visual

Conceito recomendado: `Graphite & Sand`

- base clara e quente
- contraste alto para leitura operacional
- acento de marca mais sofisticado, sem cair no genérico
- aparência premium, porém funcional

### Tokens de cor sugeridos

- `bg-canvas`: `#F5F3EE`
- `bg-surface`: `#FFFFFF`
- `bg-muted`: `#ECE7DE`
- `border-subtle`: `#D9D1C5`
- `text-primary`: `#1F252B`
- `text-secondary`: `#5D6772`
- `brand-primary`: `#C65D2E`
- `brand-primary-soft`: `#F3DED3`
- `success`: `#1E8E5A`
- `warning`: `#D79A1E`
- `danger`: `#C6463A`
- `info`: `#2F6FED`
- `prep`: `#E68A1F`
- `ready`: `#218D7A`
- `route`: `#2B6FE8`
- `finished`: `#6B7280`

### Tipografia

- interface: `Plus Jakarta Sans`
- números, códigos e métricas: `JetBrains Mono`

### Ícones

Biblioteca recomendada:

- `Phosphor Icons` para uma linguagem mais premium

Ícones sugeridos por menu:

- Dashboard: `ChartBar`
- Pedidos: `Receipt`
- Salão / Mesas: `ForkKnife`
- Lançar Pedido: `PlusSquare`
- Motoboys: `Motorcycle`
- Caixa: `CashRegister`
- Cardápio: `Notebook`
- Promoções: `SealPercent`
- Cupons: `Ticket`
- Histórico: `ClockCounterClockwise`
- Relatórios: `ChartLineUp`
- Configurações: `GearSix`
- Usuários: `UsersThree`

### Grid

- sidebar fixa: `272px`
- header: `64px`
- conteúdo: grid de 12 colunas
- gutters: `24px`
- spacing base: múltiplos de `4`

### Componentes principais

- `AppSidebar`
- `TopCommandBar`
- `SectionHeader`
- `FilterBar`
- `StatusBadge`
- `MetricCard`
- `KanbanBoard`
- `OrderCard`
- `OrderDrawer`
- `TableMap`
- `TableChip`
- `ActionToolbar`
- `EntityTable`
- `FormDrawer`
- `ConfirmActionDialog`
- `RealtimeIndicator`
- `DriverMap`
- `Timeline`

### Padrões de badge/status

- badge pequena, cantos de 999px, tipografia 12/600
- uma cor dominante por estado
- usar variação `soft` em listas e `solid` em alertas

### Padrões de card

- padding 14 a 16
- sombra baixa
- borda sutil
- faixa lateral estreita por status
- prioridade como indicador no topo direito

### Padrões de tabela

- cabeçalho sticky
- zebra muito leve ou divisória simples
- ações em linha no hover
- filtros sempre visíveis no topo

### Padrões de mapa

- mapa com base clara
- pinos do motoboy por status
- loja como marcador fixo
- rota com linha sólida
- pedidos como pequenos pontos numerados internamente

### Drawer lateral

- usar para detalhe operacional frequente
- evitar modal para leitura/ação complexa
- modal só para confirmação crítica ou fluxo curto

## 20. Stack e arquitetura técnica

### Frontend

Recomendação:

- React + TypeScript
- Vite
- TanStack Router
- TanStack Query
- Zustand
- React Hook Form
- Zod
- Tailwind CSS com tokens próprios
- Radix UI para primitivas acessíveis

### Backend

Recomendação:

- Node.js + TypeScript
- NestJS com adaptador Fastify
- WebSocket Gateway
- BullMQ para jobs assíncronos
- Redis para cache, fila e pub/sub

### Banco

- PostgreSQL como fonte transacional principal
- PostGIS para geolocalização e consultas espaciais

### ORM / acesso a dados

Comparativo curto:

- Prisma: ótimo para produtividade, menos natural para SQL pesado
- Drizzle: mais próximo do SQL, melhor para consultas operacionais e relatórios
- TypeORM: evitar em projeto novo

Recomendação:

- `Drizzle ORM` + SQL explícito para relatórios e consultas críticas

### Realtime

Modelo recomendado:

- eventos de domínio no backend
- fan-out por loja via Redis pub/sub
- WebSocket para o admin
- payloads mínimos com patch de entidade

### Mapas e geolocalização

Comparativo curto:

- Google Maps: melhor qualidade de geocoding/rotas, custo maior
- Mapbox: ótima experiência visual e boa flexibilidade

Recomendação inicial:

- Google Maps Platform para geocoding e cálculo de rota
- camada `GeoProvider` abstrata para troca futura

### Autenticação

Recomendação:

- autenticação própria com Argon2
- JWT access token curto
- refresh token com rotação
- sessão por dispositivo
- RBAC por loja e perfil

### Storage

- S3 compatível
- preferir Cloudflare R2 ou AWS S3
- imagens servidas via CDN

### Logs e observabilidade

- `Pino` para logs estruturados
- `OpenTelemetry` para tracing
- `Loki + Grafana` ou serviço gerenciado equivalente

### Auditoria

- tabela `audit_logs`
- eventos críticos também em fila assíncrona para redundância

### Relatórios

No MVP:

- consultas SQL e snapshots agregados por dia

Fase 2:

- materialized views
- pipeline analítico dedicado

### Arquitetura recomendada para começar sem gambiarra

Monorepo com pacotes compartilhados:

- `apps/admin-web`
- `apps/api`
- `apps/desktop` no futuro
- `packages/ui`
- `packages/domain`
- `packages/api-client`
- `packages/realtime-client`
- `packages/catalog-ui`

## 21. Estrutura de pastas do frontend

```text
apps/admin-web/
  src/
    app/
      router/
      providers/
      layouts/
    components/
      ui/
      shared/
      maps/
      kanban/
    features/
      dashboard/
      orders/
      dining/
      manual-order/
      catalog/
      promotions/
      coupons/
      drivers/
      cash/
      history/
      reports/
      settings/
      auth/
    lib/
      http/
      auth/
      realtime/
      formatters/
      constants/
    stores/
    hooks/
    styles/
    assets/
```

### Convenção por feature

```text
features/orders/
  api/
  components/
  hooks/
  pages/
  schemas/
  store/
  types/
  utils/
```

## 22. Estrutura de pastas do backend

```text
apps/api/
  src/
    main.ts
    app.module.ts
    common/
      decorators/
      guards/
      interceptors/
      filters/
      pipes/
    config/
    infra/
      db/
      cache/
      queue/
      storage/
      geo/
      realtime/
      observability/
    modules/
      auth/
      tenancy/
      users/
      customers/
      catalog/
      orders/
      dining/
      delivery/
      payments/
      cash/
      reports/
      audit/
      settings/
    jobs/
    tests/
```

### Convenção interna do módulo

```text
modules/orders/
  application/
  domain/
  infrastructure/
  presentation/
  orders.module.ts
```

## 23. Modelagem de dados inicial

### `tenants`

- objetivo: conta SaaS principal
- campos: `id`, `name`, `slug`, `status`, `plan`, `timezone`, `created_at`
- relacionamentos: 1:N com `stores`
- índices: `slug` único

### `stores`

- objetivo: unidade operacional
- campos: `id`, `tenant_id`, `name`, `trade_name`, `phone`, `email`, `timezone`, `currency`, `address_json`, `latitude`, `longitude`, `status`, `created_at`
- relacionamentos: N:1 com `tenants`; 1:N com quase todas as entidades operacionais
- índices: `tenant_id`, `status`, índice espacial em `latitude/longitude` se modelado por geography

### `users`

- objetivo: usuários autenticados da plataforma
- campos: `id`, `name`, `email`, `phone`, `password_hash`, `status`, `last_login_at`, `created_at`
- relacionamentos: N:N indireto com `stores` via `user_store_permissions`
- índices: `email` único, `phone`

### `roles`

- objetivo: papéis padrão ou customizados
- campos: `id`, `tenant_id`, `code`, `name`, `description`, `is_system`, `permissions_json`
- relacionamentos: 1:N com `user_store_permissions`
- índices: `tenant_id`, `code`

### `user_store_permissions`

- objetivo: vincular usuário, loja e papel
- campos: `id`, `user_id`, `store_id`, `role_id`, `is_active`, `overrides_json`, `created_at`
- relacionamentos: N:1 com `users`, `stores`, `roles`
- índices: único em `user_id + store_id`, `store_id + role_id`

### `customers`

- objetivo: cadastro unificado de cliente
- campos: `id`, `tenant_id`, `name`, `phone`, `phone_normalized`, `email`, `birth_date`, `notes`, `is_blocked`, `last_order_at`, `created_at`
- relacionamentos: 1:N com `customer_addresses`, `orders`
- índices: `tenant_id + phone_normalized`, `last_order_at`

### `customer_addresses`

- objetivo: endereços do cliente
- campos: `id`, `customer_id`, `label`, `street`, `number`, `complement`, `district`, `city`, `state`, `zip_code`, `reference`, `latitude`, `longitude`, `is_default`, `created_at`
- relacionamentos: N:1 com `customers`
- índices: `customer_id`, índice espacial em coordenadas

### `dining_areas`

- objetivo: setores do salão
- campos: `id`, `store_id`, `name`, `code`, `color`, `sort_order`, `is_active`
- relacionamentos: 1:N com `tables`
- índices: `store_id + sort_order`

### `tables`

- objetivo: cadastro de mesas físicas
- campos: `id`, `store_id`, `dining_area_id`, `code`, `capacity`, `shape`, `position_x`, `position_y`, `is_active`
- relacionamentos: N:1 com `dining_areas`; 1:N com `table_sessions`
- índices: `store_id + code` único, `dining_area_id`

### `table_sessions`

- objetivo: sessão de atendimento de uma mesa
- campos: `id`, `store_id`, `table_id`, `opened_by_user_id`, `closed_by_user_id`, `status`, `guest_count`, `opened_at`, `closed_at`, `subtotal_amount`, `discount_amount`, `service_fee_amount`, `total_amount`, `notes`
- relacionamentos: N:1 com `tables`; 1:N com `orders`
- índices: `store_id + status`, `table_id + status`, `opened_at`

### `categories`

- objetivo: agrupamento do cardápio
- campos: `id`, `store_id`, `name`, `slug`, `description`, `image_url`, `sort_order`, `is_active`, `is_featured`
- relacionamentos: 1:N com `products`
- índices: `store_id + sort_order`, `store_id + slug`

### `products`

- objetivo: item vendável base
- campos: `id`, `store_id`, `category_id`, `sku`, `type`, `name`, `description`, `base_price`, `compare_price`, `image_url`, `is_active`, `is_featured`, `prep_station`, `sort_order`, `metadata_json`, `created_at`
- relacionamentos: N:1 com `categories`; 1:N com `product_channels`, `product_option_groups`, `order_items`
- índices: `store_id + category_id`, `store_id + is_active`, `store_id + sort_order`, `sku`

### `product_channels`

- objetivo: disponibilidade do produto por canal
- campos: `id`, `product_id`, `channel`, `is_available`, `is_visible`, `is_sold_out`, `price_override`, `starts_at`, `ends_at`, `updated_at`
- relacionamentos: N:1 com `products`
- índices: único em `product_id + channel`, `channel + is_available + is_sold_out`

### `product_option_groups`

- objetivo: grupos de opcionais/variações
- campos: `id`, `product_id`, `name`, `selection_type`, `min_select`, `max_select`, `is_required`, `sort_order`, `is_active`
- relacionamentos: 1:N com `product_options`
- índices: `product_id + sort_order`

### `product_options`

- objetivo: opções de cada grupo
- campos: `id`, `option_group_id`, `name`, `price_delta`, `is_default`, `is_active`, `is_sold_out`, `sort_order`
- relacionamentos: N:1 com `product_option_groups`; 1:N com `order_item_options`
- índices: `option_group_id + sort_order`, `option_group_id + is_active`

### `promotions`

- objetivo: regras comerciais automáticas
- campos: `id`, `store_id`, `name`, `type`, `status`, `priority`, `stackable`, `starts_at`, `ends_at`, `eligible_channels`, `conditions_json`, `benefits_json`, `created_by_user_id`
- relacionamentos: N:1 com `stores`
- índices: `store_id + status`, `store_id + starts_at + ends_at`, `type`

### `coupons`

- objetivo: descontos por código
- campos: `id`, `store_id`, `code`, `discount_type`, `discount_value`, `max_discount_amount`, `valid_from`, `valid_until`, `usage_limit_total`, `usage_limit_per_customer`, `min_order_amount`, `eligible_channels`, `status`, `rules_json`
- relacionamentos: N:1 com `stores`
- índices: `store_id + code` único, `store_id + status`, `valid_until`

### `orders`

- objetivo: entidade central da venda
- campos: `id`, `store_id`, `table_session_id`, `customer_id`, `customer_address_id`, `driver_id`, `order_number`, `business_date`, `channel`, `source`, `service_type`, `status`, `payment_status`, `priority_level`, `is_auto_accepted`, `placed_at`, `accepted_at`, `production_started_at`, `ready_at`, `dispatched_at`, `completed_at`, `canceled_at`, `cancel_reason`, `subtotal_amount`, `discount_amount`, `delivery_fee_amount`, `service_fee_amount`, `total_amount`, `notes`, `customer_snapshot_json`, `address_snapshot_json`, `sla_due_at`
- relacionamentos: N:1 com `stores`, `customers`, `table_sessions`; 1:N com `order_items`, `payments`, `order_status_history`
- índices: único em `store_id + business_date + order_number`, `store_id + status + placed_at`, `customer_id + placed_at`, `driver_id + status`

### `order_items`

- objetivo: itens do pedido
- campos: `id`, `order_id`, `product_id`, `line_number`, `product_name_snapshot`, `quantity`, `unit_price`, `discount_amount`, `total_amount`, `notes`, `item_status`, `sent_to_production_at`
- relacionamentos: N:1 com `orders`; 1:N com `order_item_options`
- índices: `order_id + line_number`, `order_id + item_status`

### `order_item_options`

- objetivo: opcionais dos itens do pedido
- campos: `id`, `order_item_id`, `product_option_id`, `option_name_snapshot`, `quantity`, `unit_price`, `total_amount`
- relacionamentos: N:1 com `order_items`
- índices: `order_item_id`

### `order_status_history`

- objetivo: trilha de status do pedido
- campos: `id`, `order_id`, `from_status`, `to_status`, `actor_type`, `actor_id`, `reason`, `metadata_json`, `created_at`
- relacionamentos: N:1 com `orders`
- índices: `order_id + created_at`, `to_status + created_at`

### `payments`

- objetivo: pagamentos e eventos financeiros do pedido
- campos: `id`, `order_id`, `cash_register_id`, `method`, `status`, `amount`, `change_for_amount`, `provider`, `provider_reference`, `paid_at`, `metadata_json`
- relacionamentos: N:1 com `orders`, `cash_registers`
- índices: `order_id`, `cash_register_id`, `method + status`

### `cash_registers`

- objetivo: turno de caixa
- campos: `id`, `store_id`, `opened_by_user_id`, `closed_by_user_id`, `status`, `opened_at`, `closed_at`, `opening_amount`, `expected_amount`, `counted_amount`, `difference_amount`, `notes`
- relacionamentos: 1:N com `cash_movements`, `payments`
- índices: `store_id + status`, `opened_at`

### `cash_movements`

- objetivo: movimentações manuais e automáticas do caixa
- campos: `id`, `cash_register_id`, `order_id`, `type`, `payment_method`, `amount`, `reason`, `created_by_user_id`, `created_at`
- relacionamentos: N:1 com `cash_registers`, `orders`
- índices: `cash_register_id + created_at`, `type`

### `drivers`

- objetivo: cadastro operacional de entregadores
- campos: `id`, `store_id`, `user_id`, `name`, `phone`, `vehicle_type`, `status`, `availability_status`, `tracking_enabled`, `hired_at`, `metadata_json`
- relacionamentos: N:1 com `stores`; 1:N com `driver_shifts`, `driver_locations`, `delivery_assignments`
- índices: `store_id + status`, `store_id + availability_status`

### `driver_shifts`

- objetivo: turnos do motoboy
- campos: `id`, `driver_id`, `store_id`, `status`, `started_at`, `ended_at`, `start_latitude`, `start_longitude`
- relacionamentos: N:1 com `drivers`
- índices: `driver_id + started_at`, `store_id + status`

### `driver_locations`

- objetivo: histórico de localização
- campos: `id`, `driver_id`, `shift_id`, `captured_at`, `latitude`, `longitude`, `heading`, `speed_kmh`, `accuracy_meters`, `source`
- relacionamentos: N:1 com `drivers`, `driver_shifts`
- índices: `driver_id + captured_at desc`, índice espacial por coordenada

### `delivery_batches`

- objetivo: agrupar múltiplos pedidos na mesma saída
- campos: `id`, `store_id`, `driver_id`, `status`, `created_at`, `started_at`, `closed_at`, `suggested_sequence_json`, `final_sequence_json`, `actual_sequence_json`, `estimated_distance_meters`, `estimated_duration_seconds`
- relacionamentos: N:1 com `drivers`, `stores`; 1:N com `delivery_assignments`
- índices: `store_id + status`, `driver_id + status`

### `delivery_assignments`

- objetivo: vínculo entre pedido, motoboy e lote
- campos: `id`, `order_id`, `driver_id`, `delivery_batch_id`, `status`, `assigned_at`, `picked_up_at`, `delivered_at`, `planned_sequence`, `final_sequence`, `actual_sequence`, `distance_meters`, `duration_seconds`
- relacionamentos: N:1 com `orders`, `drivers`, `delivery_batches`
- índices: único parcial por `order_id` em status abertos, `driver_id + status`, `delivery_batch_id + final_sequence`

### `reports_snapshots`

- objetivo: snapshots agregados para relatórios rápidos
- campos: `id`, `store_id`, `scope`, `period_start`, `period_end`, `snapshot_date`, `metrics_json`, `created_at`
- relacionamentos: N:1 com `stores`
- índices: `store_id + scope + snapshot_date`, `period_start + period_end`

### `audit_logs`

- objetivo: trilha de auditoria
- campos: `id`, `tenant_id`, `store_id`, `user_id`, `entity_type`, `entity_id`, `action`, `before_json`, `after_json`, `ip_address`, `user_agent`, `created_at`
- relacionamentos: N:1 com `users`, `stores`, `tenants`
- índices: `store_id + created_at`, `entity_type + entity_id`, `user_id + created_at`

## 24. Regras de negócio importantes

### Aceite automático de pedidos

- permitido apenas se `store.auto_accept_enabled = true`
- só para pedidos com pagamento validado ou canal confiável configurado
- bloqueia autoaceite se:
  - item estiver esgotado
  - endereço estiver fora da área
  - cupom for inválido
  - valor ultrapassar limite de conferência manual
  - cliente estiver bloqueado

### Transição de status

Fluxo padrão delivery:

- `draft -> in_analysis -> accepted -> in_preparation -> ready -> out_for_delivery -> completed`

Fluxo padrão retirada:

- `draft -> in_analysis -> accepted -> in_preparation -> ready_for_pickup -> completed`

Fluxo salão:

- `draft -> accepted -> in_preparation -> served -> completed`

Cancelamento permitido a partir de qualquer status operacional, mas sempre gerando histórico e motivo.

### Item esgotado

- `is_sold_out = true` bloqueia novas vendas no canal
- não altera pedidos já confirmados
- permissões elevadas podem reativar

### Produto indisponível por canal

- produto com `is_available = false` em `product_channels` não aparece e não pode ser vendido naquele canal
- no admin, apenas perfis com permissão comercial podem sobrescrever

### Fechamento de mesa

- não pode fechar sem pagamento quitado, salvo perfil superior com ajuste/manual
- itens já enviados à produção não podem ser removidos sem auditoria
- ao fechar, a mesa muda para `conta fechada` e depois `livre` após liberação operacional

### Fechamento de caixa

- só um caixa aberto por operador por loja no MVP
- fechamento exige total contado
- divergência acima do limite requer justificativa
- divergência acima do limite crítico requer gerente/supervisor

### Vinculação de motoboy ao pedido

- pedido precisa estar `ready` ou autorizado para pré-vínculo
- um pedido só pode ter uma atribuição ativa
- reatribuição mantém histórico

### Compartilhamento de localização

- só durante turno ativo e tracking habilitado
- cliente não vê coordenadas brutas
- loja vê mapa completo

### Visibilidade do cliente

- cliente vê apenas o próprio pedido
- em rotas múltiplas, vê status genérico até virar a próxima parada

### Múltiplos pedidos na mesma rota

- `delivery_batch` concentra o lote
- ordem sugerida, final e real ficam registradas
- apenas operação interna vê a fila completa

### Cancelamentos

- motivo obrigatório
- se houver pagamento confirmado, gera pendência de estorno/reembolso
- perfil de cozinha não cancela pedido financeiro; só sinaliza exceção

### Divergência de caixa

- abaixo do limite leve: registrar justificativa
- acima do limite moderado: exige validação do gerente
- acima do limite crítico: alerta e bloqueio de encerramento automático

### Permissões por perfil

- sempre por loja
- papel base + overrides
- ações críticas exigem permissão explícita

## 25. Perfis e permissões

### Dono

- acesso total a todas as lojas do tenant
- configurações, financeiro, relatórios, usuários, auditoria

### Gerente

- acesso total operacional da loja
- aprova cancelamentos, divergências de caixa e ajustes críticos

### Atendente

- opera pedidos, salão e lançamento manual
- não acessa configuração sensível nem fechamento crítico

### Operador de caixa

- abre/fecha caixa
- registra suprimento/retirada
- consulta pedidos e pagamentos

### Cozinha

- vê fila de produção
- muda status para preparo/pronto
- não acessa financeiro e configuração

### Motoboy

- vê pedidos atribuídos
- ajusta ordem da própria rota dentro do permitido
- envia localização

### Supervisor

- ponte entre gerente e operação
- pode desbloquear exceções operacionais
- pode auditar pedidos, salão e motoboys

## 26. Backlog priorizado do MVP

### P0

- shell do admin, autenticação e autorização
- cadastro de loja, usuários e perfis
- modelagem central de pedidos
- tela de pedidos kanban com realtime
- drawer de pedido
- lançar pedido manual
- cardápio com categorias, produtos e opcionais
- disponibilidade por canal e esgotamento
- caixa básico
- histórico de pedidos

### P1

- salão/mesas MVP
- motoboys com vínculo e mapa básico
- cupons simples
- dashboard operacional
- prévia do cardápio digital
- auditoria

### P2

- promoções automáticas
- lote de entregas e rota sugerida
- relatórios completos
- transferências e separação de conta avançadas

## 27. Plano de implementação em fases

### Fase 0. Fundação

- monorepo
- design system base
- auth
- tenancy
- store context

### Fase 1. Núcleo operacional

- pedidos
- lançamento manual
- cardápio core
- histórico

### Fase 2. Operação de loja

- salão
- caixa
- motoboys básico

### Fase 3. Inteligência comercial

- cupons
- promoções
- dashboard
- relatórios MVP

### Fase 4. Expansão

- desktop shell
- roteirização avançada
- relatórios avançados
- automações

## 28. Exemplos de payloads / API

### Criar pedido manual

```http
POST /api/v1/stores/{storeId}/orders
```

```json
{
  "channel": "delivery",
  "source": "admin_manual",
  "serviceType": "delivery",
  "customer": {
    "id": "cus_123"
  },
  "addressId": "addr_456",
  "items": [
    {
      "productId": "prd_burger",
      "quantity": 2,
      "notes": "Sem cebola",
      "options": [
        {
          "optionId": "opt_cheese",
          "quantity": 1
        }
      ]
    }
  ],
  "couponCode": "NOITE10",
  "payment": {
    "method": "pix",
    "status": "pending"
  },
  "sendToProduction": true
}
```

### Listar pedidos do kanban

```http
GET /api/v1/stores/{storeId}/orders?view=kanban&statuses=in_analysis,in_preparation,ready,out_for_delivery,completed_recent
```

### Mover status do pedido

```http
POST /api/v1/orders/{orderId}/status
```

```json
{
  "toStatus": "in_preparation",
  "reason": "accepted_by_operator"
}
```

### Abrir sessão de mesa

```http
POST /api/v1/stores/{storeId}/table-sessions
```

```json
{
  "tableId": "tbl_12",
  "guestCount": 4,
  "notes": "Aniversário"
}
```

### Atualizar disponibilidade de produto por canal

```http
PATCH /api/v1/products/{productId}/channels/{channel}
```

```json
{
  "isAvailable": true,
  "isVisible": true,
  "isSoldOut": false,
  "priceOverride": 34.9
}
```

### Atribuir motoboy

```http
POST /api/v1/orders/{orderId}/delivery-assignment
```

```json
{
  "driverId": "drv_123",
  "deliveryBatchId": "bat_456"
}
```

### Fechar caixa

```http
POST /api/v1/cash-registers/{cashRegisterId}/close
```

```json
{
  "countedByMethod": {
    "cash": 420.0,
    "pix": 860.0,
    "credit_card": 540.0
  },
  "notes": "Diferença pequena no dinheiro físico"
}
```

## 29. Eventos realtime sugeridos

Envelope padrão:

```json
{
  "event": "order.status.changed",
  "storeId": "str_123",
  "occurredAt": "2026-04-22T19:32:11Z",
  "payload": {}
}
```

Eventos:

- `order.created`
- `order.updated`
- `order.status.changed`
- `order.priority.changed`
- `order.canceled`
- `payment.updated`
- `table.session.opened`
- `table.session.updated`
- `table.session.closed`
- `product.channel.updated`
- `driver.status.updated`
- `driver.location.updated`
- `delivery.assignment.created`
- `delivery.batch.updated`
- `cash.register.opened`
- `cash.movement.created`
- `cash.register.closed`

## 30. Proposta visual do painel

### Estrutura

- sidebar fixa escura suave em grafite
- superfícies principais claras
- cards brancos com bordas quentes
- header discreto, com busca e atalhos

### Linguagem visual

- painéis com cantos 16
- badges pequenas e elegantes
- muita hierarquia por peso tipográfico, pouco ruído cromático
- status operacionais com faixa lateral e badge

### Padrões visuais importantes

- coluna do kanban com contador fixo no topo
- atraso destacado por halo/vermelho suave, não por piscada exagerada
- mesa com cor por estado e número grande centralizado
- mapas com superfície clara para não competir com o resto da operação

## 31. Recomendação para virar desktop/EXE

### Estratégia correta

- desenvolver o admin como SPA robusta
- evitar dependência de APIs exclusivas de navegador
- encapsular integração com impressora, arquivos e notificações em adapters
- depois empacotar com shell desktop

### Comparativo

- Electron: melhor ecossistema para hardware e periféricos
- Tauri: app mais leve e moderno

### Recomendação

Para restaurante, a chance de precisar:

- impressão térmica
- integração com dispositivos locais
- inicialização automática
- comportamento de app residente

é alta. Por isso, a recomendação mais segura para fase desktop é:

- manter o frontend shell-agnóstico
- planejar `apps/desktop` com Electron

Se a necessidade for só empacotar o admin com leveza, Tauri pode entrar depois sem reescrever a aplicação.

## 32. Decisões finais recomendadas

- primeira tela do sistema: `Pedidos`
- `Categorias` e `Produtos` como abas dentro de `Cardápio`
- `Dashboard` enxuto, não protagonista
- `table_session` + `order` principal para salão no MVP
- `product_channels` como tabela obrigatória
- `delivery_batch` desde cedo, mesmo que simples
- preview do cardápio usando componentes compartilhados
- monorepo desde o início
- backend modular com NestJS + Fastify + Redis + PostgreSQL/PostGIS
- frontend com React + TypeScript + TanStack + design system próprio
