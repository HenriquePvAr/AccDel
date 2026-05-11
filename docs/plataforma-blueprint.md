# Blueprint da Plataforma

## 1. Visão oficial do produto

Objetivo: evoluir o produto de um cockpit operacional para uma plataforma completa de restaurante e delivery, com uma única base de catálogo, pedidos, entrega, benefícios e relacionamento.

O produto passa a ser composto por seis módulos principais:

1. Admin / Operação
2. App do cliente
3. App do motoboy
4. App do garçom / salão
5. Cardápio digital
6. Motor comercial de promoções, cupons, fidelidade, cashback e assinatura

Princípios da plataforma:

- uma única fonte de verdade para catálogo, preços, benefícios, pedidos e entrega
- regras comerciais centralizadas no backend e reutilizadas por todos os canais
- experiência multicanal consistente, sem duplicar lógica por app
- tracking e ETA tratados como produto, não como detalhe visual
- benefícios configuráveis no admin, sem hardcode de regra
- expansão por módulos sem quebrar o que já existe

## 2. Arquitetura funcional do produto

### 2.1 Superfícies do sistema

#### Admin / Operação

Responsável por:

- pedidos em tempo real
- salão e mesas
- caixa
- catálogo
- promoções, cupons, fidelidade, cashback e assinatura
- acompanhamento da entrega
- gestão de clientes, benefícios e relatórios

#### App do cliente

Responsável por:

- login e cadastro
- endereços
- navegação do cardápio
- carrinho e checkout
- cupons e benefícios
- acompanhamento do pedido
- mapa do motoboy e ETA
- histórico e repetição de pedido
- área do plano, fidelidade e cashback

#### App do motoboy

Responsável por:

- login operacional
- status online/offline
- aceite da corrida ou fila atribuída
- lista de paradas da rota
- localização em tempo real
- atualização de status da entrega

#### App do garçom / salão

Responsável por:

- mapa/lista de mesas
- abertura de mesa
- lançamento e adição de itens
- envio para produção
- fechamento simples
- aplicação de benefícios permitidos no canal salão

#### Cardápio digital

Responsável por:

- descoberta de produtos e categorias
- conversão para pedido
- aplicação de promoções e cupons elegíveis
- experiência guest ou autenticada

#### Motor comercial

Responsável por:

- resolver preço final por item e por pedido
- aplicar promoções automáticas
- validar cupons
- calcular fidelidade
- gerar e consumir cashback
- aplicar benefícios de assinatura
- respeitar canal, cliente, período e elegibilidade

### 2.2 Núcleo compartilhado

Todos os apps consomem os mesmos domínios centrais:

- catálogo
- pricing engine
- pedidos
- entrega e tracking
- clientes
- pagamentos e caixa
- benefícios e relacionamento
- notificações

## 3. Módulos atualizados

### 3.1 Admin / Operação

O blueprint atual do admin continua válido, mas deixa de ser o blueprint principal do produto. Ele passa a ser o blueprint detalhado do módulo operacional.

Novas responsabilidades no admin:

- configurar promoções multicanal
- configurar cupons por cliente, canal e regra
- configurar programas de fidelidade
- configurar cashback
- configurar planos de assinatura e benefícios
- acompanhar tracking e ETA dos pedidos em rota
- visualizar economia gerada por plano e benefícios

### 3.2 App do cliente

Escopo funcional:

- autenticação e perfil
- cadastro e seleção de endereço
- cardápio por categorias, produtos, adicionais e promoções
- carrinho persistente
- checkout com cupom e cashback
- confirmação de pedido
- rastreio do pedido por status e mapa
- ETA estimado
- histórico com repetição
- área de benefícios:
  - cupons disponíveis
  - progresso de fidelidade
  - saldo de cashback
  - plano assinado
  - economia acumulada

### 3.3 App do motoboy

Escopo funcional:

- login operacional
- disponibilidade
- fila de pedidos
- rota sugerida
- visualização das paradas
- atualização de localização
- prova de entrega futura

### 3.4 App do garçom / salão

Escopo funcional:

- mesas e setores
- consumo da mesa
- lançamento rápido
- consulta de itens e adicionais
- fechamento básico
- aplicação controlada de descontos e benefícios elegíveis

### 3.5 Cardápio digital

Escopo funcional:

- catálogo navegável
- exibição de promoções e destaques
- experiência de compra direta
- ponto de entrada para login do cliente
- reaproveitamento visual e lógico do app do cliente

