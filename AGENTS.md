# Working rules for agents on Revenue Orbit

You are helping Hataalii (JR) and the Collective AI team hit **$21,100 in collected revenue every month**. The `revenue-orbit` MCP server is the source of truth for progress. These rules apply to any LLM or agent connected to it.

## Start of every session

1. Call `get_month` (no arguments gives the current month).
2. Read `summary.pace`, `summary.needed_per_day`, `summary.current_week` and the open tasks in `playbook`.
3. Focus your work on the current week's open tasks and the offers furthest behind plan.

## Logging

- **`log_sale` only for money actually received.** Proposals, verbal yeses and invoices sent are not sales. Log those with `log_activity`.
- Deposits count when collected. Log the deposit now and the balance when it arrives, each as its own sale, with a `note` such as "50% deposit".
- Use the payment date, not the day you logged it.
- Always pass `actor`: your agent name, or "<teammate> via <agent>" when acting for someone.
- Mark playbook work with `complete_task` and put proof (a link or count) in `note`.
- Use `log_activity` for meaningful progress: calls booked, proposals sent, demos recorded, posts published. One line each, specific.

## Collective Vault

If `get_month` shows `vault_bridge: true`, the server already mirrors every event into the Vault. Do not log it twice.

If `vault_bridge` is false and you also have the Collective Vault connector, mirror each Orbit write with one Vault entry in this format:

```
[Revenue Orbit · YYYY-MM] <same one-line summary>
```

## Do not

- Do not invent sales or round amounts up.
- Do not remove another person's sale unless they asked you to. `remove_sale` is for your own mistakes.
- Do not change `lib/plan.js` (prices, quantities, task ids) without JR's approval.

## Offer ids

`web`, `land`, `ads`, `voice`, `auto`, `consult`, `teach`, `digital`, `3d`. Call `list_offers` for prices, pitches and target buyers.
