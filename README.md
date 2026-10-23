# Rumo: um passo de cada vez

App para planejar hábitos, somar pontos, bater metas diárias e acompanhar a "rota" do mês, com **sincronização em tempo real** entre aparelhos e funcionamento offline. Distribuído como **arquivo para baixar e instalar**: APK no Android e instalador `.exe` no Windows, feito em **Flutter** (sem Expo).

**Downloads:** na página [Releases](https://github.com/Siraj-Youssef/app-valt/releases) do repositório:

| Plataforma | Arquivo | Como instalar |
|---|---|---|
| Android | `Rumo-android.apk` | Abra no celular e permita "instalar apps desconhecidos" para o navegador. Se aparecer o Play Protect, toque em "Instalar mesmo assim" (o app não está na Play Store). |
| Windows | `Rumo-Setup-X.Y.Z.exe` | Instalador (sem precisar de administrador). O Windows SmartScreen pode avisar "editor desconhecido": clique em "Mais informações → Executar assim mesmo". |
| Windows (portátil) | `Rumo-windows-portatil.zip` | Descompacte e abra `Rumo.exe`. |

| Entrada | Hoje | Novo passo | Mapa | Metas | Você |
|---|---|---|---|---|---|
| ![Entrada](docs/telas/0-login.png) | ![Hoje](docs/telas/1-hoje.png) | ![Novo passo](docs/telas/3-novo-passo.png) | ![Mapa](docs/telas/4-mapa.png) | ![Metas](docs/telas/5-metas.png) | ![Você](docs/telas/6-voce.png) |

---

## 1. Origem e identidade própria

A ideia geral vem de um app pessoal mostrado num vídeo do Instagram (`@adrian_valt`, 22/10/2026): tarefas que valem pontos, metas por dia, sequência e calendário, um conceito comum a vários apps de hábitos. **Nome, marca, cores, tipografia, textos, layout, navegação e fluxos foram criados do zero:**

| Aspecto | App do vídeo | Rumo |
|---|---|---|
| Marca | "Evolving", seta subindo | `rumo.` com ponto vermelho; ícone de bússola; metáfora de trilha |
| Visual | Escuro com gradientes coral/rosa e brilho | **Preto e vermelho, minimalista**: preto `#0A0A0A`, grafite `#141414`, branco, e **um único vermelho chapado** `#E5302B` (só em progresso, ação principal e aba ativa); sem gradientes |
| Tipografia | Sans única | Space Grotesk (títulos/números) + Inter (texto), embutidas no app |
| Navegação | 5 ícones + "+" central saltado | 4 abas com rótulo (Hoje, Mapa, Metas, Você) + botão "+ Passo / + Meta" contextual |
| Progresso | Anel + 3 cards | Número grande + barra-trilha por tarefa + 3 indicadores em linha |
| Dica | Card "COACH" em gradiente | Faixa "Bússola" com filete vermelho, sugerindo o próximo passo |
| Calendário | Grade com estrelas | Mapa de calor do mês + 8 semanas + hábitos mais constantes |
| Termos | Nível, estrelas, ritmo | Etapa, marcos, Rota do mês |

> **Marca:** "Rumo" também é o nome de uma grande empresa de logística (Rumo S.A.). A classe de serviço é outra, mas faça uma busca no INPI (classes 9 e 42) e nas lojas antes de publicar.

---

## 2. Funcionalidades

- **Hoje:** pontos do dia vs. meta, barra-trilha, dias seguidos, etapa, pontos da semana, dica da Bússola, semana em círculos, plano por período (manhã/tarde/noite). Dá para navegar entre os dias e concluir retroativamente; dias futuros ficam bloqueados.
- **Novo passo:** hábito recorrente (dias da semana com atalhos) ou passo de um dia; ícone, pontos (5–50), horário e minutos opcionais; editar e excluir tocando no item.
- **Mapa:** mapa de calor do mês com marcos, detalhe do dia, últimas 8 semanas com linha de meta, constância em 30 dias.
- **Metas:** destinos da semana, do mês e do ano com unidade livre; +1 rápido (segurar = outro valor).
- **Você:** etapa, Rota do mês com previsão, pontos por dia da semana, nome editável, sair.
- **Sincronização:** indicador no topo ("em dia", "sincronizando", "N pendentes", "offline").

**Regras** (`rumo/lib/logic/model.dart`):
- **Marco:** dia em que os pontos alcançam a meta do dia.
- **Dias seguidos:** marcos consecutivos. Dias com meta 0 são livres e não quebram a sequência.
- **Etapa:** sobe a cada semana completa.
- **Rota:** pontos do mês ÷ meta acumulada desde o início de uso; a previsão é a meta do mês × esse ritmo.

---

## 3. Stack e por quê

| Camada | Escolha | Justificativa |
|---|---|---|
| App | **Flutter 3.47 (Dart 3.13)** | Um código só gera APK Android e `.exe` nativo do Windows (e, se quiser, macOS/Linux/iOS), com visual idêntico e sem depender de serviço de terceiros para compilar |
| Pacotes | `web_socket_channel`, `http`, `shared_preferences`, `uuid` | Oficiais ou amplamente mantidos; nenhum serviço proprietário |
| Tempo real | **WebSocket próprio** | Protocolo de recuperação e conflitos sob nosso controle |
| Servidor | Node 24 + `node:sqlite` + `ws` | Uma dependência, um arquivo `.db`, Docker |
| Build e distribuição | **GitHub Actions** → GitHub Releases | Compila APK e instalador Windows na nuvem a cada versão; nada pesado no PC do desenvolvedor |
| HTTPS/WSS | Caddy (Let's Encrypt) | `deploy/docker-compose.yml` |

---

## 4. Arquitetura

```
 ┌─────── Celular (APK) ───────┐      ┌──────── PC (Rumo.exe) ───────┐
 │ Telas Flutter               │      │ Telas Flutter (mesmo código) │
 │ Store: banco local + outbox │      │ Store                        │
 │ SyncClient (WebSocket)  ────┼──┐ ┌─┼── SyncClient                 │
 └─────────────────────────────┘  │ │ └──────────────────────────────┘
                                  ▼ │
                 ┌──────── server (Node) ────────────────┐
                 │ HTTP  /auth/register /auth/login /me  │
                 │ WS    /sync  hello → catch-up → live  │
                 │ LWW por registro + seq por usuário    │
                 │ SQLite: users, sessions, records      │
                 └───────────────────────────────────────┘
```

**Protocolo** (documentado no topo de `server/src/server.js`):
1. O app conecta em `/sync` e envia `hello {token, deviceId, since: lastSeq}`.
2. O servidor manda tudo com `seq > lastSeq`, depois `synced`, e passa a repassar ao vivo as mudanças dos outros aparelhos do mesmo usuário.
3. Edições locais vão para a **outbox** e sobem em lotes (`push`). O servidor responde `ack` com a versão vencedora de cada registro, e só sai da outbox o que foi confirmado e não foi editado de novo nesse meio-tempo.
4. **Conflito:** *last writer wins* por registro (timestamp + `deviceId` para desempate), a mesma regra no app e no servidor. Uma edição local sempre supera a versão que o usuário está vendo, mesmo com o relógio do aparelho atrasado.
5. **Robustez em aparelho real:**
   - reconexão com backoff exponencial + jitter (1 s → 30 s);
   - reconexão imediata ao voltar do segundo plano;
   - ping a cada 20 s, com timeout de 10 s;
   - heartbeat do servidor a cada 30 s;
   - timeout de 15 s no ack;
   - gravação local ao ir para o segundo plano.

O formato dos dados é o mesmo da versão anterior (Expo), então contas já criadas no servidor continuam funcionando.

---

## 5. Código-fonte

```
├── rumo/                         App Flutter
│   ├── lib/
│   │   ├── main.dart             sessão, login, troca para o app
│   │   ├── theme.dart            paleta e tipografia da marca
│   │   ├── data/   store.dart (banco local + outbox) · sync.dart (WebSocket) · session.dart (conta e servidor)
│   │   ├── logic/  model.dart (pontos, marcos, etapa, rota, Bússola) · dates.dart
│   │   └── ui/     shell.dart (abas + botão "+") · widgets.dart · sheets.dart · screens/{today,map,goals,you,login}.dart
│   ├── test/model_test.dart      regras, datas e LWW (5 testes)
│   ├── assets/fonts/             Space Grotesk e Inter (SIL OFL)
│   ├── android/  windows/  web/  projetos nativos (web só para testes)
│   └── windows/installer/rumo.iss  instalador Inno Setup
├── server/                       contas + sincronização (Node) · 6 testes
├── deploy/                       docker-compose + Caddyfile (HTTPS/WSS)
├── .github/workflows/build-release.yml
└── docs/telas/                   screenshots
```

---

## 6. Como gerar uma nova versão (download)

1. Atualize `version:` em `rumo/pubspec.yaml` (ex.: `1.1.0+2`).
2. Crie e envie a tag:
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
3. O GitHub Actions testa, compila o APK e o Windows e publica tudo em **Releases** (uns 10 a 15 minutos). Em pushes comuns para a `main`, os arquivos ficam como *artifacts* da execução, em Actions.

**Endereço do servidor embutido:** defina a variável do repositório `SERVER_URL` em *Settings → Secrets and variables → Actions → Variables* (ex.: `https://rumo.seudominio.com`). Sem ela, o APK aponta para o PC na rede local (`http://192.168.1.65:8787`) e o Windows para `http://localhost:8787`. Em qualquer caso, o usuário pode trocar em "Servidor" na tela de login.

### Compilar localmente (opcional)
Requer o [Flutter SDK](https://docs.flutter.dev/get-started/install). Para Android, também o Android SDK com Java 17; para Windows, o Visual Studio com "Desenvolvimento para desktop com C++" e o **Modo de Desenvolvedor** do Windows ligado.
```bash
cd rumo
flutter pub get
flutter test
flutter build apk --release --dart-define=SERVER_URL=http://192.168.1.65:8787
flutter build windows --release
```

---

## 7. Servidor

```bash
cd server
npm install
npm test        # 6 testes: tempo real, recuperação offline, conflito, isolamento, auth, validação
npm start       # porta 8787; mostra os IPs para usar no celular
```
No Windows, libere o Node no firewall para redes privadas. Para usar fora de casa, publique com HTTPS:
```bash
cd deploy
echo DOMINIO=rumo.seudominio.com > .env
docker compose up -d --build
```
Depois defina `SERVER_URL=https://rumo.seudominio.com` (seção 6) e gere uma nova versão.

---

## 8. Limitações e pontos a validar

- **iPhone:** o iOS não instala arquivos baixados fora da App Store/TestFlight. O código Flutter compila para iOS, mas a distribuição exige um Mac (ou CI macOS) e uma conta Apple Developer.
- **Assinatura:**
  - O APK é assinado com a chave de depuração do Flutter, o que basta para instalar manualmente. Para a Play Store ou para atualizações com chave fixa, crie uma keystore própria e configure-a como *secret* no CI.
  - O `.exe` não tem certificado de assinatura de código; por isso aparece o aviso do SmartScreen.
- **Sem notificações:** lembretes não foram implementados.
- **Conflito por registro inteiro**, não por campo; exclusões ficam como tombstones; não há recuperação de senha.
- **HTTP sem TLS** só em rede local (Android com `usesCleartextTraffic`). Em produção, use `https://`.
- **Verificado:**
  - `flutter analyze` sem avisos; 5 testes do app e 6 do servidor passando.
  - Build web real em Edge headless com dados de demonstração: um segundo "aparelho" concluiu uma tarefa e a tela mudou de 2/5 para 3/5 sozinha.
  - Screenshots de todas as telas conferidas.
- **Verificado pelo CI após o push** (ver Actions): compilação do APK e do instalador Windows. **Não verificado:** instalação num celular físico e num PC limpo.
