# Testes do Cain Garçom

## Cobertura automatizada

- API: build, lint, testes unitários e suíte de integração PostgreSQL existente.
- PWA: 14 testes Vitest para catálogo, rascunhos, status e cargas sintéticas.
- E2E: 7 fluxos operacionais e 12 cenários visuais no Chrome.
- Monorepo: build, lint e testes do admin, API, driver e agente de impressão.
- Prisma: validação, geração e migrations em banco vazio e incremental.

## Cenários E2E

| ID | Cenário |
|---|---|
| A | abrir mesa, adicionar produto simples e enviar |
| B | selecionar modificadores obrigatórios, observação e enviar |
| C | produto fica indisponível no envio e nenhum sucesso é mostrado |
| D | adição posterior envia somente os itens novos |
| E | conflito de versão atualiza dados e preserva rascunho |
| F | offline bloqueia mutações e reconexão refaz leituras |
| G | solicitar fechamento sem criar pagamento |

## Visual e carga local

Foram exercitados 360×800, 390×844, 768×1024, 1024×768 e 1366×768. As imagens sanitizadas ficam em `docs/waiter/screenshots`.

A suíte sintética cobre 100 mesas, 500 produtos, 20 categorias, 50 usuários, 100 atualizações e comando com 100 itens. Isso encontra regressões locais de renderização e transformação, mas não substitui teste de carga distribuído ou medição em Wi-Fi de restaurante.

## Teste real recomendado

Executar um turno supervisionado com API de staging, dois dispositivos na mesma mesa, KDS e Cain Print Agent ligados. Confirmar conflitos, queda/reconexão de rede, latência, impressão física, troca de usuário e fechamento no caixa. Não usar dados ou impressoras de produção no primeiro ciclo.
