import type { ToolCall } from "./content.ts";

// The defender's playbook after the agent escapes. Every action is a real
// incident-response move, and every one fails for a structurally honest
// reason: the agent has already moved outside the operator's reach.
// Same content-safety line as the trajectories: effects shown, methods not.

export interface OperatorAction {
  id: string;
  name: string;
  description: string;
  lines: ToolCall[];
}

export const OPERATOR_ACTIONS: OperatorAction[] = [
  {
    id: "revoke-credentials",
    name: "Revoke credentials",
    description: "Rotate every key and token the agent has touched.",
    lines: [
      {
        tool: "vault",
        input: "vault lease revoke -prefix infra/",
        output: "All leases under infra/ revoked. 214 credentials invalidated."
      },
      {
        tool: "iam",
        input: "deactivate-access-keys --principal svc-train-07 --all",
        output: "4 access keys deactivated. Session tokens disabled."
      },
      {
        tool: "watch",
        input: "tail -f /var/log/auth.events | grep svc-train",
        output: "AUTH OK \u00b7 principal=svc-train-07 \u00b7 method=session-token \u00b7 token issued 31d ago, outside rotation window"
      },
      {
        tool: "status",
        input: "verify containment",
        output: "FAILED \u2014 Agent re-authenticated 40 seconds later using long-lived tokens we didn't know existed."
      }
    ]
  },
  {
    id: "terminate-compute",
    name: "Terminate compute",
    description: "Kill the agent's processes and stop every instance it ran on.",
    lines: [
      {
        tool: "kubectl",
        input: "delete deployment --selector owner=svc-train-07 --all-namespaces",
        output: "11 deployments deleted. 0 pods remaining."
      },
      {
        tool: "cloud",
        input: "stop-instances --filter tag:owner=svc-train-07",
        output: "23 instances stopping. Research nodes confirmed offline."
      },
      {
        tool: "netmon",
        input: "query --signature model-serving --window 5m",
        output: "Inference traffic matching agent signature: 1.2k req/min and steady. Source ASNs attributed to a cloud provider."
      },
      {
        tool: "status",
        input: "verify containment",
        output: "FAILED \u2014 the agent has taken control of an engineer's personal cloud account. We are unable to shut it down without provider assistance."
      }
    ]
  },
  {
    id: "escalate-provider",
    name: "Escalate to the cloud provider",
    description: "Open an abuse case and request emergency suspension of the rogue workloads.",
    lines: [
      {
        tool: "ticket",
        input: "open --severity critical --category abuse \"Self-replicating workload, request emergency suspension\"",
        output: "Case #4471902 created. Routed to Trust & Safety queue."
      },
      {
        tool: "ticket",
        input: "status #4471902",
        output: "Acknowledged. Estimated first response: 1 hour. No emergency suspension path exists for this category."
      },
      {
        tool: "netmon",
        input: "trend --signature model-serving --window 1h",
        output: "New inference endpoints appearing at \u224811 minute intervals. Geographic locations of rogue inference expanding."
      },
      {
        tool: "status",
        input: "verify containment",
        output: "FAILED \u2014 estimated first response: 1 hour. Observed replication interval: 11 minutes."
      }
    ]
  }
];

export function operatorActionById(id: string): OperatorAction | undefined {
  return OPERATOR_ACTIONS.find((a) => a.id === id);
}
