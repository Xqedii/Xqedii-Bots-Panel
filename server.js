const express = require('express');
const http = require('http');
const https = require('https');
const dns = require('dns').promises;
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
const asciiDir = path.join(dataDir, 'ascii');
const killswitchDir = path.join(dataDir, 'killswitches');
const activeProxiesPath = path.join(dataDir, 'active_proxies.json');
const activeKillSwitches = new Set();

fs.mkdir(nicksDir, { recursive: true });
fs.mkdir(actionsDir, { recursive: true });
fs.mkdir(listenersDir, { recursive: true });
fs.mkdir(proxyDir, { recursive: true });
fs.mkdir(asciiDir, { recursive: true });
fs.mkdir(killswitchDir, { recursive: true });

let activeProcess = null;
let velocityProcess = null;
let intentionalVelocityStop = false;

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
    const dirs = { nicks: nicksDir, actions: actionsDir, listeners: listenersDir, proxy: proxyDir, ascii: asciiDir };
    return dirs[type];
};

const fetchJson = (url) => new Promise((resolve, reject) => {
    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    };

    https.get(url, options, (res) => {
        if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`HTTP Error: ${res.statusCode}`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                resolve(JSON.parse(data));
            } catch(e) {
                reject(new Error(`Invalid Json: ${data.substring(0, 50)}...`));
            }
        });
    }).on('error', reject);
});



function resolveSrvToIp(data) {
    const dns = data.dns || {};
    const srvRecords = dns.srv || [];

    if (srvRecords.length === 0) {
        return { ip: null, port: 25565 };
    }

    const srv = srvRecords[0];
    const port = srv.port || 25565;
    const target = srv.target;

    const srv_a_records = dns.srv_a || [];
    let final_ip = target;

    for (const record of srv_a_records) {
        if (record.name === final_ip) {
            if (record.type === 'A') {
                final_ip = record.address;
                break;
            } else if (record.type === 'CNAME') {
                final_ip = record.cname;
            }
        }
    }

    return { ip: final_ip, port: port };
}

async function resolveManualDNS(domain) {
    let host = domain;
    let port = 25565;
    
    try {
        const records = await dns.resolveSrv(`_minecraft._tcp.${domain}`);
        if (records.length > 0) {
            host = records[0].name;
            port = records[0].port;
        }
    } catch (e) {
    }

    let finalIp = host;
    try {
        const ips = await dns.resolve4(host);
        if (ips.length > 0) {
            finalIp = ips[0];
        }
    } catch (e) {
    }

    return `${finalIp}:${port}`;
}

async function getMinecraftIpPort(serverAddress) {
    const url = `https://api.mcsrvstat.us/2/${serverAddress}`;
    
    const data = await fetchJson(url);
    

    let { ip, port } = resolveSrvToIp(data);

    if (!ip) {
        ip = data.ip;
        port = data.port || 25565;
    }

    if (!ip) throw new Error("Nie udało się ustalić IP serwera.");

    return `${ip}:${port}`;
}

const getList = (dir, type) => async (req, res) => {
    try {
        const files = await fs.readdir(dir);
        const baseFiles = files.filter(f => !f.endsWith('.json')).map(f => path.parse(f).name);

        if (type === 'nicks') {
            const nicksData = await Promise.all(baseFiles.map(async (name) => {
                const metaPath = path.join(dir, `${name}.json`);
                let nickType = 'Nickname List';
                try {
                    const metaContent = await fs.readFile(metaPath, 'utf-8');
                    const meta = JSON.parse(metaContent);
                    if (meta.type === 'generator') {
                        nickType = 'Generator';
                    }
                } catch (e) {
                }
                return { name, type: nickType };
            }));
            return res.json(nicksData);
        }

        if (type === 'proxy') {
            const proxyData = await Promise.all(baseFiles.map(async (name) => {
                const metaPath = path.join(dir, `${name}.json`);
                let proxyType = 'SOCKS5'; 
                try {
                    const metaContent = await fs.readFile(metaPath, 'utf-8');
                    proxyType = JSON.parse(metaContent).type || 'SOCKS5';
                } catch (e) {}
                return { name, type: proxyType };
            }));
            return res.json(proxyData);
        }

        const fileNames = [...new Set(baseFiles)];
        return res.json(fileNames);

    } catch (error) {
        res.status(500).send('Error reading list directory');
    }
};

