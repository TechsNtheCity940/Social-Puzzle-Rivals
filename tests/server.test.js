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

  const result = await post(`/api/matches/${match.id}/submit`, {
    choice: "Brain Battle",
    elapsedSeconds: 14,
    penalties: 0,
  });

  assert.equal(result.finished, true);
  assert.equal(result.correct, true);
  assert.ok(result.bootstrap.profile.seasonPoints > 120);
  assert.equal(result.bootstrap.profile.hints, 2);
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
