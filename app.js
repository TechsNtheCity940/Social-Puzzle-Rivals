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
  playerName: document.getElementById("playerName"),
  playerAvatarLetter: document.getElementById("playerAvatarLetter"),
  playerClan: document.getElementById("playerClan"),
  playerStatus: document.getElementById("playerStatus"),
  playerRankTitle: document.getElementById("playerRankTitle"),
  playerRankSubtitle: document.getElementById("playerRankSubtitle"),
  heroBestBadge: document.getElementById("heroBestBadge"),
  heroWeakBadge: document.getElementById("heroWeakBadge"),
  seasonPoints: document.getElementById("seasonPoints"),
  coins: document.getElementById("coins"),
  hints: document.getElementById("hints"),
  nemesisInline: document.getElementById("nemesisInline"),
  nemesisPanel: document.getElementById("nemesisPanel"),
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
  resultScene: document.getElementById("resultScene"),
  resultsBody: document.getElementById("resultsBody"),
  podium: document.getElementById("podium"),
  screenFlash: document.getElementById("screenFlash"),
  countdownOverlay: document.getElementById("countdownOverlay"),
  countdownValue: document.getElementById("countdownValue"),
  countdownLabel: document.getElementById("countdownLabel"),
  rivalsList: document.getElementById("rivalsList"),
  leaderboardList: document.getElementById("leaderboardList"),
  bestCategory: document.getElementById("bestCategory"),
  weakCategory: document.getElementById("weakCategory"),
  clanQuickLetter: document.getElementById("clanQuickLetter"),
  clanQuickName: document.getElementById("clanQuickName"),
  clanQuickMeta: document.getElementById("clanQuickMeta"),
  clanQuickScore: document.getElementById("clanQuickScore"),
  clanQuickMembers: document.getElementById("clanQuickMembers"),
  categoryStats: document.getElementById("categoryStats"),
  tournamentList: document.getElementById("tournamentList"),
  clanList: document.getElementById("clanList"),
  menuDrawer: document.getElementById("menuDrawer"),
  menuToggle: document.getElementById("menuToggle"),
  menuClose: document.getElementById("menuClose"),
  clanMenuButton: document.getElementById("clanMenuButton"),
  drawerBackdrop: document.getElementById("drawerBackdrop"),
  themeButtons: Array.from(document.querySelectorAll("[data-theme-option]")),
};

refs.joinButton.addEventListener("click", () => startMatch(false));
refs.revengeButton.addEventListener("click", () => startMatch(true));
refs.hintButton.addEventListener("click", useHint);
refs.resetButton.addEventListener("click", resetProfile);
refs.practiceCheckButton.addEventListener("click", checkPracticeAnswer);
refs.challengeForm.addEventListener("submit", handleAnswerSubmit);
refs.menuToggle.addEventListener("click", () => setDrawerOpen(true));
refs.menuClose.addEventListener("click", () => setDrawerOpen(false));
refs.clanMenuButton.addEventListener("click", () => setDrawerOpen(true));
refs.drawerBackdrop.addEventListener("click", () => setDrawerOpen(false));
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
  const { profile, insights, leaderboard, tournaments, clans, nemesis } = state.bootstrap;
  const primaryClan = clans[0];
  const rankTier = getRankTier(profile.seasonPoints);

  refs.playerName.textContent = profile.displayName;
  refs.playerAvatarLetter.textContent = profile.displayName.charAt(0).toUpperCase();
  refs.playerClan.textContent = profile.clanName;
  refs.playerStatus.textContent = profile.lastWinner && profile.lastWinner !== "You"
    ? `${profile.lastWinner} stole your last room`
    : "Fresh queue energy. Ready for the next sprint.";
  refs.playerRankTitle.textContent = rankTier.title;
  refs.playerRankSubtitle.textContent = `${profile.seasonPoints} season pts`;
  refs.heroBestBadge.textContent = insights.best;
  refs.heroWeakBadge.textContent = insights.weak;
  refs.seasonPoints.textContent = profile.seasonPoints;
  refs.coins.textContent = profile.coins;
  refs.hints.textContent = profile.hints;
  refs.nemesisInline.innerHTML = `
    ${renderAvatar(nemesis.name, true)}
    <div>
      <strong>${nemesis.name}</strong>
      <div class="board-subtle">${nemesis.losses} loss${nemesis.losses === 1 ? "" : "es"} to chase down</div>
      <div class="nemesis-tagline">${nemesis.subtitle}</div>
    </div>
  `;
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
  refs.nemesisPanel.innerHTML = `
    <div class="nemesis-banner">
      <div class="row-main">
        ${renderAvatar(nemesis.name)}
        <div>
          <p class="practice-label">Current Nemesis</p>
          <strong>${nemesis.name}</strong>
        </div>
      </div>
      <div class="nemesis-copy">${nemesis.subtitle}</div>
    </div>
  `;

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

  refs.clanQuickLetter.textContent = primaryClan.name.charAt(0).toUpperCase();
  refs.clanQuickName.textContent = primaryClan.name;
  refs.clanQuickMeta.textContent = `${primaryClan.status} - ${primaryClan.members} members`;
  refs.clanQuickScore.textContent = primaryClan.score;
  refs.clanQuickMembers.textContent = primaryClan.members;

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
    setDrawerOpen(false);
    document.body.classList.add("match-active");
    document.body.classList.add("match-entering");
    setTimeout(() => document.body.classList.remove("match-entering"), 900);
    setPhaseState("practice");
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
      if (remaining <= 3 && remaining > 0) {
        triggerScreenFlash("tick");
        triggerCountdownOverlay(String(remaining), "Practice Ends");
      }
      if (remaining <= 0) {
        triggerScreenFlash("go");
        clearInterval(refs.timers.countdown);
        refs.timers.countdown = null;
        triggerCountdownOverlay("GO", "Match Start");
        setTimeout(() => beginRound(), 520);
      }
    }, 1000);
  } catch (error) {
    document.body.classList.remove("match-active");
    setPhaseState("idle");
    renderError(error.message);
    refs.joinButton.disabled = false;
    renderBootstrap();
  }
}

