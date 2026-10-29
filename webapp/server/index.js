import { createApp } from "./app.js";
import { config } from "./config.js";
import { openDb } from "./db.js";
import { MlWorker } from "./worker.js";

const db = openDb();
const worker = new MlWorker();
console.log(`Starting ML worker with ${config.pythonBin} ...`);
await worker.start().catch((err) => {
  console.error(`\n${err.message}\nMake sure the model is trained: python -m src.train\n`);
  process.exit(1);
});

const app = createApp({ db, worker });
const server = app.listen(config.port, () => {
  console.log(`Churn Insight API ready on http://localhost:${config.port}`);
  console.log("Demo logins: admin / admin123 and analyst / analyst123");
});
const shutdown = () => { worker.stop(); server.close(() => process.exit(0)); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
