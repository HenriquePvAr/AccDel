# Riscos residuais de dependências do Driver App

Data: 15/07/2026

Versão validada: Expo `54.0.36`, React Native `0.81.5`.

## Resultado executivo

O Driver App passou de 18 apontamentos (`1 crítica`, `2 altas`, `14 moderadas`, `1 baixa`) para 11 moderadas, sem críticas, altas ou baixas. A crítica de `shell-quote` e as altas de `undici`/`ws` foram removidas mantendo o Expo SDK 54.

Os onze itens restantes não representam onze implementações distintas no app. São dois pacotes folha e nove agregações dos pais do Expo:

| Folha | Cadeia principal | Papel | Alcance no RC1 |
| --- | --- | --- | --- |
| `postcss@8.4.49` | `expo → @expo/metro-config@54.0.17 → postcss` | transformação/configuração de CSS no toolchain Metro | build/desenvolvimento; o app não processa CSS fornecido por usuário em produção |
| `uuid@7.0.3` | `expo → @expo/config-plugins@54.0.5 → xcode@3.0.1 → uuid` | configuração/prebuild de projeto iOS | ferramenta de prebuild; não integra o bundle Android validado nem a lógica de entrega |

Os nove apontamentos restantes aparecem em `@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/metro-config`, `@expo/prebuild-config`, `expo`, `expo-asset`, `expo-constants` e `xcode`, pois esses pacotes alcançam uma das folhas acima.

## Riscos removidos

### shell-quote

Cadeia anterior: `react-native@0.81.5 → react-devtools-core@6.1.5 → shell-quote@1.8.3`.

Versão final: `1.10.0`, acima da correção `1.8.4` de <https://github.com/advisories/GHSA-w7jw-789q-3m8p>.

### undici

Cadeia anterior: `expo@54.0.34 → @expo/cli@54.0.24 → undici@6.25.0`.

Versão final: `6.27.0`, removendo a faixa afetada por <https://github.com/advisories/GHSA-p88m-4jfj-68fv>. Trata-se do cliente HTTP da CLI do Expo; o código do app usa o `fetch` do React Native.

### ws

As cadeias do CLI, Metro, React Native e React DevTools passaram para `6.2.5`, `7.5.12` e `8.21.1`, acima das correções descritas em <https://github.com/advisories/GHSA-96hv-2xvq-fx4p> e <https://github.com/advisories/GHSA-58qx-3vcg-4xpx>.

Busca em `apps/driver-app/src` não encontrou shell, `child_process` ou implementação WebSocket de produto. Essa ausência reduz o alcance de produção das cadeias removidas, mas não foi usada como justificativa para mantê-las vulneráveis.

## Decisão sobre o resíduo

O `npm audit fix` disponível troca para Expo SDK 57. Essa mudança atravessa três versões de SDK e precisa alinhar React Native e módulos Expo, revisar changelogs e validar dispositivos. O procedimento oficial recomenda ajustar as dependências do SDK, executar `expo install --fix` e `expo-doctor`: <https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/>.

O upgrade não foi feito automaticamente porque seria uma migração major fora do escopo do hardening compatível. Também não foram criados overrides:

- elevar `postcss` isoladamente pode quebrar a faixa/testes do Metro SDK 54;
- elevar `uuid` para a linha corrigida exigiria atravessar majors da dependência usada por `xcode`;
- esconder os avisos no lockfile não prova compatibilidade do SDK.

## Mitigações até a migração

- Não expor Metro, Expo CLI ou servidores de desenvolvimento em rede não confiável.
- Gerar builds somente em estação/CI controlados e com lockfile revisado.
- Não executar prebuild iOS com entrada ou repositório não confiável.
- Manter Expo/React Native no patch mais recente compatível do SDK 54.
- Reauditar semanalmente e antes do laboratório.
- Bloquear imediatamente o RC se surgir crítica/alta nova ou evidência de alcance no runtime.

## Validação executada

- `npm ci` reproduzível após recuperação controlada de um lock de diretório do Windows;
- `npm audit`: 11 moderadas, 0 baixa, 0 alta, 0 crítica;
- ESLint aprovado;
- TypeScript aprovado;
- export Android offline aprovado;
- nenhuma alteração em código-fonte, permissões ou contratos de API.

Classificação: **risco moderado residual documentado e aceito apenas para laboratório supervisionado**. Não constitui homologação para restaurante ou produção.
