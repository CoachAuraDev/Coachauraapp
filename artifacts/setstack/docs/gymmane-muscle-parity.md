# Original GymMane muscle analytics in CoachAura

## Source and scope

Upstream: https://github.com/InlitX/GymMane  
Immutable revision: `3478b4d91f2a68ac6853fdb02d30f0fd35528306`

Source files are retained without modification under
`third_party/gymmane/upstream-analytics/`. The import script downloads that
revision and extracts every anatomical base/fill/hit path into JSON, without
changing the geometry. No anatomical illustration was guessed or traced anew.

| Original file | Reused implementation |
|---|---|
| `lib/catalog/body_svg.dart` | 535 × 462 body geometry, 14 muscle regions, 13 sets of expanded tap probes; lower back uses fill paths for hits |
| `lib/widgets/body_map.dart` | Combined front/back map, rendering order, first-hit selection, heat ramps and recovery colour interpolation |
| `lib/screens/progress_screen.dart` | `_MuscleMapCard`: 7-day, 30-day and Recovery modes, selected-muscle readout, recovery summary ring and legend |
| `lib/widgets/muscle_radar.dart` | 12-axis fixed-30-day radar, four grid rings, dots, anatomical axis thumbnails, tap selection and merged regions |
| `lib/state/stats_state.dart` | Set attribution, heat normalization, neglected muscles, exponential fatigue/recovery and estimated recovery hours |
| `lib/state/fit_core.dart` | Four heat thresholds and local calendar-day interpretation |
| `lib/models/workout.dart` | `LoggedSet.counts`: every non-warm-up set counts |
| `lib/models/exercise.dart` | Canonical muscle identifiers and order |
| `lib/theme/app_colors.dart` | Original danger/warning/sage recovery colours |
| `test/muscle_map_test.dart` | Original working-set, window and target expectations |

The new React files are `gymmane-body-map.tsx`, `gymmane-muscle-radar.tsx`
and `gymmane-muscle-analytics.tsx`. The pure TypeScript port is
`src/lib/gymmane/original-muscle-analytics.ts`.

The original GymMane view is the default in **Client → Muscles**. The full
previous CoachAura view remains behind **CoachAura detailed view**. These are
different models, explicitly labelled—not alternative charts pretending to
be the original.

## Data adapter: no migration or record changes

The adapter reads only the displayed `Client.sessions` array. This contains
completed workout history. Global unfinished drafts, other clients and
bodyweight measurements are not inputs. The original workout engine, storage
key, exercise catalogue, saved records and exercise animations are unchanged.

Primary muscle comes from the logged exercise; secondary muscles come from
the current exercise-library entry identified by its ID, exactly as GymMane
uses `exerciseById(e.id)?.secondary`. Unknown IDs do not trigger name-based
guesses or automatically gain secondary involvement.

Custom exercises use CoachAura's more detailed identifiers. The read-only
adapter groups front/side/rear deltoids into `shoulders`, lats/upper back into
`back`, and translates `traps`, `lower-back`, `forearms`, `abs`, `quadriceps`
to their original identifiers. The saved identifiers are never rewritten.
Adductors have **no original GymMane map region**: their workload is disclosed
as unmapped rather than falsely assigned to another muscle. The detailed
CoachAura view retains its original 18-group breakdown, including adductors.

## Exact workload definitions

- One non-warm-up set contributes **1** to its logged primary muscle.
- Each listed secondary muscle receives **0.5** per non-warm-up set.
- Warm-ups contribute nothing.
- This is weighted set count, **not** tonnage or an RIR-adjusted stimulus score.
- Unlike CoachAura's general workout helpers, GymMane's `counts` definition
  does not require positive reps. Zero-rep non-warm-up entries count in this
  particular model. This port preserves that definition without changing
  calculations elsewhere in the app.
- RPE is used for recovery, not heat-map set counts.

For `D` days:

```
target = 12 × D / 7
heat = clamp(weighted_sets / target, 0, 1)
```

The seven-day window starts at local midnight six calendar days ago; the
30-day window starts 29 days ago. Boundaries are inclusive.

The original `muscleSetsOver` checks the **lower date bound only**. A saved
future-dated session consequently enters the heat map; that upstream edge case
is deliberately retained and covered by a test, not silently corrected.
The radar's `muscleSetsBetween` checks both calendar bounds. Recovery excludes
negative elapsed minutes and sessions older than eight days.

### Heat levels

| Level | Normalized heat | Interpretation |
|---|---|---|
| 0 | ≤ 0 | No attributed sets |
| 1 | > 0 and < 0.25 | Below 25% of the period target |
| 2 | ≥ 0.25 and < 0.5 | 25% to below 50% |
| 3 | ≥ 0.5 and < 0.75 | 50% to below 75% |
| 4 | ≥ 0.75 | At least 75%; heat caps at 100% |

The retained original **ember** ramp is:
`#7A4028 → #B4632C → #E38B3A → #FFC168`.
All four original dark ramps (ember, green, blue, mono) are available.
CoachAura lime is now the default presentation palette at the user's request.
Its inactive colour is `#35353B`. Positive workload starts at `#45521F`, then
interpolates through `#667F25`, `#86B832`, `#A5E635`, and `#C6FF57` at the
unchanged 25%, 50%, 75% and 100% target boundaries. This allows five trained
colour anchors without adding calculation thresholds to the original four
bands. The compact six-marker legend labels these target values explicitly.
This is a workload presentation scale, not a physiological recovery scale;
recovery colours, formulas and estimates remain unchanged.
Neutral fill uses the original `lerp(raised, secondary_text, 0.32)` expression
with CoachAura's theme inputs. These are **not** the earlier CoachAura
blue/orange/red workload categories.

