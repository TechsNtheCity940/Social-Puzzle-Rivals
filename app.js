const PUZZLE_ART = {
  word: "assets/puzzle-word.svg",
  logic: "assets/puzzle-logic.svg",
  visual: "assets/puzzle-logic.svg",
  memory: "assets/puzzle-memory.svg",
  trivia: "assets/puzzle-trivia.svg",
  lateral: "assets/puzzle-trivia.svg",
};

const state = {
  bootstrap: null,
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
  resetButton: document.getElementById("resetButton"),
  practiceCard: document.getElementById("practiceCard"),
  practiceStage: document.getElementById("practiceStage"),
  practicePuzzleTitle: document.getElementById("practicePuzzleTitle"),
  practiceStatus: document.getElementById("practiceStatus"),
  practicePrompt: document.getElementById("practicePrompt"),
  practiceWorkspace: document.getElementById("practiceWorkspace"),
  practiceHintCopy: document.getElementById("practiceHintCopy"),
  practiceCheckButton: document.getElementById("practiceCheckButton"),
  practiceArt: document.getElementById("practiceArt"),
  challengeForm: document.getElementById("challengeForm"),
  challengeTitle: document.getElementById("challengeTitle"),
  challengePrompt: document.getElementById("challengePrompt"),
  challengeWorkspace: document.getElementById("challengeWorkspace"),
  challengeArt: document.getElementById("challengeArt"),
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
  tournamentList: document.getElementById("tournamentList"),
  clanList: document.getElementById("clanList"),
  themeButtons: Array.from(document.querySelectorAll("[data-theme-option]")),
};

refs.joinButton.addEventListener("click", () => startMatch(false));
refs.revengeButton.addEventListener("click", () => startMatch(true));
refs.hintButton.addEventListener("click", useHint);
refs.resetButton.addEventListener("click", resetProfile);
refs.practiceCheckButton.addEventListener("click", checkPracticeAnswer);
refs.challengeForm.addEventListener("submit", handleAnswerSubmit);
refs.themeButtons.forEach((button) => {
  button.addEventListener("click", () => setTheme(button.dataset.themeOption));
});

boot();

async function boot() {
  try {
    await refreshBootstrap();
    renderRivals([]);
  } catch (error) {
    renderError(error.message);
  }
}

async function refreshBootstrap() {
  state.bootstrap = await api("/api/bootstrap");
  renderBootstrap();
}

function renderBootstrap() {
  const { profile, insights, leaderboard, tournaments, clans } = state.bootstrap;

  refs.seasonPoints.textContent = profile.seasonPoints;
  refs.coins.textContent = profile.coins;
  refs.hints.textContent = profile.hints;
  refs.bestCategory.textContent = insights.best;
  refs.weakCategory.textContent = insights.weak;
  refs.categoryStats.innerHTML = insights.rows.length
    ? insights.rows.map((row) => `
      <div class="category-row">
        <div class="row-main">
          ${renderAvatar(row.label, true)}
          <strong>${row.label}</strong>
        </div>
        <span class="board-subtle">${row.wins}/${row.plays} wins - avg ${row.avg}s</span>
      </div>
    `).join("")
    : '<div class="category-row"><strong>No matches yet</strong><span class="board-subtle">Play a round to train the rivalry AI.</span></div>';

  refs.leaderboardList.innerHTML = leaderboard.map((entry) => `
    <article class="board-row">
      <div class="board-main">
        <div class="row-main">
          ${renderAvatar(entry.name)}
          <strong>#${entry.rank} ${entry.name}</strong>
        </div>
        <span>${entry.points} pts</span>
      </div>
      <div class="board-subtle">${entry.subtitle}</div>
    </article>
  `).join("");

  refs.tournamentList.innerHTML = tournaments.map((entry) => `
    <div class="meta-row">
      <div class="meta-row-top">
        <img class="mini-icon" src="assets/badge-burst.svg" alt="">
        <strong>${entry.name}</strong>
      </div>
      <div class="board-subtle">${entry.window} - ${entry.focus}</div>
      <div class="board-subtle">Prize: ${entry.prize}</div>
    </div>
  `).join("");

  refs.clanList.innerHTML = clans.map((entry) => `
    <div class="meta-row">
      <div class="meta-row-top">
        ${renderAvatar(entry.name)}
        <strong>${entry.name}</strong>
      </div>
      <div class="board-subtle">${entry.status} - ${entry.members} members</div>
      <div class="board-subtle">${entry.score} total score</div>
    </div>
  `).join("");

  document.body.dataset.theme = profile.theme;
  refs.themeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.themeOption === profile.theme);
  });

  refs.revengeButton.disabled = !profile.lastWinner || profile.lastWinner === "You";
  refs.hintButton.disabled = !state.match || state.match.phase !== "live" || profile.hints <= 0 || state.match.hintUsed;
}

