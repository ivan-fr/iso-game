/**
 * Grid Utilities Module
 * Functions related to grid management, obstacles, conversions, pathfinding, and line of sight
 * @fileoverview Grid utilities for isometric game with pathfinding and coordinate transformations
 */

import { TILE_W, TILE_H, PROJECTILE_SPEED } from './constants.js';
import { GameUtils, PerformanceUtils } from './utils/helpers.js';
import { ErrorLogger, ValidationError } from './utils/errors.js';

// Cache for expensive calculations
const tileRangeCache = new Map();
const MAX_CACHE_SIZE = 100;
let cacheAccessCount = 0;

// --- Constants & Configuration ---

/**
 * Crée une grille vide de dimensions spécifiées.
 * @param {number} rows - Nombre de lignes.
 * @param {number} cols - Nombre de colonnes.
 * @returns {Array<Array<number>>} - Grille initialisée.
 */
/* // Unused
function createGrid(rows, cols) {
    const grid = [];
    for (let i = 0; i < rows; i++) {
        const row = new Array(cols).fill(0);
        grid.push(row);
    }
    return grid;
}
*/

/**
 * Place un obstacle dans la grille.
 * @param {Array<Array<number>>} grid - La grille.
 * @param {number} x - Coordonnée x.
 * @param {number} y - Coordonnée y.
 */
/* // Unused
function placeObstacle(grid, x, y) {
    if (grid[x] && grid[x][y] !== undefined) {
        grid[x][y] = 1;
    }
}
*/

/**
 * Convertit des coordonnées en index de tableau.
 * @param {number} x - Coordonnée x.
 * @param {number} y - Coordonnée y.
 * @param {number} cols - Nombre de colonnes.
 * @returns {number} - Index correspondant.
 */
// Used internally by getTilesInRangeBFS, no need to export
function coordsToIndex(x, y, cols) {
    return y * cols + x; // Corrected: should be y * cols + x for row-major
}

/**
 * Convertit un index de tableau en coordonnées.
 * @param {number} index - Index.
 * @param {number} cols - Nombre de colonnes.
 * @returns {Array<number>} - Coordonnées correspondantes.
 */
/* // Unused
function indexToCoords(index, cols) {
    const y = Math.floor(index / cols); // Corrected: y first
    const x = index % cols;             // Corrected: x second
    return {x, y};
}
*/

/**
 * Renvoie les voisins 4-directions hors obstacles et entités.
 * @param {number} x
 * @param {number} y
 * @param {{gridX:number,gridY:number}[]} blockingEntities
 * @returns {{x:number,y:number}[]} // Updated Return Type Documentation
 */
// Internal helper for getTilesInRangeBFS
/* // Not directly used, logic merged into getTilesInRangeBFS helper
function getNeighbors(x, y, blockingEntities = [], currentMapGrid, currentGridCols, currentGridRows) {
    const deltas = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
    const out = [];
    for (const {dx,dy} of deltas) {
        const nx = x+dx, ny = y+dy;
        if (nx<0||nx>=currentGridCols||ny<0||ny>=currentGridRows) continue;
        if (currentMapGrid[ny]?.[nx]===1) continue;
        // Consider all living entities as blockers
        if (blockingEntities.some(e => e.hp > 0 && e.gridX === nx && e.gridY === ny)) continue;
        out.push({x:nx,y:ny});
    }
    return out;
}
*/


/**
 * Implémente l'algorithme de recherche en largeur (BFS).
 * @param {Array<Array<number>>} grid - La grille.
 * @param {Array<number>} start - Point de départ [x, y].
 * @param {Array<number>} end - Point d'arrivée [x, y].
 * @returns {Array<Array<number>>|null} - Chemin trouvé ou null.
 */
/* // Unused (findPath from entities.js is used)
function bfs(grid, start, end, sheepsList = []) {
    const rows = grid.length;
    const cols = grid[0].length;
    const visited = new Set();
    const queue = [[start, [start]]];

    while (queue.length > 0) {
        const [current, path] = queue.shift();
        const [x, y] = current;

        if (x === end[0] && y === end[1]) {
            return path;
        }

        // Note: Needs the updated getNeighbors logic that considers grid/cols/rows
        // const neighbors = getNeighbors(x, y, sheepsList, grid, cols, rows); // Assuming update
        const tempNeighbors = []; // Placeholder
        for (const { x: nx, y: ny } of tempNeighbors) { // Replace with actual neighbors call
            const neighborCoords = { x: nx, y: ny };
            if (!visited.has(coordsToIndex(nx, ny, cols))) {
                visited.add(coordsToIndex(nx, ny, cols));
                queue.push([neighborCoords, [...path, neighborCoords]]);
            }
        }
    }

    return null;
}
*/

