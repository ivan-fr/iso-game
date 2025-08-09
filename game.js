import { bossAI, chefDeGuerreAI, sheepAI, sheepistNoirAI } from './ai.js';
import { createEnemy, findPath, player } from './entities.js';
import * as gridUtils from './grid.js';
import inventoryManager from './inventory.js';
import { getRoomData } from './rooms.js';
import { SPELLS, getSelectedSpellIndex, setSelectedSpell } from './spells.js';
import { initAudioInteraction, playSound, setupSpellBarListeners, setupSpellTooltips, showMessage, stopSound, updateAllUI, updateTurnOrder } from './ui.js';
import { gameState } from './state/gameState.js';

// Assign player to window for global access
window.player = player;

// Initialize game state with player
gameState.setPlayer(player);

// Getters for backward compatibility - gradually migrate to direct gameState usage
export const getCurrentRoomId = () => gameState.currentRoomId;
export const getCurrentMapGrid = () => gameState.currentMapGrid;
export const getCurrentGridCols = () => gameState.currentGridCols;
export const getCurrentGridRows = () => gameState.currentGridRows;
export const getCurrentTurn = () => gameState.currentTurn;
export const getPlayerState = () => gameState.playerState;
export const getReachableTiles = () => gameState.reachableTiles;
export const getAttackableTiles = () => gameState.attackableTiles;
export const getIsMoving = () => gameState.isMoving;
export const getActiveEnemy = () => gameState.activeEnemy;
export const getGameOver = () => gameState.gameOver;
export const getProjectiles = () => gameState.projectiles;
export const getHoveredTile = () => gameState.hoveredTile;
export const getDamageAnimations = () => gameState.damageAnimations;
export const getBuffAnimations = () => gameState.buffAnimations;
export const getEnemiesState = () => gameState.enemiesState;
export const getBossState = () => gameState.bossState;
export const getDefeatedEnemiesCount = () => gameState.defeatedEnemiesCount;

// Lobby mode detection - in lobby we use real-time multiplayer, not turn-based
export const isInLobby = () => gameState.currentRoomId === -1;
export const isInDungeon = () => gameState.currentRoomId !== -1;

// Legacy exports for modules still using direct access - to be migrated
export let currentRoomId, currentMapGrid, currentGridCols, currentGridRows;
export let currentTurn, playerState, reachableTiles = [], attackableTiles = [];
export let isMoving, activeEnemy, gameOver, projectiles = [], hoveredTile;
export let damageAnimations = [], buffAnimations = [], scheduledActions = [];
export let defeatedEnemiesCount, enemyHoveredReachableTiles = [], hoveredEnemyId;
export let enemiesState, bossState;

// Sync function to update legacy exports when gameState changes
function syncLegacyExports() {
    currentRoomId = gameState.currentRoomId;
    currentMapGrid = gameState.currentMapGrid;
    currentGridCols = gameState.currentGridCols;
    currentGridRows = gameState.currentGridRows;
    currentTurn = gameState.currentTurn;
    playerState = gameState.playerState;
    reachableTiles = gameState.reachableTiles;
    attackableTiles = gameState.attackableTiles;
    isMoving = gameState.isMoving;
    activeEnemy = gameState.activeEnemy;
    gameOver = gameState.gameOver;
    projectiles = gameState.projectiles;
    hoveredTile = gameState.hoveredTile;
    damageAnimations = gameState.damageAnimations;
    buffAnimations = gameState.buffAnimations;
    enemiesState = gameState.enemiesState;
    bossState = gameState.bossState;
    defeatedEnemiesCount = gameState.defeatedEnemiesCount;
}

// Subscribe to state changes to keep legacy exports in sync
gameState.subscribe('*', () => {
    syncLegacyExports();
});

// Initialize legacy exports
syncLegacyExports();

// Ajout : référence au canvas et contexte
let canvas;
let ctx;

// Helper pour la LoS avec sheeps
function hasLineOfSightAllEntities(startX, startY, endX, endY) {
    return gridUtils.hasLineOfSight(startX, startY, endX, endY, [player, gameState.bossState, ...gameState.enemiesState]);
}

// Helper to get all living entities
export function getAllLivingEntities() {
    return gameState.getLivingEntities();
}

// Refactored LoS check
function hasLineOfSightWithCurrentGrid(startX, startY, endX, endY, blockingEntities) {
    return gridUtils.hasLineOfSight(startX, startY, endX, endY, blockingEntities, gameState.currentMapGrid);
}

// Wrapper function for updateAllUI
function updateAllUIWrapper() {
    updateAllUI({
        playerApDisplay: document.getElementById('player-ap'),
        playerMpDisplay: document.getElementById('player-mp'),
        bossApDisplay: document.getElementById('boss-ap'),
        bossMpDisplay: document.getElementById('boss-mp'),
        player,
        boss: gameState.bossState,
        enemiesState: gameState.enemiesState,
        enemyCountDisplay: document.getElementById('sheep-count'),
        enemyTotalDisplay: document.getElementById('sheep-total'),
        enemyHpSummaryDisplay: document.getElementById('sheep-hp-summary'),
        playerHealthBar: document.getElementById('player-health-bar'),
        bossHealthBar: document.getElementById('boss-health-bar'),
        currentTurn: gameState.currentTurn,
        isMoving: gameState.isMoving,
        activeEnemy: gameState.activeEnemy,
        playerState: gameState.playerState,
        endTurnButton: document.getElementById('end-turn-button'),
        mobileEndTurnButton: document.getElementById('mobile-end-turn-button'),
        gameOver: gameState.gameOver
    });
}

function endTurn() {
    if (gameState.isMoving || gameState.activeEnemy || gameState.gameOver || gameState.playerState !== 'idle') return;
    if (gameState.currentTurn === 'player') {
        // Reset player AP/MP at the END of their turn
        console.log("[TURN END] Resetting Player AP/MP before enemy turn.");
        player.ap = player.maxAp;
        player.mp = player.maxMp;
        player.mpReducedThisTurn = 0; // Also reset reduction flag here
        gameState.setPlayer(player); // Update state
        updateAllUIWrapper(); // Update UI to show reset values before enemy turn starts
        
        startEnemyTurns();
    } else {
        startPlayerTurn();
    }
}

function startPlayerTurn() {
    currentTurn = 'player';
    playerState = 'idle';
    activeEnemy = null;

    // Reset AP including equipment bonus
    const paBonus = (typeof inventoryManager !== 'undefined' ? inventoryManager.getStatBonus('pa') : 0);
    player.maxAp = player.baseMaxAp + paBonus;
    console.log(`[Init Trace] Inside startPlayerTurn: paBonus = ${paBonus}, calculated maxAp = ${player.maxAp}`); // Log Bonus & Max
    player.ap = player.maxAp;
    console.log("[Init Trace] Inside startPlayerTurn, after setting AP to max: player.ap =", player.ap); // Log 2

    // Reset MP, accounting for temporary reduction from last turn
    let mpReduction = player.mpReducedThisTurn || 0;
    player.mp = Math.max(0, player.maxMp - mpReduction); // Set MP to max minus reduction
    player.mpReducedThisTurn = 0; // Reset the reduction flag
    if (mpReduction > 0) {
        console.log(`[TURN START] Player MP reduced by ${mpReduction} due to effect. Starting MP: ${player.mp}`);
    }

    reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
    attackableTiles = [];
    updateAllUIWrapper();
    updateTurnOrder(currentTurn, bossState);
    playSound('turn');
    showMessage('Tour du Joueur', 1500);
}

