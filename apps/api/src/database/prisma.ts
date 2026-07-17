import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __portalEstudosPrisma__: PrismaClient | undefined;
}

const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

export const getPrismaClient = () => {
  if (!globalThis.__portalEstudosPrisma__) {
    globalThis.__portalEstudosPrisma__ = createPrismaClient();
  }

  return globalThis.__portalEstudosPrisma__;
};

export const disconnectPrisma = async () => {
  if (!globalThis.__portalEstudosPrisma__) {
    return;
  }

  await globalThis.__portalEstudosPrisma__.$disconnect();
};
