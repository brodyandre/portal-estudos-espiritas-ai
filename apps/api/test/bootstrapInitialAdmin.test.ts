import bcrypt from "bcryptjs";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BOOTSTRAP_EXIT_CODES,
  bootstrapInitialAdmin,
  maskEmail,
  readBootstrapAdminInput,
  runBootstrapInitialAdmin,
  type BootstrapPrismaClient,
} from "../scripts/bootstrap-initial-admin";

type StoredUser = {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  accountActivatedAt: Date | null;
  temporaryPasswordGeneratedAt: Date | null;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
};

const localDatabaseUrl = `postgresql${"://"}usuario:senha@127.0.0.1:5432/banco`;

const makeKnownPrismaError = (code: string, meta?: Record<string, unknown>) => {
  return new Prisma.PrismaClientKnownRequestError("Prisma request failed.", {
    code,
    clientVersion: "test",
    meta,
  });
};

const createPrismaHarness = (
  initialUsers: StoredUser[] = [],
  options: {
    failWithSerializationAttempts?: number;
    failWithUniqueConflict?: "email" | "unknown";
    failWithCommonError?: boolean;
    failDisconnect?: boolean;
  } = {},
) => {
  const users = [...initialUsers];
  const transactionOptions: Array<{ isolationLevel?: Prisma.TransactionIsolationLevel }> = [];
  let transactionAttempts = 0;
  let disconnected = false;

  const prisma: BootstrapPrismaClient = {
    async $transaction(action, transactionOption) {
      transactionAttempts += 1;
      transactionOptions.push(transactionOption ?? {});

      if (
        options.failWithSerializationAttempts &&
        transactionAttempts <= options.failWithSerializationAttempts
      ) {
        throw makeKnownPrismaError("P2034");
      }

      if (options.failWithCommonError) {
        throw new Error("erro comum");
      }

      return action({
        user: {
          async count(args) {
            return users.filter((user) => user.role === args.where.role).length;
          },
          async findUnique(args) {
            const user = users.find((item) => item.email === args.where.email);

            if (!user) {
              return null;
            }

            return {
              id: user.id,
              role: user.role,
            };
          },
          async create(args) {
            if (options.failWithUniqueConflict) {
              throw makeKnownPrismaError(
                "P2002",
                options.failWithUniqueConflict === "email" ? { target: ["email"] } : undefined,
              );
            }

            const createdUser: StoredUser = {
              id: `user-${users.length + 1}`,
              fullName: args.data.fullName,
              email: args.data.email,
              passwordHash: args.data.passwordHash,
              role: args.data.role,
              status: args.data.status,
              accountActivatedAt: args.data.accountActivatedAt,
              temporaryPasswordGeneratedAt: args.data.temporaryPasswordGeneratedAt,
              mustChangePassword: args.data.mustChangePassword,
              passwordChangedAt: args.data.passwordChangedAt,
            };

            users.push(createdUser);
            return { id: createdUser.id };
          },
        },
      });
    },
    async $disconnect() {
      if (options.failDisconnect) {
        throw new Error("disconnect sensivel");
      }

      disconnected = true;
    },
  };

  return {
    prisma,
    users,
    transactionOptions,
    get transactionAttempts() {
      return transactionAttempts;
    },
    get disconnected() {
      return disconnected;
    },
  };
};

const validEnv = {
  DATABASE_URL: localDatabaseUrl,
  BOOTSTRAP_ADMIN_EMAIL: "  ADMIN@Example.COM ",
  BOOTSTRAP_ADMIN_PASSWORD: "SenhaForte123",
  BOOTSTRAP_ADMIN_NAME: "  Administradora Inicial ",
};

const createUser = (overrides: Partial<StoredUser> = {}): StoredUser => ({
  id: "user-existing",
  fullName: "Pessoa Existente",
  email: "pessoa@example.com",
  passwordHash: "hash-existente",
  role: UserRole.STUDENT,
  status: UserStatus.ACTIVE,
  accountActivatedAt: new Date("2026-01-01T00:00:00.000Z"),
  temporaryPasswordGeneratedAt: null,
  mustChangePassword: false,
  passwordChangedAt: null,
  ...overrides,
});