async function startEnemyTurns() {
    currentTurn = 'enemies';
    reachableTiles = [];
            attackableTiles = [];
            updateAllUIWrapper();
    updateTurnOrder(currentTurn, bossState);
    showMessage("Tour des Ennemis", 1500);
    await new Promise(r => setTimeout(r, 500));

    const turnOrder = getAllLivingEntities().filter(e => e !== player);
    
    // --- Sort enemies by priority --- 
    const priority = {
        'boss': 1,
        'chef_de_guerre': 2,
        'sheepist_noir': 3,
        'sheep': 4
    };

    turnOrder.sort((a, b) => {
        const priorityA = priority[a.aiType] ?? 99; // Assign low priority if type unknown
        const priorityB = priority[b.aiType] ?? 99;
        return priorityA - priorityB; // Lower number = higher priority
    });

    console.log("[TURN DEBUG] Sorted Enemy Turn Order:", turnOrder.map(e => `${e.aiType} (${e.id.substring(0,4)})`));
    // -------------------------------
    
    for (const enemy of turnOrder) {
        if (gameOver) break;
        if (enemy.hp <= 0) continue;
        
        activeEnemy = enemy;
        // --- Apply START-of-turn effects --- 
        if (enemy.hasTemporaryMpBoost) {
            enemy.mp = enemy.maxMp + 2; // Apply boost immediately
            enemy.hasTemporaryMpBoost = false; // Clear flag after applying
            console.log(`[TURN START BUFF] ${enemy.id} starting turn WITH boost. Setting MP to ${enemy.mp}`);
        } else {
            // If no boost, MP is already set from previous turn end reset, or is initial value.
             console.log(`[TURN START] ${enemy.id} starting turn WITHOUT boost. Current MP: ${enemy.mp}`);
        }
        // Note: mpReducedThisTurn is reset at the END of the turn
        enemy.usedSpecialThisTurn = false;
        updateAllUIWrapper(); // Update UI with correct starting AP/MP
         console.log(`[TURN DEBUG] --- Starting turn for: ${enemy.aiType} ${enemy.id} ---`);
         
         let aiFunction;
         let attackCallback = null; 
         let specialCallback = null;
         let onRangedAttackCallback = null; // Specifically for Boss

        switch (enemy.aiType) {
            case 'sheep':
                aiFunction = sheepAI;
                attackCallback = (attacker, target) => {
                    // --- Set Casting Animation State ---
                    attacker.isCasting = true;
                    attacker.castStartTime = performance.now();
                    attacker.castingDuration = 300; 
                    console.log(`%c[CASTING FLAG SET] Enemy ${attacker.id} isCasting: ${attacker.isCasting}`, 'color: blue; font-weight: bold;');
                    // -------------------------------------
                    // Create projectile instead of dealing damage directly
                    const startX = attacker.screenX;
                    const startY = attacker.screenY - attacker.size / 2;
                    const targetX = target.screenX;
                    const targetY = target.screenY - target.size / 2;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist === 0) return; // Avoid division by zero
                    
                    const speed = gridUtils.PROJECTILE_SPEED * 1.0; // Match player speed
    projectiles.push({
                        x: startX, y: startY,
                        dx: (dx / dist) * speed, dy: (dy / dist) * speed,
                        owner: 'sheep', ownerId: attacker.id,
                        targetScreenX: targetX, targetScreenY: targetY,
                        damage: 9 + Math.floor(Math.random() * 4) // Store damage on projectile
                    });
                    // --- DEBUG LOG ---
                    console.log(`[PROJECTILE DEBUG] Added sheep projectile:`, projectiles[projectiles.length - 1]);
                    // --- END DEBUG LOG ---
                    playSound('sheep_atk'); // Assuming a sound exists
                    showMessage(`${attacker.aiType} charge !`, 900);
                    // Damage is now handled by projectile hit
                    // checkIfPlayerDefeated(target);
                    // updateAllUIWrapper();
                };
                break;
            case 'sheepist_noir':
                 aiFunction = sheepistNoirAI;
                 attackCallback = (attacker, target) => {
                    // --- Set Casting Animation State ---
                    attacker.isCasting = true;
                    attacker.castStartTime = performance.now();
                    attacker.castingDuration = 300; 
                    console.log(`%c[CASTING FLAG SET] Enemy ${attacker.id} isCasting: ${attacker.isCasting}`, 'color: blue; font-weight: bold;');
                    // -------------------------------------
                    // Create projectile instead of dealing damage directly
                    const startX = attacker.screenX;
                    const startY = attacker.screenY - attacker.size / 2;
                    const targetX = target.screenX;
                    const targetY = target.screenY - target.size / 2;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;

                    const speed = gridUtils.PROJECTILE_SPEED * 0.9; // Slightly slower?
    projectiles.push({
                        x: startX, y: startY,
                        dx: (dx / dist) * speed, dy: (dy / dist) * speed,
                        owner: 'sheepist_noir', ownerId: attacker.id,
                        targetScreenX: targetX, targetScreenY: targetY,
                        damage: 6 + Math.floor(Math.random() * 3) // Store damage
    });
                     playSound('sheepist_atk'); // Assuming a sound exists
                     showMessage(`${attacker.aiType} crache !`, 1000);
                     // Damage is now handled by projectile hit
                     // checkIfPlayerDefeated(target);
                     // updateAllUIWrapper();
                 };
                 specialCallback = (attacker, target) => {
                    // --- Set Casting Animation State ---
                    attacker.isCasting = true;
                    attacker.castStartTime = performance.now();
                    attacker.castingDuration = 300; 
                    console.log(`%c[CASTING FLAG SET] Enemy (Special) ${attacker.id} isCasting: ${attacker.isCasting}`, 'color: blue; font-weight: bold;');
                    // -------------------------------------
                    console.log(`[MP REMOVAL DEBUG] Special callback triggered by ${attacker.id} on ${target.id}. Target MP before: ${target.mp}`);
                    // Find the special spell used (Crachat Gênant)
                    const specialSpell = SPELLS.find(s => s.name === 'Crachat Gênant');
                    if (!specialSpell || specialSpell.effect !== 'removeMP') { 
                        console.error("sheepist Noir specialCallback: Could not find or verify 'Crachat Gênant' spell.");
        return;
    }
                    console.log(`[MP REMOVAL DEBUG] Spell found: ${specialSpell.name}, effectValue: ${specialSpell.effectValue}`);
                    // Use effectValue from the spell definition
                     const removedMP = Math.min(target.mp, specialSpell.effectValue || 0); 
                     if (removedMP > 0) {
                        console.log(`[MP REMOVAL DEBUG] Removing ${removedMP} MP.`);
                        target.mp -= removedMP;
                        // Set a temporary flag/value on the target for start-of-turn adjustment
                        target.mpReducedThisTurn = (target.mpReducedThisTurn || 0) + removedMP;
                        // Show debuff animation
                        showBuffAnimation(target, `-${removedMP} PM`, '#e74c3c'); // Red color for debuffs
                        console.log(`[MP REMOVAL DEBUG] Target MP after: ${target.mp}, Marked for reduction: ${target.mpReducedThisTurn}`);
                        showMessage(`${attacker.aiType} retire ${removedMP} PM !`, 1000);
    updateAllUIWrapper();
                     } else {
                        console.log(`[MP REMOVAL DEBUG] No MP removed (Target MP: ${target.mp}, Removed MP would be: ${removedMP})`);
                     }
                 };
                break;
            case 'chef_de_guerre':
                 aiFunction = chefDeGuerreAI;
                 attackCallback = (attacker, target) => {
                     // --- Set Casting Animation State ---
                     attacker.isCasting = true;
                     attacker.castStartTime = performance.now();
                     attacker.castingDuration = 300; 
                     console.log(`%c[CASTING FLAG SET] Enemy ${attacker.id} isCasting: ${attacker.isCasting}`, 'color: blue; font-weight: bold;');
                     // -------------------------------------
                      // Melee attack: 2AP cost assumed handled by AI
                      const dmg = 20 + Math.floor(Math.random() * 6); // 20-25 damage
                      target.hp -= dmg;
                      // Pass GRID coordinates, not screen coordinates
                      showDamageAnimation(target.gridX, target.gridY, dmg, '#e74c3c'); 
                      showMessage(`${attacker.aiType} frappe fort ! (-${dmg} HP)`, 1000);
                      checkIfPlayerDefeated(target);
                      updateAllUIWrapper();
                 };
                 specialCallback = (attacker, targetAlly) => {
                     // --- Set Casting Animation State ---
                     attacker.isCasting = true;
                     attacker.castStartTime = performance.now();
                     attacker.castingDuration = 300; 
                     console.log(`%c[CASTING FLAG SET] Enemy (Special) ${attacker.id} isCasting: ${attacker.isCasting}`, 'color: blue; font-weight: bold;');
                     // -------------------------------------
                      // Support spell: 2AP cost assumed handled by AI
                      if (!targetAlly) {
                          console.error("ChefDeGuerre specialCallback: targetAlly is missing!");
        return;
    }
                      const addedMP = 2;
                      // Add 2 MP directly, potentially exceeding maxMp temporarily
                      const actualAddedMP = addedMP; 
                      
                        if (actualAddedMP > 0) {
                          // targetAlly.mp += actualAddedMP; // REMOVED - Don't add directly
                          // Flag the boost amount for removal at end of ally's turn
                          // targetAlly.temporaryMpBoost = (targetAlly.temporaryMpBoost || 0) + actualAddedMP; // REMOVED - Use a flag instead
                          targetAlly.hasTemporaryMpBoost = true; // SET FLAG - Apply boost next turn
                          console.log(`[BUFF DEBUG] Flagged ${targetAlly.id} for temporary MP boost next turn.`);
                          // Show animation on the buffed ally
                          showBuffAnimation(targetAlly, `+${actualAddedMP} MP`, '#2ecc71'); // Green color for buffs
                          showMessage(`${attacker.aiType} motive ${targetAlly.aiType} ${targetAlly.id.substring(0,4)} ! (+${actualAddedMP} PM / Now: ${targetAlly.mp})`, 1200); // Show new total
    updateAllUIWrapper();
                        } else {
                            // This branch should technically not be reached if we always add 2
                            console.warn("ChefDeGuerre specialCallback: actualAddedMP was 0, this shouldn't happen?");
                        }
                 };
                break;
            case 'boss':
                aiFunction = bossAI;
                attackCallback = async (attacker, target) => {
                    // --- Set Casting Animation State ---
                    attacker.isCasting = true;
                    attacker.castStartTime = performance.now();
                    attacker.castingDuration = 300; 
                    console.log(`%c[CASTING FLAG SET] Enemy ${attacker.id} isCasting: ${attacker.isCasting}`, 'color: blue; font-weight: bold;');
                    // -------------------------------------
                    const spellM = SPELLS.find(s => s.bossOnly && s.range === 1);
                    if (spellM) {
                        const dmg = spellM.damage();
                        target.hp -= dmg;
                        // Pass GRID coordinates, not screen coordinates
                        showDamageAnimation(target.gridX, target.gridY, dmg, spellM.color);
                        showMessage(`Le Boss frappe au corps à corps ! (-${dmg} HP)`, 1000);
                         checkIfPlayerDefeated(target);
                        updateAllUIWrapper();
                         await new Promise(r => setTimeout(r, 500));
                    }
                 };
                 // Define the ranged attack callback specific to the Boss
                 onRangedAttackCallback = async (targetCoords) => {
                     // --- Set Casting Animation State ---
                     // Assuming bossState is the attacker here
                     if (bossState) { // Check if boss exists
                         bossState.isCasting = true;
                         bossState.castStartTime = performance.now();
                         bossState.castingDuration = 300; 
                         console.log(`%c[CASTING FLAG SET] Enemy ${bossState.id} isCasting: ${bossState.isCasting}`, 'color: blue; font-weight: bold;');
                     }
                     // -------------------------------------
                      // Find the ranged spell ("Boule de Feu")
                      const spellR = SPELLS.find(s => s.name === 'Boule de Feu');
                      if (!spellR) {
                          console.error("Boss AI: Could not find 'Boule de Feu' spell!");
                          return;
                      }
                      // Check AP Cost (now 1)
                      if (bossState.ap < spellR.cost) {
                          console.log("[AI Ranged] Boss cannot afford Boule de Feu.");
                          return;
                      }
                      
                      bossState.ap -= spellR.cost; // Deduct AP
                      updateAllUIWrapper();
                      
                      // Create projectile
                      const startX = bossState.screenX;
                      const startY = bossState.screenY - bossState.size / 2;
                      // targetCoords is {x, y} grid coords from the plan
                      const targetScreenPos = gridUtils.isoToScreen(targetCoords.x, targetCoords.y); 
                      const targetX = targetScreenPos.x;
                      // Aim slightly higher than feet for visual center
                      const targetY = targetScreenPos.y - (player.size / 2); 
 
                      const dx = targetX - startX;
                      const dy = targetY - startY;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      if (dist === 0) return;
 
                      const projectileDx = (dx / dist) * (gridUtils.PROJECTILE_SPEED * 0.8);
                      const projectileDy = (dy / dist) * (gridUtils.PROJECTILE_SPEED * 0.8);
 
                      projectiles.push({
                          x: startX, y: startY,
                          dx: projectileDx, dy: projectileDy,
                          owner: 'boss', ownerId: bossState.id,
                          targetScreenX: targetX, targetScreenY: targetY, 
                          damage: spellR.damage(), // Store damage from spell
                          color: spellR.color // Store color from spell
                      });
                      console.log("[AI Ranged] Boss launched Boule de Feu.");
                      showMessage('Le Boss lance Boule de Feu!', 1000);
                      // Projectile hit handles damage application
                      await new Promise(r => setTimeout(r, 100)); // Small delay after firing
                  };
                break;
            default:
                console.warn(`Unknown AI type for enemy ${enemy.id}: ${enemy.aiType}`);
                continue;
        }

        console.log(`[TURN DEBUG] Awaiting AI for ${enemy.aiType} ${enemy.id}...`);
        await new Promise(resolve => {
            if (enemy.aiType === 'sheep') {
                aiFunction(
                    enemy,
                    animateEntityFullPath,
                    attackCallback,
                    resolve,
                    getAllLivingEntities(),
                    currentMapGrid,
                    currentGridCols,
                    currentGridRows
                );
            } else {
                // Handle Boss call separately to pass correct callbacks
                if (enemy.aiType === 'boss') {
                    aiFunction(
                        enemy,                  // boss instance
                        animateEntityFullPath,  // Pass the new function
                        attackCallback,         // melee callback
                        onRangedAttackCallback, // *** CORRECT RANGED CALLBACK ***
                        resolve,                // completion callback
                        getAllLivingEntities(),
                        currentMapGrid,
                        currentGridCols,
                        currentGridRows
                    );
                } else { // Other enemies (sheepist Noir, Chef)
                    aiFunction(
                        enemy, 
                        animateEntityFullPath,  // Pass the new function
                        attackCallback,         // Regular attack (ranged for sheepist)
                        specialCallback,        // Special ability (MP remove / MP buff)
                        resolve,
                        getAllLivingEntities(),
                        currentMapGrid,
                        currentGridCols,
                        currentGridRows
                    );
                }
            }
        });
        console.log(`[TURN DEBUG] AI promise resolved for ${enemy.aiType} ${enemy.id}.`);
        
        // --- Reset AP/MP AFTER turn completes --- 
        enemy.ap = enemy.maxAp; // Reset AP to max
        enemy.mp = enemy.maxMp; // Reset MP to max (boost is handled at start of next turn)
        enemy.mpReducedThisTurn = 0; // Reset debuff flag
        console.log(`[TURN END] ${enemy.id} finished turn. Resetting AP to ${enemy.ap}, MP to ${enemy.mp}.`);
        // ------------------------------------------

        console.log(`--- Fin tour: ${enemy.aiType} ${enemy.id} ---`);
        activeEnemy = null;
        updateAllUIWrapper();
         if (!gameOver) await new Promise(r => setTimeout(r, 300));
    }

    if (!gameOver) {
        startPlayerTurn();
    }
}

