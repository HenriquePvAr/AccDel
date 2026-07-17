# Backup e restauração do piloto

## Política

Fazer backup antes de cada migration, antes do piloto, no fim de cada turno e antes de qualquer rollback. Manter ao menos 7 backups diários e 4 semanais no piloto; ajustar à política legal antes de dados reais. Armazenar fora do host operacional, criptografado em repouso, com ACL restrita e checksum. Nunca versionar backups no Git.

## Backup lógico seguro de laboratório

O mecanismo JSON existe apenas para banco local marcado `PILOT_DEMO_DATA`, host `127.0.0.1/localhost`, exatamente 23 migrations e nome de banco permitido.

```powershell
$env:PILOT_DATABASE_URL='<URL PostgreSQL local obtida do runtime protegido>'
npm.cmd run staging:backup
npm.cmd run staging:backup:test
```

O teste final executado após os fluxos integrados fez: seed/dados operacionais → backup → criação de banco novo → migrations → restore transacional → validação → remoção do banco temporário. Resultado: PASS, 62 tabelas, 1.006 registros e 23 migrations. O envelope possui SHA-256; restore rejeita checksum/formato/marcador inválido, preserva valores `json/jsonb`, confere a contagem de cada tabela e nunca sobrescreve banco existente.

Restore manual:

```powershell
$env:PILOT_DATABASE_URL='<URL PostgreSQL local obtida do runtime protegido>'
npm.cmd run staging:restore -- 'backups\cain-pilot-logical-AAAA.json' 'cain_pilot_restore_novo'
```

Valide no destino novo: 23 migrations, marca `PILOT_DEMO_DATA`, contagens principais, login, um fluxo somente leitura e prontidão. Só então altere `DATABASE_URL` e reinicie a API.

## Backup nativo PostgreSQL

Para restaurante fechado, usar `pg_dump` custom format e `pg_restore --list`/restore em banco novo:

```powershell
npm.cmd run staging:backup:native
npm.cmd run staging:backup:native:test
```

As credenciais vêm do runtime ignorado; não usar senha na linha de comando ou no nome do arquivo. O script limita origem/destino a banco local de piloto. Nesta estação `pg_dump`/`pg_restore` e Docker não estavam disponíveis, então esse teste permaneceu pendente e é condição para restaurante fechado.

## Recuperação

1. parar entrada de novas mutações;
2. preservar logs, source commit, backup suspeito e banco original;
3. verificar checksum e listar conteúdo;
4. restaurar em banco com nome novo;
5. aplicar/confirmar migrations compatíveis;
6. validar contagens, sentinela, permissões e fluxo crítico;
7. apontar apenas a API para o banco restaurado;
8. monitorar prontidão; nunca apagar o original durante o incidente.

Backups podem conter PII quando o sistema for real. Nesse estágio, retenção, criptografia, transporte, descarte e acesso precisam de aprovação formal.
