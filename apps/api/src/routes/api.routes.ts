import { Router } from "express";

import { agentRouter } from "../modules/agent/agent.routes";
import { adminRouter } from "../modules/admin/admin.routes";
import { authRouter } from "../modules/auth/auth.routes";
import { enrollmentsRouter } from "../modules/enrollments/enrollments.routes";
import { knowledgeRouter } from "../modules/knowledge/knowledge.routes";
import { materialsRouter } from "../modules/materials/materials.routes";
import { meRouter } from "../modules/me/me.routes";
import { progressRouter } from "../modules/progress/progress.routes";
import { questionsRouter } from "../modules/questions/questions.routes";
import { studiesRouter } from "../modules/studies/studies.routes";
import { summariesRouter } from "../modules/summaries/summaries.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/me", meRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/studies", studiesRouter);
apiRouter.use("/summaries", summariesRouter);
apiRouter.use("/questions", questionsRouter);
apiRouter.use("/materials", materialsRouter);
apiRouter.use("/progress", progressRouter);
apiRouter.use("/agent", agentRouter);
apiRouter.use("/knowledge", knowledgeRouter);
apiRouter.use("/enrollments", enrollmentsRouter);