/**
 * Vérifie la ligne de vue (Line of Sight - LoS) entre deux points.
 * @param {Array<Array<number>>} grid - La grille.
 * @param {Array<number>} start - Point de départ [x, y].
 * @param {Array<number>} end - Point d'arrivée [x, y].
 * @returns {boolean} - True si la ligne de vue est dégagée, sinon false.
 */

// --- Configuration & Constants ---
// Constants are now imported from constants.js
export { TILE_W, TILE_H, PROJECTILE_SPEED };

/**
 * Dynamic camera offset variables for viewport management
 * @type {number}
 */
export let cameraOffsetX = 0;
export let cameraOffsetY = 0;
// Removed unused/game-logic constants - they belong in game.js or entities.js
// export const PLAYER_ATTACK_DAMAGE = 15;
// export const BOSS_ATTACK_DAMAGE = 10;
// export const BOSS_MAX_HP = 150;
// export const PLAYER_MAX_HP = 100;
// export const MAX_MOVE_POINTS = 6;
// export const MAX_ACTION_POINTS = 2;
// export const PLAYER_ATTACK_RANGE = 7;
// export const BOSS_ATTACK_RANGE = 5;
// export const BOSS_ATTACK_RANGE_SQ = BOSS_ATTACK_RANGE * BOSS_ATTACK_RANGE;

// Removed mapGrid export - it's managed in game.js
// export const mapGrid = ...

// --- Camera & Coordinate Transformations ---

/**
 * Updates camera offset to center the grid in the viewport
 * @param {number} canvasWidth - Canvas width in pixels
 * @param {number} canvasHeight - Canvas height in pixels  
 * @param {number} currentGridCols - Number of grid columns
 * @param {number} currentGridRows - Number of grid rows
 * @throws {ValidationError} If grid dimensions are invalid
 */
export function updateCameraOffset(canvasWidth, canvasHeight, currentGridCols, currentGridRows) {
    // Validate input parameters
    if (typeof canvasWidth !== 'number' || canvasWidth <= 0) {
        throw new ValidationError('Canvas width must be a positive number', 'canvasWidth', canvasWidth);
    }
    if (typeof canvasHeight !== 'number' || canvasHeight <= 0) {
        throw new ValidationError('Canvas height must be a positive number', 'canvasHeight', canvasHeight);
    }
    
    try {
        GameUtils.validateCoordinates(0, 0, currentGridCols, currentGridRows);
    } catch (error) {
        throw new ValidationError('Invalid grid dimensions', 'gridDimensions', { currentGridCols, currentGridRows });
    }

    // Calculate the screen position of the logical center tile
    const centerGridX = Math.floor(currentGridCols / 2);
    const centerGridY = Math.floor(currentGridRows / 2);

    // Calculate the screen pos of the center tile *without* camera offset
    const centerScreenX_noOffset = (centerGridX - centerGridY) * (TILE_W / 2);
    const centerScreenY_noOffset = (centerGridX + centerGridY) * (TILE_H / 2);

    // The desired offset makes this point appear at canvasWidth/2, canvasHeight/2
    cameraOffsetX = canvasWidth / 2 - centerScreenX_noOffset;
    // Adjust vertical offset slightly to show more ground below the center
    cameraOffsetY = canvasHeight / 2 - centerScreenY_noOffset + TILE_H * 1.5;

    console.log(`Camera Offset updated: X=${cameraOffsetX.toFixed(1)}, Y=${cameraOffsetY.toFixed(1)}`);
}

/**
 * Converts isometric grid coordinates to screen coordinates
 * @param {number} gridX - Grid X coordinate
 * @param {number} gridY - Grid Y coordinate
 * @returns {{x: number, y: number}} Screen coordinates
 */
export function isoToScreen(gridX, gridY) {
    const screenX = cameraOffsetX + (gridX - gridY) * (TILE_W / 2);
    const screenY = cameraOffsetY + (gridX + gridY) * (TILE_H / 2);
    return { x: screenX, y: screenY };
}

/**
 * Converts screen coordinates to isometric grid coordinates with boundary clamping
 * @param {number} screenX - Screen X coordinate
 * @param {number} screenY - Screen Y coordinate
 * @param {number} currentGridCols - Number of grid columns for boundary checking
 * @param {number} currentGridRows - Number of grid rows for boundary checking
 * @returns {{x: number, y: number}} Clamped grid coordinates
 */
