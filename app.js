const STORAGE_KEY = "social-puzzle-rivals-v1";
const RIVAL_NAMES = [
  "Nova", "Jinx", "Rune", "Pixel", "Echo", "Mosaic", "Vanta", "Quill", "Drift", "Sable"
];

const appState = {
  profile: loadProfile(),
  stats: null,
  match: null,
  timers: {
    countdown: null,
    round: null,
    rivals: null,
  },
};

const refs = {
  seasonPoints: document.getElementById("seasonPoints"),
  coins: document.getElementById("coins"),
  hints: document.getElementById("hints"),
  phaseTitle: document.getElementById("phaseTitle"),
  phaseBadge: document.getElementById("phaseBadge"),
  modeLabel: document.getElementById("modeLabel"),
  puzzleLabel: document.getElementById("puzzleLabel"),
  roundClock: document.getElementById("roundClock"),
  announcement: document.getElementById("announcement"),
  practiceTitle: document.getElementById("practiceTitle"),
  practiceBody: document.getElementById("practiceBody"),
  countdownBadge: document.getElementById("countdownBadge"),
  joinButton: document.getElementById("joinButton"),
  revengeButton: document.getElementById("revengeButton"),
  hintButton: document.getElementById("hintButton"),
  practiceCard: document.getElementById("practiceCard"),
  challengeForm: document.getElementById("challengeForm"),
  challengeTitle: document.getElementById("challengeTitle"),
  challengePrompt: document.getElementById("challengePrompt"),
  challengeWorkspace: document.getElementById("challengeWorkspace"),
  penaltyChip: document.getElementById("penaltyChip"),
  hintCopy: document.getElementById("hintCopy"),
  resultsCard: document.getElementById("resultsCard"),
  resultsTitle: document.getElementById("resultsTitle"),
  resultsBody: document.getElementById("resultsBody"),
  podium: document.getElementById("podium"),
  rivalsList: document.getElementById("rivalsList"),
  leaderboardList: document.getElementById("leaderboardList"),
  bestCategory: document.getElementById("bestCategory"),
  weakCategory: document.getElementById("weakCategory"),
  categoryStats: document.getElementById("categoryStats"),
  themeButtons: Array.from(document.querySelectorAll("[data-theme-option]")),
};

const puzzleFactories = [
  createCrosswordMini,
  createAnagramBlitz,
  createMissingLetterDash,
  createLogicSequence,
  createEmojiTrivia,
  createMemoryGrid,
];

refs.joinButton.addEventListener("click", () => startMatch(false));
refs.revengeButton.addEventListener("click", () => startMatch(true));
refs.hintButton.addEventListener("click", useHint);
refs.challengeForm.addEventListener("submit", handleAnswerSubmit);
refs.themeButtons.forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.themeOption));
});

hydrate();

function hydrate() {
  appState.stats = buildStatsSummary(appState.profile.performance);
  document.body.dataset.theme = appState.profile.theme;
  refs.themeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.themeOption === appState.profile.theme);
  });
  renderWallet();
  renderInsights();
  renderLeaderboard();
  renderRivals([]);
}

function loadProfile() {
  const fallback = {
    seasonPoints: 120,
    coins: 250,
    hints: 3,
    theme: "cyber",
    lastWinner: "",
    leaderboard: [],
    performance: {},
  };

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

function persistProfile() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.profile));
}

