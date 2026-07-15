# Relatório de validação real das integrações

Data da revisão: 14/07/2026

Branch: `feature/whatsapp-cloud-ai-attendant`

Base: `f04b335` (`security/critical-operational-hardening`)

## Resultado executivo

Os 72 arquivos da implementação foram revisados. O fluxo está implementado, coberto por mocks e validado localmente com PostgreSQL real e duas instâncias concorrentes do worker. A pré-validação local não encontrou credenciais Meta ou NVIDIA; por isso nenhuma chamada externa e nenhum E2E real foram executados.

O estado atual não é pronto para produção. Staging depende de conta de teste, destinatário permitido, templates aprovados, sandbox explícito, observabilidade e rollback ensaiado.

## Matriz de evidências

| Componente | Mock | Integração local | Serviço real | Resultado |
| --- | ---: | ---: | ---: | --- |
| Webhook Meta | Sim | Sim | Não | HMAC sobre raw body, limites, parsing e deduplicação validados; credencial ausente |
| Envio Meta | Sim | Sim | Não | Outbox, sandbox, retries e ordenação validados; credencial ausente |
| Status Meta | Sim | Sim | Não | `sent/delivered/read/failed`, chegada antecipada e ordem inversa cobertos |
| NVIDIA | Sim | Sim | Não | Timeout, 429, backoff, concorrência e breaker cobertos; credencial ausente |
| Tool calling | Sim | Sim | Não | Allowlist, Zod, tenant derivado, confirmação e mutação repetida cobertos |
| Pedido | Sim | Sim | Não | Rascunho, reprecificação, confirmação e idempotência validados localmente |
| Tracking | Sim | Sim | Não | Token aleatório/hash, TTL, revogação e resposta sem PII validados |
| Handoff | Sim | Sim | Não | Supressão da IA, disputa entre humanos e cancelamento de resposta pendente validados |

## Problemas concretos corrigidos

- claim da outbox sujeito a corrida e quebra de ordem entre instâncias;
- comparação de relógio SQL incompatível com coluna UTC em timezone local;
- status concorrente capaz de regredir e status recebido antes do ID externo descartado;
- recibo inbound e persistência de conversa/mensagem fora da mesma transação;
- associação de cliente pelos últimos oito dígitos, com risco entre clientes;
- ausência de sandbox central para mensagens manuais e automáticas;
- handoff concorrente permitindo dois atendentes e resposta de IA já enfileirada;
- ferramenta mutável repetida na mesma execução sem deduplicação;
- RPM NVIDIA contado por chamada lógica, não por tentativa HTTP;
- tenant/conta/conversa/pedido insuficientemente revalidados na outbox;
- chave de idempotência reutilizada com conteúdo divergente;
- link de tracking baseado em origem do frontend, onde a rota não existe;
- instrução da interface citando apenas Evolution/QR quando Cloud API é a opção principal;
- índices ausentes para claims frequentes dos workers.

## Evidências locais

- migrations: 21/21 aplicadas em banco vazio;
- incremental: migrations 20 e 21 aplicadas sobre as 19 anteriores;
- API: build e lint passaram; 50/50 testes unitários e 2/2 testes de integração passaram;
- admin web: build e 5/5 testes passaram; lint sem erros e com quatro warnings preexistentes no módulo de entregadores;
- driver: lint e typecheck passaram;
- Prisma: schema válido e bancos vazio/incremental com status atualizado;
- worker: duas instâncias, uma mensagem por vez e ordem preservada por conversa;
- sandbox: destinatário fora da allowlist termina sem chamada ao provider;
- status: `READ` não regride para `DELIVERED`;
- handoff: somente um usuário assume; mensagens de IA pendentes são canceladas;
- tenant: conta, conversa, pedido e cliente de outra loja são rejeitados;
- tracking: resposta não contém nome, telefone, IDs internos, motorista ou rota completa;
- interface: estado vazio, provider ausente e erro seguro do simulador foram exercitados no navegador, sem erro de console.
- Git: `git diff --check` passou, `.env` não é rastreado e a varredura de alta confiança encontrou zero credencial.

Screenshots usam somente banco seed/local e mensagem fictícia:

- [WhatsApp sem provider](./evidence/ui-whatsapp-unconfigured.png)
- [IA sem provider](./evidence/ui-ai-provider-unavailable.png)

## Janela de atendimento

O relógio usa a última mensagem recebida do cliente. A regra testada é:

- `23h59m59s`: dentro;
- `24h00m00s`: fora, por limite exclusivo;
- `24h00m01s`: fora.

Dentro da janela, a notificação é texto determinístico. Fora dela, somente template configurado; template ausente falha fechado e não entra em retry inválido contra a Meta.

## Requisições NVIDIA por evento inbound

Valores são chamadas lógicas esperadas. Cada chamada lógica admite no máximo três tentativas HTTP; o evento possui teto de seis chamadas lógicas.

| Fluxo | Chamadas lógicas usuais | Máximo HTTP usual | Observação |
| --- | ---: | ---: | --- |
| Saudação | 1 | 3 | Resposta direta |
| Pesquisa de produto | 2 | 6 | Tool e resposta final |
| Adição de item | 2 | 6 | Mutação e resposta final |
| Resumo | 2 | 6 | Consulta e resposta final |
| Confirmação | 2 | 6 | Confirmação backend e resposta |
| Consulta de status | 2 | 6 | Consulta e resposta final |
| Handoff | até 2 | 6 | Resposta final é suprimida após mudança de estado |

Teto defensivo: seis chamadas lógicas e até dezoito tentativas HTTP por mensagem inbound. Notificações automáticas de status do pedido fazem zero chamada NVIDIA.

## Mensagens Meta por fluxo

- atendimento normal: um webhook inbound e, quando permitido, uma mensagem outbound;
- cada transição notificável do pedido: no máximo uma mensagem outbound pela chave idempotente da notificação;
- handoff: nenhuma resposta adicional da IA após `WAITING_HUMAN`; mensagem manual usa a mesma outbox;
- cenário E2E completo: quantidade depende das interações do usuário; não foi medida sem serviço real.

## Testes externos

- NVIDIA real: **NÃO EXECUTADO — credencial local ausente**.
- Meta real: **NÃO EXECUTADO — credenciais locais ausentes**.
- Template real: **NÃO EXECUTADO — template ainda não aprovado/verificado**.
- E2E Meta + NVIDIA: **NÃO EXECUTADO — credenciais locais ausentes**.

## Riscos restantes

- Se a Meta aceitar uma mensagem e o processo morrer antes de persistir o ID externo, um retry pode duplicar o envio; a API `/messages` não recebe a chave idempotente interna.
- Um envio que já entrou na chamada externa não pode ser recolhido quando o humano assume; a proteção cancela o que ainda está pendente ou recém-claimed.
- Locks em banco suportam múltiplas instâncias, mas timers, métricas e rate limit NVIDIA ainda são locais por processo.
- Não há evidência de templates aprovados, credenciais, número de teste, status real ou operação monitorada.
- Tracking público é um endpoint JSON seguro, não uma página pública de marca.

## Classificação

| Critério | Estado |
| --- | --- |
| IMPLEMENTADO | Sim |
| VALIDADO COM MOCKS | Sim |
| VALIDADO LOCALMENTE | Sim |
| VALIDADO COM NVIDIA REAL | Não |
| VALIDADO COM META REAL | Não |
| VALIDADO END-TO-END | Não |
| PRONTO PARA STAGING | Não; depende dos gates de conta de teste, sandbox e templates |
| PRONTO PARA PRODUÇÃO | Não |
