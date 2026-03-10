const express = require("express");
const path = require("node:path");
const {
  getBootstrap,
  joinMatch,
  consumeHint,
  submitAttempt,
  updateTheme,
  resetProfile,
} = require("./lib/game-engine");

function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/api/bootstrap", (_request, response) => {
    response.json(getBootstrap());
  });

  app.post("/api/matchmaking/join", (request, response) => {
    const match = joinMatch(request.body || {});
    response.json(match);
  });

  app.post("/api/matches/:matchId/hint", (request, response) => {
    const result = consumeHint(request.params.matchId);
    if (result.error) {
      response.status(400).json(result);
      return;
    }
    response.json(result);
  });

  app.post("/api/matches/:matchId/submit", (request, response) => {
    const result = submitAttempt(request.params.matchId, request.body || {});
    if (result.error) {
      response.status(404).json(result);
      return;
    }
    response.json(result);
  });

  app.post("/api/profile/theme", (request, response) => {
    const theme = request.body?.theme;
    if (!["cyber", "fantasy", "neon"].includes(theme)) {
      response.status(400).json({ error: "Unsupported theme." });
      return;
    }
    response.json({ profile: updateTheme(theme) });
  });

  app.post("/api/profile/reset", (_request, response) => {
    response.json(resetProfile());
  });

  app.get("/", (_request, response) => {
    response.sendFile(path.join(__dirname, "index.html"));
  });

  app.get("/app.js", (_request, response) => {
    response.sendFile(path.join(__dirname, "app.js"));
  });

  app.get("/styles.css", (_request, response) => {
    response.sendFile(path.join(__dirname, "styles.css"));
  });

  return app;
}

function startServer(port = Number(process.env.PORT) || 3000) {
  const app = createApp();
  const server = app.listen(port, () => {
    console.log(`Social Puzzle Rivals running on http://localhost:${server.address().port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer,
};
