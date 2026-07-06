# API Standards

Este documento define os padrões obrigatórios para desenvolvimento e manutenção das APIs da aplicação.

O objetivo é garantir consistência entre equipes, projetos e ferramentas de IA.

> Plataforma B2C, sem multi-tenant. Nos exemplos: `bets` (apostas monitoradas) é
> um recurso **do usuário** (escopo `user_id`); `matches` é **reference data
> global** (sem escopo). Use o exemplo condizente.

---

# 1. Princípios

Toda API deve seguir:

- REST First
- Consistência acima de preferência pessoal
- Versionamento explícito
- Recursos ao invés de ações
- Responses padronizadas
- Erros previsíveis
- Escopo por usuário seguro (ownership)

---

# 2. Estrutura de Rotas

## Regra Principal

As rotas devem representar recursos.

### Correto

```http
GET    /api/v1/bets
GET    /api/v1/bets/:id
POST   /api/v1/bets
PUT    /api/v1/bets/:id
DELETE /api/v1/bets/:id
```

### Incorreto

```http
POST /api/v1/createBet
POST /api/v1/deleteBet
POST /api/v1/updateBet
```

---

# 3. Versionamento

Toda API deve possuir versão.

### Exemplo

```http
/api/v1/bets
/api/v1/matches
/api/v1/messages
```

---

# 4. Actions Específicas

Quando uma operação não representa CRUD puro, utilizar sub-recursos.

### Exemplo

```http
POST /api/v1/bets/:id/settle
POST /api/v1/bets/:id/cancel

POST /api/v1/matches/:id/sync
POST /api/v1/messages/:id/retry
```

---

# 5. Padrão de Responses

Toda resposta deve seguir o mesmo formato.

## Sucesso

```json
{
  "success": true,
  "data": {}
}
```

---

## Lista

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 120
  }
}
```

---

## Erro

```json
{
  "success": false,
  "error": {
    "code": "BET_NOT_FOUND",
    "message": "Bet not found"
  }
}
```

---

# 6. Status Codes

## GET

```http
200 OK
404 NOT FOUND
```

---

## POST

```http
201 CREATED
400 BAD REQUEST
409 CONFLICT
```

---

## PUT

```http
200 OK
404 NOT FOUND
409 CONFLICT
```

---

## DELETE

```http
204 NO CONTENT
404 NOT FOUND
```

---

## Erros internos

```http
500 INTERNAL SERVER ERROR
```

---

# 7. Controllers

Controllers possuem apenas as seguintes responsabilidades:

- Receber request
- Validar payload
- Chamar UseCase
- Retornar response

Controllers nunca devem:

- Acessar repositories
- Executar regras de negócio
- Fazer cálculos de domínio

---

# 8. UseCases

Todo endpoint deve possuir um UseCase responsável.

### Exemplo

```text
POST /bets