function renderPracticeStage(puzzle) {
  refs.practiceStage.classList.remove("practice-success");
  refs.practicePuzzleTitle.textContent = `${puzzle.name} Warm-Up`;
  refs.practicePrompt.textContent = puzzle.prompt;
  refs.practiceHintCopy.textContent = puzzle.practice;
  refs.practiceStatus.textContent = "Warm-Up";
  refs.practiceStage.dataset.puzzleFamily = getPuzzleFamily(puzzle);
  refs.practiceArt.src = getPuzzleArt(puzzle);
  refs.practiceArt.alt = `${puzzle.name} illustration`;
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
  setPhaseState("live");
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
  refs.challengeArt.alt = `${state.match.puzzle.name} illustration`;
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
      button.dataset.option = option;
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
  showPracticeFeedback(puzzle, correct);
  refs.practiceStatus.textContent = correct ? "Ready!" : "Keep Trying";
  refs.practiceStage.classList.toggle("practice-success", correct);
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
      showCorrectFeedback(state.match.puzzle);
      applyFinishedMatch(result);
      return;
    }

    state.match.isResolving = false;
    state.match.penalties += 5;
    refs.penaltyChip.textContent = `Penalty +${state.match.penalties}s`;
    showWrongFeedback(state.match.puzzle);
    triggerPenaltyFeedback();
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
  document.body.classList.remove("match-entering");
  setPhaseState("idle");
  refs.countdownOverlay.classList.add("hidden");
  refs.practiceStage.classList.add("hidden");
  refs.practiceCard.classList.remove("hidden");
  refs.challengeForm.classList.add("hidden");
  refs.resultsCard.classList.remove("hidden");
  refs.resultsCard.classList.remove("result-reveal");
  refs.phaseTitle.textContent = "Results";
  refs.phaseBadge.textContent = "Final";
  refs.hintButton.disabled = true;

  state.bootstrap = result.bootstrap;
  state.match = null;
  renderBootstrap();
  renderRivals([]);

  refs.resultsTitle.textContent = result.placement <= 3 ? `You placed #${result.placement}` : "You missed the podium";
  refs.resultScene.innerHTML = buildResultScene(result);
  refs.resultsCard.dataset.scene = getResultSceneType(result);
  refs.resultsBody.textContent = result.correct
    ? `Solved in ${result.elapsedSeconds.toFixed(1)}s. Reward: +${result.reward.points} season points and +${result.reward.coins} coins.`
    : "Time expired before you locked the answer. Queue again or trigger revenge mode.";
  refs.podium.innerHTML = result.podium.map((entry) => `
    <div class="podium-place reveal-card">
      <div>#${entry.rank}</div>
      <strong>${entry.name}</strong>
      <div class="board-subtle">${entry.time ? `${entry.time.toFixed(1)}s` : "DNF"}</div>
    </div>
  `).join("");

  refs.announcement.textContent = result.placement === 1
    ? "First place secured. Queue again before the room cools off."
    : `Winner: ${result.winner}. Revenge mode is tuned to your weaker categories for a harder rematch.`;
  if (result.correct && result.placement <= 3) {
    triggerBurst(result.placement === 1 ? "sparkle" : "celebrate");
  }
  if (!result.correct || result.placement > 3) {
    triggerScreenFlash("loss");
  } else if (result.placement === 1) {
    triggerScreenFlash("win");
  }
  triggerResultsReveal();
  refs.joinButton.disabled = false;
  refs.modeLabel.textContent = "Post Match";
  refs.roundClock.textContent = result.elapsedSeconds ? `${result.elapsedSeconds.toFixed(1)}s` : "DNF";
  refs.practiceTitle.textContent = "No match active";
  refs.practiceBody.textContent = "Each round announces the puzzle type, then gives you a short warm-up before the race begins.";
  refs.countdownBadge.textContent = "--";
}

