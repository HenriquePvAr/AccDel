# Preparação da conta de teste Meta

Use somente aplicativo em modo de desenvolvimento, número de teste ou número controlado pela equipe e destinatário autorizado. Nunca use clientes reais nesta etapa.

## Variáveis locais

Configure sem registrar valores em terminal, issue ou commit:

```text
WHATSAPP_PROVIDER=cloud
WHATSAPP_GRAPH_API_VERSION
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID
WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN
WHATSAPP_APP_SECRET
WHATSAPP_WEBHOOK_PUBLIC_URL
WHATSAPP_STORE_ID
MESSAGING_SANDBOX_MODE=true
MESSAGING_ALLOWED_RECIPIENTS
```

`MESSAGING_ALLOWED_RECIPIENTS` deve conter somente os números de teste autorizados, normalizados com código do país. Não versione a lista.

## Configuração no Meta Business

1. Crie ou selecione um app de desenvolvimento com WhatsApp.
2. Registre o número de teste e autorize explicitamente o destinatário.
3. Configure `https://HOST/webhooks/whatsapp` e o mesmo verify token local.
4. Assine o campo `messages` da conta correta.
5. Confirme que WABA e phone number ID são os mesmos da conta persistida para a loja de teste.
6. Mantenha App Secret e access token somente no secret store do ambiente.

## Antes da primeira chamada

```powershell
npm.cmd --prefix apps/api run integrations:prevalidate
```

O comando imprime apenas `configurado`, `ausente` ou `inválido`. Só prossiga se Cloud e sandbox estiverem válidos e Evolution estiver desabilitada.

## Sequência controlada

1. Valide o challenge com verify token correto e depois com token incorreto.
2. Envie uma mensagem fictícia do destinatário permitido para o número de teste.
3. Confira recibo inbound, conta, conversa, correlation ID e uma única mensagem persistida.
4. Enfileire uma única resposta neutra e confirme ID externo mascarado.
5. Observe `sent`, `delivered` e `read`, se a Meta os fornecer.
6. Reenvie o mesmo payload em ambiente controlado e confirme deduplicação.
7. Tente destinatário não permitido e confirme bloqueio antes da chamada externa.

Não espere 24 horas. Valide fora da janela com relógio simulado. Envie template real somente se estiver aprovado para `pt_BR` e para o destinatário de teste.

## Evidência permitida

Registre horário, latência, contadores, códigos sanitizados e IDs mascarados. Não registre telefone completo, access token, App Secret, verify token, header Authorization ou payload com PII.

Estado em 14/07/2026: **NÃO EXECUTADO — credenciais locais ausentes**.
