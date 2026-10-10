# Muscle activity and recovery calculations

This feature uses actual completed `Client.sessions`. `Draft` workouts never enter
analytics. Historical `ExerciseLog.id` is resolved against the GymMane catalog and
the persisted custom-exercise collection. The original session/set fields and
`setstack-v1` storage key are preserved.

## Exercise involvement

The catalog already provides a primary label and secondary labels. These are
normalised to 18 selectable regions. Broad shoulder/back labels are split by
movement rules (for example, lateral raises → side deltoids, rear flys → rear
deltoids, vertical pulls → lats, rows → upper back). Pressing/rowing support rules
add front deltoids/triceps to chest presses and biceps/rear deltoids/lats to rows.
Hip-adduction exercises map to adductors.

These are editable coaching classifications, not a scientific measurement of
each muscle's activation. New and edited custom exercises set
`muscleMappingExplicit: true`; their chosen primary and secondary groups are
honoured without automatic supporting-muscle additions. Editing a custom mapping
also changes its historical analytics. The optional field is preserved by the
existing custom-exercise JSON backup, while old backups remain valid.

Unmapped logged exercises are disclosed in the dashboard. Their working sets
remain in the overall logged-set count but are not silently assigned to a muscle.

## Time ranges and sets

Ranges are calendar-date inclusive: today through today − 6 days for seven days,
or today through today − 29 days for 30 days. Future/invalid-dated records are
excluded. Sessions have dates, not timestamps.

- Working sets: non-warm-up sets with reps > 0.
- Direct involvement weight: 1.0.
- Indirect involvement weight: 0.5.
- RIR is derived from stored RPE: RIR = 10 − RPE.
- Effort factor: RIR ≤1 → 1.25; RIR ≤3 → 1.0; RIR >3 → 0.75.
- Missing/invalid RPE → neutral factor 1.0.

Weighted set-equivalents = sum(involvement weight × effort factor). The UI shows
unweighted direct/indirect counts separately. A single set can involve multiple
muscles, so summing counts across regions is not the total number of logged sets.

Weekly-equivalent load = weighted set-equivalents × 7 / period days. Normalisation
makes the seven- and 30-day colour bands comparable:

| Weekly-equivalent load | Activity | Colour |
|---|---|---|
| 0 | No recorded work | Grey |
| >0 to <3 | Low | Light blue |
| 3 to <6 | Moderate | Blue |
| 6 to <10 | High | Orange |
| ≥10 | Very high | Red |

These are UI workload bands, not recommendations or clinical limits.

## Recovery estimates

Recovery uses the most recent muscle-training date and rolling seven-day exposure
history, independent of the selected activity range. If multiple sessions occur
on the latest date, their weighted sets are combined because the date-only data
cannot determine which one finished last.

Estimated window, hours:

`min(96, 24 + 6 × min(latest-day weighted sets, 8) + 8 × max(recent-seven-day sessions − 1, 0))`

Statuses, in order:

1. No muscle exposure recorded → No recent work.
2. ≥12 weighted sets or ≥3 sessions involving the muscle in the last seven days
   → High recent workload.
3. Last exposure today/yesterday → Recently trained.
4. Elapsed calendar days ×24 below estimated window → Recovering · estimate.
5. Otherwise → Recovered · estimate.

This is a transparent training-load heuristic, not a biological recovery model.
It cannot measure sleep, soreness, injury, nutrition, illness, or readiness. Date
precision is only to the day. The app does not equate map colour with readiness.

## Tests

`src/lib/gymmane/muscle-activity.test.ts` contains clearly named synthetic test
clients/workouts only; it does not seed real application data. Run:

`node --experimental-strip-types --test artifacts/setstack/src/lib/gymmane/*.test.ts`

Coverage includes all 447 catalog mappings, pressing/rowing support, 7/30-day
boundaries, warm-up/zero-rep exclusion, direct/indirect weighting, RIR factors,
explicit custom mappings, recovery labels, and empty histories.

`muscle-mapping-store.test.ts` additionally uses Node-only in-memory storage to
verify that explicit assignments survive JSON export/restore and that changing
muscle metadata does not mutate completed workout logs.
