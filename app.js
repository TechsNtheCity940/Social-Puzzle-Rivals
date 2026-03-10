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
  tournamentList: document.getElementById("tournamentList"),
  clanList: document.getElementById("clanList"),
  themeButtons: Array.from(document.querySelectorAll("[data-theme-option]")),
};

refs.joinButton.addEventListener("click", () => startMatch(false));
refs.revengeButton.addEventListener("click", () => startMatch(true));
refs.hintButton.addEventListener("click", useHint);
refs.resetButton.addEventListener("click", resetProfile);
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
        <strong>${row.label}</strong>
        <span class="board-subtle">${row.wins}/${row.plays} wins - avg ${row.avg}s</span>
      </div>
    `).join("")
    : '<div class="category-row"><strong>No matches yet</strong><span class="board-subtle">Play a round to train the rivalry AI.</span></div>';

  refs.leaderboardList.innerHTML = leaderboard.map((entry) => `
    <article class="board-row">
      <div class="board-main">
        <strong>#${entry.rank} ${entry.name}</strong>
        <span>${entry.points} pts</span>
      </div>
      <div class="board-subtle">${entry.subtitle}</div>
    </article>
  `).join("");

  refs.tournamentList.innerHTML = tournaments.map((entry) => `
    <div class="meta-row">
      <strong>${entry.name}</strong>
      <div class="board-subtle">${entry.window} - ${entry.focus}</div>
      <div class="board-subtle">Prize: ${entry.prize}</div>
    </div>
  `).join("");

  refs.clanList.innerHTML = clans.map((entry) => `
    <div class="meta-row">
      <strong>${entry.name}</strong>
      <div class="board-subtle">${entry.status} - ${entry.members} members</div>
      <div class="board-subtle">${entry.score} total score</div>
    </div>
  `).join("");

  document.body.dataset.theme = profile.theme;
  refs.themeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.themeOption === profile.theme);
  });

  refs.revengeButton.disabled = !profile.lastWinner || profile.lastWinner === "You";
  refs.hintButton.disabled = !state.match || profile.hints <= 0 || state.match.hintUsed || refs.challengeForm.classList.contains("hidden");
}

async function startMatch(revengeMode) {
  try {
    clearTimers();
    refs.joinButton.disabled = true;
    refs.revengeButton.disabled = true;
    refs.hintButton.disabled = true;
    refs.resultsCard.classList.add("hidden");
    refs.challengeForm.classList.add("hidden");
    refs.practiceCard.classList.remove("hidden");
    refs.phaseTitle.textContent = "Filling Lobby";
    refs.phaseBadge.textContent = "Queue";
    refs.modeLabel.textContent = revengeMode ? "Revenge Match" : "Ranked Sprint";
    refs.announcement.textContent = revengeMode
      ? "AI selected revenge mode. Expect a category that usually slows you down."
      : "Matchmaking in progress. Puzzle type will be announced when the room fills.";

    state.match = await api("/api/matchmaking/join", {
      method: "POST",
      body: JSON.stringify({ revengeMode }),
    });

    state.match.penalties = 0;
    state.match.hintUsed = false;
    state.match.selectedChoice = "";
    state.match.selectedCells = [];

    renderRivals(state.match.rivals);
    refs.puzzleLabel.textContent = state.match.puzzle.name;
    refs.practiceTitle.textContent = `${state.match.puzzle.name} incoming`;
    refs.practiceBody.textContent = state.match.puzzle.practice;
    refs.countdownBadge.textContent = `${state.match.practiceSeconds}s`;
    refs.roundClock.textContent = `${state.match.roundSeconds}s`;
    refs.phaseTitle.textContent = "Practice Window";
    refs.phaseBadge.textContent = "Warm-up";

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
    renderError(error.message);
    refs.joinButton.disabled = false;
    renderBootstrap();
  }
}

function beginRound() {
  state.match.startedAt = Date.now();
  refs.phaseTitle.textContent = "Race Live";
  refs.phaseBadge.textContent = "Live";
  refs.challengeTitle.textContent = state.match.puzzle.name;
  refs.challengePrompt.textContent = state.match.puzzle.prompt;
  refs.penaltyChip.textContent = "Penalty +0s";
  refs.hintCopy.textContent = "Hints reveal a clue or remove one wrong option.";
  refs.challengeForm.classList.remove("hidden");
  refs.announcement.textContent = `${state.match.puzzle.tagline} First correct solve takes the room. Wrong answers cost 5 seconds.`;
  refs.hintButton.disabled = state.bootstrap.profile.hints <= 0;

  renderWorkspace(state.match.puzzle);
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

function renderWorkspace(puzzle) {
  refs.challengeWorkspace.innerHTML = "";
  state.match.selectedChoice = "";
  state.match.selectedCells = [];

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
        state.match.selectedChoice = option;
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
      button.dataset.cellIndex = String(cellIndex);
      if (puzzle.previewCells.includes(cellIndex)) {
        button.classList.add("glow");
      }
      button.addEventListener("click", () => {
        button.classList.toggle("selected");
        state.match.selectedCells = Array.from(grid.children)
          .filter((child) => child.classList.contains("selected"))
          .map((child) => Number(child.dataset.cellIndex));
      });
      grid.appendChild(button);
    });
    refs.challengeWorkspace.appendChild(grid);
    setTimeout(() => {
      Array.from(grid.children).forEach((child) => child.classList.remove("glow"));
    }, 3000);
  }
}

async function handleAnswerSubmit(event) {
  event.preventDefault();
  if (!state.match) {
    return;
  }

  try {
    const payload = buildSubmitPayload(false);
    const result = await api(`/api/matches/${state.match.id}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (result.finished) {
      applyFinishedMatch(result);
      return;
    }

    state.match.penalties += 5;
    refs.penaltyChip.textContent = `Penalty +${state.match.penalties}s`;
    refs.challengeForm.classList.add("flash");
    setTimeout(() => refs.challengeForm.classList.remove("flash"), 500);
  } catch (error) {
    renderError(error.message);
  }
}

