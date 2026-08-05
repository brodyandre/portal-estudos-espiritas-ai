import bcrypt from "bcryptjs";
import { Prisma, PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";

const BCRYPT_COST = 10;
const EMAIL_MAX_LENGTH = 254;
const NAME_MAX_LENGTH = 160;
const PASSWORD_MAX_LENGTH = 128;
const MAX_TRANSACTION_ATTEMPTS = 3;

export const BOOTSTRAP_EXIT_CODES = {
  success: 0,
  validation: 1,
  conflict: 2,
  database: 3,
} as const;

type BootstrapExitCode = (typeof BOOTSTRAP_EXIT_CODES)[keyof typeof BOOTSTRAP_EXIT_CODES];

type BootstrapLogEvent =
  | "bootstrap_admin_started"
  | "bootstrap_admin_created"
  | "bootstrap_admin_already_initialized"
  | "bootstrap_admin_conflict"
  | "bootstrap_admin_failed";

type BootstrapLogger = (event: BootstrapLogEvent, details?: Record<string, unknown>) => void;
type BootstrapPrismaClientFactory = () => BootstrapPrismaClient;

export interface BootstrapAdminInput {
  email: string;
  password: string;
  name: string;
}

type BootstrapAdminStatus =
  | "created"
  | "already_initialized"
  | "existing_email_conflict"
  | "existing_admin_conflict"
  | "multiple_admins_conflict"
  | "unique_conflict";

export interface BootstrapAdminResult {
  status: BootstrapAdminStatus;
  exitCode: BootstrapExitCode;
  maskedEmail: string;
  attempts: number;
}

interface BootstrapUserTable {
  count(args: { where: { role: UserRole } }): Promise<number>;
  findUnique(args: { where: { email: string }; select: { id: true; role: true } }): Promise<{
    id: string;
    role: UserRole;
  } | null>;
  create(args: {
    data: {
      fullName: string;
      email: string;
      passwordHash: string;
      role: UserRole;
      status: UserStatus;
      accountActivatedAt: Date;
      temporaryPasswordGeneratedAt: Date;
      mustChangePassword: boolean;
      passwordChangedAt: Date;
    };
    select: { id: true };
  }): Promise<{ id: string }>;
}

interface BootstrapTransactionClient {
  user: BootstrapUserTable;
}

export interface BootstrapPrismaClient {
  $transaction<T>(
    action: (transaction: BootstrapTransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
  $disconnect(): Promise<void>;
}

interface RunBootstrapInitialAdminOptions {
  env?: NodeJS.ProcessEnv;
  logger?: BootstrapLogger;
  createPrismaClient?: BootstrapPrismaClientFactory;
}

class BootstrapValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "BootstrapValidationError";
  }
}

const isBlank = (value: string) => value.trim().length === 0;

const hasExpectedPasswordPolicy = (password: string) => {
  return (
    password.length >= 8 &&
    password.length <= PASSWORD_MAX_LENGTH &&
    !isBlank(password) &&
    /[A-Z]/u.test(password) &&
    /[a-z]/u.test(password) &&
    /\d/u.test(password)
  );
};

export const maskEmail = (email: string) => {
  const [localPart = "", domain = ""] = email.split("@");
  const first = localPart.at(0) ?? "*";

  return `${first}***@${domain}`;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const validateEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email);
};

const validateDatabaseUrl = (databaseUrl: string | undefined) => {
  if (!databaseUrl || isBlank(databaseUrl)) {
    throw new BootstrapValidationError("DATABASE_URL_REQUIRED");
  }

  try {
    const parsedUrl = new URL(databaseUrl);

    if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
      throw new BootstrapValidationError("DATABASE_URL_INVALID");
    }
  } catch (error) {
    if (error instanceof BootstrapValidationError) {
      throw error;
    }

    throw new BootstrapValidationError("DATABASE_URL_INVALID");
  }
};

export const readBootstrapAdminInput = (
  env: NodeJS.ProcessEnv = process.env,
): BootstrapAdminInput => {
  const rawEmail = env.BOOTSTRAP_ADMIN_EMAIL;
  const rawPassword = env.BOOTSTRAP_ADMIN_PASSWORD;
  const rawName = env.BOOTSTRAP_ADMIN_NAME;
  const rawDatabaseUrl = env.DATABASE_URL;

  if (!rawEmail || isBlank(rawEmail)) {
    throw new BootstrapValidationError("BOOTSTRAP_ADMIN_EMAIL_REQUIRED");
  }

  const email = normalizeEmail(rawEmail);

  if (email.length > EMAIL_MAX_LENGTH || !validateEmail(email)) {
    throw new BootstrapValidationError("BOOTSTRAP_ADMIN_EMAIL_INVALID");
  }

  if (!rawName || isBlank(rawName)) {
    throw new BootstrapValidationError("BOOTSTRAP_ADMIN_NAME_REQUIRED");
  }

  const name = rawName.trim();

  if (name.length > NAME_MAX_LENGTH) {
    throw new BootstrapValidationError("BOOTSTRAP_ADMIN_NAME_INVALID");
  }

  if (!rawPassword || !hasExpectedPasswordPolicy(rawPassword)) {
    throw new BootstrapValidationError("BOOTSTRAP_ADMIN_PASSWORD_INVALID");
  }

  validateDatabaseUrl(rawDatabaseUrl);

  return {
    email,
    password: rawPassword,
    name,
  };
};