async function startMatch(revengeMode) {
  try {
    clearTimers();
    document.body.classList.add("match-active");
    refs.joinButton.disabled = true;
    refs.revengeButton.disabled = true;
    refs.hintButton.disabled = true;
    refs.resultsCard.classList.add("hidden");
    refs.challengeForm.classList.add("hidden");
    refs.practiceStage.classList.remove("hidden");
    refs.practiceCard.classList.remove("hidden");
    refs.phaseTitle.textContent = "Lobby Locked";
    refs.phaseBadge.textContent = "Queue";
    refs.modeLabel.textContent = revengeMode ? "Revenge Match" : "Ranked Sprint";
    refs.announcement.textContent = revengeMode
      ? "Revenge lobby loaded. Practice the same puzzle family before the live duel starts."
      : "Lobby loaded. Everyone gets a playable warm-up before the live duel begins.";

    state.match = await api("/api/matchmaking/join", {
      method: "POST",
      body: JSON.stringify({ revengeMode }),
    });

    state.match.phase = "practice";
    state.match.penalties = 0;
    state.match.hintUsed = false;
    state.match.isResolving = false;
    resetSelections();

    renderRivals(state.match.rivals);
    refs.puzzleLabel.textContent = state.match.puzzle.name;
    refs.practiceTitle.textContent = `${state.match.puzzle.name} practice`;
    refs.practiceBody.textContent = state.match.practicePuzzle.practice;
    refs.countdownBadge.textContent = `${state.match.practiceSeconds}s`;
    refs.roundClock.textContent = `${state.match.roundSeconds}s`;
    refs.phaseTitle.textContent = "Playable Practice";
    refs.phaseBadge.textContent = "Warm-Up";

    renderPracticeStage(state.match.practicePuzzle);

    let remaining = state.match.practiceSeconds;
    refs.timers.countdown = setInterval(() => {
      remaining -= 1;
      refs.countdownBadge.textContent = `${remaining}s`;
      if (remaining <= 0) {
        clearInterval(refs.timers.countdown);
        refs.timers.countdown = null;
        beginRound();
      }
    }, 1000);
  } catch (error) {
    document.body.classList.remove("match-active");
    renderError(error.message);
    refs.joinButton.disabled = false;
    renderBootstrap();
  }
}

function renderPracticeStage(puzzle) {
  refs.practicePuzzleTitle.textContent = `${puzzle.name} Warm-Up`;
  refs.practicePrompt.textContent = puzzle.prompt;
  refs.practiceHintCopy.textContent = puzzle.practice;
  refs.practiceStatus.textContent = "Warm-Up";
  refs.practiceStage.dataset.puzzleFamily = getPuzzleFamily(puzzle);
  refs.practiceArt.src = getPuzzleArt(puzzle);
  renderPuzzleWorkspace({
    puzzle,
    workspace: refs.practiceWorkspace,
    scope: "practice",
  });
}

function beginRound() {
  if (!state.match) {
    return;
  }

  state.match.phase = "live";
  state.match.startedAt = Date.now();
  refs.practiceStage.classList.add("hidden");
  refs.practiceCard.classList.add("hidden");
  refs.phaseTitle.textContent = "Race Live";
  refs.phaseBadge.textContent = "Live";
  refs.challengeTitle.textContent = state.match.puzzle.name;
  refs.challengePrompt.textContent = state.match.puzzle.prompt;
  refs.penaltyChip.textContent = "Penalty +0s";
  refs.hintCopy.textContent = "Hints reveal a clue or remove one wrong option.";
  refs.challengeForm.classList.remove("hidden");
  refs.challengeForm.dataset.puzzleFamily = getPuzzleFamily(state.match.puzzle);
  refs.challengeArt.src = getPuzzleArt(state.match.puzzle);
  refs.announcement.textContent = `${state.match.puzzle.tagline} Practice is over. The live room is racing now.`;
  refs.hintButton.disabled = state.bootstrap.profile.hints <= 0;

  renderPuzzleWorkspace({
    puzzle: state.match.puzzle,
    workspace: refs.challengeWorkspace,
    scope: "live",
  });
  tickRoundClock(state.match.roundSeconds);

  refs.timers.round = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.match.startedAt) / 1000);
    const remaining = Math.max(state.match.roundSeconds - elapsed, 0);
    tickRoundClock(remaining);
    if (remaining <= 0) {
      submitTimeout();
    }
  }, 250);

  refs.timers.rivals = setInterval(updateRivalProgress, 350);
}

