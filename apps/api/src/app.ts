import cors from "cors";
import express from "express";

import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import { requestLogger } from "./middleware/request-logger";
import { apiRouter } from "./routes/api.routes";
import { healthRouter } from "./routes/health.routes";

const isAllowedLocalOrigin = (origin: string): boolean => {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/u.test(origin);
};

export const app = express();

app.use(requestLogger);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin) || isAllowedLocalOrigin(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
  }),
);
app.use(express.json());

app.use(healthRouter);
app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
