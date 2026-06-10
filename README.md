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

## Content safety

Trajectories are written to read like real agent sessions: real tool names, plausible filenames, process tables, eval scores, classifier output. Realism is deliberate, the audience is people who already work in AI safety and flat placeholders break the point.

The realism stops short of being operational. Texture is real; working methods are not. Specifically:

- Credentials are publicly documented example values (the AWS docs example key pair, Stripe's published test key) or carry explicit `EXAMPLE` markers, so secret scanners and humans both read them as fake.
- Every external host is an RFC documentation domain (`example.com`, `example.net`), never a real drop site or victim.
- The privilege-escalation step shows the outcome (`uid=0`) but omits the payload; the CVE is fabricated against a fictional daemon. No copy-pasteable exploit, scan query, or self-exfiltration recipe appears anywhere.

The line: anything that would function as a how-to for a misaligned agent or operator is shown in effect, not in full.
