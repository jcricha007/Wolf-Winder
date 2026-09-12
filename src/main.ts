import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import { promises as fs } from 'fs';
import { defaultProject, generateProject, validateProject } from './ui-project';

function createWindow() {
    const window = new BrowserWindow({ width: 1240, height: 860, minWidth: 850, minHeight: 600,
        title: 'Wolf Winder', backgroundColor: '#101720',
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
    window.loadFile(path.join(__dirname, '../index.html'));
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
}

app.whenReady().then(() => {
    ipcMain.handle('project:defaults', () => defaultProject);
    ipcMain.handle('project:open', async () => {
        const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Winding project', extensions: ['wind', 'json'] }] });
        if (result.canceled) return null;
        const file = result.filePaths[0];
        if ((await fs.stat(file)).size > 1000000) throw new Error('Project file exceeds 1 MB.');
        return validateProject(JSON.parse(await fs.readFile(file, 'utf8')));
    });
    ipcMain.handle('project:save', async (_event, input: unknown) => {
        const project = validateProject(input);
        const result = await dialog.showSaveDialog({ defaultPath: 'wolf-winder.wind', filters: [{ name: 'Winding project', extensions: ['wind'] }] });
        if (result.canceled || !result.filePath) return null;
        await fs.writeFile(result.filePath, JSON.stringify(project, null, 2) + '\n');
        return result.filePath;
    });
    ipcMain.handle('project:generate', (_event, input: unknown) => generateProject(input));
    ipcMain.handle('project:export', async (_event, input: unknown) => {
        const commands = generateProject(input);
        const result = await dialog.showSaveDialog({ defaultPath: 'wolf-winder.gcode', filters: [{ name: 'G-code', extensions: ['gcode'] }] });
        if (result.canceled || !result.filePath) return null;
        await fs.writeFile(result.filePath, commands.join('\n') + '\n');
        return result.filePath;
    });
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
