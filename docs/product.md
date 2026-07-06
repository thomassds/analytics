# Product Definition

Este documento é um resumo geral do produto. Detalhes técnicos e regras de negócio estão em `specs/`.

---

# 1. Visão Geral

> Plataforma de **análise matemática de jogos de futebol** voltada a apostadores.
> O objetivo é dar clareza estatística sobre a probabilidade de eventos futuros
> (começando por cartões) e ajudar o usuário a identificar apostas de **valor
> esperado positivo** e mitigar perdas. O sistema não promete acerto — ele
> quantifica probabilidade, incerteza e valor frente às odds ofertadas.

---

# 2. Módulos

## 2.1 Modelo B2C (sem multi-tenant)

Cada usuário é um **cliente individual** — não há organizações nem multi-tenant.
Dois tipos de dado:

- **Dados de futebol (globais):** times, jogadores, partidas, eventos, árbitros —
  fatos públicos, iguais para todos, populados pela ingestão. Sem escopo.
- **Dados do usuário:** apostas monitoradas, alertas, análises salvas — escopados
  por **`user_id`**.

Ver `specs/football-analytics/00-overview.md`.

## 2.2 Autenticação e Gestão de Usuários

Reaproveitado da base existente, já simplificado para B2C (sem tenant):

- Cadastro e onboarding de usuário
- Autenticação com 2 fatores (código via email e SMS)
- Reset de senha
- Papéis simples (cliente / admin da plataforma via `is_platform_admin`)

## 2.3 Ingestão de Dados (Anti-Corruption Layer)

Sincronização diária (1 request/dia) de partidas já ocorridas via provedor
externo (ex.: API-Football). A aplicação **não conhece o provedor**: um serviço
de mapeamento traduz o payload externo para as entidades de domínio próprias.

- Buscar partidas atualizadas até o momento
- Traduzir e persistir competições, times, jogadores, árbitros e eventos
- Idempotente por `external_ref` (re-buscar não duplica)

Ver `specs/football-analytics/01-data-ingestion-acl.md`.

## 2.4 Análise Estatística (núcleo do produto)

A partir dos eventos persistidos, deriva a inteligência sobre a qual o produto
se sustenta:

- Distribuição empírica de um evento por jogo (ex.: cartões)
- Probabilidade acumulada (CDF) de um limite (ex.: "menos de 4 cartões")
- Intervalo de confiança (Wilson) para expor a incerteza da amostra
- Cálculo de valor esperado (EV) contra uma odd informada

Regra configurável de ponderação (ex.: `1 cartão vermelho = 2 amarelos`), pensada
para estender a outros mercados (escanteios, gols, chutes) sem reescrever a engine.

---

# 3. Roadmap por Fases

## Fase 1 — MVP (atual)

- Mercado de cartões
- Ingestão diária + ACL
- Distribuição empírica + CDF + EV por time
- Odd informada manualmente

## Fase 2

- Modelo probabilístico paramétrico (Poisson / Binomial Negativa) para contagens
- Combinação de dois times numa única projeção de partida (convolução)
- Backtesting walk-forward das regras
- Integração automática de odds

---

# 4. Fora do Escopo (MVP)

- Dados ao vivo / in-play (streaming)
- Modelo paramétrico e convolução (Fase 2)
- Backtesting automatizado (Fase 2)
- Integração automática com casas de aposta / captura de odds (Fase 2)
- Aplicativo mobile
