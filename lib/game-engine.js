const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DATA_FILE = path.join(__dirname, "..", "data", "store.json");
const activeMatches = new Map();

const RIVAL_NAMES = [
  "Nova", "Jinx", "Rune", "Pixel", "Echo", "Mosaic", "Vanta", "Quill", "Drift", "Sable", "Hex", "Tempo"
];

function ensureStoreFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(createDefaultStore(), null, 2));
  }
}

function createDefaultProfile() {
  return {
    id: "local-player",
    displayName: "You",
    seasonPoints: 120,
    coins: 250,
    hints: 3,
    theme: "cyber",
    lastWinner: "",
    clanName: "Cipher Syndicate",
    nemesis: {
      name: "",
      losses: 0,
      history: {},
    },
    leaderboard: [],
    performance: {},
  };
}

function createDefaultStore() {
  return {
    createdAt: new Date().toISOString(),
    profile: createDefaultProfile(),
  };
}

function readStore() {
  ensureStoreFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeStore(store) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function getBootstrap() {
  const store = readStore();
  const profile = store.profile;

  return {
    profile,
    nemesis: buildNemesis(profile),
    leaderboard: buildLeaderboard(profile),
    insights: buildInsights(profile.performance),
    tournaments: buildTournaments(),
    clans: buildClans(profile),
    recentMatches: profile.leaderboard,
  };
}

function joinMatch({ revengeMode = false, forcedPuzzleId, forcedVariantIndex, forcedRivals } = {}) {
  cleanupMatches();
  const store = readStore();
  const profile = store.profile;
  const definition = selectPuzzleDefinition(profile.performance, revengeMode, forcedPuzzleId);
  const practiceVariant = Number.isInteger(forcedVariantIndex) ? forcedVariantIndex : randomNumber(0, 12);
  const liveVariant = Number.isInteger(forcedVariantIndex) ? forcedVariantIndex + 1 : practiceVariant + 1;
  const practicePuzzle = definition.build(practiceVariant);
  const puzzle = definition.build(liveVariant);
  const rivals = buildRivals(puzzle.difficulty, forcedRivals);
  const match = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    revengeMode,
    roundSeconds: randomNumber(45, 90),
    practiceSeconds: 12,
    penalties: 0,
    hintUsed: false,
    practicePuzzle,
    puzzle,
    rivals,
  };

  activeMatches.set(match.id, match);
  return serializeMatch(match);
}

function consumeHint(matchId) {
  const match = activeMatches.get(matchId);
  if (!match) {
    return { error: "Match not found." };
  }

  const store = readStore();
  if (store.profile.hints <= 0) {
    return { error: "No hints remaining." };
  }

  if (match.hintUsed) {
    return { error: "Hint already used for this round." };
  }

  match.hintUsed = true;
  store.profile.hints -= 1;
  writeStore(store);

  return {
    hint: match.puzzle.hint,
    removeOption: match.puzzle.kind === "choice"
      ? match.puzzle.options.find((option) => option !== match.puzzle.answer)
      : null,
    profile: store.profile,
  };
}

function submitAttempt(matchId, payload = {}) {
  const match = activeMatches.get(matchId);
  if (!match) {
    return { error: "Match not found." };
  }

  if (payload.timedOut) {
    return finalizeMatch(match, Number.POSITIVE_INFINITY, false);
  }

  const correct = validateAttempt(match.puzzle, payload);
  if (!correct) {
    return { correct: false };
  }

  const elapsedSeconds = Number(payload.elapsedSeconds || 0) + Number(payload.penalties || 0);
  return finalizeMatch(match, elapsedSeconds, true);
}

function updateTheme(theme) {
  const store = readStore();
  store.profile.theme = theme;
  writeStore(store);
  return store.profile;
}

function resetProfile() {
  const store = readStore();
  store.profile = createDefaultProfile();
  writeStore(store);
  return getBootstrap();
}

function serializeMatch(match) {
  return {
    id: match.id,
    revengeMode: match.revengeMode,
    roundSeconds: match.roundSeconds,
    practiceSeconds: match.practiceSeconds,
    rivals: match.rivals,
    practicePuzzle: serializePuzzle(match.practicePuzzle, { includeSolution: true }),
    puzzle: serializePuzzle(match.puzzle),
  };
}

