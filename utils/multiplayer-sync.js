/**
 * Optimized multiplayer synchronization utilities
 */
export class StateManager {
    constructor(options = {}) {
        this.compressionEnabled = options.compressionEnabled !== false;
        this.deltaUpdatesEnabled = options.deltaUpdatesEnabled !== false;
        this.conflictResolution = options.conflictResolution || 'server-authoritative';
        this.maxDeltaHistory = options.maxDeltaHistory || 100;
        
        this.gameState = {};
        this.previousStates = [];
        this.lastUpdateTimestamp = 0;
        this.stateVersion = 0;
        this.pendingUpdates = new Map();
        this.clientStates = new Map(); // Track client state versions
    }

    updateState(playerId, updates, timestamp = Date.now()) {
        if (!this.validateUpdate(updates, timestamp)) {
            return { success: false, reason: 'Invalid update' };
        }

        const oldState = this.cloneState(this.gameState);
        const deltaUpdate = this.calculateDelta(oldState, updates);
        
        // Apply updates
        this.applyUpdates(updates);
        
        // Store state history for rollback if needed
        this.previousStates.push({
            state: oldState,
            timestamp: this.lastUpdateTimestamp,
            version: this.stateVersion
        });
        
        // Limit history size
        if (this.previousStates.length > this.maxDeltaHistory) {
            this.previousStates.shift();
        }
        
        this.lastUpdateTimestamp = timestamp;
        this.stateVersion++;
        
        // Update client state tracking
        this.clientStates.set(playerId, this.stateVersion);
        
        return {
            success: true,
            delta: deltaUpdate,
            version: this.stateVersion,
            timestamp
        };
    }

    validateUpdate(updates, timestamp) {
        // Basic validation
        if (!updates || typeof updates !== 'object') {
            return false;
        }
        
        // Timestamp validation (prevent old updates)
        if (timestamp < this.lastUpdateTimestamp - 5000) { // 5 second tolerance
            return false;
        }
        
        return true;
    }

    calculateDelta(oldState, newUpdates) {
        const delta = {};
        
        for (const [key, value] of Object.entries(newUpdates)) {
            if (this.isDifferent(oldState[key], value)) {
                delta[key] = {
                    old: oldState[key],
                    new: value,
                    type: this.getUpdateType(oldState[key], value)
                };
            }
        }
        
        return delta;
    }

    isDifferent(oldValue, newValue) {
        if (oldValue === newValue) return false;
        
        if (typeof oldValue === 'object' && typeof newValue === 'object') {
            return JSON.stringify(oldValue) !== JSON.stringify(newValue);
        }
        
        return true;
    }

    getUpdateType(oldValue, newValue) {
        if (oldValue === undefined) return 'create';
        if (newValue === undefined || newValue === null) return 'delete';
        return 'update';
    }

