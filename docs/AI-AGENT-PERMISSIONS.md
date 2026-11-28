# Administrator-managed AI agents

Only administrators create, edit, enable or delete agents in Administration → AI agents. They choose the provider, model, instructions and account-tier access. Model discovery is restricted to administrators, including direct API requests.

Members select an enabled published agent. They cannot submit a standalone provider/model configuration; server resolution requires an agent and replaces incoming provider/model values with its stored configuration. The same policy covers queued analyses, synchronous chat/review, scanners and newly saved schedules. Workers recheck access, enabled state and agent version before execution.

Members can save or remove their encrypted provider API keys in Settings → AI keys. Keys never become agent definitions. A personal key takes precedence for that provider; if none is saved, an existing administrator-managed service key remains available for agents configured with one. An enabled agent can also be published without a service key, in which case each user must supply their own. No keys are returned to clients.

An older analysis or schedule created without an agent cannot bypass this policy for a member. Recreate such schedules with a published agent. An administrator can still use the privileged API for maintenance; the interactive analysis screens offer published agents to every role.

The native source uses the same published-agent selector. An installed older native build needs an update to remove its legacy model editor; server permissions apply immediately even to older clients.