function renderPuzzleWorkspace({ puzzle, workspace, scope }) {
  workspace.innerHTML = "";
  workspace.className = `puzzle-workspace ${getPuzzleFamily(puzzle)} ${puzzle.kind}`;

  if (puzzle.kind === "text") {
    const widget = document.createElement("div");
    widget.className = "widget widget-text";
    widget.innerHTML = `
      <div class="widget-ribbon">${puzzle.name}</div>
      <input class="answer-input" id="${scope}AnswerInput" type="text" autocomplete="off" placeholder="${puzzle.placeholder}">
    `;
    workspace.appendChild(widget);
    document.getElementById(`${scope}AnswerInput`).focus();
    return;
  }

  if (puzzle.kind === "choice") {
    const widget = document.createElement("div");
    widget.className = "widget widget-choice";
    const grid = document.createElement("div");
    grid.className = "choice-grid";

    puzzle.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-button";
      button.innerHTML = `<span class="choice-tag">${String.fromCharCode(65 + index)}</span><span>${option}</span>`;
      button.addEventListener("click", () => {
        state.match[`${scope}Choice`] = option;
        Array.from(grid.children).forEach((child) => child.classList.remove("selected"));
        button.classList.add("selected");
      });
      grid.appendChild(button);
    });

    widget.appendChild(grid);
    workspace.appendChild(widget);
    return;
  }

  if (puzzle.kind === "memory") {
    const widget = document.createElement("div");
    widget.className = "widget widget-memory";

    const instructions = document.createElement("p");
    instructions.className = "hint-copy";
    instructions.textContent = scope === "practice"
      ? "Tap the glowing pattern from memory. Practice is safe."
      : "Memorize the glowing tiles, then rebuild the exact pattern.";

    const grid = document.createElement("div");
    grid.className = "memory-grid";
    puzzle.cells.forEach((cellIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "memory-button";
      button.textContent = cellIndex + 1;
      button.dataset.cellIndex = String(cellIndex);
      if (puzzle.previewCells.includes(cellIndex)) {
        button.classList.add("glow");
      }
      button.addEventListener("click", () => {
        button.classList.toggle("selected");
        state.match[`${scope}Cells`] = Array.from(grid.children)
          .filter((child) => child.classList.contains("selected"))
          .map((child) => Number(child.dataset.cellIndex));
      });
      grid.appendChild(button);
    });

    widget.appendChild(instructions);
    widget.appendChild(grid);
    workspace.appendChild(widget);
    setTimeout(() => {
      Array.from(grid.children).forEach((child) => child.classList.remove("glow"));
    }, scope === "practice" ? 3500 : 3000);
  }
}

function resetSelections() {
  state.match.practiceChoice = "";
  state.match.liveChoice = "";
  state.match.practiceCells = [];
  state.match.liveCells = [];
}

function checkPracticeAnswer() {
  if (!state.match) {
    return;
  }

  const puzzle = state.match.practicePuzzle;
  const correct = validateLocalPuzzle(puzzle, "practice");
  refs.practiceStatus.textContent = correct ? "Ready!" : "Keep Trying";
  refs.practiceHintCopy.textContent = correct
    ? "You cleared the warm-up. The live race will switch in when the countdown hits zero."
    : puzzle.hint;
}

