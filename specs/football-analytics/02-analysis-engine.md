# Feature: Camada de Análise (Histórico + Summary preditivo)

## Objetivo

Derivar, a partir dos `match_events` fiéis, as métricas estatísticas que dão
clareza ao apostador: distribuição de eventos por jogo, probabilidade acumulada
(CDF), incerteza (Wilson) e valor esperado (EV) contra a odd. Expõe dois tipos de
consulta: **histórico** (descritivo) e **summary** (preditivo por partida).

---

## Contexto de Negocio

São **dois problemas diferentes**, servidos por endpoints diferentes:

1. **Histórico (descritivo)** — "o que já aconteceu". Filtro flexível (time,
   jogador, árbitro, competição). Alimenta páginas de detalhe. A distribuição por
   jogo só é significativa quando o filtro abrange **vários jogos**.

2. **Summary (preditivo)** — "o que tende a acontecer nesta partida". Requer
   `matchId`. Não lê os eventos da partida-alvo (que é futura); resolve os **dois
   times** e projeta o jogo a partir do histórico de cada um. Alimenta a página de
   análise futura.

O summary **reutiliza** o motor do histórico — não duplica lógica.

**Fora do escopo (Fase 2):** modelo paramétrico (Poisson/Binomial Negativa);
ajuste por contexto (mando, adversário); captura automática de odds.

---

## As 4 métricas de cartão (regra de negócio na análise)

A base é fiel (`YELLOW_CARD`, `RED_CARD`, `SECOND_YELLOW`). As métricas são
**derivadas por contagem**, não gravadas. Contagem por jogo:

| Métrica        | Definição                                             |
| -------------- | ----------------------------------------------------- |
| `totalCards`   | `YELLOW_CARD` + `RED_CARD` + `SECOND_YELLOW` (bruto)  |
| `yellowCards`  | `YELLOW_CARD` + `SECOND_YELLOW` (2º amarelo é amarelo) |
| `redCards`     | `RED_CARD` + `SECOND_YELLOW` (expulsões)              |
| `weighted`     | `1·YELLOW` + `1·SECOND_YELLOW` + `2·RED_CARD`         |

> `weighted` implementa a regra do usuário ("1 vermelho = 2 amarelos") sem contar
> dobrado: o 2º amarelo vale 1 e, somado ao 1º, dá os 2 pontos de uma expulsão;
> o vermelho **direto** vale 2 sem amarelo prévio.

> **Ponderação configurável:** os pesos vivem num *scoring profile* da camada de
> análise (não no banco). Trocar a regra ou adicionar mercados (escanteios, gols)
> = nova definição de métrica, sem tocar na engine estatística.

---

## Arquitetura

Separação por **responsabilidade**, não por tipo de cartão (evita 3 cópias da
mesma matemática).

```
Controller
  └─ GetHistoryUseCase / GetMatchSummaryUseCase   (orquestram)
       ├─ MetricService        → eventos filtrados → série de contagens por jogo
       │                          (aplica a regra de negócio de cada métrica)
       ├─ DistributionService  → série de contagens → { distribution, cdf, mean, wilson }
       │                          (engine estatística ÚNICA, reutilizável)
       └─ ValueService         → cdf + threshold + odd → { ev, impliedProb, edge }
            └─ MatchEventRepository / MatchRepository
```

### Contrato da engine estatística

```typescript
// modules/analytics/contracts/distribution.ts

interface Distribution {
  sampleSize: number;                 // nº de JOGOS na amostra (inclui zeros)
  perGame: Record<number, number>;    // contagem -> frequência de jogos
  mean: number;
  cdf: CdfPoint[];                    // acumulado com incerteza
}

interface CdfPoint {
  value: number;      // limite k
  pUnder: number;     // P(count < k)  (empírico)
  wilsonLow: number;  // limite inferior do IC de Wilson (95%)
  wilsonHigh: number; // limite superior
}

interface IDistributionService {
  // Recebe a contagem por jogo já resolvida pela MetricService.
  compute(countsPerGame: number[]): Distribution;
}
```

---

## Definições estatísticas

### Distribuição por jogo — o denominador correto

> **Regra crítica:** o denominador é o **nº de jogos disputados**, obtido da tabela
> `matches` (`home_team_id`/`away_team_id`, `referee_id`, etc.), **não** o nº de
> jogos com evento. Jogos com **zero** cartões não aparecem em `match_events` e
> precisam entrar na amostra como `0`. Ignorar isso infla a média e apaga os
> jogos "limpos" (no exemplo do usuário, 6 de 10 jogos eram zero).

Implementação: `LEFT JOIN` dos jogos do filtro com os eventos; jogos sem evento
contam `0`.

### CDF empírica

Para um limite `k`: `pUnder(k) = (nº de jogos com count < k) / sampleSize`.

### Intervalo de Wilson (95%, z = 1.96)

Para a proporção `p̂ = x/n` de cada ponto da CDF:

```
center = (p̂ + z²/2n) / (1 + z²/n)
margin = z/(1 + z²/n) · sqrt( p̂(1-p̂)/n + z²/4n² )
[low, high] = [center - margin, center + margin]   (clamp em [0,1])
```

Expõe a incerteza da amostra pequena — essencial no MVP (Copa 2026 tem 3–7 jogos
por seleção). Um "90%" com n=5 tem IC largo; o front deve mostrar isso.

### Valor esperado (EV) — quando `threshold` e `odd` são informados

```
p            = pUnder(threshold)      (ou 1 - pUnder para mercado "over")
impliedProb  = 1 / odd
edge         = p - impliedProb
EV           = p · odd - 1            (> 0 = aposta de valor)
```