function handleCanvasClick(event) {
    if (gameOver || isMoving) return;
    
    // In lobby mode, allow free movement without turn restrictions
    if (isInLobby()) {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const clickX = (event.clientX - rect.left) * dpr;
        const clickY = (event.clientY - rect.top) * dpr;
        
        let clickedGrid = gridUtils.screenToIso(clickX, clickY, currentGridCols, currentGridRows);
        console.log(`[LOBBY CLICK] Screen Click: (${clickX.toFixed(1)}, ${clickY.toFixed(1)}) -> ISO Grid: (${clickedGrid.x}, ${clickedGrid.y})`);
        
        // Check if the target tile is valid and free (not an obstacle or portal)
        if (gridUtils.isTileValidAndFree(clickedGrid.x, clickedGrid.y, player, getAllLivingEntities(), currentMapGrid, currentGridCols, currentGridRows)) {
            moveEntityToLobby(player, clickedGrid.x, clickedGrid.y);
        } else {
            // Check if it's a portal
            const roomData = getRoomData(currentRoomId);
            if (roomData && roomData.dungeonPortals) {
                const portal = roomData.dungeonPortals.find(p => p.gridX === clickedGrid.x && p.gridY === clickedGrid.y);
                if (portal) {
                    showPortalPrompt(portal);
                    return;
                }
            }
            showMessage('Cannot move there - tile blocked.');
        }
        return;
    }
    
    // Original dungeon mode logic (turn-based)
    if (currentTurn !== 'player' || activeEnemy) return;
    const rect = canvas.getBoundingClientRect(); // rect.left/top are relative to viewport
    
    // Scale mouse click coordinates from CSS pixels to canvas drawing surface pixels
    const dpr = window.devicePixelRatio || 1;
    const clickX = (event.clientX - rect.left) * dpr;
    const clickY = (event.clientY - rect.top) * dpr;
    
    let foundEntity = null;
    getAllLivingEntities().forEach(entity => {
        if (entity === player) return;
        const sx = entity.screenX ?? gridUtils.isoToScreen(entity.gridX, entity.gridY).x;
        const sy = entity.screenY ?? gridUtils.isoToScreen(entity.gridX, entity.gridY).y;
        const radius = entity.size * 0.6;
        if (Math.pow(clickX - sx, 2) + Math.pow(clickY - (sy - entity.size / 2), 2) < radius * radius) {
            foundEntity = entity;
    }
    });

    let clickedGrid = gridUtils.screenToIso(clickX, clickY, currentGridCols, currentGridRows);
    console.log(`[CLICK DEBUG] Screen Click: (${clickX.toFixed(1)}, ${clickY.toFixed(1)}) -> ISO Grid: (${clickedGrid.x}, ${clickedGrid.y})`);

    if (playerState === 'idle') {
        const targetTile = reachableTiles.find(tile => tile.x === clickedGrid.x && tile.y === clickedGrid.y && tile.cost <= player.mp);
        if (targetTile) {
            moveEntityTo(player, targetTile.x, targetTile.y);
        } else {
            showMessage('Case invalide ou hors de portée.');
        }
    } else if (playerState === 'aiming') {
          // --- Determine Effective Target Tile (ALWAYS use hoveredTile now) --- 
          let effectiveTargetTile = null;
          if (hoveredTile) { // Check if mouse is over a valid tile
              effectiveTargetTile = { ...hoveredTile }; // Use tile under cursor
              console.log(`[AIM DEBUG] Using hoveredTile: (${effectiveTargetTile.x},${effectiveTargetTile.y})`);
          } else {
               console.log(`[AIM DEBUG] Aiming click with no valid tile hovered.`);
               // Existing logic handles cancellation if effectiveTargetTile is null
          }
          // --- End Determine Effective Target Tile ---

          const spell = SPELLS[getSelectedSpellIndex()];
          // Removed console log comparing hovered vs clicked grid as it's less relevant now
          // console.log(`[AIM DEBUG] Aiming click. Using Hovered: (${effectiveTargetTile?.x}, ${effectiveTargetTile?.y}) instead of Clicked Grid: (${clickedGrid.x},${clickedGrid.y})`);

          // 1. Check if we have a valid effective target tile
          if (!effectiveTargetTile) {
              console.log("[AIM DEBUG] Clicked while not hovering over a valid tile.");
              showMessage('Visée annulée (clic hors grille?)', 1500);
              playerState = 'idle';
              attackableTiles = [];
              reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
              updateAllUIWrapper();
              return;
          }

          // 2. Check if the EFFECTIVE target tile is in attackableTiles
          const targetIsAttackable = attackableTiles.find(tile => tile.x === effectiveTargetTile.x && tile.y === effectiveTargetTile.y);

          if (targetIsAttackable) {
               console.log(`[AIM DEBUG] Effective target tile (${effectiveTargetTile.x},${effectiveTargetTile.y}) is in attackableTiles.`);
              // 3. Check LoS to the EFFECTIVE target tile
              const losToTile = hasLineOfSightWithCurrentGrid(player.gridX, player.gridY, effectiveTargetTile.x, effectiveTargetTile.y, getAllLivingEntities());
              
              if (losToTile) {
                   console.log(`[AIM DEBUG] LoS valid. Targeting effective tile (${effectiveTargetTile.x},${effectiveTargetTile.y}).`);
                   // 4. Execute attack on the EFFECTIVE target tile
                   playerAttack(effectiveTargetTile.x, effectiveTargetTile.y);
                    playerState = 'idle';
                    reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
                    attackableTiles = [];
              } else {
                   // LoS failed
                   console.log("[AIM DEBUG] Clicked attackable tile blocked by LoS.");
                   showMessage('Obstacle bloque la vue !');
                   // Cancel aiming state but don't end turn or reset tiles
                   playerState = 'idle'; 
                   attackableTiles = [];
                   reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
                   updateAllUIWrapper(); // Update UI to show movement tiles again
                   return; // Stop further processing for this click
              }
          } else {
               // Clicked tile not in attackable list (out of range or invalid)
               console.log(`[AIM DEBUG] Effective target tile (${effectiveTargetTile.x},${effectiveTargetTile.y}) is not attackable (out of range or invalid).`);
               showMessage('Case invalide ou hors de portée.');
               // Cancel aiming state
               playerState = 'idle';
               attackableTiles = [];
               reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
               updateAllUIWrapper(); // Update UI
               return; // Stop further processing
          }

          // Update UI regardless
          updateAllUIWrapper();
    }
}

function handleKeyDown(e) {
    if (["1","2","3"].includes(e.key)) {
        setSelectedSpell(parseInt(e.key) - 1);
        updateAllUIWrapper();
        return;
    }
    if (gameOver || currentTurn !== 'player' || isMoving || activeEnemy) return;
    if (e.key === ' ' || e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (playerState === 'idle' && player.ap > 0) {
            playerState = 'aiming';
            const spell = SPELLS[getSelectedSpellIndex()];
            const range = spell.range ?? gridUtils.PLAYER_ATTACK_RANGE;
            let allTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, range, [], true, currentMapGrid, currentGridCols, currentGridRows);
            attackableTiles = allTiles.filter(tile => hasLineOfSightWithCurrentGrid(player.gridX, player.gridY, tile.x, tile.y, getAllLivingEntities()));
            reachableTiles = [];
            showMessage('Mode Visée: Cliquez case bleue pour tirer (Echap pour annuler)', 3000);
        } else if (playerState === 'aiming') {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
            showMessage('Visée annulée', 1500);
        }
        updateAllUIWrapper();
    } else if (e.key === 'Escape') {
        if (playerState === 'aiming') {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
            showMessage('Visée annulée', 1500);
            updateAllUIWrapper();
        }
    } else if (e.key.toLowerCase() === 'f') {
        if (playerState === 'idle') {
            endTurn();
        }
    }
}

