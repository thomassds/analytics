# Architecture Standard (SDD)

Este documento define a arquitetura base do sistema com foco em módulos, contratos e escalabilidade.

---

# 1. Visão Geral

O sistema é modular por domínio (Domain-Oriented Architecture).

Cada módulo é independente e não deve acessar internals de outros módulos diretamente.

Fluxo padrão:

API → Module → UseCases → Services → Repositories → Database

---

# 2. Estrutura de Módulos

modules/
ingestion/
matches/
analytics/
bets/
messaging/

Cada módulo contém:

- domain/
- application/
- infrastructure/
- contracts/

---

# 3. Regra de Dependência

## ❌ Proibido

- Um módulo acessar repository de outro módulo
- Um módulo acessar service interno de outro módulo

## ✔ Permitido

- Dependência via contracts (interfaces)

---

# 4. Contratos (Contracts)

## Regra principal

> O contrato vive no módulo que fornece a capacidade.

Exemplo:

- matches define MatchFinder
- messaging define MessageSender
- analytics define CardDistribution

---

## Exemplo

modules/bets/contracts/bet-validator.ts

```ts
export interface BetValidator {
  exists(betId: string, userId: string): Promise<boolean>;
}
```

---

## Implementação

Fica dentro do próprio módulo:

bets/infrastructure/bet-validator.service.ts

```ts
export class BetValidatorService implements BetValidator {
  constructor(private betRepository) {}

  async exists(betId: string, userId: string) {
    return !!(await this.betRepository.findById(betId, userId));
  }
}
```

---

# 5. Camadas Internas

## Controller

- Apenas HTTP
- Sem regra de negócio

## UseCase

- Orquestra regra de negócio
- Ponto principal da feature

## Service

- Regras reutilizáveis

## Repository

- Acesso ao banco
- Sem regra de negócio

---

# 6. Regra de Ouro

> Cada módulo deve ser independente e só expor contratos ou eventos.

---

# 7. Comunicação Entre Módulos

## Opções válidas:

### 1. Contracts (sincrono)

- validações
- queries simples

### 2. Events (assíncrono)

- sincronização de partidas
- envio de mensagens
- geração de alertas de aposta

### 3. Snapshots

- dados copiados entre domínios
- histórico imutável

---

# 8. Escopo por Usuário (B2C)

- Plataforma B2C — **sem multi-tenant**.
- Dados de futebol são **globais** (sem escopo).
- Dados do usuário (apostas, alertas) possuem `user_id` e sempre filtram por ele.
- Nenhuma query em dado do usuário pode ignorar o `user_id`.

---

# 9. Regras de Escala

- Workers stateless
- Filas para processamento pesado
- Retry com backoff
- DLQ obrigatória

---

# 10. Objetivo da Arquitetura

- Evitar acoplamento entre domínios
- Permitir evolução independente
- Escalar sem rewrite
- Facilitar uso de IA no desenvolvimento