function serializePuzzle(puzzle, options = {}) {
  return {
    id: puzzle.id,
    name: puzzle.name,
    category: puzzle.category,
    difficulty: puzzle.difficulty,
    kind: puzzle.kind,
    prompt: puzzle.prompt,
    practice: puzzle.practice,
    hint: puzzle.hint,
    tagline: puzzle.tagline,
    placeholder: puzzle.placeholder || "",
    options: puzzle.options || [],
    cells: puzzle.cells || [],
    previewCells: puzzle.kind === "memory" ? puzzle.answer : [],
    solution: options.includeSolution ? puzzle.answer : null,
  };
}

function finalizeMatch(match, elapsedSeconds, playerSolved) {
  const store = readStore();
  const standings = [
    ...match.rivals.map((rival) => ({ name: rival.name, time: rival.finishTime })),
    { name: "You", time: elapsedSeconds },
  ].sort((left, right) => left.time - right.time);

  const placement = standings.findIndex((entry) => entry.name === "You") + 1;
  const reward = getReward(placement, playerSolved);
  const effectiveTime = Number.isFinite(elapsedSeconds)
    ? Number(elapsedSeconds.toFixed(1))
    : null;

  if (playerSolved) {
    store.profile.seasonPoints += reward.points;
    store.profile.coins += reward.coins;
  }

  const performanceEntry = store.profile.performance[match.puzzle.id] || {
    label: match.puzzle.name,
    category: match.puzzle.category,
    plays: 0,
    wins: 0,
    totalTime: 0,
  };

  performanceEntry.plays += 1;
  if (placement === 1 && playerSolved) {
    performanceEntry.wins += 1;
  }
  performanceEntry.totalTime += effectiveTime ?? match.roundSeconds;
  store.profile.performance[match.puzzle.id] = performanceEntry;

  store.profile.lastWinner = standings[0].name;
  if (standings[0].name !== "You") {
    const nemesis = store.profile.nemesis || { name: "", losses: 0, history: {} };
    nemesis.history[standings[0].name] = (nemesis.history[standings[0].name] || 0) + 1;
    const [name, losses] = Object.entries(nemesis.history)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
    nemesis.name = name;
    nemesis.losses = losses;
    store.profile.nemesis = nemesis;
  }
  store.profile.leaderboard = [
    {
      date: new Date().toLocaleDateString(),
      placement,
      puzzle: match.puzzle.name,
      time: effectiveTime ? `${effectiveTime.toFixed(1)}s` : "DNF",
      points: reward.points,
    },
    ...store.profile.leaderboard,
  ].slice(0, 12);

  writeStore(store);
  activeMatches.delete(match.id);

  return {
    correct: playerSolved,
    finished: true,
    placement,
    reward,
    winner: standings[0].name,
    elapsedSeconds: effectiveTime,
    podium: standings.slice(0, 3).map((entry, index) => ({
      rank: index + 1,
      name: entry.name,
      time: Number.isFinite(entry.time) ? Number(entry.time.toFixed(1)) : null,
    })),
    bootstrap: getBootstrap(),
  };
}

function validateAttempt(puzzle, payload) {
  if (puzzle.kind === "text") {
    return normalize(payload.answer || "") === normalize(puzzle.answer);
  }
  if (puzzle.kind === "choice") {
    return payload.choice === puzzle.answer;
  }
  if (puzzle.kind === "memory") {
    return sameCells(payload.cells || [], puzzle.answer);
  }
  return false;
}