## Exact recovery model

For each non-warm-up set:

```
effort = clamp((RPE - 5) / 4, 0.4, 1.3)
```

If RPE is absent, effort is 1, or 1.2 for a failure set. CoachAura already stores
RPE after converting the logging form's RIR input; no new RIR conversion or
effort multiplier is added here.

```
tau = recovery_hours / 3
fatigue[muscle] = Σ(effort × muscle_share × exp(-elapsed_hours / tau))
recovery = clamp(1 - fatigue / 8, 0, 1)
overall = round(mean(recovery across the original 14 muscles) × 100)
```

`elapsed_hours` uses integer elapsed minutes divided by 60, matching Dart's
`difference.inMinutes`. Only sessions within the last 192 hours contribute.

Time constants:

- Chest/back: 60 h.
- Lower back/quads/hamstrings/glutes: 72 h.
- Shoulders/traps/biceps/triceps: 48 h.
- Forearms/calves/abs/obliques: 36 h.

“Still recovering” means model recovery below 80%. Estimated hours until
that threshold are:

```
null if fatigue ≤ 1.6
otherwise ceil(tau × ln(fatigue / 1.6))
```

Recovery colours preserve GymMane's interpolation:
danger `#E5674C` → warning `#E0B15A` across 0–50%, then warning →
`lerp(neutral, sage #8FA377, 0.62)` across 50–100%.

These percentages and hours are original model outputs, **not measurements
of physiological recovery or guarantees of readiness**. No history yields
100% because fatigue has no inputs; the interface explains this default.

### Historical timestamp limitation

Existing CoachAura workouts store `YYYY-MM-DD`, without a completion time.
For those records the adapter uses **local midnight on the logged date**.
Recovery cannot exactly reproduce an original GymMane timestamp that was
never saved. The interface discloses this; no timestamp is invented or written
back. If an existing record actually contains a valid full timestamp, it is
used. This limitation is especially important for workouts logged today.

## Original radar—not a substitute chart

The radar always covers **30 days**, regardless of the map's selected mode.
Axes, clockwise from the top:

Chest, shoulders, traps, back, triceps, biceps, forearms, abs, quads, calves,
hamstrings, glutes.

- Obliques are merged into abs; lower back is merged into back.
- Each value is divided by the maximum axis value, not by the heat-map target.
- Four polygon grid rings, radial lines, data polygon and selectable anatomical
  thumbnails are retained.
- The three axes below half the maximum are eligible for the focus hint.
- Without history, all axis values are zero and the empty state is explicit.

## Rendering adaptations and remaining differences

CoachAura retains its dark panels, typography and lime controls/radar accent.
The original selectable heat-ramp hex values and recovery palette remain intact;
CoachAura's requested lime workload palette is the default.
SVG replaces Flutter/Skia painting; outline antialiasing and path-length
sampling can differ slightly between renderers.

Radar layout uses a 400px reference size scaled to the available width,
including grid/dot/gap sizes. The original uses logical pixels from its layout.
Anatomical thumbnail geometry, crops and sampled content-centre placement are
retained, but browser path measurement can differ slightly.

The radar's original 950ms grow-in animation and eased thumbnail-selection
transition are not ported; final shapes and selection behavior are retained.
Heat palette selection is local UI state, not GymMane's persistent global
setting. English readout wording is adapted for trainers and estimate safety.
Keyboard/text muscle selection is added without replacing anatomical taps.

## Verification and reproduction

Run:

```
pnpm --filter @workspace/setstack run test:unit
PORT=23502 BASE_PATH=/ pnpm --filter @workspace/setstack run typecheck
PORT=23502 BASE_PATH=/ pnpm --filter @workspace/setstack run build
```

`original-muscle-analytics.test.ts` uses clearly labelled **TEST DATA ONLY**.
It ports original `muscle_map_test.dart` expectations and tests inclusive
7/30-day boundaries, future-date behavior, working-set semantics, all colour
ramps/thresholds, original recovery constants and formula outputs, radar
merges/normalization, custom compatibility and client isolation.
It compares every extracted SVG path against the retained Dart source.
It verifies computation does not mutate clients.

The original Flutter application/tests are not executed here. Verification
is against its inspected pinned source, original workload test expectations
and deterministic formula cases, plus CoachAura browser interaction checks.
No APK is generated by these commands.

To regenerate immutable references/path data, run:
`python artifacts/setstack/scripts/import-gymmane-analytics.py`.
This requires internet access and writes reference assets only.

## Licensing

The reused code and anatomy data remain GPL-3.0, copyright InlitX and
contributors. Original notices, the GPL text, upstream credits, immutable
reference sources, TypeScript adaptations and build/import scripts are
retained. Existing in-app GymMane attribution remains.

Commercial distribution of GPL-covered compiled software must provide the
corresponding source in a GPL-compliant way, including modifications and
build scripts. Charging for an APK does not remove recipients' GPL rights.
This implementation does not claim to be a complete commercial legal audit.