function validateLocalPuzzle(puzzle, scope) {
  if (puzzle.kind === "text") {
    const value = document.getElementById(`${scope}AnswerInput`)?.value.trim() || "";
    return normalize(value) === normalize(puzzle.solution || "");
  }

  if (puzzle.kind === "choice") {
    return state.match[`${scope}Choice`] === puzzle.solution;
  }

  if (puzzle.kind === "memory") {
    const left = [...(state.match[`${scope}Cells`] || [])].sort((a, b) => a - b);
    const right = [...(puzzle.solution || [])].sort((a, b) => a - b);
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  return false;
}

async function handleAnswerSubmit(event) {
  event.preventDefault();
  if (!state.match || state.match.phase !== "live" || state.match.isResolving) {
    return;
  }

  try {
    state.match.isResolving = true;
    const payload = buildLiveSubmitPayload(false);
    const result = await api(`/api/matches/${state.match.id}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (result.finished) {
      applyFinishedMatch(result);
      return;
    }

    state.match.isResolving = false;
    state.match.penalties += 5;
    refs.penaltyChip.textContent = `Penalty +${state.match.penalties}s`;
    refs.challengeForm.classList.add("flash");
    setTimeout(() => refs.challengeForm.classList.remove("flash"), 500);
  } catch (error) {
    state.match.isResolving = false;
    renderError(error.message);
  }
}

async function submitTimeout() {
  if (!state.match || state.match.isResolving) {
    return;
  }

  try {
    state.match.isResolving = true;
    const result = await api(`/api/matches/${state.match.id}/submit`, {
      method: "POST",
      body: JSON.stringify({ timedOut: true }),
    });
    applyFinishedMatch(result);
  } catch (error) {
    state.match.isResolving = false;
    renderError(error.message);
  }
}

function buildLiveSubmitPayload(timedOut) {
  const elapsedSeconds = (Date.now() - state.match.startedAt) / 1000;
  const payload = {
    timedOut,
    elapsedSeconds,
    penalties: state.match.penalties,
  };

  if (state.match.puzzle.kind === "text") {
    payload.answer = document.getElementById("liveAnswerInput").value.trim();
  }

  if (state.match.puzzle.kind === "choice") {
    payload.choice = state.match.liveChoice;
  }

  if (state.match.puzzle.kind === "memory") {
    payload.cells = state.match.liveCells;
  }

  return payload;
}

async function useHint() {
  if (!state.match || state.match.phase !== "live" || state.match.hintUsed) {
    return;
  }

  try {
    const result = await api(`/api/matches/${state.match.id}/hint`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    state.match.hintUsed = true;
    state.bootstrap.profile = result.profile;
    refs.hintCopy.textContent = result.hint;
    refs.hintButton.disabled = true;
    refs.hints.textContent = result.profile.hints;

    if (state.match.puzzle.kind === "choice" && result.removeOption) {
      const wrongButtons = Array.from(refs.challengeWorkspace.querySelectorAll(".choice-button"))
        .filter((button) => button.textContent.includes(result.removeOption));
      if (wrongButtons.length) {
        wrongButtons[0].disabled = true;
        wrongButtons[0].style.opacity = "0.35";
      }
    }
  } catch (error) {
    renderError(error.message);
  }
}

function applyFinishedMatch(result) {
  clearTimers();
  document.body.classList.remove("match-active");
  refs.practiceStage.classList.add("hidden");
  refs.practiceCard.classList.remove("hidden");
  refs.challengeForm.classList.add("hidden");
  refs.resultsCard.classList.remove("hidden");
  refs.phaseTitle.textContent = "Results";
  refs.phaseBadge.textContent = "Final";
  refs.hintButton.disabled = true;

  state.bootstrap = result.bootstrap;
  state.match = null;
  renderBootstrap();
  renderRivals([]);

  refs.resultsTitle.textContent = result.placement <= 3 ? `You placed #${result.placement}` : "You missed the podium";
  refs.resultsBody.textContent = result.correct
    ? `Solved in ${result.elapsedSeconds.toFixed(1)}s. Reward: +${result.reward.points} season points and +${result.reward.coins} coins.`
    : "Time expired before you locked the answer. Queue again or trigger revenge mode.";
  refs.podium.innerHTML = result.podium.map((entry) => `
    <div class="podium-place">
      <div>#${entry.rank}</div>
      <strong>${entry.name}</strong>
      <div class="board-subtle">${entry.time ? `${entry.time.toFixed(1)}s` : "DNF"}</div>
    </div>
  `).join("");

  refs.announcement.textContent = result.placement === 1
    ? "First place secured. Queue again before the room cools off."
    : `Winner: ${result.winner}. Revenge mode is tuned to your weaker categories for a harder rematch.`;
  refs.joinButton.disabled = false;
  refs.modeLabel.textContent = "Post Match";
  refs.roundClock.textContent = result.elapsedSeconds ? `${result.elapsedSeconds.toFixed(1)}s` : "DNF";
  refs.practiceTitle.textContent = "No match active";
  refs.practiceBody.textContent = "Each round announces the puzzle type, then gives you a short warm-up before the race begins.";
  refs.countdownBadge.textContent = "--";
}

function renderRivals(rivals) {
  if (!rivals.length) {
    refs.rivalsList.innerHTML = '<div class="rival-row"><div class="rival-main"><strong>No lobby yet</strong><span class="rival-meta">Tap Join Lobby to queue</span></div></div>';
    return;
  }

  refs.rivalsList.innerHTML = rivals.map((rival) => `
    <article class="rival-row">
      <div class="rival-main">
        <div class="row-main">
          ${renderAvatar(rival.name)}
          <strong>${rival.name}</strong>
        </div>
        <span class="rival-meta">${rival.mmr} MMR - ${capitalize(rival.status)}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${rival.progress}%"></div>
      </div>
    </article>
  `).join("");
}

function updateRivalProgress() {
  if (!state.match || state.match.phase !== "live") {
    return;
  }

  const elapsed = (Date.now() - state.match.startedAt) / 1000;
  state.match.rivals.forEach((rival) => {
    const progress = Math.min((elapsed / rival.finishTime) * 100, 100);
    rival.progress = Math.round(progress);
    rival.status = progress >= 100 ? "finished" : "solving";
  });
  renderRivals(state.match.rivals);
}

async function setTheme(theme) {
  try {
    const result = await api("/api/profile/theme", {
      method: "POST",
      body: JSON.stringify({ theme }),
    });
    state.bootstrap.profile = result.profile;
    renderBootstrap();
  } catch (error) {
    renderError(error.message);
  }
}

async function resetProfile() {
  try {
    clearTimers();
    document.body.classList.remove("match-active");
    state.match = null;
    state.bootstrap = await api("/api/profile/reset", {
      method: "POST",
      body: JSON.stringify({}),
    });
    refs.resultsCard.classList.add("hidden");
    refs.challengeForm.classList.add("hidden");
    refs.practiceStage.classList.add("hidden");
    refs.practiceCard.classList.remove("hidden");
    refs.phaseTitle.textContent = "Ready For Queue";
    refs.phaseBadge.textContent = "Idle";
    refs.modeLabel.textContent = "Ranked Sprint";
    refs.puzzleLabel.textContent = "Waiting";
    refs.roundClock.textContent = "--";
    refs.practiceTitle.textContent = "No match active";
    refs.practiceBody.textContent = "Each round announces the puzzle type, then gives you a short warm-up before the race begins.";
    refs.countdownBadge.textContent = "--";
    refs.announcement.textContent = "Profile reset. Queue up to start a ranked puzzle sprint.";
    renderBootstrap();
    renderRivals([]);
    refs.joinButton.disabled = false;
  } catch (error) {
    renderError(error.message);
  }
}

function tickRoundClock(remaining) {
  refs.roundClock.textContent = `${remaining}s`;
}

function clearTimers() {
  Object.keys(state.timers).forEach((key) => {
    if (state.timers[key]) {
      clearInterval(state.timers[key]);
      state.timers[key] = null;
    }
  });
}

function renderAvatar(label, small = false) {
  const letter = String(label).trim().charAt(0).toUpperCase();
  return `
    <span class="avatar-stack ${small ? "small" : ""}">
      <img class="avatar-frame-img" src="assets/avatar-frame-star.svg" alt="">
      <span class="avatar-letter">${letter}</span>
    </span>
  `;
}

function getPuzzleFamily(puzzle) {
  return String(puzzle.category || "word").toLowerCase();
}

function getPuzzleArt(puzzle) {
  return PUZZLE_ART[getPuzzleFamily(puzzle)] || PUZZLE_ART.word;
}

function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderError(message) {
  refs.announcement.textContent = `Server error: ${message}`;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}
