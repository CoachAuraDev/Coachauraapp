import assert from "node:assert/strict";
import test from "node:test";
import { useFloor } from "./store.ts";
import { resolveLoggedExerciseMuscles } from "./muscle-activity.ts";
import type { Client, ExerciseLog } from "./models.ts";

// Node uses the store's in-memory storage, never a user's browser data.
test("TEST custom muscle mappings persist in backups and edits preserve completed logs", () => {
  const fixture: Client = {
    ...useFloor.getState().clients[0],
    id: "test-muscle-backup-client",
    name: "TEST Muscle Backup Client",
    sessions: [],
    routines: [],
    bodyweight: [],
    weeklyPlan: {},
  };
  useFloor.setState({ clients: [fixture], custom: [], draft: null });
  const exercise = useFloor.getState().addCustom("TEST Custom Hip Adduction", "adductors", ["glutes"]);
  const log: ExerciseLog = {
    id: exercise.id,
    name: exercise.name,
    primary: exercise.primary,
    equipment: exercise.equipment,
    sets: [{ id: "test-stored-set", kind: "normal", reps: 10, weight: 30, rpe: 8 }],
  };
  useFloor.setState({
    clients: [{
      ...fixture,
      sessions: [{ id: "test-stored-session", date: "2025-03-30", name: "TEST workout", durationSec: 600, routineId: null, exercises: [log] }],
    }],
  });
  const originalLogs = JSON.stringify(useFloor.getState().clients[0].sessions);
  const backup = useFloor.getState().exportBackup();
  const parsed = JSON.parse(backup);
  assert.equal(parsed.custom[0].muscleMappingExplicit, true);
  assert.deepEqual(parsed.custom[0].secondary, ["glutes"]);
  useFloor.getState().updateCustomMuscles(exercise.id, "quadriceps", ["calves", "calves", "quadriceps"]);
  assert.deepEqual(resolveLoggedExerciseMuscles(log, useFloor.getState().custom), { primary: "quadriceps", secondary: ["calves"] });
  assert.equal(JSON.stringify(useFloor.getState().clients[0].sessions), originalLogs);
  assert.equal(useFloor.getState().custom.length, 1);
  assert.equal(useFloor.getState().importBackup(backup), "");
  assert.deepEqual(resolveLoggedExerciseMuscles(log, useFloor.getState().custom), { primary: "adductors", secondary: ["glutes"] });
  assert.equal(JSON.stringify(useFloor.getState().clients[0].sessions), originalLogs);
});
