# 0057. One of you per world

**Status:** accepted · **Date:** 2026-10-01

## Context

Chris found that after a few minutes of play the game would suddenly wake
Chris up at home, as if just arriving, and each time it left another copy of
the same character standing out in the world: three of them, by the end.

Each browser keeps a player key, and the world welcomed every new connection
as a new arrival with a body of its own. When a connection drops, the
browser reconnects within two seconds, but the server often hasn't heard the
old one close yet: a connection that dies without saying goodbye can look
alive at the server's end for minutes. So the player arrived again, woke up
at home as every arrival does (decision 0055), and the old body stayed where
it was until the server finally noticed. Two tabs in the same browser made
the same copy on purpose.

## Decision

**A player key has one body in a world at a time.** When a connection
arrives for a player who is already here, it takes over their existing body
instead: the same network id, right where it stands, mid-swing or with a
line in the water, with nothing reloaded from the last save. The world's
player cap does not count them twice. The old connection is hung up with
close code 4002 (`CLOSE_PLAYING_ELSEWHERE`). Its attachment is cleared first,
so its own close arriving later can't take the player out from under the
new one. Only the input bookkeeping starts afresh (`handOver`), because a
reloaded page counts its inputs from one again.

A browser told 4002 doesn't reconnect by itself, or two tabs would take the
player back off each other forever. It pauses behind the curtain, saying
you're playing in another tab, and clicking it plays here again. The
browser also now ignores anything from a connection it has already given
up on, so a late close can't tear down the one that replaced it.

## Consequences

- A dropped connection that comes back carries on in place. Waking at home
  is for arriving and for knockouts, as decision 0055 says.
- Two tabs in one browser are one player. To see two players, use a normal
  window and a private one, or two browsers. The smoke tests already use a
  separate browser context per player.
- A connection that dies and never comes back still stands in the world
  until the server notices it closed. Letting go of silent connections
  sooner is left for later.
