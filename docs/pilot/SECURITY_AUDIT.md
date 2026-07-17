# Auditoria de segurança do piloto

## Controles confirmados

- JWT forte obrigatório fora de development/test; configuração ausente falha antes de servir tráfego.
- RBAC por endpoint e permissão mínima, inclusive `dashboard:view`, `drivers:self`, `drivers:view` e `dining:sessions:close`.
- Contexto de loja aplicado no backend; testes PostgreSQL rejeitam leitura/alteração cruzada entre lojas.
- Estados de pedido e pagamento validados no servidor, com optimistic concurrency e idempotency keys.
- Catálogo, disponibilidade, adicionais e preço recalculados no backend.
- Webhook autenticado, deduplicado e sem segredo em URL.
- Tracking público por token aleatório opaco, com TTL, revogação e coordenadas arredondadas a três casas.
- Print Agent usa credencial própria, claims com lease e resultado idempotente; dry-run obrigatório no staging local.
- CORS usa lista exata e os serviços do Compose escutam apenas em `127.0.0.1`.
- `/health` é público e mínimo; `/ready` exige autenticação e `dashboard:view`.
- Logs gerais mascaram PII e não incluem senha, bearer token, segredo, payload de pagamento, mensagem integral ou coordenada precisa.

## Verificações negativas

Os testes cobriram token inválido, usuário sem permissão, garçom não proprietário, motoboy não atribuído, replay de idempotência, concorrência de pagamento, webhook inválido, tenant cruzado, tracking expirado/revogado e segredo de configuração inseguro.

A varredura do conjunto preparado para commit procura chaves privadas, tokens comuns, segredos atribuídos, URLs com credenciais, e-mails/telefones reais e caminhos absolutos do computador. Nenhum segredo real é esperado nos arquivos rastreados. `.env.staging`, `.pilot`, backups e saídas de impressão não podem ser versionados.

## Limitações/riscos

- O rate limit e parte das métricas são locais por processo. Dois processos não devem ser tratados como um limite global sem Redis ou mecanismo compartilhado.
- SSE é recuperável por reconexão, mas não oferece replay durável de todos os eventos de interface.
- O backup lógico JSON é um mecanismo de laboratório, não substitui `pg_dump` criptografado para operação real.
- Dispositivos, rede, Windows e impressora física ainda não foram endurecidos/validados.
- Meta e NVIDIA permanecem desativadas; suas credenciais e controles reais não foram auditados.

Não há autorização de produção decorrente desta auditoria.