    applyUpdates(updates) {
        for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === undefined) {
                delete this.gameState[key];
            } else {
                this.gameState[key] = value;
            }
        }
    }

    getStateForClient(clientId) {
        const clientVersion = this.clientStates.get(clientId) || 0;
        
        if (this.deltaUpdatesEnabled && clientVersion > 0 && clientVersion < this.stateVersion) {
            // Send delta update
            const delta = this.getDeltaSinceVersion(clientVersion);
            return {
                type: 'delta',
                delta,
                fromVersion: clientVersion,
                toVersion: this.stateVersion,
                timestamp: this.lastUpdateTimestamp
            };
        } else {
            // Send full state
            return {
                type: 'full',
                state: this.cloneState(this.gameState),
                version: this.stateVersion,
                timestamp: this.lastUpdateTimestamp
            };
        }
    }

    getDeltaSinceVersion(fromVersion) {
        const delta = {};
        
        // Find relevant history entries
        const relevantHistory = this.previousStates.filter(
            entry => entry.version > fromVersion
        );
        
        // Aggregate changes
        for (const historyEntry of relevantHistory) {
            // This is simplified - in practice you'd track actual deltas
            Object.assign(delta, this.calculateDelta(historyEntry.state, this.gameState));
        }
        
        return delta;
    }

    cloneState(state) {
        return JSON.parse(JSON.stringify(state));
    }

    rollbackToVersion(version) {
        const historyEntry = this.previousStates.find(entry => entry.version === version);
        
        if (!historyEntry) {
            return { success: false, reason: 'Version not found in history' };
        }
        
        this.gameState = this.cloneState(historyEntry.state);
        this.stateVersion = historyEntry.version;
        this.lastUpdateTimestamp = historyEntry.timestamp;
        
        // Clear newer history
        this.previousStates = this.previousStates.filter(
            entry => entry.version <= version
        );
        
        return { success: true };
    }

    resolveConflict(clientUpdates, serverState) {
        switch (this.conflictResolution) {
            case 'server-authoritative':
                return serverState; // Server wins
                
            case 'client-authoritative':
                return clientUpdates; // Client wins
                
            case 'timestamp-based':
                return this.resolveByTimestamp(clientUpdates, serverState);
                
            case 'merge':
                return this.mergeUpdates(clientUpdates, serverState);
                
            default:
                return serverState;
        }
    }

    resolveByTimestamp(clientUpdates, serverState) {
        const resolved = {};
        
        for (const key in { ...clientUpdates, ...serverState }) {
            const clientUpdate = clientUpdates[key];
            const serverUpdate = serverState[key];
            
            if (!clientUpdate) {
                resolved[key] = serverUpdate;
            } else if (!serverUpdate) {
                resolved[key] = clientUpdate;
            } else {
                // Compare timestamps if available
                const clientTime = clientUpdate.timestamp || 0;
                const serverTime = serverUpdate.timestamp || 0;
                
                resolved[key] = clientTime > serverTime ? clientUpdate : serverUpdate;
            }
        }
        
        return resolved;
    }

    mergeUpdates(clientUpdates, serverState) {
        // Simple merge strategy - can be enhanced based on specific needs
        return { ...serverState, ...clientUpdates };
    }

    compress(data) {
        if (!this.compressionEnabled) return data;
        
        // Simple compression simulation - in practice use a real compression library
        const jsonString = JSON.stringify(data);
        
        // Simulate compression by removing whitespace and common patterns
        const compressed = jsonString
            .replace(/\s+/g, '')
            .replace(/"(\w+)":/g, '$1:')
            .replace(/":"/g, ':"');
        
        return {
            compressed: true,
            data: compressed,
            originalSize: jsonString.length,
            compressedSize: compressed.length
        };
    }

    decompress(compressedData) {
        if (!compressedData.compressed) return compressedData;
        
        // Simple decompression - reverse the compression process
        try {
            const decompressed = compressedData.data
                .replace(/(\w+):/g, '"$1":')
                .replace(/:"([^"]*?)"/g, ':"$1"');
            
            return JSON.parse(decompressed);
        } catch (error) {
            throw new Error('Failed to decompress data: ' + error.message);
        }
    }

    getStats() {
        return {
            stateVersion: this.stateVersion,
            lastUpdate: this.lastUpdateTimestamp,
            historySize: this.previousStates.length,
            stateSize: JSON.stringify(this.gameState).length,
            clientCount: this.clientStates.size,
            compressionEnabled: this.compressionEnabled,
            deltaUpdatesEnabled: this.deltaUpdatesEnabled
        };
    }

    cleanup(maxAge = 300000) { // 5 minutes default
        const cutoff = Date.now() - maxAge;
        
        // Clean old history
        this.previousStates = this.previousStates.filter(
            entry => entry.timestamp > cutoff
        );
        
        // Clean old pending updates
        for (const [key, update] of this.pendingUpdates) {
            if (update.timestamp < cutoff) {
                this.pendingUpdates.delete(key);
            }
        }
    }
}

