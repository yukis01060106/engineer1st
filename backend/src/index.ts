import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { mypageRouter } from "./routes/mypage";
import { projectsRouter } from "./routes/projects";
import { rewardSimRouter } from "./routes/rewardSim";
import { skillSheetRouter } from "./routes/skillSheet";
import { moneyRouter } from "./routes/money";
import { eventsRouter } from "./routes/events";
import { mentorRouter } from "./routes/mentor";
import { chatRouter } from "./routes/chat";
import { skillGapRouter } from "./routes/skillGap";
import { contractsRouter } from "./routes/contracts";
import { rateDiagnosisRouter } from "./routes/rateDiagnosis";
import { expensesRouter } from "./routes/expenses";
import { clubsRouter } from "./routes/clubs";
import { healthRouter } from "./routes/health";
import { wealthRouter } from "./routes/wealth";
import { adminRouter } from "./routes/admin";
import { plannerRouter } from "./routes/planner";

// 開発用プロトタイプにつき、個別ルートの例外でサーバー全体が落ちないようにする保険
process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));
process.on("uncaughtException", (err) => console.error("Uncaught exception:", err));

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/mypage", mypageRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/reward-sim", rewardSimRouter);
app.use("/api/skill-sheet", skillSheetRouter);
app.use("/api/money", moneyRouter);
app.use("/api/events", eventsRouter);
app.use("/api/mentor", mentorRouter);
app.use("/api/chat", chatRouter);
app.use("/api/skill-gap", skillGapRouter);
app.use("/api/contracts", contractsRouter);
app.use("/api/rate-diagnosis", rateDiagnosisRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/clubs", clubsRouter);
app.use("/api/health", healthRouter);
app.use("/api/wealth", wealthRouter);
app.use("/api/admin", adminRouter);
app.use("/api/planner", plannerRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`sotoba backend listening on http://localhost:${PORT}`);
});
