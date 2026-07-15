# Evidências de testes do release candidate

Data: 15/07/2026. Ambiente: Windows, Node.js, PostgreSQL isolado, dados `PILOT_DEMO_DATA`, Print Agent dry-run, providers externos desativados.

## Resultados executados

| Grupo | Resultado |
| --- | --- |
| Painel admin build/lint/test | PASS |
| API build/lint/unitários | PASS — 65/65 |
| Migrations 0→23, 19→23, 21→23, 22→23 | PASS |
| Mensageria PostgreSQL | PASS — sandbox, concorrência, handoff |
| Impressão PostgreSQL | PASS — concorrência, replay, tenant, lease, duplicação |
| Garçom PostgreSQL | PASS — tenant, ownership, preço, produção, concorrência, impressão |
| Segurança PostgreSQL | PASS em banco nomeado `accdel_security_test` |
| Simulação operacional | PASS — 40 pedidos com falhas transitórias |
| Carga sintética | PASS — 500 jobs sem perda |
| Backup/restore lógico | PASS — 62 tabelas, 1.006 registros, 23 migrations |
| Fluxo integrado salão + delivery | PASS |

O primeiro disparo do teste de segurança foi recusado pelo guard de nome do banco, como projetado; o mesmo teste passou ao usar banco isolado aceito. Isso é uma falha segura do harness, não uma falha do controle.

## Fluxo de salão integrado

- mesa 02 aberta e encerrada;
- produto simples e com adicional precificados no backend;
- produto indisponível rejeitado e acesso do outro garçom negado;
- replay idempotente sem item duplicado;
- dois dispositivos: 1 sucesso e 1 conflito 409;
- dois lotes de produção: inicial e adição;
- kitchen ready repetido sem duplicar expedição;
- todos os itens entregues, fechamento solicitado;
- pagamento concorrente registrou uma única transição lógica;
- fechamento concorrente teve um vencedor;
- para cada ordem, exatamente uma via `CASHIER_RECEIPT`, `CUSTOMER_RECEIPT`, `DISPATCH_ORDER` e `ORDER_INITIAL`/`ORDER_ADDITION`, todas `PRINTED` em dry-run.

## Delivery integrado

- pedido público fictício confirmado, preparado, pago e atribuído;
- somente o motoboy atribuído iniciou/concluiu; o segundo foi rejeitado;
- tracking usou token opaco de 40–80 caracteres e expôs apenas `etaMinutes`, `location`, `message`, `orderNumber`, `status`, `updatedAt`;
- coordenadas públicas limitadas a três casas e token revogado ao concluir;
- pedido terminou `completed`;
- quatro vias esperadas foram impressas exatamente uma vez em dry-run;
- nenhuma chamada Meta/NVIDIA foi realizada.

## Falhas e recuperação

Foram exercitados: reinício da API e reconexão do Print Agent; autenticação inválida; banco com autenticação indisponível (API falha antes de iniciar); PWA offline e reconciliação; SSE desconectado/reconectado; agente offline; impressora recusando; lease expirado; resultado desconhecido; conflito de versão; pagamento repetido; token expirado/revogado; usuário/tenant não autorizado; fila acumulada e migration incompleta detectada por prontidão.

O primeiro restore com dados de fluxo descobriu que um valor JSON textual aninhado não era serializado de acordo com o tipo da coluna. A transação abortou e o banco temporário foi removido; a origem permaneceu intacta. O restore passou depois de consultar os tipos `json/jsonb`, serializar cada valor corretamente e validar contagens tabela a tabela.

O disco cheio não foi provocado no host para evitar dano; o agente cobre erro de persistência e exige espaço mínimo no checklist. Duas APIs não foram mantidas simultaneamente no teste final: locks/filas estão no PostgreSQL, mas rate limit e parte das métricas continuam locais por processo.

## Limitações da estação

Docker e ferramentas nativas PostgreSQL não estavam instalados. Portanto ficaram pendentes: subida real do Compose, build dentro dos Dockerfiles e teste nativo `pg_dump`/`pg_restore`. Impressora física, celulares, Wi-Fi, Meta e NVIDIA não foram acessados.

Os comandos finais e seus resultados consolidados ficam em [RELEASE_CANDIDATE_REPORT.md](./RELEASE_CANDIDATE_REPORT.md).
