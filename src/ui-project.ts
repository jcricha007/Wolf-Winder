import { IWindParameters } from './planner/types';
import { planWind } from './planner';

export interface WinderProject extends IWindParameters {
    offsets: { X: number; Y: number; Z: number };
}

export const defaultProject: WinderProject = {
    mandrelParameters: { diameter: 69.75, windLength: 940 },
    towParameters: { width: 7, thickness: 0.5 },
    defaultFeedRate: 9000,
    offsets: { X: 0, Y: 0, Z: 0 },
    layers: [{ windType: 'helical', windAngle: 55, patternNumber: 1, skipIndex: 1,
        lockDegrees: 720, leadInMM: 30, leadOutDegrees: 90, skipInitialNearLock: false }] as IWindParameters['layers']
};

// Also accepts original .wind files, whose offsets default to zero.
export function validateProject(input: unknown): WinderProject {
    const object = (value: unknown, label: string): Record<string, unknown> => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
        return value as Record<string, unknown>;
    };
    const number = (value: unknown, label: string, min: number, max = 1000000): number => {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
            throw new Error(`${label} must be a finite number between ${min} and ${max}.`);
        return value;
    };
    const boolean = (value: unknown, label: string, fallback = false): boolean => {
        if (value === undefined) return fallback;
        if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`);
        return value;
    };
    const p = object(input, 'Project');
    const m = object(p.mandrelParameters, 'Mandrel');
    const t = object(p.towParameters, 'Tow');
    const o = p.offsets === undefined ? { X: 0, Y: 0, Z: 0 } : object(p.offsets, 'Offsets');
    const diameter = number(m.diameter, 'Diameter', 0.001);
    const length = number(m.windLength, 'Wind length', 0.001);
    const width = number(t.width, 'Tow width', 0.001);
    if (!Array.isArray(p.layers) || p.layers.length < 1 || p.layers.length > 100)
        throw new Error('Add between 1 and 100 layers.');
    let estimatedCommands = 0;
    const layers = p.layers.map((value, index) => {
        const l = object(value, `Layer ${index + 1}`);
        const label = `Layer ${index + 1}`;
        if (l.windType === 'hoop') {
            const terminal = boolean(l.terminal, `${label}: terminal`);
            if (terminal && index !== (p.layers as unknown[]).length - 1)
                throw new Error(`${label}: a terminal hoop must be the last layer.`);
            estimatedCommands += 2 * (Math.ceil(length) + 10);
            return { windType: 'hoop', terminal };
        }
        if (l.windType === 'skip') {
            estimatedCommands += 5;
            return { windType: 'skip', mandrelRotation: number(l.mandrelRotation, `${label}: rotation`, -1000000) };
        }
        if (l.windType !== 'helical') throw new Error(`${label}: unknown winding type.`);
        const angle = number(l.windAngle, `${label}: angle`, 0.001, 89.999);
        const pattern = number(l.patternNumber, `${label}: pattern number`, 1);
        if (!Number.isInteger(pattern)) throw new Error(`${label}: pattern number must be an integer.`);
        // The inherited planner does not implement skipIndex. Do not silently ignore it.
        if (l.skipIndex !== undefined && l.skipIndex !== 1) throw new Error(`${label}: only skip index 1 is supported by this planner.`);
        const circuits = Math.ceil(Math.PI * diameter * Math.cos(angle * Math.PI / 180) / width);
        if (circuits % pattern !== 0) throw new Error(`${label}: ${circuits} circuits; pattern number must divide ${circuits} exactly. Try 1.`);
        const lock = number(l.lockDegrees, `${label}: lock rotation`, 0);
        const leadOut = number(l.leadOutDegrees, `${label}: lead-out`, 0, lock);
        estimatedCommands += circuits * (2 * Math.ceil(length) + 30);
        return { windType: 'helical', windAngle: angle, patternNumber: pattern, skipIndex: 1,
            lockDegrees: lock, leadInMM: number(l.leadInMM, `${label}: lead-in`, 0, length),
            leadOutDegrees: leadOut, skipInitialNearLock: boolean(l.skipInitialNearLock, `${label}: skip initial lock`) };
    });
    if (estimatedCommands > 200000) throw new Error('This project exceeds the UI limit of 200,000 estimated commands. Reduce wind length, layer count, or circuits.');
    return { mandrelParameters: { diameter, windLength: length }, towParameters: {
        width, thickness: number(t.thickness, 'Tow thickness', 0) },
        defaultFeedRate: number(p.defaultFeedRate, 'Feed rate', 0.001),
        offsets: { X: number(o.X, 'X offset', -1000000), Y: number(o.Y, 'Y offset', -1000000), Z: number(o.Z, 'Z offset', -1000000) },
        layers: layers as IWindParameters['layers'] };
}

export function generateProject(input: unknown): string[] {
    const project = validateProject(input);
    const commands = planWind(project);
    // Translate absolute destinations AND G92 coordinate resets so offsets survive layer boundaries.
    const shifted = commands.map(line => /^(G0|G1|G92)\s/.test(line) ? line.replace(
        /\b([XYZ])(-?\d+(?:\.\d+)?)/g,
        (_match, axis: 'X' | 'Y' | 'Z', value: string) => `${axis}${Number((Number(value) + project.offsets[axis]).toFixed(6))}`
    ) : line);
    if (shifted.some(line => /NaN|Infinity/.test(line))) throw new Error('Planner produced non-finite coordinates.');
    return ['; Wolf Winder — cylindrical mandrel toolpath',
        '; X: carriage mm, Y: mandrel degrees, Z: delivery-head degrees',
        `; Absolute coordinate offsets: ${JSON.stringify(project.offsets)}`,
        'G21', 'G90', `G0 F${project.defaultFeedRate}`, ...shifted];
}
