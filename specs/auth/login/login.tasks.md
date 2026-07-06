# Tasks: Login Flow

> Ref: `specs/auth/login/login-spec.md`

---

## Infraestrutura

- [x] Definir estratégia de autenticação com JWT
- [ ] Configurar sessão com Passport para login
- [x] Garantir duração máxima de 24h para o token
- [x] Reutilizar a entidade `User` e o repositório de usuários
- [x] Garantir validação de email antes de autenticar

---

## POST `/api/v1/auth` — Login

> Autentica o usuário com email e senha, valida credenciais e retorna token + dados básicos do usuário.

- [x] DTO de input e validação (Zod)
- [x] Controller (`AuthController`)
- [x] `LoginUseCase`
- [x] `UserRepository` (findByEmail)
- [x] Validação da senha com hash salvo no banco
- [x] Geração do JWT com expiração de 24 horas
- [x] Retorno de `id`, `name` e `email`
- [x] Tratamento de `USER_NOT_FOUND`
- [x] Tratamento de `INVALID_CREDENTIALS`
- [x] Tratamento de `EMAIL_NOT_VALIDATED`
- [x] Testes unitários do UseCase
- [x] Atualizar OpenAPI
