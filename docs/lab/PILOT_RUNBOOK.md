# Runbook do laboratorio controlado

Este runbook opera somente a branch `lab/pilot-hardware-homologation`, com worktree limpa, dados ficticios e providers externos desativados.

## 1. Pre-requisitos

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\check-prerequisites.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\start-lab.ps1 -DryRun
```

O Windows deste inventario aplica a politica padrao que bloqueia scripts nao assinados. `-ExecutionPolicy Bypass` vale somente para o processo filho, nao altera a politica da maquina e nao usa UAC. O primeiro uso real cria apenas `.pilot/lab`, copia a API sem `.env`, executa `npm ci` pelo lockfile da copia e gera credenciais aleatorias ignoradas. Docker nao e necessario.

## 2. Inicio local

Confirme que 3333, 4173, 4174 e 55439 estao livres. Em seguida:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\start-lab.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\status-lab.ps1
```

Sequencia controlada: builds, PostgreSQL loopback, migrations, seed piloto idempotente, API, Admin loopback, Waiter loopback e Print Agent dry-run. Meta, NVIDIA e notificacoes permanecem desativados; roteamento externo aponta para loopback indisponivel e usa fallback deterministico.

## 3. Smoke integrado

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\smoke-lab.ps1 -DryRun
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\smoke-lab.ps1
```

O smoke valida `/health`, login ficticio, catalogo, mesa/comanda, delivery, estados, PrintJobs, artefatos TXT/BIN/JSON, hashes, ledger, idempotencia e providers desativados. Ele recusa segredo bruto nos logs.

## 4. Restart controlado

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\stop-lab.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\start-lab.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\status-lab.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\smoke-lab.ps1
```

O segundo inicio reutiliza somente o runtime pertencente ao mesmo commit, reaplica migrations e seed idempotente e permite confirmar recovery/ledger. Qualquer mudanca de commit, host ou bind exige stop e reset.

## 5. Parada e reset

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\stop-lab.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\reset-test-data.ps1 -DryRun
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\reset-test-data.ps1 -ConfirmReset
```

`stop-lab.ps1` valida PID, imagem, horario, command line e porta antes de atuar. PostgreSQL recebe marcador de parada graciosa. O reset remove recursivamente somente `.pilot/lab` quando o marcador de propriedade coincide e nenhum processo permanece.

## 6. Acesso LAN futuro

Somente apos autorizacao manual de rede/firewall:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\lab\start-lab.ps1 -BindAddress 0.0.0.0 -PublicHost <IPv4_PRIVADO>
```

O Admin permanece em loopback. Consulte `NETWORK_PLAN.md` para as limitacoes de HTTP/PWA.

## Regras de parada

Pare imediatamente se houver segredo em log, provider externo ativo, processo sem propriedade validada, porta inesperada, banco sem marcador de laboratorio, fila fisica selecionada ou divergencia de hash. Nao use kill por nome, UAC ou comandos de firewall como atalho.