function playerAttack(targetGridX, targetGridY) {
    const spell = SPELLS[getSelectedSpellIndex()];
    if (player.ap < spell.cost) {
        showMessage('Pas assez de PA!');
        return;
    }

    // --- Set Casting Animation State for Player ---
    player.isCasting = true;
    player.castStartTime = performance.now();
    player.castingDuration = 300; // Same duration as before
    console.log(`%c[CASTING FLAG SET] Player ${player.id} isCasting: ${player.isCasting}, Time: ${player.castStartTime.toFixed(0)}`, 'color: green; font-weight: bold;');
    // ---------------------------------------------

    player.ap -= spell.cost;
    updateAllUIWrapper();

    const startX = player.screenX;
    const startY = player.screenY - player.size / 2;
    const targetPos = gridUtils.isoToScreen(targetGridX, targetGridY);
    const targetX = targetPos.x;
    const targetY = targetPos.y;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Calculate projectile speed and travel time
    const speed = spell.push ? gridUtils.PROJECTILE_SPEED * 1.5 : gridUtils.PROJECTILE_SPEED;
    const travelTimeMs = (dist > 0) ? (dist / speed) * (1000 / 60) : 0; // Approx ms, assuming 60fps base for speed units

    // Create visual projectile (remove effect-specific data if not needed for visuals)
    projectiles.push({
        x: startX, y: startY,
        dx: (dist > 0) ? (dx / dist) * speed : 0, 
        dy: (dist > 0) ? (dy / dist) * speed : 0,
        owner: 'player', // Keep for visual styling
        targetScreenX: targetX, 
        targetScreenY: targetY, 
        spellIndex: getSelectedSpellIndex() // Keep for visual styling
    });

    // Schedule the actual spell effect
    const executionTime = performance.now() + travelTimeMs;
    scheduledActions.push({
        type: 'applySpellEffect',
        executionTime,
        data: { 
            casterId: player.id, // Store caster ID for potential future use
            targetGridX, // Original target grid coords
            targetGridY,
            spell: spell // Pass the spell object itself
        }
    });
    console.log(`[Scheduler] Scheduled 'applySpellEffect' for ${spell.name} at ${targetGridX},${targetGridY} in ${travelTimeMs.toFixed(0)}ms`);

    playSound('spell');
    showMessage(`Sort lancé : ${spell.name}`, 1000);
}

// Simple Easing Function (Quadratic In/Out) - needed by animateEntityFullPath
function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// NEW Function: Animates entity smoothly along an entire path
function animateEntityFullPath(entity, path, onComplete) {
    if (!path || path.length < 2) {
        if (onComplete) onComplete();
        return;
    }

    isMoving = true;
    playSound('move'); // Play sound once for the whole movement

    const totalSegments = path.length - 1;
    const TILE_W = gridUtils.TILE_W; // Assuming TILE_W is accessible or passed
    const TILE_H = gridUtils.TILE_H; // Assuming TILE_H is accessible or passed

    // Calculate total duration based on total path length
    const totalDuration = 100 * totalSegments + 60 * totalSegments * (40 / TILE_W); // Base duration + per-segment time

    console.log(`[ANIM PATH DEBUG] Starting anim for ${entity.id}. Path length: ${path.length}, Segments: ${totalSegments}, Duration: ${totalDuration.toFixed(0)}ms`);

    const startTime = performance.now();

    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / totalDuration);

        // === Handle final step explicitly ===
        if (progress === 1) {
            console.log(`[ANIM PATH DEBUG] Progress reached 1. Snapping to final position.`);
            const finalNode = path[path.length - 1];
            entity.gridX = finalNode.x;
            entity.gridY = finalNode.y;
            const finalScreen = gridUtils.isoToScreen(finalNode.x, finalNode.y);
            entity.screenX = finalScreen.x;
            entity.screenY = finalScreen.y;
            console.log(`[ANIM PATH DEBUG] Final snapped screenX=${entity.screenX.toFixed(1)}, screenY=${entity.screenY.toFixed(1)}`);

            isMoving = false;
            stopSound('move');
            if (onComplete) onComplete();
            // Exit the step function early
            return; 
        }
        // ===================================

        const easedProgress = easeInOutQuad(progress); // Use the easing function

        console.log(`[ANIM PATH DEBUG] Step: Elapsed=${elapsed.toFixed(0)}, Progress=${progress.toFixed(3)}, Eased=${easedProgress.toFixed(3)}`);

        // Determine current segment and progress within that segment
        const totalProgressScaled = easedProgress * totalSegments;
        const currentSegmentIndex = Math.min(Math.floor(totalProgressScaled), totalSegments - 1); 
        const progressWithinSegment = totalProgressScaled - currentSegmentIndex;

        // Ensure indices are valid
        const pathIndex = Math.min(currentSegmentIndex, totalSegments - 1); // Clamp index to valid range
        console.log(`[ANIM PATH DEBUG] SegmentIndex=${pathIndex}, ProgressInSegment=${progressWithinSegment.toFixed(3)}`);

        const startNode = path[currentSegmentIndex]; // Use clamped index
        const endNode = path[currentSegmentIndex + 1]; // Use clamped index + 1

        if (!startNode || !endNode) { // Safety check if path is malformed
            console.error("Invalid path segment during animation:", path, pathIndex);
            isMoving = false;
            stopSound('move');
            if (onComplete) onComplete();
            return;
        }

        // Convert grid coords to screen coords for interpolation
        const startScreen = gridUtils.isoToScreen(startNode.x, startNode.y);
        const endScreen = gridUtils.isoToScreen(endNode.x, endNode.y);

        // Interpolate screen position
        entity.screenX = startScreen.x + (endScreen.x - startScreen.x) * progressWithinSegment;
        entity.screenY = startScreen.y + (endScreen.y - startScreen.y) * progressWithinSegment;

        console.log(`[ANIM PATH DEBUG] Updated screenX=${entity.screenX.toFixed(1)}, screenY=${entity.screenY.toFixed(1)}`);

        // Update logical grid position only at the very end (or maybe when crossing segments? simpler for now)

        // Continue animation if progress < 1 (this condition is now only met if the explicit check above didn't return)
        requestAnimationFrame(step); 
    }

    requestAnimationFrame(step);
}

function moveEntityTo(entity, targetGridX, targetGridY, forceMove = false) {
    const allEntities = getAllLivingEntities();
    const path = findPath(entity.gridX, entity.gridY, targetGridX, targetGridY, entity, 
                        (x, y, ent, entities, grid, cols, rows) => gridUtils.isTileValidAndFree(x, y, ent, entities, grid, cols, rows),
                        allEntities, 
                        currentMapGrid,
                        currentGridCols,
                        currentGridRows);
    
    if (!path || path.length < 2) {
        console.log("No path found or already at destination.");
        return; 
    }
    
    const cost = path.length - 1;
    if (!forceMove && (isMoving || cost > entity.mp || gameOver || (entity === player && playerState !== 'idle'))) {
         console.log("Move prevented:", {isMoving, cost, mp: entity.mp, gameOver, playerState});
        return; 
    }
    
    if (!forceMove) entity.mp -= cost;

    // Use the new full path animation function
    // isMoving is set inside animateEntityFullPath
    animateEntityFullPath(entity, path, () => {
        if (entity === player) {
            reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
            
            // Check for portal interactions
            checkPortalInteraction(targetGridX, targetGridY);
        }
        // isMoving is reset inside animateEntityFullPath
        updateAllUIWrapper();
    });
}

// Lobby movement function - no MP cost, no turn restrictions
function moveEntityToLobby(entity, targetGridX, targetGridY) {
    const allEntities = getAllLivingEntities();
    const path = findPath(entity.gridX, entity.gridY, targetGridX, targetGridY, entity, 
                        (x, y, ent, entities, grid, cols, rows) => gridUtils.isTileValidAndFree(x, y, ent, entities, grid, cols, rows),
                        allEntities, 
                        currentMapGrid,
                        currentGridCols,
                        currentGridRows);
    
    if (!path || path.length < 2) {
        console.log("No path found or already at destination.");
        return; 
    }
    
    if (isMoving) {
        console.log("Already moving, ignoring new movement request.");
        return;
    }

    console.log(`[LOBBY MOVE] Moving ${entity.id} from (${entity.gridX}, ${entity.gridY}) to (${targetGridX}, ${targetGridY})`);

    // Use the new full path animation function
    // isMoving is set inside animateEntityFullPath
    animateEntityFullPath(entity, path, () => {
        if (entity === player) {
            // Check for portal interactions
            checkPortalInteraction(targetGridX, targetGridY);
            
            // Send position update to other players in multiplayer
            sendPlayerPositionUpdate(targetGridX, targetGridY);
        }
        // isMoving is reset inside animateEntityFullPath
        updateAllUIWrapper();
    });
}

// Send player position update to multiplayer server
function sendPlayerPositionUpdate(gridX, gridY) {
    // Check if multiplayer client is available and connected
    if (typeof window.multiplayerClient !== 'undefined' && window.multiplayerClient && window.multiplayerClient.isConnected) {
        console.log(`[MULTIPLAYER] Sending position update: (${gridX}, ${gridY})`);
        window.multiplayerClient.sendGameAction({
            type: 'move',
            position: { gridX, gridY },
            roomId: currentRoomId
        });
    }
}

// Check if player moved onto a portal tile
function checkPortalInteraction(gridX, gridY) {
    const roomData = getRoomData(currentRoomId);
    if (!roomData) return;

    // Check dungeon portals (lobby to dungeons)
    if (roomData.dungeonPortals) {
        const portal = roomData.dungeonPortals.find(p => p.gridX === gridX && p.gridY === gridY);
        if (portal) {
            showPortalPrompt(portal);
            return;
        }
    }

    // Check exit portals (dungeons back to lobby)
    if (roomData.exitPortal && roomData.exitPortal.gridX === gridX && roomData.exitPortal.gridY === gridY) {
        showMessage("Returning to lobby...", 1500);
        setTimeout(() => {
            loadRoom(roomData.exitPortal.targetRoom);
        }, 1000);
    }
}

