# Feature: Login

## Objetivo

Criar uma autenticação para o usuario, para garantir a segurança das informações do sistema.

---

## Contexto de Negócio

Temos uma API e precisamos identificar quem esta fazendo requisições, portanto precisamos gerar uma forma do usuario se autenticar para poder liberar a ele uma forma de identificação

---

## Fluxo: Autenticação

### Step 1 - Auth:

```
1. Usuário informa Nome e senha
2. Api verifica se e-mail existe
3. Api Valida de senha informada é igual ao hash salvo no banco
4. Se for correto API gera JWT, cria sessão com passport e retorna para usuario junto com, name, email e id
```

---

## Regras de Negócio

- Para se autenticar a senha deve ser a mesma salva no banco com hash
- JWT deve ter duração de no maximo 24 horas.
- Email deve ser validado

## Endpoints

| Método | Rota           | Descrição |
| ------ | -------------- | --------- |
| `POST` | `/api/v1/auth` | Login     |

## Critérios de Aceite

- Usuario deve conseguir autenticar com email e senha validos.
- O sistema deve validar se o email informado existe na plataforma.
- O sistema deve validar a senha informada contra o hash salvo no banco.
- Ao autenticar com sucesso, a API deve retornar um JWT com duracao maxima de 24 horas.
- Ao autenticar com sucesso, a API deve retornar os dados basicos do usuario: id, name e email.
- O fluxo de login deve registrar a sessao do usuario conforme a estrategia de autenticação definida.
- Email do usuario deve estar validado para permitir o acesso.

---

## Erros Esperados

| Código                | Situação                                      |
| --------------------- | --------------------------------------------- |
| `USER_NOT_FOUND`      | E-mail não cadastrado na plataforma           |
| `INVALID_CREDENTIALS` | Senha incorreta                               |
| `EMAIL_NOT_VALIDATED` | E-mail ainda não foi validado                 |
| `VALIDATION_ERROR`    | Payload inválido ou campos obrigatórios ausentes |
