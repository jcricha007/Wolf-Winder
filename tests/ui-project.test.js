const assert = require('node:assert/strict');
const { test } = require('node:test');
const { defaultProject, validateProject, generateProject } = require('../dist/ui-project');
const { planWind } = require('../dist/planner');
const clone = () => JSON.parse(JSON.stringify(defaultProject));
const quiet = fn => {
    const log = console.log;
    console.log = () => {};
    try { return fn(); } finally { console.log = log; }
};

test('legacy .wind files round-trip with zero offsets and preserve planner output', () => quiet(() => {
    const p = clone(); delete p.offsets;
    const validated = validateProject(p);
    assert.deepEqual(validated.offsets, { X: 0, Y: 0, Z: 0 });
    assert.deepEqual(validateProject(JSON.parse(JSON.stringify(validated))), validated);
    assert.deepEqual(generateProject(p).slice(6), planWind(validated));
}));

test('offsets translate every absolute axis word, including resets over multiple layer types', () => quiet(() => {
    const p = clone();
    p.mandrelParameters.windLength = 35;
    p.layers.push({ windType: 'hoop', terminal: false }, { windType: 'skip', mandrelRotation: 45 },
        { windType: 'hoop', terminal: true });
    const base = generateProject(p);
    p.offsets = { X: 12.5, Y: -30, Z: 8.25 };
    const moved = generateProject(p);
    assert.equal(moved.length, base.length);
    assert.ok(base.some(line => line.startsWith('G92')));
    for (let i = 0; i < base.length; i++) {
        if (!/^G(?:0|1|92)\s/.test(base[i])) continue;
        const original = [...base[i].matchAll(/\b([XYZ])(-?\d+(?:\.\d+)?)/g)];
        const shifted = [...moved[i].matchAll(/\b([XYZ])(-?\d+(?:\.\d+)?)/g)];
        assert.equal(shifted.length, original.length);
        original.forEach((word, j) => assert.ok(Math.abs(Number(shifted[j][2]) - Number(word[2]) - p.offsets[word[1]]) < 0.000002));
    }
    assert.ok(moved.indexOf('G90') < moved.indexOf('G0 X12.5 Y-30 Z8.25'));
}));

test('invalid inputs fail before invoking the planner', () => {
    const cases = [
        [p => p.mandrelParameters.diameter = 0, /Diameter/],
        [p => p.offsets.X = NaN, /X offset/],
        [p => p.defaultFeedRate = Infinity, /Feed rate/],
        [p => p.layers[0].windAngle = 90, /angle/],
        [p => p.layers[0].patternNumber = 1000, /circuits/],
        [p => p.layers[0].patternNumber = 1.5, /integer/],
        [p => p.layers[0].skipIndex = 2, /skip index/],
        [p => p.layers[0].leadInMM = 941, /lead-in/],
        [p => p.layers[0].leadOutDegrees = 721, /lead-out/],
        [p => p.layers[0].skipInitialNearLock = 'false', /true or false/],
        [p => p.layers.unshift({ windType: 'hoop', terminal: true }), /must be the last/],
        [p => p.layers = [], /between 1 and 100/],
        [p => p.layers[0].windType = 'dome', /unknown/],
        [p => p.towParameters.width = 0.001, /200,000/]
    ];
    for (const [edit, message] of cases) { const p = clone(); edit(p); assert.throws(() => generateProject(p), message); }
});
