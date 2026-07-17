# Autorização de motoboys

## Risco original

A role `driver` recebia `drivers:view`, a mesma permissão usada por listagens, rotas, filas e localizações administrativas. Isso permitia enumerar dados de outros motoboys e chamar `POST /drivers/:id/location` com um `driverId` arbitrário.

## Cenário de exploração

Um token válido do motoboy A chamava uma rota administrativa com o ID do motoboy B. Como a autorização dependia apenas de `drivers:view`, o backend aceitava a leitura ou escrita mesmo que a interface escondesse o controle.

## Solução aplicada

- `driver` recebe somente `drivers:self`.
- Rotas `/drivers/me/*` extraem o ID de `authUser.sub`; não existe `driverId` no path ou body para a identidade principal.
- Rotas administrativas continuam em `drivers:view` ou `settings:delivery:manage`.
- `POST /drivers/:id/location` agora exige `settings:delivery:manage`.
- Consultas e mutações incluem `storeId` do contexto autenticado.
- Localização só é aceita para perfil ativo com assignment ativo da mesma loja e pedido em `out_for_delivery`.
- Conclusão usa assignment ativo filtrado por `storeId` e `driverId`; a máquina de estados confirma novamente que o ator é o motoboy atribuído.

## Endpoints protegidos

| Endpoint | Regra |
|---|---|
| `GET /drivers/me/app-state` | `drivers:self`; identidade do token |
| `GET /drivers/me/tracking-policy` | `drivers:self`; identidade do token |
| `GET /drivers/me/location` | `drivers:self`; identidade do token |
| `GET /drivers/me/route` | `drivers:self`; identidade do token |
| `POST /drivers/me/location` | `drivers:self`; rate limit; idempotência; assignment ativo |
| `PATCH /drivers/me/status` | `drivers:self`; rate limit; idempotência |
| `POST /drivers/me/delivery/start` | `drivers:self`; rate limit; idempotência; entrega atribuída |
| `POST /drivers/me/delivery/complete` | `drivers:self`; rate limit; idempotência; entrega atribuída |
| `GET /drivers`, `GET /drivers/:id`, rotas e filas | `drivers:view`; indisponível para role `driver` |
| `POST /drivers/:id/location`, simulação e fila | `settings:delivery:manage` |

## Testes adicionados

- motoboy sem permissão administrativa;
- motoboy A tentando concluir entrega do B;
- consulta de ID da loja B sob contexto da loja A;
- token inválido e expirado;
- pedido concluído recebendo transição indevida;
- teste de integração em PostgreSQL para isolamento entre lojas.

## Limitações e riscos restantes

- O JWT ainda carrega role/permissões até expirar; a membership é revalidada nas operações self de driver, mas não globalmente em todos os módulos.
- O tracking público por UUID continua fora deste hardening e deve receber token opaco e expirável.
- Rate limiting é local a cada instância da API; produção com réplicas precisa de backend compartilhado.

## Arquivos principais

- `apps/api/src/modules/auth/auth.permissions.ts`
- `apps/api/src/modules/drivers/drivers.controller.ts`
- `apps/api/src/modules/drivers/drivers.service.ts`
- `apps/api/src/modules/orders/order-state-machine.ts`
- testes em `apps/api/src/modules/auth`, `drivers` e `orders`