describe("bootstrap inicial seguro do administrador", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normaliza e valida os dados de ambiente exigidos", () => {
    expect(readBootstrapAdminInput(validEnv)).toEqual({
      email: "admin@example.com",
      password: "SenhaForte123",
      name: "Administradora Inicial",
    });
  });

  it.each([
    [{ ...validEnv, BOOTSTRAP_ADMIN_EMAIL: "" }],
    [{ ...validEnv, BOOTSTRAP_ADMIN_EMAIL: "sem-arroba" }],
    [{ ...validEnv, BOOTSTRAP_ADMIN_EMAIL: `${"a".repeat(245)}@example.com` }],
    [{ ...validEnv, BOOTSTRAP_ADMIN_NAME: " " }],
    [{ ...validEnv, BOOTSTRAP_ADMIN_NAME: "a".repeat(161) }],
    [{ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: "curta1A" }],
    [{ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: "semnumeroA" }],
    [{ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: "semmaiuscula1" }],
    [{ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: "SEMMINUSCULA1" }],
    [{ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: "a".repeat(129) }],
    [{ ...validEnv, BOOTSTRAP_ADMIN_PASSWORD: "        " }],
    [{ ...validEnv, DATABASE_URL: "" }],
    [{ ...validEnv, DATABASE_URL: "https://example.com/db" }],
  ])("rejeita configuracao invalida sem conectar no banco", (env) => {
    expect(() => readBootstrapAdminInput(env)).toThrow();
  });

  it("cria o primeiro admin ativo com senha temporaria e hash bcrypt", async () => {
    const hashSpy = vi.spyOn(bcrypt, "hash");
    const harness = createPrismaHarness();
    const input = readBootstrapAdminInput(validEnv);

    const result = await bootstrapInitialAdmin(harness.prisma, input);

    expect(result).toMatchObject({
      status: "created",
      exitCode: BOOTSTRAP_EXIT_CODES.success,
      maskedEmail: "a***@example.com",
      attempts: 1,
    });
    expect(hashSpy).toHaveBeenCalledWith("SenhaForte123", 10);
    expect(harness.transactionOptions).toEqual([
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ]);
    expect(harness.users).toHaveLength(1);
    expect(harness.users[0]).toMatchObject({
      fullName: "Administradora Inicial",
      email: "admin@example.com",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
    });
    expect(harness.users[0].passwordHash).not.toBe("SenhaForte123");
    await expect(bcrypt.compare("SenhaForte123", harness.users[0].passwordHash)).resolves.toBe(true);
    expect(harness.users[0].accountActivatedAt).toBeInstanceOf(Date);
    expect(harness.users[0].temporaryPasswordGeneratedAt).toBeInstanceOf(Date);
    expect(harness.users[0].passwordChangedAt).toBeInstanceOf(Date);
  });

  it("e idempotente quando o mesmo e unico admin ja existe", async () => {
    const existingAdmin = createUser({
      email: "admin@example.com",
      role: UserRole.ADMIN,
      passwordHash: "hash-original",
    });
    const harness = createPrismaHarness([existingAdmin]);

    const result = await bootstrapInitialAdmin(harness.prisma, readBootstrapAdminInput(validEnv));

    expect(result.status).toBe("already_initialized");
    expect(result.exitCode).toBe(BOOTSTRAP_EXIT_CODES.success);
    expect(harness.users).toEqual([existingAdmin]);
  });

  it("falha em conflito quando o email pertence a usuario nao admin", async () => {
    const existingUser = createUser({
      email: "admin@example.com",
      role: UserRole.STUDENT,
    });
    const harness = createPrismaHarness([existingUser]);

    const result = await bootstrapInitialAdmin(harness.prisma, readBootstrapAdminInput(validEnv));

    expect(result.status).toBe("existing_email_conflict");
    expect(result.exitCode).toBe(BOOTSTRAP_EXIT_CODES.conflict);
    expect(harness.users).toEqual([existingUser]);
  });

  it("falha em conflito quando ja existe outro admin", async () => {
    const harness = createPrismaHarness([
      createUser({
        email: "outra-admin@example.com",
        role: UserRole.ADMIN,
      }),
    ]);

    const result = await bootstrapInitialAdmin(harness.prisma, readBootstrapAdminInput(validEnv));

    expect(result.status).toBe("existing_admin_conflict");
    expect(result.exitCode).toBe(BOOTSTRAP_EXIT_CODES.conflict);
    expect(harness.users).toHaveLength(1);
  });

  it("falha em conflito quando ha mais de um admin", async () => {
    const harness = createPrismaHarness([
      createUser({ id: "admin-1", email: "admin-1@example.com", role: UserRole.ADMIN }),
      createUser({ id: "admin-2", email: "admin-2@example.com", role: UserRole.ADMIN }),
    ]);

    const result = await bootstrapInitialAdmin(harness.prisma, readBootstrapAdminInput(validEnv));

    expect(result.status).toBe("multiple_admins_conflict");
    expect(result.exitCode).toBe(BOOTSTRAP_EXIT_CODES.conflict);
    expect(harness.users).toHaveLength(2);
  });

  it("prioriza conflito de multiplos admins quando o email pertence a usuario comum", async () => {
    const harness = createPrismaHarness([
      createUser({ id: "admin-1", email: "admin-1@example.com", role: UserRole.ADMIN }),
      createUser({ id: "admin-2", email: "admin-2@example.com", role: UserRole.ADMIN }),
      createUser({ id: "student-1", email: "admin@example.com", role: UserRole.STUDENT }),
    ]);

    const result = await bootstrapInitialAdmin(harness.prisma, readBootstrapAdminInput(validEnv));

    expect(result.status).toBe("multiple_admins_conflict");
    expect(result.exitCode).toBe(BOOTSTRAP_EXIT_CODES.conflict);
    expect(harness.users).toHaveLength(3);
  });

  it("faz retry limitado apenas para conflito serializavel", async () => {
    const harness = createPrismaHarness([], { failWithSerializationAttempts: 1 });

    const result = await bootstrapInitialAdmin(harness.prisma, readBootstrapAdminInput(validEnv));

    expect(result.status).toBe("created");
    expect(result.attempts).toBe(2);
    expect(harness.transactionAttempts).toBe(2);
  });

  it("esgota retry de conflito serializavel apos tres tentativas", async () => {
    const harness = createPrismaHarness([], { failWithSerializationAttempts: 3 });

    await expect(bootstrapInitialAdmin(harness.prisma, readBootstrapAdminInput(validEnv))).rejects.toMatchObject({
      code: "P2034",
    });
    expect(harness.transactionAttempts).toBe(3);
  });

  it("nao repete erro comum de banco", async () => {
    const harness = createPrismaHarness([], { failWithCommonError: true });

    await expect(bootstrapInitialAdmin(harness.prisma, readBootstrapAdminInput(validEnv))).rejects.toThrow(
      "erro comum",
    );
    expect(harness.transactionAttempts).toBe(1);
  });

  it("trata violacao unica de email como conflito controlado", async () => {
    const harness = createPrismaHarness([], { failWithUniqueConflict: "email" });

    const result = await bootstrapInitialAdmin(harness.prisma, readBootstrapAdminInput(validEnv));

    expect(result.status).toBe("unique_conflict");
    expect(result.exitCode).toBe(BOOTSTRAP_EXIT_CODES.conflict);
    expect(harness.users).toHaveLength(0);
  });

  it("nao mascara P2002 sem target de email como sucesso ou conflito esperado", async () => {
    const harness = createPrismaHarness([], { failWithUniqueConflict: "unknown" });

    await expect(bootstrapInitialAdmin(harness.prisma, readBootstrapAdminInput(validEnv))).rejects.toMatchObject({
      code: "P2002",
    });
    expect(harness.users).toHaveLength(0);
  });

  it("retorna codigo 1 sem abrir transacao quando a configuracao e invalida", async () => {
    const harness = createPrismaHarness();
    const logs: string[] = [];
    let factoryCalls = 0;

    const exitCode = await runBootstrapInitialAdmin({
      env: {
        ...validEnv,
        BOOTSTRAP_ADMIN_PASSWORD: "fraca",
      },
      createPrismaClient: () => {
        factoryCalls += 1;
        return harness.prisma;
      },
      logger: (event, details) => logs.push(JSON.stringify({ event, details })),
    });

    expect(exitCode).toBe(BOOTSTRAP_EXIT_CODES.validation);
    expect(factoryCalls).toBe(0);
    expect(harness.transactionAttempts).toBe(0);
    expect(harness.disconnected).toBe(false);
    expect(logs.join("\n")).not.toContain("fraca");
    expect(logs.join("\n")).not.toContain(`postgresql${"://"}`);
  });

  it("retorna codigo 1 quando DATABASE_URL esta ausente sem criar PrismaClient", async () => {
    const harness = createPrismaHarness();
    const logs: string[] = [];
    let factoryCalls = 0;

    const exitCode = await runBootstrapInitialAdmin({
      env: {
        BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
        BOOTSTRAP_ADMIN_PASSWORD: "SenhaForte123",
        BOOTSTRAP_ADMIN_NAME: "Admin",
      },
      createPrismaClient: () => {
        factoryCalls += 1;
        return harness.prisma;
      },
      logger: (event, details) => logs.push(JSON.stringify({ event, details })),
    });

    expect(exitCode).toBe(BOOTSTRAP_EXIT_CODES.validation);
    expect(factoryCalls).toBe(0);
    expect(harness.transactionAttempts).toBe(0);
    expect(logs.join("\n")).toContain("DATABASE_URL_REQUIRED");
  });

  it("desconecta e sanitiza logs apos execucao com sucesso", async () => {
    const harness = createPrismaHarness();
    const logs: string[] = [];

    const exitCode = await runBootstrapInitialAdmin({
      env: validEnv,
      createPrismaClient: () => harness.prisma,
      logger: (event, details) => logs.push(JSON.stringify({ event, details })),
    });

    expect(exitCode).toBe(BOOTSTRAP_EXIT_CODES.success);
    expect(harness.disconnected).toBe(true);
    expect(logs.join("\n")).toContain("a***@example.com");
    expect(logs.join("\n")).not.toContain("ADMIN@Example.COM");
    expect(logs.join("\n")).not.toContain("SenhaForte123");
    expect(logs.join("\n")).not.toContain("passwordHash");
  });

  it("retorna codigo 3 para erro de banco sem expor detalhes sensiveis", async () => {
    const prisma = createPrismaHarness().prisma;
    const logs: string[] = [];
    vi.spyOn(prisma, "$transaction").mockRejectedValue(
      new Error(`erro interno sensivel SenhaSentinela123 ${localDatabaseUrl} hash-ficticio`),
    );

    const exitCode = await runBootstrapInitialAdmin({
      env: validEnv,
      createPrismaClient: () => prisma,
      logger: (event, details) => logs.push(JSON.stringify({ event, details })),
    });

    expect(exitCode).toBe(BOOTSTRAP_EXIT_CODES.database);
    expect(logs.join("\n")).toContain("DATABASE_OPERATION_FAILED");
    expect(logs.join("\n")).not.toContain("erro interno sensivel");
    expect(logs.join("\n")).not.toContain("SenhaSentinela123");
    expect(logs.join("\n")).not.toContain(localDatabaseUrl);
    expect(logs.join("\n")).not.toContain("hash-ficticio");
  });

  it("retorna codigo 3 quando o disconnect falha sem expor detalhes", async () => {
    const harness = createPrismaHarness([], { failDisconnect: true });
    const logs: string[] = [];

    const exitCode = await runBootstrapInitialAdmin({
      env: validEnv,
      createPrismaClient: () => harness.prisma,
      logger: (event, details) => logs.push(JSON.stringify({ event, details })),
    });

    expect(exitCode).toBe(BOOTSTRAP_EXIT_CODES.database);
    expect(logs.join("\n")).toContain("DATABASE_DISCONNECT_FAILED");
    expect(logs.join("\n")).not.toContain("disconnect sensivel");
  });

  it("mascara emails sem revelar a parte local completa", () => {
    expect(maskEmail("admin@example.com")).toBe("a***@example.com");
  });
});
