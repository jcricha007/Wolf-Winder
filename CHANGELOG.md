# Change notes

## 0.1.0 — Wolf Winder UI foundation

- Replaced the Electron placeholder window with a parameter and layer editor.
- Added mandrel/tow inputs, feed, X/Y/Z offsets, and helical/hoop/skip layer controls.
- Added native project open/save dialogs, validated legacy .wind import, a G-code
  preview, complete G-code export, and unsaved-change prompts.
- Applied offsets consistently to absolute motion and G92 resets on UI export.
- Added pre-planning validation for finite values, layer ordering, circuit/pattern
  compatibility, lead distances, unsupported skip indices, and workload size.
- Retained the underlying cylindrical winding algorithms and existing CLI.
- Added regression tests for project compatibility, layer offsets, and invalid inputs.

This iteration does not add machine streaming controls, dome modeling, or a
3D simulation. The inherited planner's tow-thickness and skip-index limitations
are documented in the editor and README.
