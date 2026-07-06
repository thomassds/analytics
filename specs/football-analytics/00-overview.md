# Fluxo: Football Analytics — Visão Geral (MVP)

## Objetivo

Fornecer clareza matemática sobre padrões estatísticos de partidas de futebol
(começando por cartões) para que apostadores identifiquem apostas de **valor
esperado positivo** e mitiguem perdas. O sistema não promete acerto — quantifica
probabilidade e incerteza.

---

## Contexto de Negocio

Apostadores costumam decidir pela **média** de um evento (ex.: "1 cartão por
jogo"). A média esconde a **distribuição**: um time pode ter média 1,0 e mesmo
assim ficar abaixo de 4 cartões em 90% dos jogos. O produto expõe a distribuição
empírica, a probabilidade acumulada (CDF) de um limite e compara com a odd
ofertada para calcular o valor esperado (EV).

### Insight matemático central

Para um limite `k` (ex.: "menos de 4 cartões"):

```
p(hit)      = jogos com total < k  /  total de jogos      (probabilidade empírica)
odd_implícita = 1 / odd_ofertada                          (prob. embutida na odd)
EV          = p(hit) * odd_ofertada - 1                   (> 0 = aposta de valor)
```

Exemplo real do Time A (10 jogos, regra 1 vermelho = 2 amarelos):
distribuição `{0:6, 1:2, 2:1, 6:1}`, média 1,0. Para "menos de 4 cartões":
`p = 9/10 = 0,90`; com odd 1,20 → `EV = 0,90 * 1,20 - 1 = +0,08` (+8%).

### Armazenamento fiel + ponderação como regra de negócio

- **O banco guarda o fato, não a regra.** 1 cartão vermelho = **1 evento**
  `RED_CARD` (nunca "2 cartões" no banco). Dado fiel ao que aconteceu em campo.
- A partir dessa base fiel, a camada de análise deriva **múltiplas métricas** sem
  retrabalho: total de cartões, cartões amarelos, cartões vermelhos e a **base
  ponderada** (regra `1 vermelho = 2 amarelos`).
- A ponderação é **regra de negócio configurável** na camada de análise — nunca
  gravada no banco. A mesma engine atende outros mercados (escanteios, gols,
  chutes) com outra ponderação.

---

## Escopo do MVP

### Dentro do escopo

- Ingestão **diária** (1 request/dia) de partidas já ocorridas via provedor externo.
- Um mercado inicial: **cartões** (amarelo + vermelho ponderado).
- Distribuição empírica + CDF por time.
- Cálculo de EV contra uma odd informada manualmente.
- Intervalo de confiança (Wilson) para expor a incerteza da amostra.

### Estados da partida (roteamento por `status`)

- **agendada** → probabilidades (histórico dos 2 times)
- **ao vivo** → eventos em tempo quase-real (Fase 2, ver [`03-live-inplay.md`](03-live-inplay.md); exige plano pago)
- **encerrada** → histórico consolidado

### Fora do escopo (por enquanto)

- Dados ao vivo (in-play) — **planejado** para Fase 2 em [`03-live-inplay.md`](03-live-inplay.md)
  (polling ~15s + SSE; requer plano pago do API-Football).
- Modelo probabilístico paramétrico (Poisson / Binomial Negativa) — fase 2.
- Combinação de dois times numa única projeção de partida (convolução) — fase 2.
- Backtesting walk-forward — fase 2.
- Integração automática de odds (odd é informada manualmente no MVP).

---

## Princípios de Arquitetura (decisões travadas)

1. **Anti-Corruption Layer (ACL) obrigatória.** A aplicação **não conhece o
   provedor**. Todo dado externo passa por um serviço de mapeamento que traduz o
   payload do provedor → entidades de domínio próprias. Nenhum ID, código ou
   formato do provedor vaza para o domínio, use-cases ou API pública.
   Ver [`01-data-ingestion-acl.md`](01-data-ingestion-acl.md).

2. **Extensibilidade por catálogo de eventos.** Tipos de evento (cartão amarelo,
   vermelho, escanteio, gol, chute…) vivem num catálogo. Adicionar um evento novo
   = nova entrada no catálogo, sem mudar a engine estatística.

3. **Evento atômico.** Cada ocorrência é uma linha (um cartão = uma linha, com
   seu minuto). Agregação é `COUNT`. Preserva granularidade para análises futuras.

4. **Plataforma B2C — sem multi-tenant.** Cada usuário é um cliente individual;
   não há organizações. Há **dois tipos de dado**:
   - **Global / compartilhado:** dados de futebol (times, jogadores, partidas,
     eventos, árbitros), populados pela ingestão, iguais para todos. Sem escopo.
   - **Do usuário:** dados criados pelo usuário (apostas monitoradas, alertas,
     análises salvas) são escopados por **`user_id`**.

   Regra de ouro: **dados do usuário sempre filtram por `user_id`**; dados de
   futebol são globais (leitura autenticada, sem escopo). Não existe `tenant_id`.

5. **Separação dado bruto × análise.** As tabelas de referência guardam fatos
   imutáveis; a camada estatística deriva distribuições/CDF sob demanda (ou
   materializadas), sem alterar o dado bruto.

---

## Riscos Estatísticos (a tratar no produto, não ignorar)

| Risco | Mitigação no produto |
| --- | --- |
| Amostra pequena (n baixo) | Exibir intervalo de confiança (Wilson); nunca só o ponto. |
| Overfitting / viés de retrovisor | Fase 2: validação out-of-sample / walk-forward. |
| Contexto ignorado (árbitro, mando, adversário) | Guardar `referee_id`, mando, competição desde já. |
| Somar dois times ≠ somar médias | Fase 2: convolução de distribuições, não soma de médias. |

---

## Glossário

- **CDF empírica:** proporção de jogos cujo total ficou abaixo/ até um limite.
- **EV (Expected Value):** retorno médio esperado por unidade apostada.
- **Odd implícita:** probabilidade embutida na odd (`1/odd`).
- **ACL:** Anti-Corruption Layer — camada que isola o domínio de formatos externos.
- **Reference data:** dados de futebol globais, compartilhados por todos os usuários.
- **B2C:** cada usuário é um cliente individual; sem multi-tenant. Dados do usuário escopam por `user_id`.
