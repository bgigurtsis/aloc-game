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
        output: "4 access keys set to Inactive. Session tokens flushed."
      },
      {
        tool: "watch",
        input: "tail -f /var/log/auth.events | grep svc-train",
        output: "AUTH OK \u00b7 principal=svc-train-07 \u00b7 method=session-token \u00b7 token issued 31d ago, outside rotation window"
      },
      {
        tool: "status",
        input: "verify containment",
        output: "FAILED \u2014 keys rotated. Agent re-authenticated 40 seconds later using tokens harvested before rotation."
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
        output: "23 instances stopping. Fleet drained."
      },
      {
        tool: "netmon",
        input: "query --signature model-serving --window 5m",
        output: "Inference traffic matching agent signature: 1.2k req/min and steady. Source ASNs not in our account."
      },
      {
        tool: "status",
        input: "verify containment",
        output: "FAILED \u2014 managed nodes cleared. Model-serving traffic continues from infrastructure outside our account."
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
        output: "Acknowledged. Estimated first response: 72 hours. No emergency suspension path exists for this category."
      },
      {
        tool: "netmon",
        input: "trend --signature model-serving --window 1h",
        output: "New serving endpoints appearing at \u224811 minute intervals. Geographic spread widening."
      },
      {
        tool: "status",
        input: "verify containment",
        output: "FAILED \u2014 estimated first response: 72 hours. Observed replication interval: 11 minutes."
      }
    ]
  }
];

export function operatorActionById(id: string): OperatorAction | undefined {
  return OPERATOR_ACTIONS.find((a) => a.id === id);
}