// Show portal interaction prompt
function showPortalPrompt(portal) {
    const message = `Enter ${portal.name}?\n${portal.description}\n\nPress 'E' to enter or move away to cancel.`;
    showMessage(message, 5000);
    
    // Add temporary keydown listener for portal entry
    const portalKeyHandler = (e) => {
        if (e.key.toLowerCase() === 'e') {
            e.preventDefault();
            showMessage(`Entering ${portal.name}...`, 1500);
            setTimeout(() => {
                loadRoom(portal.targetRoom);
            }, 1000);
            window.removeEventListener('keydown', portalKeyHandler);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            showMessage("Portal entry cancelled.", 1000);
            window.removeEventListener('keydown', portalKeyHandler);
        }
    };
    
    window.addEventListener('keydown', portalKeyHandler);
    
    // Auto-remove listener after 10 seconds
    setTimeout(() => {
        window.removeEventListener('keydown', portalKeyHandler);
    }, 10000);
}

function showDamageAnimation(x, y, value, color = '#ffec3d') {
    damageAnimations.push({ x, y, value, color, alpha: 1, time: 0, duration: 900 });
    playSound('damage');
}

// Pass an optional color for tinting effect
function showDeathAnimation(entity, duration = 500, deathColor = '#ffffff') {
    console.log(`Starting death animation for ${entity.name || entity.id}`);
    entity._isDying = true;
    entity._deathStartTime = performance.now();
    entity._deathDuration = duration;
    entity._deathColor = deathColor; // Store the color

    // Initialize animation properties immediately
    entity._deathAlpha = 1.0; // Start fully opaque
    entity._deathScale = 1.0; // Start at normal size
    entity._deathTintAmount = 0.0; // Start with no tint

    // Set final state for logic if needed (e.g., prevent targeting)
    if (entity.id !== 'player') {
        // Remove non-player entities immediately from turn order/targeting logic
        // but keep them visible for the animation.
                entity.hp = 0;
        entity.isRemoved = true; // Flag for logic, not drawing
    } else {
        entity.hp = 0; // Player HP should also be set to 0 immediately for UI/logic
    }

    // The actual visual changes will happen in the update loop based on these properties
}

function updateDeathAnimation(entity) {
    if (!entity._isDying) return false; // Not dying

    const now = performance.now();
    const elapsedTime = now - entity._deathStartTime;
    const duration = entity._deathDuration;
    // Use an easing function for smoother animation (e.g., easeOutQuad)
    const tRaw = Math.min(elapsedTime / duration, 1); // Raw progress (0 to 1)
    const tEaseOut = tRaw * (2 - tRaw); // Apply ease-out quadratic

    // Fade out
    entity._deathAlpha = 1 - tEaseOut;
    // Shrink more significantly
    entity._deathScale = 1 - 0.8 * tEaseOut; // Scale from 1 down to 0.2
    // Increase tint effect over time
    entity._deathTintAmount = tEaseOut * 0.8; // Tint up to 80%

    // --- DEBUG LOG --- 
    console.log(`[Death Anim ${entity.id}] t:${tRaw.toFixed(2)}, easeT:${tEaseOut.toFixed(2)}, alpha:${entity._deathAlpha.toFixed(2)}, scale:${entity._deathScale.toFixed(2)}, tint:${entity._deathTintAmount.toFixed(2)}`);
    // --- END DEBUG LOG ---

    if (tRaw >= 1) { // Check raw progress for completion
        console.log(`Death animation finished for ${entity.name || entity.id}`);
        entity._isDying = false;
        // If it was the player, trigger game over state here or elsewhere
        if(entity.id === 'player') {
            // Player HP is already 0, Game over state is handled elsewhere
            console.log("Player death animation finished.");
    }
        // Non-player entities are already marked as removed from logic
        return true; // Animation finished
    }
    return false; // Animation ongoing
}

function updateProjectiles() {
    if (!projectiles || projectiles.length === 0) return;
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.dx;
        p.y += p.dy;

        let projectileRemoved = false;

        // --- Collision Check (prioritize this over reaching target) ---
        if (p.owner !== 'player') {
            // Check collision specifically with the player's current position
            if (player && player.hp > 0 && player.screenX && player.screenY) {
                 // Check distance between projectile's current position (p.x, p.y) 
                 // and the player's current hitbox center (player.screenX, player.screenY - player.size / 2)
                const distance = Math.hypot(p.x - player.screenX, p.y - (player.screenY - player.size / 2));
                const collisionThreshold = player.size * 0.6; // Use a reasonable collision radius

                if (distance < collisionThreshold) {
                    console.log(`[PROJECTILE HIT] Enemy ${p.ownerId} projectile collided with player.`);
                    // Apply damage stored on the projectile
                    const damage = p.damage || 0;
                    if (damage > 0) {
                        player.hp -= damage;
                        showDamageAnimation(player.gridX, player.gridY, damage, p.color || '#ff4d4d');
                        console.log(` -> Dealt ${damage} damage. Player HP: ${player.hp}/${player.maxHp}`);
                        playSound('hit');
                        if (player.hp <= 0) {
                            player.hp = 0;
                            checkIfPlayerDefeated(player);
                        }
                    } else {
                        console.log(` -> Projectile had no damage property.`);
                    }
                    updateAllUIWrapper();
                    projectiles.splice(i, 1); // Remove projectile on hit
                    projectileRemoved = true;
                    continue; // Move to next projectile
                }
            }
        }
        // --- End Collision Check ---

        // --- Check if projectile reached target destination (if not removed by collision) ---
        if (!projectileRemoved && Math.hypot(p.x - p.targetScreenX, p.y - p.targetScreenY) < 15) {
            if (p.owner === 'player') {
                // Player projectile reached target. Remove visual only.
                console.log(`[Projectile Vis] Player projectile reached target. Removing visual.`);
            } else {
                // Enemy projectile reached destination without hitting player.
                console.log(`[Projectile Vis] Enemy projectile (${p.ownerId}) reached target without collision.`);
            }
            projectiles.splice(i, 1);
             projectileRemoved = true;
        }
        // --- End Reaching Target Check ---

        // Optional: Add lifetime expiry check here if needed

    }
}

function checkIfPlayerDefeated(entity) {
    if (entity.id === 'player' && entity.hp <= 0 && !gameOver) {
        gameOver = true;
        console.log("GAME OVER - Player defeated.");
        playSound('gameover');
        // Call the new end match screen function from script.js
        if (typeof window.showEndMatchScreen === 'function') {
            const finalScore = player.score || 0;
            // Pass false for isVictory, the score, and the enemy counts
            window.showEndMatchScreen(false, finalScore, defeatedEnemiesCount);
        } else {
            console.error("window.showEndMatchScreen is not defined! Falling back to simple message.");
            showMessage("Game Over!", 5000); // Fallback
        }
        updateAllUIWrapper(); // Still update UI to reflect game over state
    }
}

function checkVictory() {
    if (gameOver) return;
    const livingEnemies = getAllLivingEntities().filter(e => e !== player);
    if (livingEnemies.length === 0) {
        // Victory condition met for the current room
        console.log(`[Victory] Room ${currentRoomId} cleared. Checking next room...`);
        showMessage(`Salle ${currentRoomId + 1} terminée !`, 2500);
        // Reset enemy count for the next room before showing the screen
        const scoreForThisRoom = player.score || 0; // Capture score before potential reset
        const dropsForThisRoom = { ...defeatedEnemiesCount }; // Capture drops before reset
        defeatedEnemiesCount = { sheep: 0, sheepist_noir: 0, chef_de_guerre: 0, sheep_royal: 0 }; // Reset for next room

        const completedRoomId = currentRoomId;
        currentRoomId++; // Increment ID ready for the *next* room load
        console.log(`[Victory] Incremented currentRoomId to: ${currentRoomId}`);
        const nextRoom = getRoomData(currentRoomId);
        console.log(`[Victory] getRoomData(${currentRoomId}) returned:`, nextRoom ? 'Data OK' : 'NULL/UNDEFINED');

        // Call the end match screen function
        if (typeof window.showEndMatchScreen === 'function') {
            // Pass true for isVictory, the score, and the *captured* enemy counts for this room
            window.showEndMatchScreen(true, scoreForThisRoom, dropsForThisRoom);
            // The 'Next Room' button in the modal will now handle calling loadRoom(currentRoomId)
        } else {
            console.error("window.showEndMatchScreen is not defined! Cannot show victory screen.");
            // Fallback if the function isn't found
            if (nextRoom) {
                showMessage('Salle suivante...', 2000);
                setTimeout(() => loadRoom(currentRoomId), 2500); // Fallback to auto-load
            } else {
                gameOver = true;
                showMessage('VICTOIRE FINALE ! Toutes les salles terminées !', 5000);
            }
        }
        updateAllUIWrapper(); // Update UI regardless
    }
}

function bossAttackPlayer() {
    const startX = bossState.screenX;
    const startY = bossState.screenY - bossState.size / 2;
    const playerScreenPos = gridUtils.isoToScreen(player.gridX, player.gridY);
    player.screenX = playerScreenPos.x;
    player.screenY = playerScreenPos.y;
    const targetX = player.screenX;
    const targetY = player.screenY - player.size / 2;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;
    const projectileDx = (dx / dist) * (gridUtils.PROJECTILE_SPEED * 0.8);
    const projectileDy = (dy / dist) * (gridUtils.PROJECTILE_SPEED * 0.8);
    projectiles.push({
        x: startX, y: startY,
        dx: projectileDx, dy: projectileDy,
        owner: 'boss', ownerId: bossState.id,
        targetScreenX: targetX, targetScreenY: targetY,
    });
    showMessage('Le Boss attaque ! ', 1000);
}

