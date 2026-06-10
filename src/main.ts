import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import { Game } from "./game.ts";

const root = document.getElementById("app");
if (root) {
  const game = new Game(root);
  game.start();
}
