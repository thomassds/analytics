# Feature: Modo Ao Vivo (In-Play)

## Objetivo

Acompanhar partidas **em andamento** em quase-tempo-real: placar, minuto e
eventos (gols, cartões, substituições) atualizando conforme acontecem — o
terceiro estado da partida, ao lado de "agendada → probabilidades" e
"encerrada → histórico".

> **Requer plano PAGO do API-Football.** No free tier a temporada corrente (2026)
> não é acessível e a cota (100/dia) não sustenta polling. Ver
> [`01-data-ingestion-acl.md`](01-data-ingestion-acl.md).

---

## Contexto de Negocio

O `status` da partida decide a experiência:

| Status | Página | Fonte |
| --- | --- | --- |
| `scheduled` (0) | Probabilidades | histórico dos 2 times (`/summary`) |
| `in_progress` (1) | **Ao vivo** 🔴 | poller de eventos ao vivo (esta spec) |
| `finished` (2) | Histórico | eventos consolidados (`/matches/:id`) |

### Nuance crítica: polling, não push

O API-Football é **REST com polling** — **não há websocket** que empurra eventos.
A gente **consulta** e recebe o estado atual, atualizado a cada **~15 segundos**
do lado do provedor. Recomendação do provedor: enquanto houver jogo em andamento,
chamar **1×/minuto**; sem jogo, 1×/dia.

Consequência: "tempo real" aqui é **granularidade de ~15s**. Suficiente para
placar/timeline ao vivo; **não** é sub-segundo (não serve para execução de aposta
no nível do segundo — documentar no produto).

**Fora do escopo:** sub-segundo; execução de apostas ao vivo; vídeo/comentários.

---

## Arquitetura

Reusa **toda** a base já construída (ACL, landing zone `jsonb`, mapper, modelo de
eventos). Duas peças novas: um **poller** (ingestão ao vivo) e um **canal de push
ao browser** (SSE).

```
API-Football (live)                     Browser
      │ poll 15–60s                        ▲ SSE (push)
      ▼                                     │
LivePoller (worker) ──► mapper/ACL ──► Postgres ──► LiveController (SSE)
      (só enquanto há jogo ao vivo)     (mesmo schema)
```

### 1. Provider — novo método no contrato

```typescript
// modules/football/ingestion/provider/match-stats-provider.ts

interface IMatchStatsProvider {
  fetchMatches(params: FetchMatchesParams): Promise<RawProviderMatch[]>;
  // NOVO: partidas em andamento (fixtures?live=all) + seus eventos, já traduzidas.
  fetchLiveMatches(): Promise<RawProviderMatch[]>;
}
```

`ApiFootballProvider.fetchLiveMatches()`:
- `GET /fixtures?live=all` → **1 chamada** retorna TODAS as partidas ao vivo.
- Para cada partida ao vivo relevante (competições configuradas): `GET /fixtures/events?fixture=X`.
- Grava o cru em `raw_provider_payloads` (resource `live` / `events`) e traduz —
  **mesmo mapper de cartões/gols/APPEARANCE** já existente.

### 2. LivePoller (worker agendado)

```
Loop (enquanto habilitado):
  1. fetchLiveMatches()
  2. Se não há jogo ao vivo → dorme (ex.: 5 min) e volta.
  3. Para cada jogo ao vivo:
     a. upsert match com status = in_progress (+ elapsed, live score).
     b. replaceMatchEvents(matchId, eventos)  ← idempotente (mesma regra do batch).
     c. emite evento interno "MATCH_UPDATED { matchId }".
  4. Detecta transição para finished → última sync completa + marca finished.
  5. Dorme ~15–60s e repete.
```

- Cadência **adaptativa**: 15–30s com jogo ao vivo; ocioso (minutos) sem jogo.
- Gate por env `LIVE_POLLING_ENABLED` (não gastar cota sem querer).
- Idempotência já garantida: `replaceMatchEvents` substitui por `match_id`.

### 3. Push ao browser — SSE (recomendado)

```
GET /api/v1/matches/:id/live   (Server-Sent Events)
  → stream de snapshots do detalhe da partida a cada atualização.
```

- **SSE** (não WebSocket): unidirecional servidor→cliente, simples, reconecta
  sozinho, ideal para "placar que atualiza". O front abre o stream ao entrar na
  página de um jogo ao vivo.
- **Alternativa simples (fallback):** o front faz *polling* do
  `GET /matches/:id` a cada ~15s. Funciona sem SSE; mais requests, menos elegante.
