# Testing Standards (SDD)

Este documento define os padrões obrigatórios para testes do backend da aplicação.

Ele serve como fonte única de verdade para desenvolvedores e ferramentas de IA (Copilot, Claude Code, etc).

---

# 1. Princípios

Todo teste deve seguir:

- Testes devem ser independentes entre si
- Testes não devem depender de ordem de execução
- Testes não devem compartilhar estado
- Nomes descritivos — o teste deve documentar o comportamento
- Falha deve indicar exatamente o que quebrou

---

# 2. Tipos de Teste

| Tipo            | O que testa                   | Velocidade | Onde usar          |
| --------------- | ----------------------------- | ---------- | ------------------ |
| **Unit**        | Função/classe isolada         | Rápido     | UseCases, Services |
| **Integration** | Módulo com dependências reais | Médio      | Repository + DB    |
| **E2E**         | Fluxo completo via HTTP       | Lento      | Endpoints críticos |

---

# 3. O que Deve ser Testado

## Obrigatório

- Todo **UseCase** deve ter testes unitários
- Todo **Service** com regra de negócio deve ter testes unitários
- Endpoints críticos devem ter testes E2E

## Opcional

- Controllers (cobertos pelo E2E)
- Repositories (cobertos pela integration)

---

# 4. Testes Unitários

Testam um UseCase ou Service de forma isolada, com dependências mockadas.

## Estrutura

```
modules/
  users/
    application/
      useCases/
        create-user.usecase.ts
        create-user.usecase.spec.ts
```

## Exemplo — CreateUserUseCase

```ts
describe("CreateUserUseCase", () => {
  let useCase: CreateUserUseCase;
  let userRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    } as any;

    useCase = new CreateUserUseCase(userRepository);
  });

  it("deve criar um usuário com sucesso", async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue({
      id: "uuid",
      name: "João",
    } as any);

    const result = await useCase.execute({
      name: "João",
      email: "joao@email.com",
      password: "123456",
    });

    expect(result.id).toBeDefined();
    expect(userRepository.create).toHaveBeenCalledTimes(1);
  });

  it("deve lançar erro se e-mail já existir", async () => {
    userRepository.findByEmail.mockResolvedValue({ id: "uuid" } as any);

    await expect(
      useCase.execute({
        name: "João",
        email: "joao@email.com",
        password: "123456",
      }),
    ).rejects.toThrow("EMAIL_ALREADY_EXISTS");
  });
});
```

---

# 5. Testes de Integração

Testam o Repository com banco de dados real (banco de teste).

## Regras

- Usar banco dedicado para testes (`NODE_ENV=test`)
- Limpar dados entre testes (`beforeEach` / `afterEach`)
- Nunca rodar contra banco de produção ou staging

## Exemplo — BetRepository (ownership por `user_id`)

```ts
describe("BetRepository (integration)", () => {
  beforeEach(async () => {
    await db("bets").del();
  });

  it("deve encontrar aposta do próprio usuário", async () => {
    await db("bets").insert({
      id: "uuid-1",
      user_id: "user-1",
      match_id: "match-1",
    });

    const bet = await betRepository.findById("uuid-1", "user-1");

    expect(bet).not.toBeNull();
  });

  it("não deve retornar aposta de outro usuário", async () => {
    await db("bets").insert({
      id: "uuid-1",
      user_id: "user-2",
      match_id: "match-1",
    });

    const bet = await betRepository.findById("uuid-1", "user-1");

    expect(bet).toBeNull();
  });
});
```

---

# 6. Testes E2E

Testam o fluxo completo via HTTP, simulando um cliente real.

## Regras

- Usar `supertest` ou equivalente
- Rodar contra servidor real em memória
- Limpar banco entre testes

## Exemplo — POST /api/v1/users

```ts
describe("POST /api/v1/users", () => {
  it("deve criar usuário e retornar 201", async () => {
    const response = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "João",
        email: "joao@email.com",
        password: "123456",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
  });

  it("deve retornar 409 se e-mail já existir", async () => {
    await createUserFixture({ email: "joao@email.com" });

    const response = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "João", email: "joao@email.com", password: "123456" });

    expect(response.status).toBe(409);
  });
});
```

---

# 7. Convenções de Nomenclatura

## Arquivos

```
create-user.usecase.spec.ts
user.repository.spec.ts
users.e2e.spec.ts
```

## Descrição dos testes

Seguir o padrão: **deve + comportamento esperado**

```ts
it("deve criar um usuário com sucesso");
it("deve lançar erro se e-mail já existir");
it("não deve retornar aposta de outro usuário");
```

---

# 8. Cobertura Mínima

| Camada       | Cobertura mínima         |
| ------------ | ------------------------ |
| UseCases     | 80%                      |
| Services     | 80%                      |
| Repositórios | Cobertos por integration |
| Controllers  | Cobertos por E2E         |

---

# 9. Regra de Ouro

> Um teste que passa sempre, mesmo quando o código está errado, é pior do que não ter teste.

> Teste o comportamento, não a implementação.
