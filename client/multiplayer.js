/**
 * Client-side multiplayer functionality
 * Handles Socket.IO connection and multiplayer features
 */
import { io } from 'socket.io-client';
import { gameState } from './state/gameState.js';
import { ErrorLogger, NetworkError } from './utils/errors.js';

class MultiplayerClient {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.playerId = null;
        this.playerName = null;
        this.currentLobby = null;
        this.isInGame = false;
        this.otherPlayers = new Map(); // playerId -> playerData
        
        // Load saved player ID from localStorage
        this.playerId = localStorage.getItem('multiplayer_player_id') || null;
        this.playerName = localStorage.getItem('multiplayer_player_name') || 'Anonymous';
    }

    /**
     * Connects to the multiplayer server
     */
    async connect() {
        try {
            console.log('[Multiplayer] Connecting to server...');
            
            // Browser-safe check for environment variables
            const serverUrl = (typeof process !== 'undefined' && process.env && process.env.SERVER_URL) || 'http://localhost:3001';
            this.socket = io(serverUrl, {
                autoConnect: false,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });

            // Set up event listeners
            this.setupEventListeners();

            // Connect to server
            this.socket.connect();

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new NetworkError('Connection timeout'));
                }, 10000);

                this.socket.once('connect', () => {
                    clearTimeout(timeout);
                    console.log('[Multiplayer] Connected to server');
                    this.authenticatePlayer();
                    resolve(true);
                });

                this.socket.once('connect_error', (error) => {
                    clearTimeout(timeout);
                    console.error('[Multiplayer] Connection error:', error);
                    reject(new NetworkError(`Connection failed: ${error.message}`));
                });
            });

        } catch (error) {
            ErrorLogger.log(new NetworkError(`Failed to connect: ${error.message}`));
            throw error;
        }
    }

    /**
     * Authenticates the player with the server
     */
    authenticatePlayer() {
        console.log('[Multiplayer] Authenticating player...');
        
        this.socket.emit('player:connect', {
            playerId: this.playerId,
            playerName: this.playerName
        });
    }

    /**
     * Sets up Socket.IO event listeners
     */
    setupEventListeners() {
        // Connection events
        this.socket.on('connect', () => {
            this.isConnected = true;
            console.log('[Multiplayer] Socket connected');
            this.showConnectionStatus('Connected to server', 'success');
        });

        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            console.warn('[Multiplayer] Socket disconnected:', reason);
            this.showConnectionStatus('Disconnected from server', 'warning');
        });

        this.socket.on('reconnect', () => {
            console.log('[Multiplayer] Reconnected to server');
            this.showConnectionStatus('Reconnected to server', 'success');
        });

        // Player authentication
        this.socket.on('player:connected', (data) => {
            if (data.success) {
                this.playerId = data.uuid; // This is their persistent UUID
                this.playerName = data.player.name;
                
                // Save to localStorage for persistence
                localStorage.setItem('multiplayer_player_id', this.playerId);
                localStorage.setItem('multiplayer_player_name', this.playerName);
                
                console.log(`[Multiplayer] Authenticated as ${this.playerName} (${this.playerId})`);
                this.showConnectionStatus(`Welcome back, ${this.playerName}!`, 'success');
                
                // Update game state with multiplayer inventory
                if (data.inventory) {
                    this.syncInventory(data.inventory);
                }
                
                // Show lobby browser
                this.showLobbyBrowser();
                
            } else {
                console.error('[Multiplayer] Authentication failed:', data.error);
                this.showConnectionStatus(`Authentication failed: ${data.error}`, 'error');
            }
        });

        // Lobby events
        this.socket.on('lobby:list', (data) => {
            if (data.success) {
                this.updateLobbyList(data.lobbies);
            }
        });

        this.socket.on('lobby:created', (data) => {
            if (data.success) {
                this.currentLobby = data.lobby;
                this.showLobbyRoom(data.lobby);
                console.log('[Multiplayer] Lobby created:', data.lobby.name);
            } else {
                this.showMessage(`Failed to create lobby: ${data.error}`, 'error');
            }
        });

        this.socket.on('lobby:joined', (data) => {
            if (data.success) {
                this.currentLobby = data.lobby;
                this.showLobbyRoom(data.lobby);
                console.log('[Multiplayer] Joined lobby:', data.lobby.name);
            } else {
                this.showMessage(`Failed to join lobby: ${data.error}`, 'error');
            }
        });

        this.socket.on('lobby:left', (data) => {
            if (data.success) {
                this.currentLobby = null;
                this.showLobbyBrowser();
                console.log('[Multiplayer] Left lobby');
            }
        });

        this.socket.on('lobby:player_joined', (data) => {
            if (this.currentLobby) {
                console.log(`[Multiplayer] Player ${data.player.name} joined the lobby`);
                this.showMessage(`${data.player.name} joined the lobby`, 'info');
                this.updateLobbyRoom(data.lobby);
            }
        });

        this.socket.on('lobby:player_left', (data) => {
            if (this.currentLobby) {
                console.log(`[Multiplayer] Player left the lobby`);
                this.showMessage('A player left the lobby', 'info');
                this.updateLobbyRoom(data.lobby);
            }
        });

        this.socket.on('lobby:player_ready', (data) => {
            console.log(`[Multiplayer] Player ready status changed`);
            this.updatePlayerReadyStatus(data.playerId, data.ready);
        });

        this.socket.on('lobby:deleted', (data) => {
            console.log('[Multiplayer] Lobby was deleted:', data.reason);
            this.showMessage(`Lobby closed: ${data.reason}`, 'warning');
            this.currentLobby = null;
            this.showLobbyBrowser();
        });

        // Game events
        this.socket.on('game:starting', (data) => {
            console.log('[Multiplayer] Game starting with players:', data.players);
            this.startMultiplayerGame(data);
        });

        this.socket.on('game:player_moved', (data) => {
            this.handlePlayerMovement(data);
        });

        this.socket.on('game:player_action', (data) => {
            this.handlePlayerAction(data);
        });

        // Inventory events
        this.socket.on('inventory:data', (data) => {
            if (data.success) {
                this.syncInventory(data.inventory);
            }
        });

        this.socket.on('inventory:craft_result', (data) => {
            if (data.success) {
                this.showMessage(`Crafted: ${data.itemName}`, 'success');
                this.requestInventorySync();
            } else {
                this.showMessage(`Crafting failed: ${data.error}`, 'error');
            }
        });
    }

    /**
     * Lobby management
     */
    async createLobby(lobbyName, gameSettings = {}) {
        if (!this.isConnected) {
            throw new NetworkError('Not connected to server');
        }

        this.socket.emit('lobby:create', {
            lobbyName,
            gameSettings
        });
    }

    async joinLobby(lobbyId) {
        if (!this.isConnected) {
            throw new NetworkError('Not connected to server');
        }

        this.socket.emit('lobby:join', { lobbyId });
    }

    async leaveLobby() {
        if (!this.isConnected) {
            throw new NetworkError('Not connected to server');
        }

        this.socket.emit('lobby:leave');
    }

    async setReady(ready) {
        if (!this.isConnected || !this.currentLobby) {
            return;
        }

        this.socket.emit('lobby:ready', { ready });
    }

    async startGame() {
        if (!this.isConnected || !this.currentLobby) {
            return;
        }

        this.socket.emit('lobby:start_game');
    }

    refreshLobbyList() {
        if (!this.isConnected) return;
        this.socket.emit('lobby:list');
    }

    /**
     * Game synchronization
     */
    sendPositionUpdate(x, y) {
        if (!this.isConnected || !this.isInGame) return;

        this.socket.emit('game:position_update', { x, y });
    }

    sendAction(action, target = null, position = null) {
        if (!this.isConnected || !this.isInGame) return;

        this.socket.emit('game:action', {
            action,
            target,
            position
        });
    }

    /**
     * Inventory management
     */
    requestInventorySync() {
        if (!this.isConnected) return;

        this.socket.emit('inventory:sync');
    }

    craftItem(recipeId) {
        if (!this.isConnected) return;

        this.socket.emit('inventory:craft', { recipeId });
    }

    equipItem(itemId) {
        if (!this.isConnected) return;

        this.socket.emit('inventory:equip', { itemId });
    }

    /**
     * UI Management
     */
    showConnectionStatus(message, type = 'info') {
        // Create or update connection status element
        let statusEl = document.getElementById('multiplayer-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'multiplayer-status';
            statusEl.className = 'multiplayer-status';
            document.body.appendChild(statusEl);
        }

        statusEl.textContent = message;
        statusEl.className = `multiplayer-status ${type}`;

        // Auto-hide after 3 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                statusEl.style.opacity = '0';
            }, 3000);
        }
    }

    showMessage(message, type = 'info') {
        console.log(`[Multiplayer] ${message}`);
        
        // You can integrate this with your existing UI system
        if (typeof window.showMessage === 'function') {
            window.showMessage(message);
        }
    }

    showLobbyBrowser() {
        // Show lobby browser UI
        this.hideLobbyRoom();
        this.hideGameUI();
        
        const lobbyBrowser = document.getElementById('lobby-browser');
        if (lobbyBrowser) {
            lobbyBrowser.style.display = 'block';
            this.refreshLobbyList();
        }
    }

    showLobbyRoom(lobby) {
        // Show lobby room UI
        this.hideLobbyBrowser();
        this.hideGameUI();
        
        const lobbyRoom = document.getElementById('lobby-room');
        if (lobbyRoom) {
            lobbyRoom.style.display = 'block';
            this.updateLobbyRoom(lobby);
        }
    }

    hideLobbyBrowser() {
        const lobbyBrowser = document.getElementById('lobby-browser');
        if (lobbyBrowser) {
            lobbyBrowser.style.display = 'none';
        }
    }

    hideLobbyRoom() {
        const lobbyRoom = document.getElementById('lobby-room');
        if (lobbyRoom) {
            lobbyRoom.style.display = 'none';
        }
    }

    hideGameUI() {
        // Hide game canvas and UI when in lobby
        const gameCanvas = document.getElementById('gameCanvas');
        if (gameCanvas) {
            gameCanvas.style.display = 'none';
        }
    }

    showGameUI() {
        // Show game canvas and UI when starting game
        const gameCanvas = document.getElementById('gameCanvas');
        if (gameCanvas) {
            gameCanvas.style.display = 'block';
        }
        
        this.hideLobbyBrowser();
        this.hideLobbyRoom();
    }

    updateLobbyList(lobbies) {
        const lobbyList = document.getElementById('lobby-list');
        if (!lobbyList) return;

        lobbyList.innerHTML = '';

        if (lobbies.length === 0) {
            lobbyList.innerHTML = '<div class="no-lobbies">No active lobbies. Create one!</div>';
            return;
        }

        lobbies.forEach(lobby => {
            const lobbyEl = document.createElement('div');
            lobbyEl.className = 'lobby-item';
            lobbyEl.innerHTML = `
                <div class="lobby-name">${lobby.name}</div>
                <div class="lobby-players">${lobby.playerCount}/${lobby.maxPlayers}</div>
                <div class="lobby-status">${lobby.status}</div>
                <button ${lobby.canJoin ? '' : 'disabled'} onclick="multiplayerClient.joinLobby('${lobby.id}')">
                    ${lobby.canJoin ? 'Join' : 'Full'}
                </button>
            `;
            lobbyList.appendChild(lobbyEl);
        });
    }

    updateLobbyRoom(lobby) {
        this.currentLobby = lobby;
        
        // Update lobby info
        const lobbyInfo = document.getElementById('lobby-info');
        if (lobbyInfo) {
            lobbyInfo.innerHTML = `
                <h3>${lobby.name}</h3>
                <p>Players: ${lobby.playerCount}/${lobby.maxPlayers}</p>
                <p>Status: ${lobby.status}</p>
            `;
        }

        // Update player list
        const playerList = document.getElementById('lobby-player-list');
        if (playerList) {
            playerList.innerHTML = '';
            
            lobby.players.forEach(playerId => {
                const playerEl = document.createElement('div');
                playerEl.className = 'lobby-player';
                playerEl.innerHTML = `
                    <span class="player-name">Player ${playerId.substring(0, 8)}</span>
                    <span class="player-status">${playerId === lobby.host ? 'Host' : 'Player'}</span>
                `;
                playerList.appendChild(playerEl);
            });
        }

        // Update ready button
        const readyBtn = document.getElementById('lobby-ready-btn');
        if (readyBtn && lobby.status === 'waiting') {
            readyBtn.style.display = 'block';
        }

        // Update start game button (only for host)
        const startBtn = document.getElementById('lobby-start-btn');
        if (startBtn) {
            startBtn.style.display = (lobby.host === this.playerId && lobby.status === 'waiting') ? 'block' : 'none';
        }
    }

    updatePlayerReadyStatus(playerId, ready) {
        // Update UI to show player ready status
        console.log(`Player ${playerId} is ${ready ? 'ready' : 'not ready'}`);
    }

    /**
     * Game state management
     */
    startMultiplayerGame(gameData) {
        console.log('[Multiplayer] Starting multiplayer game with data:', gameData);
        
        this.isInGame = true;
        this.showGameUI();
        
        // Initialize other players
        gameData.players.forEach(player => {
            if (player.id !== this.playerId) {
                this.otherPlayers.set(player.id, player);
            }
        });
        
        // Start the actual game
        if (typeof window.startMultiplayerGame === 'function') {
            window.startMultiplayerGame(gameData);
        }
    }

    handlePlayerMovement(data) {
        const { playerId, position } = data;
        
        if (playerId === this.playerId) return; // Ignore own movements
        
        // Update other player position
        const player = this.otherPlayers.get(playerId);
        if (player) {
            player.position = position;
        }
        
        // Update game visuals
        if (typeof window.updatePlayerPosition === 'function') {
            window.updatePlayerPosition(playerId, position);
        }
    }

    handlePlayerAction(data) {
        const { playerId, action, target, position } = data;
        
        if (playerId === this.playerId) return; // Ignore own actions
        
        console.log(`[Multiplayer] Player ${playerId} performed action: ${action}`);
        
        // Handle different action types
        if (typeof window.handlePlayerAction === 'function') {
            window.handlePlayerAction(data);
        }
    }

    syncInventory(inventoryData) {
        console.log('[Multiplayer] Syncing inventory from server');
        
        // Update local inventory state
        if (typeof window.syncInventoryFromServer === 'function') {
            window.syncInventoryFromServer(inventoryData);
        }
    }

    /**
     * Disconnection
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.isConnected = false;
        this.playerId = null;
        this.currentLobby = null;
        this.isInGame = false;
        this.otherPlayers.clear();
        
        console.log('[Multiplayer] Disconnected from server');
    }
}

// Create global multiplayer client instance
const multiplayerClient = new MultiplayerClient();

// Make it available globally
window.multiplayerClient = multiplayerClient;

export default multiplayerClient;