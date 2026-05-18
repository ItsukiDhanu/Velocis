import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { pool } from "./db.js";

function mapUserRow(row) {
  return {
    id: row.id,
    username: row.username,
    avatar_url: row.avatar_url,
    profile_url: row.profile_url
  };
}

export function configureAuth(app) {
  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  const loginRedirect = `${clientOrigin}/login`;

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const [rows] = await pool.query(
        "SELECT id, username, avatar_url, profile_url FROM users WHERE id = ?",
        [id]
      );
      if (rows.length === 0) {
        return done(null, false);
      }
      return done(null, mapUserRow(rows[0]));
    } catch (error) {
      return done(error);
    }
  });

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const githubId = String(profile.id);
          const username = profile.username || profile.displayName || "github-user";
          const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
          const profileUrl = profile.profileUrl || (profile._json && profile._json.html_url) || null;

          const [existingRows] = await pool.query(
            "SELECT id FROM users WHERE github_id = ?",
            [githubId]
          );

          let userId = null;
          if (existingRows.length === 0) {
            const [insertResult] = await pool.query(
              "INSERT INTO users (github_id, username, avatar_url, profile_url) VALUES (?, ?, ?, ?)",
              [githubId, username, avatarUrl, profileUrl]
            );
            userId = insertResult.insertId;
          } else {
            userId = existingRows[0].id;
            await pool.query(
              "UPDATE users SET username = ?, avatar_url = ?, profile_url = ? WHERE id = ?",
              [username, avatarUrl, profileUrl, userId]
            );
          }

          const [userRows] = await pool.query(
            "SELECT id, username, avatar_url, profile_url FROM users WHERE id = ?",
            [userId]
          );
          return done(null, mapUserRow(userRows[0]));
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  app.get(
    "/auth/github",
    passport.authenticate("github", { scope: ["read:user", "user:email"] })
  );

  app.get(
    "/auth/github/callback",
    passport.authenticate("github", { failureRedirect: loginRedirect }),
    (req, res) => {
      res.redirect(clientOrigin);
    }
  );

  app.post("/auth/logout", (req, res, next) => {
    req.logout((error) => {
      if (error) {
        return next(error);
      }
      req.session.destroy(() => {
        res.json({ ok: true });
      });
    });
  });

  app.get("/api/me", (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.json({ user: req.user });
  });
}