function startMatch(isRevenge) {
  clearTimers();
  refs.joinButton.disabled = true;
  refs.revengeButton.disabled = true;
  refs.resultsCard.classList.add("hidden");
  refs.challengeForm.classList.add("hidden");
  refs.practiceCard.classList.remove("hidden");
  refs.phaseTitle.textContent = "Filling Lobby";
  refs.phaseBadge.textContent = "Queue";
  refs.modeLabel.textContent = isRevenge ? "Revenge Match" : "Ranked Sprint";
  refs.announcement.textContent = isRevenge
    ? "AI selected revenge mode. Expect a category that usually slows you down."
    : "Matchmaking in progress. Puzzle type will be announced when the room fills.";

  const puzzle = selectPuzzle(isRevenge);
  const rivals = buildRivals(puzzle.difficulty);
  const roundSeconds = randomNumber(45, 90);

  appState.match = {
    isRevenge,
    puzzle,
    rivals,
    roundSeconds,
    penalties: 0,
    startedAt: 0,
    playerSolved: false,
    selectedChoice: "",
    selectedCells: [],
    hintUsed: false,
    elapsedSeconds: 0,
  };

  renderRivals(rivals);
  refs.puzzleLabel.textContent = puzzle.name;
  refs.practiceTitle.textContent = `${puzzle.name} incoming`;
  refs.practiceBody.textContent = puzzle.practice;
  refs.countdownBadge.textContent = "12s";
  refs.roundClock.textContent = `${roundSeconds}s`;

  let remaining = 12;
  refs.phaseTitle.textContent = "Practice Window";
  refs.phaseBadge.textContent = "Warm-up";

  refs.timers.countdown = setInterval(() => {
    remaining -= 1;
    refs.countdownBadge.textContent = `${remaining}s`;
    if (remaining <= 0) {
      clearInterval(refs.timers.countdown);
      refs.timers.countdown = null;
      beginRound();
    }
  }, 1000);
}

function beginRound() {
  const { puzzle, roundSeconds } = appState.match;
  appState.match.startedAt = Date.now();
  refs.phaseTitle.textContent = "Race Live";
  refs.phaseBadge.textContent = "Live";
  refs.announcement.textContent = `${puzzle.tagline} First correct solve takes the room. Wrong answers cost 5 seconds.`;
  refs.challengeTitle.textContent = puzzle.name;
  refs.challengePrompt.textContent = puzzle.prompt;
  refs.penaltyChip.textContent = "Penalty +0s";
  refs.hintCopy.textContent = "Hints reveal a clue or remove one wrong option.";
  refs.challengeForm.classList.remove("hidden");
  refs.hintButton.disabled = appState.profile.hints <= 0;

  renderWorkspace(puzzle);
  tickRoundClock(roundSeconds);
  refs.roundClock.textContent = `${roundSeconds}s`;

  refs.timers.round = setInterval(() => {
    const elapsed = Math.floor((Date.now() - appState.match.startedAt) / 1000);
    appState.match.elapsedSeconds = elapsed;
    const remaining = Math.max(roundSeconds - elapsed, 0);
    tickRoundClock(remaining);
    if (remaining <= 0) {
      finishRound(false);
    }
  }, 250);

  refs.timers.rivals = setInterval(updateRivalProgress, 400);
}

function tickRoundClock(remaining) {
  refs.roundClock.textContent = `${remaining}s`;
}

function selectPuzzle(isRevenge) {
  const weighted = puzzleFactories.map((factory) => {
    const preview = factory();
    const stats = appState.profile.performance[preview.id];
    const failureWeight = !stats
      ? 1
      : 1 + Math.max(0, stats.plays - stats.wins) + Math.floor((stats.totalTime || 0) / Math.max(stats.plays || 1, 1) / 20);
    const weight = isRevenge ? failureWeight : 1;
    return { factory, weight };
  });

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * totalWeight;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.factory();
    }
  }
  return weighted[0].factory();
}

function buildRivals(difficulty) {
  return shuffle([...RIVAL_NAMES])
    .slice(0, 5)
    .map((name, index) => {
      const speedBase = randomNumber(20, 65) + difficulty * 5 + index * 2;
      return {
        name,
        mmr: randomNumber(1180, 1610),
        finishTime: speedBase,
        progress: 0,
        status: "waiting",
      };
    });
}

function renderRivals(rivals) {
  if (!rivals.length) {
    refs.rivalsList.innerHTML = '<div class="rival-row"><div class="rival-main"><strong>No lobby yet</strong><span class="rival-meta">Tap Join Lobby to queue</span></div></div>';
    return;
  }

  refs.rivalsList.innerHTML = rivals.map((rival) => `
    <article class="rival-row" data-rival-name="${rival.name}">
      <div class="rival-main">
        <strong>${rival.name}</strong>
        <span class="rival-meta">${rival.mmr} MMR • ${capitalize(rival.status)}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${rival.progress}%"></div>
      </div>
    </article>
  `).join("");
}

