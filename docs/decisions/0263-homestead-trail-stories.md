# Stories brought home

Give the recovered rumor a lasting place at the homestead. After a successful
home-board claim, remember its story in the home journal and unlock the existing
trail pennant recipe. Ordinary outings still unlock it after three completions.
The completed-story list points directly to the existing earned-keepsake page;
the pennant is already visible to visitors and has a public keepsake description.

Use three spare bits in the existing expedition cosmetic byte, alongside the
unchanged pennant bit. Saved-state and packet validation accept the known mask;
unknown high bits remain invalid. There is no packet-size change, new currency,
new model or buildable ID. Existing saves with their old pennant bit remain valid.

Mark stories only after the existing atomic reward claim succeeds. Reading a
clue, uncovering a bundle, repeating a claim or having a full pack cannot inflate
the record. The collection has no deadline and no reward for repeating one story.
