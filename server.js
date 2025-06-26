const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const os = require('os-utils');

const app = express();
const port = 3000;

const dataDir = path.join(__dirname, 'data');
const nicksDir = path.join(dataDir, 'nicks');
const actionsDir = path.join(dataDir, 'actions');
const listenersDir = path.join(dataDir, 'listeners');
const proxyDir = path.join(dataDir, 'proxy');
const killswitchDir = path.join(dataDir, 'killswitches');
const activeProxiesPath = path.join(dataDir, 'active_proxies.json');
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

const getList = (dir, type) => async (req, res) => {
    try {
        const files = await fs.readdir(dir);
        const txtFiles = files.filter(f => f.endsWith('.txt')).map(f => path.parse(f).name);

        if (type !== 'proxy') {
            return res.json(txtFiles);
        }
        
        // For proxies, include type from metadata
        const proxyData = await Promise.all(txtFiles.map(async (name) => {
            const metaPath = path.join(dir, `${name}.json`);
            let proxyType = 'SOCKS5'; // Default
            try {
                const metaContent = await fs.readFile(metaPath, 'utf-8');
                proxyType = JSON.parse(metaContent).type || 'SOCKS5';
            } catch (e) {
                // Ignore if meta file doesn't exist
            }
            return { name, type: proxyType };
        }));
        res.json(proxyData);

    } catch (error) {
        res.status(500).send('Error reading list directory');
    }
};

const getContent = (dir, type) => async (req, res) => {
    const fileName = sanitize(req.params.name);
    if (!fileName) return res.status(400).send('Invalid file name');
    const filePath = path.join(dir, `${fileName}.txt`);
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        const responseData = { content, lastModified: stats.mtime.getTime() };

        if (type === 'proxy') {
            const metaPath = path.join(dir, `${fileName}.json`);
            try {
                const metaContent = await fs.readFile(metaPath, 'utf-8');
                responseData.type = JSON.parse(metaContent).type;
            } catch (e) {
                responseData.type = 'SOCKS5'; // Default
            }
        }
        res.json(responseData);

    } catch (error) {
        res.status(404).send('File not found');
    }
};


const saveContent = (dir, type) => async (req, res) => {
    const { name, content, lastModified } = req.body;
    const fileName = sanitize(name);
    if (!fileName || typeof content !== 'string') return res.status(400).send('Invalid data');
    
    const filePath = path.join(dir, `${fileName}.txt`);
    
    try {
        // Check for modification conflict
        try {
            const stats = await fs.stat(filePath);
            const currentMtime = stats.mtime.getTime();
            if (lastModified && currentMtime !== lastModified) {
                return res.status(409).send('Conflict: File has been modified by another user.');
            }
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }

        // Save content and metadata
        await fs.writeFile(filePath, content);
        if (type === 'proxy' && req.body.type) {
            const metaPath = path.join(dir, `${fileName}.json`);
            await fs.writeFile(metaPath, JSON.stringify({ type: req.body.type }));
        }

        broadcast({ type: 'lists_updated' });
        res.status(201).send('File saved');
    } catch (error) {
        res.status(500).send('Error saving file');
    }
};

const deleteContent = (dir, type) => async (req, res) => {
    const fileName = sanitize(req.params.name);
    if (!fileName) return res.status(400).send('Invalid file name');
    try {
        await fs.unlink(path.join(dir, `${fileName}.txt`));
        if (type === 'proxy') {
            const metaPath = path.join(dir, `${fileName}.json`);
            try { await fs.unlink(metaPath); } catch(e) { /* ignore if no meta file */ }
        }
        broadcast({ type: 'lists_updated' });
        res.status(200).send('File deleted');
    } catch (error) {
        res.status(500).send('Error deleting file');
    }
};

const renameContent = (dir, type) => async (req, res) => {
    const oldName = sanitize(req.params.oldName);
    const { newName } = req.body;
    const sanitizedNewName = sanitize(newName);

    if (!oldName || !sanitizedNewName) {
        return res.status(400).send('Invalid file name.');
    }

    const oldPath = path.join(dir, `${oldName}.txt`);
    const newPath = path.join(dir, `${sanitizedNewName}.txt`);

    try {
        await fs.access(newPath).then(() => {
            throw new Error('A file with this name already exists.');
        }).catch(err => {
             if(err.code !== 'ENOENT') throw err;
        });

        await fs.rename(oldPath, newPath);
        if (type === 'proxy') {
            const oldMetaPath = path.join(dir, `${oldName}.json`);
            const newMetaPath = path.join(dir, `${sanitizedNewName}.json`);
            try { await fs.rename(oldMetaPath, newMetaPath); } catch (e) { /* ignore */ }
        }

        broadcast({ type: 'lists_updated' });
        res.status(200).send('File renamed successfully.');
    } catch (error) {
        if (error.code === 'ENOENT') return res.status(404).send('Original file not found.');
        if (error.message.includes('already exists')) return res.status(409).send(error.message);
        res.status(500).send('Error renaming file.');
    }
};

