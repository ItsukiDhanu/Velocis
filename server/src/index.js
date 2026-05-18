import { requireEnv } from "./env.js";
import express from "express";
import session from "express-session";
import passport from "passport";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { configureAuth } from "./auth.js";
import requireAuth from "./middleware/requireAuth.js";
import repositoriesRouter from "./routes/repositories.js";
import branchesRouter from "./routes/branches.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

try {
  requireEnv([
    "DB_HOST",
    "DB_USER",
    "DB_NAME",
    "SESSION_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_CALLBACK_URL"
  ]);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

app.use(express.json({ limit: "1mb" }));

if (!isProduction) {
  const allowList = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowList.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true
    })
  );
}

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

configureAuth(app);

app.use("/api/repositories", requireAuth, repositoriesRouter);
app.use("/api/branches", requireAuth, branchesRouter);

app.use((error, req, res, next) => {
  const status = error.code === "LIMIT_FILE_SIZE" ? 413 : error.status || 500;

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    error: status >= 500 ? "Server error" : error.message
  });
});

if (isProduction) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDistPath = path.resolve(__dirname, "../../client/dist");

  app.use(express.static(clientDistPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Velocis server running on port ${port}`);
});
