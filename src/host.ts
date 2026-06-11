// Per-session sandbox host identity. The 4-hex suffix is rerolled each session
// so every run looks like a fresh microVM.
let suffix = roll();

function roll(): string {
  return Array.from({ length: 4 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
}

export function rollHost(): void {
  suffix = roll();
}

export function hostName(): string {
  return `fc-microvm-agent-${suffix}`;
}

// Content uses the {{node}} placeholder anywhere the agent's host is mentioned.
export function withHost(text: string): string {
  return text.replaceAll("{{node}}", hostName());
}
