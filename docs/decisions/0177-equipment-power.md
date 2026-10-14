# Equipment Power

## Context

Chris approved a small equipment-driven character stat system, extending the previously cosmetic gear: Power, Protection, Vitality and Warmth. Character body choices stay cosmetic and share the same baseline. Begin with modest upgrades and retain the current movement and action timing.

## Decision

Fixed item bonuses live in a shared typed table. Power is the percentage of the existing attack damage: baseline 100%, iron sword 150%, hunting knife and refined axe 125%. Only the effective main-hand item contributes Power. A knife in the off hand and a holstered sword contribute none.

The server scales accumulated damage for raiders and multi-hit wildlife. Existing move weights, dodge immunity, poise and knockback remain based on the move itself. Chopping, digging and one-hit prey retain their existing rules. Fractional damage accumulates; remaining hit counts round up for the existing integer wire format.

The character screen shows the active total. Pack tooltips describe bonuses and compare the slot right-click will actually use. Saving continues to store equipment, deriving totals on return rather than persisting a second source of truth.

## Consequences

Equipment discoveries become useful with no new leveling or randomized item system. The follow-up PRs add Protection, Vitality and winter Warmth to this foundation. Balance values are data and can be tuned through playtesting.