export class NetworkOptimizer {
    constructor(options = {}) {
        this.batchingEnabled = options.batchingEnabled !== false;
        this.batchInterval = options.batchInterval || 50; // 50ms
        this.maxBatchSize = options.maxBatchSize || 10;
        this.priorityThreshold = options.priorityThreshold || 100; // bytes
        
        this.pendingMessages = [];
        this.batchTimer = null;
        this.messageQueue = new Map(); // priority -> messages[]
        this.bandwidthTracker = new BandwidthTracker();
        
        this.setupBatching();
    }

    setupBatching() {
        if (!this.batchingEnabled) return;
        
        this.batchTimer = setInterval(() => {
            this.processBatch();
        }, this.batchInterval);
    }

    sendMessage(message, priority = 'normal', immediate = false) {
        if (immediate || !this.batchingEnabled || this.isHighPriority(message)) {
            return this.sendImmediate(message);
        }
        
        this.addToBatch(message, priority);
    }

    isHighPriority(message) {
        const size = JSON.stringify(message).length;
        return size > this.priorityThreshold || 
               message.type === 'critical' ||
               message.urgent === true;
    }

    addToBatch(message, priority) {
        if (!this.messageQueue.has(priority)) {
            this.messageQueue.set(priority, []);
        }
        
        this.messageQueue.get(priority).push({
            message,
            timestamp: Date.now()
        });
        
        // If batch is full, process immediately
        const totalMessages = Array.from(this.messageQueue.values())
            .reduce((total, queue) => total + queue.length, 0);
            
        if (totalMessages >= this.maxBatchSize) {
            this.processBatch();
        }
    }

    processBatch() {
        if (this.messageQueue.size === 0) return;
        
        const batch = {
            type: 'batch',
            messages: [],
            timestamp: Date.now(),
            priorities: {}
        };
        
        // Process by priority (high -> normal -> low)
        const priorities = ['high', 'normal', 'low'];
        
        for (const priority of priorities) {
            const queue = this.messageQueue.get(priority);
            if (queue && queue.length > 0) {
                batch.priorities[priority] = queue.length;
                batch.messages.push(...queue.map(item => item.message));
                this.messageQueue.set(priority, []);
            }
        }
        
        if (batch.messages.length > 0) {
            this.sendImmediate(batch);
        }
    }

    sendImmediate(message) {
        const size = JSON.stringify(message).length;
        this.bandwidthTracker.recordSent(size);
        
        // In a real implementation, this would send via WebSocket
        return Promise.resolve({
            success: true,
            size,
            timestamp: Date.now()
        });
    }

    adaptToConnection(connectionQuality) {
        if (connectionQuality === 'poor') {
            this.batchInterval = 100; // Longer batching for poor connections
            this.maxBatchSize = 5; // Smaller batches
        } else if (connectionQuality === 'good') {
            this.batchInterval = 25; // Shorter batching for good connections
            this.maxBatchSize = 20; // Larger batches
        } else {
            this.batchInterval = 50; // Default
            this.maxBatchSize = 10;
        }
        
        // Restart batching with new settings
        this.stop();
        this.setupBatching();
    }

    getStats() {
        const queueSizes = {};
        for (const [priority, queue] of this.messageQueue) {
            queueSizes[priority] = queue.length;
        }
        
        return {
            batchingEnabled: this.batchingEnabled,
            batchInterval: this.batchInterval,
            maxBatchSize: this.maxBatchSize,
            queueSizes,
            bandwidth: this.bandwidthTracker.getStats()
        };
    }

    stop() {
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }
    }
}

export class BandwidthTracker {
    constructor(options = {}) {
        this.windowSize = options.windowSize || 10000; // 10 seconds
        this.samples = [];
        this.totalSent = 0;
        this.totalReceived = 0;
    }

    recordSent(bytes) {
        this.record('sent', bytes);
        this.totalSent += bytes;
    }

    recordReceived(bytes) {
        this.record('received', bytes);
        this.totalReceived += bytes;
    }

    record(type, bytes) {
        const now = Date.now();
        this.samples.push({ type, bytes, timestamp: now });
        
