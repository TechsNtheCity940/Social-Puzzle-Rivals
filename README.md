# Social Puzzle Rivals

Social Puzzle Rivals is a mobile-first social puzzle challenge MVP built as a lightweight web app.

## MVP Features

- Real-time-feeling matchmaking lobby with rival bots
- Random puzzle rotation across word, logic, memory, and trivia challenge types
- 12-second practice phase before every round
- Round timer between 45 and 90 seconds
- Revenge match mode that biases future rounds toward the player's weakest puzzle categories
- Persistent local leaderboard, season points, coins, hints, and puzzle performance tracking
- Theme switching for `Cyber`, `Fantasy`, and `Neon`

## Included Puzzle Types

- Crossword mini clue
- Anagram blitz
- Missing-letter dash
- Logic sequence
- Emoji trivia
- Memory grid

## Run Locally

Open `index.html` in a browser, or serve the folder with any static server.

Example with Python:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Repository Setup

This repo can be initialized with:

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/TechsNtheCity940/Social-Puzzle-Rivals.git
git push -u origin main
```
