# Stack Standards (SDD)

Este documento define as tecnologias, bibliotecas e versões aprovadas para o backend.

Ele serve como fonte única de verdade para desenvolvedores e ferramentas de IA (Copilot, Claude Code, etc).

---

# 1. Linguagem

| Tecnologia | Versão   | Motivo                       |
| ---------- | -------- | ---------------------------- |
| Node.js    | 20.x LTS | Estável, suporte longo       |
| TypeScript | 5.x      | Tipagem estática obrigatória |

---

# 2. Framework

| Tecnologia | Versão | Motivo |
| ---------- | ------ | ------ |
| NestJS     | Latest | —      |

---

# 3. Banco de Dados

| Tecnologia | Versão | Motivo |
| ---------- | ------ | ------ |
| PostgreSQL | —      | —      |

---

# 4. ORM / Query Builder

| Tecnologia | Versão | Motivo |
| ---------- | ------ | ------ |
| TypeORM    | Latest | —      |

---

# 5. Autenticação

| Tecnologia     | Uso                         |
| -------------- | --------------------------- |
| `jsonwebtoken` | Geração e validação de JWT  |
| `bcrypt`       | Hash de senhas (rounds: 12) |

---

# 6. Validação

| Tecnologia | Uso                          |
| ---------- | ---------------------------- |
| Zod        | Validação de DTOs e payloads |

---

# 7. Testes

| Tecnologia  | Uso                 |
| ----------- | ------------------- |
| `jest`      | Framework de testes |
| `supertest` | Testes E2E via HTTP |

---

# 8. Segurança

| Tecnologia           | Uso                            |
| -------------------- | ------------------------------ |
| `helmet`             | Headers de segurança HTTP      |
| `cors`               | Controle de origens permitidas |
| `express-rate-limit` | Rate limiting por IP           |

---

# 9. Documentação

| Tecnologia           | Uso                         |
| -------------------- | --------------------------- |
| `swagger-ui-express` | Interface visual do Swagger |
| `swagger-jsdoc`      | Geração do spec via JSDoc   |

---

# 10. Libs

| Tecnologia | Uso         |
| ---------- | ----------- |
| Axios      | Requisições |

# 11. Regras Gerais

- Toda nova lib deve ser discutida antes de adicionada
- Evitar libs sem manutenção ativa (último commit > 1 ano)
- Preferir libs com tipagem TypeScript nativa
