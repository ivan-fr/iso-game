/**
 * Utility Helper Functions
 * Common operations and calculations used throughout the game
 */

import { VALIDATION, ERROR_MESSAGES } from '../constants.js';
import { ValidationError } from './errors.js';

/**
 * Mathematical utility functions
 */
export class MathUtils {
    /**
     * Calculates Manhattan distance between two points
     * @param {number} x1 - First point X coordinate
     * @param {number} y1 - First point Y coordinate
     * @param {number} x2 - Second point X coordinate
     * @param {number} y2 - Second point Y coordinate
     * @returns {number} Manhattan distance
     */
    static manhattanDistance(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    /**
     * Calculates Euclidean distance between two points
     * @param {number} x1 - First point X coordinate
     * @param {number} y1 - First point Y coordinate
     * @param {number} x2 - Second point X coordinate
     * @param {number} y2 - Second point Y coordinate
     * @returns {number} Euclidean distance
     */
    static euclideanDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    /**
     * Clamps a number between min and max values
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Linear interpolation between two values
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    static lerp(a, b, t) {
        return a + (b - a) * this.clamp(t, 0, 1);
    }

    /**
     * Generates a random number between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random number
     */
    static randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Generates a random float between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random float
     */
    static randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    /**
     * Checks if a point is within a rectangle
     * @param {number} x - Point X coordinate
     * @param {number} y - Point Y coordinate
     * @param {number} rectX - Rectangle X coordinate
     * @param {number} rectY - Rectangle Y coordinate
     * @param {number} rectWidth - Rectangle width
     * @param {number} rectHeight - Rectangle height
     * @returns {boolean} True if point is within rectangle
     */
    static pointInRect(x, y, rectX, rectY, rectWidth, rectHeight) {
        return x >= rectX && x <= rectX + rectWidth && 
               y >= rectY && y <= rectY + rectHeight;
    }
}

/**
 * Array utility functions
 */
export class ArrayUtils {
    /**
     * Shuffles an array in place using Fisher-Yates algorithm
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
     */
    static shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Removes duplicate items from an array
     * @param {Array} array - Array to deduplicate
     * @param {Function} keyFn - Optional function to generate key for comparison
     * @returns {Array} Array without duplicates
     */
    static unique(array, keyFn = null) {
        if (!keyFn) {
            return [...new Set(array)];
        }
        
        const seen = new Set();
        return array.filter(item => {
            const key = keyFn(item);
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Chunks an array into smaller arrays of specified size
     * @param {Array} array - Array to chunk
     * @param {number} size - Chunk size
     * @returns {Array[]} Array of chunks
     */
    static chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Finds the minimum value in an array based on a comparison function
     * @param {Array} array - Array to search
     * @param {Function} compareFn - Function to generate comparable value
     * @returns {*} Item with minimum value
     */
    static minBy(array, compareFn) {
        if (array.length === 0) return undefined;
        return array.reduce((min, current) => 
            compareFn(current) < compareFn(min) ? current : min
        );
    }

    /**
     * Finds the maximum value in an array based on a comparison function
     * @param {Array} array - Array to search
     * @param {Function} compareFn - Function to generate comparable value
     * @returns {*} Item with maximum value
     */
    static maxBy(array, compareFn) {
        if (array.length === 0) return undefined;
        return array.reduce((max, current) => 
            compareFn(current) > compareFn(max) ? current : max
        );
    }
}

/**
 * Object utility functions
 */
export class ObjectUtils {
    /**
     * Deep clones an object
     * @param {*} obj - Object to clone
     * @returns {*} Deep cloned object
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (obj instanceof Array) {
            return obj.map(item => this.deepClone(item));
        }
        
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = this.deepClone(obj[key]);
            }
        }
        return clonedObj;
    }

    /**
     * Merges multiple objects deeply
     * @param {...Object} objects - Objects to merge
     * @returns {Object} Merged object
     */
    static deepMerge(...objects) {
        const result = {};
        
        for (const obj of objects) {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (result[key] && typeof result[key] === 'object' && 
                        typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                        result[key] = this.deepMerge(result[key], obj[key]);
                    } else {
                        result[key] = obj[key];
                    }
                }
            }
        }
        
        return result;
    }

    /**
     * Gets a nested property value safely
     * @param {Object} obj - Object to search in
     * @param {string} path - Dot-separated path to property
     * @param {*} defaultValue - Default value if property not found
     * @returns {*} Property value or default
     */
    static get(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current === null || current === undefined || !(key in current)) {
                return defaultValue;
            }
            current = current[key];
        }
        
        return current;
    }

    /**
     * Sets a nested property value safely
     * @param {Object} obj - Object to modify
     * @param {string} path - Dot-separated path to property
     * @param {*} value - Value to set
     * @returns {Object} Modified object
     */
    static set(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = obj;
        
        for (const key of keys) {
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
        return obj;
    }
}

/**
 * Game-specific utility functions
 */
export class GameUtils {
    /**
     * Checks if two entities are adjacent (Manhattan distance = 1)
     * @param {Object} entity1 - First entity
     * @param {Object} entity2 - Second entity
     * @returns {boolean} True if entities are adjacent
     */
    static areAdjacent(entity1, entity2) {
        return MathUtils.manhattanDistance(
            entity1.gridX, entity1.gridY,
            entity2.gridX, entity2.gridY
        ) === 1;
    }

