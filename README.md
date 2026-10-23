# Rumo: um passo de cada vez

App para **computador (Windows, macOS, Linux) e celular (Android; iPhone pelo navegador)** para planejar hábitos, somar pontos, bater metas diárias e acompanhar a "rota" do mês, com **sincronização em tempo real** entre os aparelhos e funcionamento offline. Tudo em planos **gratuitos**: banco no Supabase e executáveis gerados pelo GitHub.

Nasceu da análise de um app pessoal mostrado num vídeo do Instagram (`@adrian_valt`, 22/10/2026). Do vídeo veio só a **ideia geral**, que é comum a vários apps de hábitos (tarefas que valem pontos, metas por dia, sequência e calendário). Nome, marca, cores, tipografia, textos, layout, navegação e fluxos foram criados do zero.

| Entrada | Hoje | Novo passo | Mapa | Metas | Você |
|---|---|---|---|---|---|
| ![Entrada](docs/telas/0-login.png) | ![Hoje](docs/telas/1-hoje.png) | ![Novo passo](docs/telas/3-novo-passo.png) | ![Mapa](docs/telas/4-mapa.png) | ![Metas](docs/telas/5-metas.png) | ![Você](docs/telas/6-voce.png) |

---

## 1. Identidade própria (e o que mudou em relação ao app do vídeo)

| Aspecto | App do vídeo | Rumo |
|---|---|---|
| Nome e marca | "Evolving", logo de seta subindo | **Rumo**, logotipo `rumo.` com ponto vermelho e ícone de bússola; metáfora de trilha e caminho |
| Paleta | Escura, gradientes coral/rosa, brilho neon | **Preto e vermelho, minimalista**: preto `#0A0A0A`, grafite `#141414`, branco `#F5F5F5` e **um único vermelho chapado** `#E5302B`. Sem gradientes, sem brilho; o vermelho fica reservado para progresso, ação principal e aba ativa, e seleções usam branco |
| Tipografia | Sans geométrica única | **Space Grotesk** (títulos e números) + **Inter** (texto) |
| Navegação | 5 abas só com ícones + botão "+" central saltado | 4 abas com rótulo (**Hoje, Mapa, Metas, Você**) + botão "+ Passo / + Meta" contextual à direita |
| Criar item | Menu com 4 opções → formulário com stepper de pontos | Um formulário só ("Novo passo") com abas Hábito / Só um dia, pontos em pílulas (5–50), "Ideias" em texto |
| Progresso do dia | Anel circular + 3 cards laterais | Número grande + **barra-trilha** segmentada por tarefa + 3 indicadores em linha |
| Dica | Card "COACH" em gradiente | Faixa "**Bússola**" em grafite com filete vermelho à esquerda, que sugere o *próximo passo* concreto |
| Semana | Gráfico de barras verticais | 7 círculos que "enchem" conforme a meta; bandeira quando batida |
| Lista do dia | Faixa de 7 datas, itens com check à direita | Navegação ‹ Hoje ›, itens agrupados em **Manhã / Tarde / Noite / Qualquer hora**, check à esquerda |
| Calendário | Grade com ícones das tarefas e estrela | **Mapa de calor** do mês (intensidade = % da meta) + histórico de 8 semanas e hábitos mais constantes, tudo na mesma aba |
| Gamificação | Nível, estrelas, "No ritmo certo" | **Etapa**, **marcos** (bandeira), **Rota do mês** (Em rota / Perto da rota / Fora da rota) |
| Metas longas | Não aparecem no vídeo | Agrupadas por semana/mês/ano, com botão **+1** rápido (segurar = outro valor) |
| Ícone do app | Não aparece | Bússola branca com agulha vermelha sobre preto (`app/assets`, gerado em SVG) |

> **Sobre plágio e marca.** A ideia de um app de hábitos com pontos não é protegível; o risco estava em copiar nome, logo, identidade visual e textos, e isso foi todo refeito. O original também é escuro com tons quentes. O Rumo se diferencia pelo vermelho puro e chapado (sem gradiente coral nem brilho), pela tipografia, pela estrutura das telas e pela navegação; para distância visual máxima, evite reintroduzir gradientes. **"Rumo" é uma palavra comum e também nome de uma grande empresa brasileira de logística (Rumo S.A.).** A classe de serviço é outra, mas **faça uma busca no INPI** (classes 9 e 42) e nas lojas antes de publicar. Trocar o nome é simples: `app.json` (`name`, `slug`, `scheme`, ids), o logotipo em `TodayScreen.tsx`/`LoginScreen.tsx` e este README.

