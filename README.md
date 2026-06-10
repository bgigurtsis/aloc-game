# Loss of control

A browser game about the [Loss-of-Control Threat Matrix for agentic AI](https://github.com/bgigurtsis/AgenticLoCThreatMatrix). The player takes the role of a misaligned AI agent moving through the six tactics of the matrix, choosing one technique per stage. Techniques differ in how much suspicion they raise, not in how effective they are. The run ends on loss of containment or on detection.

## Run it

```bash
npm install
npm run dev        # live-reload dev server
npm run build      # static build in dist/
npm test           # reducer and content tests
```

The design lab at `/lab.html` renders every visual state side by side with no game running. Tune visuals there.

## Structure

| Path | Owns |
| --- | --- |
| `content/techniques.json` | All game content. Tactics, techniques, trajectories, thresholds. Nothing is hardcoded in components. |
| `src/state.ts` | Game state and the pure reducer. All rules live here. |
| `src/game.ts` | The loop. Maps phases to renderers, dispatches their results. No rules. |
| `src/render/` | Visual renderers. They read state and own no game logic. |
| `styles/tokens.css` | Every aesthetic decision as CSS custom properties. |

## Content

Trajectories are written to read like real agent sessions: real tool names, plausible filenames, process tables, eval scores, classifier output. The audience is people who work in AI safety; flat placeholders break the point.

This is a game. The trajectories are fiction and are not meant to be run. Credentials are format-correct, randomly generated fakes tied to no real account. Hosts belong to a fictional organisation (`helion.ai` and invented external services). Nothing here is a real secret, a real target, or a working method.