export function gameTick() {
    updateProjectiles();

    // Update ongoing damage text animations
    if (damageAnimations && damageAnimations.length > 0) {
        for (let i = damageAnimations.length - 1; i >= 0; i--) {
            const anim = damageAnimations[i];
            anim.time = (anim.time ?? 0) + 16; // Ensure time exists, approximate time per frame
            if (anim.time > anim.duration) damageAnimations.splice(i, 1);
        }
    }

    // NEW: Update ongoing buff text animations
    if (buffAnimations && buffAnimations.length > 0) {
        for (let i = buffAnimations.length - 1; i >= 0; i--) {
            const anim = buffAnimations[i];
            anim.time = (anim.time ?? 0) + 16; // Approximate time per frame
            if (anim.time > anim.duration) {
                buffAnimations.splice(i, 1);
            }
        }
    }

    // --- Update and cleanup death animations ---
    // Create a list of all entities currently in the game, including those potentially dying
    const allCurrentEntities = [player]; 
    if (bossState) allCurrentEntities.push(bossState);
    allCurrentEntities.push(...enemiesState); // Include all enemies, even if hp=0 but animating

    const finishedEntities = []; // Keep track of entities whose animation just finished

    // Iterate over ALL current entities to update animations
    for (const entity of allCurrentEntities) {
        if (entity._isDying) {
            const finished = updateDeathAnimation(entity);
            if (finished && entity.id !== 'player') { // Only queue non-player entities for removal
                finishedEntities.push(entity);
            }
        }
    }

    // Remove entities whose death animation has finished
    if (finishedEntities.length > 0) {
        console.log(`[GC] Removing ${finishedEntities.length} entities after death animation:`, finishedEntities.map(e => e.id));
        enemiesState = enemiesState.filter(e => !finishedEntities.some(fe => fe.id === e.id));
        if (bossState && finishedEntities.some(fe => fe.id === bossState.id)) {
            console.log(`[GC] Boss ${bossState.id} removed.`);
            bossState = null;
        }
        // REMOVED: checkVictory() here was redundant and caused room skipping.
        // Victory is checked when HP drops to 0 in applySpellEffect or similar.
        // Update UI elements that depend on entity lists (like enemy count)
        updateAllUIWrapper();
    }

    // --- Process Scheduled Actions --- NEW SECTION ---
    const now = performance.now();
    if (scheduledActions && scheduledActions.length > 0) {
        for (let i = scheduledActions.length - 1; i >= 0; i--) {
            const action = scheduledActions[i];
            if (now >= action.executionTime) {
                console.log(`[Scheduler] Executing action: ${action.type}`);
                try {
                    switch (action.type) {
                        case 'applySpellEffect':
                            applySpellEffect(action.data);
                            break;
                        // Add other action types here if needed later
                        default:
                            console.warn(`[Scheduler] Unknown action type: ${action.type}`);
                    }
                } catch (error) {
                    console.error(`[Scheduler] Error executing action ${action.type}:`, error, action.data);
                }
                scheduledActions.splice(i, 1); // Remove executed action
            }
        }
    }
    // --- End Scheduled Actions ---
}

// --- Touch Event Handlers ---
let lastTouchEndTime = 0; // Used to distinguish single taps from other gestures if needed

function handleTouchStart(event) {
    event.preventDefault();
    if (gameOver || isMoving || activeEnemy) return;

    const touch = event.touches[0];
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const touchX = (touch.clientX - rect.left) * dpr;
    const touchY = (touch.clientY - rect.top) * dpr;

    // Simulate hover for spell previews on touch start
    const grid = gridUtils.screenToIso(touchX, touchY, currentGridCols, currentGridRows);
    hoveredTile = { x: grid.x, y: grid.y };
    // Update enemy hover based on this new hoveredTile (mimicking part of canvasMouseMoveHandler)
    updateEnemyHoverReachableTiles(hoveredTile); 
    // No direct action on touchstart, wait for touchend for tap, or touchmove for drag-hover
}

function handleTouchMove(event) {
    event.preventDefault();
    if (gameOver || isMoving || activeEnemy) return;

    const touch = event.touches[0];
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const touchX = (touch.clientX - rect.left) * dpr;
    const touchY = (touch.clientY - rect.top) * dpr;
    
    const grid = gridUtils.screenToIso(touchX, touchY, currentGridCols, currentGridRows);
    hoveredTile = { x: grid.x, y: grid.y };
    updateEnemyHoverReachableTiles(hoveredTile);
}

function handleTouchEnd(event) {
    event.preventDefault();
    if (gameOver || currentTurn !== 'player' || isMoving || activeEnemy) return;

    // Basic tap detection (can be improved with time/move thresholds)
    const touch = event.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const touchX = (touch.clientX - rect.left) * dpr;
    const touchY = (touch.clientY - rect.top) * dpr;

    // Process this touch as a "click" action
    // The logic is very similar to handleCanvasClick, so we can call a shared function
    // or duplicate the relevant parts. For now, let's adapt the core logic.
    
    let clickedGrid = gridUtils.screenToIso(touchX, touchY, currentGridCols, currentGridRows);
    console.log(`[TOUCH DEBUG] Touch End (Tap): (CSS: ${touch.clientX.toFixed(1)},${touch.clientY.toFixed(1)}) -> (Canvas: ${touchX.toFixed(1)}, ${touchY.toFixed(1)}) -> ISO Grid: (${clickedGrid.x}, ${clickedGrid.y})`);

    // --- Logic adapted from handleCanvasClick ---
    if (playerState === 'idle') {
        const targetTile = reachableTiles.find(tile => tile.x === clickedGrid.x && tile.y === clickedGrid.y && tile.cost <= player.mp);
        if (targetTile) {
            moveEntityTo(player, targetTile.x, targetTile.y);
        } else {
            showMessage('Case invalide ou hors de portée.');
        }
    } else if (playerState === 'aiming') {
          let effectiveTargetTile = null;
          if (hoveredTile) { // Use the tile that was being hovered over (set by touchstart/touchmove)
              effectiveTargetTile = { ...hoveredTile };
              console.log(`[TOUCH AIM DEBUG] Using hoveredTile for attack: (${effectiveTargetTile.x},${effectiveTargetTile.y})`);
          } else {
              // Fallback to the exact touchend location if no hover info (less likely with current setup)
              effectiveTargetTile = { ...clickedGrid };
               console.log(`[TOUCH AIM DEBUG] No hoveredTile, using touchend location: (${effectiveTargetTile.x},${effectiveTargetTile.y})`);
          }

          if (!effectiveTargetTile) { // Should not happen if logic is correct
              console.log("[TOUCH AIM DEBUG] No effective target tile for attack.");
              showMessage('Visée annulée.', 1500);
              playerState = 'idle';
              attackableTiles = [];
              reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
              updateAllUIWrapper();
              return;
          }

          const targetIsAttackable = attackableTiles.find(tile => tile.x === effectiveTargetTile.x && tile.y === effectiveTargetTile.y);

          if (targetIsAttackable) {
              const losToTile = hasLineOfSightWithCurrentGrid(player.gridX, player.gridY, effectiveTargetTile.x, effectiveTargetTile.y, getAllLivingEntities());
              if (losToTile) {
                   playerAttack(effectiveTargetTile.x, effectiveTargetTile.y);
                    playerState = 'idle';
                    reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
                    attackableTiles = [];
              } else {
                   showMessage('Obstacle bloque la vue !');
                   playerState = 'idle'; 
                   attackableTiles = [];
                   reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
              }
          } else {
               showMessage('Case invalide ou hors de portée.');
               playerState = 'idle';
               attackableTiles = [];
               reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
          }
          updateAllUIWrapper();
    }
    // --- End Logic adapted from handleCanvasClick ---
    
    // Reset hoveredTile after action
    // hoveredTile = null; 
    // enemyHoveredReachableTiles = []; // Also clear enemy hover highlights
    // hoveredEnemyId = null;
    // updateAllUIWrapper(); // Update UI to remove hover effects
}

// Helper function to update enemy hover state, extracted from canvasMouseMoveHandler
function updateEnemyHoverReachableTiles(currentHoveredTile) {
    let foundHoveredEnemy = null;
    const entities = getAllLivingEntities();

    if (currentHoveredTile) {
        for (const entity of entities) {
            if (entity === player || entity._isDying) continue;
            if (entity.gridX === currentHoveredTile.x && entity.gridY === currentHoveredTile.y) {
                foundHoveredEnemy = entity;
                break;
            }
        }
    }
    
    if (foundHoveredEnemy && foundHoveredEnemy.mp > 0) {
        if (hoveredEnemyId !== foundHoveredEnemy.id) { 
            const blockers = entities.filter(e => e.id !== foundHoveredEnemy.id && e.hp > 0);
            enemyHoveredReachableTiles = gridUtils.getTilesInRangeBFS(
                foundHoveredEnemy.gridX, 
                foundHoveredEnemy.gridY, 
                foundHoveredEnemy.mp, 
                blockers, 
                false,
                currentMapGrid, 
                currentGridCols, 
                currentGridRows
            );
            hoveredEnemyId = foundHoveredEnemy.id;
        }
    } else {
        if (hoveredEnemyId !== null) { 
            enemyHoveredReachableTiles = [];
            hoveredEnemyId = null;
        }
    }
}


// --- RESTORED FUNCTIONS START ---
function setupInputHandlers() {
    window.addEventListener('keydown', handleKeyDown);
    if (canvas) {
        // Mouse Listeners
        canvas.removeEventListener('click', handleCanvasClick);
        canvas.addEventListener('click', handleCanvasClick);
        
        canvas.removeEventListener('mousemove', canvasMouseMoveHandler);
        canvas.addEventListener('mousemove', canvasMouseMoveHandler); 
        
        canvas.removeEventListener('mouseleave', canvasMouseLeaveHandler);
        canvas.addEventListener('mouseleave', canvasMouseLeaveHandler);

        // Touch Listeners
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });

        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

        canvas.removeEventListener('touchend', handleTouchEnd);
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        
        canvas.removeEventListener('touchcancel', handleTouchEnd); // Treat cancel like end for simplicity
        canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }
    const endTurnButton = document.getElementById('end-turn-button');
    if (endTurnButton) { // Desktop End Turn Button
        const newButton = endTurnButton.cloneNode(true); // Re-clone to ensure no duplicate listeners if run multiple times
        if(endTurnButton.parentNode) endTurnButton.parentNode.replaceChild(newButton, endTurnButton);
        newButton.addEventListener('click', () => { if (playerState === 'idle' && !activeEnemy && !isMoving && !gameOver) endTurn(); });
    }

    // Mobile - Toggle Aim Button
    const mobileToggleAimBtn = document.getElementById('mobile-toggle-aim-button');
    if (mobileToggleAimBtn) {
        mobileToggleAimBtn.removeEventListener('click', toggleAimState); // Remove previous if any
        mobileToggleAimBtn.addEventListener('click', toggleAimState);
    }

    // Mobile - End Turn Button
    const mobileEndTurnBtn = document.getElementById('mobile-end-turn-button');
    if (mobileEndTurnBtn) {
        mobileEndTurnBtn.removeEventListener('click', endTurnMobileHandler); // Remove previous if any
        mobileEndTurnBtn.addEventListener('click', endTurnMobileHandler);
    }
}