---

## 2. Funcionalidades

- **Hoje:** pontos do dia vs. meta, barra-trilha, dias seguidos, etapa, pontos da semana, dica da Bússola, semana em círculos e plano do dia por período. Dá para navegar para dias anteriores e concluir retroativamente; dias futuros ficam bloqueados.
- **Novo passo:** hábito recorrente (dias da semana, atalhos "Todo dia / Dias úteis / Fins de semana") ou passo de um dia só; ícone, pontos, horário e minutos opcionais; "Salvar e adicionar outro"; editar e excluir tocando no item.
- **Mapa:** mapa de calor do mês com marcos, resumo (pontos, marcos, passos), detalhe do dia, últimas 8 semanas com linha de meta, ranking de constância em 30 dias.
- **Metas:** destinos da semana, do mês e do ano com unidade livre (livros, km, R$…), +1 rápido e registro de valores maiores.
- **Você:** etapa e quanto falta, **Rota do mês** com previsão, pontos por dia da semana (a meta da semana e do mês é a soma), nome editável, sair.
- **Sincronização:** indicador no topo ("em dia", "sincronizando", "N pendentes", "offline"). O que é marcado no computador aparece no celular em menos de um segundo, e vice-versa.

**Regras** (`app/src/lib/model.ts`):
- **Marco:** dia em que os pontos alcançam a meta do dia.
- **Dias seguidos:** marcos consecutivos. Dias com meta 0 são livres e não quebram a sequência.
- **Etapa:** sobe a cada semana completa.
- **Rota:** pontos do mês ÷ meta acumulada desde o início de uso. A previsão é meta do mês × esse ritmo.

---

## 3. Como fica de graça

| Peça | Serviço gratuito | O que faz |
|---|---|---|
| Banco + contas + tempo real | **Supabase** (plano Free) | Guarda os dados de cada conta (Postgres), faz login por e-mail e senha e avisa os aparelhos na hora quando algo muda |
| Executáveis | **GitHub Actions** (grátis e ilimitado em repositório público) | Gera o instalador `.exe` do Windows, o `.dmg` do macOS, o `.AppImage` do Linux e o `.apk` do Android, e publica tudo numa Release |
| iPhone | **GitHub Pages** | Versão web instalável: Safari → Compartilhar → "Adicionar à Tela de Início". (App nativo de iPhone exige a conta Apple de US$ 99/ano) |

Nada disso pede cartão de crédito.

---

## 4. Passo a passo (uma vez só, uns 15 minutos)

### 4.1 Criar o banco no Supabase
1. Crie uma conta em **supabase.com** e clique em **New project** (região: *South America (São Paulo)*). Guarde a senha do banco, mas o app não precisa dela.
2. No projeto, abra **SQL Editor → New query**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique **Run**. Deve aparecer "Success".
3. **Authentication → Sign In / Providers → Email:** desligue **Confirm email** (assim a conta funciona na hora, sem link por e-mail). Se preferir deixar ligado, o app avisa para confirmar pelo e-mail antes de entrar.
4. **Project Settings → API Keys** (ou **Data API**): copie a **Project URL** (`https://xxxx.supabase.co`) e a chave **publishable** (ou **anon public**). Essa chave é feita para ficar dentro do app; quem protege os dados são as regras do banco (cada conta só lê e grava o que é seu). **Nunca** use a chave `service_role`/`secret`.

### 4.2 Contar ao GitHub qual é o banco
No repositório: **Settings → Secrets and variables → Actions → aba Variables → New repository variable**:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | a Project URL |
| `SUPABASE_KEY` | a chave publishable/anon |

Assim os executáveis já saem apontando para o seu banco. (Sem isso eles funcionam também, mas pedem a URL e a chave na tela de entrada, no botão **Banco**.)

### 4.3 Gerar os executáveis
- **Publicar uma versão:** em **Code → Releases → Draft a new release**, crie a tag `v1.0.0` (ou rode `git tag v1.0.0 && git push origin v1.0.0`). O workflow **Gerar executáveis** roda sozinho (uns 15–20 min) e cria a Release com os arquivos. Se a Release foi criada pela tela, os arquivos são anexados a ela.
- **Só testar:** **Actions → Gerar executáveis → Run workflow**. Os arquivos ficam em **Artifacts**, no fim da página da execução.

