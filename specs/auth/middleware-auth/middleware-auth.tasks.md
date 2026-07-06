# Tasks: Auth Middleware

> Ref: `specs/auth/middleware-auth/middleware-auth-spec.md`

---

## Infraestrutura

- [x] Criar `JwtAuthGuard` em `src/common/guards/jwt-auth.guard.ts`
- [x] Criar decorator `@AuthUser()` em `src/common/decorators/auth-user.decorator.ts`
- [x] Criar tipo `AuthPayload` (sub, email, name) em `src/common/types/auth-payload.ts`
- [x] Registrar `JwtModule` globalmente ou exportar do `AuthModule` para uso nos demais módulos

---

## Guard — `JwtAuthGuard`

> Valida o token JWT do header `Authorization: Bearer <token>` e injeta o payload em `request.user`.

- [x] Extração do token do header `Authorization`
- [x] Rejeitar com `UNAUTHORIZED` (401) se header ausente ou formato inválido
- [x] Verificar assinatura com `JWT_SECRET` via `JwtService`
- [x] Rejeitar com `INVALID_TOKEN` (401) se assinatura inválida
- [x] Rejeitar com `TOKEN_EXPIRED` (401) se token expirado
- [x] Injetar payload (`sub`, `email`, `name`) em `request.user`
- [x] Testes unitários do guard

---

## Decorator — `@AuthUser()`

> Extrai `request.user` e disponibiliza nos parâmetros do controller.

- [x] Criar decorator de parâmetro `@AuthUser()`
- [ ] Testes do decorator

---

## Integração

- [x] Aplicar `JwtAuthGuard` globalmente via `APP_GUARD` no `AppModule`
- [x] Criar decorator `@Public()` para marcar rotas que não exigem autenticação
- [x] Ajustar o guard para respeitar o decorator `@Public()` nas rotas públicas
- [x] Aplicar `@Public()` em todos os endpoints do `AuthController`
