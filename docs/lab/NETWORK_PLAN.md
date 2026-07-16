# Plano de rede do laboratorio

## Perfil detectado

O computador esta em Ethernet privada a 1 Gbps. O endereco observado foi registrado apenas como `192.168.***.54`. Antes de uma sessao fisica, o responsavel deve confirmar novamente o IPv4 completo localmente; ele nao deve ser publicado em issue, PR ou relatorio externo.

## Portas planejadas

| Componente | Bind inicial | Porta | Acesso planejado |
|---|---|---:|---|
| API | implementacao atual escuta interfaces locais | 3333 | loopback no smoke; LAN somente com autorizacao de firewall |
| Admin | 127.0.0.1 | 4173 | somente computador |
| Waiter PWA | 127.0.0.1 ou 0.0.0.0 autorizado | 4174 | computador; depois celulares na LAN |
| PostgreSQL | 127.0.0.1 | 55439 | somente computador |
| Print Agent | sem listener | - | cliente local da API, dry-run |

A porta residual proibida permanece fora do plano e nao e consultada pelos scripts.

## Smoke local

Use o perfil padrao, sem regra de firewall:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\start-lab.ps1
```

URLs locais: Admin `http://127.0.0.1:4173`, Waiter `http://127.0.0.1:4174` e API `http://127.0.0.1:3333`.

## Acesso futuro por dois celulares

Somente depois de autorizacao separada:

1. conectar computador e celulares a mesma rede privada;
2. confirmar que a rede nao e uma rede de convidados com isolamento entre clientes;
3. confirmar manualmente o IPv4 do computador;
4. se necessario, criar manualmente regras de entrada limitadas ao perfil Private, sub-rede local e portas TCP 3333/4174;
5. iniciar o script com `-BindAddress 0.0.0.0 -PublicHost <IPv4_PRIVADO>`;
6. abrir `http://<IPv4_PRIVADO>:4174` nos celulares;
7. manter o Admin em `127.0.0.1:4173` no computador;
8. testar acesso, dois usuarios, perda e retorno da conexao;
9. remover manualmente qualquer regra temporaria ao fim.

Os scripts nao alteram firewall ou roteador. Nao ha comando de roteador sem marca/modelo e autorizacao.

## HTTPS e PWA

Service workers exigem contexto seguro: HTTPS, com excecao de `http://localhost` para desenvolvimento. Portanto, acesso por `http://<IPv4_PRIVADO>` permite testar pagina, layout e fluxos online, mas nao aprova instalacao PWA, cache offline ou service worker. Referencia: [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API#service_worker_concepts_and_usage).

Para homologar instalacao/offline em celulares, preparar depois HTTPS local com certificado confiado pelos aparelhos, ou outro tunel estritamente controlado e autorizado. Esta branch nao cria certificado, DNS ou exposicao publica.
