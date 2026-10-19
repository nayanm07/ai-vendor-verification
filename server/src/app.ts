import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { vendorRouter } from "./routes/vendor.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(cors({ origin: env.clientOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    integrations: {
      openai: Boolean(env.openaiApiKey),
      opencorporates: Boolean(env.openCorporatesToken),
      resend: Boolean(env.resendApiKey),
    },
  });
});

app.use("/api/vendors", vendorRouter);

app.use(notFoundHandler);
app.use(errorHandler);
