---

# Exemplo de tasks.md

```md
```
---

# Tasks

## POST /bets — Criar uma aposta monitorada

> Permite que o usuário registre uma nova aposta vinculada a uma partida.

- [ ] DTO de input e validação
- [ ] Controller
- [ ] CreateBetUseCase
- [ ] CreateBetService (regras de negócio)
- [ ] Repository (insert)
- [ ] Testes unitários do UseCase
- [ ] Atualizar OpenAPI

---

## GET /bets/:id — Buscar aposta por ID

> Retorna os detalhes de uma aposta do usuário autenticado.

- [ ] Controller
- [ ] GetBetByIdUseCase
- [ ] Repository (findById com userId)
- [ ] Testes unitários do UseCase
- [ ] Atualizar OpenAPI

---

## PUT /bets/:id — Atualizar aposta

> Permite editar os dados de uma aposta existente.

- [ ] DTO de input e validação
- [ ] Controller
- [ ] UpdateBetUseCase
- [ ] UpdateBetService (regras de negócio)
- [ ] Repository (update com userId)
- [ ] Testes unitários do UseCase
- [ ] Atualizar OpenAPI

---

## DELETE /bets/:id — Remover aposta

> Remove uma aposta do usuário autenticado.

- [ ] Controller
- [ ] DeleteBetUseCase
- [ ] Repository (delete com userId)
- [ ] Testes unitários do UseCase
- [ ] Atualizar OpenAPI
