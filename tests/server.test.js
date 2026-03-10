const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");

const { startServer } = require("../server");

const DATA_FILE = path.join(__dirname, "..", "data", "store.json");

let server;
let baseUrl;
let originalStore;

test.before(async () => {
  originalStore = fs.readFileSync(DATA_FILE, "utf8");
  server = startServer(0);
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.writeFileSync(DATA_FILE, originalStore);
});

test("bootstrap returns a profile payload", async () => {
  const response = await fetch(`${baseUrl}/api/bootstrap`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.profile.displayName, "You");
  assert.ok(Array.isArray(payload.leaderboard));
  assert.ok(Array.isArray(payload.tournaments));
});

test("player can join, hint, and finish a match", async () => {
  await post("/api/profile/reset", {});

  const match = await post("/api/matchmaking/join", {
    revengeMode: false,
    forcedPuzzleId: "emoji-trivia",
    forcedVariantIndex: 0,
  });

  assert.equal(match.puzzle.name, "Emoji Trivia");
  assert.equal(match.practiceSeconds, 12);

  const hint = await post(`/api/matches/${match.id}/hint`, {});
  assert.equal(hint.profile.hints, 2);
  assert.equal(typeof hint.hint, "string");

  const answerByPrompt = {
    "Which phrase do these emoji suggest? 👥 + 🧩": "Friends Puzzle",
    "Which phrase do these emoji suggest? 🧠 + ⚔️": "Brain Battle",
    "Which phrase do these emoji suggest? ⚡ + 🧠": "Speed Thinking",
  };

  const result = await post(`/api/matches/${match.id}/submit`, {
    choice: answerByPrompt[match.puzzle.prompt],
    elapsedSeconds: 14,
    penalties: 0,
  });

  assert.equal(result.finished, true);
  assert.equal(result.correct, true);
  assert.ok(result.bootstrap.profile.seasonPoints > 120);
  assert.equal(result.bootstrap.profile.hints, 2);
});

test("nemesis tracks the rival who beats the player most often", async () => {
  await post("/api/profile/reset", {});

  for (let index = 0; index < 2; index += 1) {
    const match = await post("/api/matchmaking/join", {
      revengeMode: false,
      forcedPuzzleId: "logic-sequence",
      forcedVariantIndex: 0,
      forcedRivals: ["Nova", "Rune", "Echo", "Pixel", "Jinx"],
    });

    const result = await post(`/api/matches/${match.id}/submit`, {
      timedOut: true,
    });

    assert.equal(result.winner, "Nova");
  }

  const bootstrap = await get("/api/bootstrap");
  assert.equal(bootstrap.nemesis.name, "Nova");
  assert.equal(bootstrap.nemesis.losses, 2);
});

async function post(route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  assert.equal(response.ok, true, payload.error || "Request failed");
  return payload;
}

async function get(route) {
  const response = await fetch(`${baseUrl}${route}`);
  const payload = await response.json();
  assert.equal(response.ok, true, payload.error || "Request failed");
  return payload;
}