### 3.6 Motor comercial

O motor comercial passa a ser um módulo transversal do produto.

Ele precisa resolver:

- base price por produto
- preço por canal
- preço especial de assinatura
- promoção automática
- cupom manual ou automático
- benefício de fidelidade
- cashback como crédito
- restrições por cliente
- compatibilidade entre regras

## 4. Blueprint técnico atualizado

## 4.1 Arquitetura recomendada

### Frontends

- Admin web com base reaproveitável para desktop
- App do cliente em stack mobile-first, com reaproveitamento máximo de contracts, design tokens e regras
- App do motoboy com foco em tracking, fila e status
- App do garçom com foco em operação rápida offline-tolerant quando necessário
- Cardápio digital reaproveitando o mesmo domínio de catálogo do app do cliente

### Backend

Backend orientado por domínios, com módulos centrais:

- identity-customers
- catalog
- pricing-engine
- promotions-coupons
- loyalty
- cashback
- subscriptions
- orders
- delivery-tracking
- dining
- cash
- notifications

### Banco

Banco relacional com entidades normalizadas para:

- catálogo e canais
- pedidos e price breakdown
- entrega e tracking
- benefícios e carteiras
- assinatura e ledger de economia

### Contracts

Os contracts devem deixar de ser somente “contracts do admin” e virar “contracts da plataforma”, separados por domínio:

- orders
- catalog
- customers
- delivery
- pricing
- loyalty
- cashback
- subscriptions
- cash

## 4.2 Responsabilidades por domínio

### Orders

- criação do pedido
- cálculo final antes de confirmar
- status do pedido
- histórico e repetição
- snapshot comercial do pedido

### Catalog

- categorias, produtos, opcionais, combos e canais
- disponibilidade por canal
- preços base

### Delivery Tracking

- vínculo do pedido ao motoboy
- fila e rota
- localização do motoboy
- ETA interno e ETA do cliente

### Pricing Engine

- avaliação de elegibilidade
- resolução do melhor preço por item
- aplicação de promoção, assinatura, cupom e cashback
- geração do breakdown auditável

### Benefits

- cupons
- promoções
- fidelidade
- cashback
- assinatura

## 5. Prioridade entre preço base, promoção, assinatura, cupom e cashback

### 5.1 Ordem de resolução recomendada

A ordem recomendada para evitar conflitos e manter rastreabilidade é:

1. preço base
2. validação de elegibilidade por canal, horário, cliente e contexto
3. benefício de assinatura ou preço especial de assinante por item
4. promoção automática por item ou por pedido
5. cupom manual ou automático
6. cashback como crédito no pagamento

### 5.2 Regra prática de acumulação

#### Item-level

- preço de assinatura e promoção sobre o mesmo item não acumulam por padrão
- o sistema deve escolher o melhor benefício elegível para aquele item
- a origem do preço aplicado deve ser registrada no breakdown

#### Order-level

- cupom só acumula com promoção se a regra do cupom permitir
- por padrão, cupom manual não acumula com promoção order-level
- cupons automáticos competem entre si e o motor escolhe o melhor, salvo quando a regra permitir empilhamento

#### Cashback

- cashback é aplicado por último como crédito financeiro
- cashback não altera o preço do item
- cashback usado em um pedido não deve gerar cashback sobre o valor abatido

### 5.3 Política recomendada para MVP

- melhor preço por item entre promoção e assinatura
- um único cupom por pedido
- cupom não acumula com promoção por padrão
- cashback fora do MVP operacional inicial, mas modelado desde já

## 6. Regras de negócio principais

### 6.1 App do cliente

- cliente autenticado tem perfil, endereços, histórico e benefícios próprios
- carrinho deve refletir o canal e o contexto do pedido
- checkout deve exibir claramente:
  - subtotal base
  - descontos promocionais
  - desconto de cupom
  - economia do plano
  - uso de cashback
  - total final

### 6.2 Rastreamento e ETA

#### Visão do cliente

- antes de o pedido entrar na perna final da rota: mostrar “motoboy em rota”
- quando o pedido passar a ser a próxima parada relevante: mostrar “motoboy a caminho do seu pedido”
- o cliente vê apenas:
  - posição aproximada do motoboy
  - ETA do próprio pedido
  - status do seu pedido

#### Privacidade

