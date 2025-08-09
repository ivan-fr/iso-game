/**
 * Enhanced error handling for multiplayer components
 */
export class MultiplayerError extends Error {
    constructor(message, code, context = {}) {
        super(message);
        this.name = 'MultiplayerError';
        this.code = code;
        this.context = context;
        this.timestamp = new Date().toISOString();
    }
}

export const ERROR_CODES = {
    CONNECTION_FAILED: 'CONNECTION_FAILED',
    LOBBY_NOT_FOUND: 'LOBBY_NOT_FOUND',
    LOBBY_FULL: 'LOBBY_FULL',
    PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
    INVALID_ACTION: 'INVALID_ACTION',
    GAME_NOT_STARTED: 'GAME_NOT_STARTED',
    TURN_VIOLATION: 'TURN_VIOLATION',
    REDIS_ERROR: 'REDIS_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR'
};

export class ErrorHandler {
    constructor(options = {}) {
        this.enableLogging = options.enableLogging !== false;
        this.enableMetrics = options.enableMetrics || false;
        this.errorCallback = options.onError || null;
        this.metrics = {
            errorCounts: new Map(),
            lastErrors: [],
            maxStoredErrors: 100
        };
    }

    handle(error, context = {}) {
        const enhancedError = this._enhanceError(error, context);
        
        if (this.enableLogging) {
            this._logError(enhancedError);
        }
        
        if (this.enableMetrics) {
            this._recordMetrics(enhancedError);
        }
        
        if (this.errorCallback) {
            try {
                this.errorCallback(enhancedError);
            } catch (callbackError) {
                console.error('Error in error callback:', callbackError);
            }
        }
        
        return enhancedError;
    }

    _enhanceError(error, context) {
        if (error instanceof MultiplayerError) {
            // Already enhanced, just add additional context
            return new MultiplayerError(
                error.message,
                error.code,
                { ...error.context, ...context }
            );
        }
        
        // Convert regular error to MultiplayerError
        let code = ERROR_CODES.CONNECTION_FAILED;
        
        // Try to determine error code from error message or type
        if (error.message.includes('timeout')) {
            code = ERROR_CODES.TIMEOUT_ERROR;
        } else if (error.message.includes('Redis')) {
            code = ERROR_CODES.REDIS_ERROR;
        } else if (error.message.includes('validation')) {
            code = ERROR_CODES.VALIDATION_ERROR;
        } else if (error.name === 'ValidationError') {
            code = ERROR_CODES.VALIDATION_ERROR;
        }
        
        return new MultiplayerError(
            error.message,
            code,
            {
                originalError: error.name,
                stack: error.stack,
                ...context
            }
        );
    }

    _logError(error) {
        const logLevel = this._getLogLevel(error.code);
        const logMessage = `[${logLevel}] ${error.message}`;
        const logContext = {
            code: error.code,
            timestamp: error.timestamp,
            context: error.context
        };
        
        if (logLevel === 'ERROR') {
            console.error(logMessage, logContext);
        } else if (logLevel === 'WARN') {
            console.warn(logMessage, logContext);
        } else {
            console.log(logMessage, logContext);
        }
    }

    _getLogLevel(errorCode) {
        const criticalErrors = [
            ERROR_CODES.REDIS_ERROR,
            ERROR_CODES.CONNECTION_FAILED
        ];
        
        const warningErrors = [
            ERROR_CODES.TIMEOUT_ERROR,
            ERROR_CODES.VALIDATION_ERROR
        ];
        
        if (criticalErrors.includes(errorCode)) {
            return 'ERROR';
        } else if (warningErrors.includes(errorCode)) {
            return 'WARN';
        } else {
            return 'INFO';
        }
    }

    _recordMetrics(error) {
        // Count error types
        const count = this.metrics.errorCounts.get(error.code) || 0;
        this.metrics.errorCounts.set(error.code, count + 1);
        
        // Store recent errors
        this.metrics.lastErrors.push({
            code: error.code,
            message: error.message,
            timestamp: error.timestamp,
            context: error.context
        });
        
        // Limit stored errors
        if (this.metrics.lastErrors.length > this.metrics.maxStoredErrors) {
            this.metrics.lastErrors.shift();
        }
    }

    getMetrics() {
        return {
            errorCounts: Object.fromEntries(this.metrics.errorCounts),
            recentErrors: this.metrics.lastErrors.slice(-10),
            totalErrors: this.metrics.lastErrors.length
        };
    }

    clearMetrics() {
        this.metrics.errorCounts.clear();
        this.metrics.lastErrors = [];
    }
}