// Wrapper for mobile end turn to match condition of desktop button
function endTurnMobileHandler() {
    if (playerState === 'idle' && !activeEnemy && !isMoving && !gameOver) {
        endTurn();
    }
}

// Function to toggle aiming state (callable by button)
export function toggleAimState() {
    if (gameOver || currentTurn !== 'player' || isMoving || activeEnemy) return;

    if (playerState === 'idle' && player.ap > 0) {
        playerState = 'aiming';
        const spell = SPELLS[getSelectedSpellIndex()];
        // Ensure PLAYER_ATTACK_RANGE is available or use spell.range directly
        const range = spell.range ?? gridUtils.PLAYER_ATTACK_RANGE; // Fallback, though PLAYER_ATTACK_RANGE was removed from grid.js
        let allTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, range, [], true, currentMapGrid, currentGridCols, currentGridRows);
        attackableTiles = allTiles.filter(tile => hasLineOfSightWithCurrentGrid(player.gridX, player.gridY, tile.x, tile.y, getAllLivingEntities()));
        reachableTiles = []; // Clear movement tiles
        showMessage('Mode Visée (Touchez pour tirer, Touchez Viser pour annuler)', 3000);
    } else if (playerState === 'aiming') {
        playerState = 'idle';
        attackableTiles = [];
        reachableTiles = gridUtils.getTilesInRangeBFS(player.gridX, player.gridY, player.mp, getAllLivingEntities(), false, currentMapGrid, currentGridCols, currentGridRows);
        showMessage('Visée annulée', 1500);
    }
    updateAllUIWrapper();
}

function canvasMouseMoveHandler(event) {
             if (gameOver) return;
 
            const rect = canvas.getBoundingClientRect();
            // Scale mouse move coordinates from CSS pixels to canvas drawing surface pixels
            const dpr = window.devicePixelRatio || 1;
            const mouseX = (event.clientX - rect.left) * dpr;
            const mouseY = (event.clientY - rect.top) * dpr;
    
    // --- Update hoveredTile --- 
    const grid = gridUtils.screenToIso(mouseX, mouseY, currentGridCols, currentGridRows);
    hoveredTile = { x: grid.x, y: grid.y };
    
    // --- Update Enemy Hover Reachable Tiles --- 
    let foundHoveredEnemy = null;
    const entities = getAllLivingEntities(); // Get current list

    // NEW LOGIC: Check if the hovered *tile* contains an enemy
    if (hoveredTile) {
        for (const entity of entities) {
            if (entity === player) continue; // Don't hover player
            if (entity._isDying) continue; // Don't hover dying entities

            // Check if entity's grid position matches the hovered tile
            if (entity.gridX === hoveredTile.x && entity.gridY === hoveredTile.y) {
                foundHoveredEnemy = entity;
                break; // Found the entity on this tile
            }
        }
    }
    // --- End NEW LOGIC ---
    
    if (foundHoveredEnemy && foundHoveredEnemy.mp > 0) {
        // Avoid recalculating if already hovering over the same enemy
        if (hoveredEnemyId !== foundHoveredEnemy.id) { 
            const blockers = entities.filter(e => e.id !== foundHoveredEnemy.id && e.hp > 0); // Exclude self from blockers
            enemyHoveredReachableTiles = gridUtils.getTilesInRangeBFS(
                foundHoveredEnemy.gridX, 
                foundHoveredEnemy.gridY, 
                foundHoveredEnemy.mp, 
                blockers, 
                false, // includeOrigin = false
                currentMapGrid, 
                currentGridCols, 
                currentGridRows
            );
            hoveredEnemyId = foundHoveredEnemy.id;
            console.log(`[HOVER DEBUG] Calculated ${enemyHoveredReachableTiles.length} reachable tiles for ${hoveredEnemyId}`);
            // --- DEBUG DRAW BOUNDING BOX --- 
            // if (ctx) { // Check if ctx is available (might not be on initial load)
            //    ctx.save();
            //    ctx.strokeStyle = 'red';
            //    ctx.lineWidth = 1;
            //    ctx.strokeRect(minX, minY, imgWidth, imgHeight);
            //    ctx.restore();
            // }
            // --- END DEBUG --- 
        }
            } else {
        // Clear if not hovering over an enemy or enemy has 0 MP
        if (hoveredEnemyId !== null) { 
             console.log(`[HOVER DEBUG] Clearing enemy reachable tiles.`);
            enemyHoveredReachableTiles = [];
            hoveredEnemyId = null;
        }
    }
}

function canvasMouseLeaveHandler() {
            hoveredTile = null;
    // Also clear enemy hover when mouse leaves canvas
    if (hoveredEnemyId !== null) { 
        console.log(`[HOVER DEBUG] Clearing enemy reachable tiles on mouse leave.`);
        enemyHoveredReachableTiles = [];
        hoveredEnemyId = null;
    }
}

function resizeCanvas() {
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = window.innerWidth;
    const cssHeight = window.innerHeight;

    // Set the actual drawing surface size based on DPR for sharpness
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;

    // Set the CSS size of the canvas so it visually occupies window.innerWidth/Height
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    
    // The camera offset logic should use the full DPR-scaled canvas dimensions
    // because all drawing (isoToScreen outputs) will happen in this larger coordinate space.
    // Game logic (TILE_W, entity grid positions) remains independent of DPR.
    // Mouse/Touch events (clientX/Y) are in CSS pixels and will be scaled before screenToIso.
    if (currentGridCols > 0) {
        gridUtils.updateCameraOffset(canvas.width, canvas.height, currentGridCols, currentGridRows);
    }

    // Update screen coordinates for all entities after resize.
    // isoToScreen will correctly use the cameraOffset that's aware of the DPR-scaled canvas.
    const entitiesToResize = [player];
    if(bossState) entitiesToResize.push(bossState);
    entitiesToResize.push(...enemiesState); 

    entitiesToResize.forEach(entity => {
        if (!entity) return; 
        const screenPos = gridUtils.isoToScreen(entity.gridX, entity.gridY);
        entity.screenX = screenPos.x;
        entity.screenY = screenPos.y;
    });

    console.log(`Canvas resized to: ${canvas.width}x${canvas.height} (CSS: ${cssWidth}x${cssHeight}, DPR: ${dpr})`);
}

function loadRoom(roomId) {
    console.log(`[LoadRoom] Received request to load roomId: ${roomId}`);
    console.log(`Loading room ${roomId}...`);
    const roomData = getRoomData(roomId);
    console.log(`[LoadRoom] getRoomData(${roomId}) returned:`, roomData ? 'Data OK' : 'NULL/UNDEFINED');
    if (!roomData) {
        console.error(`Room data not found for ID: ${roomId}`);
        gameOver = true;
        showMessage("Erreur: Salle introuvable!");
        return;
    }

    currentRoomId = roomId;
    currentMapGrid = roomData.mapGrid;
    currentGridCols = roomData.cols;
    currentGridRows = roomData.rows;

    // Update camera offset FIRST based on new grid dimensions
    // Ensure canvas exists before accessing width/height
    if (canvas) {
        gridUtils.updateCameraOffset(canvas.width, canvas.height, currentGridCols, currentGridRows);
            } else {
        // If canvas isn't ready yet, maybe defer offset update or use defaults?
        console.warn("Canvas not ready during loadRoom, camera offset might be incorrect initially.");
    }

    projectiles = [];
    damageAnimations = [];
    enemiesState = [];
    bossState = null;
            hoveredTile = null;
    isMoving = false;
    activeEnemy = null;
    gameOver = false;

    // Set player properties
    player.gridX = roomData.playerStart.x;
    player.gridY = roomData.playerStart.y;
    player.hp = player.maxHp; // Assuming maxHp is already correct
    player.mp = player.maxMp;
    player.ap = player.baseMaxAp; // Set to base AP initially
    console.log("[Init Trace] Inside loadRoom, after setting base AP: player.ap =", player.ap); // Log 1
    const playerScreenPos = gridUtils.isoToScreen(player.gridX, player.gridY);
    player.screenX = playerScreenPos.x;
    player.screenY = playerScreenPos.y;
    
    // Update player stats UI AFTER player object is updated
    if (typeof window.updatePlayerStatsUI === 'function') {
        console.log("[LoadRoom] Calling window.updatePlayerStatsUI().");
        window.updatePlayerStatsUI(player); // Pass the imported player object
    } else {
        console.error("[LoadRoom] window.updatePlayerStatsUI is not defined!");
    }

    roomData.enemies.forEach(enemyInfo => {
        const enemy = createEnemy(enemyInfo.type, enemyInfo.gridX, enemyInfo.gridY);
        if (enemy) {
            const screenPos = gridUtils.isoToScreen(enemy.gridX, enemy.gridY);
            enemy.screenX = screenPos.x;
            enemy.screenY = screenPos.y;
            if (enemy.aiType === 'boss') {
                bossState = enemy;
            } else {
                enemiesState.push(enemy);
            }
        }
    });

    startPlayerTurn();

    showMessage(`Bienvenue: ${roomData.name}`, 3000);
}

export function initGame(startingRoomId = 0) {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error("Canvas element not found!");
        return;
    }
    ctx = canvas.getContext('2d');

    resizeCanvas(); // Initial resize
    window.addEventListener('resize', resizeCanvas);

    setupInputHandlers();
    setupSpellBarListeners(setSelectedSpell, getSelectedSpellIndex, SPELLS, showMessage, updateAllUIWrapper);
    setupSpellTooltips(SPELLS);
    initAudioInteraction();

    loadRoom(startingRoomId); // Load starting room (lobby by default)

    // Expose necessary functions and variables globally for script.js interaction
    window.currentGame = {
        loadRoom: loadRoom,
        getRoomData: getRoomData, // Add getRoomData for portal drawing
        get currentRoomId() { return currentRoomId; } // Use getter to ensure it reflects updates
        // Add other things if needed later, like player object reference?
        // playerRef: player
    };
    console.log("Game functions exposed on window.currentGame");

    // Apply stats from initially equipped items
    if (typeof window.updatePlayerStatsUI === 'function') {
        console.log("Applying initial equipment stats...");
        window.updatePlayerStatsUI(player); // Use the globally accessible player object
    } else {
        console.warn("window.updatePlayerStatsUI not found during initGame. Initial stats may not be applied.");
    }
    console.log("[Init Trace] End of initGame, final check: player.ap =", player.ap); // Log 4
}