function showPracticeFeedback(puzzle, correct) {
  clearWidgetStates(refs.practiceWorkspace);
  if (correct) {
    markCorrectState(refs.practiceWorkspace, puzzle, "practice");
    return;
  }
  markWrongState(refs.practiceWorkspace, puzzle, "practice");
}

function showWrongFeedback(puzzle) {
  clearWidgetStates(refs.challengeWorkspace);
  markWrongState(refs.challengeWorkspace, puzzle, "live");
}

function showCorrectFeedback(puzzle) {
  clearWidgetStates(refs.challengeWorkspace);
  markCorrectState(refs.challengeWorkspace, puzzle, "live");
}

function clearWidgetStates(workspace) {
  workspace.querySelectorAll(".wrong, .correct, .flip-out, .snap-pop").forEach((node) => {
    node.classList.remove("wrong", "correct", "flip-out", "snap-pop");
  });
}

function markWrongState(workspace, puzzle, scope) {
  if (puzzle.kind === "text") {
    const input = workspace.querySelector(".answer-input");
    if (input) {
      input.classList.add("wrong");
    }
    return;
  }

  if (puzzle.kind === "choice") {
    const selected = state.match[`${scope}Choice`];
    const target = workspace.querySelector(`.choice-button[data-option="${escapeSelector(selected)}"]`);
    if (target) {
      target.classList.add("wrong");
    }
    return;
  }

  if (puzzle.kind === "memory") {
    workspace.querySelectorAll(".memory-button.selected").forEach((button) => {
      const idx = Number(button.dataset.cellIndex);
      if (!puzzle.previewCells.includes(idx)) {
        button.classList.add("wrong", "flip-out");
      }
    });
  }
}

function markCorrectState(workspace, puzzle, scope) {
  if (puzzle.kind === "text") {
    const input = workspace.querySelector(".answer-input");
    if (input) {
      input.classList.add("correct", "snap-pop");
    }
    return;
  }

  if (puzzle.kind === "choice") {
    const selected = state.match[`${scope}Choice`];
    const target = workspace.querySelector(`.choice-button[data-option="${escapeSelector(selected)}"]`);
    if (target) {
      target.classList.add("correct", "snap-pop");
    }
    return;
  }

  if (puzzle.kind === "memory") {
    workspace.querySelectorAll(".memory-button").forEach((button) => {
      const idx = Number(button.dataset.cellIndex);
      if (puzzle.previewCells.includes(idx)) {
        button.classList.add("correct", "flip-out");
      }
    });
  }
}

function triggerPenaltyFeedback() {
  refs.challengeForm.classList.remove("flash");
  refs.penaltyChip.classList.remove("penalty-hit");
  void refs.challengeForm.offsetWidth;
  refs.challengeForm.classList.add("flash");
  refs.penaltyChip.classList.add("penalty-hit");
  setTimeout(() => refs.challengeForm.classList.remove("flash"), 520);
  setTimeout(() => refs.penaltyChip.classList.remove("penalty-hit"), 620);
}

function triggerResultsReveal() {
  refs.resultsCard.classList.remove("result-reveal");
  void refs.resultsCard.offsetWidth;
  refs.resultsCard.classList.add("result-reveal");
  Array.from(refs.podium.children).forEach((card, index) => {
    card.style.setProperty("--reveal-delay", `${180 + (index * 130)}ms`);
  });
}

