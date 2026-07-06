# Backend Standards (SDD)

Este documento define todos os padrões obrigatórios para desenvolvimento do backend da aplicação.

Ele serve como fonte única de verdade para desenvolvedores e ferramentas de IA (Copilot, Claude Code, etc).

---

# 1. Princípios Arquiteturais

Todo o backend deve seguir:

- SOLID
- Clean Code
- KISS (Keep It Simple, Stupid)
- Separation of Concerns
- Explicit over Implicit
- Fail Fast

---

# 2. Arquitetura Base

Toda feature backend deve seguir a estrutura:

Controller → UseCase → Repository

Services são opcionais e criados apenas quando há lógica de domínio reutilizável entre múltiplos UseCases:

Controller → UseCase → Service (quando necessário) + Repository

---

## 2.1 Responsabilidade de cada camada

### Controller

- Recebe requests HTTP
- Valida entrada básica (DTO / schema)
- Não contém regra de negócio
- Retorna response formatada

---

### UseCase

- Orquestra a regra de negócio principal
- Ponto central da feature
- Deve ter apenas um método público: `execute`
- Não deve conter lógica de infraestrutura (HTTP, DB direto)
- Pode se comunicar diretamente com Repositories
- Deve usar um Service quando a lógica for reutilizável por outros UseCases

---

### Service

- **Opcional** — criado apenas quando há lógica reutilizável real entre UseCases
- Não deve ser um wrapper de Repository (anti-pattern)
- Encapsula regras de domínio complexas, cálculos ou validações reaproveitáveis
- Pode ser usado por múltiplos UseCases
- Não depende de camada HTTP

**Quando criar um Service:**

- A mesma lógica é usada por 2+ UseCases
- A lógica envolve múltiplos passos ou dependências que merecem isolação
- Ex: `CodeValidationService` usado por `ValidateEmailUseCase` e `ValidatePhoneUseCase`

**Quando NÃO criar um Service:**

- A lógica existe em apenas 1 UseCase
- Seria apenas um wrapper de `repository.findById()` ou similar

---

### Repository

- Comunicação com banco de dados
- Não contém regra de negócio
- Apenas CRUD e queries
- Toda comunicação deve conter try catch e lançar exessões de erro com banco

---

# 3. Padrão de UseCase

Todo UseCase deve seguir:

- Apenas 1 método público: `execute`
- Nome descritivo da ação
- Receber dependências via constructor
- Ser independente de framework

### Exemplo:

```ts
class CreateBetUseCase {
  constructor(
    private betRepository: BetRepository,
    private matchRepository: MatchRepository,
  ) {}

  async execute(input: CreateBetInput): Promise<CreateBetOutput> {
    // regras de negócio aqui
  }
}
```

---

# 4. Injeção de Dependência

Sempre via constructor
Nunca instanciar dependências dentro das classes

## Errado:

```ts
const repo = new BetRepository();
```

## Certo:

```ts
constructor(private repo: BetRepository)
```

---

# 5. Convenções de Código

- Funções: camelCase
- Variveis: camelCase
- Classes: PascalCase
- Arquivos: kebab-case
- DTOs: sufixo DTO
- UseCases: sufixo UseCase
- Repositories: sufixo Repository

---

# 6. Estrutura de Código

Cada feature deve seguir:

```
feature/
  controller
  useCases/
  services/
  repositories/
  dtos/
```

# 7. Padrão de API

## 7.1 Rotas

- Sempre no plural
- Representam recursos, não ações

### Certo:

```
GET /bets
POST /bets
PUT /bets/:id
DELETE /bets/:id
```

### Errado:

```
POST /createBet
POST /deleteBet
```

## 7.2 Actions específicas

Quando necessário:

```
7.2 Actions específicas

Quando necessário:
```

## 7.3 Response padrão

```
{
  "success": true,
  "data": {},
  "error": null
}
```

# 8. Tratamento de Erros

Nunca usar Error genérico
Sempre usar AppError ou equivalente

## Exemplo:

```ts
throw new AppError('BET_NOT_FOUND', 404);
```

## Regras:

- Controller não decide lógica de erro
- UseCase decide regras de erro
- Erros devem ser previsíveis e tipados
- Toda pasta deve ter um arquivo index.ts exportando todo o conteudo interno(ex: useCases/index.ts)

# 9. Regras de Qualidade de Código

- Funções pequenas e com responsabilidade única
- Evitar nested conditions profundas
- Evitar duplicação de lógica
- Código deve ser legível sem comentários
- Preferir clareza ao invés de “genialidade”

# 10. Logging

- Logs devem ser estruturados
- Nunca logar dados sensíveis
- Sempre incluir contexto:

## Exemplo:

- userId
- requestId
- featureName

# 11. Banco de Dados

Tabelas: snake_case

- Colunas consistentes em toda aplicação
- Usar:
  id (UUID)
  created_at
  updated_at
  deleted_at (soft delete quando necessário)

# 12. Testes

Regras gerais:

- UseCases devem ser testáveis isoladamente
- Testes devem validar comportamento, não implementação
- Evitar mocks excessivos de domínio

## Tipos de teste:

- Unitários → UseCases e Services
- Integração → Repositories
- E2E → Fluxos completos

# 13. Segurança

- Nunca expor stack trace para cliente
- Validar input sempre
- Nunca confiar no frontend
- Sensível sempre deve ser mascarado

# 14. Regra de Ouro do Backend

- Controllers não sabem de regra de negócio
- UseCases não sabem de HTTP
- Services não sabem de HTTP
- Repositories não sabem de regra de negócio

Cada camada só sabe o que precisa saber.

# 15. Objetivo deste padrão

Garantir que:

- Código seja previsível
- IA consiga gerar código consistente
- Time trabalhe com baixo retrabalho
- Arquitetura escale sem refactor constante
