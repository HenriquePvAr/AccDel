# Inventario de hardware do laboratorio

Leitura realizada em 15/07/2026, sem alterar sistema, rede, drivers, servicos ou filas.

## Computador

| Item | Detectado |
|---|---|
| Hostname | `DESKTOP-05I1UT8` |
| Windows | Windows 10 Pro 22H2, build 19045, 64 bits |
| CPU | AMD Ryzen 5 5600GT with Radeon Graphics, 12 processadores logicos |
| RAM | 31,4 GiB |
| Disco C: | NTFS, 585,3 GiB totais, 53,7 GiB livres na leitura |
| PowerShell | 5.1.19041.6456 |
| Node | 24.16.0 |
| npm | 11.13.0 |
| Git | 2.54.0.windows.1 |
| Chrome | 150.0.7871.116 |
| Edge | 150.0.4078.65 |
| Docker | ausente; servico Docker Desktop ausente |

O PostgreSQL embutido existe como dependencia bloqueada da API. O laboratorio nao reutiliza a arvore local incompleta nem seu ambiente antigo: prepara uma copia ignorada em `.pilot/lab/api-src`, instala exatamente o lockfile e mantem os dados em `.pilot/lab/postgres-data`.

## Rede

| Item | Detectado |
|---|---|
| Interface ativa | Ethernet, Realtek PCIe GbE Family Controller |
| Link | 1 Gbps |
| MAC mascarado | `74-56-**-**-B4-18` |
| IPv4 mascarado | `192.168.***.54` |
| Gateway | presente |
| Perfil Windows | Private |
| Conectividade | IPv4 e IPv6 com Internet |

Nenhuma configuracao de firewall, DNS, adaptador, perfil ou roteador foi alterada.

## Impressao e portas locais

Filas encontradas: OneNote for Windows 10, Microsoft XPS Document Writer, Microsoft Print to PDF e Fax. Todas sao virtuais ou de sistema. Nao foi detectada fila termica, impressora USB de recibo, porta TCP de impressora ou driver de fabricante.

- portas de impressao enumeradas: COM1-COM4, LPT1-LPT3, FILE, PORTPROMPT, OneNote e Fax;
- porta serial materializada: COM1 generica;
- Spooler: em execucao, inicializacao automatica, conta LocalSystem;
- drivers: somente Microsoft;
- dispositivo USB relacionado a impressao: nenhum detectado.

Classificacao: **NENHUMA IMPRESSORA TERMICA DETECTADA**.

O PID e a porta classificados anteriormente como residuo proibido nao foram consultados nem reutilizados.
