# Plano do piloto supervisionado

Cada fase exige evidência, responsável, janela, backup e decisão de go/no-go. Avançar não é automático.

## Fase 0 — laboratório

Escopo: dados `PILOT_DEMO_DATA`, PostgreSQL isolado, Admin, duas PWAs, cozinha/caixa, dois motoboys, Print Agent dry-run, concorrência, offline e falhas. Meta/NVIDIA desativadas.

Entrada: RC identificado e testes automáticos verdes.

Saída: zero perda/duplicação/divergência, backup/restore lógico e runbooks revisados.

Estado: concluída localmente, exceto Compose Docker e backup nativo.

## Fase 1 — restaurante fechado

Escopo: Wi-Fi, servidor, impressora e dispositivos reais; somente pedidos fictícios, sem clientes, sem WhatsApp/IA. Primeiro dry-run, depois uma impressora por vez com autorização explícita.

Entrada: hardware preenchido, `pg_dump`/restore testado, HTTPS/rede e rollback verificados.

Saída: turno simulado completo, impressões corretas, queda/reconexão exercitadas e treinamento aceito.

## Fase 2 — operação paralela

Escopo: pequeno conjunto de pedidos reais espelhados; processo atual/manual continua sendo a fonte operacional. Cain não é dependência exclusiva. Providers externos continuam fora, salvo aprovação separada.

Entrada: restaurante fechado aprovado e política de dados/backup formal.

Saída: métricas por pelo menos três janelas representativas, nenhuma falha crítica e reconciliação diária sem diferença.

## Fase 3 — piloto limitado

Escopo: um turno, poucos garçons, uma estação inicial, suporte presencial, rollback em minutos. Expandir só uma dimensão por vez.

Entrada: operação paralela aprovada, on-call e critérios de parada ensaiados.

Saída: metas de negócio/qualidade atendidas sem incidente crítico e equipe apta.

## Fase 4 — expansão

Adicionar gradualmente mais garçons/estações, depois delivery/tracking, depois WhatsApp e por último IA. Cada integração externa tem homologação, allowlist, limite de custo, privacidade e rollback próprios.

## Roteiro de uma sessão

1. registrar commit/artefato, flags, responsáveis e horário;
2. confirmar backup, prontidão, disco, rede e agente;
3. executar smoke test fictício;
4. liberar escopo definido;
5. monitorar filas, tempos e incidentes;
6. parar imediatamente ao atingir critério de interrupção;
7. reconciliar pedidos/pagamentos/impressões;
8. backup final, retrospectiva e decisão formal.

Ver métricas e gates em [SUCCESS_AND_STOP_CRITERIA.md](./SUCCESS_AND_STOP_CRITERIA.md).
