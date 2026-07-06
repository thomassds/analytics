# Tasks: Recovery Password Flow

> Ref: `specs/auth/recovery-password/recovery-password-spec.md`

---

## Infraestrutura

- [x] Reutilizar a tabela `users` com o campo `password`
- [x] Reutilizar a tabela `validation_codes` para códigos de recuperação
- [x] Reutilizar as entidades `User` e `ValidationCode`
- [x] Reutilizar os repositórios base de usuário e código de validação

---

## POST `/api/v1/auth/request-code` — Solicitar código

> Envia um código de validação para o email ou telefone informado no cadastro.

- [x] DTO de input e validação (Zod)
- [x] Controller (`AuthController`)
- [x] `RequestCodeUseCase`
- [x] `UserRepository` (findById, findByEmail, findByPhone)
- [x] `ValidationCodeRepository` (invalidatePrevious, insert)
- [x] Serviço de envio por email e SMS/WhatsApp
- [x] Expiração do código em 1h
- [x] Testes unitários do UseCase
- [x] Atualizar OpenAPI

---

## POST `/api/v1/auth/validate-code` — Validar código

> Valida o código recebido e marca o canal como confirmado.

- [x] DTO de input e validação (Zod)
- [x] Controller (`AuthController`)
- [x] `ValidateCodeUseCase`
- [x] `ValidationCodeRepository` (findActive, incrementAttempts, markAsUsed)
- [x] Limite de tentativas para o código
- [x] Expiração do código em 1h
- [x] Atualizar `validated_email_at` ou `validated_phone_at` no usuário
- [x] Testes unitários do UseCase
- [x] Atualizar OpenAPI

---

## POST `/api/v1/auth/recovery-password` — Recuperar senha

> Recebe o código validado e a nova senha, atualiza a credencial do usuário e invalida o código.

- [x] DTO de input e validação (Zod)
- [x] Controller (`AuthController`)
- [x] `RecoveryPasswordUseCase`
- [x] Buscar usuário pelo `userId` e validar existência
- [x] Validar o código ativo e impedir reutilização
- [x] Hash da nova senha antes de salvar
- [x] `UserRepository` (update password)
- [x] Invalidar o código após o uso
- [x] Retornar resposta de sucesso para o reset
- [x] Testes unitários do UseCase
- [x] Atualizar OpenAPI