export class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.recoveryTimeout = options.recoveryTimeout || 30000; // 30 seconds
        this.monitoringWindow = options.monitoringWindow || 60000; // 1 minute
        
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.recentFailures = [];
    }

    async execute(operation, fallback = null) {
        if (this.state === 'OPEN') {
            if (this._shouldAttemptRecovery()) {
                this.state = 'HALF_OPEN';
            } else {
                if (fallback) {
                    return fallback();
                }
                throw new MultiplayerError(
                    'Circuit breaker is OPEN',
                    ERROR_CODES.CONNECTION_FAILED,
                    { circuitState: this.state }
                );
            }
        }

        try {
            const result = await operation();
            this._onSuccess();
            return result;
        } catch (error) {
            this._onFailure(error);
            
            if (fallback && this.state === 'OPEN') {
                return fallback();
            }
            
            throw error;
        }
    }

    _shouldAttemptRecovery() {
        return Date.now() - this.lastFailureTime > this.recoveryTimeout;
    }

    _onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
        this.recentFailures = [];
    }

    _onFailure(error) {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        this.recentFailures.push({
            error: error.message,
            timestamp: Date.now()
        });

        // Clean old failures outside monitoring window
        const cutoff = Date.now() - this.monitoringWindow;
        this.recentFailures = this.recentFailures.filter(
            failure => failure.timestamp > cutoff
        );

        if (this.recentFailures.length >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }

    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            recentFailures: this.recentFailures.length,
            lastFailure: this.lastFailureTime
        };
    }
}

export class RetryManager {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1000;
        this.maxDelay = options.maxDelay || 10000;
        this.backoffFactor = options.backoffFactor || 2;
        this.jitter = options.jitter || true;
    }

    async execute(operation, options = {}) {
        const maxRetries = options.maxRetries || this.maxRetries;
        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries) {
                    throw new MultiplayerError(
                        `Operation failed after ${maxRetries + 1} attempts: ${error.message}`,
                        ERROR_CODES.TIMEOUT_ERROR,
                        {
                            attempts: attempt + 1,
                            originalError: error.message
                        }
                    );
                }

                const delay = this._calculateDelay(attempt);
                await this._sleep(delay);
            }
        }
    }

    _calculateDelay(attempt) {
        let delay = this.baseDelay * Math.pow(this.backoffFactor, attempt);
        delay = Math.min(delay, this.maxDelay);
        
        if (this.jitter) {
            // Add random jitter (±25%)
            const jitterRange = delay * 0.25;
            delay += (Math.random() - 0.5) * 2 * jitterRange;
        }
        
        return Math.max(delay, 0);
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export class ValidationManager {
    static validateLobbyData(data) {
        const errors = [];
        
        if (!data.id || typeof data.id !== 'string') {
            errors.push('Lobby ID is required and must be a string');
        }
        
        if (!data.name || typeof data.name !== 'string') {
            errors.push('Lobby name is required and must be a string');
        }
        
        if (data.maxPlayers && (typeof data.maxPlayers !== 'number' || data.maxPlayers < 1 || data.maxPlayers > 8)) {
            errors.push('Max players must be a number between 1 and 8');
        }
        
        if (data.players && !Array.isArray(data.players)) {
            errors.push('Players must be an array');
        }
        
        if (errors.length > 0) {
            throw new MultiplayerError(
                'Lobby validation failed',
                ERROR_CODES.VALIDATION_ERROR,
                { errors }
            );
        }
        
        return true;
    }

    static validatePlayerData(data) {
        const errors = [];
        
        if (!data.id || typeof data.id !== 'string') {
            errors.push('Player ID is required and must be a string');
        }
        
        if (!data.name || typeof data.name !== 'string') {
            errors.push('Player name is required and must be a string');
        }
        
        if (data.name && data.name.length > 20) {
            errors.push('Player name must be 20 characters or less');
        }
        
        if (errors.length > 0) {
            throw new MultiplayerError(
                'Player validation failed',
                ERROR_CODES.VALIDATION_ERROR,
                { errors }
            );
        }
        
        return true;
    }

    static validateGameAction(action) {
        const errors = [];
        
        if (!action.type || typeof action.type !== 'string') {
            errors.push('Action type is required and must be a string');
        }
        
        const validActions = ['move', 'attack', 'spell', 'end-turn', 'special'];
        if (action.type && !validActions.includes(action.type)) {
            errors.push(`Invalid action type. Must be one of: ${validActions.join(', ')}`);
        }
        
        if (action.type === 'move' && !action.path) {
            errors.push('Move action requires a path');
        }
        
        if (action.type === 'attack' && (!action.targetId || !action.attackerId)) {
            errors.push('Attack action requires attackerId and targetId');
        }
        
        if (errors.length > 0) {
            throw new MultiplayerError(
                'Game action validation failed',
                ERROR_CODES.VALIDATION_ERROR,
                { errors, action }
            );
        }
        
        return true;
    }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler({
    enableLogging: true,
    enableMetrics: true
});

// Global circuit breaker for Redis operations
export const redisCircuitBreaker = new CircuitBreaker({
    failureThreshold: 5,
    recoveryTimeout: 30000
});

// Global retry manager
export const globalRetryManager = new RetryManager({
    maxRetries: 3,
    baseDelay: 1000
});
