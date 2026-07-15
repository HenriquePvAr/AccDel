# Arquitetura de impressão térmica

## Objetivo e limites

O backend do Cain Delivery é a única fonte da verdade. Nenhuma mudança visual do
painel e nenhum navegador abrem conexão com impressoras. A impressão física é
responsabilidade exclusiva do Cain Print Agent instalado no estabelecimento.

```text
evento operacional
  -> política de impressão na transação do evento
  -> PrintJob persistente com snapshot imutável
  -> claim PostgreSQL com FOR UPDATE SKIP LOCKED
  -> ledger local do agente
  -> renderização ESC/POS determinística
  -> driver local (dry-run, TCP ou adaptador Windows)
  -> confirmação, retry ou resultado ambíguo
```

Criar o `PrintJob` faz parte da mesma transação que confirma o evento operacional.
Enviar bytes à impressora nunca faz parte dessa transação.

## Eventos mapeados

| Evento real do domínio | Documento | Observação |
| --- | --- | --- |
| Pedido criado diretamente em `in_preparation` | `ORDER_INITIAL` | Itens divididos por estação |
| Primeira transição de `in_analysis` para `in_preparation` | `ORDER_INITIAL` | A chave do evento impede nova via integral |
| Itens lançados em uma comanda | `ORDER_ADDITION` | O domínio já cria um pedido de produção somente com os itens novos |
| Transição para `ready` | `DISPATCH_ORDER` | Configurável por loja |
| Pagamento confirmado como `paid` | `CASHIER_RECEIPT` | Configurável por loja |
| Transição para `cancelled` | `ORDER_CANCELLATION` | Aviso separado; nunca reimprime silenciosamente a via original |
| Solicitação administrativa | `REPRINT` | Exige `printing:reprint`, motivo e auditoria |
| Teste administrativo de impressora | `TEST_PAGE` | Não contém dados de pedido |

Repetir pedido cria um pedido novo em `in_analysis`; portanto não imprime até sua
própria entrada em produção. Atualizações de endereço, responsável ou estado de
tela não criam jobs. O domínio atual não possui mutações de remoção/correção de
itens de pedidos já produzidos; os tipos `ORDER_REMOVAL` e `ORDER_CORRECTION`
ficam definidos para que uma futura mutação explícita possa adotá-los sem
reutilizar `ORDER_INITIAL`.

## Roteamento

Estações têm um identificador opaco e um `code` estável. A política nunca confia
em nomes ou estações enviados pelo frontend.

1. Uma regra de produto ativa tem precedência.
2. Na ausência dela, é usada a regra ativa da categoria.
3. Sem regra, aplica-se `DEFAULT_STATION` ou `BLOCK`, conforme a loja.
4. Um item é incluído no máximo uma vez por evento e em exatamente uma estação.
5. A impressora padrão ativa da estação é selecionada no momento do evento.

Um problema de roteamento ou a ausência de impressora não desaparece: é
persistido como job falho e auditável, sem possibilidade de claim até correção e
retry administrativo. A configuração começa desativada e só pode ser ativada
quando a política de fallback é válida.

## Isolamento e autenticação

- Toda entidade operacional contém `storeId` e toda consulta administrativa o
  filtra a partir do JWT humano.
- Cada agente pertence inicialmente a uma única loja e só recebe jobs de
  impressoras explicitamente vinculadas a ele.
- O agente usa um token aleatório próprio. Somente SHA-256 e um prefixo de
  identificação são persistidos; rotação invalida imediatamente o hash anterior.
- Endpoints do agente são públicos apenas para os guards globais de JWT e têm um
  guard específico, rate limit e contexto de loja derivado da credencial.
- Tokens de agente não são JWT humano e não acessam rotas administrativas.

## Privacidade do snapshot

Jobs de cozinha e bar não contêm telefone, endereço, forma de pagamento ou
preços. Caixa recebe somente dados financeiros necessários. Expedição recebe os
dados operacionais necessários, com telefone mascarado. Logs gerais registram
IDs opacos, códigos, duração e status, nunca o snapshot integral.

## Garantias reais

O sistema garante criação idempotente do job, claim exclusivo durante o lease e
confirmações idempotentes. Impressoras térmicas comuns não oferecem commit
transacional; portanto exactly-once físico não é prometido. O ledger local reduz
a duplicação e converte reinícios ocorridos durante/depois do envio em
`PRINT_RESULT_UNKNOWN`, que exige decisão humana.