const isKnownPrismaError = (error: unknown, code: string) => {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
};

const isEmailUniqueConflict = (error: unknown) => {
  if (!isKnownPrismaError(error, "P2002")) {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.includes("email");
  }

  return target === "email" || target === "User_email_key";
};

const writeBootstrapLog: BootstrapLogger = (event, details = {}) => {
  const output = JSON.stringify({
    scope: "initial-admin-bootstrap",
    event,
    ...details,
  });

  if (event === "bootstrap_admin_failed" || event === "bootstrap_admin_conflict") {
    console.error(output);
    return;
  }

  console.info(output);
};

export const bootstrapInitialAdmin = async (
  prisma: BootstrapPrismaClient,
  input: BootstrapAdminInput,
): Promise<BootstrapAdminResult> => {
  const maskedEmail = maskEmail(input.email);

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (transaction) => {
          const adminCount = await transaction.user.count({
            where: { role: UserRole.ADMIN },
          });
          const existingUser = await transaction.user.findUnique({
            where: { email: input.email },
            select: { id: true, role: true },
          });

          if (adminCount === 0) {
            if (existingUser) {
              return {
                status: "existing_email_conflict" as const,
                exitCode: BOOTSTRAP_EXIT_CODES.conflict,
              };
            }

            const credentialChangedAt = new Date();
            const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

            await transaction.user.create({
              data: {
                fullName: input.name,
                email: input.email,
                passwordHash,
                role: UserRole.ADMIN,
                status: UserStatus.ACTIVE,
                accountActivatedAt: credentialChangedAt,
                temporaryPasswordGeneratedAt: credentialChangedAt,
                mustChangePassword: true,
                passwordChangedAt: credentialChangedAt,
              },
              select: { id: true },
            });

            return {
              status: "created" as const,
              exitCode: BOOTSTRAP_EXIT_CODES.success,
            };
          }

          if (existingUser?.role === UserRole.ADMIN && adminCount === 1) {
            return {
              status: "already_initialized" as const,
              exitCode: BOOTSTRAP_EXIT_CODES.success,
            };
          }

          if (adminCount > 1) {
            return {
              status: "multiple_admins_conflict" as const,
              exitCode: BOOTSTRAP_EXIT_CODES.conflict,
            };
          }

          if (existingUser && existingUser.role !== UserRole.ADMIN) {
            return {
              status: "existing_email_conflict" as const,
              exitCode: BOOTSTRAP_EXIT_CODES.conflict,
            };
          }

          return {
            status: "existing_admin_conflict" as const,
            exitCode: BOOTSTRAP_EXIT_CODES.conflict,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return {
        ...result,
        maskedEmail,
        attempts: attempt,
      };
    } catch (error) {
      if (isKnownPrismaError(error, "P2034") && attempt < MAX_TRANSACTION_ATTEMPTS) {
        continue;
      }

      if (isEmailUniqueConflict(error)) {
        return {
          status: "unique_conflict",
          exitCode: BOOTSTRAP_EXIT_CODES.conflict,
          maskedEmail,
          attempts: attempt,
        };
      }

      throw error;
    }
  }

  throw new Error("BOOTSTRAP_RETRY_EXHAUSTED");
};

export const runBootstrapInitialAdmin = async ({
  env = process.env,
  logger = writeBootstrapLog,
  createPrismaClient = () => new PrismaClient(),
}: RunBootstrapInitialAdminOptions = {}) => {
  let prisma: BootstrapPrismaClient | undefined;
  let maskedEmail: string | undefined;
  let exitCode: BootstrapExitCode = BOOTSTRAP_EXIT_CODES.database;

  try {
    const input = readBootstrapAdminInput(env);

    maskedEmail = maskEmail(input.email);
    logger("bootstrap_admin_started", { email: maskedEmail });

    prisma = createPrismaClient();
    const result = await bootstrapInitialAdmin(prisma, input);

    if (result.status === "created") {
      logger("bootstrap_admin_created", {
        email: result.maskedEmail,
        attempts: result.attempts,
      });
      exitCode = result.exitCode;
    } else if (result.status === "already_initialized") {
      logger("bootstrap_admin_already_initialized", {
        email: result.maskedEmail,
        attempts: result.attempts,
      });
      exitCode = result.exitCode;
    } else {
      logger("bootstrap_admin_conflict", {
        email: result.maskedEmail,
        status: result.status,
        attempts: result.attempts,
      });
      exitCode = result.exitCode;
    }
  } catch (error) {
    if (error instanceof BootstrapValidationError) {
      logger("bootstrap_admin_failed", { reason: error.code });
      exitCode = BOOTSTRAP_EXIT_CODES.validation;
    } else {
      const errorCode =
        error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "DATABASE_OPERATION_FAILED";
      logger("bootstrap_admin_failed", {
        email: maskedEmail,
        reason: errorCode,
      });
      exitCode = BOOTSTRAP_EXIT_CODES.database;
    }
  } finally {
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch {
        logger("bootstrap_admin_failed", {
          email: maskedEmail,
          reason: "DATABASE_DISCONNECT_FAILED",
        });
        exitCode = BOOTSTRAP_EXIT_CODES.database;
      }
    }
  }

  return exitCode;
};

const main = async () => {
  config({ path: resolve(__dirname, "../../../.env"), quiet: true });
  const exitCode = await runBootstrapInitialAdmin();
  process.exitCode = exitCode;
};

if (require.main === module) {
  void main();
}
