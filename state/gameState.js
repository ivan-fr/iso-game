/**
 * Game State Management
 * Centralized state management with observers and validation
 */

import { GAME_STATES, TURN_STATES, VALIDATION } from '../constants.js';
import { GameError, ErrorLogger, Validator } from '../utils/errors.js';
import { GameUtils, ObjectUtils } from '../utils/helpers.js';

/**
 * Observable state manager with validation and history
 */
class ObservableState {
    constructor(initialState = {}, validators = {}) {
        this._state = ObjectUtils.deepClone(initialState);
        this._validators = validators;
        this._observers = new Map();
        this._history = [];
        this._maxHistorySize = 50;
    }

    /**
     * Gets current state or a specific property
     * @param {string} [path] - Dot-separated path to property
     * @returns {*} State value
     */
    get(path = null) {
        if (path === null) {
            return ObjectUtils.deepClone(this._state);
        }
        return ObjectUtils.get(this._state, path);
    }

    /**
     * Sets state property with validation and notifications
     * @param {string|Object} pathOrState - Property path or entire state object
     * @param {*} [value] - Value to set (if path is string)
     * @param {boolean} [skipValidation=false] - Skip validation
     */
    set(pathOrState, value, skipValidation = false) {
        const oldState = ObjectUtils.deepClone(this._state);
        let changes = {};

        if (typeof pathOrState === 'string') {
            // Setting single property
            const path = pathOrState;
            
            if (!skipValidation && this._validators[path]) {
                this._validators[path](value, this._state);
            }

            ObjectUtils.set(this._state, path, value);
            changes[path] = { old: ObjectUtils.get(oldState, path), new: value };
        } else {
            // Setting multiple properties or entire state
            const newState = pathOrState;
            
            if (!skipValidation) {
                for (const [path, validator] of Object.entries(this._validators)) {
                    const newValue = ObjectUtils.get(newState, path);
                    if (newValue !== undefined) {
                        validator(newValue, this._state);
                    }
                }
            }

            this._state = ObjectUtils.deepMerge(this._state, newState);
            changes = this._calculateChanges(oldState, this._state);
        }

        // Add to history
        this._addToHistory(oldState, this._state, changes);

        // Notify observers
        this._notifyObservers(changes, oldState, this._state);
    }

    /**
     * Subscribes to state changes
     * @param {string|Array<string>} paths - Path(s) to watch
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(paths, callback) {
        const pathArray = Array.isArray(paths) ? paths : [paths];
        const observerId = Math.random().toString(36).substr(2, 9);
        
        this._observers.set(observerId, {
            paths: pathArray,
            callback
        });

        return () => this._observers.delete(observerId);
    }

    /**
     * Resets state to initial value
     */
    reset() {
        const oldState = ObjectUtils.deepClone(this._state);
        this._state = {};
        this._notifyObservers(this._calculateChanges(oldState, this._state), oldState, this._state);
    }

    /**
     * Gets state history
     * @param {number} [limit] - Number of history entries to return
     * @returns {Array} State history
     */
    getHistory(limit = null) {
        return limit ? this._history.slice(-limit) : [...this._history];
    }

    // Private methods
    _calculateChanges(oldState, newState) {
        const changes = {};
        
        function findChanges(obj1, obj2, path = '') {
            for (const key in obj2) {
                const currentPath = path ? `${path}.${key}` : key;
                
                if (!(key in obj1)) {
                    changes[currentPath] = { old: undefined, new: obj2[key] };
                } else if (obj1[key] !== obj2[key]) {
                    if (typeof obj2[key] === 'object' && obj2[key] !== null) {
                        findChanges(obj1[key] || {}, obj2[key], currentPath);
                    } else {
                        changes[currentPath] = { old: obj1[key], new: obj2[key] };
                    }
                }
            }
        }
        
        findChanges(oldState, newState);
        return changes;
    }

    _addToHistory(oldState, newState, changes) {
        this._history.push({
            timestamp: Date.now(),
            oldState: ObjectUtils.deepClone(oldState),
            newState: ObjectUtils.deepClone(newState),
            changes
        });

        if (this._history.length > this._maxHistorySize) {
            this._history.shift();
        }
    }

    _notifyObservers(changes, oldState, newState) {
        for (const [observerId, { paths, callback }] of this._observers) {
            const relevantChanges = {};
            let hasRelevantChanges = false;

            for (const path of paths) {
                if (path === '*' || changes[path]) {
                    relevantChanges[path] = changes[path];
                    hasRelevantChanges = true;
                } else {
                    // Check if any nested path matches
                    for (const changePath of Object.keys(changes)) {
                        if (changePath.startsWith(path + '.')) {
                            relevantChanges[changePath] = changes[changePath];
                            hasRelevantChanges = true;
                        }
                    }
                }
            }

            if (hasRelevantChanges) {
                try {
                    callback(relevantChanges, newState, oldState);
                } catch (error) {
                    ErrorLogger.log(new GameError(
                        `Observer callback error: ${error.message}`,
                        'OBSERVER_ERROR',
                        { observerId, error: error.message }
                    ));
                }
            }
        }
    }
}

