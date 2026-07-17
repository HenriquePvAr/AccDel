# Relatório do release candidate — Cain Delivery

Data da validação: 15/07/2026

Branch: `release/pilot-rc1`

Base cumulativa: `a01b2508a0387c99de781f410521208795a90f6a` (`main` = `origin/main`)

HEAD inicial: `c4fd2ff` em `feature/waiter-pwa`

HEAD funcional/recuperação validado antes deste relatório: `f7df378`

O commit de documentação posterior não altera runtime. O HEAD final deve ser obtido com `git rev-parse HEAD` no handoff.

## 1–9 — Git, cadeia e auditoria

1. **Branch e HEAD inicial:** `feature/waiter-pwa`, `c4fd2ff`, árvore limpa, sem push/merge.
2. **Base cumulativa:** `a01b250`, ancestral comum com `main`/`origin/main`.
3. **Cadeia:** redesign `d7779ea` → hardening `f04b335` → WhatsApp/IA `60ce9c7` → impressão `317d6c5` → PWA `c4fd2ff` → RC.
4. **Commits auditados:** cadeia linear, sem merge/duplicação/rewrite; 40 exclusivos de `main` antes dos commits finais de recuperação/documentação.
5. **Arquivos cumulativos:** 349 no corte funcional `2cea8fc`, agrupados em API, Admin, Waiter, Driver, Print Agent, Prisma, Docker/scripts e docs.
6. **Migrations:** 23 aditivas e ordenadas; 0→23, 19→23, 21→23 e 22→23 passaram preservando sentinelas.
7. **Conflitos:** nenhum conflito Git. `diff --check` cumulativo aponta só whitespace em docs históricas; o diff do piloto está limpo.
8. **Correções:** tracking opaco, webhook sem segredo em URL, checkout atômico, CORS estrito, flags/observabilidade, seed idempotente, RBAC mínimo do caixa, filtro delivery, impressão de expedição oficial, restore JSON type-aware e teste TCP determinístico.
9. **Branch RC:** criada de `c4fd2ff`; sem rebase, squash, reset, push ou merge.

## 10–17 — Preparação operacional

10. **Staging:** Compose privado com PostgreSQL, API, Admin, Waiter e Print Agent dry-run; Driver Expo separado. Docker não estava disponível para subir a stack nesta estação.
11. **Seed:** `PILOT_DEMO_DATA`, idempotente, guardado por ambiente/nome, credenciais aleatórias em `.pilot`; loja/equipe/15 mesas/catálogo/estações/rotas fictícios.
12. **Feature flags:** autoridade server-side e defaults fail-closed; WhatsApp/IA/notificações desligados, PWA/tracking ligados, impressão somente dry-run.
13. **Observabilidade:** logs estruturados, correlation IDs, duração/erros/filas e minimização de PII.
14. **Health checks:** `/health` público mínimo; `/ready` e tela de prontidão restritos, com banco/migrations/filas/agentes/realtime/providers/versão.
15. **Backup:** lógico local com marcador, checksum, 23 migrations e guardas; nativo preparado, ainda pendente por ausência de `pg_dump`/Docker.
16. **Restauração:** PASS em banco novo, 62 tabelas, 1.006 registros, valores JSON e contagens por tabela verificados; origem não alterada.
17. **Rollback:** flags/revogação/operação manual primeiro; banco sempre restaurado em destino novo, sem migration `down`/reset.

## 18–26 — Fluxos, concorrência e segurança

18. **Salão:** PASS na mesa 03; 3 itens precificados pelo servidor, 2 lotes, pagamento/fechamento e mesa livre.
19. **Delivery:** PASS até `completed`; somente motoboy atribuído, tracking revogado e nenhuma chamada externa.
20. **Concorrência:** dois dispositivos 1 sucesso/1 conflito; pagamento com uma transição; fechamento com um vencedor; claim de dois agentes sem duplicação.
21. **Falhas simuladas:** restart/reconexão, banco indisponível, offline/SSE, agente/impressora, resultado desconhecido, conflitos, replay, token/revogação, fila e migration pendente. Disco cheio não foi provocado.
22. **Impressão dry-run:** vias inicial/adição/expedição/caixa/cliente exatamente uma vez e `PRINTED`; 500 jobs sem perda/claim duplicado.
23. **PWA:** build, 14 testes, 19 Playwright, offline/rascunho, conflito, adicionais e fechamento.
24. **Tracking:** token opaco, TTL/revogação, seis campos públicos e coordenadas a três casas.
25. **Isolamento:** store context, queries com `storeId`, ownership do garçom e assignment do motoboy validados em PostgreSQL.
26. **Segurança:** JWT/RBAC/state machines/idempotência/webhook/CORS/PII/logs testados; 65 unitários da API e integração de segurança passaram.