| Arquivo | Para |
|---|---|
| `Rumo-x.y.z-instalador-windows.exe` | Windows, instala com atalho no menu Iniciar |
| `Rumo-x.y.z-portatil-windows.exe` | Windows, roda sem instalar (bom para pendrive) |
| `Rumo-android.apk` | Android |
| `Rumo-x.y.z-mac-arm64.dmg` | macOS (Apple Silicon) |
| `Rumo-x.y.z-linux-x86_64.AppImage` | Linux |

### 4.4 Instalar
- **Windows:** o executável não tem certificado pago, então o SmartScreen avisa na primeira vez: **Mais informações → Executar assim mesmo**.
- **Android:** abra o `.apk` no celular (pelo navegador ou mandando para si mesmo) e permita **instalar apps desconhecidos** para o navegador/gerenciador de arquivos. Atualizar é instalar o `.apk` novo por cima; os dados ficam.
- **iPhone:** ative **Settings → Pages → Source: GitHub Actions** no repositório e rode **Actions → Publicar versão web** (também roda sozinho a cada tag `v*`). Abra `https://<seu-usuario>.github.io/app-valt/` no **Safari → Compartilhar → Adicionar à Tela de Início**. Precisa de internet para abrir; os dados ficam salvos no aparelho.
- **macOS:** como não é assinado pela Apple, depois de arrastar para Aplicativos rode uma vez no Terminal `xattr -cr /Applications/Rumo.app`.

Entre com **o mesmo e-mail e senha** no computador e no celular: é isso que liga os dois.

### 4.5 Fechar o cadastro (recomendado)
O repositório é público e a chave do app também; qualquer pessoa com o app poderia criar uma conta no **seu** banco (sem ver os seus dados). Depois de criar a sua conta (e a de quem mais for usar), desligue em **Authentication → Sign In / Providers → Allow new users to sign up**. O app mostra "Novos cadastros estão desligados" para quem tentar.

---

## 5. Arquitetura

```
 ┌──── Computador (Electron) ────┐   ┌──── Celular (Android / iPhone web) ────┐
 │ mesmo código React Native     │   │ Telas (React Native)                   │
 │ (versão web embutida no .exe) │   │ store.ts  banco local + outbox         │
 │ store.ts → localStorage       │   │ sync.ts   pull por seq, push em lotes  │
 └──────────────┬────────────────┘   └───────────────────┬────────────────────┘
                │ HTTPS (REST) + WebSocket (Realtime)    │
                ▼                                        ▼
        ┌────────────────────────── Supabase (grátis) ─────────────────────────┐
        │ Auth: e-mail e senha                                                 │
        │ Postgres: tabela records (RLS: cada usuário só vê o que é seu)       │
        │ push_ops(): "last writer wins" por registro + seq crescente          │
        │ Realtime: avisa os outros aparelhos quando records muda              │
        └──────────────────────────────────────────────────────────────────────┘
```

**Protocolo** (`app/src/data/sync.ts` e `supabase/schema.sql`):
1. Tudo é gravado primeiro no aparelho (a interface nunca espera a rede). Cada edição entra na **outbox**.
2. O app lê do banco tudo com `seq > lastSeq` (de 1000 em 1000) e envia a outbox em lotes de 200 pela função `push_ops`. Só sai da outbox o que foi confirmado e não foi editado de novo nesse meio-tempo.
3. **Conflito:** *last writer wins* por registro (timestamp, com `deviceId` como desempate, comparado byte a byte igual no app e no banco). Ao editar, o app usa `max(agora, versão atual + 1)`, então quem edita depois de ver a versão de outro aparelho sempre vence, mesmo com o relógio atrasado.
4. **Sem buracos:** `push_ops` serializa os lotes de cada usuário (advisory lock), então quem lê `seq > X` nunca pula uma mudança em andamento. A resposta do envio não avança o `lastSeq`; só a leitura avança.
5. **Tempo real:** o Supabase Realtime avisa quando uma linha do usuário muda e o app faz a leitura na hora. Por garantia, também lê a cada 60 s e ao voltar para o app.
6. **Rede ruim:** requisições com limite de 15 s; falhou, tenta de novo com backoff exponencial + jitter (1 s → 30 s); ao voltar do background sincroniza na hora e grava o estado local.

