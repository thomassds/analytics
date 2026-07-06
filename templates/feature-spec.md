# [Fluxo|Feature]: Nome da Feature

## Objetivo

Descreva em uma ou duas frases o que esta feature permite fazer.

---

## Contexto de Negocio

Explique o contexto de negocio, motivacao e restricoes relevantes.

Inclua o que esta **fora do escopo** desta spec, se necessario.

---

<!-- SECAO OPCIONAL: use apenas para features com abstrações de provedor/integracao -->
## Arquitetura: Contrato de [Domínio]

Descreva a interface de contrato e suas implementacoes.

```
IContrato (contrato)
    └── ImplementacaoAtual
    └── ImplementacaoFutura
```

```typescript
interface IContrato {
  metodo(param: string): Promise<{ resultado: string }>;
}
```

---

<!-- SECAO OPCIONAL: use apenas para features assincronas com fila -->
## Processamento Assincrono (Fila)

- A funcao deve ser executada por consumidor de fila.
- O produtor publica o evento apos [acao desencadeadora].
- O consumidor processa a mensagem e persiste no banco.

### Evento

- `NOME_DO_EVENTO`

### Payload minimo da mensagem

```json
{
  "userId": "uuid",
  "entityId": "uuid",
  "correlationId": "uuid"
}
```

---

## Fluxo

### Step 1 - [Nome do Step]

```
1. [Ator] informa [dados]
2. API valida [regra ou permissao]
3. API executa [logica]
4. API retorna [resultado]
```

### Step 2 - [Nome do Step]

```
1. ...
```

---

<!-- SECAO OPCIONAL: use quando a feature cria ou acessa uma nova tabela -->
## Modelo de Dados

### `nome_da_tabela`

| Coluna       | Tipo           | Obrigatorio | Padrao              | Descricao                  |
| ------------ | -------------- | ----------- | ------------------- | -------------------------- |
| `id`         | `uuid`         | ✅          | `gen_random_uuid()` | Identificador unico        |
| `user_id`    | `uuid`         | ✅          | —                   | Usuário dono (só em dados do usuário) |
| `campo`      | `varchar(100)` | ✅          | —                   | Descricao do campo         |
| `status`     | `int`          | ✅          | `0`                 | `0` ativo, `1` inativo     |
| `created_at` | `timestamp`    | ✅          | `now()`             | Data de criacao            |
| `updated_at` | `timestamp`    | ✅          | `now()`             | Data de atualizacao        |
| `deleted_at` | `timestamp`    | ❌          | `null`              | Data de soft delete        |

### Constraints

| Nome                      | Tipo          | Colunas                             |
| ------------------------- | ------------- | ----------------------------------- |
| `tabela_pkey`             | `PRIMARY KEY` | `id`                                |
| `tabela_user_fk`          | `FOREIGN KEY` | `user_id -> users.id`               |
| `tabela_user_campo_uq`    | `UNIQUE`      | `user_id, campo` WHERE `deleted_at IS NULL` |

### Indices

| Nome                       | Colunas              |
| -------------------------- | -------------------- |
| `idx_tabela_user_status`   | `user_id, status`    |

---

## Regras de Negocio

### [Operacao, ex: Cadastro]

- Regra 1.
- Regra 2.
- `user_id` sempre extraido do JWT (`sub`) — nunca do body ou query (dados do usuário).

### [Operacao, ex: Atualizacao]

- Regra 1.
- Regra 2.

<!-- SECAO OPCIONAL: use quando houver maquina de estados -->
### Transicoes de Status

| De        | Para      | Permitido |
| --------- | --------- | --------- |
| `pending` | `active`  | ✅        |
| `active`  | `canceled`| ✅        |
| `canceled`| qualquer  | ❌        |

### Ownership (dados do usuário)

- `user_id` sempre extraido do JWT (`sub`) — nunca do body ou query (dados do usuário).
- Nenhuma query em dado do usuário pode omitir filtro de `user_id`.
- Dados de futebol (globais) não têm escopo por usuário.

---

## Endpoints

| Metodo   | Rota                     | Descricao           |
| -------- | ------------------------ | ------------------- |
| `POST`   | `/api/v1/recurso`        | Criar recurso       |
| `PUT`    | `/api/v1/recurso/:id`    | Atualizar recurso   |
| `GET`    | `/api/v1/recurso/:id`    | Detalhar recurso    |
| `GET`    | `/api/v1/recurso`        | Listar recursos     |
| `DELETE` | `/api/v1/recurso/:id`    | Remover recurso     |

---

<!-- SECAO OPCIONAL: use quando houver endpoint de listagem com filtros -->
## Parametros de Listagem

| Parametro | Tipo   | Obrigatorio | Descricao                      |
| --------- | ------ | ----------- | ------------------------------ |
| `campo`   | `uuid` | Nao         | Filtrar por campo              |
| `status`  | `int`  | Nao         | Filtrar por status             |
| `page`    | `int`  | Sim         | Pagina atual (minimo 1)        |
| `limit`   | `int`  | Sim         | Itens por pagina (maximo 100)  |

---

<!-- SECAO OPCIONAL: use quando a resposta tiver shape nao-obvio -->
## Resposta — [Nome do Endpoint]

```json
{
  "id": "uuid",
  "campo": "valor"
}
```

---

## Criterios de Aceite

- Criterio 1.
- Criterio 2.
- Sistema deve retornar apenas registros do usuário autenticado (dados do usuário).

---

## Erros Esperados

| Codigo                  | Situacao                                         |
| ----------------------- | ------------------------------------------------ |
| `UNAUTHORIZED`          | Token ausente, invalido ou expirado              |
| `FORBIDDEN`             | Tentativa de acessar recurso de outro usuário    |
| `ENTITY_NOT_FOUND`      | Recurso nao encontrado para o usuário autenticado |
| `VALIDATION_ERROR`      | Payload invalido ou campos obrigatorios ausentes |