CreateBetUseCase
```

---

# 9. DTOs

Todo payload deve possuir DTO próprio.

### Input

```ts
CreateBetDTO;
```

### Output

```ts
CreateBetResponseDTO;
```

Não retornar entidades diretamente.
Deve ser criado um arquivo para cada DTO, fazendo com que fique mais organizado.
ex: CreateBetDTO e dentro deste arquivo pode conter o payload, response e types referente ao create.

---

# 10. Paginação

Todas listagens devem suportar:

```http
?page=1
&limit=20
```

---

## Exemplo

```http
GET /api/v1/bets?page=1&limit=20
```

---

# 11. Ordenação

Todas listagens devem suportar:

```http
?sortBy=createdAt
&sortDirection=asc
```

---

# 12. Filtros

Filtros devem ser explícitos.

### Exemplo

```http
GET /api/v1/bets?status=open
GET /api/v1/bets?matchId=123
```

---

# 13. Escopo por Usuário (B2C)

## Regra Obrigatória

Plataforma **B2C, sem multi-tenant**. Requisição autenticada sobre recurso do
usuário (ex.: `bets`, `alerts`, análises salvas) deve ser escopada pelo `userId`.

O `userId` deve vir do **JWT** (`sub`), nunca do body/query.

> Recursos de **reference data** (`matches`, `teams`, `players`, `events`) são
> globais e não filtram por usuário.

---

## Proibido

```ts
betRepository.findById(id);
```

---

## Obrigatório

```ts
betRepository.findById(id, userId);
```

---

# 14. Segurança

## Nunca retornar

- Senhas
- Tokens
- Segredos
- Chaves privadas
- `external_ref` de provedores externos

---

## Validar sempre

- Ownership (`user_id`) em recursos do usuário
- Permissões
- Escopo correto dos recursos

---

# 15. Idempotência

Endpoints sensíveis devem suportar idempotência.

Exemplos:

- Sincronização de partidas (dedupe por `external_ref`)
- Disparos de mensagens
- Criação de alertas

Header:

```http
Idempotency-Key
```

---

# 16. Auditoria

Operações críticas devem registrar:

- userId
- data/hora
- ação executada

---

# 17. Observabilidade

Toda requisição deve possuir:

```http
X-Request-Id
```

Logs devem incluir:

- requestId
- userId
- endpoint

---

# 18. Convenção de Nomes

## Recursos

Sempre plural.

### Correto

```http
/bets
/matches
/messages
/alerts
```

### Incorreto

```http
/bet
/match
/message
/alert
```

---

# 19. Documentação com Swagger

Toda API deve ser documentada via Swagger (OpenAPI 3.0).

---

## Regras Obrigatórias

- Todo endpoint deve possuir descrição clara
- Todo DTO de input e output deve estar documentado
- Todos os status codes possíveis devem estar mapeados
- Endpoints autenticados devem indicar o esquema de segurança (Bearer JWT)

---

## Decorators por camada (NestJS)

### Controller

```ts
@ApiTags('bets')
@ApiBearerAuth()
@Controller('bets')
export class BetsController {}
```

### Endpoint

```ts
@ApiOperation({ summary: 'Criar uma nova aposta monitorada' })
@ApiResponse({ status: 201, description: 'Aposta criada com sucesso', type: CreateBetResponseDTO })
@ApiResponse({ status: 400, description: 'Payload inválido' })
@ApiResponse({ status: 409, description: 'Aposta já existe' })
@Post()
create(@Body() dto: CreateBetDTO) {}
```

### DTO

```ts
export class CreateBetDTO {
  @ApiProperty({ example: 'match-uuid', description: 'ID da partida' })
  matchId: string;

  @ApiProperty({ example: 4, description: 'Limite de cartões (aposta em menos de N)' })
  threshold: number;

  @ApiProperty({ example: 1.2, description: 'Odd ofertada' })
  odd: number;
}
```

---

## Agrupamento por Tags

Cada módulo deve ter sua própria tag.

```ts
@ApiTags('bets')
@ApiTags('matches')
@ApiTags('messaging')
@ApiTags('analytics')
```

---

## Acesso

O Swagger deve estar disponível apenas em ambientes não-produtivos.

```ts
if (process.env.NODE_ENV !== 'production') {
  SwaggerModule.setup('docs', app, document);
}
```

URL padrão: `/docs`

---

## Node.js puro (sem NestJS)

Usar `swagger-ui-express` + `swagger-jsdoc`.

### Instalação

```bash
npm install swagger-ui-express swagger-jsdoc
```

### Configuração

```ts
// src/docs/swagger.ts
import swaggerJsdoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Football Analytics API',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/**/controller.ts'],
});
```

### Registro no app

```ts
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger';

if (process.env.NODE_ENV !== 'production') {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
```

### Documentando endpoints via JSDoc

```ts
/**
 * @openapi
 * /api/v1/bets:
 *   post:
 *     tags:
 *       - bets
 *     summary: Criar uma nova aposta monitorada
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBetDTO'
 *     responses:
 *       201:
 *         description: Aposta criada com sucesso
 *       400:
 *         description: Payload inválido
 */
router.post('/bets', createBetController);
```

### Documentando schemas de DTO

```ts
/**
 * @openapi
 * components:
 *   schemas:
 *     CreateBetDTO:
 *       type: object
 *       required:
 *         - matchId
 *         - threshold
 *         - odd
 *       properties:
 *         matchId:
 *           type: string
 *           example: match-uuid
 *         threshold:
 *           type: number
 *           example: 4
 *         odd:
 *           type: number
 *           example: 1.20
 */
```

---

# 20. Regra de Ouro

Controllers expõem APIs.

UseCases executam fluxos.

Services executam regras.

Repositories acessam dados.

Cada camada possui apenas uma responsabilidade.

---

# 21. Objetivo

Garantir:

- APIs previsíveis
- Fácil manutenção
- Escalabilidade
- Segurança
- Compatibilidade com IA
- Consistência entre projetos