- O `LivePoller` publica `MATCH_UPDATED` (evento interno / RabbitMQ); o
  `LiveController` assina e empurra o snapshot novo pelos streams SSE abertos
  daquele `matchId`.

---

## Modelo de Dados

Mínimo — o `status` já existe. Campos **opcionais** para o ao vivo (evitam
recalcular placar/minuto a cada request):

### Alterações em `matches` (opcionais)

| Coluna         | Tipo   | Obrigatorio | Padrao | Descricao                          |
| -------------- | ------ | ----------- | ------ | ---------------------------------- |
| `elapsed`      | `int`  | ❌          | `null` | Minuto atual (partida ao vivo)     |
| `home_score`   | `int`  | ❌          | `null` | Placar mandante (ao vivo/final)    |
| `away_score`   | `int`  | ❌          | `null` | Placar visitante (ao vivo/final)   |

> Alternativa sem novas colunas: derivar placar dos eventos `GOAL` (como o
> `GetMatchDetailUseCase` já faz) e `elapsed` do provedor a cada snapshot.
> Recomendado guardar para leitura rápida e para o card da listagem.

`raw_provider_payloads.resource` ganha valor `live` (o `fixtures?live=all`).

---

## Endpoints

| Metodo | Rota                              | Descricao                                  |
| ------ | --------------------------------- | ------------------------------------------ |
| `GET`  | `/api/v1/matches/live`            | Lista partidas em andamento agora          |
| `GET`  | `/api/v1/matches/:id/live`        | **SSE**: snapshots do detalhe ao vivo      |
| `GET`  | `/api/v1/matches/:id`             | Detalhe (já existe) — usado como fallback  |

Leitura pública (dados de futebol), como o resto do catálogo.

---

## Regras de Negocio

- **Reuso total do mapper:** eventos ao vivo passam pela mesma tradução e pelo
  mesmo `replaceMatchEvents` — sem código de ingestão duplicado.
- **Idempotência:** re-poll da mesma partida não duplica eventos (substitui por
  `match_id`). Um gol que "some" numa correção do provedor é refletido no próximo
  snapshot.
- **Transições de status:** `scheduled → in_progress → finished`. Ao virar
  `finished`, o poller faz uma sync final (com lineups) e para de acompanhar o jogo.
- **Cadência adaptativa + gate:** só faz polling frequente com jogo ao vivo e com
  `LIVE_POLLING_ENABLED=true`. Respeita o limite do plano pago.
- **Custo:** `fixtures?live=all` = 1 chamada para todas as partidas ao vivo; os
  eventos custam 1 chamada por jogo ao vivo. Dimensionar cadência ao plano.

---

## Frontend

- **Listagem:** partidas `in_progress` mostram badge **"Ao vivo"** (verde,
  pulsante) e o placar corrente.
- **Página da partida (3º estado):** abre o stream SSE; timeline de eventos
  cresce em tempo quase-real; placar e minuto atualizando. Cartões/gols aparecem
  conforme entram. Sem jargão — "Gol! · 62' · Saka".
- **Fallback:** se SSE indisponível, front faz polling de `/matches/:id` a cada 15s.

---

## Criterios de Aceite

- Com `LIVE_POLLING_ENABLED=true` e plano pago, uma partida ao vivo aparece com
  status `in_progress` e eventos atualizando em ≤ ~30s do ocorrido.
- Reprocessar/re-poll não duplica eventos.
- Ao final da partida, status vira `finished` e a página passa a mostrar o
  histórico consolidado (mesma página, outro estado).
- Nenhuma chamada ao vivo é feita sem jogo em andamento (cadência ociosa).
- Nada de novo no mapper: gols/cartões ao vivo usam o de-para já existente.

---

## Erros Esperados

| Codigo                   | Situacao                                          |
| ------------------------ | ------------------------------------------------- |
| `PROVIDER_RATE_LIMITED`  | Cadência de polling acima do plano (429)          |
| `LIVE_DISABLED`          | `LIVE_POLLING_ENABLED != true`                    |
| `MATCH_NOT_LIVE`         | SSE aberto para partida que não está `in_progress` |
| `MATCH_NOT_FOUND`        | `matchId` inexistente                             |

---

## Dependência

Bloqueado até a conta ter **plano pago** do API-Football (acesso à temporada
corrente + cota para polling). Todo o resto (ACL, landing zone, modelo de eventos,
campo `status`, página de detalhe) já está pronto e é reusado por esta feature.
