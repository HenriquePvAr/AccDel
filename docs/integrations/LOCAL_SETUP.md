# Setup local da integração

1. Copie `apps/api/.env.example` para `apps/api/.env` sem versionar o arquivo.
2. Configure banco e `JWT_ACCESS_SECRET` local com pelo menos 32 caracteres.
3. Para trabalhar sem serviços externos, deixe `WHATSAPP_PROVIDER` e `AI_PROVIDER` vazios.
4. Para Cloud, preencha todas as variáveis Meta e selecione `WHATSAPP_PROVIDER=cloud`.
5. Para NVIDIA, preencha chave/modelo e selecione `AI_PROVIDER=nvidia`.
6. Mantenha sandbox ativo até finalizar o canário controlado.
7. Aplique migrations e gere o client.

```powershell
npm.cmd install
npm.cmd run api:prisma:generate
npm.cmd run api:prisma:deploy
npm.cmd run api:seed
```

## Pré-validação segura

```powershell
npm.cmd --prefix apps/api run integrations:prevalidate
```

O comando não chama rede e imprime somente `configurado`, `ausente` ou `inválido`. Ele valida provider, campos obrigatórios, URLs, timeout, limites, modelo, sandbox e conflito Cloud/Evolution.

Para receber webhooks locais, exponha a API por um tunnel HTTPS confiável e configure a URL exata `/webhooks/whatsapp` no Meta Business. Não coloque token na query do POST; a autenticação do payload é `X-Hub-Signature-256`.

## Checks

```powershell
npm.cmd run api:test
npm.cmd run api:test:integration
npm.cmd run api:build
npm.cmd run api:lint
npm.cmd test
npm.cmd run build
npm.cmd run lint
npm.cmd run driver:typecheck
npm.cmd run driver:lint
```

`integrations:test:nvidia` só chama o serviço quando a configuração está completa. Não use credenciais reais em fixture, screenshot, log ou commit. Testes automatizados usam HMAC e payloads fictícios e não chamam Meta/NVIDIA.