function buildLeaderboard(profile) {
  return [
    { name: "Nova", points: 1040, subtitle: "Tournament grinder" },
    { name: "Rune", points: 980, subtitle: "Logic specialist" },
    { name: "You", points: profile.seasonPoints, subtitle: latestMatchText(profile) },
    { name: "Echo", points: 910, subtitle: "Speed run regular" },
    { name: "Pixel", points: 870, subtitle: "Word duel streak" },
  ].sort((left, right) => right.points - left.points)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function buildNemesis(profile) {
  const nemesis = profile.nemesis || { name: "", losses: 0 };
  return {
    name: nemesis.name || "None yet",
    losses: nemesis.losses || 0,
    subtitle: nemesis.name
      ? `Has beaten you ${nemesis.losses} time${nemesis.losses === 1 ? "" : "s"}`
      : "Play more ranked matches to reveal your rival",
  };
}

function latestMatchText(profile) {
  const latest = profile.leaderboard[0];
  if (!latest) {
    return "Your first ranked result will appear here.";
  }
  return `${latest.puzzle} - ${latest.time} - ${latest.points} pts`;
}

function buildInsights(performance) {
  const entries = Object.values(performance).map((entry) => ({
    ...entry,
    avg: Math.round((entry.totalTime || 0) / Math.max(entry.plays || 1, 1)),
    rating: entry.plays
      ? (entry.wins / entry.plays) - (((entry.totalTime || 0) / entry.plays) / 100)
      : -1,
  })).sort((left, right) => right.rating - left.rating);

  return {
    best: entries[0]?.label || "No data",
    weak: entries.at(-1)?.label || "No data",
    rows: entries.slice(0, 8),
  };
}

function buildTournaments() {
  return [
    {
      name: "Daily Gauntlet",
      window: "Today",
      focus: "Word + Memory",
      prize: "2,000 coins",
    },
    {
      name: "Lunch Rush",
      window: "1 PM - 2 PM",
      focus: "30-second sprints",
      prize: "Avatar frame",
    },
    {
      name: "Clan Clash",
      window: "Tonight",
      focus: "Team score total",
      prize: "Battle pass XP",
    },
  ];
}

function buildClans(profile) {
  return [
    {
      name: profile.clanName,
      status: "Your clan",
      members: 18,
      score: profile.seasonPoints + 2240,
    },
    {
      name: "Neon Savants",
      status: "Rival clan",
      members: 22,
      score: 2510,
    },
    {
      name: "Maze Mafia",
      status: "Rival clan",
      members: 16,
      score: 2430,
    },
  ];
}

function buildRivals(difficulty, forcedRivals = []) {
  const names = forcedRivals.length
    ? [...forcedRivals, ...RIVAL_NAMES.filter((name) => !forcedRivals.includes(name))]
    : shuffle([...RIVAL_NAMES]);
  return names.slice(0, 5).map((name, index) => ({
    name,
    mmr: forcedRivals.length ? 1600 - (index * 35) : randomNumber(1180, 1630),
    finishTime: forcedRivals.length
      ? 18 + difficulty * 4 + index * 7
      : randomNumber(20, 62) + difficulty * 5 + index * 2,
    progress: 0,
    status: "waiting",
  }));
}

function selectPuzzleDefinition(performance, revengeMode, forcedPuzzleId) {
  const definitions = getPuzzleDefinitions();
  if (forcedPuzzleId) {
    const forcedDefinition = definitions.find((definition) => definition.id === forcedPuzzleId);
    if (forcedDefinition) {
      return forcedDefinition;
    }
  }

  const weighted = definitions.map((definition) => {
    const preview = definition.build(0);
    const stats = performance[preview.id];
    const weakness = !stats
      ? 1
      : 1 + Math.max(0, stats.plays - stats.wins) + Math.floor((stats.totalTime || 0) / Math.max(stats.plays || 1, 1) / 20);
    return { definition, weight: revengeMode ? weakness : 1 };
  });

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * totalWeight;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.definition;
    }
  }
  return weighted[0].definition;
}

function getPuzzleDefinitions() {
  return [
    { id: "crossword-mini", build: createCrosswordMini },
    { id: "anagram-blitz", build: createAnagramBlitz },
    { id: "missing-letter-dash", build: createMissingLetterDash },
    { id: "logic-sequence", build: createLogicSequence },
    { id: "emoji-trivia", build: createEmojiTrivia },
    { id: "memory-grid", build: createMemoryGrid },
    { id: "riddle-sprint", build: createRiddleSprint },
    { id: "pattern-pulse", build: createPatternPulse },
  ];
}

function createCrosswordMini(forcedVariantIndex = null) {
  const bank = [
    { clue: "Word for a brain teaser", answer: "puzzle", hint: "Starts with P and ends with E." },
    { clue: "Competitive payback match", answer: "revenge", hint: "It begins with R." },
    { clue: "Board that ranks players", answer: "leaderboard", hint: "It contains the word board." },
  ];
  const pick = chooseFromBank(bank, forcedVariantIndex);
  return {
    id: "crossword-mini",
    name: "Crossword Mini",
    category: "Word",
    difficulty: 3,
    kind: "text",
    placeholder: "Type the answer",
    prompt: `Solve the mini clue: ${pick.clue}`,
    answer: pick.answer,
    practice: "Mini crossword clues reward direct word association. Read the clue once, then lock the cleanest answer fast.",
    hint: pick.hint,
    tagline: "Crossword sprint is live.",
  };
}

