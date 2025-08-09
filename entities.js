/**
 * Game Entities Module
 * Entity definitions, creation, and pathfinding logic
 * @fileoverview Manages player, enemies, and AI entities with pathfinding
 */

import { PLAYER_STATS, BOSS_STATS, ENEMY_TYPES } from './constants.js';
import { GameUtils, MathUtils } from './utils/helpers.js';
import { ErrorLogger, EntityError, PathfindingError, Validator } from './utils/errors.js';

// --- Entités principales ---

/**
 * Base Entity class for all game entities
 * @class Entity
 */
export class Entity {
    /**
     * Creates a new entity
     * @param {number} gridX - Grid X coordinate
     * @param {number} gridY - Grid Y coordinate
     * @param {number} size - Visual size of the entity
     * @param {number} hp - Current hit points
     * @param {number} maxHp - Maximum hit points
     * @param {number} mp - Current movement points
     * @param {number} ap - Current action points
     * @param {string} type - Entity type identifier
     * @param {string|null} id - Unique identifier (auto-generated if null)
     */
    constructor(gridX, gridY, size, hp, maxHp, mp, ap, type = 'unknown', id = null) {
        this.id = id ?? GameUtils.generateId(type);
        this.gridX = gridX;
        this.gridY = gridY;
        this.size = size;
        this.hp = hp;
        this.maxHp = maxHp;
        this.mp = mp;
        this.ap = ap;
        this.maxMp = mp;
        this.maxAp = ap;
        this.aiType = type;
        this.screenX = null;
        this.screenY = null;
        this.usedSpecialThisTurn = false;

        // Validate the created entity
        try {
            Validator.validateEntity(this);
        } catch (error) {
            throw new EntityError(`Invalid entity creation: ${error.message}`, this.id, type);
        }
    }

    /**
     * Checks if this entity is alive
     * @returns {boolean} True if entity is alive
     */
    isAlive() {
        return GameUtils.isAlive(this);
    }

    /**
     * Checks if this entity is adjacent to another entity
     * @param {Entity} other - Other entity
     * @returns {boolean} True if entities are adjacent
     */
    isAdjacentTo(other) {
        return GameUtils.areAdjacent(this, other);
    }

    /**
     * Checks if this entity is within range of another entity
     * @param {Entity} other - Other entity
     * @param {number} range - Range to check
     * @returns {boolean} True if within range
     */
    isInRangeOf(other, range) {
        return GameUtils.isInRange(this, other, range);
    }

    /**
     * Gets Manhattan distance to another entity
     * @param {Entity} other - Other entity
     * @returns {number} Manhattan distance
     */
    distanceTo(other) {
        return MathUtils.manhattanDistance(this.gridX, this.gridY, other.gridX, other.gridY);
    }

    /**
     * Sanitizes entity data for safe operations
     * @returns {Object} Sanitized entity data
     */
    sanitize() {
        return GameUtils.sanitizeEntity(this);
    }
}

// Specific entity types (can inherit from Entity if needed)

/**
 * Player entity definition using constants
 * @type {Object}
 */
export let player = {
    id: 'player',
    gridX: PLAYER_STATS.STARTING_X,
    gridY: PLAYER_STATS.STARTING_Y,
    size: 28,
    hp: PLAYER_STATS.MAX_HP,
    maxHp: PLAYER_STATS.MAX_HP,
    mp: PLAYER_STATS.BASE_MAX_MP,
    maxMp: PLAYER_STATS.BASE_MAX_MP,
    ap: PLAYER_STATS.BASE_MAX_AP,
    maxAp: PLAYER_STATS.BASE_MAX_AP,
    baseMaxAp: PLAYER_STATS.BASE_MAX_AP,
    baseMaxMp: PLAYER_STATS.BASE_MAX_MP,
    baseDamage: PLAYER_STATS.BASE_DAMAGE,
    aiType: 'player',
    screenX: null,
    screenY: null,
    usedSpecialThisTurn: false
};

/**
 * Boss entity definition using constants
 * @type {Object}
 */
export let boss = {
    id: 'boss',
    gridX: 11, // Default, will be overwritten by room data
    gridY: 11,
    size: 36,
    hp: BOSS_STATS.MAX_HP,
    maxHp: BOSS_STATS.MAX_HP,
    mp: BOSS_STATS.MAX_MP,
    maxMp: BOSS_STATS.MAX_MP,
    ap: BOSS_STATS.MAX_AP,
    maxAp: BOSS_STATS.MAX_AP,
    aiType: ENEMY_TYPES.BOSS,
    screenX: null,
    screenY: null,
    usedSpecialThisTurn: false
};

