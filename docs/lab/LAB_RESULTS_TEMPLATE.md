# Modelo de resultado da homologacao

Data/hora:

Commit:

Responsavel tecnico:

Responsavel operacional:

## Ambiente

- Windows/hostname conferidos: [ ]
- Rede privada: [ ]
- IPv4 registrado apenas em evidencia local: [ ]
- Portas 3333/4173/4174/55439 livres antes e depois: [ ]
- Providers externos desativados: [ ]

## Dry-run

- `/health`: [ ] aprovado [ ] reprovado
- `/ready`: [ ] ready [ ] attention [ ] blocked
- Salão/comanda: [ ] aprovado [ ] reprovado
- Delivery: [ ] aprovado [ ] reprovado
- PrintJobs consumidos: [ ] aprovado [ ] reprovado
- TXT/BIN/JSON e hashes: [ ] aprovado [ ] reprovado
- Ledger/restart/idempotencia: [ ] aprovado [ ] reprovado
- Secrets nos logs: [ ] ausentes [ ] incidente

## Celulares

- Aparelho A/navegador:
- Aparelho B/navegador:
- Layout: [ ] aprovado [ ] reprovado
- Dois usuarios: [ ] aprovado [ ] reprovado
- Perda/retorno de rede: [ ] aprovado [ ] reprovado
- HTTPS/service worker: [ ] nao testado [ ] aprovado [ ] reprovado

## Impressora

- Marca/modelo:
- Conexao/fila/porta:
- Largura:
- Linguagem:
- Autorizacao fisica registrada: [ ]
- Impressao fisica: [ ] nao executada [ ] aprovada [ ] reprovada [ ] resultado desconhecido

## Evidencias sanitizadas

Listar somente nomes/horarios/hashes. Nao anexar runtime.env, credenciais, IP completo, logs brutos ou dados pessoais.

## Incidentes e rollback

Ocorrencias:

Parada confirmada:

Reset confirmado:

## Decisao

- [ ] Reprovado; corrigir e repetir dry-run.
- [ ] Dry-run aprovado; ainda bloqueado para impressao fisica.
- [ ] Homologacao fisica supervisionada aprovada para o escopo registrado.

Esta folha nunca autoriza producao, restaurante aberto, Meta ou NVIDIA reais.
