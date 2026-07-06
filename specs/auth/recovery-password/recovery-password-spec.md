# Feature: Payable Management

## Objetivo

Permitir que usuarios que esqueceram ou perderam a senha possam resetar.

---

## Contexto de Negócio

Para usuario poder se autenticar no sistema ele precisa da senha de acesso informada no cadastro.
Precisamos de uma forma que ele consiga resetar a mesma atravez do email ou do telefone.

---

## Fluxo: Recovery Password

### Step 1 - Solicitação de Codigo:

```
1. Usuário informa Email ou telefone cadastrados na plataforma
2. Api verifica se e-mail ou telefone já existe, se sim envia o codigo de validação do email
3. Usúario informa o codigo
4. Api valida se o codigo esta correto
5. Usúario informa a nova senha de reset junto ao codigo
6. Api salva os dados e revoga o codigo
```

## Endpoints

| Método | Rota                             | Descrição                          |
| ------ | -------------------------------- | ---------------------------------- |
| `POST` | `/api/v1/auth/recovery-password` | Usuario envia nova senha e salva   |
| `POST` | `/api/v1/auth/request-code`      | Solicitar codigo via email/wpp/sms |
| `POST` | `/api/v1/auth/validate-code`     | validar codigo                     |

## Critérios de Aceite

- Usuario atualizar senha

---
