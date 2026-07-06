# Feature: Ingestão de Dados + Anti-Corruption Layer

## Objetivo

Buscar diariamente partidas já ocorridas de um provedor externo e persisti-las
como entidades de domínio próprias, sem que qualquer detalhe do provedor vaze
para o resto do sistema.

---

## Contexto de Negocio

A aplicação **não deve conhecer o provedor** (API-Football ou qualquer outro). Um
provedor pode ser trocado, ter esquema alterado ou usar IDs próprios — nada disso
pode contaminar o domínio. Toda entrada externa passa por um mapeador (ACL) que
traduz o payload para nossas entidades.

**Provedor do MVP:** [API-Football](https://www.api-football.com/documentation-v3)
(acesso **direto** via `dashboard.api-football.com`, não RapidAPI). Free tier:
100 req/dia, 10 req/min — suficiente para o batch diário. Endpoint `events` traz
cartões com `type: Card`, `detail` (Yellow/Second Yellow/Red), `time.elapsed` e
`player`; fixture traz o árbitro.

**Escopo do MVP:** apenas a **Copa do Mundo 2026**. As competições ingeridas são
**configuráveis** (lista de `external_ref` de competição) — adicionar eliminatórias,
amistosos ou uma liga de clubes depois é só configuração, sem mudança de código.

**Fora do escopo:** dados ao vivo/streaming; múltiplos provedores simultâneos
(a arquitetura permite, mas o MVP usa um só).

### Estratégia de duas etapas (landing zone)

1. **Land (cru):** o payload do provedor é gravado **como veio** em
   `raw_provider_payloads` (coluna `jsonb`). Nunca é descartado.
2. **Map (curado):** um segundo passo lê o cru e o traduz para as tabelas de
   domínio normalizadas.

**Por que:** a cota grátis é limitada. Se a lógica de mapeamento mudar (ex.: nova
regra de ponderação), reprocessamos a partir do `jsonb` **sem gastar requisições**
no provedor. O cru também é histórico imutável e resiliência a mudanças de schema.
Optou-se por `jsonb` no Postgres (não um MongoDB separado) para manter um único
banco no MVP.

---

## Arquitetura: Contrato de Provedor de Estatísticas

O domínio depende apenas de uma interface. Cada provedor é uma implementação que
retorna **modelos de domínio já traduzidos** — nunca o payload cru.

```
IMatchStatsProvider (contrato)
    └── ApiFootballProvider   (implementação atual)
    └── FutureProvider        (implementação futura)
```

```typescript
// modules/ingestion/contracts/match-stats-provider.ts

interface RawProviderMatch {
  // Já é o modelo de DOMÍNIO traduzido pela implementação do provedor.
  // Nenhum campo com formato/ID do provedor aparece aqui.
  externalRef: string;          // id do provedor, guardado só para idempotência
  competitionExternalRef: string;
  season: string;
  kickoffAt: Date;
  status: 'finished' | 'scheduled' | 'in_progress';
  homeTeam: ProviderTeam;
  awayTeam: ProviderTeam;
  refereeName: string | null;
  events: ProviderEvent[];
}

interface ProviderEvent {
  type: EventType;              // enum de domínio, NUNCA o número do provedor
  minute: number | null;
  teamExternalRef: string;
  playerExternalRef: string | null;
  playerName: string | null;
}

interface IMatchStatsProvider {
  // Busca partidas atualizadas até o momento (janela padrão: dia atual).
  fetchMatches(params: {
    competitionExternalRef?: string;
    since?: Date;
  }): Promise<RawProviderMatch[]>;
}
```

### Responsabilidades da camada

- **Provider (infra):** fala HTTP com a API externa, **grava o payload cru** em
  `raw_provider_payloads` (jsonb) e **traduz** o JSON para `RawProviderMatch`. É o
  único lugar que conhece o formato do provedor (ex.: que `detail: "Yellow Card"`
  significa cartão amarelo). Faz o de-para provedor → `EventType`.
- **Mapper / UseCase (application):** recebe `RawProviderMatch` (do provider ou
  reprocessado do cru), resolve/insere competição, times, jogadores, árbitro e
  partida via `external_ref`, e faz *upsert* idempotente dos eventos.
- **Repositories (infra):** persistência isolada.

---

## Processamento Assincrono (Job diário)

- Um **cron diário** dispara o UseCase de sincronização (1 request/dia no MVP).
  Agendamento via `@nestjs/schedule` (wrapper idiomático do Nest) ou `node-schedule`.
- Pode evoluir para fila (produtor agenda, consumidor processa por competição).
- **Idempotência obrigatória:** re-buscar uma partida já salva não pode duplicar
  eventos. Chave: `external_ref` + constraint única.

### Evento (fase 2, se virar fila)

- `MATCH_SYNC_REQUESTED`

---

## Fluxo

### Step 1 — Land (gravar o cru)

```
1. Cron dispara SyncMatchesUseCase (competições configuradas).
2. UseCase chama IMatchStatsProvider.fetchMatches().
3. Provider busca na API externa (fixtures + events + lineups por jogo).
4. Provider grava cada payload em raw_provider_payloads (jsonb, por external_ref).
5. Provider TRADUZ o payload para RawProviderMatch[] (eventos de cartão +
   APPEARANCE) e retorna.
```

### Step 2 — Map (curar para o domínio)

```
1. Para cada RawProviderMatch:
   a. upsert competition (por external_ref)
   b. upsert home/away teams (por external_ref)
   c. upsert referee (por nome normalizado)
   d. upsert match (por external_ref)
   e. se match.status = finished: substitui/insere match_events (idempotente)
2. UseCase retorna resumo (partidas novas, atualizadas, eventos inseridos).
```

> **Reprocessamento:** o mesmo Step 2 pode rodar a partir de `raw_provider_payloads`
> (sem chamar o provedor) quando a lógica de mapeamento mudar — não gasta cota.

### De-para de tipo de evento (dentro do provider)

Armazenamento **fiel ao fato**: 1 cartão real = 1 evento, com seu tipo verdadeiro.
Nenhuma ponderação é gravada no banco (a regra "vermelho = 2" vive na análise).

```
Yellow Card        → YELLOW_CARD    (category: yellow)
Red Card (direto)  → RED_CARD       (category: red)
Second Yellow card → SECOND_YELLOW  (category: yellow; também é expulsão)
```

Tipo desconhecido é logado e ignorado (não quebra a sync).

### Escalação como evento (`APPEARANCE`)

A escalação é ingerida do endpoint `fixtures/lineups` (request adicional por jogo)
e mapeada como **um evento por jogador que atuou**:

```
Titular / entrou em campo → APPEARANCE (category: appearance)
  match_id, team_id, player_id obrigatórios; minute = 0 (titular) ou minuto de entrada
```

- Fica na **mesma** `match_events` — resolve o denominador "jogos em que o jogador
  atuou" sem tabela nova.
- `category: appearance` isola do cálculo de cartões (as métricas de cartão só
  contam `category IN (yellow, red)`).
- O provider inclui esses eventos no mesmo array `events` do `RawProviderMatch`.

---

## Modelo de Dados

> **Escopo:** plataforma B2C, **sem multi-tenant**. As tabelas abaixo são dados de
> futebol **globais/compartilhados** (sem `user_id`, sem `tenant_id`) — iguais para
> todos os usuários. Só dados criados pelo usuário (apostas, alertas) seriam
> escopados por `user_id`, em spec futura.
> `external_ref` guarda o id do provedor **apenas para idempotência/sync**, nunca
> é exposto na API pública.

### `raw_provider_payloads` (landing zone — payload cru)

| Coluna         | Tipo           | Obrigatorio | Padrao              | Descricao                                  |
| -------------- | -------------- | ----------- | ------------------- | ------------------------------------------ |
| `id`           | `uuid`         | ✅          | `gen_random_uuid()` | Identificador único                        |
| `provider`     | `varchar(40)`  | ✅          | —                   | Ex.: `api-football`                        |
| `resource`     | `varchar(40)`  | ✅          | —                   | Ex.: `fixture`, `events`, `lineups`        |
| `external_ref` | `varchar(100)` | ✅          | —                   | ID do recurso no provedor                  |
| `payload`      | `jsonb`        | ✅          | —                   | Corpo cru, exatamente como veio            |
| `fetched_at`   | `timestamp`    | ✅          | `now()`             | Quando foi buscado                         |
| `processed_at` | `timestamp`    | ❌          | `null`              | Quando foi mapeado para o domínio          |
| `created_at`   | `timestamp`    | ✅          | `now()`             | —                                          |

> Nunca é descartado. É a fonte para reprocessar o domínio sem gastar cota do provedor.

### `competitions`

| Coluna         | Tipo           | Obrigatorio | Padrao              | Descricao                          |
| -------------- | -------------- | ----------- | ------------------- | ---------------------------------- |
| `id`           | `uuid`         | ✅          | `gen_random_uuid()` | Identificador único                |
| `external_ref` | `varchar(100)` | ✅          | —                   | ID no provedor (idempotência)      |
| `name`         | `varchar(150)` | ✅          | —                   | Ex.: "Copa do Mundo 2026"          |
| `season`       | `varchar(20)`  | ✅          | —                   | Ex.: "2026"                        |
| `created_at`   | `timestamp`    | ✅          | `now()`             | —                                  |
| `updated_at`   | `timestamp`    | ✅          | `now()`             | —                                  |

### `teams`

| Coluna         | Tipo           | Obrigatorio | Padrao              | Descricao                     |
| -------------- | -------------- | ----------- | ------------------- | ----------------------------- |
| `id`           | `uuid`         | ✅          | `gen_random_uuid()` | Identificador único           |
| `external_ref` | `varchar(100)` | ✅          | —                   | ID no provedor                |
| `name`         | `varchar(150)` | ✅          | —                   | Nome do time                  |
| `country`      | `varchar(80)`  | ❌          | `null`              | País/seleção                  |
| `created_at`   | `timestamp`    | ✅          | `now()`             | —                             |
| `updated_at`   | `timestamp`    | ✅          | `now()`             | —                             |

### `players`

| Coluna         | Tipo           | Obrigatorio | Padrao              | Descricao           |
| -------------- | -------------- | ----------- | ------------------- | ------------------- |
| `id`           | `uuid`         | ✅          | `gen_random_uuid()` | Identificador único |
| `external_ref` | `varchar(100)` | ✅          | —                   | ID no provedor      |
| `name`         | `varchar(150)` | ✅          | —                   | Nome do jogador     |
| `created_at`   | `timestamp`    | ✅          | `now()`             | —                   |
| `updated_at`   | `timestamp`    | ✅          | `now()`             | —                   |

### `player_teams` (vínculo com janela temporal)

| Coluna       | Tipo          | Obrigatorio | Padrao              | Descricao                          |
| ------------ | ------------- | ----------- | ------------------- | ---------------------------------- |
| `id`         | `uuid`        | ✅          | `gen_random_uuid()` | Identificador único                |
| `player_id`  | `uuid`        | ✅          | —                   | FK players                         |
| `team_id`    | `uuid`        | ✅          | —                   | FK teams                           |
| `season`     | `varchar(20)` | ✅          | —                   | Temporada do vínculo               |
| `start_date` | `date`        | ❌          | `null`             | Início do vínculo (transferências) |
| `end_date`   | `date`        | ❌          | `null`             | Fim do vínculo                     |
| `created_at` | `timestamp`   | ✅          | `now()`             | —                                  |
| `updated_at` | `timestamp`   | ✅          | `now()`             | —                                  |

### `referees`

| Coluna       | Tipo           | Obrigatorio | Padrao              | Descricao           |
| ------------ | -------------- | ----------- | ------------------- | ------------------- |
| `id`         | `uuid`         | ✅          | `gen_random_uuid()` | Identificador único |
| `name`       | `varchar(150)` | ✅          | —                   | Nome do árbitro     |
| `created_at` | `timestamp`    | ✅          | `now()`             | —                   |
| `updated_at` | `timestamp`    | ✅          | `now()`             | —                   |

### `matches`

| Coluna           | Tipo           | Obrigatorio | Padrao              | Descricao                                  |
| ---------------- | -------------- | ----------- | ------------------- | ------------------------------------------ |
| `id`             | `uuid`         | ✅          | `gen_random_uuid()` | Identificador único                        |
| `external_ref`   | `varchar(100)` | ✅          | —                   | ID no provedor (idempotência)              |
| `competition_id` | `uuid`         | ✅          | —                   | FK competitions                            |
| `home_team_id`   | `uuid`         | ✅          | —                   | FK teams                                   |
| `away_team_id`   | `uuid`         | ✅          | —                   | FK teams                                   |
| `referee_id`     | `uuid`         | ❌          | `null`              | FK referees (fator nº1 p/ cartões)         |
| `season`         | `varchar(20)`  | ✅          | —                   | Temporada                                  |
| `kickoff_at`     | `timestamp`    | ✅          | —                   | Data/hora do jogo                          |
| `status`         | `int`          | ✅          | `0`                 | `0` scheduled, `1` in_progress, `2` finished |
| `created_at`     | `timestamp`    | ✅          | `now()`             | —                                          |
| `updated_at`     | `timestamp`    | ✅          | `now()`             | —                                          |

### `event_types` (catálogo — extensibilidade)

| Coluna       | Tipo          | Obrigatorio | Padrao              | Descricao                              |
| ------------ | ------------- | ----------- | ------------------- | -------------------------------------- |
| `id`         | `uuid`        | ✅          | `gen_random_uuid()` | Identificador único                    |
| `code`       | `varchar(40)` | ✅          | —                   | `YELLOW_CARD`, `RED_CARD`, `CORNER`…   |
| `category`   | `varchar(40)` | ✅          | —                   | `yellow`, `red`, `goal`, `corner`…     |
| `created_at` | `timestamp`   | ✅          | `now()`             | —                                      |

> **Catálogo fiel — sem `weight`.** `event_types` só descreve o que o evento é.
> A ponderação (ex.: "1 vermelho = 2 amarelos") **não vive aqui** — é regra de
> negócio da camada de análise (ver `02-analysis-engine.md`). Assim a mesma base
> serve várias métricas (total, amarelos, vermelhos, base ponderada) sem
> recontagem nem dado pré-multiplicado.

### `match_events` (evento atômico — 1 ocorrência por linha)

| Coluna          | Tipo        | Obrigatorio | Padrao              | Descricao                          |
| --------------- | ----------- | ----------- | ------------------- | ---------------------------------- |
| `id`            | `uuid`      | ✅          | `gen_random_uuid()` | Identificador único                |
| `match_id`      | `uuid`      | ✅          | —                   | FK matches                         |
| `event_type_id` | `uuid`      | ✅          | —                   | FK event_types                     |
| `team_id`       | `uuid`      | ✅          | —                   | FK teams (quem sofreu/gerou)       |
| `player_id`     | `uuid`      | ❌          | `null`              | FK players (pode faltar)           |
| `minute`        | `int`       | ❌          | `null`              | Minuto da ocorrência               |
| `created_at`    | `timestamp` | ✅          | `now()`             | —                                  |

> Sem `amount`: cada cartão/escanteio/gol é uma linha, com seu tipo verdadeiro
> (`RED_CARD` = 1 linha, nunca "2 cartões"). As métricas — total, por categoria,
> ou base ponderada — são derivadas por `COUNT`/agregação na camada de análise.

### Constraints e Índices (idempotência)

| Nome                          | Tipo     | Colunas                          |
| ----------------------------- | -------- | -------------------------------- |
| `competitions_external_uq`    | `UNIQUE` | `external_ref`                   |
| `teams_external_uq`           | `UNIQUE` | `external_ref`                   |
| `players_external_uq`         | `UNIQUE` | `external_ref`                   |
| `matches_external_uq`         | `UNIQUE` | `external_ref`                   |
| `event_types_code_uq`         | `UNIQUE` | `code`                           |
| `raw_payloads_ref_uq`         | `UNIQUE` | `provider, resource, external_ref` |
| `idx_raw_payloads_unprocessed`| `INDEX`  | `processed_at` (WHERE `null`)    |
| `idx_match_events_match`      | `INDEX`  | `match_id, event_type_id`        |
| `idx_match_events_team`       | `INDEX`  | `team_id, event_type_id`         |
| `idx_match_events_player`     | `INDEX`  | `player_id, event_type_id`       |
| `idx_matches_competition`     | `INDEX`  | `competition_id, season, status` |

---

## Regras de Negocio

### Ingestão

- Nenhum ID/código/formato do provedor pode aparecer fora do módulo `ingestion`.
- `type` do provedor é traduzido para `event_types.code` **dentro do provider**.
- Tipo de evento desconhecido: logar e ignorar, sem quebrar a sync.
- Sync é idempotente: reprocessar a mesma partida não duplica eventos
  (re-substituir eventos da partida por `match_id`).
- Só partidas com `status = finished` têm eventos consolidados persistidos.
- **Armazenamento fiel:** cada cartão é gravado com seu tipo verdadeiro
  (`YELLOW_CARD`, `RED_CARD`, `SECOND_YELLOW`). Nenhuma ponderação é gravada — a
  base é fiel ao que aconteceu em campo.
- **2º amarelo:** gravado como `SECOND_YELLOW` (é um amarelo que também expulsa).
  Como **contar** é decisão da camada de análise, não do banco:
  amarelos = `YELLOW_CARD` + `SECOND_YELLOW`; expulsões = `RED_CARD` +
  `SECOND_YELLOW`; base ponderada = amarelo(1) + 2º amarelo(1) + vermelho direto(2)
  — respeita "1 vermelho = 2 amarelos" sem contar dobrado.
- O payload cru é gravado em `raw_provider_payloads` **antes** do mapeamento; o
  mapeamento marca `processed_at`. Reprocessar lê do cru, sem chamar o provedor.

### Escopo (B2C, sem multi-tenant)

- Tabelas desta spec são **globais** — sem `tenant_id` e sem `user_id`.
- Dados do usuário (apostas/alertas, spec futura) escopam por `user_id` e
  **referenciam** estes dados globais por FK, sem duplicá-los.

---

## Criterios de Aceite

- Rodar a sync duas vezes seguidas não gera eventos nem partidas duplicadas.
- Trocar a implementação de `IMatchStatsProvider` não exige mudança em use-cases,
  entidades ou API.
- Adicionar um novo tipo de evento (ex.: `CORNER`) não exige alterar a engine —
  apenas nova linha em `event_types` e o de-para no provider.
- Nenhuma resposta da API pública expõe `external_ref`.

---

## Erros Esperados

| Codigo                   | Situacao                                          |
| ------------------------ | ------------------------------------------------- |
| `PROVIDER_UNAVAILABLE`   | API externa fora do ar ou timeout                 |
| `PROVIDER_RATE_LIMITED`  | Limite de requisições do plano gratuito atingido  |
| `UNMAPPED_EVENT_TYPE`    | Tipo do provedor sem de-para (logado, não fatal)  |
| `VALIDATION_ERROR`       | Payload externo fora do shape esperado            |