A odd é informada manualmente (MVP). Sem `odd`, retorna só a CDF.

### Combinação dos dois times (summary) — convolução empírica

Para o **total da partida** (soma dos dois times), convolui-se as duas
distribuições empíricas `perGame` assumindo **independência**:

```
P(total = s) = Σ_{a+b=s} P(timeA = a) · P(timeB = b)
```

> **Caveat (documentar no produto):** assume que os cartões dos dois times são
> independentes — aproximação de Fase 1. Fase 2 refina com modelo condicionado
> ao contexto (mando, adversário, árbitro).

O summary retorna **ambos**: cada time separado **e** o total combinado.

---

## Endpoints

| Metodo | Rota                                | Descricao                          |
| ------ | ----------------------------------- | ---------------------------------- |
| `GET`  | `/api/v1/analytics/history`         | Histórico descritivo (filtro flex) |
| `GET`  | `/api/v1/matches/:matchId/summary`  | Análise preditiva da partida       |

Ambos exigem autenticação (login). Leem dados de futebol **globais** — sem escopo
por usuário (plataforma B2C, sem multi-tenant).

### `GET /analytics/history` — parâmetros

| Parametro       | Tipo   | Obrigatorio | Descricao                              |
| --------------- | ------ | ----------- | -------------------------------------- |
| `teamId`        | `uuid` | Não         | Filtra por time                        |
| `playerId`      | `uuid` | Não         | Filtra por jogador (ver caveat abaixo) |
| `refereeId`     | `uuid` | Não         | Filtra por árbitro                     |
| `competitionId` | `uuid` | Não         | Filtra por competição                  |
| `eventType`     | `enum` | Não         | Restringe a um tipo (senão, todas as métricas) |

Pelo menos um filtro que abranja múltiplos jogos é recomendado para a
distribuição fazer sentido.

> **Jogador — denominador via APPEARANCE:** a distribuição *por jogo* de um jogador
> usa como denominador os jogos em que ele **atuou** — ou seja, jogos com um evento
> `APPEARANCE` dele (ingeridos de `fixtures/lineups`, ver `01`). Assim a média do
> jogador não é diluída por jogos que ele não disputou.

---

## Resposta — `GET /analytics/history`

```jsonc
{
  "filter": { "teamId": "..." },
  "sampleSize": 7,                       // jogos na amostra (inclui zeros)
  "metrics": {
    "totalCards": {
      "perGame": { "0": 2, "1": 3, "2": 1, "4": 1 },
      "mean": 1.43,
      "cdf": [
        { "value": 2, "pUnder": 0.71, "wilsonLow": 0.36, "wilsonHigh": 0.92 },
        { "value": 4, "pUnder": 0.86, "wilsonLow": 0.49, "wilsonHigh": 0.97 }
      ]
    },
    "yellowCards": { /* mesma forma */ },
    "redCards":    { /* mesma forma */ },
    "weighted":    { /* mesma forma */ }
  }
}
```

## Resposta — `GET /matches/:matchId/summary`

```jsonc
{
  "match": { "id": "...", "homeTeamId": "...", "awayTeamId": "...", "kickoffAt": "..." },
  "home":  { "teamId": "...", "sampleSize": 5, "metrics": { /* como acima */ } },
  "away":  { "teamId": "...", "sampleSize": 6, "metrics": { /* como acima */ } },
  "matchTotal": {                        // convolução empírica dos dois times
    "metrics": {
      "totalCards": { "perGame": { /* dist combinada */ }, "mean": 3.1, "cdf": [ /* ... */ ] },
      "weighted":   { /* ... */ }
    },
    "assumesIndependence": true          // caveat explícito no payload
  }
}
```

Com `?threshold=4&odd=1.20`, cada bloco de métrica ganha:
`"value": { "ev": 0.08, "impliedProb": 0.83, "edge": 0.07 }`.

---

## Regras de Negocio

- **Denominador = jogos disputados**, incluindo jogos com zero cartões. Nunca
  contar só jogos com evento de cartão. Origem do denominador: time/árbitro/
  competição → tabela `matches`; jogador → jogos com evento `APPEARANCE` dele.
- Métricas são derivadas por contagem — nada de peso gravado no banco.
- `sampleSize` sempre presente; o front deve sinalizar amostra pequena.
- Wilson calculado por ponto de CDF; valores clampados em `[0, 1]`.
- `matchTotal` só quando ambos os times têm histórico ≥ 1 jogo; senão, retorna
  `home`/`away` e `matchTotal: null`.
- `summary` reutiliza `DistributionService` (mesma engine do histórico).

---

## Criterios de Aceite

- Um time com jogos "zero" tem esses jogos na amostra (média não infla).
- Trocar de métrica (total/yellow/red/weighted) não cria código estatístico novo.
- Adicionar um mercado novo (ex.: escanteios) = nova definição de métrica; a
  `DistributionService` não muda.
- `summary` de uma partida futura funciona sem a partida ter eventos.
- CDF acompanha intervalo de Wilson em todos os pontos.
- Nenhuma resposta expõe `external_ref`.

---

## Erros Esperados

| Codigo               | Situacao                                             |
| -------------------- | ---------------------------------------------------- |
| `MATCH_NOT_FOUND`    | `matchId` inexistente no summary                     |
| `INSUFFICIENT_DATA`  | Filtro sem jogos suficientes p/ distribuição         |
| `INVALID_FILTER`     | Nenhum filtro válido ou combinação impossível        |
| `VALIDATION_ERROR`   | `threshold`/`odd` inválidos                          |
