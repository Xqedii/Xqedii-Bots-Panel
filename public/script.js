document.addEventListener('DOMContentLoaded', () => {
    const consoleOutput = document.getElementById('console');
    const attackBtn = document.getElementById('start-btn');
    const consoleDescription = document.getElementById('console-description');

    const ipInput = document.getElementById('ip');
    const amountInput = document.getElementById('amount');
    const versionSelect = document.getElementById('version');
    const delayInput = document.getElementById('delay');
    const nicksDropdown = document.getElementById('nicks-dropdown');
    const actionsDropdown = document.getElementById('actions-dropdown');
    
    const fallCheckToggle = document.getElementById('fall-check-toggle');
    let lastCpuWarningTime = 0;

    let isReconnecting = false;
    let cpuChart, ramChart;
    const cpuUsageText = document.getElementById('cpu-usage-text');
    const ramUsageText = document.getElementById('ram-usage-text');
    const customModalOverlay = document.getElementById('custom-modal-overlay');
    const customModalTitle = document.getElementById('custom-modal-title');
    const customModalBody = document.getElementById('custom-modal-body');
    const customModalFooter = document.getElementById('custom-modal-footer');

    const velocityStopBtn = document.getElementById('velocity-stop-btn');
    const killswitchContainer = document.getElementById('killswitch-servers-container');
    const addKillswitchBtn = document.getElementById('killswitch-add-btn');
    let activeKillSwitchIds = new Set();
    let autoCrashInterval = null;
    let statsTabFirstVisit = true;
    let isAttackRunning = false;

    const viaProxyVersions = [
        "1.21.11", "1.21.9-1.21.10", "1.21.7-1.21.8", "1.21.6", "1.21.5", "1.21.4", "1.21.2-1.21.3", "1.21-1.21.1",
        "1.20.5-1.20.6", "1.20.3-1.20.4", "1.20.2", "1.20-1.20.1",
        "1.19.4", "1.19.3", "1.19.1-1.19.2", "1.19",
        "1.18.2", "1.18-1.18.1",
        "1.17.1", "1.17",
        "1.16.4-1.16.5", "1.16.3", "1.16.2", "1.16.1", "1.16",
        "1.15.2", "1.15.1", "1.15",
        "1.14.4", "1.14.3", "1.14.2", "1.14.1", "1.14",
        "1.13.2", "1.13.1", "1.13",
        "1.12.2", "1.12",
        "1.11.1-1.11.2", "1.11",
        "1.10x",
        "1.9.3-1.9.4", "1.9.2", "1.9.1", "1.9",
        "1.8.x",
        "1.7.6-1.7.10", "1.7.2-1.7.5"
    ];
    let viaProxyEnabled = localStorage.getItem('viaProxyEnabled') === 'true';
    let viaProxySelectedVersion = localStorage.getItem('viaProxySelectedVersion') || viaProxyVersions[0];

    const saveFallCheckState = () => {
        const isActive = fallCheckToggle.classList.contains('active');
        localStorage.setItem('fallCheckActive', isActive);
    };

    const loadFallCheckState = () => {
        const isActive = localStorage.getItem('fallCheckActive') === 'true';
        if (isActive) {
            fallCheckToggle.classList.add('active');
        } else {
            fallCheckToggle.classList.remove('active');
        }
    };
    
    if (fallCheckToggle) {
        fallCheckToggle.addEventListener('click', () => {
            fallCheckToggle.classList.toggle('active');
            saveFallCheckState();
        });
        loadFallCheckState();
    }


    function getThemeColors() {
        const computedStyles = getComputedStyle(document.documentElement);
        return {
            cpuColor: computedStyles.getPropertyValue('--text-color').trim(),
            ramColor: computedStyles.getPropertyValue('--IMP-color').trim(),
            chartBackground: computedStyles.getPropertyValue('--chart-background').trim(),
            chartBorder: computedStyles.getPropertyValue('--chart-border').trim(),
        };
    }

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
    const velocityModal = document.getElementById('velocity-modal');
    
    velocityModal.addEventListener('click', (e) => {
        if (e.target === velocityModal) {
            const spinner = document.getElementById('velocity-spinner');
            
            if (spinner.style.display !== 'none') {
                return;
            }

            velocityModal.classList.remove('modal-open');
            velocityModal.style.display = 'none';

            const stopBtn = document.getElementById('velocity-stop-btn');
            if (stopBtn && stopBtn.dataset.mode === 'close') {
                setTimeout(() => {
                    stopBtn.textContent = 'Stop';
                    stopBtn.dataset.mode = 'stop';
                    stopBtn.classList.add('btn-danger');
                    stopBtn.classList.remove('btn-secondary');
                }, 300);
            }
        }
    });
    if (velocityStopBtn) {
        velocityStopBtn.addEventListener('click', () => {
            if (velocityStopBtn.dataset.mode === 'close') {
                const modal = document.getElementById('velocity-modal');
                modal.classList.remove('modal-open');
                modal.style.display = 'none';
                
                setTimeout(() => {
                    velocityStopBtn.textContent = 'Stop';
                    velocityStopBtn.dataset.mode = 'stop';
                    velocityStopBtn.classList.add('btn-danger');
                    velocityStopBtn.classList.remove('btn-secondary');
                }, 300);
                return;
            }

            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'stop_attack' }));
            }
            
            const output = document.getElementById('velocity-console-output');
            if (output) {
                const line = document.createElement('div');
                line.textContent = "Stopping process requested by user...";
                line.style.color = "var(--text-color)"; 
                line.style.fontWeight = "bold";
                output.appendChild(line);
                output.scrollTop = output.scrollHeight;
            }
            
            setTimeout(() => {
                document.getElementById('velocity-modal').classList.remove('modal-open');
                document.getElementById('velocity-modal').style.display = 'none';
            }, 500);
        });
    }
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
            const [servers, allActions, allNicks, allProxies] = await Promise.all([
                fetch('/api/killswitches').then(res => res.json()),
                fetch('/api/actions').then(res => res.json()),
                fetch('/api/nicks').then(res => res.json()),
                fetch('/api/proxy').then(res => res.json())
            ]);

            if (servers.length === 0) {
                return;
            }

            servers.forEach(server => {
                const card = document.createElement('div');
                card.className = 'killswitch-card';
                card.dataset.id = server.id;

                const isActionMissing = server.actionsFile && !allActions.includes(server.actionsFile);
                const isNickMissing = server.nicksFile && !allNicks.map(n => n.name || n).includes(server.nicksFile);
                const isProxyMissing = server.proxyFile && !allProxies.map(p => p.name).includes(server.proxyFile);
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
                        <p>Proxy: <strong>${server.proxyFile || 'None'}</strong> ${isProxyMissing ? '<span class="file-deleted">(deleted)</span>' : ''}</p>
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
                            params: { ...server }
                        }));
                    } else {
                        customAlert('Not connected to the server!', 'Connection Error');
                    }
                });
                
                card.querySelector('.edit-btn').addEventListener('click', () => handleEditKillSwitch(server, allActions, allNicks, allProxies));

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
        let proxyOptions = '<option value="">None</option>';

        try {
            const { allActions, allNicks, allProxies } = config;
            
            allActions.forEach(name => actionsOptions += `<option value="${name}" ${config.server && config.server.actionsFile === name ? 'selected' : ''}>${name}</option>`);
            allNicks.map(n => n.name || n).forEach(name => nicksOptions += `<option value="${name}" ${config.server && config.server.nicksFile === name ? 'selected' : ''}>${name}</option>`);
            
            allProxies.forEach(proxy => proxyOptions += `<option value="${proxy.name}" ${config.server && config.server.proxyFile === proxy.name ? 'selected' : ''}>${proxy.name} (${proxy.type})</option>`);
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
                    <div class="form-group">
                        <label for="ks-proxy">Proxy</label>
                        <select id="ks-proxy">${proxyOptions}</select>
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
            const proxyFile = document.getElementById('ks-proxy').value;

            if (!ip) {
                customAlert('Server IP cannot be empty!', 'Validation Error');
                return null;
            }
            return { ip, actionsFile, nicksFile, proxyFile };
        }
        return null;
    };
    
    if (addKillswitchBtn) {
        addKillswitchBtn.addEventListener('click', async () => {
            const [allActions, allNicks, allProxies] = await Promise.all([
                fetch('/api/actions').then(res => res.json()),
                fetch('/api/nicks').then(res => res.json()),
                fetch('/api/proxy').then(res => res.json())
            ]);

            const data = await showKillSwitchModal({
                title: 'Add New Kill Switch Server',
                confirmText: 'Add Server',
                allActions, allNicks, allProxies
            });

            if (data) {
                await fetch('/api/killswitches', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }
        });
    }

    const handleEditKillSwitch = async (server, allActions, allNicks, allProxies) => {
        const data = await showKillSwitchModal({
            title: 'Edit Kill Switch Server',
            confirmText: 'Save Changes',
            server: server,
            allActions, allNicks, allProxies
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
            
            const input = customModalBody.querySelector('input, select');
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


    const toastContainer = document.getElementById('toast-container');
    let notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
    let notificationDuration = 3000;

    const showNotification = (title, message, duration = null) => {
        if (!notificationsEnabled) return;

        const currentToasts = toastContainer.getElementsByClassName('toast');
        if (currentToasts.length >= 4) {
            currentToasts[0].remove();
        }

        const timeToShow = duration || notificationDuration;

        const toast = document.createElement('div');
        toast.className = 'toast';
        
        toast.innerHTML = `
            <span class="toast-title">${title}</span>
            <span class="toast-message">${message}</span>
            <div class="toast-progress"></div>
        `;

        const progressBar = toast.querySelector('.toast-progress');
        progressBar.style.animationDuration = `${timeToShow}ms`;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', (e) => {
                if (e.animationName === 'toastFadeOut') {
                    toast.remove();
                }
            });
        }, timeToShow);
    };

    let socket;
    let reconnectInterval = null;

    let botsChart;
    let createdBotsCount = 0;
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
                        label: 'Created',
                        data: [...initialData],
                        borderColor: 'rgb(250, 100, 237)',
                        backgroundColor: 'rgba(250, 100, 237, 0.2)',
                        fill: true,
                        tension: 0.4
                    },
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
        if (botsChart) {
            const textColorDesc = getComputedStyle(document.documentElement).getPropertyValue('--text-color-desc');
            const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color');
            const textColorMuted = getComputedStyle(document.documentElement).getPropertyValue('--text-color-muted');

            botsChart.options.scales.y.ticks.color = textColorDesc;
            botsChart.options.scales.y.grid.color = borderColor;
            botsChart.options.scales.x.ticks.color = textColorDesc;
            botsChart.options.scales.x.grid.color = borderColor;
            botsChart.options.plugins.legend.labels.color = textColorMuted;
            botsChart.update();
        }
        if(cpuChart) cpuChart.update();
        if(ramChart) ramChart.update();
    };

    setInterval(() => {
        if (!botsChart || document.getElementById('attack').classList.contains('active') === false) {
             return;
        }

        const chartData = botsChart.data;
        
        chartData.labels.push(new Date().toLocaleTimeString());
        chartData.datasets[0].data.push(createdBotsCount);
        chartData.datasets[1].data.push(joinedBotsCount);
        chartData.datasets[2].data.push(crashingBotsCount);
        chartData.datasets[3].data.push(listenersCount);

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

        if (message.includes('Creating bot')) {
            createdBotsCount++;
        } else if (message.includes('Connected to server!')) {
            joinedBotsCount++;
        } else if (message.includes('Starting crash')) {
            crashingBotsCount = crashingBotsCount+2;
        } else if (message.includes('All bots disconnected')) {
            joinedBotsCount = 0;
            createdBotsCount = 0;
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

    const connect = () => {
		const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
		
		socket = new WebSocket(`${protocol}://${window.location.host}/api/`);

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
            if (data.type === 'captcha_request') {
                const modal = document.getElementById('captcha-solve-modal');
                const img = document.getElementById('captcha-img-display');
                const input = document.getElementById('captcha-input-code');
                
                img.src = `data:image/png;base64,${data.image}`;
                input.value = '';
                
                modal.classList.add('modal-open');
                modal.style.display = 'flex';
                input.focus();
            } else if (data.type === 'captcha_solved') {
                const modal = document.getElementById('captcha-solve-modal');
                modal.classList.remove('modal-open');
                modal.style.display = 'none';
            } else if (data.type === 'viaproxy_popup') {
                const modal = document.getElementById('viaproxy-console-modal');
                const title = document.getElementById('viaproxy-modal-title');
                const output = document.getElementById('viaproxy-console-output');
                const spinner = document.getElementById('viaproxy-spinner');

                if (data.status === 'open') {
                    spinner.style.display = 'block';
                    modal.classList.add('modal-open');
                    modal.style.display = 'flex';
                    output.innerHTML = '';
                } else if (data.status === 'close') {
                    modal.classList.remove('modal-open');
                    modal.style.display = 'none';
                }
                if (data.title) title.textContent = data.title;
                
            } else if (data.type === 'viaproxy_log') {
                const output = document.getElementById('viaproxy-console-output');
                const line = document.createElement('div');
                line.textContent = data.message;
                line.style.borderBottom = "1px solid #333";
                output.appendChild(line);
                output.scrollTop = output.scrollHeight;
            } else if  (data.type === 'status_update') {
                isAttackRunning = data.isRunning;
                updateAttackButton(data.isRunning);
                if (!data.isRunning) {
                    const velModal = document.getElementById('velocity-modal');
                    velModal.classList.remove('modal-open');
                    velModal.style.display = 'none';

                    if (autoCrashInterval) {
                        clearInterval(autoCrashInterval);
                        autoCrashInterval = null;
                    }
                }
                if (!data.isRunning && autoCrashInterval) {
                    clearInterval(autoCrashInterval);
                    autoCrashInterval = null;
                }
                if (data.isRunning && data.ip && data.amount) {
                    consoleDescription.innerHTML = `Current information from the <b>${data.ip}</b>`;

                    if (botsChart) {
                        botsChart.options.scales.y.suggestedMax = Number(data.amount) + Math.floor(Number(data.amount) / 10);
                        botsChart.update();
                    }

                } else {
                    consoleDescription.innerHTML = 'Information from the process.';
                    createdBotsCount = 0;
                    joinedBotsCount = 0;
                    crashingBotsCount = 0;
                    listenersCount = 0; 
                    
                    if (botsChart) {
                        botsChart.options.scales.y.suggestedMax = 10;
                        botsChart.update();
                    }
                }
                
            } else if (data.type === 'lists_updated') {
                renderAll(); 
            } else if (data.type === 'killswitch_status_update') {
                activeKillSwitchIds = new Set(data.activeIds);
            } else if (data.type === 'velocity_popup') {
                const modal = document.getElementById('velocity-modal');
                const title = document.getElementById('velocity-modal-title');
                const output = document.getElementById('velocity-console-output');
                const spinner = document.getElementById('velocity-spinner');
                
                if (data.status === 'open') {
                    spinner.style.display = 'block';
                    modal.classList.add('modal-open');
                    modal.style.display = 'flex';
                    output.innerHTML = '';
                } else if (data.status === 'close') {
                    modal.classList.remove('modal-open');
                    modal.style.display = 'none';
                }
                
                if (data.title) {
                    title.textContent = data.title;
                }
            } else if (data.type === 'velocity_scan_error') {
                const velModal = document.getElementById('velocity-modal');
                velModal.classList.remove('modal-open');
                velModal.style.display = 'none';

                showCustomModal({
                    title: 'Scanning server failed',
                    bodyHTML: `
                        <div style="text-align: center;">
                            <p style="color: var(--error-color); font-weight: bold; margin-bottom: 15px;">
                                API Error: ${data.message}
                            </p>
                            <p>The mcsrvstat.us API is currently down or returned an error.</p>
                            <br>
                            <p><b>Possible Solutions:</b></p>
                            <ul style="text-align: left; margin: 10px 0 15px 20px; color: var(--text-color-muted);">
                                <li>Wait a few minutes and try again.</li>
                                <li>Go to <b>Settings</b> and use <b>DNS</b> Server Checking.</li>
                            </ul>
                            <p style="font-size: 0.9em; opacity: 0.8;">
                                <i>Note: If you skip checking, you must manually enter the numeric IP:Port when using Velocity.</i>
                            </p>
                        </div>
                    `,
                    buttons: [
                        { text: 'Understood', class: 'btn-primary', resolves: true }
                    ]
                });
            } else if (data.type === 'velocity_popup') {
                const modal = document.getElementById('velocity-modal');
                const title = document.getElementById('velocity-modal-title');
                const output = document.getElementById('velocity-console-output');
                
                if (data.status === 'open') {
                    modal.classList.add('modal-open');
                    modal.style.display = 'flex';
                    output.innerHTML = ''; 
                } else if (data.status === 'close') {
                    modal.classList.remove('modal-open');
                    modal.style.display = 'none';
                }
                
                if (data.title) {
                    title.textContent = data.title;
                }
            } else if (data.type === 'velocity_log') {
                const output = document.getElementById('velocity-console-output');
                const line = document.createElement('div');
                line.textContent = data.message;
                line.style.borderBottom = "1px solid #333";
                output.appendChild(line);
                output.scrollTop = output.scrollHeight;
            } else if (data.type === 'system_stats') { 
                const { cpu, ramPercent, usedRamGb, totalRamGb } = data.payload;
                
                if (cpu > 95) {
                    const now = Date.now();
                    if (now - lastCpuWarningTime > 30000) {
                        showNotification('System Warning', `High CPU usage detected: <b>${cpu}%</b>`, 5000);
                        lastCpuWarningTime = now;
                    }
                }
                if (ramPercent > 95) {
                    const now = Date.now();
                    if (now - lastCpuWarningTime > 30000) {
                        showNotification('System Warning', `High RAM usage detected: <b>${ramPercent}%</b>`, 5000);
                        lastCpuWarningTime = now;
                    }
                }

                if (cpuChart && cpuUsageText && cpu !== undefined) {
                    cpuChart.data.datasets[0].data[0] = cpu;
                    cpuChart.data.datasets[0].data[1] = 100 - cpu;
                    cpuChart.update();
                    
                    cpuUsageText.textContent = `${cpu.toFixed(1)}%`;
                }

                if (ramChart && ramUsageText && ramPercent !== undefined && usedRamGb !== undefined && totalRamGb !== undefined) {
                    ramChart.data.datasets[0].data[0] = ramPercent;
                    ramChart.data.datasets[0].data[1] = 100 - ramPercent;
                    ramChart.update();
                    
                    ramUsageText.textContent = `${usedRamGb.toFixed(1)} GB / ${totalRamGb.toFixed(1)} GB`;
                }
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

            if (targetTab === 'stats' && statsTabFirstVisit) {
                if (ramChart && cpuChart) {
                    ramChart.options.animation.duration = 0;
                    cpuChart.options.animation.duration = 0;
                    ramChart.update();
                    cpuChart.update();
                    setTimeout(() => {
                        ramChart.options.animation.duration = 1000;
                        cpuChart.options.animation.duration = 1000;
                    }, 100);
                }
                statsTabFirstVisit = false;
            }

            navButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(t => t.classList.remove('active'));

            button.classList.add('active');
            const targetContent = document.getElementById(targetTab);
            if(targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
    
attackBtn.addEventListener('click', async () => {
         if (!socket || socket.readyState !== WebSocket.OPEN) {
            logToConsole({type: 'error', message: 'Not connected to server. Please wait.'});
            return;
        }

        if (attackBtn.textContent === 'Start') {
            consoleOutput.innerHTML = "";
            createdBotsCount = 0;
            joinedBotsCount = 0;
            crashingBotsCount = 0;

            const params = {
                ip: document.getElementById('ip').value,
                amount: document.getElementById('amount').value,
                version: document.getElementById('version').value, 
                viaProxy: viaProxyEnabled,
                viaProxyVersion: viaProxySelectedVersion,
                delay: document.getElementById('delay').value,
                nicksFile: document.getElementById('nicks-dropdown').value,
                actionsFile: document.getElementById('actions-dropdown').value,
                fallCheck: fallCheckToggle.classList.contains('active'),
                serverCheckMethod: serverCheckMethod,
                autoReconnect: autoReconnectEnabled,
                reconnectDelay: parseInt(autoReconnectDelay, 10)
            };

            if (!params.ip || !params.amount || !params.delay) {
                logToConsole({type: 'error', message: 'Please fill in all required fields!'});
                return;
            }

            if (params.version === '1.8-1.21.10') {
                try {
                    const res = await fetch('/api/active-proxies');
                    const proxies = await res.json();
                    
                    const isProxyOn = proxies.SOCKS4 || proxies.SOCKS5;
                    const delayVal = parseInt(params.delay, 10);
                    const isLowDelay = delayVal < 4000;

                    if (isProxyOn) {
                        let bodyHtml = '<p>Velocity mode requires direct connection (localhost). Proxies must be disabled.</p>';
                        
                        if (isLowDelay) {
                            bodyHtml += `<p style="margin-top: 10px; color: var(--error-color);"><b>Warning:</b> Your delay (${delayVal}ms) is below 4000ms.<br>Since you will be connecting without proxies, the default <b>Connection Throttle</b> (usually 4000ms) will likely block your bots.</p>`;
                        }

                        bodyHtml += '<p><br>Click <b>Continue</b> to automatically disable proxies and start.</p>';

                        const userConfirmed = await showCustomModal({
                            title: 'Proxy Conflict',
                            bodyHTML: bodyHtml,
                            buttons: [
                                { text: 'Cancel', class: 'btn-secondary', resolves: false },
                                { text: 'Continue', class: 'btn-primary', resolves: true }
                            ]
                        });

                        if (!userConfirmed) return;

                        const headers = { 'Content-Type': 'application/json' };
                        if (proxies.SOCKS4) await fetch('/api/active-proxies', { method: 'POST', headers, body: JSON.stringify({ type: 'SOCKS4', name: proxies.SOCKS4 }) });
                        if (proxies.SOCKS5) await fetch('/api/active-proxies', { method: 'POST', headers, body: JSON.stringify({ type: 'SOCKS5', name: proxies.SOCKS5 }) });
                        
                        logToConsole({type: 'info', message: 'Proxies automatically disabled for Velocity mode.'});

                    } else if (isLowDelay) {
                        const userConfirmed = await showCustomModal({
                            title: 'Low Delay Warning',
                            bodyHTML: `<p>You are using Velocity mode (Direct Connection).</p>
                                       <p style="margin-top: 10px; color: var(--error-color);"><b>Warning:</b> Your delay (${delayVal}ms) is below 4000ms.<br> Since you are connecting without proxies, the default <b>Connection Throttle</b> will likely block bots joining faster than every 4 seconds.</p>
                                       <p><br>Do you want to proceed anyway?</p>`,
                            buttons: [
                                { text: 'Cancel', class: 'btn-secondary', resolves: false },
                                { text: 'Start', class: 'btn-primary', resolves: true }
                            ]
                        });

                        if (!userConfirmed) return;
                    }

                } catch (e) {
                    console.error("Failed to check settings:", e);
                }
            }

            socket.send(JSON.stringify({ type: 'start_attack', params: params }));
        } else {
            socket.send(JSON.stringify({ type: 'stop_attack' }));
            createdBotsCount = 0;
            joinedBotsCount = 0;
            crashingBotsCount = 0;
            if (botsChart) botsChart.update();
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
        const typeSelect = document.getElementById(`${type}-type`); 
        const contentLabel = document.getElementById(`${type}-content-label`);
        
        const triggerInput = document.getElementById('multi-actions-trigger');

        if (type === 'nicks' && typeSelect && contentLabel && contentTextarea) {
            const updateNickEditorUI = () => {
                if (typeSelect.value === 'generator') {
                    contentLabel.textContent = 'Base Nickname (max 12 chars)';
                    contentTextarea.setAttribute('maxlength', '12');
                    contentTextarea.classList.add('textarea-as-input');
                    contentTextarea.rows = 1;
                    contentTextarea.value = contentTextarea.value.split('\n')[0].slice(0, 12);
                } else {
                    contentLabel.textContent = 'Content (one nickname per line)';
                    contentTextarea.removeAttribute('maxlength');
                    contentTextarea.classList.remove('textarea-as-input');
                    contentTextarea.rows = 10;
                }
            };
            typeSelect.addEventListener('change', updateNickEditorUI);
            contentTextarea.addEventListener('keydown', (e) => {
                if (typeSelect.value === 'generator' && e.key === 'Enter') {
                    e.preventDefault();
                }
            });
            contentTextarea.addEventListener('input', () => {
                if (typeSelect.value === 'generator') {
                    contentTextarea.value = contentTextarea.value.replace(/[\r\n]/g, '');
                }
            });
        }

        const renderList = async () => {
            try {
                const promises = [fetch(`/api/${type}`)];
                
                if (type === 'proxy' || type === 'listeners' || type === 'multi-actions') {
                    promises.push(fetch(type === 'proxy' ? '/api/active-proxies' : `/api/active-${type}`));
                }

                const responses = await Promise.all(promises);
                if (!responses[0].ok) throw new Error(`HTTP error! status: ${responses[0].status}`);
                
                const items = await responses[0].json();
                let activeData = null;
                if (responses.length > 1) {
                    activeData = await responses[1].json();
                }

                listEl.innerHTML = '';
                if (items.length === 0) {
                    listEl.innerHTML = `<li>No saved lists.</li>`;
                    if (type === 'nicks' || type === 'actions') updateDropdowns(type, []);
                    return;
                }

                items.forEach(item => {
                    const itemName = (typeof item === 'object') ? item.name : item;
                    const itemType = (typeof item === 'object' && item.type) ? item.type : null;

                    const li = document.createElement('li');
                    li.dataset.name = itemName; 
                    li.style.cursor = 'pointer';

                    let mainContentHTML = '';
                    
                    if (type === 'proxy' && itemType) {
                        const isActive = (itemType === 'SOCKS4' && activeData.SOCKS4 === itemName) || (itemType === 'SOCKS5' && activeData.SOCKS5 === itemName);
                        mainContentHTML = `
                            <div class="proxy-info">
                                <div class="use-proxy-btn ${isActive ? 'active' : ''}"></div>
                                <span>${itemName}</span>
                                <span class="proxy-type-badge">${itemType}</span>
                            </div>
                        `;
                    } else if (type === 'listeners' || type === 'multi-actions') {
                        const isActive = Array.isArray(activeData) && activeData.includes(itemName);
                        mainContentHTML = `
                            <div class="item-name-wrapper">
                                <div class="status-toggle-btn ${isActive ? 'active' : ''}" title="Toggle Active"></div>
                                <span>${itemName}</span>
                            </div>
                        `;
                    } else if (type === 'nicks' && itemType) {
                        mainContentHTML = `
                            <div class="nick-info">
                                <span>${itemName}</span>
                                <span class="proxy-type-badge">${itemType}</span>
                            </div>
                        `;
                    } else {
                        mainContentHTML = `<span>${itemName}</span>`;
                    }

                    li.innerHTML = `
                        ${mainContentHTML}
                        <div class="list-item-controls">
                            <button class="rename-btn" title="Rename"><span class="material-symbols-outlined">edit</span></button>
                            <button class="delete-btn" title="Delete"><span class="material-symbols-outlined">delete</span></button>
                        </div>
                    `;

                    li.addEventListener('click', async (e) => {
                        const target = e.target;
                        const itemNameFromDataset = li.dataset.name;

                        if (target.closest('.use-proxy-btn')) {
                            try {
                                await fetch('/api/active-proxies', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ type: itemType, name: itemNameFromDataset })
                                });
                                renderList();
                            } catch (error) { console.error(error); }
                            return;
                        }

                        if (target.closest('.status-toggle-btn')) {
                            e.stopPropagation();
                            const currentlyActive = target.closest('.status-toggle-btn').classList.contains('active');
                            try {
                                await fetch(`/api/active-${type}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ name: itemNameFromDataset, enabled: !currentlyActive })
                                });
                                renderList();
                            } catch (error) { console.error(error); }
                            return;
                        }

                        if (target.closest('.rename-btn')) {
                            const newName = await customPrompt(`Enter a new name for "${itemNameFromDataset}":`, itemNameFromDataset);
                            if (newName && newName.trim() && newName !== itemNameFromDataset) {
                                try {
                                    await fetch(`/api/${type}/${encodeURIComponent(itemNameFromDataset)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newName: newName.trim() }) });
                                    if (currentEditingName === itemNameFromDataset) hideEditor();
                                    renderList();
                                } catch (error) { await customAlert(`Error: ${error.message}`); }
                            }
                            return; 
                        }

                        if (target.closest('.delete-btn')) {
                            if (await customConfirm(`Delete <b>"${itemNameFromDataset}"</b>?`)) {
                                await fetch(`/api/${type}/${encodeURIComponent(itemNameFromDataset)}`, { method: 'DELETE' });
                                if (currentEditingName === itemNameFromDataset) hideEditor();
                                renderList();
                            }
                            return; 
                        }
                        
                        editItem(itemNameFromDataset);
                    });

                    listEl.appendChild(li);
                });
                
                if (type === 'nicks' || type === 'actions') {
                    const itemNames = items.map(item => (typeof item === 'object' ? item.name : item));
                    updateDropdowns(type, itemNames);
                }
            } catch (error) {
                console.error(`Critical error in renderList for type ${type}:`, error);
                listEl.innerHTML = `<li>Error loading list.</li>`;
            }
        };
        
        const showEditor = () => editorContainer.classList.remove('hidden');
        const hideEditor = () => {
            editorContainer.classList.add('hidden');
            nameInput.value = '';
            contentTextarea.value = '';
            if (type === 'proxy' && typeSelect) typeSelect.value = 'SOCKS5';
            if (type === 'nicks' && typeSelect) {
                typeSelect.value = 'list';
                typeSelect.dispatchEvent(new Event('change'));
            }
            if (type === 'multi-actions' && triggerInput) triggerInput.value = '';
            
            currentEditingName = null;
            currentEditingTimestamp = null;
            nameInput.disabled = false;
            saveBtn.disabled = false;
            listEl.querySelectorAll('li.selected').forEach(li => li.classList.remove('selected'));
        };

        const editItem = async (name) => {
            try {
                const response = await fetch(`/api/${type}/${encodeURIComponent(name)}`);
                if (!response.ok) throw new Error('File not found');
                const data = await response.json();

                currentEditingName = name;
                currentEditingTimestamp = data.lastModified;
                nameInput.value = name;
                nameInput.disabled = true;
                contentTextarea.value = data.content;
                
                if (type === 'proxy' && typeSelect && data.type) typeSelect.value = data.type;
                if (type === 'nicks' && typeSelect) {
                    typeSelect.value = data.nickType || 'list';
                    typeSelect.dispatchEvent(new Event('change'));
                }
                if (type === 'multi-actions' && triggerInput) {
                    triggerInput.value = data.trigger || '';
                }

                saveBtn.disabled = false;
                showEditor();
                nameInput.focus();
                listEl.querySelectorAll('li').forEach(li => { li.classList.toggle('selected', li.dataset.name === name) });
            } catch (err) {
                await customAlert("Could not load file. It might have been deleted.", "Loading Error");
                hideEditor();
                renderList();
            }
        };

        document.getElementById(`${type}-add-new`).addEventListener('click', () => { 
            hideEditor(); 
            currentEditingName = null; 
            currentEditingTimestamp = null; 
            nameInput.value = ''; 
            contentTextarea.value = ''; 
            nameInput.disabled = false; 
            saveBtn.disabled = false; 
            if (typeSelect) { 
                if (type === 'proxy') typeSelect.value = 'SOCKS5'; 
                if (type === 'nicks') { typeSelect.value = 'list'; typeSelect.dispatchEvent(new Event('change')); }
            } 
            if (type === 'multi-actions' && triggerInput) triggerInput.value = '';
            showEditor(); 
            nameInput.focus(); 
        });
        
        document.getElementById(`${type}-cancel`).addEventListener('click', hideEditor);
        
        saveBtn.addEventListener('click', async () => { 
            const name = nameInput.value.trim(); 
            const content = contentTextarea.value; 
            if (!name) { 
                await customAlert('Name cannot be empty!'); 
                return; 
            } 
            saveBtn.disabled = true; 
            const payload = { name, content, lastModified: currentEditingTimestamp }; 
            
            if (type === 'proxy' && typeSelect) payload.type = typeSelect.value;
            if (type === 'nicks' && typeSelect) payload.nickType = typeSelect.value;
            if (type === 'multi-actions' && triggerInput) payload.trigger = triggerInput.value;

            try { 
                const response = await fetch(`/api/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); 
                if (response.status === 409) { 
                    await customAlert('Save failed! This file was modified by another user.', 'Conflict'); 
                    return; 
                } 
                if (!response.ok) {
                     const errorText = await response.text();
                     throw new Error(errorText || 'Server responded with an error');
                }
                hideEditor(); 
                renderList();
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
    const asciiEditor = setupListEditor('ascii');
    const multiActionsEditor = setupListEditor('multi-actions');

    async function renderAll() {
        await Promise.all([
            nicksEditor.renderList(),
            actionsEditor.renderList(),
            listenersEditor.renderList(),
            proxyEditor.renderList(),
            asciiEditor.renderList(),
            multiActionsEditor.renderList(),
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
    const setupToggleGroup = (onBtnId, offBtnId, initialState, callback) => {
        const onBtn = document.getElementById(onBtnId);
        const offBtn = document.getElementById(offBtnId);
        
        if (!onBtn || !offBtn) return;

        const updateVisuals = (isActive) => {
            if (isActive) {
                onBtn.classList.add('active');
                offBtn.classList.remove('active');
            } else {
                offBtn.classList.add('active');
                onBtn.classList.remove('active');
            }
        };

        updateVisuals(initialState);

        onBtn.addEventListener('click', () => {
            updateVisuals(true);
            callback(true);
        });

        offBtn.addEventListener('click', () => {
            updateVisuals(false);
            callback(false);
        });
    };

    const advOpenBtn = document.getElementById('adv-settings-open-btn');
    const advModal = document.getElementById('adv-settings-modal');
    const advCloseBtn = document.getElementById('adv-settings-close-btn');
    const vpSlider = document.getElementById('viaproxy-slider');
    const vpText = document.getElementById('viaproxy-version-text');
    const vpContainer = document.getElementById('viaproxy-slider-container');
    const vpStopBtn = document.getElementById('viaproxy-stop-btn');

    const maxIndex = viaProxyVersions.length - 1;
    vpSlider.max = maxIndex;
    
    let currentIndex = viaProxyVersions.indexOf(viaProxySelectedVersion);
    if (currentIndex === -1) currentIndex = 0;
    vpSlider.value = maxIndex - currentIndex;
    vpText.textContent = viaProxyVersions[currentIndex];

    const updateVpUI = (isEnabled) => {
        if (isEnabled) {
            vpContainer.style.opacity = '1';
            vpContainer.style.pointerEvents = 'auto';
        } else {
            vpContainer.style.opacity = '0.5';
            vpContainer.style.pointerEvents = 'none';
        }
    };
    updateVpUI(viaProxyEnabled);

    setupToggleGroup('viaproxy-on-btn', 'viaproxy-off-btn', viaProxyEnabled, (isEnabled) => {
        viaProxyEnabled = isEnabled;
        localStorage.setItem('viaProxyEnabled', isEnabled);
        updateVpUI(isEnabled);
    });

    vpSlider.addEventListener('input', (e) => {
        const sliderValue = parseInt(e.target.value, 10);
        
        const actualIndex = maxIndex - sliderValue;
        
        viaProxySelectedVersion = viaProxyVersions[actualIndex];
        vpText.textContent = viaProxySelectedVersion;
        localStorage.setItem('viaProxySelectedVersion', viaProxySelectedVersion);
    });

    advOpenBtn.addEventListener('click', () => {
        settingsModal.classList.remove('modal-open');
        settingsModal.style.display = 'none';
        advModal.classList.add('modal-open');
        advModal.style.display = 'flex';
    });
    advCloseBtn.addEventListener('click', () => {
        advModal.classList.remove('modal-open');
        advModal.style.display = 'none';
    });
    
    if (vpStopBtn) {
        vpStopBtn.addEventListener('click', () => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'stop_attack' }));
            }
            document.getElementById('viaproxy-console-modal').classList.remove('modal-open');
            document.getElementById('viaproxy-console-modal').style.display = 'none';
        });
    }

    const openModalBtn = document.getElementById('open-actions-modal-btn');
    const actionsModal = document.getElementById('actions-modal');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const actionsListContainer = document.getElementById('modal-actions-list');

    const COMMANDS = [
        { command: 'CHAT_MESSAGE', description: 'Sends a message or command via bots.', requiresInput: true, inputPrompt: 'Enter the message to send:' },
        { command: 'Velocity', description: 'Opens the console of the temporary velocity server.' },
        { command: '!list', description: 'Shows the list of connected bots.' },
        { command: '!crash', description: 'Starts crashing the server with all bots.' },
        { command: '!dropall', description: 'All bots drop items from their hotbar.' },
        { command: '!swap', description: 'Enables/Disables automatic sector switching.' },
        { command: '!headroll on', description: 'Enables head rolling for all bots.' },
        { command: '!headroll off', description: 'Disables head rolling for all bots.' },
        { command: '!ascii', description: 'Sends a selected ASCII art file.' },
        { command: '!channel', description: 'Changes the sector for all bots.', requiresInput: true, inputPrompt: 'Enter sector number:' },
        { command: '!channel auto', description: 'Distributes bots evenly across sectors.', requiresInput: true, inputPrompt: 'Enter the number of sectors to divide among:' },
        { command: '!bot', description: 'Executes a command for a specific bot.', requiresInput: true, inputPrompt: "Enter bot ID and command (e.g., '1 crash' or '3 headroll on'):" },
        { command: '!autocrash', description: 'Start crashing indefinitely until the server shuts down.'},
    ];

    function sendCommand(commandString) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'send_command', command: commandString }));
        } else {
            logToConsole({ type: 'error', message: 'No connection to the server.' });
        }
    }
    function initCaptchaSystem() {
        const btnManual = document.getElementById('btn-mode-manual');
        const btnApi = document.getElementById('btn-mode-api');
        
        const apiModal = document.getElementById('api-key-modal');
        const apiKeyInput = document.getElementById('api-key-input');
        const apiKeySave = document.getElementById('api-key-save');
        const apiKeyCancel = document.getElementById('api-key-cancel');
        const apiKeyError = document.getElementById('api-key-error');

        const solveModal = document.getElementById('captcha-solve-modal');
        const solveImg = document.getElementById('captcha-img-display');
        const solveInput = document.getElementById('captcha-input-code');
        const solveSubmit = document.getElementById('captcha-submit-btn');

        let currentMode = localStorage.getItem('captchaMode') || 'manual';

        const updateModeUI = () => {
            if (currentMode === 'api') {
                btnApi.classList.add('active');
                btnManual.classList.remove('active');
            } else {
                btnManual.classList.add('active');
                btnApi.classList.remove('active');
            }
        };
        updateModeUI();

        btnManual.addEventListener('click', () => {
            currentMode = 'manual';
            localStorage.setItem('captchaMode', 'manual');
            updateModeUI();
        });

        const solveClose = document.getElementById('captcha-close-btn');
        if (solveClose) {
            solveClose.addEventListener('click', async () => {
                solveModal.classList.remove('modal-open');
                solveModal.style.display = 'none';
                
                solveInput.value = '';

                try {
                    await fetch('/api/captcha-answer', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: 'CANCELLED' })
                    });
                } catch (e) {
                    console.error(e);
                }
            });
        }
        btnApi.addEventListener('click', async () => {
            console.log("Kliknięto przycisk API!");

            try {
                const res = await fetch('/api/has-api-key');
                if (!res.ok) {
                    console.error("Błąd serwera:", res.status);
                    return;
                }
                const data = await res.json();
                console.log("Status klucza:", data);

                if (data.hasKey) {
                    currentMode = 'api';
                    localStorage.setItem('captchaMode', 'api');
                    updateModeUI();
                } else {
                    console.log("Brak klucza - otwieram modal");
                    apiModal.classList.add('modal-open');
                    apiModal.style.display = 'flex';
                    apiKeyInput.focus();
                }
            } catch (e) { 
                console.error("Błąd JS:", e); 
            }
        });

        apiKeySave.addEventListener('click', async () => {
            const key = apiKeyInput.value.trim();
            if (!key) return;

            apiKeySave.textContent = 'Verifying...';
            apiKeySave.disabled = true;
            apiKeyError.style.display = 'none';

            try {
                const res = await fetch('/api/save-api-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: key })
                });
                const data = await res.json();

                if (data.success) {
                    currentMode = 'api';
                    localStorage.setItem('captchaMode', 'api');
                    updateModeUI();
                    apiModal.classList.remove('modal-open');
                    apiModal.style.display = 'none';
                } else {
                    apiKeyError.textContent = 'Invalid API Key. Please check and try again.';
                    apiKeyError.style.display = 'block';
                }
            } catch (e) {
                apiKeyError.textContent = 'Error connecting to server.';
                apiKeyError.style.display = 'block';
            } finally {
                apiKeySave.textContent = 'Verify & Save';
                apiKeySave.disabled = false;
            }
        });

        apiKeyCancel.addEventListener('click', () => {
            apiModal.classList.remove('modal-open');
            apiModal.style.display = 'none';
        });

        solveSubmit.addEventListener('click', async () => {
            const code = solveInput.value.trim();
            if (!code) return;

            await fetch('/api/captcha-answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            
            solveModal.classList.remove('modal-open');
            solveModal.style.display = 'none';
            solveInput.value = '';
        });

        solveInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') solveSubmit.click();
        });
    }

    function populateActionsModal() {
        actionsListContainer.innerHTML = '';
        COMMANDS.forEach(cmd => {
            if (cmd.command === 'Velocity' && !isAttackRunning) {
                return;
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'command-button-wrapper';

            const button = document.createElement('button');
            button.className = 'btn btn-secondary';
            button.textContent = cmd.command === 'CHAT_MESSAGE' ? 'Chat' : (cmd.command === 'VELOCITY' ? 'Velocity' : cmd.command);

            const description = document.createElement('p');
            description.className = 'command-description';
            description.textContent = cmd.description;

            button.addEventListener('click', async () => {
                if (cmd.command === 'Velocity') {
                    const velModal = document.getElementById('velocity-modal');
                    const stopBtn = document.getElementById('velocity-stop-btn');
                    const title = document.getElementById('velocity-modal-title');
                    const spinner = document.getElementById('velocity-spinner');
                    
                    title.textContent = 'Velocity Console';
                    spinner.style.display = 'none';

                    stopBtn.textContent = 'Close';
                    stopBtn.dataset.mode = 'close';
                    stopBtn.classList.remove('btn-danger');
                    stopBtn.classList.add('btn-secondary');

                    velModal.classList.add('modal-open');
                    velModal.style.display = 'flex';
                    
                    actionsModal.classList.remove('modal-open');
                    actionsModal.style.display = 'none';
                    return;
                }

                let fullCommand = null;

                if (cmd.command === '!autocrash') {
                    if (autoCrashInterval) {
                        clearInterval(autoCrashInterval);
                        autoCrashInterval = null;
                    } else {
                        sendCommand('!crash');
                        autoCrashInterval = setInterval(() => {
                            if (!socket || socket.readyState !== WebSocket.OPEN) {
                                clearInterval(autoCrashInterval);
                                autoCrashInterval = null;
                                return;
                            }
                            sendCommand('!crash');
                        }, 3000);
                    }
                    actionsModal.classList.remove('modal-open');
                    actionsModal.style.display = 'none';
                    return;
                }

                if (cmd.command === 'CHAT_MESSAGE') {
                    const userInput = await customPrompt(cmd.inputPrompt, '', 'Send a message');
                    if (userInput === null || userInput.trim() === '') return;
                    fullCommand = userInput;
                } else if (cmd.command === '!ascii') {
                    try {
                        const response = await fetch('/api/ascii');
                        if (!response.ok) throw new Error('Could not fetch ASCII art list.');
                        const asciiFiles = await response.json();
                        if (asciiFiles.length === 0) {
                            customAlert('No ASCII art files found.', 'Info');
                            return;
                        }
                        let optionsHTML = '';
                        asciiFiles.forEach(file => { optionsHTML += `<option value="${file}">${file}</option>`; });
                        const modalResult = await showCustomModal({
                            title: 'Select ASCII Art',
                            bodyHTML: `<p>Choose an ASCII art file to send:</p><select id="ascii-select-modal" style="width: 100%; margin-top: 10px; padding: 10px;">${optionsHTML}</select>`,
                            buttons: [{ text: 'Cancel', class: 'btn-secondary', resolves: false }, { text: 'Send', class: 'btn-primary', resolves: true }]
                        });
                        if (modalResult) {
                            const selectedFileName = document.getElementById('ascii-select-modal').value;
                            fullCommand = `!ascii data/ascii/${selectedFileName}.txt`;
                        } else { return; }
                    } catch (error) { return; }
                } else {
                    fullCommand = cmd.command;
                    if (cmd.requiresInput) {
                        const userInput = await customPrompt(cmd.inputPrompt, '', 'Command Input');
                        if (userInput === null) return;
                        fullCommand += ` ${userInput}`;
                    }
                }
                
                if (fullCommand !== null) {
                    sendCommand(fullCommand.trim());
                    actionsModal.classList.remove('modal-open');
                    actionsModal.style.display = 'none';
                }
            });

            wrapper.appendChild(button);
            wrapper.appendChild(description);
            actionsListContainer.appendChild(wrapper);
        });
    }

    openModalBtn.addEventListener('click', () => { 
        populateActionsModal();
        actionsModal.classList.add('modal-open');
        actionsModal.style.display = 'flex'; 
    });

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
        updateChartTheme();
    };

    const savedTheme = localStorage.getItem('theme') || 'light';
    const isDarkInitial = savedTheme === 'dark';
    
    setTheme(savedTheme);

    setupToggleGroup('dm-on-btn', 'dm-off-btn', isDarkInitial, (isDark) => {
        setTheme(isDark ? 'dark' : 'light');
    });

    setupToggleGroup('notif-on-btn', 'notif-off-btn', notificationsEnabled, (isEnabled) => {
        notificationsEnabled = isEnabled;
        localStorage.setItem('notificationsEnabled', notificationsEnabled);
    });
    let serverCheckMethod = localStorage.getItem('serverCheckMethod') || 'mcsrv';

    const setCheckMethodUI = (val) => {
        const radio = document.querySelector(`input[name="server-check"][value="${val}"]`);
        if (radio) radio.checked = true;
    };
    
    setCheckMethodUI(serverCheckMethod);

    document.querySelectorAll('input[name="server-check"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            serverCheckMethod = e.target.value;
            localStorage.setItem('serverCheckMethod', serverCheckMethod);
        });
    });

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
    
    let autoReconnectEnabled = localStorage.getItem('autoReconnectEnabled') === 'true';
    let autoReconnectDelay = localStorage.getItem('autoReconnectDelay') || '5000';
    
    const reconnectSliderContainer = document.getElementById('reconnect-slider-container');
    const reconnectSlider = document.getElementById('reconnect-slider');
    const reconnectValueText = document.getElementById('reconnect-value-text');

    const updateReconnectUI = (isEnabled) => {
        if (isEnabled) {
            reconnectSliderContainer.classList.add('active');
        } else {
            reconnectSliderContainer.classList.remove('active');
        }
    };

    reconnectSlider.value = autoReconnectDelay;
    reconnectValueText.textContent = `${autoReconnectDelay}ms`;
    updateReconnectUI(autoReconnectEnabled);

    setupToggleGroup('reconnect-on-btn', 'reconnect-off-btn', autoReconnectEnabled, (isEnabled) => {
        autoReconnectEnabled = isEnabled;
        localStorage.setItem('autoReconnectEnabled', isEnabled);
        updateReconnectUI(isEnabled);
    });

    reconnectSlider.addEventListener('input', (e) => {
        autoReconnectDelay = e.target.value;
        reconnectValueText.textContent = `${autoReconnectDelay}ms`;
        localStorage.setItem('autoReconnectDelay', autoReconnectDelay);
    });

    renderAll();
    setTheme(savedTheme);
    initializeChart();
    initializeStatsCharts();
    initCaptchaSystem();

    function initializeStatsCharts() {
        const textCenterPlugin = {
            id: 'textCenter',
            afterDraw(chart) {
                const { ctx } = chart;
                ctx.save();
                const value = chart.data.datasets[0].data[0];
                const text = `${value}%`;
                
                const x = chart.getDatasetMeta(0).data[0].x;
                const y = chart.getDatasetMeta(0).data[0].y;
                
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 24px sans-serif';
                ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-color-muted');
                ctx.fillText(text, x, y);
                ctx.restore();
            }
        };

        const createDoughnutConfig = (colors, borderColor) => ({
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [0, 100],
                    backgroundColor: colors,
                    borderColor: borderColor,
                    borderWidth: 4,
                    circumference: 360,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                animation: {
                    duration: 1000,
                    easing: 'easeOutCubic',
                    animateScale: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false },
                    textCenter: {}
                }
            },
            plugins: [textCenterPlugin]
        });
        function updateChartColors() {
            const colors = getThemeColors();

            if (cpuChart) {
                cpuChart.data.datasets[0].backgroundColor = [colors.cpuColor, colors.chartBackground];
                cpuChart.data.datasets[0].borderColor = colors.chartBorder;
                cpuChart.update('none');
            }
            if (ramChart) {
                ramChart.data.datasets[0].backgroundColor = [colors.ramColor, colors.chartBackground];
                ramChart.data.datasets[0].borderColor = colors.chartBorder;
                ramChart.update('none');
            }
        }
        function initializeCharts() {
            const initialColors = getThemeColors();

            const cpuCtx = document.getElementById('cpu-chart')?.getContext('2d');
            if (cpuCtx) {
                const cpuChartColors = [initialColors.cpuColor, initialColors.chartBackground];
                cpuChart = new Chart(cpuCtx, createDoughnutConfig(cpuChartColors, initialColors.chartBorder));
            }

            const ramCtx = document.getElementById('ram-chart')?.getContext('2d');
            if (ramCtx) {
                const ramChartColors = [initialColors.ramColor, initialColors.chartBackground];
                ramChart = new Chart(ramCtx, createDoughnutConfig(ramChartColors, initialColors.chartBorder));
            }
        }
        initializeCharts();
        const themeObserver = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    updateChartColors();
                    break;
                }
            }
        });
        themeObserver.observe(document.documentElement, { attributes: true });
    };
});