    /**
     * Checks if an entity is within attack range of another
     * @param {Object} attacker - Attacking entity
     * @param {Object} target - Target entity
     * @param {number} range - Attack range
     * @returns {boolean} True if target is within range
     */
    static isInRange(attacker, target, range) {
        return MathUtils.manhattanDistance(
            attacker.gridX, attacker.gridY,
            target.gridX, target.gridY
        ) <= range;
    }

    /**
     * Checks if an entity is alive (HP > 0 and not dying)
     * @param {Object} entity - Entity to check
     * @returns {boolean} True if entity is alive
     */
    static isAlive(entity) {
        return entity && entity.hp > 0 && !entity._isDying;
    }

    /**
     * Gets all living entities from a list
     * @param {Array} entities - List of entities
     * @returns {Array} Living entities only
     */
    static getLivingEntities(entities) {
        return entities.filter(entity => this.isAlive(entity));
    }

    /**
     * Calculates damage with optional random variance
     * @param {number} baseDamage - Base damage amount
     * @param {number} variance - Random variance (0-1)
     * @returns {number} Final damage amount
     */
    static calculateDamage(baseDamage, variance = 0.2) {
        const minDamage = baseDamage * (1 - variance);
        const maxDamage = baseDamage * (1 + variance);
        return Math.round(MathUtils.randomFloat(minDamage, maxDamage));
    }

    /**
     * Generates a unique ID for entities
     * @param {string} prefix - ID prefix (e.g., 'enemy', 'projectile')
     * @returns {string} Unique ID
     */
    static generateId(prefix = 'entity') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Validates grid coordinates against boundaries
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} cols - Grid columns
     * @param {number} rows - Grid rows
     * @throws {ValidationError} If coordinates are invalid
     */
    static validateCoordinates(x, y, cols, rows) {
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new ValidationError('Coordinates must be numbers', 'coordinates', { x, y });
        }

        if (!Number.isInteger(x) || !Number.isInteger(y)) {
            throw new ValidationError('Coordinates must be integers', 'coordinates', { x, y });
        }

        if (x < 0 || x >= cols || y < 0 || y >= rows) {
            throw new ValidationError(ERROR_MESSAGES.OUT_OF_BOUNDS, 'coordinates', { x, y, cols, rows });
        }
    }

    /**
     * Sanitizes entity data for safe storage/transmission
     * @param {Object} entity - Entity to sanitize
     * @returns {Object} Sanitized entity data
     */
    static sanitizeEntity(entity) {
        const safe = {
            id: entity.id,
            gridX: Math.round(entity.gridX),
            gridY: Math.round(entity.gridY),
            hp: MathUtils.clamp(entity.hp || 0, VALIDATION.MIN_HP, VALIDATION.MAX_HP),
            maxHp: MathUtils.clamp(entity.maxHp || 100, VALIDATION.MIN_HP, VALIDATION.MAX_HP),
            mp: MathUtils.clamp(entity.mp || 0, VALIDATION.MIN_MP, VALIDATION.MAX_MP),
            maxMp: MathUtils.clamp(entity.maxMp || 6, VALIDATION.MIN_MP, VALIDATION.MAX_MP),
            ap: MathUtils.clamp(entity.ap || 0, VALIDATION.MIN_AP, VALIDATION.MAX_AP),
            maxAp: MathUtils.clamp(entity.maxAp || 2, VALIDATION.MIN_AP, VALIDATION.MAX_AP),
            aiType: entity.aiType || 'unknown'
        };

        // Copy additional safe properties
        if (entity.size !== undefined) safe.size = entity.size;
        if (entity.image !== undefined) safe.image = entity.image;
        if (entity.usedSpecialThisTurn !== undefined) safe.usedSpecialThisTurn = !!entity.usedSpecialThisTurn;

        return safe;
    }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceUtils {
    static timers = new Map();

    /**
     * Starts a performance timer
     * @param {string} name - Timer name
     */
    static startTimer(name) {
        this.timers.set(name, performance.now());
    }

    /**
     * Ends a performance timer and returns elapsed time
     * @param {string} name - Timer name
     * @returns {number} Elapsed time in milliseconds
     */
    static endTimer(name) {
        const startTime = this.timers.get(name);
        if (!startTime) {
            console.warn(`Timer '${name}' was not started`);
            return 0;
        }
        
        const elapsed = performance.now() - startTime;
        this.timers.delete(name);
        return elapsed;
    }

    /**
     * Measures execution time of a function
     * @param {Function} fn - Function to measure
     * @param {string} name - Timer name
     * @returns {Object} Result and execution time
     */
    static measureTime(fn, name = 'operation') {
        this.startTimer(name);
        const result = fn();
        const time = this.endTimer(name);
        
        return { result, time };
    }

    /**
     * Debounces a function call
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(fn, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Throttles a function call
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    static throttle(fn, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}