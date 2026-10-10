# SetStack

SetStack helps personal trainers organize clients, assign training programs, record workout sets, review performance, and track bodyweight progress.

## Run & Operate

- `pnpm --filter @workspace/setstack run dev` — run the SetStack web app (the managed workflow supplies its preview configuration)
- `pnpm --filter @workspace/setstack run typecheck` — typecheck SetStack
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- SetStack does not currently require an API server, database, or secrets.

## Stack

- pnpm workspace, React, Vite, TypeScript
- Zustand store persisted to browser `localStorage`
- GymMane-derived training engine, exercise catalog, metrics, and program templates
- Responsive web UI; no cloud sync or user accounts

## Where things live

- `artifacts/setstack/src/App.tsx` — dashboard, client pages, workout logger, and backup/settings views
- `artifacts/setstack/src/lib/gymmane/` — client/workout data models, persistent store, exercise catalog, programs, and training metrics
- `artifacts/setstack/third_party/gymmane/` — upstream Dart source excerpts, GPL-3.0 license, and attribution notice
- `artifacts/setstack/LICENSE` — GPL-3.0 license for the SetStack distribution

## Architecture decisions

- Client and training data stay on the current browser/device; importing a backup replaces the current local client list.
- Keep the existing TypeScript GymMane port as the source of workout and exercise behavior; SetStack's UI builds on its Zustand store.
- Keep the GymMane attribution and GPL-3.0 license files with any distributed derivative.

## Product

Trainers can manage client profiles, assign and edit routines, schedule workout days, log exercises/sets/reps/load/RIR, inspect history and estimated one-rep max records, and add bodyweight measurements. A JSON backup can be downloaded and restored from Settings.

## User preferences

- The user is a beginner and primarily works from an Android phone; provide simple, step-by-step instructions.

## Gotchas

- Browser storage is not shared across devices or browsers and may be cleared by browser settings; export backups regularly and keep them private.
- The uploaded project is not a Flutter/Android application: it has five standalone GymMane Dart source excerpts but no `pubspec.yaml`, Flutter entrypoint, or Android project.
- A future Android APK needs a separate packaging/build step; this web app is not an APK.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
