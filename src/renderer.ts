// Browser-only script. The preload bridge exposes a small set of project operations.
interface WolfBridge {
    defaults(): Promise<unknown>;
    open(): Promise<unknown>;
    save(project: unknown): Promise<string | null>;
    generate(project: unknown): Promise<string[]>;
    export(project: unknown): Promise<string | null>;
}
// Type imports are erased; the browser does not load CommonJS modules.
type Project = import('./ui-project').WinderProject;
const bridge = (window as unknown as { wolf: WolfBridge }).wolf;
let project: Project;
let dirty = false;
const byId = (id: string) => document.getElementById(id) as HTMLElement;
const statusElement = byId('status');
function showStatus(message: string, error = false) { statusElement.textContent = message; statusElement.classList.toggle('error', error); }
function changed() {
    dirty = true;
    (byId('preview') as HTMLTextAreaElement).value = '';
    byId('count').textContent = '';
    showStatus('Values changed. Generate a fresh preview.');
}
function numeric(parent: HTMLElement, labelText: string, value: number, set: (value: number) => void, step = 'any') {
    const label = document.createElement('label'); label.textContent = labelText;
    const input = document.createElement('input'); input.type = 'number'; input.step = step; input.value = String(value);
    input.addEventListener('input', () => { set(input.valueAsNumber); changed(); });
    label.append(input); parent.append(label);
}
function check(parent: HTMLElement, text: string, value: boolean, set: (value: boolean) => void) {
    const label = document.createElement('label'); label.className = 'check';
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = value;
    input.addEventListener('change', () => { set(input.checked); changed(); });
    label.append(input, document.createTextNode(text)); parent.append(label);
}
function button(parent: HTMLElement, text: string, action: () => void, disabled = false) {
    const element = document.createElement('button'); element.textContent = text; element.disabled = disabled;
    element.addEventListener('click', action); parent.append(element);
}
function renderLayers() {
    const container = byId('layers'); container.replaceChildren();
    project.layers.forEach((layer, index) => {
        const card = document.createElement('div'); card.className = 'layer';
        const header = document.createElement('div'); header.className = 'layer-heading';
        const title = document.createElement('strong'); title.textContent = `Layer ${index + 1}`; header.append(title);
        const select = document.createElement('select'); select.setAttribute('aria-label', `Layer ${index + 1} winding type`);
        ['helical', 'hoop', 'skip'].forEach(type => { const option = document.createElement('option'); option.value = type; option.textContent = type === 'skip' ? 'Rotation / skip' : type[0].toUpperCase() + type.slice(1); select.append(option); });
        select.value = layer.windType;
        select.addEventListener('change', () => {
            project.layers[index] = newLayer(select.value); changed(); renderLayers();
        }); header.append(select);
        button(header, '↑', () => { [project.layers[index - 1], project.layers[index]] = [layer, project.layers[index - 1]]; changed(); renderLayers(); }, index === 0);
        button(header, '↓', () => { [project.layers[index + 1], project.layers[index]] = [layer, project.layers[index + 1]]; changed(); renderLayers(); }, index === project.layers.length - 1);
        button(header, 'Remove', () => { project.layers.splice(index, 1); changed(); renderLayers(); });
        card.append(header);
        const fields = document.createElement('div'); fields.className = 'fields'; card.append(fields);
        if (layer.windType === 'helical') {
            numeric(fields, 'Wind angle to axis (°)', layer.windAngle, v => layer.windAngle = v);
            numeric(fields, 'Pattern number (integer)', layer.patternNumber, v => layer.patternNumber = v, '1');
            numeric(fields, 'End lock rotation (°)', layer.lockDegrees, v => layer.lockDegrees = v);
            numeric(fields, 'Pass lead-in (mm)', layer.leadInMM, v => layer.leadInMM = v);
            numeric(fields, 'Lock lead-out (°)', layer.leadOutDegrees, v => layer.leadOutDegrees = v);
            check(fields, 'Skip initial near lock', !!layer.skipInitialNearLock, v => layer.skipInitialNearLock = v);
            const note = document.createElement('p'); note.className = 'hint'; note.textContent = 'Skip index is fixed at 1: the inherited planner does not implement other values. Pattern number must divide the calculated circuit count.'; card.append(note);
        } else if (layer.windType === 'hoop') check(fields, 'Terminal: one-way pass (must be last layer)', layer.terminal, v => layer.terminal = v);
        else numeric(fields, 'Mandrel advance (°)', layer.mandrelRotation, v => layer.mandrelRotation = v);
        container.append(card);
    });
}
function newLayer(type: string): Project['layers'][number] {
    if (type === 'hoop') return { windType: 'hoop', terminal: false } as Project['layers'][number];
    if (type === 'skip') return { windType: 'skip', mandrelRotation: 90 } as Project['layers'][number];
    return { windType: 'helical', windAngle: 55, patternNumber: 1, skipIndex: 1, lockDegrees: 720,
        leadInMM: Math.min(30, project.mandrelParameters.windLength), leadOutDegrees: 90, skipInitialNearLock: false } as Project['layers'][number];
}
function render() {
    const geometry = byId('geometry'); geometry.replaceChildren();
    numeric(geometry, 'Mandrel diameter (mm)', project.mandrelParameters.diameter, v => project.mandrelParameters.diameter = v);
    numeric(geometry, 'Wind length (mm)', project.mandrelParameters.windLength, v => project.mandrelParameters.windLength = v);
    numeric(geometry, 'Tow width (mm)', project.towParameters.width, v => project.towParameters.width = v);
    numeric(geometry, 'Tow thickness (mm; stored only)', project.towParameters.thickness, v => project.towParameters.thickness = v);
    const machine = byId('machine'); machine.replaceChildren();
    numeric(machine, 'Feed rate (Marlin units/min)', project.defaultFeedRate, v => project.defaultFeedRate = v);
    numeric(machine, 'X carriage offset (mm)', project.offsets.X, v => project.offsets.X = v);
    numeric(machine, 'Y mandrel offset (°)', project.offsets.Y, v => project.offsets.Y = v);
    numeric(machine, 'Z delivery-head offset (°)', project.offsets.Z, v => project.offsets.Z = v);
    renderLayers();
    (byId('preview') as HTMLTextAreaElement).value = ''; byId('count').textContent = '';
}
async function busy(action: () => Promise<void>) {
    const controls = Array.from(document.querySelectorAll('button,input,select')) as (HTMLButtonElement | HTMLInputElement | HTMLSelectElement)[];
    const prior = controls.map(c => c.disabled); controls.forEach(c => c.disabled = true);
    try { await action(); } catch (error) { showStatus(String(error).replace(/^Error: /, ''), true); }
    finally { controls.forEach((c, i) => c.disabled = prior[i]); }
}
const discard = () => !dirty || window.confirm('Discard unsaved changes to this project?');
byId('new').onclick = () => { if (discard()) busy(async () => { project = await bridge.defaults() as Project; dirty = false; render(); showStatus('New project ready.'); }); };
byId('open').onclick = () => { if (discard()) busy(async () => { const loaded = await bridge.open(); if (loaded) { project = loaded as Project; dirty = false; render(); showStatus('Project loaded.'); } }); };
byId('save').onclick = () => busy(async () => { const file = await bridge.save(project); if (file) { dirty = false; showStatus(`Saved ${file}`); } });
byId('add').onclick = () => { project.layers.push(newLayer('helical')); changed(); renderLayers(); };
byId('generate').onclick = () => busy(async () => {
    showStatus('Generating toolpath…');
    const commands = await bridge.generate(project);
    (byId('preview') as HTMLTextAreaElement).value = commands.slice(0, 2000).join('\n');
    byId('count').textContent = `${commands.length.toLocaleString()} lines`;
    showStatus(commands.length > 2000 ? 'Preview shows the first 2,000 lines. Export includes the full toolpath.' : 'Toolpath generated. Ready to export.');
});
byId('export').onclick = () => busy(async () => { const file = await bridge.export(project); if (file) showStatus(`Exported ${file}`); });
window.addEventListener('beforeunload', event => { if (dirty && !window.confirm('Close without saving changes?')) { event.preventDefault(); event.returnValue = ''; } });
busy(async () => { project = await bridge.defaults() as Project; render(); showStatus('Ready. Set your parameters and generate a preview.'); });
