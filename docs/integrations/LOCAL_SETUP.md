# Setup local da integracao

1. Copie `apps/api/.env.example` para `apps/api/.env` sem versionar o arquivo.
2. Configure banco e um `JWT_ACCESS_SECRET` real com pelo menos 32 caracteres.
3. Para trabalhar sem providers externos, deixe `WHATSAPP_PROVIDER` e `AI_PROVIDER` vazios.
4. Para Cloud, preencha todas as variaveis Meta e selecione `WHATSAPP_PROVIDER=cloud`.
5. Para NVIDIA, preencha chave/modelo e selecione `AI_PROVIDER=nvidia`.
6. Aplique migrações e gere o client.

```powershell
npm.cmd install
npm.cmd run api:prisma:generate
npm.cmd run api:prisma:deploy
npm.cmd run api:dev
```

Para receber webhooks locais, exponha a API por um tunnel HTTPS confiavel e configure a URL exata `/webhooks/whatsapp` no Meta Business. Nao coloque token na query do POST; a autenticacao do payload e `X-Hub-Signature-256`.

Checks:

```powershell
npm.cmd run api:test
npm.cmd run api:build
npm.cmd test
npm.cmd run build
```

Nao use credenciais reais em teste automatizado, fixture, screenshot, log ou commit. Os testes usam HMAC e payloads ficticios e nao chamam Meta/NVIDIA.