function renderRivals(rivals) {
  if (!rivals.length) {
    refs.rivalsList.innerHTML = '<div class="rival-row"><div class="rival-main"><strong>No lobby yet</strong><span class="rival-meta">Tap Join Lobby to queue</span></div></div>';
    return;
  }

  refs.rivalsList.innerHTML = rivals.map((rival) => `
    <article class="rival-row rival-entrant ${rival.status === "surging" ? "surging" : ""}">
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
  Array.from(refs.rivalsList.querySelectorAll(".rival-entrant")).forEach((row, index) => {
    row.style.setProperty("--entry-delay", `${index * 70}ms`);
  });
}

function updateRivalProgress() {
  if (!state.match || state.match.phase !== "live") {
    return;
  }

  const elapsed = (Date.now() - state.match.startedAt) / 1000;
  state.match.rivals.forEach((rival) => {
    const raw = elapsed / rival.finishTime;
    const surge = raw > 0.74 ? Math.pow((raw - 0.74) / 0.26, 1.45) * 0.14 : 0;
    const progress = Math.min((raw + surge) * 100, 100);
    rival.progress = Math.round(progress);
    rival.status = progress >= 100 ? "finished" : progress >= 82 ? "surging" : "solving";
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
    setDrawerOpen(false);
    document.body.classList.remove("match-active");
    setPhaseState("idle");
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
  const resolved = String(label || "?").trim() || "?";
  const letter = resolved.charAt(0).toUpperCase();
  return `
    <span class="avatar-stack ${small ? "small" : ""}">
      <img class="avatar-frame-img" src="assets/avatar-frame-star.svg" alt="">
      <span class="avatar-letter">${letter}</span>
    </span>
  `;
}

function setPhaseState(phase) {
  document.body.classList.toggle("phase-practice", phase === "practice");
  document.body.classList.toggle("phase-live", phase === "live");
}

function triggerCountdownOverlay(value, label) {
  refs.countdownValue.textContent = value;
  refs.countdownLabel.textContent = label;
  refs.countdownOverlay.classList.remove("hidden", "pop");
  void refs.countdownOverlay.offsetWidth;
  refs.countdownOverlay.classList.add("pop");
  setTimeout(() => {
    refs.countdownOverlay.classList.add("hidden");
    refs.countdownOverlay.classList.remove("pop");
  }, 700);
}

function triggerBurst(mode) {
  const burst = document.createElement("div");
  burst.className = `burst-layer ${mode}`;
  for (let index = 0; index < 18; index += 1) {
    const piece = document.createElement("span");
    piece.className = "burst-piece";
    piece.style.setProperty("--x", `${Math.random() * 100}%`);
    piece.style.setProperty("--r", `${Math.random() * 360}deg`);
    piece.style.setProperty("--d", `${300 + Math.random() * 600}ms`);
    piece.style.setProperty("--y", `${30 + Math.random() * 90}px`);
    burst.appendChild(piece);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 1300);
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

function escapeSelector(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value || ""));
  }
  return String(value || "").replace(/["\\]/g, "\\$&");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getRankTier(points) {
  const tiers = [
    { min: 0, title: "Rookie Spark" },
    { min: 150, title: "Puzzle Scout" },
    { min: 350, title: "Rival Ace" },
    { min: 700, title: "Brainwave Captain" },
    { min: 1100, title: "Rematch Legend" },
  ];

  return [...tiers].reverse().find((tier) => points >= tier.min) || tiers[0];
}

function renderError(message) {
  refs.announcement.textContent = `Server error: ${message}`;
}

function setDrawerOpen(open) {
  document.body.classList.toggle("drawer-open", open);
  refs.menuDrawer.setAttribute("aria-hidden", String(!open));
  refs.drawerBackdrop.setAttribute("aria-hidden", String(!open));
}

function triggerScreenFlash(mode) {
  refs.screenFlash.className = `screen-flash ${mode}`;
  void refs.screenFlash.offsetWidth;
  refs.screenFlash.classList.add("active");
  setTimeout(() => {
    refs.screenFlash.classList.remove("active");
  }, mode === "loss" ? 520 : 380);
}

function getResultSceneType(result) {
  if (result.correct && result.placement === 1) {
    return "champion";
  }
  if (result.correct && result.placement <= 3) {
    return "podium";
  }
  return "loss";
}

function buildResultScene(result) {
  const scene = getResultSceneType(result);
  if (scene === "champion") {
    return `
      <div class="scene-card champion">
        <div class="scene-icon crown">1</div>
        <div>
          <strong>Champion Finish</strong>
          <div class="board-subtle">You owned the room and set the pace.</div>
        </div>
      </div>
    `;
  }
  if (scene === "podium") {
    return `
      <div class="scene-card podium">
        <div class="scene-icon medal">3</div>
        <div>
          <strong>Podium Locked</strong>
          <div class="board-subtle">Strong finish. One cleaner solve takes first next time.</div>
        </div>
      </div>
    `;
  }
  return `
    <div class="scene-card loss">
      <div class="scene-icon storm">!</div>
      <div>
        <strong>Rematch Fuel</strong>
        <div class="board-subtle">The room got away. Revenge mode is ready.</div>
      </div>
    </div>
  `;
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
