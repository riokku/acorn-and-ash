# 0215 — Manage objects where they stand

Right-clicking a placed object opens its owner actions. Indoor and outdoor decorations can move without paying again, or pack up into their full original building materials. This preserves the existing indoor reclamation rule without adding inventory IDs for every piece. Other structures can be dismantled for half their current tier's costs, rounded down. Refunds are displayed before confirmation; homes additionally require typing DISMANTLE.

The server checks ownership, reach, activity, destination clearance and full refund capacity before mutating anything. Occupied boats/homes, home decorations, stored items/logs, crops and remaining fire fuel block dismantling. No partial refund, ground spill or automatic destruction of belongings occurs.

The existing decoration request/reply channel gains explicitly scoped outdoor move/reclaim actions and a separate stable request-kind order. Existing action and kind IDs remain unchanged. Save writes commit inventory and placed-object changes together. Movement updates colliders and saved coordinates; removal uses the existing complete building-removal path.
