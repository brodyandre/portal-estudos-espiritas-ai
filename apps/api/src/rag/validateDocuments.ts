import { validateKnowledgeDocuments } from "./documentLoader";

const run = async () => {
  const result = await validateKnowledgeDocuments();

  console.log(`[rag] documentos carregados: ${result.documents.length}`);

  if (result.issues.length === 0) {
    console.log("[rag] nenhum problema encontrado.");
  } else {
    for (const issue of result.issues) {
      console.log(`[rag] ${issue.severity.toUpperCase()} ${issue.source}: ${issue.message}`);
    }
  }

  if (!result.valid) {
    process.exitCode = 1;
    return;
  }

  console.log("[rag] validacao concluida com sucesso.");
};

void run();