// --- New Enemy Definitions ---

/**
 * Creates a new enemy entity of the specified type
 * @param {string} type - Enemy type (sheep, sheepist_noir, chef_de_guerre, boss)
 * @param {number} gridX - Grid X coordinate
 * @param {number} gridY - Grid Y coordinate
 * @returns {Object|null} Enemy entity or null if invalid type
 * @throws {EntityError} If coordinates are invalid
 */
export function createEnemy(type, gridX, gridY) {
    // Validate input parameters
    if (typeof gridX !== 'number' || typeof gridY !== 'number') {
        throw new EntityError('Invalid coordinates for enemy creation', null, type);
    }

    let enemyData;
    const id = GameUtils.generateId(type);
    
    switch (type) {
        case ENEMY_TYPES.SHEEP:
            enemyData = {
                size: 26, hp: 50, maxHp: 50, mp: 4, ap: 1, 
                image: 'sheep.png', maxMp: 4, maxAp: 1
            };
            break;
        case ENEMY_TYPES.SHEEPIST_NOIR:
            enemyData = {
                size: 24, hp: 60, maxHp: 60, mp: 6, ap: 2,
                image: 'sheepist_noir.png', maxMp: 6, maxAp: 2 
            };
            break;
        case ENEMY_TYPES.CHEF_DE_GUERRE:
             enemyData = {
                size: 30, hp: 100, maxHp: 100, mp: 4, ap: 2,
                image: 'chef.png', maxMp: 4, maxAp: 2
            };
            break;
        case ENEMY_TYPES.BOSS:
             enemyData = {
                size: 36, 
                hp: BOSS_STATS.MAX_HP, 
                maxHp: BOSS_STATS.MAX_HP, 
                mp: BOSS_STATS.MAX_MP, 
                ap: BOSS_STATS.MAX_AP,
                image: 'boss.png', 
                maxMp: BOSS_STATS.MAX_MP, 
                maxAp: BOSS_STATS.MAX_AP
            };
            break;
        default:
            ErrorLogger.log(new EntityError(`Unknown enemy type: ${type}`, id, type));
            return null;
    }

    const enemy = {
        id: id,
        gridX,
        gridY,
        ...enemyData,
        aiType: type,
        screenX: null,
        screenY: null,
        usedSpecialThisTurn: false,
    };

    // Validate created enemy
    try {
        Validator.validateEntity(enemy);
    } catch (error) {
        throw new EntityError(`Failed to create valid enemy: ${error.message}`, id, type);
    }

    return enemy;
}


// --- Dynamic State (populated by game.js) ---

// Replace static sheeps export with a dynamic state variable
// export const sheeps = [...]; 
// This will be managed in game.js as `enemiesState` or similar


// --- Pathfinding & Animation (remain the same) ---

