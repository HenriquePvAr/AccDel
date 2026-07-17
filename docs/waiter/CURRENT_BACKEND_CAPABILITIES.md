# Capacidades atuais do backend para o Cain Garcom

Data da auditoria: 15/07/2026
Base analisada: `317d6c5`

## Resumo

O backend existente deve continuar sendo a unica fonte da verdade. A PWA pode reutilizar autenticacao, catalogo, salao, pedidos, cozinha, impressao e o mecanismo de idempotencia. Nao e necessario criar outro banco ou outro servico.

Entretanto, os endpoints administrativos de `dining` retornam mais dados e concedem mais capacidade do que um dispositivo de garcom precisa. A aplicacao usara uma fachada minima `/waiter`, apoiada nos mesmos modelos e servicos de dominio.

## Capacidades reutilizaveis

| Dominio | Capacidade existente | Decisao |
| --- | --- | --- |
| Autenticacao | `POST /auth/login`, `GET /auth/me`, JWT com loja/role/permissoes | Reutilizar; PWA aceita apenas usuario com permissoes de garcom |
| Loja/tenant | `storeId` derivado do JWT e `StoreContext` | Reutilizar; nunca aceitar loja do payload |
| Salao | areas, mesas, sessao atual, pessoas, garcom, timeline | Reutilizar modelos e mappers; expor DTO minimo |
| Abertura | `POST /dining/tables/:id/open-session` | Reutilizar logica, adicionar autoria e concorrencia seguras |
| Lancamento | `POST /dining/sessions/:id/add-items` | Reutilizar revalidacao de produto, opcao, disponibilidade e preco |
| Fechamento | sessao aceita `awaiting_close` e fechamento financeiro separado | Garcom somente solicita fechamento; caixa continua fechando/pagando |
| Transferencia | backend valida destino e mesma loja | Expor com permissao especifica e versao esperada |
| Divisao | divisao por item ja existe e fecha parcela | Nao expor na PWA inicial; fluxo financeiro complexo permanece no caixa |
| Catalogo | `GET /catalog/menu-source?channel=dine_in` com opcoes e disponibilidade | Reutilizar consulta; retornar apenas categorias/produtos necessarios |
| Preco | calculado novamente pelo backend no lancamento | Obrigatorio; frontend envia somente IDs, quantidades, opcoes e notas |
| Cozinha | pedidos de salao sao criados em `in_preparation`; cozinha marca `ready` | Reutilizar pedido como estado de producao |
| Impressao | politica cria `PrintJob` no evento do pedido | PWA nunca cria ou reprocessa job; exibe somente estado resumido |
| Idempotencia | interceptor persistente por loja/ator/operacao | Aplicar a toda mutacao `/waiter` |
| Realtime | `AdminRealtimeService` e SSE de drivers | Reutilizar infraestrutura, corrigindo isolamento por loja e criando SSE minimo |

## Fluxo atual de lancamento

`DiningService.addItems` ja executa em uma transacao:

1. valida sessao da loja;
2. busca produtos ativos e disponiveis em `dine_in`;
3. valida grupos obrigatorios e adicionais;
4. recalcula preco base, adicionais e total;
5. cria um `Order` de producao;
6. cria `PrintJob` pela politica de impressao;
7. adiciona linhas e eventos na sessao;
8. atualiza mesa e metricas do garcom.

Esse pipeline sera preservado. A PWA mantem apenas uma selecao temporaria ate chamar a mutacao.

## Lacunas confirmadas

### Autorizacao

- o papel `waiter` possui hoje `dining:update`, que tambem permite administrar mesas e fechar contas;
- os endpoints aceitam `waiterId`/`actor` do corpo em operacoes administrativas;
- um JWT ja emitido nao consulta novamente se o vinculo foi desativado;
- nao ha regra central que limite o garcom a sua propria sessao.

### Concorrencia

- `DiningTable` e `TableSession` nao possuem versao explicita;
- abertura, lancamento, fechamento e transferencia podem ler estado antigo antes da transacao;
- a UI nao recebe um conflito estruturado para revisao.

### Estado dos itens

- `TableSessionItem` nao aponta para o `Order`/`OrderItem` criado para a cozinha;
- portanto a comanda nao consegue distinguir com seguranca producao, pronto e entregue;
- nao existe estado persistido de entrega do item a mesa nem cancelamento controlado da linha.

### Realtime

- o stream atual exige `drivers:view`;
- o subject atual nao inclui `storeId` no envelope, logo nao deve ser reutilizado diretamente por outro tenant;
- cozinha marca `ready` sem emitir o evento minimo para o salao.

### Primeiro envio versus adicao

- todo lancamento de comanda usa atualmente `ORDER_ADDITION`, inclusive o primeiro;
- a nova implementacao deve usar `ORDER_INITIAL` quando a sessao ainda nao possui itens e `ORDER_ADDITION` nos lotes seguintes.

## Endpoints administrativos que nao serao usados diretamente

- criacao/edicao/status manual de mesas;
- fechamento financeiro e divisao;
- fila e acoes de impressao;
- fila completa da cozinha;
- catalogo administrativo;
- stream logistico de drivers.

## Mudancas minimas propostas

- permissoes `waiter:*` especificas;
- modulo `/waiter` com bootstrap, mesas, detalhe, menu, abertura, envio, cancelamento de item, entrega, transferencia, fechamento solicitado e SSE;
- versao aditiva em mesa/sessao;
- vinculo aditivo de item da comanda ao pedido/item de producao;
- campos aditivos para cancelamento e entrega;
- eventos realtime filtrados pela loja;
- testes negativos de role, tenant, usuario desativado, preco manipulado e conflito.

Nenhuma tabela de pedido, produto, mesa ou comanda sera duplicada.
