# Tasks: Create Onboaring Flow

> Ref: `specs/Auth/onboarding-spec.md`

---

## Infraestrutura

- [x] Criar migration: tabela `users`
- [x] Criar migration: tabela `tenants`
- [x] Criar migration: tabela `user_tenants`
- [x] Criar migration: tabela `validation_codes`
- [x] Criar migration: endereço em `users`
- [x] Criar entity `User`
- [x] Criar entity `Tenant`
- [x] Criar entity `UserTenant`
- [x] Criar entity `ValidationCode`

---

## POST `/api/v1/auth/onboarding` — Criar conta

> Cria o usuário com nome, email e senha. Dispara código de validação de email.

- [x] DTO de input e validação (Zod)
- [x] Controller (`AuthController`)
- [x] `OnboardingUseCase`
- [x] `UserRepository` (findByEmail, insert)
- [x] Serviço de envio de código por email (`EmailCodeService`)
- [ ] Testes unitários do UseCase
- [ ] Atualizar OpenAPI

---

## POST `/api/v1/auth/request-code` — Solicitar código

> Reenvia ou solicita código de validação para email ou telefone.

- [x] DTO de input e validação (Zod)
- [x] Controller
- [x] `RequestCodeUseCase`
- [x] `ValidationCodeRepository` (findActiveByUser, insert, invalidatePrevious)
- [x] Serviço de envio (email / SMS / WhatsApp) com interface abstrata (`INotificationService`)
- [ ] Testes unitários do UseCase
- [ ] Atualizar OpenAPI

---

## POST `/api/v1/auth/validate-code` — Validar código

> Valida o código informado. Marca email ou telefone como validado.

- [x] DTO de input e validação (Zod)
- [x] Controller
- [x] `ValidateCodeUseCase`
- [x] `ValidationCodeRepository` (findByCode, markAsUsed)
- [x] Lógica de expiração (1h) e limite de tentativas
- [x] Atualizar `validated_email_at` ou `validated_phone_at` no usuário
- [ ] Testes unitários do UseCase
- [ ] Atualizar OpenAPI

---

## Step 2 — Dados Pessoais

> Salva `tax_identifier`, `phone` e `country_code` e endereço do cliente, `zip_code`, `street`, `neighborhood`, `state`, `city`,`number`, `complement`. Dispara código de validação do telefone.

- [x] DTO de input e validação (Zod)
- [x] Controller (`PATCH /auth/onboarding/personal`)
- [x] `SavePersonalDataUseCase`
- [x] `UserRepository` (update)
- [x] Disparar código via SMS/WhatsApp após salvar
- [ ] Testes unitários do UseCase
- [ ] Atualizar OpenAPI

---

## Step 3 — Dados da Empresa (Admin)

> Cria o tenant e vincula o usuário como `admin` em `user_tenants`.

- [x] DTO de input e validação (Zod)
- [x] Controller (`POST /auth/onboarding/company`)
- [x] `CreateTenantUseCase`
- [x] `TenantRepository` (insert)
- [x] `UserTenantRepository` (insert com role `admin`)
- [x] Guard: validar que `email` e `phone` já foram validados antes de permitir este step
- [ ] Testes unitários do UseCase
- [ ] Atualizar OpenAPI

---

## Envio real de códigos (provedores)

- [x] `MailerService` (nodemailer) — suporta `EMAIL_SERVICE` (ex: Gmail) ou SMTP genérico (`SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`)
- [x] Templates de email (`validation-code`, `contract-created`, `contract-signed`)
- [x] `EmailConsumer` envia email de verdade via `MailerService`
- [x] `TwilioService` (API REST via fetch, sem SDK) — SMS e WhatsApp
- [x] `SmsConsumer` envia via `TwilioService`
- [x] Modo dev: sem credenciais configuradas, apenas loga (não quebra local)
- [x] Variáveis em `.env` / `.env.example`
- [x] Testes unitários (mailer, twilio, templates)
- [x] Removido `NotificationService` (código morto)
