import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { vendorRouter } from "./routes/vendor.routes.js";
import { documentRouter, vendorDocumentRouter } from "./routes/document.routes.js";
import { verificationRouter } from "./routes/verification.routes.js";
import { registryClient } from "./integrations/opencorporates/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(cors({ origin: env.clientOrigin }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    integrations: {
      openai: Boolean(env.openaiApiKey),
      opencorporates: registryClient.mode,
      resend: Boolean(env.resendApiKey),
    },
  });
});

app.use("/api/vendors", vendorRouter);
app.use("/api/vendors/:id", vendorDocumentRouter);
app.use("/api/vendors/:id", verificationRouter);
app.use("/api/documents", documentRouter);

app.use(notFoundHandler);
app.use(errorHandler);
