"""Import immutable GPL-3.0 GymMane reference sources and lossless SVG path data."""
import json
import re
import urllib.request
from pathlib import Path

REVISION = "3478b4d91f2a68ac6853fdb02d30f0fd35528306"
ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    "lib/catalog/body_svg.dart", "lib/widgets/body_map.dart",
    "lib/widgets/muscle_radar.dart", "lib/screens/progress_screen.dart",
    "lib/state/stats_state.dart", "lib/state/fit_core.dart",
    "lib/models/workout.dart", "lib/models/exercise.dart",
    "lib/theme/app_colors.dart", "test/muscle_map_test.dart", "CREDITS.md",
]
target = ROOT / "third_party/gymmane/upstream-analytics"
for name in SOURCES:
    output = target / name
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(urllib.request.urlopen(
        f"https://raw.githubusercontent.com/InlitX/GymMane/{REVISION}/{name}"
    ).read())

text = (target / SOURCES[0]).read_text()
def strings(value):
    return re.findall(r"r?'([^']*)'", value)
def section(name):
    return re.search(rf"\b{name}\s*=\s*([\[{{].*?[\]}}]);", text, re.S).group(1)
def groups(name):
    return {key: strings(value) for key, value in
            re.findall(r"'([^']+)':\s*\[(.*?)\]", section(name), re.S)}
data = {
    "sourceRevision": REVISION,
    "width": 535, "height": 462,
    "bodyBaseMain": strings(section("bodyBaseMain")),
    "bodyBaseLite": strings(section("bodyBaseLite")),
    "muscleFills": groups("muscleFills"),
    "muscleHits": groups("muscleHits"),
}
assert len(data["muscleFills"]) == 14 and len(data["muscleHits"]) == 13
assert data["bodyBaseMain"] and data["bodyBaseLite"]
output = ROOT / "src/assets/gymmane-body.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(data, separators=(",", ":")) + "\n")
print(f"Imported original GymMane paths without modification: {output}")
