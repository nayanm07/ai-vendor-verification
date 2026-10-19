import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { badRequest } from "../utils/httpError.js";

export const UPLOAD_DIR = path.resolve("uploads");

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(badRequest("Only PDF, PNG, JPG or WEBP files are allowed"));
  },
});
