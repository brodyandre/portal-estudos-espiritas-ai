import { app } from "./app";
import { env } from "./config/env";
import { disconnectPrisma } from "./database/prisma";
import { createGracefulShutdown, installGracefulShutdownHandlers } from "./server/graceful-shutdown";

export const startServer = () => {
  const server = app.listen(env.port, () => {
    console.log(`[api] servidor iniciado em http://localhost:${env.port}`);
  });

  const gracefulShutdown = createGracefulShutdown({
    server,
    disconnect: disconnectPrisma,
    logger: (message, details) => console.log(message, details ?? ""),
    exit: (code) => process.exit(code),
  });

  installGracefulShutdownHandlers(gracefulShutdown.shutdown);

  return {
    server,
    shutdown: gracefulShutdown.shutdown,
  };
};

if (require.main === module) {
  startServer();
}
