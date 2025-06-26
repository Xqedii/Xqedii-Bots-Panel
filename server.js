const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const port = 3000;

const dataDir = path.join(__dirname, 'data');
const nicksDir = path.join(dataDir, 'nicks');
const actionsDir = path.join(dataDir, 'actions');
const listenersDir = path.join(dataDir, 'listeners');
const proxyDir = path.join(dataDir, 'proxy');
const killswitchDir = path.join(dataDir, 'killswitches');
const activeKillSwitches = new Set();

fs.mkdir(nicksDir, { recursive: true });
fs.mkdir(actionsDir, { recursive: true });
fs.mkdir(listenersDir, { recursive: true });
fs.mkdir(proxyDir, { recursive: true });
fs.mkdir(killswitchDir, { recursive: true });

let activeProcess = null;

app.use(express.json());
app.use(express.static('public'));

const broadcast = (data) => {
  const messageToSend = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageToSend);
    }
  });
};

const getDirForType = (type) => {
    const dirs = { nicks: nicksDir, actions: actionsDir, listeners: listenersDir, proxy: proxyDir };
    return dirs[type];
};

const sanitize = (name) => name.replace(/[^a-zA-Z0-9_-]/g, '');

const getList = (dir) => async (req, res) => {
    try {
        const files = await fs.readdir(dir);
        res.json(files.map(file => path.parse(file).name));
    } catch (error) {
        res.status(500).send('Error reading list directory');
    }
};

const getContent = (dir) => async (req, res) => {
    const fileName = sanitize(req.params.name);
    if (!fileName) return res.status(400).send('Invalid file name');
    const filePath = path.join(dir, `${fileName}.txt`);
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        res.json({ content, lastModified: stats.mtime.getTime() });
    } catch (error) {
        res.status(404).send('File not found');
    }
};

const saveContent = (dir) => async (req, res) => {
    const { name, content, lastModified } = req.body;
    const fileName = sanitize(name);
    if (!fileName || typeof content !== 'string') return res.status(400).send('Invalid data');
    
    const filePath = path.join(dir, `${fileName}.txt`);
    
    try {
        try {
            const stats = await fs.stat(filePath);
            const currentMtime = stats.mtime.getTime();
            if (lastModified && currentMtime !== lastModified) {
                return res.status(409).send('Conflict: File has been modified by another user.');
            }
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }

        await fs.writeFile(filePath, content);
        broadcast({ type: 'lists_updated' });
        res.status(201).send('File saved');
    } catch (error) {
        res.status(500).send('Error saving file');
    }
};

const deleteContent = (dir) => async (req, res) => {
    const fileName = sanitize(req.params.name);
    if (!fileName) return res.status(400).send('Invalid file name');
    try {
        await fs.unlink(path.join(dir, `${fileName}.txt`));
        broadcast({ type: 'lists_updated' });
        res.status(200).send('File deleted');
    } catch (error) {
        res.status(500).send('Error deleting file');
    }
};

const renameContent = (dir) => async (req, res) => {
    const oldName = sanitize(req.params.oldName);
    const { newName } = req.body;
    const sanitizedNewName = sanitize(newName);

    if (!oldName || !sanitizedNewName) {
        return res.status(400).send('Invalid file name.');
    }

    const oldPath = path.join(dir, `${oldName}.txt`);
    const newPath = path.join(dir, `${sanitizedNewName}.txt`);

    try {
        try {
            await fs.access(newPath);
            return res.status(409).send('A file with this name already exists.');
        } catch (e) {
        }
        
        await fs.rename(oldPath, newPath);
        broadcast({ type: 'lists_updated' });
        res.status(200).send('File renamed successfully.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).send('Original file not found.');
        }
        res.status(500).send('Error renaming file.');
    }
};

const createRoutesForType = (type) => {
    const dir = getDirForType(type);
    if (!dir) return;
    app.get(`/api/${type}`, getList(dir));
    app.get(`/api/${type}/:name`, getContent(dir));
    app.post(`/api/${type}`, saveContent(dir));
    app.delete(`/api/${type}/:name`, deleteContent(dir));
    app.put(`/api/${type}/:oldName`, renameContent(dir));
};

