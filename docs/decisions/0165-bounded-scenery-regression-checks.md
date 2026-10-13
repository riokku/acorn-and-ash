# Bounded scenery regression checks

After accurate rock collision was added, a 40-world lake regression still ran under one 15-second deadline. CI also timed out the grass cover check, which invoked thousands of matchers while sharing a runner with other package tests.

Keep all world seeds and all grass clumps. Give each lake seed its own test; retain the aggregate assertion that more than ten sampled worlds are unaffected by the lake. For grass, accumulate maximum draw distance and root-height error and minimum shore clearance over every clump, then assert the same original limits once.

This reduces avoidable test work and isolates failures by seed without raising deadlines, sampling fewer clumps, or changing gameplay.
