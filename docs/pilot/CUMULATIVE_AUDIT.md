# Auditoria cumulativa do release candidate

Data: 15/07/2026

Escopo: `a01b2508a0387c99de781f410521208795a90f6a...release/pilot-rc1`

## Estado recuperado

O estado inicial informado e confirmado foi `feature/waiter-pwa` em `c4fd2ff`, com árvore limpa, sem push e sem merge. A branch de release foi criada diretamente desse commit e preserva todo o histórico. `main` e `origin/main` apontam para `a01b2508a0387c99de781f410521208795a90f6a`; não há divergência entre eles. Não havia stash nem worktree adicional.

Após os três commits de preparação, o RC auditado estava em `2cea8fc786a7409f231cc1d8e18eab873fab2c95`. O relatório final deve ser atualizado para o commit de documentação produzido no encerramento.

## Cadeia linear

| Etapa | Base efetiva | Último commit | Commits exclusivos |
| --- | --- | --- | ---: |
| Redesign/auditoria | `main` (`a01b250`) | `d7779ea` | 5 |
| Hardening crítico | `d7779ea` | `f04b335` | 6 |
| WhatsApp/IA | `f04b335` | `60ce9c7` | 7 |
| Impressão | `60ce9c7` | `317d6c5` | 9 |
| PWA do garçom | `317d6c5` | `c4fd2ff` | 9 |
| Piloto RC | `c4fd2ff` | `2cea8fc` antes da documentação | 3 |

Os `merge-base` confirmados foram `f04b335`, `60ce9c7` e `317d6c5`, respectivamente. O grafo é linear, sem merge commits, duplicação de commits, rebase, squash ou reset. O total antes desta documentação era de 40 commits exclusivos de `main`.

## Superfície cumulativa

O diff de `main...2cea8fc` contém 349 arquivos, 34.917 inserções e 1.045 remoções. Os grupos revisados foram:

- `apps/api`: autenticação, RBAC, tenant, pedidos, pagamentos, mensageria, tracking, impressão, mesas, PWA e prontidão;
- `apps/waiter-app`, `apps/driver-app` e `apps/print-agent`;
- painel administrativo em `src`;
- 23 diretórios em `apps/api/prisma/migrations`;
- `docker-compose.staging.yml`, Dockerfiles, exemplos de ambiente e scripts;
- documentação e screenshots sanitizados.

Para reproduzir o inventário exato:

```powershell
git diff a01b2508a0387c99de781f410521208795a90f6a...HEAD --stat
git diff a01b2508a0387c99de781f410521208795a90f6a...HEAD --name-only
git diff a01b2508a0387c99de781f410521208795a90f6a...HEAD --check
```

O `--check` cumulativo encontra somente trailing whitespace e linhas finais extras em documentos históricos de auditoria/redesign. Isso não altera runtime e não foi reescrito por estética. `git diff --check` dos commits do piloto está limpo.

## Resultados da revisão

Não foram encontrados dois state machines válidos para o mesmo agregado, dois consumidores produzindo a mesma notificação lógica, chamadas externas dentro de transações, preço/pagamento confiados ao navegador, service worker persistindo resposta privada ou migration destrutiva.

Problemas concretos encontrados e corrigidos no RC:

1. Tracking legado aceitava consulta por identificador interno; passou a exigir token opaco, com expiração/revogação e payload público mínimo.
2. Segredos de webhook podiam aparecer em query string; agora são aceitos apenas em cabeçalhos/assinaturas.
3. Token de checkout podia ser consumido fora de uma operação atômica; o consumo agora é transacional e idempotente.
4. CORS de staging/produção aceitava correspondência ampla; agora exige origins explícitas.
5. Flags operacionais precisavam de autoridade server-side e defaults fail-closed; foram centralizadas.
6. Seed podia deixar produto configurável fora da categoria por ordem de upsert; os vínculos agora são reaplicados idempotentemente.
7. Caixa não tinha permissão mínima específica para encerrar sessão; foi criada `dining:sessions:close` sem conceder edição de salão.
8. Delivery criado pelo cardápio público era filtrado por `source` em vez de `serviceType`; a consulta do motoboy foi corrigida.
9. Marcar pedido pronto pela cozinha contornava a emissão idempotente da impressão de expedição; a transição passou a delegar ao serviço oficial de pedidos.

## Estado local

Nenhum push, merge em `main`, deploy público, chamada Meta/NVIDIA, impressão física ou acesso a banco real foi realizado. Artefatos temporários ficam em `.pilot`, `backups` e diretórios de build ignorados.
