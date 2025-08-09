/**
 * Error Handling Utilities
 * Centralized error management and validation for the game
 */

import { ERROR_MESSAGES, DEBUG } from '../constants.js';

/**
 * Custom error classes for different types of game errors
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

export class ValidationError extends GameError {
    constructor(message, field, value) {
        super(message, 'VALIDATION_ERROR', { field, value });
        this.name = 'ValidationError';
    }
}

export class PathfindingError extends GameError {
    constructor(message, startPos, endPos) {
        super(message, 'PATHFINDING_ERROR', { startPos, endPos });
        this.name = 'PathfindingError';
    }
}

export class EntityError extends GameError {
    constructor(message, entityId, entityType) {
        super(message, 'ENTITY_ERROR', { entityId, entityType });
        this.name = 'EntityError';
    }
}

/**
 * Error logging utility
 */
export class ErrorLogger {
    static logs = [];

    static log(error, level = 'error') {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code,
                context: error.context
            }
        };

        this.logs.push(logEntry);

        // Keep only last 100 logs to prevent memory issues
        if (this.logs.length > 100) {
            this.logs = this.logs.slice(-100);
        }

        if (DEBUG.ENABLE_LOGGING) {
            console.error(`[${level.toUpperCase()}]`, error.message, error.context || '');
        }

        // In production, you might want to send errors to a logging service
        // this.sendToLoggingService(logEntry);
    }

    static warn(message, context = {}) {
        const warning = new GameError(message, 'WARNING', context);
        this.log(warning, 'warn');
    }

    static info(message, context = {}) {
        const info = new GameError(message, 'INFO', context);
        this.log(info, 'info');
    }

    static getLogs(level = null) {
        if (level) {
            return this.logs.filter(log => log.level === level);
        }
        return [...this.logs];
    }

    static clearLogs() {
        this.logs = [];
    }
}

/**
 * Validation utilities
 */
export class Validator {
    /**
     * Validates entity object structure
     * @param {Object} entity - Entity to validate
     * @param {string[]} requiredFields - Required fields for the entity
     * @throws {ValidationError} If validation fails
     */
    static validateEntity(entity, requiredFields = ['id', 'gridX', 'gridY', 'hp']) {
        if (!entity || typeof entity !== 'object') {
            throw new ValidationError(ERROR_MESSAGES.INVALID_ENTITY, 'entity', entity);
        }

        for (const field of requiredFields) {
            if (!(field in entity)) {
                throw new ValidationError(
                    `Missing required field: ${field}`, 
                    field, 
                    entity
                );
            }
        }

        // Validate numeric fields
        if (typeof entity.gridX !== 'number' || typeof entity.gridY !== 'number') {
            throw new ValidationError(
                'Grid coordinates must be numbers', 
                'coordinates', 
                { gridX: entity.gridX, gridY: entity.gridY }
            );
        }

        if (entity.hp !== undefined && (typeof entity.hp !== 'number' || entity.hp < 0)) {
            throw new ValidationError(
                'HP must be a non-negative number', 
                'hp', 
                entity.hp
            );
        }
    }

    /**
     * Validates grid coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} cols - Grid columns
     * @param {number} rows - Grid rows
     * @throws {ValidationError} If coordinates are invalid
     */
    static validateGridCoordinates(x, y, cols, rows) {
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new ValidationError(
                'Coordinates must be numbers', 
                'coordinates', 
                { x, y }
            );
        }

        if (x < 0 || x >= cols || y < 0 || y >= rows) {
            throw new ValidationError(
                ERROR_MESSAGES.OUT_OF_BOUNDS, 
                'coordinates', 
                { x, y, cols, rows }
            );
        }
    }

    /**
     * Validates spell parameters
     * @param {Object} spell - Spell object to validate
     * @throws {ValidationError} If spell is invalid
     */
    static validateSpell(spell) {
        if (!spell || typeof spell !== 'object') {
            throw new ValidationError('Invalid spell object', 'spell', spell);
        }

        const requiredFields = ['name', 'damage', 'range', 'cost'];
        for (const field of requiredFields) {
            if (!(field in spell)) {
                throw new ValidationError(`Missing spell field: ${field}`, field, spell);
            }
        }

        if (typeof spell.damage !== 'function') {
            throw new ValidationError('Spell damage must be a function', 'damage', spell.damage);
        }

        if (typeof spell.range !== 'number' || spell.range < 0) {
            throw new ValidationError('Spell range must be a non-negative number', 'range', spell.range);
        }

        if (typeof spell.cost !== 'number' || spell.cost <= 0) {
            throw new ValidationError('Spell cost must be a positive number', 'cost', spell.cost);
        }
    }
}

/**
 * Safe execution wrapper that catches and logs errors
 * @param {Function} fn - Function to execute safely
 * @param {string} operation - Description of the operation
 * @param {*} defaultValue - Default value to return on error
 * @returns {*} Function result or default value
 */
export function safeExecute(fn, operation = 'operation', defaultValue = null) {
    try {
        return fn();
    } catch (error) {
        ErrorLogger.log(new GameError(
            `Error during ${operation}: ${error.message}`,
            'SAFE_EXECUTE_ERROR',
            { operation, originalError: error.message }
        ));
        return defaultValue;
    }
}

/**
 * Async safe execution wrapper
 * @param {Function} fn - Async function to execute safely
 * @param {string} operation - Description of the operation
 * @param {*} defaultValue - Default value to return on error
 * @returns {Promise<*>} Function result or default value
 */
export async function safeExecuteAsync(fn, operation = 'async operation', defaultValue = null) {
    try {
        return await fn();
    } catch (error) {
        ErrorLogger.log(new GameError(
            `Error during ${operation}: ${error.message}`,
            'SAFE_EXECUTE_ASYNC_ERROR',
            { operation, originalError: error.message }
        ));
        return defaultValue;
    }
}

/**
 * Retry mechanism for operations that might fail temporarily
 * @param {Function} fn - Function to retry
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} delay - Delay between attempts in milliseconds
 * @param {string} operation - Description of the operation
 * @returns {Promise<*>} Function result
 */
export async function retry(fn, maxAttempts = 3, delay = 1000, operation = 'operation') {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            ErrorLogger.log(new GameError(
                `Attempt ${attempt}/${maxAttempts} failed for ${operation}: ${error.message}`,
                'RETRY_ATTEMPT',
                { attempt, maxAttempts, operation }
            ));

            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw new GameError(
        `All ${maxAttempts} attempts failed for ${operation}`,
        'RETRY_EXHAUSTED',
        { operation, lastError: lastError.message }
    );
}