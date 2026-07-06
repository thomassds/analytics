# Database Standards (SDD)

Este documento define os padrões obrigatórios para modelagem, acesso e manutenção do banco de dados.

Ele serve como fonte única de verdade para desenvolvedores e ferramentas de IA (Copilot, Claude Code, etc).

---

# 1. Princípios

Todo acesso ao banco deve seguir:

- Queries em dados do usuário sempre isoladas por `user_id` (B2C, sem multi-tenant)
- Sem regra de negócio dentro de queries
- Migrations versionadas e rastreáveis
- Nomenclatura consistente e previsível

---

# 2. Convenções de Nomenclatura

## Tabelas

- `snake_case`
- Sempre no plural

### Correto

```
users
bets
match_events
```

### Incorreto

```
User
bet
MatchEvent
```

---

## Colunas

- `snake_case`
- Nomes descritivos e explícitos

### Correto

```
created_at
user_id
match_id
```

### Incorreto

```
createdAt
tid
cid
```

---

# 3. Colunas Obrigatórias

Toda tabela deve possuir obrigatoriamente:

| Coluna       | Tipo                     | Descrição                  |
| ------------ | ------------------------ | -------------------------- |
| `id`         | `uuid` gen_random_uuid() | Identificador único        |
| `created_at` | `timestamp`              | Data de criação            |
| `updated_at` | `timestamp`              | Data da última atualização |

> **B2C — sem `tenant_id`.** Tabelas de **dados do usuário** (apostas, alertas)
> incluem `user_id` (FK `users`) e sempre filtram por ele. Tabelas de **dados de
> futebol** são globais, sem escopo.

---

# 4. Exemplo — Tabela `users`

## Migration

```sql
CREATE TABLE users (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(50)  NOT NULL DEFAULT 'member',
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMP    NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP    NOT NULL DEFAULT now(),

  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_unique UNIQUE (email)
);
```

---

## Índices

```sql
CREATE INDEX idx_users_email ON users (email);
```

---

# 5. Regras de Acesso

## Proibido

```ts
// Acessar banco fora do Repository
db('users').where({ id }).first();

// Query em dado do usuário sem userId
betRepository.findById(id);

// Retornar senha em qualquer query de leitura
SELECT * FROM users;
```

## Obrigatório

```ts
// Sempre via Repository
betRepository.findById(id, userId);

// Dado do usuário: sempre filtrar por user_id
.where({ id, user_id: userId })

# 6. Migrations

- Toda alteração no banco deve ser feita via migration
- Nunca alterar o banco manualmente em produção
- Migrations são imutáveis após aplicadas — criar nova migration para corrigir

### Nomenclatura de arquivos

```

{timestamp}-{PascalCaseDescription}.ts

Exemplo:
1749600001000-CreateUsers.ts
1749600002000-CreateMatches.ts
1749600003000-AddPhoneToUsers.ts

````

O timestamp garante a **ordem de execução correta**. Para gerar automaticamente:

```bash
yarn migration:generate src/database/migrations/NomeDaMigration
````

---

# 7. Soft Delete

Tabelas que precisam de histórico devem usar soft delete.

```sql
deleted_at  TIMESTAMP  NULL DEFAULT NULL
```

```ts
// Query deve ignorar registros deletados por padrão
.whereNull('deleted_at')
```

---

# 8. Diagrama de Entidades (ERD)

O diagrama de entidades do sistema está documentado em:

```
docs/erd.md
```

## Regra Obrigatória

> Toda migration que criar, alterar ou remover uma tabela ou coluna deve ser refletida no `docs/erd.md`.

Isso inclui:

- Criação de nova tabela
- Adição ou remoção de coluna
- Alteração de tipo ou constraint
- Adição de índice relevante
- Criação de relacionamento entre tabelas

---

# 9. Regra de Ouro

> Dado do usuário nunca é lido sem filtro de `user_id` (B2C — sem multi-tenant).

> O banco não sabe de regras de negócio — isso é responsabilidade do UseCase.
