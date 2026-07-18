# Plano de testes do caixa v2

## Unitarios

`cash-domain.test.ts` cobre formula, meios nao fisicos, sinais, abertura zero/negativa, valor/motivo, motivo de reembolso, diferenca e centavos. `authorization-hardening.test.ts` confirma bloqueio sem `cash:manage`.

## PostgreSQL

`cash-register.integration.test.ts` exige `RUN_DB_INTEGRATION=1`, loopback, banco `accdel_*test` e rejeita a porta `55433`.

Cobertura automatizada:

1. abertura valida; 2. zero; 3. negativo; 4. duplicada; 5. concorrente; 6. terminal de outra loja; 7. RBAC; 8. adicao; 9. retry; 10. retirada; 11. motivo; 12. saldo insuficiente; 13. concorrencia; 14. limite sem aprovacao; 15. aprovacao; 16. venda cash; 17. Pix; 18. cartao; 19. reembolso; 20. duplicidade; 21. ajuste; 22. saldo esperado; 23. fechamento exato; 24. diferenca positiva; 25. negativa; 26. justificativa; 27. fechamento duplicado; 28. movimento tardio; 29. refresh; 30. tenant; 31. auditoria; 32. idempotencia; 33. concorrencia; 34. erro sanitizado; 35. precisao.

Tambem valida triggers de imutabilidade, constraints e filtros.

## Migrations

- banco vazio: 25 migrations
- incremental: 23 anteriores + 2 do caixa
- `prisma validate` e `prisma generate`

Dados ficticios: Restaurante Laboratorio, Caixa principal e Sara Vale. A revisao visual desktop/tablet/mobile permanece gate humano do Draft PR.