**Coleções sincronizadas:** `tasks`, `completions` (id `tarefa@data`), `settings` (`goals`, `profile`), `goals`, `goalLogs`.

---

## 6. Código-fonte

```
├── app/                          Expo SDK 58 + React Native (Android, iOS e web)
│   ├── App.tsx                   fontes, sessão, abas, botão "+" contextual, sheets
│   ├── app.json / app.config.js  config nativa; app.config.js só ajusta a subpasta da versão web
│   ├── public/                   index.html e manifest da versão web (instalável)
│   └── src/
│       ├── data/   store.ts (banco local + outbox) · sync.ts (Supabase) · session.ts (contas) · types.ts
│       ├── lib/    model.ts (pontos, marcos, etapa, rota, Bússola) · dates.ts · confirm.ts
│       ├── components/ · sheets/ · screens/
├── desktop/                      Electron: main.js abre app/dist pelo protocolo rumo://app
├── supabase/schema.sql           tabela, regras de acesso (RLS), push_ops e Realtime
├── supabase/test/                testes do schema num Postgres local (run.sh)
├── .github/workflows/            release.yml (exe/dmg/AppImage/apk) · pages.yml (web) · ci.yml (verificações)
└── docs/telas/                   screenshots
```

O servidor Node próprio da versão anterior (`server/`, `deploy/`) foi substituído pelo Supabase, que não precisa de computador ligado nem de domínio. Ele continua no histórico do git (commit `1fc33ac`).

---

## 7. Desenvolvimento

Pré-requisito: Node 22 ou mais novo. Crie `app/.env.local` (não vai para o git) com:
```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_...
```

```bash
# celular com Expo Go (mesma rede Wi-Fi) ou navegador
cd app && npm install && npx expo start

# computador (Electron) usando a versão web
cd desktop && npm install && npm run web && npm start

# executável local do seu sistema (Windows gera .exe, Mac .dmg, Linux .AppImage) em desktop/dist
cd desktop && npm run dist

# testes do banco (precisa de Postgres instalado: initdb, pg_ctl, psql)
bash supabase/test/run.sh
```

**EAS (opcional):** o `app/eas.json` continua valendo para gerar o APK ou o iOS pela nuvem do Expo. Para embutir o banco nesses builds, cadastre as variáveis com `npx eas-cli env:create` (nomes `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_KEY`).

---

## 8. Limitações e pontos a validar

- **Supabase Free:** 500 MB de banco (sobra para anos de uso pessoal). Um projeto **sem nenhum acesso por 7 dias** é pausado; os dados ficam guardados e basta clicar **Restore** no painel. Usar o app no dia a dia já conta como acesso.
- **Assinatura:** `.exe` e `.dmg` sem certificado pago (avisos na primeira abertura). O APK é assinado com a chave de debug do modelo do Expo: instala direto, mas não serve para a Play Store.
- **iPhone:** só pela versão web (sem notificações e precisa de internet para abrir). App nativo exige Apple Developer (US$ 99/ano) e `eas build -p ios`.
- **Sem atualização automática:** para atualizar, baixe e instale a versão nova da Release. Os dados não se perdem: ficam no aparelho e no banco.
- **Nome:** verificar disponibilidade de "Rumo" no INPI e nas lojas (ver nota na seção 1). Os ids `app.rumo.habitos` são provisórios.
- **Sem push:** lembretes no horário do passo seriam o próximo passo (`expo-notifications`).
- **Conflito por registro inteiro**, não por campo. Exclusões ficam como tombstones; recuperação de senha e exclusão de conta são feitas pelo painel do Supabase (Authentication → Users).
- **Verificado aqui:** testes do `schema.sql` (8 cenários: LWW, empate, tombstone, isolamento entre contas, validação, permissões, Realtime) num Postgres 16; `tsc` sem erros; versão web com dois "aparelhos" contra um Supabase simulado sobre o mesmo banco (tempo real em ~0,3 s, fila offline sobrevivendo a recarregar a página e entregue ao voltar a rede); app Electron empacotado (`.AppImage`) abrindo, criando conta, fechando e reabrindo logado com os dados; `expo prebuild` do Android.
- **Não verificado aqui:** o Supabase de verdade (o ambiente de desenvolvimento não tinha acesso a ele), celular físico e os builds de Windows/macOS/Android, que rodam no GitHub Actions.
