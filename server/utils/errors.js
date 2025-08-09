/**
 * Server-side error handling utilities
 */

/**
 * Base game error class
 */
export class GameError extends Error {
    constructor(message, code = 'GAME_ERROR', context = {}) {
        super(message);
        this.name = 'GameError';
        this.code = code;
        this.context = context;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Multiplayer-specific error classes
 */
export class NetworkError extends GameError {
    constructor(message, context = {}) {
        super(message, 'NETWORK_ERROR', context);
        this.name = 'NetworkError';
    }
}

export class LobbyError extends GameError {
    constructor(message, context = {}) {
        super(message, 'LOBBY_ERROR', context);
        this.name = 'LobbyError';
    }
}

export class PlayerError extends GameError {
    constructor(message, context = {}) {
        super(message, 'PLAYER_ERROR', context);
        this.name = 'PlayerError';
    }
}

/**
 * Error logging utility
 */
export class ErrorLogger {
    static logs = [];
    static maxLogs = 1000;

    static log(error, level = 'ERROR') {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            error: {
                name: error.name,
                message: error.message,
                code: error.code || 'UNKNOWN',
                context: error.context || {},
                stack: error.stack
            }
        };

        this.logs.push(logEntry);

        // Keep only recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Console output
        console.error(`[${level}] ${error.message}`, error.context || '');
        
        if (process.env.NODE_ENV === 'development') {
            console.error(error.stack);
        }
    }

    static getLogs(limit = 50) {
        return this.logs.slice(-limit);
    }

    static clearLogs() {
        this.logs = [];
    }
}