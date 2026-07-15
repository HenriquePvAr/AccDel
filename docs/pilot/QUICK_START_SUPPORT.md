# Início rápido — suporte

## Antes do turno

1. Registre commit/artefato, flags, responsáveis e janela.
2. Confirme backup, espaço, portas, processos e `/operations/readiness`.
3. Verifique 23/23 migrations, zero falhas, agente online e providers externos desativados.
4. Execute smoke test fictício e confirme cupom dry-run/físico autorizado.

## Incidente

Colete hora, usuário/papel, loja, pedido/mesa técnico, correlation ID, tela e ação — nunca senha/token/PII. Classifique agregado (pedido/pagamento) antes de infraestrutura (SSE/agente). Consulte logs por correlação e prontidão; não peça ao operador para repetir mutação.

Se houver perda, duplicação, preço/pagamento divergente, tenant indevido ou migration inesperada: pare o piloto e volte ao manual. Para provider/agente isolado: desative a flag/revogue o token e mantenha o núcleo. Resultado de impressão desconhecido requer inspeção física.

## Comandos locais

```powershell
npm.cmd run staging:status
npm.cmd run staging:logs
npm.cmd run staging:backup
npm.cmd run staging:down
```

`staging:down` preserva volume. Nunca usar `down -v`, `prisma migrate reset` ou restaurar sobre o banco original. Siga [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md) e [BACKUP_AND_RESTORE.md](./BACKUP_AND_RESTORE.md).
