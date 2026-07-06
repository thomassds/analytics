# Security Standards (SDD)

Este documento define os padrões obrigatórios de segurança para o backend da aplicação.

Ele serve como fonte única de verdade para desenvolvedores e ferramentas de IA (Copilot, Claude Code, etc).

---

# 1. Autenticação

## Padrão

Toda autenticação deve ser feita via **JWT (JSON Web Token)**.

## Geração do Token

```ts
const token = jwt.sign(
  {
    sub: user.id,
    role: user.role,
  },
  process.env.JWT_SECRET,
  { expiresIn: "1d" },
);
```

## Validação

A validação deve ocorrer via **middleware**, antes de chegar no Controller.

```ts
// middleware/auth.middleware.ts
const payload = jwt.verify(token, process.env.JWT_SECRET);
request.user = payload;
```

## Regras

- Token deve expirar em no máximo **1 dia**
- `JWT_SECRET` deve ter no mínimo **32 caracteres**
- `JWT_SECRET` nunca pode estar hardcoded no código
- Todo endpoint autenticado deve passar pelo middleware de auth

---

# 2. Refresh Token

Se implementado, deve seguir:

- Armazenado no banco com `expiresAt` e `revokedAt`
- Rotação obrigatória a cada uso (invalidar o anterior)
- Nunca retornar o refresh token no body — usar **httpOnly cookie**

---

# 3. Autorização (Roles)

## Roles do sistema

| Role     | Descrição                             |
| -------- | ------------------------------------- |
| `admin`  | Admin da plataforma (`is_platform_admin`) |
| `member` | Cliente — acesso restrito aos próprios dados |

## Proteção de rotas

Rotas que exigem role específica devem usar guard/middleware dedicado.

```ts
// Exemplo de guard por role
if (request.user.role !== "admin") {
  throw new AppError("FORBIDDEN", 403);
}
```

## Regras

- Nunca confiar no role vindo do body/query — sempre usar o do token JWT
- Verificar ownership: usuário só acessa os **próprios** recursos (`user_id`)

---

# 4. Senhas

## Hash obrigatório

Toda senha deve ser armazenada com **bcrypt** (mínimo `rounds: 12`).

```ts
import bcrypt from "bcrypt";

// Hash
const hash = await bcrypt.hash(password, 12);

// Verificação
const isValid = await bcrypt.compare(password, hash);
```

## Regras

- Nunca armazenar senha em texto puro
- Nunca retornar senha em nenhuma response
- Nunca logar senha em nenhum nível de log
- Nunca expor senha em mensagem de erro

---

# 5. Escopo por Usuário (Ownership) — B2C

Plataforma **B2C, sem multi-tenant**. Há dois tipos de dado:

- **Dados de futebol (globais):** leitura autenticada, sem escopo por usuário.
- **Dados do usuário** (apostas, alertas, análises salvas): escopados por `user_id`.

## Regra Absoluta

> Nenhum usuário pode acessar dados **de outro usuário**.

## Como garantir

- `userId` sempre extraído do JWT (`sub`) — nunca do body ou query
- Todo Repository de dado do usuário recebe `userId` como parâmetro obrigatório
- Nenhuma query em dado do usuário roda sem filtro de `user_id`

```ts
// Proibido (dado do usuário sem escopo)
betRepository.findById(id);

// Obrigatório
betRepository.findById(id, userId);
```

---

# 6. Validação de Entrada

Todo payload recebido pela API deve ser validado **antes** de chegar no UseCase.

## Regras

- Validação no Controller via schema (Zod, Joi, class-validator)
- Nunca confiar em dados enviados pelo cliente
- Rejeitar campos desconhecidos (strip extras)
- Validar tipos, tamanhos e formatos

```ts
// Exemplo com Zod
const schema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email(),
  amount: z.number().positive(),
});

const input = schema.parse(request.body);
```

---

# 7. Dados Sensíveis

## Nunca retornar em response

- `password`
- Tokens de qualquer tipo
- Chaves privadas
- Segredos de integração

## Nunca logar

- Senhas
- Tokens JWT
- Dados de cartão
- CPF / dados pessoais completos (PII)

## Em erros

Mensagens de erro nunca devem expor detalhes internos ao cliente.

```ts
// Proibido
throw new Error("SELECT * FROM users WHERE email = ...");

// Correto
throw new AppError("USER_NOT_FOUND", 404);
```

---

# 8. Headers de Segurança

## Helmet

Toda aplicação deve usar **Helmet** para configurar headers de segurança.

```ts
import helmet from "helmet";
app.use(helmet());
```

## CORS

Configurar origens permitidas explicitamente — nunca usar `*` em produção.

```ts
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(","),
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);
```

## Rate Limiting

Toda API deve ter rate limiting para prevenir abuso.

```ts
import rateLimit from "express-rate-limit";

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,
  }),
);
```

---

# 9. Variáveis de Ambiente

## Regras

- Secrets **nunca** devem estar hardcoded no código
- `.env` **nunca** deve ser commitado no git
- `.env.example` deve existir com as chaves (sem valores)
- Em produção, usar serviço de secrets (ex: AWS Secrets Manager, Vault)

## Variáveis obrigatórias

```env
JWT_SECRET=
DATABASE_URL=
NODE_ENV=
ALLOWED_ORIGINS=
```

---

# 10. Regra de Ouro

> Nunca confiar em dados externos — validar tudo.

> Nunca expor detalhes internos — erros devem ser previsíveis e controlados.

> Nunca ignorar o ownership — dado do usuário sempre filtra por `user_id`.