/**
 * Main game state manager
 */
export class GameStateManager {
    constructor() {
        // Define state validators
        const validators = {
            'currentTurn': (value) => {
                if (!Object.values(TURN_STATES).includes(value)) {
                    throw new GameError(`Invalid turn state: ${value}`);
                }
            },
            'playerState': (value) => {
                if (!Object.values(GAME_STATES).includes(value)) {
                    throw new GameError(`Invalid player state: ${value}`);
                }
            },
            'currentRoomId': (value) => {
                if (typeof value !== 'number' || value < 0) {
                    throw new GameError(`Invalid room ID: ${value}`);
                }
            },
            'currentGridCols': (value) => {
                if (typeof value !== 'number' || value < VALIDATION.MIN_GRID_SIZE || value > VALIDATION.MAX_GRID_SIZE) {
                    throw new GameError(`Invalid grid columns: ${value}`);
                }
            },
            'currentGridRows': (value) => {
                if (typeof value !== 'number' || value < VALIDATION.MIN_GRID_SIZE || value > VALIDATION.MAX_GRID_SIZE) {
                    throw new GameError(`Invalid grid rows: ${value}`);
                }
            }
        };

        // Initialize state
        const initialState = {
            // Room and grid state
            currentRoomId: 0,
            currentMapGrid: [],
            currentGridCols: 0,
            currentGridRows: 0,

            // Turn and player state
            currentTurn: TURN_STATES.PLAYER,
            playerState: GAME_STATES.IDLE,
            gameOver: false,

            // Entity states
            player: null,
            enemiesState: [],
            bossState: null,
            activeEnemy: null,

            // Game mechanics
            reachableTiles: [],
            attackableTiles: [],
            hoveredTile: null,
            hoveredEnemyId: null,
            enemyHoveredReachableTiles: [],

            // Visual effects
            projectiles: [],
            damageAnimations: [],
            buffAnimations: [],
            
            // Game progress
            defeatedEnemiesCount: {
                sheep: 0,
                sheepist_noir: 0,
                chef_de_guerre: 0,
                sheep_royal: 0
            },

            // UI state
            isMoving: false,
            gameTick: 0,

            // Scheduled actions for complex sequences
            scheduledActions: []
        };

        this._state = new ObservableState(initialState, validators);
        this._initializeSubscriptions();
    }

    // State getters
    get currentTurn() { return this._state.get('currentTurn'); }
    get playerState() { return this._state.get('playerState'); }
    get currentRoomId() { return this._state.get('currentRoomId'); }
    get currentMapGrid() { return this._state.get('currentMapGrid'); }
    get currentGridCols() { return this._state.get('currentGridCols'); }
    get currentGridRows() { return this._state.get('currentGridRows'); }
    get gameOver() { return this._state.get('gameOver'); }
    get player() { return this._state.get('player'); }
    get enemiesState() { return this._state.get('enemiesState'); }
    get bossState() { return this._state.get('bossState'); }
    get reachableTiles() { return this._state.get('reachableTiles'); }
    get attackableTiles() { return this._state.get('attackableTiles'); }
    get projectiles() { return this._state.get('projectiles'); }
    get damageAnimations() { return this._state.get('damageAnimations'); }
    get buffAnimations() { return this._state.get('buffAnimations'); }
    get isMoving() { return this._state.get('isMoving'); }
    get hoveredTile() { return this._state.get('hoveredTile'); }
    get activeEnemy() { return this._state.get('activeEnemy'); }
    get defeatedEnemiesCount() { return this._state.get('defeatedEnemiesCount'); }