// Pathfinding (A*)
export function findPath(startX, startY, endX, endY, entity, isTileValidAndFree, currentEntities, currentMapGrid, currentGridCols, currentGridRows, adjacentToTarget = false) {
    if (startX === endX && startY === endY) return [{x: startX, y: startY}];
    
    // Optimization check:
    const isTargetTileValid = isTileValidAndFree(endX, endY, entity, currentEntities, currentMapGrid, currentGridCols, currentGridRows);
    const isTargetObstacle = currentMapGrid[endY]?.[endX] === 1;

    // If finding path TO the target (adjacentToTarget=false):
    if (!adjacentToTarget) {
        // If the target tile itself is an obstacle, pathfinding is impossible.
        if (isTargetObstacle) {
            console.warn(`[Pathfind] Target tile (${endX}, ${endY}) is an obstacle. Path impossible.`);
            return null; 
        }
        // If the target tile is invalid ONLY because it's occupied, pathfinding should still proceed.
        // A* will find the path to the closest valid adjacent tile.
        if (!isTargetTileValid) {
             console.log(`[Pathfind] Target tile (${endX}, ${endY}) is occupied/invalid, but pathfinding towards it.`);
             // Do not return null, let A* run.
        }
    } 
    // If finding path ADJACENT to the target (adjacentToTarget=true):
    else {
         // If the target tile is an obstacle OR completely invalid (e.g., out of bounds?), finding an adjacent path might be impossible or lead to weird results depending on A* goal.
         // Let's check if the target is an obstacle specifically.
         if (isTargetObstacle) {
             console.warn(`[Pathfind Adjacent] Target tile (${endX}, ${endY}) is an obstacle. Cannot pathfind adjacent to it.`);
             return null;
         }
         // If target is just occupied, adjacent pathfinding is still possible.
    }

    const open = [];
    const closed = new Set();
    const cameFrom = {};
    const gScore = {};
    const fScore = {};
    function key(x, y) { return `${x},${y}`; }
    gScore[key(startX, startY)] = 0;
    fScore[key(startX, startY)] = Math.abs(endX - startX) + Math.abs(endY - startY);
    open.push({ x: startX, y: startY, f: fScore[key(startX, startY)] });
    while (open.length > 0) {
        open.sort((a, b) => a.f - b.f);
        const current = open.shift();

        // Goal condition check:
        let isGoal = false;
        if (adjacentToTarget) {
            // Goal: Be on a valid tile adjacent to the target.
            isGoal = (Math.abs(current.x - endX) + Math.abs(current.y - endY) === 1) && 
                     isTileValidAndFree(current.x, current.y, entity, currentEntities, currentMapGrid, currentGridCols, currentGridRows);
        } else {
            // Goal: Reach the target tile itself.
            if (current.x === endX && current.y === endY) {
                isGoal = true;
            } else {
                 // --- Fallback Goal for Approach --- 
                 // If the target tile itself is invalid (e.g., occupied), but we are trying to path TO it (adjacentToTarget=false),
                 // we accept reaching a valid tile *adjacent* to the target as the goal instead. 
                 // This allows finding a path *towards* an occupied target.
                 const targetIsOccupiedOrInvalid = !isTileValidAndFree(endX, endY, entity, currentEntities, currentMapGrid, currentGridCols, currentGridRows);
                 if (targetIsOccupiedOrInvalid) {
                    const isAdjacentToTarget = Math.abs(current.x - endX) + Math.abs(current.y - endY) === 1;
                    const isCurrentTileValid = isTileValidAndFree(current.x, current.y, entity, currentEntities, currentMapGrid, currentGridCols, currentGridRows);
                    if (isAdjacentToTarget && isCurrentTileValid) {
                        console.log(`[Pathfind] Target (${endX},${endY}) invalid, using adjacent tile (${current.x},${current.y}) as goal.`);
                        isGoal = true; 
                    }
                 }
            }
        }
        
        if (isGoal) {
            // Reconstruction starts from the tile that met the goal condition
            let path = [{ x: current.x, y: current.y }]; 
            let currKey = key(current.x, current.y);
            while (cameFrom[currKey]) {
                path.push(cameFrom[currKey]);
                currKey = key(cameFrom[currKey].x, cameFrom[currKey].y);
            }
            return path.reverse();
        }
        closed.add(key(current.x, current.y));
        const neighbors = [
            {x: current.x + 1, y: current.y},
            {x: current.x - 1, y: current.y},
            {x: current.x, y: current.y + 1},
            {x: current.x, y: current.y - 1}
        ];
        for (const n of neighbors) {
            // Pass correct arguments to isTileValidAndFree
            let isValidNeighbor = isTileValidAndFree(n.x, n.y, entity, currentEntities, currentMapGrid, currentGridCols, currentGridRows); 
            
            // If finding path adjacent to target, allow the target tile itself as a valid *neighbor* even if occupied, 
            // but don't allow moving *onto* it unless it's the final goal.
            if (adjacentToTarget && n.x === endX && n.y === endY) {
                // Check only map obstacles, ignore entities on the target tile for neighbor validity
                if (!(n.x < 0 || n.x >= currentGridCols || n.y < 0 || n.y >= currentGridRows) && currentMapGrid[n.y]?.[n.x] !== 1) {
                     isValidNeighbor = true; // Allow considering the target tile as a neighbor
                }
            }
            
            // Skip if not valid (obstacle, out of bounds, or occupied by entity - unless it's the target in adjacent mode)
            if (!isValidNeighbor) continue; 

            const nKey = key(n.x, n.y);
            if (closed.has(nKey)) continue;
            const tentativeG = gScore[key(current.x, current.y)] + 1;
            if (gScore[nKey] === undefined || tentativeG < gScore[nKey]) {
                cameFrom[nKey] = {x: current.x, y: current.y};
                gScore[nKey] = tentativeG;
                fScore[nKey] = tentativeG + Math.abs(endX - n.x) + Math.abs(endY - n.y);
                if (!open.some(o => o.x === n.x && o.y === n.y)) {
                    open.push({x: n.x, y: n.y, f: fScore[nKey]});
                }
            }
        }
    }
    return null;
}