function createAnagramBlitz(forcedVariantIndex = null) {
  const bank = [
    { scramble: "LZPUZE", answer: "puzzle", hint: "It starts with P." },
    { scramble: "VLRAI", answer: "viral", hint: "It ends with L." },
    { scramble: "VOTYRIC", answer: "victory", hint: "It starts with V." },
  ];
  const pick = chooseFromBank(bank, forcedVariantIndex);
  return {
    id: "anagram-blitz",
    name: "Anagram Blitz",
    category: "Word",
    difficulty: 2,
    kind: "text",
    placeholder: "Unscramble the word",
    prompt: `Unscramble this word: ${pick.scramble}`,
    answer: pick.answer,
    practice: "Scan for common starts like P, V, or RE. The fastest route is spotting patterns, not testing every letter order.",
    hint: pick.hint,
    tagline: "Anagram blitz is live.",
  };
}

function createMissingLetterDash(forcedVariantIndex = null) {
  const bank = [
    { text: "C _ A N", answer: "clan", hint: "A team or guild." },
    { text: "H I _ T", answer: "hint", hint: "You can spend one during the round." },
    { text: "M A _ C H", answer: "match", hint: "It starts with M and ends with H." },
  ];
  const pick = chooseFromBank(bank, forcedVariantIndex);
  return {
    id: "missing-letter-dash",
    name: "Missing-Letter Dash",
    category: "Word",
    difficulty: 2,
    kind: "text",
    placeholder: "Complete the word",
    prompt: `Fill in the missing letters: ${pick.text}`,
    answer: pick.answer,
    practice: "Use the visible consonants as anchors. If the word is social or competitive, the theme is usually a clue.",
    hint: pick.hint,
    tagline: "Missing-letter dash is live.",
  };
}

function createLogicSequence(forcedVariantIndex = null) {
  const bank = [
    { prompt: "What number comes next: 2, 6, 12, 20, ?", answer: "30", hint: "Add 4, then 6, then 8, then 10." },
    { prompt: "What number comes next: 3, 9, 18, 30, ?", answer: "45", hint: "The increases are 6, 9, 12, then 15." },
    { prompt: "What number comes next: 1, 4, 9, 16, ?", answer: "25", hint: "These are square numbers." },
  ];
  const pick = chooseFromBank(bank, forcedVariantIndex);
  return {
    id: "logic-sequence",
    name: "Logic Sequence",
    category: "Logic",
    difficulty: 3,
    kind: "text",
    placeholder: "Enter the next number",
    prompt: pick.prompt,
    answer: pick.answer,
    practice: "Compare differences first. Sequence puzzles collapse fast once you identify the increment rule.",
    hint: pick.hint,
    tagline: "Logic sequence is live.",
  };
}

function createEmojiTrivia(forcedVariantIndex = null) {
  const bank = [
    {
      prompt: "Which phrase do these emoji suggest? 🧠 + ⚔️",
      answer: "Brain Battle",
      options: ["Brain Battle", "Mind Garden", "Puzzle Crown"],
      hint: "Second word is competitive.",
    },
    {
      prompt: "Which phrase do these emoji suggest? 👥 + 🧩",
      answer: "Friends Puzzle",
      options: ["Friends Puzzle", "Clan Quest", "Neon Trivia"],
      hint: "The first word points to a group of people.",
    },
    {
      prompt: "Which phrase do these emoji suggest? ⚡ + 🧠",
      answer: "Speed Thinking",
      options: ["Speed Thinking", "Hint Storm", "Victory Rush"],
      hint: "This phrase is about fast cognition.",
    },
  ];
  const pick = chooseFromBank(bank, forcedVariantIndex);
  return {
    id: "emoji-trivia",
    name: "Emoji Trivia",
    category: "Trivia",
    difficulty: 2,
    kind: "choice",
    prompt: pick.prompt,
    answer: pick.answer,
    options: shuffle(pick.options),
    practice: "Look for the obvious literal meaning first. Emoji trivia punishes overthinking more than lack of knowledge.",
    hint: pick.hint,
    tagline: "Emoji trivia is live.",
  };
}

