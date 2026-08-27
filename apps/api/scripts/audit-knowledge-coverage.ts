import { PrismaClient } from "@prisma/client";

import {
  buildKnowledgeCoverageReport,
  createPrismaKnowledgeCoverageRepository,
} from "../src/knowledge/coverage";
import {
  buildKnowledgeEditorialManifest,
  createPrismaKnowledgeManifestRepository,
} from "../src/knowledge/manifest";

const prisma = new PrismaClient({ log: [] });

const main = async () => {
  const report = await buildKnowledgeCoverageReport({
    repository: createPrismaKnowledgeCoverageRepository(prisma),
    loadManifest: () => buildKnowledgeEditorialManifest({
      repository: createPrismaKnowledgeManifestRepository(prisma),
    }),
  });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.status === "ready" ? 0 : 1;
};

main()
  .catch(() => {
    console.log(JSON.stringify({
      status: "unavailable",
      manifestStatus: "unavailable",
      targetBookCount: 0,
      coveredBookCount: 0,
      uncoveredBookCount: 0,
      manifestSourceCount: 0,
      books: [],
      manifestIssues: [{ code: "KNOWLEDGE_COVERAGE_UNEXPECTED_FAILURE" }],
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
