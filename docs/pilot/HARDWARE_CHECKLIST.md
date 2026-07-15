# Checklist de hardware e rede

Preencher no restaurante; campos em branco são deliberados. Anexar data, responsável e foto/etiqueta sanitizada. Não registrar senha, SSID secreto, MAC completo ou IP público neste repositório.

## Servidor/computador local

- [ ] Responsável e patrimônio: __________
- [ ] Windows/edição/build suportados: __________
- [ ] CPU/RAM: __________
- [ ] Espaço livre inicial ≥ 20 GB; alerta configurado antes de 10 GB
- [ ] Disco saudável e backup fora do equipamento
- [ ] Ethernet/Wi-Fi operacional e IP interno reservado: __________
- [ ] Energia estabilizada; nobreak testado: __________
- [ ] Suspensão, hibernação e reinício automático de atualização desativados durante o turno
- [ ] Inicialização automática dos serviços, com atraso após banco/rede
- [ ] Usuário de serviço sem privilégio administrativo interativo
- [ ] ACL em `.pilot`, runtime, backups, logs e saídas de impressão
- [ ] Firewall permite apenas a sub-rede/portas necessárias; banco não exposto
- [ ] Relógio e fuso `America/Manaus` sincronizados
- [ ] Rotação/retenção de logs definida
- [ ] Reinício e recuperação sem login humano testados

## Impressora térmica — repetir por equipamento

- [ ] Fabricante/modelo/número interno: __________
- [ ] Largura: [ ] 58 mm [ ] 80 mm
- [ ] Transporte: [ ] USB [ ] Ethernet [ ] outro: __________
- [ ] Nome exato no Windows ou IP interno reservado: __________
- [ ] Porta/protocolo: __________
- [ ] ESC/POS e comandos compatíveis confirmados
- [ ] Code page/acento/`ç` testados: __________
- [ ] Corte automático: [ ] sim [ ] não [ ] parcial
- [ ] Gaveta: [ ] não usada [ ] pulso testado
- [ ] Papel correto e ao menos dois rolos reserva por estação
- [ ] Fila do Windows, spooler e permissão do usuário de serviço validados
- [ ] Cupom curto, longo, adicional, cancelamento e reimpressão testados
- [ ] Queda de energia/cabo, retorno e job `UNKNOWN_RESULT` exercitados
- [ ] Estação e regra de rota conferidas: cozinha/bar/caixa/expedição

## Celulares/tablets — repetir por dispositivo

- [ ] Identificador interno: __________
- [ ] Android/iOS e versão: __________
- [ ] Navegador/versão suportado: __________
- [ ] Resolução/tamanho e orientação: __________
- [ ] PWA instalada pela URL HTTPS correta
- [ ] Login individual; não compartilhar conta
- [ ] Wi-Fi operacional e roaming testados
- [ ] Economia de bateria/dados não encerra PWA durante o turno
- [ ] Data/hora automáticas
- [ ] Tela bloqueia com PIN/biometria; notificações não expõem PII
- [ ] Câmera não é necessária e sua permissão não foi concedida
- [ ] Localização concedida apenas ao Driver App, durante uso, quando necessária
- [ ] Offline, retorno de rede e conflito exibidos claramente
- [ ] Logout/revogação e procedimento de dispositivo perdido testados

## Rede

- [ ] Roteador/modelo/firmware: __________
- [ ] SSID operacional separado de convidados: __________
- [ ] Isolamento de clientes permite dispositivos alcançarem somente os serviços necessários
- [ ] VLAN/regras entre servidor, operação e impressoras documentadas
- [ ] IP fixo/reserva DHCP para servidor e impressoras
- [ ] DNS interno/externo e certificado HTTPS válidos
- [ ] Acesso à API a partir de cada área física testado
- [ ] Latência/perda sob carga do turno medidas
- [ ] Internet e fallback: __________
- [ ] Operação local/manual quando internet cair ensaiada
- [ ] Nenhuma porta de PostgreSQL/Admin exposta à internet
- [ ] Scan de portas da rede de convidados não alcança serviços operacionais

## Aceite

- [ ] Todos os campos preenchidos e evidências anexadas fora do Git
- [ ] Teste em restaurante fechado concluído
- [ ] Pendências têm responsável e prazo
- [ ] Gerente e suporte assinaram aceite: __________ / __________
