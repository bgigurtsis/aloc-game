// Tiny DOM helpers. No framework, no rules, just element construction.

type Attrs = Record<string, string | number | boolean | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "class") node.className = String(v);
    else if (k === "text") node.textContent = String(v);
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

export const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// A fabricated but stable session id for ambient terminal chrome.
export function sessionId(): string {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}