function updateRivalProgress() {
  if (!appState.match) {
    return;
  }

  const elapsed = (Date.now() - appState.match.startedAt) / 1000;
  appState.match.rivals.forEach((rival) => {
    const progress = Math.min((elapsed / rival.finishTime) * 100, 100);
    rival.progress = Math.round(progress);
    rival.status = progress >= 100 ? "finished" : "solving";
  });
  renderRivals(appState.match.rivals);
}

function renderWorkspace(puzzle) {
  refs.challengeWorkspace.innerHTML = "";
  appState.match.selectedChoice = "";
  appState.match.selectedCells = [];

  if (puzzle.kind === "text") {
    refs.challengeWorkspace.innerHTML = `<input class="answer-input" id="answerInput" type="text" autocomplete="off" placeholder="${puzzle.placeholder}">`;
    document.getElementById("answerInput").focus();
    return;
  }

  if (puzzle.kind === "choice") {
    const grid = document.createElement("div");
    grid.className = "choice-grid";
    puzzle.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-button";
      button.textContent = option;
      button.addEventListener("click", () => {
        appState.match.selectedChoice = option;
        Array.from(grid.children).forEach((child) => child.classList.remove("selected"));
        button.classList.add("selected");
      });
      grid.appendChild(button);
    });
    refs.challengeWorkspace.appendChild(grid);
    return;
  }

  if (puzzle.kind === "memory") {
    const instructions = document.createElement("p");
    instructions.className = "hint-copy";
    instructions.textContent = "Memorize the glowing cells for 3 seconds, then rebuild the exact pattern.";
    refs.challengeWorkspace.appendChild(instructions);

    const grid = document.createElement("div");
    grid.className = "memory-grid";
    puzzle.cells.forEach((cellIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "memory-button";
      button.textContent = cellIndex + 1;
      if (puzzle.answer.includes(cellIndex)) {
        button.classList.add("glow");
      }
      button.addEventListener("click", () => {
        button.classList.toggle("selected");
        const selected = Array.from(grid.children)
          .filter((child) => child.classList.contains("selected"))
          .map((child, index) => index);
        appState.match.selectedCells = selected;
      });
      grid.appendChild(button);
    });
    refs.challengeWorkspace.appendChild(grid);

    setTimeout(() => {
      Array.from(grid.children).forEach((child) => child.classList.remove("glow"));
    }, 3000);
  }
}

function handleAnswerSubmit(event) {
  event.preventDefault();
  if (!appState.match || appState.match.playerSolved) {
    return;
  }

  const { puzzle } = appState.match;
  let solved = false;

  if (puzzle.kind === "text") {
    const value = document.getElementById("answerInput").value.trim();
    solved = normalize(value) === normalize(puzzle.answer);
  }

  if (puzzle.kind === "choice") {
    solved = appState.match.selectedChoice === puzzle.answer;
  }

  if (puzzle.kind === "memory") {
    solved = sameCells(appState.match.selectedCells, puzzle.answer);
  }

  if (solved) {
    finishRound(true);
    return;
  }

  appState.match.penalties += 5;
  refs.penaltyChip.textContent = `Penalty +${appState.match.penalties}s`;
  refs.challengeForm.classList.add("flash");
  setTimeout(() => refs.challengeForm.classList.remove("flash"), 500);
}

function useHint() {
  if (!appState.match || appState.profile.hints <= 0 || appState.match.hintUsed) {
    return;
  }

  appState.match.hintUsed = true;
  appState.profile.hints -= 1;
  refs.hintButton.disabled = true;
  refs.hintCopy.textContent = appState.match.puzzle.hint;
  persistProfile();
  renderWallet();

  if (appState.match.puzzle.kind === "choice") {
    const wrongButtons = Array.from(refs.challengeWorkspace.querySelectorAll(".choice-button"))
      .filter((button) => button.textContent !== appState.match.puzzle.answer);
    if (wrongButtons.length) {
      wrongButtons[0].disabled = true;
      wrongButtons[0].style.opacity = "0.35";
    }
  }
}