export function screenToIso(screenX, screenY, currentGridCols, currentGridRows) {
    const adjustedX = screenX - cameraOffsetX;
    const adjustedY = screenY - cameraOffsetY;

    // Precise conversion using matrix inversion concept
    const halfTileW = TILE_W / 2;
    const halfTileH = TILE_H / 2;

    // Mathematical transformation:
    // gridX * halfTileW - gridY * halfTileW = adjustedX
    // gridX * halfTileH + gridY * halfTileH = adjustedY
    // Solving the system of equations:
    const gridX_exact = ((adjustedX / halfTileW) + (adjustedY / halfTileH)) / 2;
    const gridY_exact = ((adjustedY / halfTileH) - (adjustedX / halfTileW)) / 2;

    // Round to nearest grid integer
    const gridX = Math.round(gridX_exact);
    const gridY = Math.round(gridY_exact);

    // Clamp to grid boundaries for safety
    const clampedX = Math.max(0, Math.min(currentGridCols - 1, gridX));
    const clampedY = Math.max(0, Math.min(currentGridRows - 1, gridY));

    return { x: clampedX, y: clampedY };
}

// --- Grid Logic & Pathfinding Helpers ---

// Checks if a tile is within grid bounds, not an obstacle (type 1), and not occupied by a living entity.
export function isTileValidAndFree(x, y, movingEntity, allEntities = [], currentMapGrid, currentGridCols, currentGridRows) {
    if (x < 0 || x >= currentGridCols || y < 0 || y >= currentGridRows) return false;
    if (currentMapGrid[y]?.[x] === 1) return false; // Check current map grid for obstacle

    // Check if occupied by another living entity
    if (allEntities && Array.isArray(allEntities)) {
        for (const entity of allEntities) {
             // Skip self and dead/dying entities
            if (!entity || entity === movingEntity || entity.hp <= 0 || entity._isDying) continue;
            // Use Math.round to handle potential floating point positions during movement
            if (Math.round(x) === Math.round(entity.gridX) && Math.round(y) === Math.round(entity.gridY)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Returns the coordinates of the four tiles directly adjacent to the given coordinates.
 * Checks grid boundaries based on current dimensions.
 * @param {number} x - Center tile X coordinate.
 * @param {number} y - Center tile Y coordinate.
 * @param {number} currentGridCols - Current number of columns in the grid.
 * @param {number} currentGridRows - Current number of rows in the grid.
 * @returns {{x:number, y:number}[]} - Array of adjacent tile coordinates.
 */
export function getAdjacentTiles(x, y, currentGridCols, currentGridRows) {
    const adjacent = [];
    const deltas = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

    for (const delta of deltas) {
        const nx = x + delta.dx;
        const ny = y + delta.dy;

        // Check grid boundaries
        if (nx >= 0 && nx < currentGridCols && ny >= 0 && ny < currentGridRows) {
            adjacent.push({ x: nx, y: ny });
        }
    }
    return adjacent;
}

// Bresenham Line of Sight Algorithm
// Checks if there is an obstacle (tile type 1) or a living entity blocking the direct path.
export function hasLineOfSight(startX, startY, endX, endY, blockingEntities = [], currentMapGrid) {
    let x1 = startX, y1 = startY;
    const dx = Math.abs(endX - x1), dy = -Math.abs(endY - y1);
    const sx = x1 < endX ? 1 : -1, sy = y1 < endY ? 1 : -1;
    let err = dx + dy;

    // Convert potential float coords to integers for grid checking
    const iStartX = Math.round(startX);
    const iStartY = Math.round(startY);
    const iEndX = Math.round(endX);
    const iEndY = Math.round(endY);

    while (true) {
        const checkX = Math.round(x1);
        const checkY = Math.round(y1);

        // Don't check the start/end tiles themselves for blocking LoS
        if (!(checkX === iStartX && checkY === iStartY) && !(checkX === iEndX && checkY === iEndY)) {
            // Check map grid obstacle
            if (currentMapGrid[checkY]?.[checkX] === 1) {
                // console.log(`[LoS BLOCKED] Obstacle at (${checkX},${checkY}) between (${startX},${startY})->(${endX},${endY})`);
                return false;
            }
            // Check living blocking entities
            if (blockingEntities.some(e => e && e.hp > 0 && Math.round(e.gridX) === checkX && Math.round(e.gridY) === checkY)) {
                // console.log(`[LoS BLOCKED] Entity at (${checkX},${checkY}) between (${startX},${startY})->(${endX},${endY})`);
                return false;
            }
        }

        if (checkX === iEndX && checkY === iEndY) break; // Reached target

        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x1 += sx; }
        if (e2 <= dx) { err += dx; y1 += sy; }

        // Safety break to prevent infinite loops in edge cases
        if (Math.abs(x1 - startX) > dx * 2 || Math.abs(y1 - startY) > Math.abs(dy) * 2) {
            console.warn("[LoS] Safety break triggered.");
            break;
        }
    }
    return true; // No blocking tiles/entities found
}

/**
 * Creates a cache key for tile range calculations
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate  
 * @param {number} maxRange - Maximum range
 * @param {Array} allEntities - All entities for collision checking
 * @param {boolean} includeOrigin - Whether to include origin tile
 * @param {Array} currentMapGrid - Current map grid
 * @returns {string} Cache key
 */
function createTileRangeCacheKey(startX, startY, maxRange, allEntities, includeOrigin, currentMapGrid) {
    // Create a simplified key based on entity positions and map state
    const entityPositions = allEntities
        .filter(e => e && e.hp > 0 && !e._isDying)
        .map(e => `${e.gridX},${e.gridY}`)
        .sort()
        .join('|');
    
    return `${startX},${startY},${maxRange},${includeOrigin},${entityPositions}`;
}

// Breadth-First Search to find all reachable tiles within a given range (cost).
// Considers obstacles and living entities as blockers.
export function getTilesInRangeBFS(startX, startY, maxRange, allEntities = [], includeOrigin = false, currentMapGrid, currentGridCols, currentGridRows) {
    PerformanceUtils.startTimer('tileRangeBFS');
    
    // Check cache first
    const cacheKey = createTileRangeCacheKey(startX, startY, maxRange, allEntities, includeOrigin, currentMapGrid);
    cacheAccessCount++;
    
    if (tileRangeCache.has(cacheKey)) {
        PerformanceUtils.endTimer('tileRangeBFS');
        return tileRangeCache.get(cacheKey);
    }
    
    const visited = new Set();
    const queue = [{ x: startX, y: startY, cost: 0 }];
    const reachable = [];
    const startIdx = coordsToIndex(startX, startY, currentGridCols); // Use helper
    visited.add(startIdx);

    if (includeOrigin) reachable.push({ x: startX, y: startY, cost: 0 });

    // Inner helper function to get valid, non-blocking neighbors
    function getValidNeighbors(x, y) {
        const deltas = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
        const neighbors = [];
        // Filter allEntities once to get current blockers
        const blockers = allEntities.filter(e => e && e.hp > 0 && !e._isDying);

        for (const {dx,dy} of deltas) {
            const nx = x+dx, ny = y+dy;
            // Check bounds
            if (nx < 0 || nx >= currentGridCols || ny < 0 || ny >= currentGridRows) continue;
            // Check map obstacles
            if (currentMapGrid[ny]?.[nx] === 1) continue;
            // Check if blocked by a living entity
            if (blockers.some(e => Math.round(e.gridX) === nx && Math.round(e.gridY) === ny)) continue;
            // If all checks pass, it's a valid neighbor
            neighbors.push({x:nx,y:ny});
        }
        return neighbors;
    }

    let head = 0;
    while (head < queue.length) {
        const { x, y, cost } = queue[head++]; // More efficient than shift()

        if (cost >= maxRange) continue; // Don't explore further if max range reached

        for (const neighbor of getValidNeighbors(x, y)) {
            const nx = neighbor.x;
            const ny = neighbor.y;
            const neighborIdx = coordsToIndex(nx, ny, currentGridCols); // Use helper

            if (!visited.has(neighborIdx)) {
                visited.add(neighborIdx);
                const nextCost = cost + 1;
                reachable.push({ x: nx, y: ny, cost: nextCost });
                queue.push({ x: nx, y: ny, cost: nextCost });
            }
        }
    }
    
    // Cache the result
    if (tileRangeCache.size >= MAX_CACHE_SIZE) {
        // Simple LRU: remove oldest entry
        const firstKey = tileRangeCache.keys().next().value;
        tileRangeCache.delete(firstKey);
    }
    tileRangeCache.set(cacheKey, reachable);
    
    const bfsTime = PerformanceUtils.endTimer('tileRangeBFS');
    if (bfsTime > 5) {
        console.warn(`[Performance] Slow BFS: ${bfsTime.toFixed(2)}ms for range ${maxRange} from (${startX},${startY})`);
    }
    
    // Log cache statistics occasionally
    if (cacheAccessCount % 50 === 0) {
        console.log(`[Performance] Tile range cache: ${tileRangeCache.size} entries, ${cacheAccessCount} accesses`);
    }
    
    return reachable;
}

// Removed utility exports as they are not used externally
// export { coordsToIndex, indexToCoords };
