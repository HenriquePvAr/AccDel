# Runbook do staging local

## Limites

Esta stack é privada e reproduzível para laboratório. Ela não publica portas em interfaces externas, não usa credenciais reais e mantém WhatsApp/NVIDIA desativados. O Driver App é validado separadamente com Expo porque não é um serviço web persistente do Compose.

## Pré-requisitos

- Windows com Docker Desktop/Compose e Node.js disponível;
- portas locais 55432, 3333, 4173 e 4174 livres;
- branch `release/pilot-rc1` e árvore limpa;
- no mínimo 5 GB livres para imagens, volume e logs.

## Inicialização

```powershell
cd 'C:\caminho\para\AccDel'
npm.cmd run staging:up
npm.cmd run staging:seed
npm.cmd run staging:status
```

Na primeira execução, `.env.staging` é copiado do exemplo e segredos aleatórios são gravados em `.pilot/runtime.env` com modo `0600` quando suportado. A senha comum dos usuários fictícios e os identificadores do seed são gravados em `.pilot/seed-credentials.txt`. Esses arquivos são ignorados pelo Git; proteja-os também por ACL do Windows.

O seed exige `APP_ENV=staging`, `ALLOW_PILOT_SEED=true`, nome de banco contendo `pilot`, `staging`, `test` ou `demo`, marca a loja com `PILOT_DEMO_DATA` e pode ser repetido sem duplicar entidades.

## Serviços

| Serviço | URL/porta local | Observação |
| --- | --- | --- |
| PostgreSQL 16.4 | `127.0.0.1:55432` | volume nomeado preservado |
| API | `http://127.0.0.1:3333` | healthcheck público mínimo |
| Admin | `http://127.0.0.1:4173` | build com data source API |
| Waiter PWA | `http://127.0.0.1:4174` | loja piloto explícita |
| Print Agent | interno | `CAIN_PRINT_DRY_RUN=true` |

O seed inclui uma loja, gerente, caixa, cozinha, dois garçons, dois motoboys, quatro setores, 15 mesas, categorias, cerca de 30 produtos, produto com adicionais, produto indisponível, quatro estações/impressoras virtuais, regras de roteamento, pagamento e configurações. Todos os nomes, contatos e endereços são fictícios.

## Operação

```powershell
npm.cmd run staging:status
npm.cmd run staging:logs
npm.cmd run staging:backup
npm.cmd run staging:down
```

`staging:logs` limita a leitura às 200 linhas recentes. Não cole logs sem sanitização. `staging:down` usa `--remove-orphans`, nunca `-v`; o volume do PostgreSQL é preservado.

## Configuração segura

O arquivo rastreado `.env.staging.example` separa staging de development/test/production. Defaults:

```text
APP_ENV=staging
NODE_ENV=production
WHATSAPP_PROVIDER=disabled
AI_PROVIDER=disabled
MESSAGING_SANDBOX_MODE=true
FEATURE_WHATSAPP_ENABLED=false
FEATURE_AI_ATTENDANT_ENABLED=false
FEATURE_PRINTING_ENABLED=true
FEATURE_WAITER_PWA_ENABLED=true
FEATURE_PUBLIC_TRACKING_ENABLED=true
FEATURE_ORDER_NOTIFICATIONS_ENABLED=false
CAIN_PRINT_DRY_RUN=true
```

Flags são lidas na API; alterar localStorage ou JavaScript do frontend não habilita uma integração. A configuração rejeita provider habilitado sem segredo/identificador obrigatório, CORS vazio/curinga em staging/produção, JWT fraco, sandbox inválido e conflito entre provider e flag.

## Diagnóstico

1. `GET /health` deve retornar apenas estado geral, versão e timestamp.
2. Entrar como gerente e abrir `/operations/readiness`; todas as migrations devem estar aplicadas e filas críticas zeradas.
3. Se o Print Agent estiver offline, manter impressão manual/dry-run e seguir o runbook de rollback.
4. Se o banco falhar, não repetir mutações: pare os serviços, confirme backup e recupere a conexão.
5. Nunca editar `.env.staging.example` com valores reais.

## Estado da validação local

Os manifests e a sintaxe YAML foram analisados. Nesta estação o executável Docker não estava instalado/disponível; por isso a subida real do Compose e os Dockerfiles ainda precisam ser validados em um host com Docker. A mesma topologia foi exercitada com PostgreSQL embutido, API, builds web e Print Agent dry-run locais.