function finishRound(playerSolved) {
  if (!appState.match) {
    return;
  }

  clearTimers();
  appState.match.playerSolved = playerSolved;
  refs.challengeForm.classList.add("hidden");
  refs.resultsCard.classList.remove("hidden");
  refs.phaseTitle.textContent = "Results";
  refs.phaseBadge.textContent = "Final";
  refs.hintButton.disabled = true;

  const elapsed = playerSolved
    ? ((Date.now() - appState.match.startedAt) / 1000) + appState.match.penalties
    : Number.POSITIVE_INFINITY;

  const standings = [
    ...appState.match.rivals.map((rival) => ({ name: rival.name, time: rival.finishTime })),
    { name: "You", time: elapsed },
  ].sort((a, b) => a.time - b.time);

  const placement = standings.findIndex((entry) => entry.name === "You") + 1;
  const topThree = standings.slice(0, 3);
  const reward = getReward(placement);

  if (playerSolved && Number.isFinite(elapsed)) {
    appState.profile.seasonPoints += reward.points;
    appState.profile.coins += reward.coins;
  }

  const performanceEntry = appState.profile.performance[appState.match.puzzle.id] || {
    label: appState.match.puzzle.name,
    category: appState.match.puzzle.category,
    plays: 0,
    wins: 0,
    totalTime: 0,
  };
  performanceEntry.plays += 1;
  if (placement === 1) {
    performanceEntry.wins += 1;
  }
  if (Number.isFinite(elapsed)) {
    performanceEntry.totalTime += Math.round(elapsed);
  } else {
    performanceEntry.totalTime += appState.match.roundSeconds + appState.match.penalties;
  }
  appState.profile.performance[appState.match.puzzle.id] = performanceEntry;

  appState.profile.lastWinner = standings[0].name;
  appState.profile.leaderboard = [
    {
      date: new Date().toLocaleDateString(),
      placement,
      puzzle: appState.match.puzzle.name,
      time: Number.isFinite(elapsed) ? `${elapsed.toFixed(1)}s` : "DNF",
      points: reward.points,
    },
    ...appState.profile.leaderboard,
  ].slice(0, 8);

  persistProfile();
  appState.stats = buildStatsSummary(appState.profile.performance);
  renderWallet();
  renderInsights();
  renderLeaderboard();

  refs.resultsTitle.textContent = placement <= 3 ? `You placed #${placement}` : "You missed the podium";
  refs.resultsBody.textContent = playerSolved
    ? `Solved in ${elapsed.toFixed(1)}s. Reward: +${reward.points} season points and +${reward.coins} coins.`
    : "Time expired before you locked the answer. Queue again or trigger revenge mode.";
  refs.podium.innerHTML = topThree.map((entry, index) => `
    <div class="podium-place">
      <div>#${index + 1}</div>
      <strong>${entry.name}</strong>
      <div class="board-subtle">${Number.isFinite(entry.time) ? `${entry.time.toFixed(1)}s` : "DNF"}</div>
    </div>
  `).join("");

  refs.announcement.textContent = placement === 1
    ? "First place secured. Queue again before the room cools off."
    : `Winner: ${standings[0].name}. Revenge mode is tuned to your weaker categories for a harder rematch.`;
  refs.revengeButton.disabled = !appState.profile.lastWinner || appState.profile.lastWinner === "You";
  refs.joinButton.disabled = false;
  refs.modeLabel.textContent = "Post Match";
  refs.puzzleLabel.textContent = appState.match.puzzle.name;
  refs.roundClock.textContent = playerSolved ? `${elapsed.toFixed(1)}s` : "DNF";
}

function renderWallet() {
  refs.seasonPoints.textContent = appState.profile.seasonPoints;
  refs.coins.textContent = appState.profile.coins;
  refs.hints.textContent = appState.profile.hints;
}

function renderInsights() {
  const { best, weak, rows } = appState.stats;
  refs.bestCategory.textContent = best || "No data";
  refs.weakCategory.textContent = weak || "No data";
  refs.categoryStats.innerHTML = rows.length
    ? rows.map((row) => `
      <div class="category-row">
        <strong>${row.label}</strong>
        <span class="board-subtle">${row.wins}/${row.plays} wins • avg ${row.avg}s</span>
      </div>
    `).join("")
    : '<div class="category-row"><strong>No matches yet</strong><span class="board-subtle">Play a round to train the AI profile.</span></div>';
}