    // State setters with validation
    setCurrentTurn(value) { this._state.set('currentTurn', value); }
    setPlayerState(value) { this._state.set('playerState', value); }
    setCurrentRoom(roomId, mapGrid, cols, rows) {
        this._state.set({
            currentRoomId: roomId,
            currentMapGrid: mapGrid,
            currentGridCols: cols,
            currentGridRows: rows
        });
    }
    setGameOver(value) { this._state.set('gameOver', value); }
    setPlayer(player) { 
        if (player) {
            Validator.validateEntity(player);
        }
        this._state.set('player', player); 
    }
    setEnemiesState(enemies) { 
        if (Array.isArray(enemies)) {
            enemies.forEach(enemy => Validator.validateEntity(enemy));
        }
        this._state.set('enemiesState', enemies); 
    }
    setBossState(boss) { 
        if (boss) {
            Validator.validateEntity(boss);
        }
        this._state.set('bossState', boss); 
    }
    setReachableTiles(tiles) { this._state.set('reachableTiles', tiles); }
    setAttackableTiles(tiles) { this._state.set('attackableTiles', tiles); }
    setIsMoving(value) { this._state.set('isMoving', value); }
    setHoveredTile(tile) { this._state.set('hoveredTile', tile); }
    setActiveEnemy(enemy) { this._state.set('activeEnemy', enemy); }

    // Array manipulation methods
    addProjectile(projectile) {
        const projectiles = [...this._state.get('projectiles'), projectile];
        this._state.set('projectiles', projectiles);
    }

    removeProjectile(projectileId) {
        const projectiles = this._state.get('projectiles').filter(p => p.id !== projectileId);
        this._state.set('projectiles', projectiles);
    }

    addDamageAnimation(animation) {
        const animations = [...this._state.get('damageAnimations'), animation];
        this._state.set('damageAnimations', animations);
    }

    removeDamageAnimation(animationId) {
        const animations = this._state.get('damageAnimations').filter(a => a.id !== animationId);
        this._state.set('damageAnimations', animations);
    }

    addBuffAnimation(animation) {
        const animations = [...this._state.get('buffAnimations'), animation];
        this._state.set('buffAnimations', animations);
    }

    removeBuffAnimation(animationId) {
        const animations = this._state.get('buffAnimations').filter(a => a.id !== animationId);
        this._state.set('buffAnimations', animations);
    }

    // Enemy management
    updateEnemy(enemyId, updates) {
        const enemies = [...this._state.get('enemiesState')];
        const enemyIndex = enemies.findIndex(e => e.id === enemyId);
        
        if (enemyIndex >= 0) {
            enemies[enemyIndex] = { ...enemies[enemyIndex], ...updates };
            this._state.set('enemiesState', enemies);
        }
    }

    removeEnemy(enemyId) {
        const enemies = this._state.get('enemiesState').filter(e => e.id !== enemyId);
        this._state.set('enemiesState', enemies);
    }

    // Defeat tracking
    incrementDefeatedCount(enemyType) {
        const counts = { ...this._state.get('defeatedEnemiesCount') };
        counts[enemyType] = (counts[enemyType] || 0) + 1;
        this._state.set('defeatedEnemiesCount', counts);
    }

    // State subscription methods
    subscribe(paths, callback) {
        return this._state.subscribe(paths, callback);
    }

    // Utility methods
    getAllEntities() {
        const entities = [];
        const player = this._state.get('player');
        const enemies = this._state.get('enemiesState');
        const boss = this._state.get('bossState');

        if (player) entities.push(player);
        if (boss) entities.push(boss);
        entities.push(...enemies);

        return entities;
    }

    getLivingEntities() {
        return GameUtils.getLivingEntities(this.getAllEntities());
    }

    getEntityById(id) {
        return this.getAllEntities().find(entity => entity.id === id);
    }

    // State persistence
    saveState() {
        try {
            const stateToSave = {
                ...this._state.get(),
                timestamp: Date.now()
            };
            localStorage.setItem('gameState', JSON.stringify(stateToSave));
            return true;
        } catch (error) {
            ErrorLogger.log(new GameError(
                `Failed to save game state: ${error.message}`,
                'SAVE_ERROR',
                { error: error.message }
            ));
            return false;
        }
    }

    loadState() {
        try {
            const savedState = localStorage.getItem('gameState');
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                delete parsedState.timestamp; // Remove timestamp before loading
                this._state.set(parsedState);
                return true;
            }
            return false;
        } catch (error) {
            ErrorLogger.log(new GameError(
                `Failed to load game state: ${error.message}`,
                'LOAD_ERROR',
                { error: error.message }
            ));
            return false;
        }
    }

    // Debug methods
    getStateHistory(limit = 10) {
        return this._state.getHistory(limit);
    }

    getCurrentState() {
        return this._state.get();
    }

    // Private methods
    _initializeSubscriptions() {
        // Log important state changes in development
        this._state.subscribe(['currentTurn', 'playerState', 'gameOver'], (changes) => {
            if (process.env.NODE_ENV === 'development') {
                console.log('[GameState] State changed:', changes);
            }
        });

        // Auto-save on significant changes
        this._state.subscribe(['currentRoomId', 'defeatedEnemiesCount'], () => {
            this.saveState();
        });
    }
}

// Create and export singleton instance
export const gameState = new GameStateManager();