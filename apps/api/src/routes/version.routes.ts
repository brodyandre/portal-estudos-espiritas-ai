import { Router } from "express";

import { sendSuccess } from "../lib/api-response";
import { asyncHandler } from "../lib/async-handler";

export interface RevisionMetadata {
  revision: string;
}

export interface RevisionMetadataSource {
  RENDER_GIT_COMMIT?: string;
}

const UNKNOWN_REVISION = "unknown";
const GIT_COMMIT_SHA_PATTERN = /^[0-9a-fA-F]{40}$/u;

export const resolveRevisionMetadata = (
  source: RevisionMetadataSource = process.env,
): RevisionMetadata => {
  const revision = source.RENDER_GIT_COMMIT?.trim() ?? "";

  if (!GIT_COMMIT_SHA_PATTERN.test(revision)) {
    return {
      revision: UNKNOWN_REVISION,
    };
  }

  return {
    revision: revision.toLowerCase(),
  };
};

export const versionRouter = Router();

versionRouter.get(
  "/version",
  asyncHandler((_request, response) => {
    response.setHeader("Cache-Control", "no-store");

    return sendSuccess(response, {
      message: "Metadata de revisão da API carregada com sucesso.",
      data: resolveRevisionMetadata(),
    });
  }),
);