const createRoutesForType = (type) => {
    const dir = getDirForType(type);
    if (!dir) return;
    app.get(`/api/${type}`, getList(dir, type));
    app.get(`/api/${type}/:name`, getContent(dir, type));
    app.post(`/api/${type}`, saveContent(dir, type));
    app.delete(`/api/${type}/:name`, deleteContent(dir, type));
    app.put(`/api/${type}/:oldName`, renameContent(dir, type));
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
app.get('/api/active-proxies', async (req, res) => {
    try {
        const data = await fs.readFile(activeProxiesPath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        // Jeśli plik nie istnieje, zwróć domyślny, pusty stan
        res.json({ SOCKS4: null, SOCKS5: null });
    }
});
app.post('/api/killswitches', async (req, res) => {
    // Dodajemy proxyFile do destrukturyzacji
    const { ip, actionsFile, nicksFile, proxyFile } = req.body; 
    if (!ip) {
        return res.status(400).send('Server IP is required.');
    }
    const newServer = {
        id: Date.now().toString(),
        ip,
        actionsFile: actionsFile || "",
        nicksFile: nicksFile || "",
        proxyFile: proxyFile || "" // Zapisujemy plik proxy
    };
    try {
        await fs.writeFile(path.join(killswitchDir, `${newServer.id}.json`), JSON.stringify(newServer, null, 2));
        broadcast({ type: 'lists_updated' });
        res.status(201).json(newServer);
    } catch (error) {
        res.status(500).send('Error saving killswitch file');
    }
});
app.post('/api/active-proxies', async (req, res) => {
    const { type, name } = req.body;
    if (!type || !name) {
        return res.status(400).send('Missing type or name');
    }

    let activeProxies = {};
    try {
        const data = await fs.readFile(activeProxiesPath, 'utf-8');
        activeProxies = JSON.parse(data);
    } catch (error) {
        // Ignoruj błąd, jeśli plik nie istnieje, zaczniemy od pustego obiektu
        activeProxies = { SOCKS4: null, SOCKS5: null };
    }

    // Logika przełączania: jeśli kliknięto to samo, odznacz (ustaw na null)
    if (activeProxies[type] === name) {
        activeProxies[type] = null;
    } else {
        activeProxies[type] = name;
    }

    try {
        await fs.writeFile(activeProxiesPath, JSON.stringify(activeProxies, null, 2));
        // Powiadom wszystkich klientów o zmianie, aby odświeżyli swoje listy
        broadcast({ type: 'lists_updated' });
        res.sendStatus(200);
    } catch (error) {
        res.status(500).send('Error saving active proxy state');
    }
});

app.put('/api/killswitches/:id', async (req, res) => {
    const { id } = req.params;
    // Dodajemy proxyFile do destrukturyzacji
    const { ip, actionsFile, nicksFile, proxyFile } = req.body;
    if (!ip) {
        return res.status(400).send('Server IP is required.');
    }
    // Dodajemy proxyFile do aktualizowanego obiektu
    const updatedServer = { id, ip, actionsFile, nicksFile, proxyFile };
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
const wss = new WebSocket.Server({ server, path: '/api/' });
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
    
    ws.isAlive = true;

    ws.on('pong', () => {
        ws.isAlive = true;
    });

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

                let activeProxies = { SOCKS4: null, SOCKS5: null };
                try {
                    const activeData = await fs.readFile(activeProxiesPath, 'utf-8');
                    activeProxies = JSON.parse(activeData);
                } catch(e) {
                    console.log("Plik active_proxies.json nie znaleziony, startuję bez proxy.");
                }

                const activeSocks4 = activeProxies.SOCKS4;
                const activeSocks5 = activeProxies.SOCKS5;

                const nicksPath = path.join(nicksDir, `${nicksFile}.txt`);
                const actionsPath = path.join(actionsDir, `${actionsFile}.txt`);
                const delayPlus100 = parseInt(delay, 10) + 100;

                const fixPath = (p) => {
                    if (typeof p !== 'string' || p.trim() === '') return '';
                    return p.endsWith('.txt.txt') ? p.slice(0, -4) : p;
                }

                const hasFileName = (p) => {
                    if (typeof p !== 'string' || !p.trim()) return false;
                    const parts = p.split(/[\\/]/);
                    const lastPart = parts.pop() || '';
                    return lastPart && lastPart.toLowerCase() !== '.txt';
                }

                const listenersPath = path.join(process.cwd(), 'data/listeners');
                
                const args = [
                    '-jar', 'X.jar', '-s', ip, '-c', '7', '-d', '4500', '4800', '-g',
                    ...(hasFileName(nicksPath) ? ['--nicks', fixPath(nicksPath)] : []),
                    ...(hasFileName(actionsPath) ? ['--actions', fixPath(actionsPath)] : []),
                    '--listeners', listenersPath
                ];

                if (proxyPath && proxyMetaPath) {
                    try {
                        const metaContent = await fs.readFile(proxyMetaPath, 'utf-8');
                        const proxyType = JSON.parse(metaContent).type || 'SOCKS5';
                        if (proxyType === 'SOCKS4') {
                            args.push('--socks4', proxyPath);
                        } else {
                            args.push('--socks5', proxyPath);
                        }
                        broadcast({ type: 'info', message: `[KillSwitch] Using ${proxyType} proxy: ${proxyFile}` });
                    } catch (e) {
                        console.error(`[KillSwitch] Could not read metadata for proxy ${proxyFile}, defaulting to SOCKS5.`);
                        args.push('--socks5', proxyPath); // Domyślnie SOCKS5, jeśli meta-plik nie istnieje
                    }
                }

                const child = spawn('java', args);
                activeProcess = child;
                broadcast({ type: 'status_update', isRunning: true, ip: ip, amount: amount });
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
                const { id, ip, actionsFile, nicksFile, proxyFile } = data.params;

                if (!ip || !id) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Kill Switch Error: Missing IP or ID.' }));
                    broadcast({ type: 'killswitch_attack_finished', id });
                    return;
                }
                if (activeKillSwitches.has(id)) {
                    return;
                }
                try {
                    if (actionsFile) await fs.access(path.join(actionsDir, `${sanitize(actionsFile)}.txt`));
                    if (nicksFile) await fs.access(path.join(nicksDir, `${sanitize(nicksFile)}.txt`));
                    if (proxyFile) await fs.access(path.join(proxyDir, `${sanitize(proxyFile)}.txt`));
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
                broadcast({ type: 'info', message: `[KillSwitch] Initiating attack on ${ip}` });
                
                const nicksPath = nicksFile ? path.join(nicksDir, `${sanitize(nicksFile)}.txt`) : null;
                const actionsPath = actionsFile ? path.join(actionsDir, `${sanitize(actionsFile)}.txt`) : null;
                const proxyPath = proxyFile ? path.join(proxyDir, `${sanitize(proxyFile)}.txt`) : null;
                const proxyMetaPath = proxyFile ? path.join(proxyDir, `${sanitize(proxyFile)}.json`) : null;
                            
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
                });

                killSwitchProcess.stderr.on('data', (data) => {
                    broadcast({ type: 'error', message: `[KillSwitch ${ip}]: ${data.toString()}` });
                });

                killSwitchProcess.on('close', (code) => {
                    activeKillSwitches.delete(id);
                    broadcast({ type: 'info', message: `[KillSwitch] Attack on ${ip} has finished.` });
                    broadcast({ type: 'killswitch_status_update', activeIds: Array.from(activeKillSwitches) });
                    broadcast({ type: 'lists_updated' });
                });

                killSwitchProcess.on('error', (err) => {
                    activeKillSwitches.delete(id);
                    broadcast({ type: 'error', message: `[KillSwitch] Failed to start attack on ${ip}.` });
                    broadcast({ type: 'killswitch_status_update', activeIds: Array.from(activeKillSwitches) }); 
                });
            } else if (data.type === 'stop_attack') {
                if (activeProcess) {
                    broadcast({ type: 'info', message: 'Received stop command...' });
                    activeProcess.kill(9);
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
const interval = setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.isAlive === false) {
      console.log('Terminating dead WebSocket connection.');
      return client.terminate();
    }
    client.isAlive = false;
    client.ping(() => {});
  });
}, 5000);

wss.on('close', () => {
  clearInterval(interval);
});

setInterval(() => {
    os.cpuUsage((cpuPercent) => {
        const cpu = parseFloat((cpuPercent * 100).toFixed(1));

        const totalMemMB = os.totalmem();
        const freeMemMB = os.freemem();
        const usedMemMB = totalMemMB - freeMemMB;
        
        const ramPercent = parseFloat(((usedMemMB / totalMemMB) * 100).toFixed(1));

        const usedRamGb = parseFloat((usedMemMB / 1024).toFixed(1));
        const totalRamGb = parseFloat((totalMemMB / 1024).toFixed(1));

        broadcast({
            type: 'system_stats',
            payload: {
                cpu: cpu,
                ramPercent: ramPercent,
                usedRamGb: usedRamGb,
                totalRamGb: totalRamGb
            }
        });
    });
}, 1000);

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});