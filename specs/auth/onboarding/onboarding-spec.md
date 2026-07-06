# Feature: Onboarding

## Objetivo

Permitir que o usuario crie a sua conta e passe pelas steps necessarias para configurações basicas do sistema.

---

## Contexto de Negócio

Possuimos alguns niveis de acesso de usuario, portanto vamos ter varios steps diferentes.

Cada nivel de acesso possui uma nessesidade diferente.

Os niveis são:

- Admin
- Motorista
- Monitores
- Clientes
- Clientes dependentes

---

---

## Fluxo: Onboarding

### Step 1 - Criação de Conta:

```
1. Usuário informa Nome, email e senha
2. Api verifica se e-mail já existe caso não, cria a conta envia o codigo de validação do email
3. Usúario informa o codigo
4. Api valida se o codigo esta correto, se estiver marca o email como validado.
```

### Step 2 - Dados Pessoais:

```
1. Usúario informa taxIdentifier, telefone, country Code e endereço
2. Api salva os dados e envia codigo via SMS ou WhatsApp
3. Usúario informa o codigo
4. Api valida se o codigo esta correto, se estiver marca o telefone como validado.
```

### Step 3 (Apenas para ADMIN) - Dados da Empresa:

```
1. Usúario informa os dados da empresa
2. Api salva os dados e vincula usuario ao tenant na tabela user_tenants, role admin
```

## Regras de Negócio

- Pode existir apenas 1 usuario com o email informado.
- Pode existir apenas 1 usuario com o telefone informado.
- Email deve ser validado durante a criação da conta
- Telefone deve ser validado durante a criação da conta
- Senha deve ser armazenada com **bcrypt** (rounds: 12)
- Telefone e taxIdentifier devem ser sempre salvos sem mascara
- Codigo de validação deve ser gerado com random de 6 digitos

### ADMIN

O usuario administrativo é o primeiro a se cadastrar. Ele é o "Dono da empresa" e devera preencher algumas informações da propria companhia também.

- Ao se cadastrar usuario deve enviar também os dados do tenant, para que seja feito o cadastro de ambos e vinculados na tabela de user_tenants com a role admin

---

### MOTORISTA

Ainda não definido

---

### MONITOR

Ainda não definido

---

### CLIENTES

Ainda não definido

---

### CLIENTES DEPENDENTES

Ainda não definido

---

## Endpoints

| Método | Rota                         | Descrição                          |
| ------ | ---------------------------- | ---------------------------------- |
| `POST` | `/api/v1/auth/onboarding`    | Criar conta do usuario e configs   |
| `POST` | `/api/v1/auth/request-code`  | Solicitar codigo via email/wpp/sms |
| `POST` | `/api/v1/auth/validate-code` | validar codigo                     |

## Critérios de Aceite

- Usuario deve criar conta
- Usuario deve validar o email
- Usuario deve validar o telefone
- Criar configurações com base no perfil do usuario

---

## Erros Esperados

| Código                       | Situação                                           |
| ---------------------------- | -------------------------------------------------- |
| `EMAIL_ALREADY_EXISTS`       | E-mail já cadastrado na plataforma                 |
| `INVALID_EMAIL_FORMAT`       | Formato de e-mail inválido                         |
| `PHONE_ALREADY_EXISTS`       | Telefone já cadastrado na plataforma               |
| `INVALID_PHONE_FORMAT`       | Formato de telefone inválido para o país informado |
| `INVALID_TAX_IDENTIFIER`     | CPF/CNPJ inválido                                  |
| `INVALID_CODE`               | Código de validação incorreto                      |
| `CODE_EXPIRED`               | Código de validação expirou                        |
| `CODE_MAX_ATTEMPTS_EXCEEDED` | Número máximo de tentativas de validação atingido  |
| `EMAIL_NOT_VALIDATED`        | E-mail não foi validado antes de prosseguir        |
| `PHONE_NOT_VALIDATED`        | Telefone não foi validado antes de prosseguir      |
| `COMPANY_NAME_REQUIRED`      | Nome da empresa obrigatório para admin             |
| `INVALID_COMPANY_DATA`       | Dados da empresa incompletos ou inválidos          |
| `WEAK_PASSWORD`              | Senha não atende aos requisitos mínimos            |
| `USER_ALREADY_ONBOARDED`     | Usuário já completou o onboarding                  |
