# Incidentes e rollback do laboratorio

## Parada normal

1. interromper novas acoes nos navegadores;
2. executar `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\status-lab.ps1`;
3. executar `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\stop-lab.ps1`;
4. confirmar que 3333, 4173, 4174 e 55439 estao livres;
5. preservar logs apenas enquanto necessarios e sem publica-los;
6. executar reset explicito quando as evidencias sanitizadas estiverem registradas.

## Processo sem propriedade validada

Se PID, create time, imagem, command line, raiz ou porta divergirem, nao encerrar o processo. Registre somente nome do componente, PID, horario e razao da divergencia; solicite revisao manual. Nunca use kill por nome, `taskkill`, UAC ou inferencia.

## PostgreSQL nao encerra

O supervisor usa um marcador proprio e chama a parada graciosa da biblioteca. Se nao concluir, o script mantem o documento de processos e falha fechado. Nao remova dados, nao reutilize a porta e nao force o executavel.

## Provider externo ou segredo

- parar o laboratorio;
- nao copiar o log;
- confirmar `WHATSAPP_PROVIDER=disabled` e `AI_PROVIDER=disabled` no runtime ignorado;
- revogar externamente qualquer credencial real caso tenha sido inserida manualmente;
- remover somente `.pilot/lab` com o reset validado;
- tratar a ocorrencia como incidente antes de novo teste.

## Impressao inesperada

Desconectar logicamente o fluxo pelo stop controlado; nao enviar segundo job. Preservar cupom e horario, identificar fila/porta e classificar resultado como desconhecido. A branch atual usa exclusivamente dry-run e nao implementa spooler Windows.

## Rede

Os scripts nao criam regra de firewall. Se uma regra manual temporaria tiver sido autorizada, o mesmo responsavel deve remove-la e confirmar o perfil Private. Nenhum comando de roteador e executado por este runbook.

## Reset seguro

`reset-test-data.ps1 -ConfirmReset` exige branch, worktree limpa, marcador `CAIN_LAB_RUNTIME_V1`, raiz exata e ausencia de processos. Remove somente banco, credenciais, logs e outputs ficticios em `.pilot/lab`; nao toca backup RC1, OneDrive ou dados externos.
