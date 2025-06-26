document.addEventListener('DOMContentLoaded', () => {
    const consoleOutput = document.getElementById('console');
    const attackBtn = document.getElementById('start-btn');
    
    const ipInput = document.getElementById('ip');
    const amountInput = document.getElementById('amount');
    const versionSelect = document.getElementById('version');
    const delayInput = document.getElementById('delay');
    const nicksDropdown = document.getElementById('nicks-dropdown');
    const actionsDropdown = document.getElementById('actions-dropdown');

    let isReconnecting = false;
    const customModalOverlay = document.getElementById('custom-modal-overlay');
    const customModalTitle = document.getElementById('custom-modal-title');
    const customModalBody = document.getElementById('custom-modal-body');
    const customModalFooter = document.getElementById('custom-modal-footer');

    const killswitchContainer = document.getElementById('killswitch-servers-container');
    const addKillswitchBtn = document.getElementById('killswitch-add-btn');
    let activeKillSwitchIds = new Set();

    const saveAttackConfig = () => {
        const config = {
            ip: ipInput.value,
            amount: amountInput.value,
            version: versionSelect.value,
            delay: delayInput.value,
            nicks: nicksDropdown.value,
            actions: actionsDropdown.value
        };
        localStorage.setItem('attackConfig', JSON.stringify(config));
    };

    const loadAttackConfig = () => {
        const savedConfigJSON = localStorage.getItem('attackConfig');
        if (!savedConfigJSON) {
            return;
        }

        const config = JSON.parse(savedConfigJSON);

        if (config.ip) ipInput.value = config.ip;
        if (config.amount) amountInput.value = config.amount;
        if (config.version) versionSelect.value = config.version;
        if (config.delay) delayInput.value = config.delay;

        if (config.nicks) {
            const optionExists = [...nicksDropdown.options].some(option => option.value === config.nicks);
            if (optionExists) {
                nicksDropdown.value = config.nicks;
            } else {
                nicksDropdown.value = '';
            }
        }

        if (config.actions) {
            const optionExists = [...actionsDropdown.options].some(option => option.value === config.actions);
            if (optionExists) {
                actionsDropdown.value = config.actions;
            } else {
                actionsDropdown.value = '';
            }
        }
    };
    
    ipInput.addEventListener('change', saveAttackConfig);
    amountInput.addEventListener('change', saveAttackConfig);
    versionSelect.addEventListener('change', saveAttackConfig);
    delayInput.addEventListener('change', saveAttackConfig);
    nicksDropdown.addEventListener('change', saveAttackConfig);
    actionsDropdown.addEventListener('change', saveAttackConfig);


    const renderKillSwitchPanel = async () => {
        killswitchContainer.innerHTML = '';
        
        try {
            const [servers, allActions, allNicks] = await Promise.all([
                fetch('/api/killswitches').then(res => res.json()),
                fetch('/api/actions').then(res => res.json()),
                fetch('/api/nicks').then(res => res.json())
            ]);

            if (servers.length === 0) {
                return;
            }

            servers.forEach(server => {
                const card = document.createElement('div');
                card.className = 'killswitch-card';
                card.dataset.id = server.id;

                const isActionMissing = server.actionsFile && !allActions.includes(server.actionsFile);
                const isNickMissing = server.nicksFile && !allNicks.includes(server.nicksFile);
                const isInvalid = isActionMissing || isNickMissing;

                const isLoading = activeKillSwitchIds.has(server.id);

                const isMissingFile = isActionMissing || isNickMissing;

                card.innerHTML = `
                    <div class="killswitch-card-header">
                        <h4>${server.ip}</h4>
                        <div class="killswitch-card-controls">
                            <button class="edit-btn" title="Edit Server"><span class="material-symbols-outlined">edit</span></button>
                            <button class="delete-btn" title="Delete Server"><span class="material-symbols-outlined">delete</span></button>
                        </div>
                    </div>
                    <div class="killswitch-card-info">
                        <p>Actions: <strong>${server.actionsFile || 'None'}</strong> ${isActionMissing ? '<span class="file-deleted">(deleted)</span>' : ''}</p>
                        <p>Nicks: <strong>${server.nicksFile || 'None'}</strong> ${isNickMissing ? '<span class="file-deleted">(deleted)</span>' : ''}</p>
                    </div>
                    <button class="btn btn-danger btn-turn-off ${isLoading ? 'loading' : ''} ${isMissingFile ? 'disabled-btn' : ''}" 
                        ${isLoading || isMissingFile ? 'disabled' : ''} 
                        title="${isMissingFile ? 'Cannot start: A required file has been deleted.' : 'Start attack'}">
                        Turn off
                        <div class="btn-spinner"></div>
                    </button>
                `;
                
                card.querySelector('.btn-turn-off').addEventListener('click', (e) => {
                    const button = e.currentTarget;
                    if (button.classList.contains('loading')) return;

                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                            type: 'start_killswitch_attack',
                            params: { id: server.id, ip: server.ip, actionsFile: server.actionsFile, nicksFile: server.nicksFile }
                        }));
                    } else {
                        customAlert('Not connected to the server!', 'Connection Error');
                    }
                });
                
                card.querySelector('.edit-btn').addEventListener('click', () => handleEditKillSwitch(server, allActions, allNicks));


                card.querySelector('.delete-btn').addEventListener('click', async () => {
                    const confirmed = await customConfirm(`Are you sure you want to delete the server "${server.ip}"?`);
                    if (confirmed) {
                        await fetch(`/api/killswitches/${server.id}`, { method: 'DELETE' });
                        localStorage.removeItem(`ks_loading_${server.id}`);
                    }
                });

                killswitchContainer.appendChild(card);
            });
        } catch(error) {
            console.error("Failed to render Kill Switch panel:", error);
            killswitchContainer.innerHTML = '<p style="color: var(--error-color);">Could not load Kill Switch list from the server.</p>';
        }
    };

    const showKillSwitchModal = async (config) => {
        let actionsOptions = '<option value="">None</option>';
        let nicksOptions = '<option value="">None</option>';

        try {
            const actions = await (await fetch('/api/actions')).json();
            const nicks = await (await fetch('/api/nicks')).json();
            
            actions.forEach(name => actionsOptions += `<option value="${name}" ${config.server && config.server.actionsFile === name ? 'selected' : ''}>${name}</option>`);
            nicks.forEach(name => nicksOptions += `<option value="${name}" ${config.server && config.server.nicksFile === name ? 'selected' : ''}>${name}</option>`);
        } catch (e) {
            console.error("Failed to load lists for Kill Switch modal", e);
            customAlert("Could not load Action/Nick lists.", "Error");
            return null;
        }

        const result = await showCustomModal({
            title: config.title,
            bodyHTML: `
                <div id="killswitch-modal-body">
                    <div class="form-group">
                        <label for="ks-ip">Server IP</label>
                        <input type="text" id="ks-ip" placeholder="example.com" value="${config.server ? config.server.ip : ''}">
                    </div>
                    <div class="form-group">
                        <label for="ks-actions">Actions</label>
                        <select id="ks-actions">${actionsOptions}</select>
                    </div>
                    <div class="form-group">
                        <label for="ks-nicks">Nicknames</label>
                        <select id="ks-nicks">${nicksOptions}</select>
                    </div>
                </div>`,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', resolves: null },
                { text: config.confirmText, class: 'btn-primary', resolves: true }
            ]
        });

        if (result) {
            const ip = document.getElementById('ks-ip').value;
            const actionsFile = document.getElementById('ks-actions').value;
            const nicksFile = document.getElementById('ks-nicks').value;

            if (!ip) {
                customAlert('Server IP cannot be empty!', 'Validation Error');
                return null;
            }
            return { ip, actionsFile, nicksFile };
        }
        return null;
    };
    
    if (addKillswitchBtn) {
        addKillswitchBtn.addEventListener('click', async () => {
            const data = await showKillSwitchModal({
                title: 'Add New Kill Switch Server',
                confirmText: 'Add Server'
            });
    
            if (data) {
                await fetch('/api/killswitches', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }
        });
    } else {
        console.error("Error: Button with ID 'killswitch-add-btn' was not found in the document.");
    }

    const handleEditKillSwitch = async (server) => {
        const data = await showKillSwitchModal({
            title: 'Edit Kill Switch Server',
            confirmText: 'Save Changes',
            server: server
        });

        if (data) {
            await fetch(`/api/killswitches/${server.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
    };


    const showCustomModal = (config) => {
        return new Promise((resolve) => {
            customModalTitle.textContent = config.title;
            customModalBody.innerHTML = config.bodyHTML;
            customModalFooter.innerHTML = '';

            const close = (value) => {
                customModalOverlay.removeEventListener('click', handleOverlayClick);
                customModalOverlay.classList.remove('modal-open');
                customModalOverlay.style.display = 'none';
                resolve(value);
            }

            const handleOverlayClick = (e) => {
                if (e.target === customModalOverlay) {
                    const cancelButton = config.buttons.find(b => b.class.includes('btn-secondary'));
                    const cancelValue = cancelButton ? cancelButton.resolves : null;
                    close(cancelValue);
                }
            }

            config.buttons.forEach(btnConfig => {
                const button = document.createElement('button');
                button.textContent = btnConfig.text;
                button.className = `btn ${btnConfig.class}`;
                button.addEventListener('click', () => {
                    close(btnConfig.resolves);
                });
                customModalFooter.appendChild(button);
            });
                
            customModalOverlay.addEventListener('click', handleOverlayClick);
            
            customModalOverlay.classList.add('modal-open');
            customModalOverlay.style.display = 'flex';
            
            const input = customModalBody.querySelector('input');
            if (input) {
                input.focus();
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const primaryButton = customModalFooter.querySelector('.btn-primary');
                        if (primaryButton) {
                            primaryButton.click();
                        }
                    }
                });
            }
        });
    };

    const customAlert = (message, title = 'Information') => {
        return showCustomModal({
            title: title,
            bodyHTML: `<p>${message}</p>`,
            buttons: [
                { text: 'OK', class: 'btn-primary', resolves: true }
            ]
        });
    };

    const customConfirm = (message, title = 'Confirmation') => {
        return showCustomModal({
            title: title,
            bodyHTML: `<p>${message}</p>`,
            buttons: [
                { text: 'Cancel', class: 'btn-secondary', resolves: false },
                { text: 'Confirm', class: 'btn-primary', resolves: true }
            ]
        });
    };
    
    const customPrompt = (message, defaultValue = '', title = 'Input Required') => {
        return new Promise(async (resolve) => {
            const config = {
                title: title,
                bodyHTML: `<p>${message}</p><input type="text" id="custom-prompt-input" value="${defaultValue}">`,
                buttons: [
                    { text: 'Cancel', class: 'btn-secondary', resolves: null },
                    { text: 'Confirm', class: 'btn-primary', resolves: true } 
                ]
            };
            
            const result = await showCustomModal(config);

            if (result === null) {
                resolve(null);
            } else {
                const inputVal = document.getElementById('custom-prompt-input').value;
                resolve(inputVal);
            }
        });
    };

    let socket;
    let reconnectInterval = null;

    let botsChart;
    let joinedBotsCount = 0;
    let crashingBotsCount = 0;
    let listenersCount = 0;
        
    const initializeChart = () => {
        const ctx = document.getElementById('bots-chart').getContext('2d');

        const initialLabels = Array.from({ length: 100 }, (_, i) => {
            const time = new Date(Date.now() - (49 - i) * 1000);
            return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        });

        const initialData = Array(100).fill(0);

        botsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [...initialLabels],
                datasets: [
                    {
                        label: 'Connected',
                        data: [...initialData],
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Crashing',
                        data: [...initialData],
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Listeners',
                        data: [...initialData],
                        borderColor: 'rgba(184, 222, 18, 1)',
                        backgroundColor: 'rgba(184, 222, 18, 0.2)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        suggestedMax: 10,
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-desc')
                        },
                        grid: {
                            display: false
                        }
                    },
                    x: {
                        ticks: {
                            display: false,
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-desc')
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-muted')
                        }
                    }
                },
                animation: {
                    duration: 0
                }
            }
        });
    };

    const updateChartTheme = () => {
        if (!botsChart) return;
        const textColorDesc = getComputedStyle(document.documentElement).getPropertyValue('--text-color-desc');
        const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color');
        const textColorMuted = getComputedStyle(document.documentElement).getPropertyValue('--text-color-muted');

        botsChart.options.scales.y.ticks.color = textColorDesc;
        botsChart.options.scales.y.grid.color = borderColor;
        botsChart.options.scales.x.ticks.color = textColorDesc;
        botsChart.options.scales.x.grid.color = borderColor;
        botsChart.options.plugins.legend.labels.color = textColorMuted;
        botsChart.update();
    };

    setInterval(() => {
        if (!botsChart || document.getElementById('attack').classList.contains('active') === false) {
             return;
        }

        const chartData = botsChart.data;
        
        chartData.labels.push(new Date().toLocaleTimeString());
        chartData.datasets[0].data.push(joinedBotsCount);
        chartData.datasets[1].data.push(crashingBotsCount);
        chartData.datasets[2].data.push(listenersCount);

        if (chartData.labels.length > 15) {
            chartData.labels.shift();
            chartData.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }
        
        botsChart.update();
    }, 250);

    const logToConsole = (data) => {
        const timestamp = new Date().toLocaleTimeString();
        const line = document.createElement('div');
        let message = (data.message || '').trim();
        if (message.startsWith("LISTENER | ")) {
            listenersCount = listenersCount+1
            setTimeout(() => {
                listenersCount = Math.max(0, listenersCount - 1);
            }, 1000);
            return;
        }
        if (data.type === 'error') line.classList.add('log-error');
        if (data.type === 'info') line.classList.add('log-info');
        if (data.type === 'important') line.classList.add('log-important');
        line.textContent = `[${timestamp}] ${message}`;
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;

        if (message.includes('Connected to server!')) {
            joinedBotsCount++;
        } else if (message.includes('Starting crash')) {
            crashingBotsCount = crashingBotsCount+2;
        } else if (message.includes('All bots disconnected')) {
            joinedBotsCount = 0;
            crashingBotsCount = 0;
        } else if (message.includes(' disconnected')) {
            joinedBotsCount = Math.max(0, joinedBotsCount - 1);
            crashingBotsCount = Math.max(0, crashingBotsCount - 2);
        }
    };

    const updateAttackButton = (isRunning) => {
        if (isRunning) {
            attackBtn.textContent = 'Stop';
            attackBtn.classList.add('btn-danger');
            attackBtn.classList.remove('btn-primary');
        } else {
            attackBtn.textContent = 'Start';
            attackBtn.classList.add('btn-primary');
            attackBtn.classList.remove('btn-danger');
        }
    };
    
    const clearAllKillSwitchLoadingStates = () => {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('ks_loading_')) {
                localStorage.removeItem(key);
            }
        });
    };

    const connect = () => {
        socket = new WebSocket(`ws://${window.location.host}`);

        socket.onopen = () => {
            console.log('Xqedii Bots | Panel loaded');
            logToConsole({ type: 'info', message: 'Successfully connected to the server.' });
            if (reconnectInterval) {
                clearInterval(reconnectInterval);
                reconnectInterval = null;
            }

            if (isReconnecting) {
                console.log('Reconnected to the server.');
                isReconnecting = false;
            }
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'status_update') {
                updateAttackButton(data.isRunning);
            } else if (data.type === 'lists_updated') {
                renderAll(); 
            } else if (data.type === 'killswitch_status_update') {
                activeKillSwitchIds = new Set(data.activeIds);
            } else {
                logToConsole(data);
            }
        };

        socket.onclose = () => {
            logToConsole({ type: 'error', message: 'Disconnected from server. Attempting to reconnect in 5 seconds...' });
            isReconnecting = true;
            if (!reconnectInterval) {
                reconnectInterval = setInterval(() => {
                    console.log('Attempting to reconnect...');
                    connect();
                }, 5000);
            }
        };

        socket.onerror = (error) => {
            console.error(`WebSocket error: ${error.message}`);
        };
    }
    
    connect();

    const navButtons = document.querySelectorAll('.menu button[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = button.getAttribute('data-tab');

            navButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(t => t.classList.remove('active'));

            button.classList.add('active');
            const targetContent = document.getElementById(targetTab);
            if(targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
    
    attackBtn.addEventListener('click', () => {
         if (socket.readyState !== WebSocket.OPEN) {
            logToConsole({type: 'error', message: 'Not connected to server. Please wait.'});
            return;
        }

        if (attackBtn.textContent === 'Start') {
            consoleOutput.innerHTML = "";
            joinedBotsCount = 0;
            crashingBotsCount = 0;
            const params = {
                ip: document.getElementById('ip').value,
                amount: document.getElementById('amount').value,
                delay: document.getElementById('delay').value,
                nicksFile: document.getElementById('nicks-dropdown').value,
                actionsFile: document.getElementById('actions-dropdown').value,
            };
            if (!params.ip || !params.amount || !params.delay) {
                logToConsole({type: 'error', message: 'Please fill in all required fields!'});
                return;
            }
            botsChart.options.scales.y.suggestedMax = Number(params.amount) + Math.floor(Number(params.amount) / 10);
            botsChart.update();
            socket.send(JSON.stringify({ type: 'start_attack', params: { ...params, nicksFile: params.nicksFile, actionsFile: params.actionsFile } }));
        } else {
            socket.send(JSON.stringify({ type: 'stop_attack' }));
            joinedBotsCount = 0;
            crashingBotsCount = 0;
            botsChart.update();
        }
    });

    function setupListEditor(type) {
        let currentEditingName = null;
        let currentEditingTimestamp = null; 
        const listEl = document.getElementById(`${type}-list`);
        const editorContainer = document.getElementById(`${type}-editor-container`);
        const nameInput = document.getElementById(`${type}-name`);
        const contentTextarea = document.getElementById(`${type}-content`);
        const saveBtn = document.getElementById(`${type}-save`);

        const renderList = async () => {
            try {
                const response = await fetch(`/api/${type}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const names = await response.json();

                listEl.innerHTML = '';
                if (names.length === 0) {
                    listEl.innerHTML = `<li>No saved lists.</li>`;
                }
                names.forEach(name => {
                    const li = document.createElement('li');
                    li.textContent = name;
                    li.dataset.name = name;

                    const controlsDiv = document.createElement('div');
                    controlsDiv.className = 'list-item-controls';

                    const renameBtn = document.createElement('button');
                    renameBtn.className = 'rename-btn';
                    renameBtn.innerHTML = '<span class="material-symbols-outlined">edit</span>';
                    renameBtn.title = `Rename "${name}"`;
                    renameBtn.onclick = async (e) => {
                        e.stopPropagation();
                        const newName = await customPrompt(`Enter a new name for "${name}":`, name, 'Rename List');
                        if (newName && newName.trim() && newName !== name) {
                            try {
                                const renameResponse = await fetch(`/api/${type}/${name}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ newName: newName.trim() })
                                });
                                if (!renameResponse.ok) {
                                    const errorText = await renameResponse.text();
                                    throw new Error(errorText);
                                }
                                if (currentEditingName === name) {
                                    hideEditor();
                                }
                            } catch (error) {
                                await customAlert(`Error renaming file: ${error.message}`, 'Error');
                            }
                        }
                    };

                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
                    deleteBtn.className = 'delete-btn';
                    deleteBtn.title = `Delete "${name}"`;
                    deleteBtn.onclick = async (e) => {
                        e.stopPropagation();
                        const confirmed = await customConfirm(`Are you sure you want to delete the list <b>"${name}"</b>?`);
                        if (confirmed) {
                            await fetch(`/api/${type}/${name}`, { method: 'DELETE' });
                            if (currentEditingName === name) hideEditor();
                        }
                    };

                    controlsDiv.appendChild(renameBtn);
                    controlsDiv.appendChild(deleteBtn);
                    li.appendChild(controlsDiv);

                    li.addEventListener('click', () => editItem(name));
                    listEl.appendChild(li);
                });
                if (type !== 'listeners' && type !== 'proxy') {
                    updateDropdowns(type, names);
                }
            } catch (error) {
                console.error(`Error while loading the ${type} list:`, error);
                logToConsole({type: 'error', message: `Failed to load the "${type}" list.`});
            }
        };

        const showEditor = () => editorContainer.classList.remove('hidden');
        const hideEditor = () => {
            editorContainer.classList.add('hidden');
            nameInput.value = '';
            contentTextarea.value = '';
            currentEditingName = null;
            currentEditingTimestamp = null;
            nameInput.disabled = false;
            saveBtn.disabled = false;
            listEl.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
        };

        const editItem = async (name) => {
            try {
                const response = await fetch(`/api/${type}/${name}`);
                if (!response.ok) throw new Error('File not found');
                const data = await response.json();

                currentEditingName = name;
                currentEditingTimestamp = data.lastModified;

                nameInput.value = name;
                nameInput.disabled = true;
                contentTextarea.value = data.content;
                saveBtn.disabled = false;
                showEditor();

                listEl.querySelectorAll('li').forEach(li => {
                    li.classList.toggle('selected', li.dataset.name === name);
                });
            } catch (err) {
                await customAlert("Could not load file. It might have been deleted by another user.", "Loading Error");
                hideEditor();
                renderAll();
            }
        };

        document.getElementById(`${type}-add-new`).addEventListener('click', () => {
            currentEditingName = null;
            currentEditingTimestamp = null;
            nameInput.value = '';
            contentTextarea.value = '';
            nameInput.disabled = false;
            saveBtn.disabled = false;
            showEditor();
            listEl.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
        });

        document.getElementById(`${type}-cancel`).addEventListener('click', hideEditor);

        saveBtn.addEventListener('click', async () => {
            const name = nameInput.value.trim();
            const content = contentTextarea.value;
            if (!name) {
                await customAlert('Name cannot be empty!', 'Validation Error');
                return;
            }
            
            saveBtn.disabled = true;

            try {
                const response = await fetch(`/api/${type}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        name, 
                        content, 
                        lastModified: currentEditingTimestamp
                    })
                });

                if (response.status === 409) {
                    await customAlert('Save failed! This file was modified by another user. Please cancel and reopen the editor to get the latest version.', 'Conflict');
                    return; 
                }
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || "An unknown error occurred.");
                }

                hideEditor();
            } catch (error) {
                await customAlert(`Error saving file: ${error.message}`, 'Save Error');
            } finally {
                saveBtn.disabled = false;
            }
        });

        return { renderList };
    }

    const nicksEditor = setupListEditor('nicks');
    const actionsEditor = setupListEditor('actions');
    const listenersEditor = setupListEditor('listeners');
    const proxyEditor = setupListEditor('proxy');

    async function renderAll() {
        await Promise.all([
            nicksEditor.renderList(),
            actionsEditor.renderList(),
            listenersEditor.renderList(),
            proxyEditor.renderList(),
            renderKillSwitchPanel()
        ]);
        
        loadAttackConfig();
    }

    function updateDropdowns(type, names) {
        const dropdown = document.getElementById(`${type}-dropdown`);
        const selectedValue = dropdown.value;
        dropdown.innerHTML = `<option value="">None</option>`;
        names.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            dropdown.appendChild(option);
        });
        
        if (names.includes(selectedValue)) {
            dropdown.value = selectedValue;
        }
    }

    const openModalBtn = document.getElementById('open-actions-modal-btn');
    const actionsModal = document.getElementById('actions-modal');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const actionsListContainer = document.getElementById('modal-actions-list');

    const COMMANDS = [
        { command: 'CHAT_MESSAGE', description: 'Sends a message or command via bots.', requiresInput: true, inputPrompt: 'Enter the message to send:' },
        { command: '!list', description: 'Shows the list of connected bots.' },
        { command: '!crash', description: 'Starts crashing the server with all bots.' },
        { command: '!dropall', description: 'All bots drop items from their hotbar.' },
        { command: '!swap', description: 'Enables/Disables automatic sector switching.' },
        { command: '!headroll on', description: 'Enables head rolling for all bots.' },
        { command: '!headroll off', description: 'Disables head rolling for all bots.' },
        { command: '!ascii', description: 'Sends the default ASCII message sequence.' },
        { command: '!channel', description: 'Changes the sector for all bots.', requiresInput: true, inputPrompt: 'Enter sector number:' },
        { command: '!channel auto', description: 'Distributes bots evenly across sectors.', requiresInput: true, inputPrompt: 'Enter the number of sectors to divide among:' },
        { command: '!bot', description: 'Executes a command for a specific bot.', requiresInput: true, inputPrompt: "Enter bot ID and command (e.g., '1 crash' or '3 headroll on'):" },
    ];

    function sendCommand(commandString) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'send_command', command: commandString }));
        } else {
            logToConsole({ type: 'error', message: 'No connection to the server.' });
        }
    }

    function populateActionsModal() {
        actionsListContainer.innerHTML = '';
        COMMANDS.forEach(cmd => {
            const wrapper = document.createElement('div');
            wrapper.className = 'command-button-wrapper';

            const button = document.createElement('button');
            button.className = 'btn btn-secondary';
            button.textContent = cmd.command === 'CHAT_MESSAGE' ? 'Chat' : cmd.command;

            const description = document.createElement('p');
            description.className = 'command-description';
            description.textContent = cmd.description;

            button.addEventListener('click', async () => {
                let fullCommand;

                if (cmd.command === 'CHAT_MESSAGE') {
                    const userInput = await customPrompt(cmd.inputPrompt, '', 'Send a message');
                    if (userInput === null || userInput.trim() === '') return;
                    fullCommand = userInput;
                } else {
                    fullCommand = cmd.command;
                    if (cmd.requiresInput) {
                        const userInput = await customPrompt(cmd.inputPrompt, '', 'Command Input');
                        if (userInput === null) return;
                        fullCommand += ` ${userInput}`;
                    }
                }

                sendCommand(fullCommand.trim());
                actionsModal.style.display = 'none';
            });

            wrapper.appendChild(button);
            wrapper.appendChild(description);
            actionsListContainer.appendChild(wrapper);
        });
    }

    openModalBtn.addEventListener('click', () => { 
        actionsModal.classList.add('modal-open');
        actionsModal.style.display = 'flex'; 
    });
    closeModalBtn.addEventListener('click', () => { 
        actionsModal.classList.remove('modal-open');
        actionsModal.style.display = 'none'; 
    });
    actionsModal.addEventListener('click', (e) => {
        if (e.target === actionsModal) {
            actionsModal.classList.remove('modal-open');
            actionsModal.style.display = 'none';
        }
    });

    populateActionsModal();
    
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsModalCloseBtn = document.getElementById('settings-modal-close-btn');
    const darkModeToggle = document.getElementById('dark-mode-toggle');

    const setTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            darkModeToggle.checked = true;
        } else {
            darkModeToggle.checked = false;
        }
        updateChartTheme();
    };
    
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('modal-open');
        settingsModal.style.display = 'flex';
    });

    settingsModalCloseBtn.addEventListener('click', () => {
        settingsModal.classList.remove('modal-open');
        settingsModal.style.display = 'none';
    });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('modal-open');
            settingsModal.style.display = 'none';
        }
    });

    darkModeToggle.addEventListener('change', () => {
        if (darkModeToggle.checked) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    });
    
    renderAll();
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    initializeChart();
});