# Wolf Winder

A simple desktop editor for cylindrical filament-winding projects, based on
[jcricha007/basilisk](https://github.com/jcricha007/basilisk) and Andrew Reilley's
[Cyclone](https://github.com/reilleya/cyclone). Edit parameters in the app, save a
`.wind` project, and generate/export G-code without using CLI planning commands.

## Download and launch

Install Node.js 22 LTS and Git first. On macOS Terminal or Windows PowerShell:

```sh
git clone https://github.com/jcricha007/Wolf-Winder.git
cd Wolf-Winder
npm ci
npm start
```

`npm start` builds the TypeScript source and opens the Electron editor. The initial
installation needs network access and inherits the upstream native `canvas` and
`serialport` dependencies. If installation fails, keep the error output for
troubleshooting. This release uses the inherited Electron 17 runtime; no packaged
installer is provided yet.

## Use the editor

1. Enter mandrel diameter, winding length, and tow width in millimeters.
2. Set feed rate and optional X/Y/Z coordinate offsets.
3. Add, remove, or reorder helical, hoop, and rotation/skip layers.
4. Select **Generate preview**. Resolve any validation errors shown beside the output.
5. Select **Save project** to keep editable settings, or **Export G-code** to save the full toolpath.

**Open .wind** accepts original Basilisk/Cyclone JSON projects. Missing offsets
become zero. Unsaved edits trigger a prompt before opening another project,
starting a new one, or closing the window. Editing a value clears the previous
preview. The preview displays at most 2,000 lines; export regenerates the complete
toolpath from the current fields.

### Units and offsets

| Field | Meaning |
| --- | --- |
| X offset | Carriage coordinate translation, mm |
| Y offset | Mandrel coordinate translation, degrees |
| Z offset | Delivery-head coordinate translation, degrees |
| Feed rate | Marlin coordinate units/min; includes rotary degrees as coordinate units |
| Helical angle | Angle from the mandrel axis, degrees, as used by the planner's tangent calculation |
| Lead-in | Carriage distance while the head rotates into position, mm |
| Lead-out | Mandrel rotation while the head returns toward level, degrees |

Offsets are added to absolute movement coordinates **and G92 coordinate resets**,
including layer transitions. They are not homing commands, step calibration, or
physical travel limits. For example, X = 20 shifts the wound interval from
`0 … windLength` to `20 … (20 + windLength)`. Export explicitly selects G21/G90
and sets the feed before the first positioning move. Existing CLI planning is
unchanged and does **not** apply the UI's optional offsets; use UI export for
projects with offsets.

### Current scope

- Cylindrical mandrels only; no dome, friction, or boss-turnaround modeling.
- Tow thickness is stored for project compatibility but is unused by the inherited planner.
- Skip index is fixed at 1 because the inherited planner ignores that field.
  Imported non-1 values produce an explicit error instead of being silently ignored.
- Pattern number must divide the calculated circuit count; 1 always divides it.
- Terminal hoop layers must be last. Lead-in cannot exceed wind length;
  lead-out cannot exceed lock rotation.
- UI validation caps projects at 100 layers and 200,000 estimated commands to
  bound planning work. These are software resource limits, not machine ratings.
- The UI generates files; serial streaming remains in the existing CLI. Confirm
  machine origin, axis calibration, travel, and generated moves before machine use.
  Planner mathematics and hardware operation have not been newly validated by this UI release.

## Development checks

```sh
npm test
npm run lint
```

See [CHANGELOG.md](CHANGELOG.md) for this release's changes. The original project
notes and attribution are retained below. Upstream metadata declares MIT while
its README says GPL v3; this change preserves that existing discrepancy rather
than assigning a new license.

---

## Original Cyclone documentation

Cyclone
==========

Overview
--------
Cyclone is a script for generating and executing filament winding toolpaths. It was written for simple, 3-axis machines, (like my [Contraption](https://reilley.net/winder)) and currently only supports winding onto cylindrical mandrels. The gcode that it generates should work with many CNC controllers, but my machine utilizes a low-cost 3D printer main board running [Marlin](https://github.com/MarlinFirmware/Marlin) and the output may need to be modified slightly for other boards.

Download and Setup
-------
Cyclone is currently provided ony as the source code, which can be cloned or downloaded from this repository. The script requires [node.js](https://nodejs.org/)) to run. Once node.js is installed and Cyclone is downloaded, navigate to the Cyclone directory in a terminal and install its dependencies with: 
```
npm i
```

Machine Configuration
-------
Future releases of Cyclone might include the ability to specify which gcode axis each machine axis is connected to, but for now, it is hardcoded to match my machine. The X axis is carriage movement, the Y axis is mandrel rotation, and the Z axis is delivery head rotation. Carriage coordinates are given in millimeters, so tune your steps/mm as usual for the X axis. The mandrel and delivery head are both rotational, which is not typical for the 3D printers that Marlin usually drives. The output for these axes is degrees rather than millimeters, so when configuring them, set the steps/mm to the steps/degree value from the motor manufacturer, also factoring in any gear ratios such that `Y360` produces a single complete mandrel rotation. 

Generating a Toolpath
-----------
The command for generating a gcode file with Cyclone is:
```
npm run cli -- plan -o <gcode output file> <wind input file>
```

The input to Cyclone that specifies the parameters of the tube you wish to make is a `.wind` file, which use JSON formatting and metric units. At the top level, they consist of these sections:
```
{
    "layers": [],
    "mandrelParameters": {
        "diameter": 69.75,
        "windLength": 940
    },
    "towParameters": {
        "width": 7,
        "thickness": 0.5
    },
    "defaultFeedRate": 9000
}
```

### Layers:
`layers` is an array of the definitions of the layers that you would like the machine to wind, in the order that they will be wound. Each element in the array can be either a hoop wind or a helical wind.

#### Hoop Winds:
A hoop wind can be added to the laminate with:
```
{
    "windType": "hoop",
    "terminal": false
}
``` 
The single parameter, `"terminal"`, sets if the machine should do a there-and-back circuit, or just wind from one end of the mandrel to the other and stop, which is useful for application of heat shrink tape. An error will be produced if any layers follow a terminal layer, and planning will end.

#### Helical Winds:
A helical wind can be added to the laminate with:
```
{
    "windType": "helical",
    "windAngle": 55,
    "patternNumber": 2,
    "skipIndex": 1,
    "lockDegrees": 720,
    "leadInMM": 30,
    "leadOutDegrees": 90,
    "skipInitialNearLock": true
}
``` 
The most commonly changed parameters are `"windAngle"`(in degrees), and `"patternNumber"`/`"skipIndex"`. The latter two parameters are standard in filament winding and other resources describe in detail, but in summary, the "pattern number" sets how many evenly-distributed "start positions" there will be around the mandrel, and the "skip index" is the increment that will be applied to the "start position" index at the end of a circuit to know where to start the next one. The remaining parameters are for fine tuning, and will be documented when they stabilize more.

### Tow Parameters:
`"towParamers"` is where you input details about the tow that the tube is wound from. The `"thickness"` parameter is currently unused.

### Mandrel Parameters:
`"mandrelParameters"` includes the mandrel diameter, and the length of the mandrel that you would like to wind on. The actual length of usuable tube will be less than this due to the "locks" (excess build up of material at either end of the tube where the carriage turns around) which are usually cut off.


Executing a Toolpath
-----------
There are several, controller-dependent options when you have generated a gcode file and wish to run it on your machine. For Marlin-driven machines, Cylone has a command for streaming the gcode to the controller and displaying the progress in a terminal. The syntax for this command is:
```
npm run cli -- run -p <port> <gcode file>
``` 
To interrupt your machine while this command is running, press ctrl-c in your terminal window, or use the reset button on your Marlin board, which will stop motion and also exit the script.

License
-------
Cyclone is released under the GNU GPL v3 license. The source code is distributed so you can build cool stuff with it, and with the hope of encouraging more hobbyist tinkering in this area that I find fascinating. 

Contributing
------------
Cyclone is mostly purpose-built for my filament winder, but contributions are welcome if you find it useful and have ideas for improvements. Some larger projects could include adding support for 4 axis winders and tapered parts, the creation of a GUI, and generalization to support more winders/controllers.
