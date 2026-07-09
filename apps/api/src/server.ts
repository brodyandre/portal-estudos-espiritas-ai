import { app } from "./app";
import { env } from "./config/env";

app.listen(env.port, () => {
  console.log(`[api] servidor iniciado em http://localhost:${env.port}`);
});