async function submitTimeout() {
  if (!state.match) {
    return;
  }

  try {
    const result = await api(`/api/matches/${state.match.id}/submit`, {
      method: "POST",
      body: JSON.stringify({ timedOut: true }),
    });
    applyFinishedMatch(result);
  } catch (error) {
    renderError(error.message);
  }
}

function buildSubmitPayload(timedOut) {
  const elapsedSeconds = ((Date.now() - state.match.startedAt) / 1000);
  const payload = {
    timedOut,
    elapsedSeconds,
    penalties: state.match.penalties,
  };

  if (state.match.puzzle.kind === "text") {
    payload.answer = document.getElementById("answerInput").value.trim();
  }

  if (state.match.puzzle.kind === "choice") {
    payload.choice = state.match.selectedChoice;
  }

  if (state.match.puzzle.kind === "memory") {
    payload.cells = state.match.selectedCells;
  }

  return payload;
}

async function useHint() {
  if (!state.match || state.match.hintUsed) {
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
        .filter((button) => button.textContent === result.removeOption);
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
}

function renderRivals(rivals) {
  if (!rivals.length) {
    refs.rivalsList.innerHTML = '<div class="rival-row"><div class="rival-main"><strong>No lobby yet</strong><span class="rival-meta">Tap Join Lobby to queue</span></div></div>';
    return;
  }

  refs.rivalsList.innerHTML = rivals.map((rival) => `
    <article class="rival-row">
      <div class="rival-main">
        <strong>${rival.name}</strong>
        <span class="rival-meta">${rival.mmr} MMR - ${capitalize(rival.status)}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${rival.progress}%"></div>
      </div>
    </article>
  `).join("");
}

function updateRivalProgress() {
  if (!state.match) {
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
    state.match = null;
    state.bootstrap = await api("/api/profile/reset", {
      method: "POST",
      body: JSON.stringify({}),
    });
    refs.resultsCard.classList.add("hidden");
    refs.challengeForm.classList.add("hidden");
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
