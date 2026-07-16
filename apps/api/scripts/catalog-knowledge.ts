import { catalogKnowledgeBase } from "../src/modules/admin/knowledge/catalog";

const main = async () => {
  const result = await catalogKnowledgeBase();
  console.log(JSON.stringify(result, null, 2));

  if (result.failedEntries.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