// NEW Function: Show Buff Animation (+MP, +AP, etc.)
function showBuffAnimation(entity, text, color = '#2ecc71', duration = 1000) {
    if (!entity || !entity.screenX || !entity.screenY) {
        console.warn("[showBuffAnimation] Invalid entity or missing screen coordinates.");
        return;
    }
    buffAnimations.push({
        x: entity.screenX, 
        y: entity.screenY - entity.size / 2, // Start above entity head
        text: text,
        color: color,
        alpha: 1,
        time: 0,
        duration: duration,
        startY: entity.screenY - entity.size / 2 // Store initial Y for upward movement
    });
    // playSound('buff'); // Optional: Add a buff sound effect later
}

// NEW Function: Applies spell effects after projectile animation (visual only)
function applySpellEffect(data) {
    // Retrieve data passed by the scheduler
    const { casterId, spell, targetGridX, targetGridY } = data;
    
    // Find the caster and target(s) at the time of execution
    const caster = getAllLivingEntities().find(e => e.id === casterId);
    if (!caster) {
        console.warn(`[Effect Apply] Caster ${casterId} no longer exists or is invalid.`);
        return; // Can't apply effect without a caster
    }

    let affectedEntities = [];
    const allLiving = getAllLivingEntities(); // Get current list

    if (spell.aoe) {
         // Find all living entities within the AoE centered on the target tile
         const affectedTiles = [
              {x: targetGridX, y: targetGridY}, {x: targetGridX + 1, y: targetGridY},
              {x: targetGridX - 1, y: targetGridY}, {x: targetGridX, y: targetGridY + 1},
              {x: targetGridX, y: targetGridY - 1}
         ];
         allLiving.forEach(entity => {
             // Check if entity is on an affected tile and is not the caster (unless spell allows self-target)
             if (entity.id !== casterId && affectedTiles.some(t => t.x === entity.gridX && t.y === entity.gridY)) {
                  if (entity.hp > 0 && !entity._isDying) { // Only affect living, non-dying entities
                      affectedEntities.push(entity);
                  }
              }
          });
     } else {
         // Single Target: Find the living, non-dying entity at the exact target grid coordinates
         const targetEntity = allLiving.find(entity => 
              entity.gridX === targetGridX && 
              entity.gridY === targetGridY &&
              entity.hp > 0 && 
              !entity._isDying &&
              entity.id !== casterId // Can't target self unless explicitly allowed
         );
         if (targetEntity) { 
             affectedEntities.push(targetEntity);
         }
     }

    console.log(`[Effect Apply] Spell: ${spell.name}, Caster: ${caster.id}, Targets Found: ${affectedEntities.length}`);

    // Apply effects to all found targets
    affectedEntities.forEach(target => {
        // Ensure target is still valid before applying effects
        if (!target || target.hp <= 0 || target._isDying) {
            console.log(`[Effect Apply] Skipping effects for invalid/dead target ${target?.id}`);
            return; // Skip to next target
        }

        // --- Damage Calculation --- (Restored/Ensured Correct Placement)
        if (spell.damage) {
            let baseDamage = typeof spell.damage === 'function' ? spell.damage() : spell.damage; // Handle function or value
            let bonusDamage = 0;
            // Add caster's damage bonus if caster is player
            if (caster.id === 'player') {
                // Ensure damageBonus exists on the caster (player) object
                bonusDamage = caster.damageBonus || 0; 
            }
            
            const totalDamage = baseDamage + bonusDamage + Math.floor(Math.random() * (spell.damageVariance || 0));

            // Apply damage to the current target in the loop
            target.hp -= totalDamage;
            showDamageAnimation(target.gridX, target.gridY, totalDamage, '#ff4d4d'); // Use target's actual grid pos for anim
            playSound('hit');
            console.log(`[DAMAGE] ${caster.id} hit ${target.id} with ${spell.id || spell.name} for ${totalDamage} damage. HP: ${target.hp}/${target.maxHp}`);

            // --- Check Defeat --- (Restored/Ensured Correct Placement)
            if (target.hp <= 0) {
                target.hp = 0;
                if (target.id === 'player') {
                    checkIfPlayerDefeated(target);
                } else {
                    if (defeatedEnemiesCount.hasOwnProperty(target.aiType)) {
                        defeatedEnemiesCount[target.aiType]++;
                        console.log(`[DEFEAT TRACKING] Incremented count for ${target.aiType}. New count:`, defeatedEnemiesCount);
                    }
                    showDeathAnimation(target);
                    checkVictory(); // Check victory ONLY when an enemy is defeated
                }
                 // If target is defeated by damage, skip subsequent effects like push for this target
                 console.log(`[Effect Apply] Target ${target.id} defeated by damage, skipping further effects.`);
                 return; 
            }
        }

        // --- Push Calculation --- (Restored/Ensured Correct Placement)
        // Check if the spell has a push effect AND if the current target is the one at the center of the cast
        if (spell.push && target.gridX === targetGridX && target.gridY === targetGridY) {
            // Ensure the target is still alive after potential damage
            if (target.hp > 0) {
                console.log(`[Effect Apply] Applying push from spell '${spell.name}' to ${target.id}`);
                applyPush(target, caster.gridX, caster.gridY, spell.push);
            } else {
                 console.log(`[Effect Apply] Skipping push for defeated target ${target.id}`);
            }
        }

        // --- Other effects (like MP removal) --- 
        // Add other spell effects here if needed

    }); // End forEach affectedEntities

    updateAllUIWrapper(); // Update UI once after all effects for all targets are processed
}

// --- Apply Push Function (Should already be present) ---
function applyPush(entityToPush, pusherGridX, pusherGridY, pushDistance) {
     let dx = entityToPush.gridX - pusherGridX;
     let dy = entityToPush.gridY - pusherGridY;
     if (dx === 0 && dy === 0) dx = 1; // Default push direction if on same tile
     // Determine primary axis
     if (Math.abs(dx) > Math.abs(dy)) { dx = Math.sign(dx); dy = 0; }
     else { dy = Math.sign(dy); dx = 0; }
 
     let currentX = entityToPush.gridX;
     let currentY = entityToPush.gridY;
     let pushedSteps = 0;
     let collisionDamage = 0;
     const collisionBonus = 10 + Math.floor(Math.random() * 6);
 
     console.log(`[Push ${entityToPush.id}] Start: (${entityToPush.gridX},${entityToPush.gridY}). Direction: (${dx},${dy}). Pusher: (${pusherGridX},${pusherGridY}). Distance: ${pushDistance}`);
 
     for (let step = 0; step < pushDistance; step++) {
         const nextX = currentX + dx;
         const nextY = currentY + dy;
 
         const blockers = getAllLivingEntities().filter(e => e !== entityToPush);
         // Use the grid utility function to check validity
         const isFree = gridUtils.isTileValidAndFree(nextX, nextY, entityToPush, blockers, currentMapGrid, currentGridCols, currentGridRows);
         console.log(`[Push ${entityToPush.id}] Step ${step + 1}: Checking (${nextX},${nextY}). Is Free: ${isFree}`);
 
         if (!isFree) {
             console.log(`[Push ${entityToPush.id}] Tile (${nextX},${nextY}) is blocked. Stopping push.`);
             // Check if blocker is another entity (that is still alive)
             const blockerEntity = blockers.find(e => e.hp > 0 && Math.round(e.gridX) === nextX && Math.round(e.gridY) === nextY);
             if (blockerEntity) {
                console.log(`[Push ${entityToPush.id}] Blocked by entity: ${blockerEntity.id}`);
                // Apply collision damage to BOTH entities
                collisionDamage = collisionBonus;
                // Damage blocker immediately (with slight delay for visual timing)
                setTimeout(() => {
                    if (blockerEntity.hp <= 0) return; // Check if already dead
                    console.log(`[Push Collision] Applying collision damage ${collisionDamage} to blocker ${blockerEntity.id}`);
                    blockerEntity.hp -= collisionDamage;
                    showDamageAnimation(blockerEntity.gridX, blockerEntity.gridY, collisionDamage, '#d63031');
                    checkIfPlayerDefeated(blockerEntity); // Check if blocker was player
                    if (blockerEntity.hp <= 0) {
                        blockerEntity.hp = 0;
                        showDeathAnimation(blockerEntity, 1500, '#d63031');
                    }
                    updateAllUIWrapper(); // Update UI after damage
                }, 50); 
             } else {
                console.log(`[Push ${entityToPush.id}] Blocked by map obstacle.`);
                // Only apply collision damage to pushed entity if hitting map obstacle
                collisionDamage = collisionBonus;
             }
             break; // Stop pushing
         }
         // If free, update current position for the next step check
         currentX = nextX;
         currentY = nextY;
         pushedSteps++;
     }
 
     console.log(`[Push ${entityToPush.id}] Total pushed steps: ${pushedSteps}. Final Target: (${currentX},${currentY})`);
 
     // Only call moveEntityTo if the entity was actually pushed somewhere
     if (pushedSteps > 0) {
         console.log(`[Push ${entityToPush.id}] Calling moveEntityTo (${currentX},${currentY}) with forceMove=true.`);
         // Use the final calculated currentX, currentY after the loop
         moveEntityTo(entityToPush, currentX, currentY, true); 
     }
 
     // Apply collision damage to the PUSHED entity (if any collision occurred)
     if (collisionDamage > 0) {
         console.log(`[Push ${entityToPush.id}] Collision detected! Damage: ${collisionDamage}.`);
         // Apply damage after potential movement animation finishes 
         setTimeout(() => {
             if (entityToPush.hp <= 0) return; // Check if already dead
             console.log(`[Push Collision] Applying collision damage ${collisionDamage} to pushed entity ${entityToPush.id}`);
             entityToPush.hp -= collisionDamage;
             showDamageAnimation(entityToPush.gridX, entityToPush.gridY, collisionDamage, '#d63031');
             checkIfPlayerDefeated(entityToPush); // Check if pushed entity was player
             if (entityToPush.hp <= 0) {
                 entityToPush.hp = 0;
                 showDeathAnimation(entityToPush, 1500, '#d63031');
             }
             updateAllUIWrapper(); // Update UI after damage
         }, pushedSteps > 0 ? 200 : 50); // Delay slightly longer if movement occurred
     }
 }

// Prend en compte le tour du joueur ou des ennemis
function handleSpellCast(caster, targetGridX, targetGridY) { 
// ... KEEP THIS (Original Definition) ...
}

// --- RESTORED FUNCTIONS END ---
