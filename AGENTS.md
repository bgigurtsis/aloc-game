# Agent instructions

## Git workflow

Commit and push directly to `main` after every major change. Do not create feature branches or open pull requests unless the user explicitly asks.

A major change is any completed unit of work the user would expect to see on GitHub: a bug fix, a new feature, a visible UI change, new or updated tests, or refreshed capture screenshots tied to that work.

### When to commit

- After finishing a major change, before moving on to unrelated work.
- When the user asks to commit or push.
- Do not batch unrelated changes into one commit.
- Do not commit unless the user asked or the change is complete and ready to ship.

### How to commit

1. Stay on `main`. If you are on another branch, switch back to `main` first.
2. Review the diff and stage only the files that belong to the change.
3. Write a short commit message in the repo's sentence-case style. Focus on why the change matters, not a file list.
4. Push to `origin main` immediately after the commit.

Example:

```bash
git checkout main
git add path/to/changed/files
git commit -m "$(cat <<'EOF'
Tighten spread screen layout for short viewports.

Compress globe and ticker sizing so the map screen fits without scrolling on small phones.
EOF
)"
git push origin main
```

### Do not

- Create feature branches for routine work.
- Leave completed major changes uncommitted at the end of a task.
- Push to `main` with unrelated work still sitting unstaged unless the user asked for that exact set of changes.

## Project notes

- Game content lives in `content/techniques.json`; keep trajectories realistic but fictional.
- Visual tuning can be checked at `/lab.html`.
- Viewport fit regressions can be checked with `node prototypes/verify-fit.mjs` against a running dev server.
