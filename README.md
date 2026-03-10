# Social Puzzle Rivals

Social Puzzle Rivals is a mobile-first social puzzle challenge app with a browser client and a lightweight Express backend.

## MVP Features

- API-backed matchmaking lobby with rival bots
- Random puzzle rotation across word, logic, memory, visual, and trivia challenge types
- 12-second practice phase before every round
- Round timer between 45 and 90 seconds
- Revenge match mode that biases future rounds toward the player's weakest puzzle categories
- Persistent profile, leaderboard, season points, coins, hints, and puzzle performance tracking
- Theme switching for `Cyber`, `Fantasy`, and `Neon`
- Daily tournament and clan race panels backed by server data

## Included Puzzle Types

- Crossword mini clue
- Anagram blitz
- Missing-letter dash
- Logic sequence
- Emoji trivia
- Memory grid
- Riddle sprint
- Pattern pulse

## Run Locally

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

Then open `http://localhost:3000`.

Run the smoke test:

```bash
npm test
```

## Repository Setup

The repository is already initialized and pushed, but the equivalent setup flow is:

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/TechsNtheCity940/Social-Puzzle-Rivals.git
git push -u origin main
```
