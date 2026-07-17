# Feature flags operacionais

| Domínio | Variável server-side | Default seguro do staging |
| --- | --- | --- |
| WhatsApp | `FEATURE_WHATSAPP_ENABLED` | `false` |
| Atendente IA | `FEATURE_AI_ATTENDANT_ENABLED` | `false` |
| Impressão | `FEATURE_PRINTING_ENABLED` | `true`, somente dry-run |
| PWA do garçom | `FEATURE_WAITER_PWA_ENABLED` | `true` |
| Tracking público | `FEATURE_PUBLIC_TRACKING_ENABLED` | `true` |
| Notificações de pedido | `FEATURE_ORDER_NOTIFICATIONS_ENABLED` | `false` |

`FeatureFlagsService` na API é a fonte de autoridade. Interfaces apenas exibem o estado. Valores ausentes são `false`; strings inválidas são rejeitadas. WhatsApp e IA também exigem provider coerente, credenciais obrigatórias, sandbox/allowlist e configuração da loja. Impressão física exige, adicionalmente, agente/rota e `CAIN_PRINT_DRY_RUN=false` por decisão explícita fora do RC local.

Mudança durante piloto deve registrar operador, horário, valor anterior/novo, motivo, commit e plano de retorno. No staging local as flags são por ambiente; configurações funcionais por loja continuam respeitando `storeId`, mas não podem tornar uma flag global desligada em ligada.