app.get('/api/killswitches', async (req, res) => {
    try {
        const files = await fs.readdir(killswitchDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        const servers = await Promise.all(jsonFiles.map(async file => {
            const content = await fs.readFile(path.join(killswitchDir, file), 'utf-8');
            return JSON.parse(content);
        }));
        res.json(servers);
    } catch (error) {
        res.status(500).send('Error reading killswitch directory');
    }
});
app.post('/api/killswitches', async (req, res) => {
    const { ip, actionsFile, nicksFile } = req.body;
    if (!ip) {
        return res.status(400).send('Server IP is required.');
    }
    const newServer = {
        id: Date.now().toString(),
        ip,
        actionsFile: actionsFile || "",
        nicksFile: nicksFile || ""
    };
    try {
        await fs.writeFile(path.join(killswitchDir, `${newServer.id}.json`), JSON.stringify(newServer, null, 2));
        broadcast({ type: 'lists_updated' });
        res.status(201).json(newServer);
    } catch (error) {
        res.status(500).send('Error saving killswitch file');
    }
});

app.put('/api/killswitches/:id', async (req, res) => {
    const { id } = req.params;
    const { ip, actionsFile, nicksFile } = req.body;
    if (!ip) {
        return res.status(400).send('Server IP is required.');
    }
    const updatedServer = { id, ip, actionsFile, nicksFile };
    const filePath = path.join(killswitchDir, `${id}.json`);
    try {
        await fs.access(filePath);
        await fs.writeFile(filePath, JSON.stringify(updatedServer, null, 2));
        broadcast({ type: 'lists_updated' });
        res.status(200).json(updatedServer);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).send('Killswitch not found');
        }
        res.status(500).send('Error updating killswitch file');
    }
});

app.delete('/api/killswitches/:id', async (req, res) => {
    const { id } = req.params;
    const filePath = path.join(killswitchDir, `${id}.json`);
    try {
        await fs.unlink(filePath);
        broadcast({ type: 'lists_updated' });
        res.status(200).send('Killswitch deleted');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).send('Killswitch not found');
        }
        res.status(500).send('Error deleting killswitch file');
    }
});