        // Remove old samples
        const cutoff = now - this.windowSize;
        this.samples = this.samples.filter(sample => sample.timestamp > cutoff);
    }

    getStats() {
        const now = Date.now();
        const windowStart = now - this.windowSize;
        
        const recentSamples = this.samples.filter(s => s.timestamp > windowStart);
        
        const sentBytes = recentSamples
            .filter(s => s.type === 'sent')
            .reduce((total, s) => total + s.bytes, 0);
            
        const receivedBytes = recentSamples
            .filter(s => s.type === 'received')
            .reduce((total, s) => total + s.bytes, 0);
        
        const windowSeconds = this.windowSize / 1000;
        
        return {
            sentBytesPerSecond: sentBytes / windowSeconds,
            receivedBytesPerSecond: receivedBytes / windowSeconds,
            totalSent: this.totalSent,
            totalReceived: this.totalReceived,
            efficiency: this.totalReceived > 0 ? this.totalSent / this.totalReceived : 0,
            sampleCount: recentSamples.length
        };
    }

    reset() {
        this.samples = [];
        this.totalSent = 0;
        this.totalReceived = 0;
    }
}

export class ConnectionManager {
    constructor(options = {}) {
        this.reconnectAttempts = options.reconnectAttempts || 5;
        this.reconnectDelay = options.reconnectDelay || 1000;
        this.maxReconnectDelay = options.maxReconnectDelay || 30000;
        this.heartbeatInterval = options.heartbeatInterval || 30000;
        
        this.isConnected = false;
        this.reconnectCount = 0;
        this.lastHeartbeat = null;
        this.heartbeatTimer = null;
        this.connectionQuality = 'unknown';
        this.latency = null;
        
        this.onReconnect = options.onReconnect || (() => {});
        this.onDisconnect = options.onDisconnect || (() => {});
        this.onConnectionQualityChange = options.onConnectionQualityChange || (() => {});
    }

    connect(socketFactory) {
        return new Promise((resolve, reject) => {
            try {
                this.socket = socketFactory();
                
                this.socket.on('connect', () => {
                    this.isConnected = true;
                    this.reconnectCount = 0;
                    this.startHeartbeat();
                    this.onReconnect();
                    resolve();
                });
                
                this.socket.on('disconnect', (reason) => {
                    this.isConnected = false;
                    this.stopHeartbeat();
                    this.onDisconnect(reason);
                    
                    if (reason !== 'io client disconnect') {
                        this.attemptReconnect(socketFactory);
                    }
                });
                
                this.socket.on('pong', (latency) => {
                    this.latency = latency;
                    this.updateConnectionQuality();
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }

    attemptReconnect(socketFactory) {
        if (this.reconnectCount >= this.reconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }
        
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectCount),
            this.maxReconnectDelay
        );
        
        setTimeout(() => {
            this.reconnectCount++;
            console.log(`Reconnection attempt ${this.reconnectCount}/${this.reconnectAttempts}`);
            this.connect(socketFactory);
        }, delay);
    }

    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.socket && this.isConnected) {
                const start = Date.now();
                this.socket.emit('ping', start);
                this.lastHeartbeat = start;
            }
        }, this.heartbeatInterval);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    updateConnectionQuality() {
        let quality = 'good';
        
        if (this.latency > 200) {
            quality = 'poor';
        } else if (this.latency > 100) {
            quality = 'fair';
        }
        
        if (quality !== this.connectionQuality) {
            this.connectionQuality = quality;
            this.onConnectionQualityChange(quality);
        }
    }

    getConnectionInfo() {
        return {
            isConnected: this.isConnected,
            latency: this.latency,
            quality: this.connectionQuality,
            reconnectCount: this.reconnectCount,
            lastHeartbeat: this.lastHeartbeat
        };
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.stopHeartbeat();
        this.isConnected = false;
    }
}

// Global instances
export const globalStateManager = new StateManager();
export const globalNetworkOptimizer = new NetworkOptimizer();
export const globalConnectionManager = new ConnectionManager();
