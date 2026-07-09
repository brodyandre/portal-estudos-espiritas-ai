import { Router } from "express";

import { agentRouter } from "../modules/agent/agent.routes";
import { materialsRouter } from "../modules/materials/materials.routes";
import { progressRouter } from "../modules/progress/progress.routes";
import { questionsRouter } from "../modules/questions/questions.routes";
import { studiesRouter } from "../modules/studies/studies.routes";
import { summariesRouter } from "../modules/summaries/summaries.routes";

export const apiRouter = Router();

apiRouter.use("/studies", studiesRouter);
apiRouter.use("/summaries", summariesRouter);
apiRouter.use("/questions", questionsRouter);
apiRouter.use("/materials", materialsRouter);
apiRouter.use("/progress", progressRouter);
apiRouter.use("/agent", agentRouter);
