# Plano de implementacao do Cain Garcom

## Escolha arquitetural

Criar `apps/waiter-app` com React, TypeScript e Vite. A aplicacao tera CSS proprio baseado nos tokens visuais do Cain, sem importar o shell administrativo, mapas, graficos ou componentes pesados.

Persistencia definitiva permanece na API/PostgreSQL. O navegador guarda somente sessao efemera, cache recente e rascunho descartavel.

## Etapa 1 — dominio e seguranca

- adicionar permissoes granulares `waiter:*`;
- retirar `dining:update` do papel waiter;
- criar guard que revalida vinculo ativo/role em cada request `/waiter`;
- adicionar versoes e vinculos de producao por migration aditiva;
- corrigir isolamento do realtime por loja;
- criar DTOs Zod e modulo `/waiter`.

## Etapa 2 — operacoes

- bootstrap e menu minimo;
- listar/detalhar mesas;
- abrir sessao com concorrencia;
- enviar lote idempotente com preco/opcoes revalidados;
- diferenciar pedido inicial/adicao;
- cancelar linha enviada e imprimir remocao;
- marcar pronto como entregue;
- transferir mesa;
- solicitar fechamento sem capacidade financeira.

## Etapa 3 — PWA

- login e sessao curta;
- Mesas, Pedidos, Comanda e Perfil;
- catalogo rapido, adicionais e stepper;
- rascunho isolado por loja/usuario/sessao;
- manifest, service worker, standalone e atualizacao controlada;
- SSE autenticado com reconexao;
- estados loading/vazio/erro/offline/conflito/permissao.

## Etapa 4 — qualidade

- unidade: filtros, busca, opcoes, draft, conexao e permissoes;
- componentes: mesas, produto, carrinho e alertas;
- API: RBAC, tenant, concorrencia, idempotencia, preco e impressao;
- integracao PostgreSQL: abrir, enviar, adicionar, pronto, entregar e fechamento solicitado;
- E2E: sete fluxos operacionais;
- carga sintetica: 100 mesas, 500 produtos, 20 categorias, 50 usuarios, 100 updates e 100 itens;
- visual: cinco viewports e screenshots ficticios.

## Fora da primeira versao

- pagamento/fechamento financeiro pelo garcom;
- divisao complexa;
- edicao de item ja enviado sem cancelamento explicito;
- criacao definitiva offline;
- push notification;
- app nativo/Play Store;
- telemetria externa;
- impressora fisica.

## Gates

1. Nenhum endpoint aceita loja, preco ou ator confiavel do frontend.
2. Garcom de outra loja ou sessao alheia recebe negacao.
3. Toda mutacao usa idempotencia e versao esperada.
4. Offline nunca exibe envio confirmado.
5. PWA nao manipula `PrintJob`.
6. Nenhuma classificacao de celular/restaurante sem teste fisico.