- nunca mostrar nomes, endereços ou quantidade exata de outros clientes
- não mostrar a ordem completa da rota ao cliente
- não mostrar paradas intermediárias com detalhes

#### Fallback

- se a localização estiver desatualizada acima do limite configurado, esconder o marcador em tempo real
- exibir mensagem de fallback: “localização temporariamente indisponível”
- manter o status textual e o ETA mais recente com baixa confiança

#### Atualização do ETA

O ETA deve ser recalculado quando houver:

- mudança no status do pedido
- mudança de rota
- nova posição do motoboy
- atraso relevante de produção

### 6.3 Cupons e promoções

- cupom manual exige ação do cliente ou operador
- cupom automático é aplicado pelo motor sem digitação
- cupom por cliente específico deve depender de vínculo explícito com customer_profile
- cupom por fidelidade é um cupom gerado pelo programa de fidelidade, não uma exceção hardcoded
- promoções precisam declarar canais elegíveis
- promoções multicanal podem ter visibilidade em vários canais e aplicação em subconjunto deles

### 6.4 Fidelidade

- um pedido conta para fidelidade somente quando atingir estado terminal de sucesso
- para delivery e retirada: pedido entregue/concluído e financeiramente válido
- para salão: conta fechada e pagamento confirmado
- pedido cancelado ou estornado não conta
- pedido parcialmente estornado deve seguir regra configurável do programa
- regra do tipo “a cada X pedidos concluídos gera benefício” deve ser cadastrável no admin

Exemplo configurável:

- programa: fidelidade padrão
- regra: a cada 10 pedidos concluídos
- benefício gerado: cupom de 10%
- restrição do benefício: pedido mínimo de R$ 40

### 6.5 Cashback

- cashback deve ser gerado apenas após o pedido concluir e ficar elegível
- o valor base para geração deve ser configurável, mas a recomendação é:
  - considerar valor líquido pago em itens
  - excluir taxa de entrega
  - excluir valor pago com cashback
- cashback deve ter validade
- consumo do cashback deve respeitar saldo disponível e regras mínimas do pedido
- cancelamento/refund do pedido deve reverter cashback ainda não consumido quando aplicável

### 6.6 Assinatura

- o plano de assinatura deve ter preço mensal, vigência e status
- benefícios do plano devem ser configuráveis por item, categoria ou regra
- preço de assinante deve ser tratado como benefício comercial formal, não desconto manual
- economia do plano no pedido:
  - soma da diferença entre preço base elegível e preço final de assinante por item
- economia acumulada do mês:
  - soma das economias dos pedidos do período da assinatura
- economia total do plano:
  - soma histórica da assinatura ou assinaturas do cliente, conforme regra do produto

## 7. Modelagem de dados proposta

## 7.1 Núcleo de cliente e entrega

### customer_profiles

Objetivo:

- armazenar o perfil do cliente para uso multicanal

Campos principais:

- id
- customer_id
- display_name
- phone
- email
- birth_date
- marketing_opt_in
- default_address_id
- created_at
- updated_at

### delivery_assignments

Objetivo:

- vincular pedido, motoboy e estado atual da entrega

Campos principais:

- id
- order_id
- driver_id
- status
- assigned_at
- picked_up_at
- delivered_at
- current_batch_id
- created_at
- updated_at

### delivery_route_stops

Objetivo:

- representar a sequência planejada e real de paradas em uma rota

Campos principais:

- id
- delivery_batch_id
- order_id
- sequence_planned
- sequence_actual
- stop_status
- eta_seconds
- arrived_at
- completed_at

### driver_locations

Objetivo:

- registrar posições do motoboy ao longo do tempo

Campos principais:

- id
- driver_id
- latitude
- longitude
- heading
- speed_kmh
- accuracy_meters
- captured_at

### eta_snapshots

Objetivo:

- guardar o ETA calculado em momentos relevantes para auditoria e UX

Campos principais:

- id
- order_id
- delivery_assignment_id
- eta_seconds
- confidence_level
- source
- created_at

## 7.2 Cupons e promoções

### coupons

Objetivo:

- representar o cupom em si

Campos principais:

- id
- code
- type
- status
- starts_at
- ends_at
- max_redemptions
- max_redemptions_per_customer
- created_at
- updated_at

### coupon_rules

Objetivo:

- separar as regras de elegibilidade e aplicação do cupom

Campos principais:

- id
- coupon_id
- min_order_amount
- eligible_channels
- eligible_customer_scope
- eligible_product_scope
- stack_with_promotions
- stack_with_subscription
- stack_with_cashback

### coupon_redemptions

Objetivo:

- registrar cada uso ou reserva do cupom

Campos principais:

- id
- coupon_id
- customer_id
- order_id
- redeemed_amount
- status
- redeemed_at

### promotions

Objetivo:

- representar uma campanha promocional

Campos principais:

- id
- name
- type
- status
- starts_at
- ends_at
- priority
- created_at
- updated_at

### promotion_rules

Objetivo:

- representar as regras detalhadas da promoção

Campos principais:

- id
- promotion_id
- eligible_channels
- target_scope
- trigger_scope
- benefit_type
- benefit_value
- schedule_window
- stack_policy

## 7.3 Fidelidade

### loyalty_programs

Objetivo:

- representar um programa configurável de fidelidade

Campos principais:

- id
- store_id
- name
- status
- accrual_model
- benefit_model
- created_at
- updated_at

### loyalty_rules

Objetivo:

- permitir múltiplas regras por programa sem hardcode

Campos principais:

- id
- loyalty_program_id
- trigger_type
- trigger_threshold
- eligible_channels
- min_order_amount
- reward_type
- reward_payload
- reset_policy

### customer_loyalty_progress

Objetivo:

- manter o progresso do cliente por programa/regra

Campos principais:

- id
- customer_id
- loyalty_program_id
- loyalty_rule_id
- current_progress
- last_progressed_at
- reward_generated_at

## 7.4 Cashback

### cashback_wallets

Objetivo:

- manter o saldo agregado do cliente

Campos principais:

- id
- customer_id
- available_balance
- pending_balance
- expired_balance
- updated_at

### cashback_transactions

Objetivo:

- ledger de geração, uso, expiração e reversão

Campos principais:

- id
- cashback_wallet_id
- order_id
- type
- amount
- status
- expires_at
- available_at
- created_at

## 7.5 Assinatura

### subscription_plans

Objetivo:

- definir os planos disponíveis

Campos principais:

- id
- store_id
- name
- code
- monthly_price
- billing_cycle
- status
- created_at
- updated_at

### subscription_plan_benefits

Objetivo:

- representar os benefícios configurados do plano

Campos principais:

- id
- subscription_plan_id
- benefit_scope
- target_type
- target_id
- pricing_mode
- benefit_value
- eligible_channels
- starts_at
- ends_at

### customer_subscriptions

Objetivo:

- vincular cliente ao plano e sua vigência

Campos principais:

- id
- customer_id
- subscription_plan_id
- status
- started_at
- renews_at
- cancelled_at

### subscription_savings_ledger

Objetivo:

- registrar quanto o cliente economizou por pedido e por item

Campos principais:

- id
- customer_subscription_id
- order_id
- order_item_id
- base_unit_price
- applied_unit_price
- saved_amount
- created_at

## 7.6 Entidades de apoio recomendadas

Para evitar gambiarra futura, a plataforma também deve prever:

- order_price_snapshots
- order_discount_allocations
- pricing_contexts
- customer_benefit_entitlements

Essas entidades podem entrar depois, mas a arquitetura do backend deve deixar espaço para elas desde já.

## 8. Reflexo multicanal das regras

Toda regra comercial deve declarar, no mínimo:

- canais elegíveis para aplicação
- canais elegíveis para exibição
- tipo de cliente elegível
- vigência
- prioridade
- política de acumulação

Exemplos de canais:

- POS_CASHIER
- WAITER_APP
- DINING
- DELIVERY
- DIGITAL_MENU
- CUSTOMER_APP

Exemplos práticos:

- promoção de happy hour pode valer em salão e app do garçom, mas não no delivery
- cupom de cliente VIP pode valer só no app do cliente
- preço de assinante pode valer no app do cliente e cardápio digital autenticado, mas não no PDV

## 9. Impacto por superfície

### 9.1 Frontend Admin

Impactos:

- nova área de clientes e benefícios
- configuração de programas de fidelidade
- configuração de cashback
- configuração de planos e benefícios do plano
- visão operacional de tracking + ETA
- relatórios comerciais por benefício e economia

### 9.2 App do cliente

Impactos:

- precisa de fluxo completo de conta, endereço e histórico
- precisa consumir pricing breakdown auditável
- precisa de telas de benefícios, carteira e assinatura
- precisa de tracking com mapa e ETA