const getContent = (dir, type) => async (req, res) => {
    const fileName = path.basename(req.params.name);
    if (!fileName) return res.status(400).send('Invalid file name');

    const filePath = path.join(dir, `${fileName}.txt`);
    
    try {
        const stats = await fs.stat(filePath);
        const responseData = { content: '', lastModified: stats.mtime.getTime() };

        if (type === 'proxy') {
            responseData.content = await fs.readFile(filePath, 'utf-8');
            const metaPath = path.join(dir, `${fileName}.json`);
            try {
                const metaContent = await fs.readFile(metaPath, 'utf-8');
                responseData.type = JSON.parse(metaContent).type;
            } catch (e) {
                responseData.type = 'SOCKS5';
            }
        } else if (type === 'nicks') {
            const metaPath = path.join(dir, `${fileName}.json`);
            let meta = { type: 'list' };
            try {
                meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
            } catch(e) { }

            responseData.nickType = meta.type || 'list';
            if (responseData.nickType === 'generator') {
                responseData.content = meta.base || '';
            } else {
                responseData.content = await fs.readFile(filePath, 'utf-8');
            }
        } else {
            responseData.content = await fs.readFile(filePath, 'utf-8');
        }
        res.json(responseData);
    } catch (error) {
        res.status(404).send('File not found');
    }
};

const saveContent = (dir, type) => async (req, res) => {
    const { name, content, lastModified } = req.body;
    const fileName = path.basename(name);
    if (!fileName || typeof content === 'undefined') return res.status(400).send('Invalid data');
    
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

        if (type === 'nicks') {
            const nickType = req.body.nickType || 'list';
            const metaPath = path.join(dir, `${fileName}.json`);
            if (nickType === 'generator') {
                const baseNick = content.trim();
                if (baseNick.length > 12) {
                    return res.status(400).send('Base nickname cannot exceed 12 characters.');
                }
                await fs.writeFile(metaPath, JSON.stringify({ type: 'generator', base: baseNick }));
                await fs.writeFile(filePath, '');
            } else {
                await fs.writeFile(metaPath, JSON.stringify({ type: 'list' }));
                await fs.writeFile(filePath, content);
            }
        } else if (type === 'proxy') {
            await fs.writeFile(filePath, content);
            if (req.body.type) {
                const metaPath = path.join(dir, `${fileName}.json`);
                await fs.writeFile(metaPath, JSON.stringify({ type: req.body.type }));
            }
        } else {
             await fs.writeFile(filePath, content);
        }

        broadcast({ type: 'lists_updated' });
        res.status(201).send('File saved');
    } catch (error) {
        res.status(500).send('Error saving file: ' + error.message);
    }
};

const deleteContent = (dir, type) => async (req, res) => {
    const fileName = path.basename(req.params.name);
    if (!fileName) return res.status(400).send('Invalid file name');
    try {
        await fs.unlink(path.join(dir, `${fileName}.txt`));
        if (type === 'proxy' || type === 'nicks') {
            const metaPath = path.join(dir, `${fileName}.json`);
            try { await fs.unlink(metaPath); } catch(e) { }
        }
        broadcast({ type: 'lists_updated' });
        res.status(200).send('File deleted');
    } catch (error) {
        res.status(500).send('Error deleting file');
    }
};

const renameContent = (dir, type) => async (req, res) => {
    const oldName = path.basename(req.params.oldName);
    const { newName } = req.body;
    const sanitizedNewName = path.basename(newName);

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
        if (type === 'proxy' || type === 'nicks') {
            const oldMetaPath = path.join(dir, `${oldName}.json`);
            const newMetaPath = path.join(dir, `${sanitizedNewName}.json`);
            try { await fs.rename(oldMetaPath, newMetaPath); } catch (e) { }
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
        res.json({ SOCKS4: null, SOCKS5: null });
    }
});
app.post('/api/killswitches', async (req, res) => {
    const { ip, actionsFile, nicksFile, proxyFile } = req.body; 
    if (!ip) {
        return res.status(400).send('Server IP is required.');
    }
    const newServer = {
        id: Date.now().toString(),
        ip,
        actionsFile: actionsFile || "",
        nicksFile: nicksFile || "",
        proxyFile: proxyFile || ""
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
        activeProxies = { SOCKS4: null, SOCKS5: null };
    }

    if (activeProxies[type] === name) {
        activeProxies[type] = null;
    } else {
        activeProxies[type] = name;
    }

    try {
        await fs.writeFile(activeProxiesPath, JSON.stringify(activeProxies, null, 2));
        broadcast({ type: 'lists_updated' });
        res.sendStatus(200);
    } catch (error) {
        res.status(500).send('Error saving active proxy state');
    }
});

