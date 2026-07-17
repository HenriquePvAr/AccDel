# Rastreabilidade de itens da mesa

## Origem dos dados

Cada item de comanda usa `TableSessionItem.createdAt` como horario de lancamento. O valor e criado no backend, no banco, e nao vem do horario do navegador.

O responsavel visivel usa `TableSessionItem.createdByName`. Esse campo e um snapshot textual salvo no momento do lancamento. Ele evita que o historico mude quando o usuario altera o nome depois.

## Pedidos online e automaticos

O fluxo atual de mesa/comanda e `dine_in`. Pedidos online e atendimentos automaticos ja possuem origem no `Order.source` e historico de pedido, mas nao entram diretamente em `TableSessionItem` enquanto nao viram consumo de mesa.

Quando um fluxo interno criar item de mesa sem usuario humano, o backend deve gravar um texto controlado, como `Pedido online`, `Atendimento automatico` ou `Sistema`, em `createdByName`.

## Registros antigos

Itens antigos podem nao ter `createdByName`, porque a coluna foi adicionada por migration anterior. A interface nao infere o responsavel pelo garcom atual da mesa. Nesses casos, mostra `Responsavel nao registrado`.

## Produtos iguais

Itens iguais lancados em momentos diferentes permanecem como linhas separadas em `TableSessionItem`. Isso preserva quantidade, horario e responsavel de cada lancamento.

O carrinho temporario pode agrupar itens iguais antes do envio, mas essa selecao ainda nao e historico persistido. Depois do envio, o retorno da API substitui o estado local pelos dados gravados.

## Timezone

O backend persiste datas como `DateTime` via Prisma/PostgreSQL. A interface formata com `Intl.DateTimeFormat('pt-BR')`, seguindo a timezone do ambiente da loja/navegador em vez de fixar UTC-4 no componente.

Para a loja atual, a configuracao padrao de loja continua sendo `America/Manaus`.

## API e banco

Nao houve nova migration nesta etapa. Os campos necessarios ja existiam:

- `table_session_items.created_at`
- `table_session_items.created_by_name`
- `table_session_events.actor`
- `table_session_events.created_at`

As respostas de mesa/comanda ja expunham `createdAt` e `createdByName` no mapper de dining. A mudanca desta etapa ficou concentrada na apresentacao, testes e documentacao.

## Seguranca

O frontend nao envia horario nem responsavel confiavel para definir autoria. No fluxo do garcom, o backend resolve o usuario pela sessao autenticada e valida loja, mesa e ownership antes de gravar.

O isolamento entre lojas continua protegido por `getCurrentStoreId()` nas consultas e mutacoes de dining/waiter.

## Rollback

O rollback desta etapa e remover as mudancas de apresentacao e testes/documentacao desta branch. Como nao ha migration nova, nao ha rollback de banco.

## Limitacoes

Pedidos de delivery, WhatsApp e cardapio digital exibem historico no pedido, nao por item de comanda. Se esses fluxos passarem a adicionar itens diretamente a mesas, devem preencher `createdByName` com uma origem controlada pelo backend.
