# Git Standards (SDD)

Este documento define os padrões obrigatórios para uso do Git no projeto.

Ele serve como fonte única de verdade para desenvolvedores e ferramentas de IA (Copilot, Claude Code, etc).

---

# 1. Princípios

- Histórico de commits deve ser legível e rastreável
- Cada commit representa uma unidade lógica de trabalho
- Branches têm propósito e ciclo de vida definidos
- `main` sempre deve estar estável e deployável

---

# 2. Branches

## Estrutura

| Branch      | Propósito                                 |
| ----------- | ----------------------------------------- |
| `main`      | Produção — sempre estável                 |
| `develop`   | Integração — base para novas features     |
| `feature/*` | Nova funcionalidade                       |
| `fix/*`     | Correção de bug                           |
| `hotfix/*`  | Correção urgente em produção              |
| `chore/*`   | Tarefas técnicas (deps, config, refactor) |

## Nomenclatura

```
feature/create-bet
feature/user-authentication
fix/ev-calculation-error
hotfix/token-expiration-bug
chore/update-dependencies
```

## Regras

- Nunca commitar diretamente em `main`
- Nunca commitar diretamente em `develop`
- Branch deve ser criada a partir de `develop` (exceto `hotfix`, que parte de `main`)
- Branch deve ser removida após o merge

---

# 3. Commits

## Padrão — Conventional Commits

```
<tipo>(<escopo>): <descrição curta>
```

## Tipos

| Tipo       | Quando usar                              |
| ---------- | ---------------------------------------- |
| `feat`     | Nova funcionalidade                      |
| `fix`      | Correção de bug                          |
| `chore`    | Tarefas técnicas sem impacto no produto  |
| `docs`     | Alterações em documentação               |
| `test`     | Adição ou correção de testes             |
| `refactor` | Refatoração sem mudança de comportamento |
| `perf`     | Melhoria de performance                  |
| `ci`       | Alterações em pipeline CI/CD             |

## Exemplos

```
feat(bets): add create bet use case
fix(auth): fix token expiration not being validated
chore(deps): update bcrypt to v5
docs(api): add swagger docs for users endpoint
test(analytics): add unit tests for card distribution use case
refactor(ingestion): extract provider mapping to service
```

## Regras

- Descrição em **inglês**
- Letra minúscula no início
- Sem ponto final
- Máximo 72 caracteres na primeira linha
- Escopo deve referenciar o módulo afetado

---

# 4. Pull Requests

## Regras

- Todo PR deve ter título seguindo Conventional Commits
- Todo PR deve ter descrição do que foi feito e por quê
- Todo PR deve passar nos checks de CI antes do merge
- Ao menos **1 aprovação** obrigatória para merge em `develop`
- `main` exige ao menos **2 aprovações**

## Template de descrição

```markdown
## O que foi feito

Descreva brevemente as alterações.

## Por quê

Contexto e motivação da mudança.

## Como testar

Passos para validar o que foi implementado.

## Checklist

- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada (se necessário)
- [ ] Sem secrets no código
```

---

# 5. Merge Strategy

- Usar **Squash and Merge** para features e fixes em `develop`
- Usar **Merge Commit** para releases de `develop` → `main`
- Nunca usar `git push --force` em branches compartilhadas

---

# 6. .gitignore Obrigatório

Os seguintes itens nunca devem ser commitados:

```
.env
.env.local
.env.*.local
node_modules/
dist/
build/
coverage/
*.log
```

---

# 7. Regra de Ouro

> `main` é sagrada — nunca deve quebrar.

> Commit pequeno e focado é melhor do que commit grande e genérico.

> Nunca commitar secrets, mesmo que acidentalmente — revogar imediatamente.