['nicks', 'proxy', 'listeners', 'actions'].forEach(createRoutesForType);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const cleanString = (str) => {
  return str.replace(/�/g, '')
            .replace(/[^\x20-\x7EĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g, ''); 
};
const extractMessageFromComponent = (msg) => {
  let match = msg.match(/content="([^"]*)"/);
  if (match) {
    return cleanString(match[1]);
  }
  match = msg.match(/TranslatableComponentImpl\{key="([^"]+)"[,\}]/);
  if (match) {
    return cleanString(match[1]);
  }
  return cleanString(msg);
};
wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    ws.send(JSON.stringify({ type: 'info', message: 'Connected to the server.' }));
    ws.send(JSON.stringify({ type: 'status_update', isRunning: !!activeProcess }));
    
    ws.send(JSON.stringify({ type: 'killswitch_status_update', activeIds: Array.from(activeKillSwitches) }));
    ws.send(JSON.stringify({ type: 'lists_updated' }));
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'start_attack') {
                if (activeProcess) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Another process is already running!' }));
                    return;
                }
                const { ip, amount, delay, nicksFile, actionsFile } = data.params;
                broadcast({ type: 'log', message: 'Received start command...' });
                const nicksPath = path.join(nicksDir, `${nicksFile}.txt`);
                const actionsPath = path.join(actionsDir, `${actionsFile}.txt`);
                const delayPlus100 = parseInt(delay, 10) + 100;
                const fixPath = (p) => {
                    if (typeof p !== 'string' || p.trim() === '') return '';
                    if (p.endsWith('.txt.txt')) { return p.slice(0, -4); }
                    return p;
                }
                const hasFileName = (p) => {
                    if (typeof p !== 'string') return false;
                    const trimmed = p.trim();
                    if (trimmed === '') return false;
                    const parts = trimmed.split(/[\\/]/);
                    const lastPart = parts[parts.length - 1];
                    return lastPart !== '' && lastPart.toLowerCase() !== '.txt';
                }
                const listenersPath = path.join(process.cwd(), 'data/listeners');
                const args = [
                    '-jar', 'X.jar', '-s', ip, '-c', amount, '-d',
                    delay.toString(), delayPlus100.toString(), '-g',
                    ...(hasFileName(nicksPath) ? ['--nicks', fixPath(nicksPath)] : []),
                    ...(hasFileName(actionsPath) ? ['--actions', fixPath(actionsPath)] : []),
                    '--listeners', listenersPath
                ];
                const child = spawn('java', args);
                activeProcess = child;
                broadcast({ type: 'status_update', isRunning: true });
                function cleanMessage(line) {
                    return line.replace(/^(IMP|INFO|CHAT|T|WARN|ERROR)\s*\|\s*/i, '').trim();
                }
                const processOutput = (data, type) => {
                    const lines = data.toString().split('\n');
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        const messageType = line.includes('IMP |') ? 'important' : type;
                        let message = cleanMessage(line);
                        
                        const extracted = extractMessageFromComponent(message);
                        if (extracted !== message) {
                            message = extracted;
                        }

                        if (message !== "") {
                            broadcast({ type: messageType, message });
                        }
                    }
                };
                child.stdout.on('data', (data) => processOutput(data, 'log'));
                child.stderr.on('data', (data) => processOutput(data, 'error'));
                child.on('error', (err) => {
                    broadcast({ type: 'error', message: `Error starting the process: ${err.message}` });
                    activeProcess = null;
                    broadcast({ type: 'status_update', isRunning: false });
                });
                child.on('close', (code) => {
                    if (!code) { code = "Stop"; }
                    broadcast({ type: 'info', message: `Process finished with code: ${code}` });
                    activeProcess = null;
                    broadcast({ type: 'status_update', isRunning: false });
                });
            } else if (data.type === 'start_killswitch_attack') {
                const { id, ip, actionsFile, nicksFile } = data.params;

                if (!ip || !id) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Kill Switch Error: Missing IP or ID.' }));
                    broadcast({ type: 'killswitch_attack_finished', id });
                    return;
                }
                if (activeKillSwitches.has(id)) {
                    console.log(`[KillSwitch] Attack with ID ${id} is already in progress.`);
                    return;
                }
                try {
                    if (actionsFile) {
                        await fs.access(path.join(actionsDir, `${sanitize(actionsFile)}.txt`));
                    }
                    if (nicksFile) {
                        await fs.access(path.join(nicksDir, `${sanitize(nicksFile)}.txt`));
                    }
                } catch(err) {
                    const missingFileType = err.path.includes(nicksDir) ? "Nicks" : "Actions";
                    const missingFileName = err.path.split(/[\\/]/).pop().replace('.txt', '');
                    const errorMsg = `[KillSwitch] Cannot start: ${missingFileType} file '${missingFileName}' no longer exists.`;
                    console.error(errorMsg);
                    broadcast({ type: 'error', message: errorMsg });
                    broadcast({ type: 'killswitch_attack_finished', id });
                    return;
                }
                activeKillSwitches.add(id);
                broadcast({ type: 'killswitch_status_update', activeIds: Array.from(activeKillSwitches) });
                broadcast({ type: 'lists_updated' });
                console.log(`[KillSwitch] Initiating attack on ${ip} with ID: ${id}`);
                broadcast({ type: 'info', message: `[KillSwitch] Initiating attack on ${ip}` });
                
                const nicksPath = path.join(nicksDir, `${sanitize(nicksFile)}.txt`);
                const actionsPath = path.join(actionsDir, `${sanitize(actionsFile)}.txt`);
                const listenersPath = path.join(process.cwd(), 'data/listeners');
                
                const fixPath = (p) => {
                    if (typeof p !== 'string' || p.trim() === '') return '';
                    if (p.endsWith('.txt.txt')) { return p.slice(0, -4); }
                    return p;
                }
                const hasFileName = (p) => {
                    if (typeof p !== 'string') return false;
                    const trimmed = p.trim();
                    if (trimmed === '') return false;
                    const parts = trimmed.split(/[\\/]/);
                    const lastPart = parts[parts.length - 1];
                    return lastPart !== '' && lastPart.toLowerCase() !== '.txt' && lastPart.toLowerCase() !== 'undefined';
                }

                const args = [
                    '-jar', 'X.jar',
                    '-s', ip,
                    '-c', '7',
                    '-d', '4500', '4800',
                    '-g',
                    ...(hasFileName(nicksPath) ? ['--nicks', fixPath(nicksPath)] : []),
                    ...(hasFileName(actionsPath) ? ['--actions', fixPath(actionsPath)] : []),
                    '--listeners', listenersPath
                ];

                const killSwitchProcess = spawn('java', args);

                killSwitchProcess.stdout.on('data', (data) => {
                    console.log(`[KillSwitch ${ip} STDOUT]: ${data.toString()}`);
                });

                killSwitchProcess.stderr.on('data', (data) => {
                    console.error(`[KillSwitch ${ip} STDERR]: ${data.toString()}`);
                    broadcast({ type: 'error', message: `[KillSwitch ${ip}]: ${data.toString()}` });
                });

                killSwitchProcess.on('close', (code) => {
                    console.log(`[KillSwitch ${ip}] process finished with code: ${code}`);
                    activeKillSwitches.delete(id);
                    broadcast({ type: 'info', message: `[KillSwitch] Attack on ${ip} has finished.` });
                    broadcast({ type: 'killswitch_status_update', activeIds: Array.from(activeKillSwitches) });
                    broadcast({ type: 'lists_updated' });
                });

                killSwitchProcess.on('error', (err) => {
                    console.error(`[KillSwitch ${ip}] Failed to start process:`, err);
                    activeKillSwitches.delete(id);
                    broadcast({ type: 'error', message: `[KillSwitch] Failed to start attack on ${ip}.` });
                    broadcast({ type: 'killswitch_status_update', activeIds: Array.from(activeKillSwitches) }); 
                });
            } else if (data.type === 'stop_attack') {
                if (activeProcess) {
                    broadcast({ type: 'info', message: 'Received stop command...' });
                    activeProcess.kill('SIGINT');
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'No active process to stop.' }));
                }
            } else if (data.type === 'send_command') {
                if (activeProcess) {
                    const command = data.command;
                    if (command) {
                        activeProcess.stdin.write(command + '\n');
                        broadcast({ type: 'info', message: `Sent command: "${command}"` });
                    }
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'No active process. Start an attack first.' }));
                }
            }
        } catch (e) {
            console.error("WebSocket message error:", e);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid command.' }));
        }
    });
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});
server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});