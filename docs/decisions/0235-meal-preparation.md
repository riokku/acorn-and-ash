# Meal preparation for an outing

## Context

Rations, stew and tea already provide mutually exclusive ten-minute benefits. Their Craft entries show ingredients, but do little to connect a recipe to an outing or explain how gathering, roasting and preparing fit together. Winter travel also needs a modest food preparation choice.

## Decision

The Food page now explains each meal's role: rations for hunting and evasive movement, stew for recovery during difficult fights, and berry tea for winter walks and gathering. Each guided recipe shows its ingredient route, current/required ingredient counts, packed servings and where to learn it. A preparation summary shows the current meal, remaining time, nearby fire readiness and the rule that cooking packs food while eating activates a benefit. Fire and fireplace panels link directly to this page.

Berry tea retains its gathering recovery bonus and adds ten points of effective warmth while its existing meal timer is active. The server adds this to exposure calculations; it does not rewrite gear stats, refill warmth instantly or replace clothing and shelter. Expiry or another special meal removes the bonus. Existing food IDs, recipe costs, unlocks, single-benefit rules, cooking speed and saved timers are unchanged.

## Consequences

Players can deliberately collect ingredients and prepare for an outing using current controls. Ingredient checks, spending and eating remain server-owned. The interface does not batch-craft or automatically eat food. The UI preview is `?gallery=meal-preparation`; `&before` shows the recipe list without the new guide.
