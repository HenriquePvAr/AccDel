# Rollout controlado para staging

## Gates obrigatórios

- build, lint, testes e migrations verdes;
- app Meta de desenvolvimento e número de teste;
- credenciais em secret store, nunca no repositório;
- `MESSAGING_SANDBOX_MODE=true` explícito;
- allowlist com um único destinatário controlado no primeiro canário;
- Evolution desabilitada quando Cloud estiver selecionada;
- NVIDIA com limite interno de até 35 RPM e concorrência pequena;
- templates utility `pt_BR` aprovados ou testes fora da janela desabilitados;
- dashboard/alerta para outbox `FAILED`, locks antigos, 429, breaker e webhook inválido;
- pessoa responsável e janela de rollback definidas.

## Ordem do rollout

1. Aplique migrations aditivas com workers e providers desligados.
2. Inicie API e workers com Cloud/NVIDIA ainda desabilitados e valide health/readiness.
3. Ative Cloud com sandbox e um destinatário.
4. Valide challenge e um único inbound, sem IA.
5. Valide uma resposta manual pela outbox.
6. Ative NVIDIA para uma conversa de teste e execute saudação/busca sem confirmação.
7. Execute um único rascunho com confirmação explícita.
8. Valide notificações e tracking com pedido fictício.
9. Observe métricas e logs antes de ampliar a allowlist.

## Critérios de parada

- duplicação de inbound, outbound, pedido ou tool mutável;
- status regressivo;
- envio a número fora da allowlist;
- PII/token em log;
- outbox acumulando `SENDING` ou `FAILED` sem explicação;
- breaker NVIDIA oscilando ou 429 persistente;
- IA respondendo após handoff;
- template ou parâmetros rejeitados pela Meta.

## Rollback

1. Desative IA nas configurações da loja.
2. Remova `AI_PROVIDER` e reinicie os processos.
3. Remova `WHATSAPP_PROVIDER` ou desabilite a conta de mensageria.
4. Preserve outbox e inbound para auditoria; não apague registros durante incidente.
5. Mantenha sandbox ativo.
6. Reverta somente código de aplicação. As migrations são aditivas e não precisam ser removidas no rollback operacional.

Antes de produção, ensaie rollback, retenção, monitoramento por pelo menos uma janela operacional e resposta a envio externo ambíguo.
