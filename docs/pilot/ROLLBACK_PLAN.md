# Plano de rollback operacional

## Princípios

Rollback prioriza flags, isolamento e operação manual. Não apagar migration aplicada, não sobrescrever banco e não repetir requisições de negócio às cegas. Registrar hora, versão, correlação, impacto e responsável.

| Componente | Ação imediata | Retorno controlado |
| --- | --- | --- |
| API | bloquear novos pedidos no perímetro; preservar saúde/logs | voltar artefato compatível com o schema; smoke test |
| Admin | retirar URL dos operadores; usar procedimento manual | servir build anterior com a mesma API |
| Waiter PWA | `FEATURE_WAITER_PWA_ENABLED=false`; orientar comanda manual | publicar build aprovado e limpar somente cache do app, não dados sem triagem |
| Driver App | retirar dispositivos do turno; expedição por telefone/manual | reinstalar build aprovado e autenticar novamente |
| WhatsApp | `FEATURE_WHATSAPP_ENABLED=false`, `FEATURE_ORDER_NOTIFICATIONS_ENABLED=false`, provider `disabled` | reativar primeiro em sandbox/allowlist |
| NVIDIA/IA | `FEATURE_AI_ATTENDANT_ENABLED=false`, provider `disabled`; handoff humano | teste de prompt/ferramentas em sandbox |
| Printing | `FEATURE_PRINTING_ENABLED=false`; impressão manual | validar rota e uma via de teste antes da automática |
| Print Agent | revogar/rotacionar token e parar serviço | novo token, dry-run, heartbeat e claim controlado |
| Banco | parar escrita; restaurar backup em banco novo | validar 23 migrations e dados; trocar conexão |

## Gatilhos

Rollback imediato: pedido perdido/duplicado, preço divergente, acesso entre lojas, pagamento duplicado, corrupção de dados, segredo exposto, impressão em loop ou sistema incapaz de identificar estado do pedido.

Rollback parcial: provider externo, agente de impressão ou dispositivo específico falha sem comprometer o agregado. Desative só o componente e mantenha operação manual.

## Sequência de incidente

1. declarar incidente e congelar mudanças;
2. reduzir escopo/ativar operação manual;
3. capturar `/ready`, logs por correlation ID e versão;
4. desativar a flag ou revogar credencial afetada;
5. decidir rollback de artefato ou restore em banco novo;
6. executar smoke test com dados fictícios;
7. liberar gradualmente e registrar causa/ação.

Nenhum comando deste documento autoriza produção automaticamente.
