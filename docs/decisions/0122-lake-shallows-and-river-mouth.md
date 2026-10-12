# Lake shallows and the river mouth

The river ended inside the lake with a different colour and ripple pattern. The lake also blocked walking at its entire shore, even on its shallow beaches.

Blend the ribbon into the lake's exact world-space ripple and depth-colour calculation over the last eight metres before the lake outline. Both surfaces use the same connection circles to suppress the lake's former shoreline highlight across the mouth. Keep the lake's depth colour based on its bed rather than those connection circles.

Allow lake wading up to 0.8 metres of vertical water depth, the same limit as the river. Derive the barrier's distance from shore by inverting the existing lake-bed slope, keeping the player's capsule clear of deeper water. Apply this on both mainland and island shores. Winter still removes the barrier. Reconnection and thaw preserve players in walkable shallows; deeper positions retain the existing safe-shore recovery.

Lake depth colours now use the physical bed depth, so the darkening indicates where walking stops. Boats and fishing retain their existing shoreline-distance rules. Each pull request preview now deploys its own matching world server, so both appearance and movement can be tested before merge. Staging receives the changes after merge and deployment.