## 27–33 — Evidências e estado técnico

27. **Screenshots:** login, central, mesas, comanda, catálogo, cozinha, impressão/agentes, motoboys, tracking, prontidão, erro, offline, conflito e providers/sandbox; todos fictícios.
28. **Testes:** Admin 5/5; API 65/65; Waiter 14/14 + Playwright 19/19; Print Agent 10/10; seis cenários PostgreSQL; simulação 40 pedidos; carga 500 jobs; fluxos e backup PASS.
29. **Builds:** Admin, API, Waiter, Print Agent e export Android do Driver PASS; typechecks Waiter/Print/Driver e Prisma validate PASS. Admin mantém 4 warnings de lint sem erros e alerta de chunks grandes.
30. **Commits do RC:** `a9925a9`, `106034e`, `2cea8fc`, `f7df378` e o commit documental final; todos pequenos e revisáveis.
31. **Estado do Git:** branch local somente; árvore deve terminar limpa após o commit documental. `main`/`origin/main` não foram alterados.
32. **Secrets:** scans dos staged diffs sem correspondência; `.env.staging`, `.pilot`, backups, builds e saídas não são versionados.
33. **Portas/processos:** serviços temporários locais foram usados em 3333/4173/4174 e PostgreSQL 55432/55433; a verificação final confirmou zero listeners nessas portas.

## 34–40 — Gates do piloto

34. **Riscos restantes:** Compose/Docker e backup nativo não executados; hardware/rede reais ausentes; rate limit/métricas parcialmente por processo; SSE sem replay durável; chunks web grandes; 4 warnings de lint Admin.
35. **Hardware necessário:** host Windows endurecido, nobreak/backup, impressora ESC/POS 58/80 mm, celulares/tablets suportados e rede segregada/HTTPS — modelos/dados ainda não fornecidos.
36. **Serviços externos:** Meta Business/app/número/webhook/tokens/templates e NVIDIA key/model/limites ainda pendentes; nenhum teste real realizado.
37. **Plano:** laboratório → restaurante fechado → operação paralela → piloto limitado → expansão; gate e aprovação em cada fase.
38. **Sucesso:** zero pedidos/pagamentos/preços/tenants/impressões indevidas, disponibilidade medida, conflitos recuperados e treinamento/suporte registrados.
39. **Interrupção:** qualquer perda/duplicação/divergência/acesso indevido/corrupção/impressão em loop ou impossibilidade de reconciliação causa retorno imediato ao manual.
40. **Classificação:** ver decisão abaixo.

## Classificação

| Nível | Estado |
| --- | --- |
| IMPLEMENTADO | SIM |
| INTEGRADO LOCALMENTE | SIM |
| VALIDADO COM TESTES | SIM |
| VALIDADO COM DADOS FICTÍCIOS | SIM |
| PRONTO PARA LABORATÓRIO | SIM |
| PRONTO PARA TESTE NO RESTAURANTE FECHADO | CONDICIONAL — Docker, backup nativo e hardware/rede checklist |
| PRONTO PARA OPERAÇÃO PARALELA | NÃO |
| PRONTO PARA PILOTO LIMITADO | NÃO |
| PRONTO PARA PRODUÇÃO | NÃO |

Não ativar produção sem Meta/NVIDIA reais homologadas, impressora/dispositivos/Wi-Fi reais, operação paralela e piloto supervisionado aprovados.

## Adendo de segurança de dependências — 15/07/2026

A branch local `security/dependency-hardening-rc1`, criada sobre este RC em `d9a9b93`, eliminou todas as vulnerabilidades críticas e altas dos cinco installs npm sem alterar majors, código de domínio, Prisma ou migrations. A matriz final é: Admin 0; API 1 baixa de desenvolvimento; Waiter 0; Print Agent 0; Driver 11 moderadas agregadas no toolchain Expo SDK 54.

Admin, API e Driver foram atualizados em commits independentes. Builds, lint, testes, typechecks, Prisma, integrações PostgreSQL, Playwright, export Android offline e fluxos fictícios permanecem aprovados. Os resíduos, alcance e plano de atualização estão em:

- [`../security/DEPENDENCY_AUDIT_RC1.md`](../security/DEPENDENCY_AUDIT_RC1.md)
- [`../security/DEPENDENCY_UPDATE_PLAN.md`](../security/DEPENDENCY_UPDATE_PLAN.md)
- [`../security/DRIVER_APP_DEPENDENCY_RISKS.md`](../security/DRIVER_APP_DEPENDENCY_RISKS.md)

O hardening mantém a classificação **pronto para laboratório**. Não remove os gates de hardware, rede, serviços externos, restaurante fechado ou produção.