### 9.3 App do motoboy

Impactos:

- precisa publicar localização com frequência controlada
- precisa enxergar fila e ordem da rota
- precisa refletir mudança da ordem real

### 9.4 Backend

Impactos:

- pricing engine deixa de ser opcional e vira domínio central
- pedidos precisam salvar snapshot comercial auditável
- delivery tracking precisa separar visão interna e visão do cliente
- benefícios precisam de ledger e reversão

### 9.5 Banco

Impactos:

- aumento de tabelas relacionais e ledgers
- necessidade de índices por customer_id, order_id, validity windows e status
- necessidade de guardar snapshots para auditoria de preços e ETA

### 9.6 Contracts

Impactos:

- contracts de pedido precisam expor breakdown detalhado
- contracts de tracking precisam separar visão interna e pública
- contracts de cliente precisam incluir benefícios, histórico e assinatura

## 10. MVP vs fases futuras

## 10.1 MVP da plataforma

### Admin / Operação

- manter o escopo já definido no blueprint do admin
- adicionar base de configuração comercial para cupons e promoções simples

### App do cliente

- login/cadastro
- endereços
- catálogo
- carrinho
- cupom manual
- checkout
- acompanhamento do pedido
- histórico
- repetir pedido

### Tracking

- status do pedido
- mapa com posição aproximada do motoboy
- ETA básico
- privacidade de rota preservada

### App do motoboy

- login operacional
- pedidos atribuídos
- status
- localização em tempo real

### Cardápio digital

- catálogo navegável
- promoções visíveis
- integração com jornada de pedido

### Motor comercial

- promoções por produto, categoria, horário e canal
- cupom manual e automático
- cupom por cliente específico
- estrutura pronta para fidelidade, cashback e assinatura

## 10.2 Fase seguinte

- fidelidade configurável com geração de benefício
- cupons gerados por fidelidade
- visão completa de progresso do cliente

## 10.3 Fase futura

- cashback com carteira e transações
- assinatura recorrente com benefícios
- economia acumulada do plano
- campanhas mais avançadas e regras compostas

## 11. Backlog priorizado

### Bloco 1. Fundação de plataforma

- consolidar enums e contracts multicanal
- criar domínio shared de customer profile
- formalizar pricing breakdown do pedido
- separar tracking interno e tracking público

### Bloco 2. Jornada do cliente

- autenticação do cliente
- endereços
- catálogo e carrinho
- checkout
- histórico e repetir pedido

### Bloco 3. Tracking e ETA

- delivery assignments
- driver locations
- route stops
- ETA snapshots
- tela pública de acompanhamento

### Bloco 4. Motor comercial MVP

- promoções multicanal
- cupom manual
- cupom automático
- cupom por cliente
- políticas de acumulação

### Bloco 5. Fidelidade

- loyalty programs
- loyalty rules
- customer progress
- geração de cupom-benefício

### Bloco 6. Cashback

- wallet
- ledger
- geração
- uso
- expiração

### Bloco 7. Assinatura

- plano
- benefícios
- assinatura do cliente
- ledger de economia

## 12. Ordem recomendada de implementação

1. consolidar o modelo de plataforma, contratos e enum de canais
2. fechar a jornada de compra do cliente com catálogo, carrinho, checkout e histórico
3. integrar tracking do motoboy com status, mapa e ETA básico
4. implantar o motor comercial MVP com promoções e cupons multicanal
5. adicionar fidelidade configurável
6. adicionar cashback
7. adicionar assinatura e economia acumulada

## 13. O que entra no MVP e o que fica para depois

### Entra no MVP

- app do cliente com compra completa
- tracking com mapa e ETA básico
- histórico e repetição
- promoções e cupons multicanal
- tracking interno e público separados
- base de contracts e modelagem para fidelidade, cashback e assinatura

### Fica para depois

- regras avançadas de fidelidade com múltiplos programas simultâneos
- cashback completo com campanha segmentada
- assinatura com billing recorrente completo
- recomendações personalizadas e CRM avançado
- otimização de ETA por tráfego externo e heurísticas avançadas

## 14. Relação com o blueprint do Admin

O arquivo [admin-operacao-blueprint.md](./admin-operacao-blueprint.md) continua sendo a referência detalhada do módulo Admin / Operação.

Este documento passa a ser a referência principal do produto como plataforma completa.