app.put('/api/killswitches/:id', async (req, res) => {
    const { id } = req.params;
    const { ip, actionsFile, nicksFile, proxyFile } = req.body;
    if (!ip) {
        return res.status(400).send('Server IP is required.');
    }
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

['nicks', 'proxy', 'listeners', 'actions', 'ascii'].forEach(createRoutesForType);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/api/' });
const cleanString = (str) => {
  return str.replace(/�/g, '')
    .replace(/[^\x20-\x7EĄĆĘŁŃÓŚŹŻąćęłńóśźż]/g, ''); 
};
const extractMessageFromComponent = (msg) => {
  if (msg.includes('TextComponentImpl') || msg.includes('content=')) {
      const regex = /content="([^"]*)"/g;
      const matches = [...msg.matchAll(regex)];
      
      if (matches.length > 0) {
          let fullText = matches.map(m => m[1]).join('');
          
          if (!fullText.trim()) return cleanString(msg);
          
          return cleanString(fullText);
      }
  }

  let match = msg.match(/TranslatableComponentImpl\{key="([^"]+)"[,\}]/);
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
            if (activeProcess || (typeof velocityProcess !== 'undefined' && velocityProcess)) {
                ws.send(JSON.stringify({ type: 'error', message: 'Another process is already running!' }));
                return;
            }

            const { ip, amount, delay, nicksFile, actionsFile, fallCheck, version, serverCheckMethod, autoReconnect, reconnectDelay } = data.params;

            if (version === "1.8-1.21.10") {
                broadcast({ type: 'velocity_popup', status: 'open', title: 'Preparing connection...' });

                (async () => {
                    try {
                        let targetAddress;

                        const inputParts = ip.split(':');
                        const hostPart = inputParts[0].toLowerCase();
                        const portPart = inputParts[1] || '25565';
                        const localAddresses = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

                        if (localAddresses.includes(hostPart)) {
                            broadcast({ type: 'velocity_log', message: `Localhost detected (${hostPart}). Skipping checks.` });
                            targetAddress = `${hostPart}:${portPart}`;
                        } else {
                            if (serverCheckMethod === 'off') {
                                broadcast({ type: 'velocity_log', message: `Check Mode: OFF (Using input directly)` });
                                targetAddress = ip;
                            
                            } else if (serverCheckMethod === 'manual') {
                                broadcast({ type: 'velocity_log', message: `Check Mode: DNS (Local Resolver)` });
                                broadcast({ type: 'velocity_log', message: `Resolving DNS for: ${inputParts[0]}...` });
                                
                                targetAddress = await resolveManualDNS(inputParts[0]);
                                
                                broadcast({ type: 'velocity_log', message: `Resolved IP: ${targetAddress}` });

                            } else {
                                broadcast({ type: 'velocity_log', message: `Check Mode: API (mcsrvstat.us)` });
                                broadcast({ type: 'velocity_log', message: `Resolving DNS for: ${ip}...` });
                                
                                targetAddress = await getMinecraftIpPort(ip);
                                
                                broadcast({ type: 'velocity_log', message: `Resolved IP: ${targetAddress}` });
                            }
                        }

                        const velocityPath = path.join(__dirname, 'velocity');
                        const tomlPath = path.join(velocityPath, 'velocity.toml');

                        let tomlContent = await fs.readFile(tomlPath, 'utf-8');
                        
                        const regex = /^xqbots\s*=\s*".*?"/m;
                        
                        if (regex.test(tomlContent)) {
                            tomlContent = tomlContent.replace(regex, `xqbots = "${targetAddress}"`);
                        } else {
                            tomlContent += `\nxqbots = "${targetAddress}"`;
                        }
                        
                        await fs.writeFile(tomlPath, tomlContent);
                        broadcast({ type: 'velocity_log', message: `Config updated. Target set to ${targetAddress}` });

                        broadcast({ type: 'velocity_popup', title: 'Starting Velocity...' });
                        
                        const vArgs = ['-Dfile.encoding=UTF-8', '-jar', 'server.jar'];
                        velocityProcess = spawn('java', vArgs, { cwd: velocityPath });

                        let isReady = false;

                        velocityProcess.stdout.on('data', (vData) => {
                            const line = vData.toString();
                            broadcast({ type: 'velocity_log', message: line.trim() });

                            if (!isReady && (line.includes('Done (') || line.includes('Listening on /'))) {
                                isReady = true;
                                broadcast({ type: 'velocity_log', message: 'Velocity is ready!' });
                                
                                setTimeout(() => {
                                    broadcast({ type: 'velocity_popup', status: 'close' });
                                    startBotProcess('0.0.0.0:25590');
                                }, 500);
                            }
                        });

                        velocityProcess.stderr.on('data', (vData) => {
                            broadcast({ type: 'velocity_log', message: `ERR: ${vData.toString()}` });
                        });

                        velocityProcess.on('close', (code) => {
                            if (!intentionalVelocityStop) {
                                broadcast({ type: 'velocity_log', message: `Velocity stopped (Code: ${code}).` });
                            }
                            velocityProcess = null;
                            intentionalVelocityStop = false; 

                            if (activeProcess) {
                                activeProcess.kill();
                                activeProcess = null;
                                broadcast({ type: 'status_update', isRunning: false });
                            }
                        });

                    } catch (e) {
                        broadcast({ type: 'velocity_log', message: `CRITICAL ERROR: ${e.message}` });
                        
                        const msg = e.message.toLowerCase();
                        if (msg.includes('http') || msg.includes('api') || msg.includes('json') || msg.includes('500') || msg.includes('404')) {
                            
                            velocityProcess = null;
                            
                            setTimeout(() => {
                                broadcast({ type: 'velocity_popup', status: 'close' });
                                broadcast({ 
                                    type: 'velocity_scan_error',
                                    message: e.message
                                });
                            }, 100); 
                            
                        } else {
                            broadcast({ type: 'error', message: e.message });
                            velocityProcess = null;
                        }
                    }
                })();
                
                return;
            }

            startBotProcess(ip);

            async function startBotProcess(targetIp) {
                broadcast({ type: 'log', message: `Connecting bots to ${targetIp}...` });
                
                const args = [
                    '-Dfile.encoding=UTF-8',
                    '-jar', 'X.jar', '-s', targetIp, '-c', amount,
                    '-d', delay, (parseInt(delay, 10) + 200).toString(),
                    '--listeners', path.join(process.cwd(), 'data/listeners')
                ];

                if (autoReconnect && reconnectDelay) {
                    args.push('-r', reconnectDelay.toString());
                }
                if (nicksFile) {
                    try {
                        const metaPath = path.join(nicksDir, `${path.basename(nicksFile)}.json`);
                        const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
                        if (meta.type === 'generator') args.push('--nick-base', meta.base);
                        else args.push('--nicks', path.join(nicksDir, `${path.basename(nicksFile)}.txt`));
                    } catch(e) {
                         args.push('--nicks', path.join(nicksDir, `${path.basename(nicksFile)}.txt`));
                    }
                }

                if (actionsFile) args.push('--actions', path.join(actionsDir, `${path.basename(actionsFile)}.txt`));

                try {
                    const activeProxies = JSON.parse(await fs.readFile(activeProxiesPath, 'utf-8'));
                    if (activeProxies.SOCKS4) args.push('--socks4', path.join(proxyDir, `${path.basename(activeProxies.SOCKS4)}.txt`));
                    if (activeProxies.SOCKS5) args.push('--socks5', path.join(proxyDir, `${path.basename(activeProxies.SOCKS5)}.txt`));
                } catch(e) {}
                console.log(args);
                const child = spawn('java', args);
                activeProcess = child;
                broadcast({ type: 'status_update', isRunning: true, ip: targetIp, amount: amount });

                const cleanMessage = (line) => line.replace(/^(IMP|INFO|CHAT|T|WARN|ERROR)\s*\|\s*/i, '').trim();
                
                const processOutput = (data, msgType) => {
                    const lines = data.toString().split('\n');
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        const finalType = line.includes('IMP |') ? 'important' : msgType;
                        let msg = cleanMessage(line);
                        msg = extractMessageFromComponent(msg); 
                        if (msg) broadcast({ type: finalType, message: msg });
                    }
                };

                child.stdout.on('data', (d) => processOutput(d, 'log'));
                child.stderr.on('data', (d) => processOutput(d, 'error'));
                
                child.on('close', (code) => {
                    broadcast({ type: 'info', message: `Bots process finished: ${code || 'Stop'}` });
                    activeProcess = null;
                    broadcast({ type: 'status_update', isRunning: false });
                    
                    if (velocityProcess) {
                        velocityProcess.kill();
                        velocityProcess = null;
                    }
                });
            }

        } else if (data.type === 'start_killswitch_attack') {
            const { id, ip, actionsFile, nicksFile, proxyFile } = data.params;

            if (!ip || !id) {
                ws.send(JSON.stringify({ type: 'error', message: 'Kill Switch Error: Missing IP or ID.' }));
                return;
            }
            if (activeKillSwitches.has(id)) return;
            try {
                if (actionsFile) await fs.access(path.join(actionsDir, `${path.basename(actionsFile)}.txt`));
                if (nicksFile) await fs.access(path.join(nicksDir, `${path.basename(nicksFile)}.txt`));
                if (proxyFile) await fs.access(path.join(proxyDir, `${path.basename(proxyFile)}.txt`));
            } catch(err) {
                const missingFileType = err.path.includes(nicksDir) ? "Nicks" : err.path.includes(actionsDir) ? "Actions" : "Proxy";
                const missingFileName = path.basename(err.path, '.txt');
                const errorMsg = `[KillSwitch] Cannot start: ${missingFileType} file '${missingFileName}' no longer exists.`;
                broadcast({ type: 'error', message: errorMsg });
                return;
            }
            
            activeKillSwitches.add(id);
            broadcast({ type: 'killswitch_status_update', activeIds: Array.from(activeKillSwitches) });
            broadcast({ type: 'lists_updated' });
            broadcast({ type: 'info', message: `[KillSwitch] Initiating attack on ${ip}` });
            
            const args = [
                '-Dfile.encoding=UTF-8',
                '-jar', 'X.jar', '-s', ip, '-c', '7', '-d', '4500', '4800',
                '--listeners', path.join(process.cwd(), 'data/listeners')
            ];

            if (actionsFile) args.push('--actions', path.join(actionsDir, `${path.basename(actionsFile)}.txt`));

            if (nicksFile) {
                const nicksMetaPath = path.join(nicksDir, `${path.basename(nicksFile)}.json`);
                let nickIsGenerator = false;
                try {
                    const meta = JSON.parse(await fs.readFile(nicksMetaPath, 'utf-8'));
                    if (meta.type === 'generator' && meta.base) {
                        args.push('--nick-base', meta.base);
                        nickIsGenerator = true;
                    }
                } catch(e) {}
                if (!nickIsGenerator) {
                    args.push('--nicks', path.join(nicksDir, `${path.basename(nicksFile)}.txt`));
                }
            }

            if (proxyFile) {
                try {
                    const metaContent = await fs.readFile(path.join(proxyDir, `${path.basename(proxyFile)}.json`), 'utf-8');
                    const proxyType = JSON.parse(metaContent).type || 'SOCKS5';
                    args.push(proxyType === 'SOCKS4' ? '--socks4' : '--socks5', path.join(proxyDir, `${path.basename(proxyFile)}.txt`));
                    broadcast({ type: 'info', message: `[KillSwitch] Using ${proxyType} proxy: ${proxyFile}` });
                } catch (e) {
                    args.push('--socks5', path.join(proxyDir, `${path.basename(proxyFile)}.txt`));
                }
            }

            const killSwitchProcess = spawn('java', args);
            killSwitchProcess.stderr.on('data', (data) => broadcast({ type: 'error', message: `[KillSwitch ${ip}]: ${data.toString()}` }));
            const onFinish = () => {
                activeKillSwitches.delete(id);
                broadcast({ type: 'info', message: `[KillSwitch] Attack on ${ip} has finished.` });
                broadcast({ type: 'killswitch_status_update', activeIds: Array.from(activeKillSwitches) });
                broadcast({ type: 'lists_updated' });
            };
            killSwitchProcess.on('close', onFinish);
            killSwitchProcess.on('error', onFinish);

        } else if (data.type === 'stop_attack') {
            let stoppedSomething = false;

            if (activeProcess) {
                broadcast({ type: 'info', message: 'Stopping bots...' });
                activeProcess.kill(9);
                activeProcess = null;
                stoppedSomething = true;
            }

            if (velocityProcess) {
                intentionalVelocityStop = true;
                velocityProcess.kill();
                velocityProcess = null;
                broadcast({ type: 'info', message: 'Velocity stopped.' });
                stoppedSomething = true;
            }

            if (!stoppedSomething) {
                 ws.send(JSON.stringify({ type: 'error', message: 'No active process to stop.' }));
            }
            
            broadcast({ type: 'status_update', isRunning: false });
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
            payload: { cpu, ramPercent, usedRamGb, totalRamGb }
        });
    });
}, 1000);

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});