function createMemoryGrid(forcedVariantIndex = null) {
  const bank = [
    [0, 2, 4, 6],
    [1, 2, 4, 8],
    [0, 3, 5, 7],
    [2, 3, 4, 5],
    [1, 4, 6, 8],
  ];
  const answer = chooseFromBank(bank, forcedVariantIndex).slice().sort((left, right) => left - right);
  return {
    id: "memory-grid",
    name: "Memory Grid",
    category: "Memory",
    difficulty: 4,
    kind: "memory",
    cells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    prompt: "Rebuild the glowing pattern after it disappears.",
    answer,
    practice: "Chunk the grid into rows or corners. Visual grouping beats trying to memorize each tile separately.",
    hint: `The pattern includes cells ${answer.slice(0, 2).map((value) => value + 1).join(" and ")}.`,
    tagline: "Memory grid is live.",
  };
}

function createRiddleSprint(forcedVariantIndex = null) {
  const bank = [
    {
      prompt: "What gets sharper the more you use it in puzzle duels?",
      answer: "Your mind",
      options: ["Your mind", "Your timer", "Your leaderboard"],
      hint: "The answer is a personal skill, not an object.",
    },
    {
      prompt: "The more of me you take, the more you leave behind. What am I?",
      answer: "Footsteps",
      options: ["Hints", "Footsteps", "Coins"],
      hint: "You leave them when you move.",
    },
    {
      prompt: "What has many keys but cannot open a single lock?",
      answer: "A piano",
      options: ["A piano", "A maze", "A puzzle box"],
      hint: "Think musical instrument.",
    },
  ];
  const pick = chooseFromBank(bank, forcedVariantIndex);
  return {
    id: "riddle-sprint",
    name: "Riddle Sprint",
    category: "Lateral",
    difficulty: 3,
    kind: "choice",
    prompt: pick.prompt,
    answer: pick.answer,
    options: shuffle(pick.options),
    practice: "Riddle rounds reward reframing. If the first literal answer feels wrong, step sideways instead of deeper.",
    hint: pick.hint,
    tagline: "Riddle sprint is live.",
  };
}

function createPatternPulse(forcedVariantIndex = null) {
  const bank = [
    { prompt: "Which shape completes the pattern? ▲ ▼ ▲ ▼ ?", answer: "▲", options: ["▲", "▼", "■"], hint: "The sequence alternates." },
    { prompt: "Which value completes the pattern? A1, C3, E5, ?", answer: "G7", options: ["G7", "F6", "H8"], hint: "Both the letter and the number jump by 2." },
    { prompt: "Which pair completes the pattern? Red Circle, Blue Square, Red Circle, ?", answer: "Blue Square", options: ["Blue Square", "Red Square", "Blue Circle"], hint: "It repeats in pairs." },
  ];
  const pick = chooseFromBank(bank, forcedVariantIndex);
  return {
    id: "pattern-pulse",
    name: "Pattern Pulse",
    category: "Visual",
    difficulty: 3,
    kind: "choice",
    prompt: pick.prompt,
    answer: pick.answer,
    options: shuffle(pick.options),
    practice: "Pattern rounds are about identifying the rule before the symbols. Track the transform, not the decoration.",
    hint: pick.hint,
    tagline: "Pattern pulse is live.",
  };
}

function chooseFromBank(bank, forcedVariantIndex) {
  if (Number.isInteger(forcedVariantIndex)) {
    return bank[forcedVariantIndex % bank.length];
  }
  return bank[Math.floor(Math.random() * bank.length)];
}

function sameCells(selected, answer) {
  if (selected.length !== answer.length) {
    return false;
  }
  const left = [...selected].sort((a, b) => a - b);
  const right = [...answer].sort((a, b) => a - b);
  return left.every((value, index) => value === right[index]);
}

function getReward(placement, playerSolved) {
  if (!playerSolved) {
    return { points: 0, coins: 0 };
  }
  if (placement === 1) {
    return { points: 120, coins: 90 };
  }
  if (placement === 2) {
    return { points: 80, coins: 55 };
  }
  if (placement === 3) {
    return { points: 50, coins: 30 };
  }
  return { points: 10, coins: 5 };
}

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function cleanupMatches() {
  const cutoff = Date.now() - (1000 * 60 * 20);
  for (const [matchId, match] of activeMatches.entries()) {
    if (match.createdAt < cutoff) {
      activeMatches.delete(matchId);
    }
  }
}

module.exports = {
  getBootstrap,
  joinMatch,
  consumeHint,
  submitAttempt,
  updateTheme,
  resetProfile,
};