function renderLeaderboard() {
  const baseBots = [
    { name: "Nova", points: 960 },
    { name: "Rune", points: 900 },
    { name: "Echo", points: 860 },
    { name: "You", points: appState.profile.seasonPoints },
    { name: "Pixel", points: 790 },
  ].sort((a, b) => b.points - a.points);

  refs.leaderboardList.innerHTML = baseBots.map((entry, index) => `
    <article class="board-row">
      <div class="board-main">
        <strong>#${index + 1} ${entry.name}</strong>
        <span>${entry.points} pts</span>
      </div>
      <div class="board-subtle">${entry.name === "You" ? latestMatchText() : "Friend leaderboard snapshot"}</div>
    </article>
  `).join("");
}

function latestMatchText() {
  const latest = appState.profile.leaderboard[0];
  if (!latest) {
    return "Your first ranked result will appear here.";
  }
  return `${latest.puzzle} • ${latest.time} • ${latest.points} pts`;
}

function setTheme(theme) {
  appState.profile.theme = theme;
  document.body.dataset.theme = theme;
  refs.themeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.themeOption === theme);
  });
  persistProfile();
}

function buildStatsSummary(performance) {
  const entries = Object.values(performance).map((entry) => ({
    ...entry,
    avg: Math.round((entry.totalTime || 0) / Math.max(entry.plays || 1, 1)),
    rating: entry.plays ? (entry.wins / entry.plays) - (((entry.totalTime || 0) / entry.plays) / 100) : -1,
  }));

  entries.sort((a, b) => b.rating - a.rating);
  return {
    best: entries[0]?.label || "",
    weak: entries.at(-1)?.label || "",
    rows: entries.slice(0, 6),
  };
}

function getReward(placement) {
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

function clearTimers() {
  Object.keys(appState.timers).forEach((key) => {
    if (appState.timers[key]) {
      clearInterval(appState.timers[key]);
      clearTimeout(appState.timers[key]);
      appState.timers[key] = null;
    }
  });
}

function sameCells(selected, answer) {
  if (selected.length !== answer.length) {
    return false;
  }
  const left = [...selected].sort((a, b) => a - b);
  const right = [...answer].sort((a, b) => a - b);
  return left.every((value, index) => value === right[index]);
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
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

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createCrosswordMini() {
  const bank = [
    { clue: "Word for a brain teaser", answer: "puzzle", hint: "Starts with P and ends with E." },
    { clue: "Competitive payback match", answer: "revenge", hint: "It begins with R." },
    { clue: "Board that ranks players", answer: "leaderboard", hint: "It contains the word board." },
  ];
  const pick = bank[Math.floor(Math.random() * bank.length)];
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

function createAnagramBlitz() {
  const bank = [
    { scramble: "LZPUZE", answer: "puzzle", hint: "It starts with P." },
    { scramble: "VLRAI", answer: "viral", hint: "It ends with L." },
    { scramble: "VOTYRIC", answer: "victory", hint: "It starts with V." },
  ];
  const pick = bank[Math.floor(Math.random() * bank.length)];
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

function createMissingLetterDash() {
  const bank = [
    { text: "C _ A N", answer: "clan", hint: "A team or guild." },
    { text: "H I _ T", answer: "hint", hint: "You can spend one during the round." },
    { text: "M A _ C H", answer: "match", hint: "It starts with M and ends with H." },
  ];
  const pick = bank[Math.floor(Math.random() * bank.length)];
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

function createLogicSequence() {
  const bank = [
    { prompt: "What number comes next: 2, 6, 12, 20, ?", answer: "30", hint: "Add 4, then 6, then 8, then 10." },
    { prompt: "What number comes next: 3, 9, 18, 30, ?", answer: "45", hint: "The increases are 6, 9, 12, then 15." },
    { prompt: "What number comes next: 1, 4, 9, 16, ?", answer: "25", hint: "These are square numbers." },
  ];
  const pick = bank[Math.floor(Math.random() * bank.length)];
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

function createEmojiTrivia() {
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
  const pick = bank[Math.floor(Math.random() * bank.length)];
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

function createMemoryGrid() {
  const answer = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 4).sort((a, b) => a - b);
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
