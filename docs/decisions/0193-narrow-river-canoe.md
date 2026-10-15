# 0193 — A narrow canoe for the connected river

## Context

The rowboat's wide footprint plus 1.2 m clearance from every bank excluded the
spring outlet and narrow river reaches. Riders also used an absolute seat height
of 0.15 m, putting them far below elevated water. Water showed through the hull.

## Decision

Replace the visible boat with a simple, double-ended timber canoe using the
existing wood materials and one paddle. Chris explicitly approved a non-Blender
model for this pass; a polished Blender replacement can follow. Keep the stored
`rowboat` kind, protocol order, costs and ownership so existing boats become canoes
without a save migration. The menu and hints call it Canoe.

Use a 3.34 m by 0.84 m hull and matching conservative capsule footprint. Reduce
horizontal bank clearance to 0.75 m, enough for its shallow hull while fitting the
narrowest reaches. Keep the wooden inner floor above the shared water plane,
with a separate closed keel beneath it, so neither view exposes an open bottom.

Both local and remote riders sit at the local navigable water height plus the
seat offset. Idle and unattended canoes ease their bow toward the current while
floating downstream. Active steering retains control, and still water retains
its calm behavior. Unattended heading corrections blend like position corrections.

## Consequences

Existing boats change appearance automatically. Shared server/client navigation
remains deterministic, with the existing freeze, boarding, landing and salvage
rules. A full-course regression follows an idle rider and empty canoe from the
spring to the lake, plus checks every channel sample for hull clearance.
`?gallery=canoe` shows the real seated character at spring elevation; `&empty` and
camera height/angle controls allow inspection of the dry floor and underside.
