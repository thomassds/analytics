# Feature: Auth Middleware

## Objetivo

Proteger os endpoints autenticados da API, garantindo que apenas requisições com um JWT válido possam acessá-los.

---

## Contexto de Negócio

Após o login o usuário recebe um JWT. Toda rota que exige identidade ou permissão deve validar esse token antes de chegar no controller. O middleware extrai o payload do token e disponibiliza os dados do usuário (`sub`, `role`, `email`) para uso nas camadas seguintes.

---

## Fluxo

```
1. Request chega com header Authorization: Bearer <token>
2. Middleware extrai o token do header
3. Middleware verifica a assinatura e a expiração do token com JWT_SECRET
4. Se válido, injeta o payload no objeto de request (request.user)
5. Chama next() e a requisição segue para o controller
6. Se inválido ou ausente, retorna 401 imediatamente
```

---

## Regras de Negócio

- Token deve ser enviado no header `Authorization` no formato `Bearer <token>`
- A validação deve usar a variável de ambiente `JWT_SECRET` (mínimo 32 caracteres, nunca hardcoded)
- Token expirado deve ser rejeitado com erro distinto de token inválido
- O payload injetado em `request.user` deve conter: `sub` (userId), `email`, `name`
- Rotas públicas (onboarding, login, recovery) devem ser explicitamente excluídas da validação
- Nunca confiar em dados de usuário vindos do body ou query — sempre usar o payload do token

---

## Rotas Públicas (sem middleware)

| Método | Rota                               |
| ------ | ---------------------------------- |
| `POST` | `/api/v1/auth`                     |
| `POST` | `/api/v1/auth/onboarding`          |
| `POST` | `/api/v1/auth/onboarding/personal` |
| `POST` | `/api/v1/auth/onboarding/company`  |
| `POST` | `/api/v1/auth/request-code`        |
| `POST` | `/api/v1/auth/validate-code`       |
| `POST` | `/api/v1/auth/recovery-password`   |

---

## Critérios de Aceite

- Requisição com token válido deve passar pelo middleware e ter `request.user` populado.
- Requisição sem header `Authorization` deve ser rejeitada com `401`.
- Requisição com token expirado deve ser rejeitada com `401` e código `TOKEN_EXPIRED`.
- Requisição com token com assinatura inválida deve ser rejeitada com `401` e código `INVALID_TOKEN`.
- Rotas públicas listadas acima não devem passar pelo middleware.
- O payload disponível em `request.user` deve conter `sub`, `email` e `name`.

---

## Erros Esperados

| Código          | Status | Situação                                        |
| --------------- | ------ | ----------------------------------------------- |
| `UNAUTHORIZED`  | `401`  | Header `Authorization` ausente ou mal formatado |
| `INVALID_TOKEN` | `401`  | Assinatura do token inválida                    |
| `TOKEN_EXPIRED` | `401`  | Token expirado                                  |
