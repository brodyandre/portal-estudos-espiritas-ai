import { Router } from "express";

import { sendSuccess } from "../lib/api-response";
import { asyncHandler } from "../lib/async-handler";

export const healthRouter = Router();

healthRouter.get(
  "/health",
  asyncHandler((_request, response) => {
    response.setHeader("Cache-Control", "no-store");

    return sendSuccess(response, {
      message: "API funcionando normalmente.",
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
      },
    });
  }),
);
