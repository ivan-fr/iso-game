// AI pour les mobs sheep
import { findPath } from './entities.js';
import { getAdjacentTiles, getTilesInRangeBFS, hasLineOfSight, isTileValidAndFree } from './grid.js';
import { SPELLS } from './spells.js';

/**
 * Planifie l'action du sheep: chemin de mouvement et attaques.
 * @param {object} sheep
 * @param {object[]} allEntities - Current player + all enemies
 * @param {Array<Array<number>>} mapGrid
 * @param {number} cols
 * @param {number} rows
 * @returns {{movePath:{x:number,y:number}[], initialAttack:boolean, postMoveAttack:boolean, moveCost:number}}
 */
export function computesheepPlan(sheep, allEntities = [], mapGrid, cols, rows) {
    const blockers = allEntities.filter(e => e !== sheep && e.hp > 0);
    const target = allEntities.find(e => e.aiType === 'player');
    if (!target) return { movePath: [], initialAttack: false, postMoveAttack: false, moveCost: 0 }; // No player?

    // Attaque initiale si adjacent
    const dist0 = Math.abs(sheep.gridX - target.gridX) + Math.abs(sheep.gridY - target.gridY);
    const initialAttack = dist0 === 1 && sheep.ap > 0;
    if (initialAttack) {
        return { movePath: [], initialAttack: true, postMoveAttack: false, moveCost: 0 };
    }

    // Chemin A* vers le joueur
    const isValid = (x, y) => {
        // Autorise la dernière case correspondant au joueur
        if (x === target.gridX && y === target.gridY) return true;
        // Pass mapGrid, cols, rows to validation function
        return isTileValidAndFree(x, y, sheep, blockers, mapGrid, cols, rows);
    };
    const path = findPath(sheep.gridX, sheep.gridY, target.gridX, target.gridY, sheep, isValid, blockers, mapGrid, cols, rows) || [];
    
    let movePath = [];
    let moveCost = 0;
    if (path.length > 1) {
        // Stop one step before the target if moving
        const maxSteps = path.length - 1; 
        moveCost = Math.min(sheep.mp, maxSteps);
        movePath = path.slice(0, moveCost + 1); // Include the final step in path data
    }

    // Attaque après déplacement si adjacent
    let postMoveAttack = false;
    if (moveCost > 0) {
        const end = movePath[movePath.length - 1];
        const dist1 = Math.abs(end.x - target.gridX) + Math.abs(end.y - target.gridY);
        postMoveAttack = dist1 === 1 && sheep.ap > 0;
    }

    return { movePath, initialAttack, postMoveAttack, moveCost };
}

/**
 * IA de sheep - Revised Logic
 * @param {object} sheep
 * @param {function} moveAlongPathCallback - NEW: Function to animate along a path
 * @param {function} onAttack
 * @param {function} onComplete
 * @param {object[]} allEntities
 * @param {Array<Array<number>>} mapGrid
 * @param {number} cols
 * @param {number} rows
 */
export async function sheepAI(sheep, moveAlongPathCallback, onAttack, onComplete, allEntities = [], mapGrid, cols, rows) {
    console.log(`[AI DEBUG] sheep AI started for ${sheep.id}`);
    const target = allEntities.find(e => e.aiType === 'player');
    
    if (!target || sheep.hp <= 0) { 
        console.log(`[AI DEBUG] sheep AI (${sheep.id}) completing early: No target or dead.`);
        if (onComplete) onComplete();
        return;
    }

    let hasAttackedThisTurn = false;
    const blockers = allEntities.filter(e => e !== sheep && e.hp > 0);

    // 1. Check for initial melee attack
    let isAdjacent = Math.abs(sheep.gridX - target.gridX) + Math.abs(sheep.gridY - target.gridY) === 1;
    if (isAdjacent && sheep.ap > 0) {
        console.log(`[AI] sheep ${sheep.id} attacking initially.`);
        await onAttack(sheep, target);
        sheep.ap--;
        hasAttackedThisTurn = true;
        await new Promise(r => setTimeout(r, 300)); // Increased delay
    }

    // 2. Plan and execute movement if MP available and not adjacent initially (or maybe allow move after attack?)
    // Let's keep it simple: only move if NOT initially adjacent.
    isAdjacent = Math.abs(sheep.gridX - target.gridX) + Math.abs(sheep.gridY - target.gridY) === 1; // Re-check adjacency
    if (!isAdjacent && sheep.mp > 0) {
        const isValid = (x, y) => {
            if (x === target.gridX && y === target.gridY) return true;
            // Pass mapGrid, cols, rows to validation function
            return isTileValidAndFree(x, y, sheep, blockers, mapGrid, cols, rows);
        };
        const path = findPath(sheep.gridX, sheep.gridY, target.gridX, target.gridY, sheep, isValid, blockers, mapGrid, cols, rows) || [];
        
        if (path.length > 1) {
            // 1. Determine max steps based on MP
            const maxPossibleSteps = Math.min(sheep.mp, path.length - 1);
            if (maxPossibleSteps <= 0) { // Cannot move even one step
                 console.log(`[AI] sheep ${sheep.id}: Not enough MP to move closer.`);
            } else {
                // 2. Get the path segment limited by MP
                let mpLimitedPath = path.slice(0, maxPossibleSteps + 1);
                let finalStepIndex = mpLimitedPath.length - 1;

                // 3. Stop before target if this path ends on target
                if (finalStepIndex > 0) {
                    const finalStep = mpLimitedPath[finalStepIndex];
                    if (finalStep.x === target.gridX && finalStep.y === target.gridY) {
                        finalStepIndex = Math.max(0, finalStepIndex - 1); // Use previous step
                    }
                }
                const effectivePath = mpLimitedPath.slice(0, finalStepIndex + 1);
                const actualMoveCost = Math.max(0, effectivePath.length - 1);

                // 4. Execute move if cost > 0
                if (actualMoveCost > 0) {
                    console.log('sheep', sheep.id, 'se déplace de', actualMoveCost, 'cases vers', target.aiType);
                    console.log(`[MP DEBUG] sheep ${sheep.id}: MP before move: ${sheep.mp}, Move cost: ${actualMoveCost}, Path length: ${effectivePath.length}`);
                    await new Promise(resolve => moveAlongPathCallback(sheep, effectivePath, resolve));
                    const end = effectivePath[finalStepIndex];
        sheep.gridX = end.x;
        sheep.gridY = end.y;
                    sheep.mp -= actualMoveCost;
                    console.log(`[MP DEBUG] sheep ${sheep.id}: MP after move: ${sheep.mp}`);
                    await new Promise(r => setTimeout(r, 300)); // Increased delay
                }
            }
        }
    }

    // 3. Check for attack AFTER potential movement (if didn't attack initially)
    isAdjacent = Math.abs(sheep.gridX - target.gridX) + Math.abs(sheep.gridY - target.gridY) === 1; // Re-check adjacency
    if (!hasAttackedThisTurn && isAdjacent && sheep.ap > 0) {
        console.log(`[AI] sheep ${sheep.id} attacking after moving.`);
        await onAttack(sheep, target);
        sheep.ap--;
        // hasAttackedThisTurn = true; // Not strictly needed anymore
        await new Promise(r => setTimeout(r, 300)); // Increased delay
    }

    console.log(`[AI DEBUG] sheep AI finished for ${sheep.id}, calling onComplete.`);
    if (onComplete) onComplete();
}

// Plan du boss (mêlée, déplacement, post-mêlée, distance)
export function computeBossPlan(boss, allEntities = [], mapGrid, cols, rows) {
    const blockers = allEntities.filter(e => e !== boss && e.hp > 0);
    const target = allEntities.find(e => e.aiType === 'player');
     if (!target) return { initialMelee: false, movePath: [], postMoveMelee: false, rangedAttack: false, rangedTarget: null, moveCost: 0 };

    const dist0 = Math.abs(boss.gridX - target.gridX) + Math.abs(boss.gridY - target.gridY);
    const initialMelee = dist0 === 1 && boss.ap > 0;

    // Chemin A* vers le joueur
    const isValid = (x, y) => {
        if (x === target.gridX && y === target.gridY) return true;
        // Pass mapGrid, cols, rows to validation function
        return isTileValidAndFree(x, y, boss, blockers, mapGrid, cols, rows);
    };
    const path = findPath(boss.gridX, boss.gridY, target.gridX, target.gridY, boss, isValid, blockers, mapGrid, cols, rows) || [];
    
    let moveCost = 0, movePath = [];
    if (path.length > 1) {
        moveCost = Math.min(boss.mp, path.length - 2); // Stop 1 tile before if moving to attack
        movePath = path.slice(0, moveCost + 1);
    }
    
    const end = movePath.length > 0 ? movePath[movePath.length - 1] : { x: boss.gridX, y: boss.gridY };
    const postMoveMelee = Math.abs(end.x - target.gridX) + Math.abs(end.y - target.gridY) === 1 && boss.ap > 0;
    
    // Attaque à distance après déplacement
    const spellR = SPELLS.find(s => s.bossOnly && s.range > 1);
    let rangedAttack = false, rangedTarget = null;
    if (spellR && boss.ap >= spellR.cost) { // Check AP cost for spell
        const finalX = end.x;
        const finalY = end.y;
        const distToPlayer = Math.abs(finalX - target.gridX) + Math.abs(finalY - target.gridY);
        if (distToPlayer <= spellR.range && hasLineOfSight(finalX, finalY, target.gridX, target.gridY, blockers, mapGrid)) {
            rangedAttack = true;
            rangedTarget = { x: target.gridX, y: target.gridY };
        }
    }
    return { initialMelee, movePath, postMoveMelee, rangedAttack, rangedTarget, moveCost };
}

// IA du boss
export async function bossAI(boss, moveAlongPathCallback, onMeleeAttack, onRangedAttack, onComplete, allEntities = [], mapGrid, cols, rows) {
     const target = allEntities.find(e => e.aiType === 'player');
     if (!target) { if (onComplete) onComplete(); return; }

    // Loop while boss has AP or potential moves that could lead to AP usage
    let actionsPerformedThisTurn = 0; // Prevent infinite loops
    while (boss.ap > 0 || (boss.mp > 0)) { // Simpler loop condition

        if (actionsPerformedThisTurn >= 5) { // Safety break
            console.log("[AI] Boss action limit reached.");
            break;
        }

        const plan = computeBossPlan(boss, allEntities, mapGrid, cols, rows);
        console.log("[AI] Boss Plan:", plan);

        const spellM = SPELLS.find(s => s.bossOnly && s.range === 1); // Melee
        const spellR = SPELLS.find(s => s.bossOnly && s.range > 1); // Ranged
        const meleeCost = spellM?.cost ?? 1;
        const rangedCost = spellR?.cost ?? 1;

        const canMeleeNow = Math.abs(boss.gridX - target.gridX) + Math.abs(boss.gridY - target.gridY) === 1;
        const canRangedAttackNow = spellR && (Math.abs(boss.gridX - target.gridX) + Math.abs(boss.gridY - target.gridY) <= spellR.range) && hasLineOfSight(boss.gridX, boss.gridY, target.gridX, target.gridY, allEntities.filter(e => e !== boss && e.hp > 0), mapGrid);

        // --- Action Selection --- 
        
        // 1. Melee Attack (Highest Priority if possible)
        if (canMeleeNow && boss.ap >= meleeCost) {
            console.log(`[AI] Boss attempting Melee Attack (AP: ${boss.ap}).`);
            await onMeleeAttack(boss, target); // Callback handles damage/effects
            boss.ap -= meleeCost; // Deduct AP here
            console.log(`[AI] Boss AP after melee: ${boss.ap}`);
            actionsPerformedThisTurn++;
            await new Promise(r => setTimeout(r, 300)); // Increased delay
            continue; // Re-evaluate
        }

        // 2. Move TO Melee (If not adjacent, but plan allows)
        // Check if the plan's move leads to melee and is affordable
        if (!canMeleeNow && plan.postMoveMelee && plan.movePath.length > 1 && boss.mp >= plan.moveCost) {
             console.log(`[AI] Boss attempting Move to Melee (MP: ${boss.mp}, Cost: ${plan.moveCost}).`);
             await new Promise(resolve => moveAlongPathCallback(boss, plan.movePath, resolve));
             const end = plan.movePath[plan.movePath.length - 1];
             boss.gridX = end.x; boss.gridY = end.y; 
             boss.mp -= plan.moveCost; // Deduct MP
             console.log(`[AI] Boss MP after move: ${boss.mp}`);
             actionsPerformedThisTurn++;
             await new Promise(r => setTimeout(r, 300)); // Increased delay
             continue; // Re-evaluate (should trigger melee next)
        }

        // 3. Ranged Attack (If melee/move-to-melee not viable)
        if (canRangedAttackNow && boss.ap >= rangedCost) {
            console.log(`[AI] Boss attempting Ranged Attack (AP: ${boss.ap}).`);
            await onRangedAttack({ x: target.gridX, y: target.gridY }); // Callback handles projectile, AP deduction
            actionsPerformedThisTurn++;
            await new Promise(r => setTimeout(r, 300)); // Increased delay
            continue; // Re-evaluate
        }

        // 4. Generic Move (If no attack is possible, use the path calculated by computeBossPlan)
        // This path is generally towards melee, which is a decent default approach.
        if (plan.movePath.length > 1 && boss.mp >= plan.moveCost) {
             console.log(`[AI] Boss attempting Generic Move (MP: ${boss.mp}, Cost: ${plan.moveCost}).`);
             await new Promise(resolve => moveAlongPathCallback(boss, plan.movePath, resolve));
             const end = plan.movePath[plan.movePath.length - 1];
             boss.gridX = end.x; boss.gridY = end.y; 
             boss.mp -= plan.moveCost; // Deduct MP
             console.log(`[AI] Boss MP after generic move: ${boss.mp}`);
             actionsPerformedThisTurn++;
             await new Promise(r => setTimeout(r, 300)); // Increased delay
             continue; // Re-evaluate
        }
        
        // 5. No actions possible
         console.log("[AI] Boss cannot act further this turn.");
        break;
    }

    console.log("[AI] Boss finished turn.");
    if (onComplete) onComplete();
}

// --- sheepist Noir AI ---
/**
 * Planifie l'action du sheepist noir.
 * @param {object} sheepistNoir
 * @param {object[]} allEntities - Current player + all enemies
 * @param {Array<Array<number>>} mapGrid
 * @param {number} cols
 * @param {number} rows
 * @returns {{movePath:{x:number,y:number}[], rangedAttack:boolean, rangedTarget:object, moveCost:number}}
 */
export function computesheepistNoirPlan(sheepistNoir, allEntities, mapGrid, cols, rows) {
    const blockers = allEntities.filter(e => e !== sheepistNoir && e.hp > 0);
    const target = allEntities.find(e => e.aiType === 'player');
    if (!target) return { actions: [] }; // Return list of possible actions

    const attackSpell = SPELLS.find(s => s.name === 'Bave');
    const specialSpell = SPELLS.find(s => s.name === 'Crachat Gênant');
    
    let possibleActions = [];

    // --- Evaluate Special Ability --- 
    if (specialSpell && sheepistNoir.ap >= specialSpell.cost && !sheepistNoir.usedSpecialThisTurn) {
        // Check if target HAS MP to remove before considering this action
        if (target && target.mp > 0) { 
            const distSpecial = Math.abs(sheepistNoir.gridX - target.gridX) + Math.abs(sheepistNoir.gridY - target.gridY);
            const hasLOSSpecial = hasLineOfSight(sheepistNoir.gridX, sheepistNoir.gridY, target.gridX, target.gridY, blockers, mapGrid);
            if (distSpecial <= specialSpell.range && hasLOSSpecial) {
                possibleActions.push({ type: 'special', target: target, cost: specialSpell.cost });
            }
        }
    }

    // --- Evaluate Attack Ability --- 
    if (attackSpell && sheepistNoir.ap >= attackSpell.cost) {
        const distAttack = Math.abs(sheepistNoir.gridX - target.gridX) + Math.abs(sheepistNoir.gridY - target.gridY);
        const hasLOSAttack = hasLineOfSight(sheepistNoir.gridX, sheepistNoir.gridY, target.gridX, target.gridY, blockers, mapGrid);
        if (distAttack <= attackSpell.range && hasLOSAttack) {
            possibleActions.push({ type: 'attack', target: target, cost: attackSpell.cost });
        }
    }

    // --- Evaluate Movement --- 
    if (sheepistNoir.mp > 0) {
        // Try moving to use Special (only if target has MP)
        if (specialSpell && sheepistNoir.ap >= specialSpell.cost && !sheepistNoir.usedSpecialThisTurn && target && target.mp > 0) {
             const bestMoveForSpecial = findBestMoveTarget(sheepistNoir, target, specialSpell.range, blockers, mapGrid, cols, rows);
             if (bestMoveForSpecial) {
                 possibleActions.push({ type: 'move', path: bestMoveForSpecial.path, cost: bestMoveForSpecial.cost, goal: 'special' });
             }
        }
        // Try moving to Attack
        if (attackSpell && sheepistNoir.ap >= attackSpell.cost) {
             const bestMoveForAttack = findBestMoveTarget(sheepistNoir, target, attackSpell.range, blockers, mapGrid, cols, rows);
             if (bestMoveForAttack) {
                 possibleActions.push({ type: 'move', path: bestMoveForAttack.path, cost: bestMoveForAttack.cost, goal: 'attack' });
             }
        }

        // If no move to attack/special is good, move closer (generic)
        if (!possibleActions.some(a => a.type === 'move')) {
            const isValid = (x, y) => {
                 if (x === target.gridX && y === target.gridY) return true;
                 // Pass mapGrid, cols, rows to validation function
                 return isTileValidAndFree(x, y, sheepistNoir, blockers, mapGrid, cols, rows);
            };
            // Pass mapGrid, cols, rows to findPath
            const pathToTarget = findPath(sheepistNoir.gridX, sheepistNoir.gridY, target.gridX, target.gridY, sheepistNoir, isValid, blockers, mapGrid, cols, rows);
            if (pathToTarget && pathToTarget.length > 1) {
                 let moveCost = Math.min(sheepistNoir.mp, pathToTarget.length - 1);
                 let actualPath = pathToTarget.slice(0, moveCost + 1);
                 while (actualPath.length > 1 && !isTileValidAndFree(actualPath[actualPath.length - 1].x, actualPath[actualPath.length - 1].y, sheepistNoir, blockers, mapGrid, cols, rows)) {
                     actualPath.pop();
                     moveCost--;
                 }
                 if (actualPath.length > 1) {
                     possibleActions.push({ type: 'move', path: actualPath, cost: moveCost, goal: 'approach' });
                 }
            }
        }
    }

    // Basic Prioritization (can be improved): Special > Attack > Move(Special) > Move(Attack) > Move(Approach)
    possibleActions.sort((a, b) => {
        const priority = { special: 5, attack: 4, 'move_special': 3, 'move_attack': 2, 'move_approach': 1 };
        const aKey = a.type === 'move' ? `move_${a.goal}` : a.type;
        const bKey = b.type === 'move' ? `move_${b.goal}` : b.type;
        return (priority[bKey] ?? 0) - (priority[aKey] ?? 0);
    });

    // console.log("[AI] sheepistNoir Possible Actions:", possibleActions);
    return { actions: possibleActions };
}

// Helper function to find the best tile to move to for attacking/using ability
function findBestMoveTarget(entity, target, range, blockers, mapGrid, cols, rows) {
    let bestSpot = null;
    let minCost = Infinity;
    let minTargetDist = Infinity;

    for (let dx = -entity.mp; dx <= entity.mp; dx++) {
        for (let dy = -entity.mp; dy <= entity.mp; dy++) {
            if (Math.abs(dx) + Math.abs(dy) > entity.mp || (dx === 0 && dy === 0)) continue;
            const endX = entity.gridX + dx;
            const endY = entity.gridY + dy;

            if (!isTileValidAndFree(endX, endY, entity, blockers, mapGrid, cols, rows)) continue;

            const distAfterMove = Math.abs(endX - target.gridX) + Math.abs(endY - target.gridY);
            const hasLOSAfterMove = hasLineOfSight(endX, endY, target.gridX, target.gridY, blockers, mapGrid);

            if (distAfterMove <= range && hasLOSAfterMove) {
                const isValid = (x, y) => isTileValidAndFree(x, y, entity, blockers, mapGrid, cols, rows);
                // Pass mapGrid, cols, rows to findPath
                const pathToSpot = findPath(entity.gridX, entity.gridY, endX, endY, entity, isValid, blockers, mapGrid, cols, rows);
                if (pathToSpot && pathToSpot.length - 1 <= entity.mp) {
                    const cost = pathToSpot.length - 1;
                    if (cost < minCost || (cost === minCost && distAfterMove < minTargetDist)) {
                        minCost = cost;
                        minTargetDist = distAfterMove;
                        bestSpot = { path: pathToSpot, cost: cost };
                    }
                }
            }
        }
    }
    return bestSpot;
}

/**
 * IA du sheepist Noir: Priorité: Spécial (MP), Attaque, Mouvement.
 * @param {object} sheepistNoir
 * @param {function} moveAlongPathCallback - NEW: Function to animate along a path
 * @param {function} onRangedAttack
 * @param {function} onSpecialAbility
 * @param {function} onComplete
 * @param {object[]} allEntities
 * @param {Array<Array<number>>} mapGrid
 * @param {number} cols
 * @param {number} rows
 */
export async function sheepistNoirAI(sheepistNoir, moveAlongPathCallback, onRangedAttack, onSpecialAbility, onComplete, allEntities, mapGrid, cols, rows) {
    console.log(`[AI DEBUG] sheepistNoir AI started for ${sheepistNoir.id}`);
    const target = allEntities.find(e => e.aiType === 'player');
    const attackSpell = SPELLS.find(s => s.name === 'Bave');
    const specialSpell = SPELLS.find(s => s.name === 'Crachat Gênant');

    if (!target || sheepistNoir.hp <= 0) {
        console.log(`[AI DEBUG] sheepistNoir AI (${sheepistNoir.id}) completing early: No target or dead.`);
        if (onComplete) onComplete();
        return;
    }
    if (!attackSpell || !specialSpell) {
         console.error("sheepist Noir AI: Missing spells ('Bave' or 'Crachat Gênant')!");
         if (onComplete) onComplete();
         return;
    }

    let turnActionsRemaining = true;
    while (turnActionsRemaining) {
        turnActionsRemaining = false; // Assume loop finishes unless an action is taken
        const planResult = computesheepistNoirPlan(sheepistNoir, allEntities, mapGrid, cols, rows);
        const bestAction = planResult.actions.length > 0 ? planResult.actions[0] : null;

        if (!bestAction) {
            console.log("[AI] sheepistNoir: No actions available.");
            break; // Exit loop if no actions possible
        }

        console.log("[AI] sheepistNoir Best Action:", bestAction);

        // Execute Highest Priority Action
        if (bestAction.type === 'special' && sheepistNoir.ap >= specialSpell.cost && !sheepistNoir.usedSpecialThisTurn) {
             console.log("[AI] sheepistNoir using special ability.");
             sheepistNoir.ap -= specialSpell.cost;
             sheepistNoir.usedSpecialThisTurn = true; // Mark ability used
             await onSpecialAbility(sheepistNoir, target);
             turnActionsRemaining = true; // Can potentially act again
        } 
        else if (bestAction.type === 'attack' && sheepistNoir.ap >= attackSpell.cost) {
            console.log("[AI] sheepistNoir attacking.");
            sheepistNoir.ap -= attackSpell.cost;
            await onRangedAttack(sheepistNoir, target); 
            turnActionsRemaining = true; // Can potentially act again
        } 
        else if (bestAction.type === 'move' && sheepistNoir.mp >= bestAction.cost && bestAction.path.length > 1) {
            console.log(`[AI] sheepistNoir moving (${bestAction.goal}). Cost: ${bestAction.cost}`);
            
            // Stop before target if path is > 1 step and ends on target
            let finalStepIndex = bestAction.path.length - 1;
            if (finalStepIndex > 0) {
                const finalStep = bestAction.path[finalStepIndex];
                if (finalStep.x === target.gridX && finalStep.y === target.gridY) {
                    finalStepIndex = Math.max(0, finalStepIndex - 1); // Use previous step
                }
            }
            const effectivePath = bestAction.path.slice(0, finalStepIndex + 1);
            const actualMoveCost = Math.max(0, effectivePath.length - 1);

            if (actualMoveCost > 0) {
                await new Promise(resolve => moveAlongPathCallback(sheepistNoir, effectivePath, resolve));
                const end = effectivePath[finalStepIndex];
                sheepistNoir.gridX = end.x;
                sheepistNoir.gridY = end.y;
                sheepistNoir.mp -= actualMoveCost;
                turnActionsRemaining = true; // Re-evaluate after moving
            } else {
                 console.log(`[AI] sheepistNoir move blocked (already adjacent or no path).`);
            }
        }
        
        if (turnActionsRemaining) {
             await new Promise(r => setTimeout(r, 300)); // Increased delay between actions
        }
    }

    console.log("[AI] sheepistNoir finished turn actions loop.");
    console.log(`[AI DEBUG] sheepistNoir AI finished for ${sheepistNoir.id}, calling onComplete.`);
    if (onComplete) onComplete();
}

// --- Chef de Guerre AI ---
/**
 * Calculates the best potential action for the Chef de Guerre.
 * Finds reachable tiles for attack or support.
 */
export function computeChefPlan(chef, allEntities, mapGrid, cols, rows) {
    const actions = [];
    const player = allEntities.find(e => e.aiType === 'player');
    // Correctly identify allies: any non-player, non-self entity
    const allies = allEntities.filter(e => e.id !== 'player' && e.id !== chef.id && e.hp > 0); 
    const blockers = allEntities.filter(e => e !== chef && e.hp > 0);

    // console.log(`[AI DEBUG] computeChefPlan started for ${chef.id}. AP=${chef.ap}, MP=${chef.mp}`);
    // console.log(`[AI DEBUG] Player pos: (${player?.gridX}, ${player?.gridY}), Chef pos: (${chef.gridX}, ${chef.gridY})`);
    // console.log(`[AI DEBUG] Blockers:`, blockers.map(b => `${b.id} at (${b.gridX}, ${b.gridY})`));
    // console.log(`[AI DEBUG] Allies:`, allies.map(a => `${a.id} at (${a.gridX}, ${a.gridY})`));

    const isValid = (x, y, currentEntity) => {
        // Pass mapGrid, cols, rows to validation function
        return isTileValidAndFree(x, y, currentEntity, blockers, mapGrid, cols, rows);
    };

    // 1. Attack player if adjacent
    if (chef.ap >= 2) {
        // Pass current grid dimensions to getAdjacentTiles
        const adjacentTiles = getAdjacentTiles(chef.gridX, chef.gridY, cols, rows); 
        if (player && adjacentTiles.some(tile => tile.x === player.gridX && tile.y === player.gridY)) {
            console.log("[AI DEBUG] Chef can attack player directly.");
            actions.push({ type: 'attack', target: player, cost: { ap: 2 } });
        }
    }

    // 2. Special: Boost Ally MP if in range & LoS and needing MP
    const SPECIAL_RANGE = 4;
    const SPECIAL_COST_AP = 2;
    if (chef.ap >= SPECIAL_COST_AP && !chef.usedSpecialThisTurn) { // Check usage flag
        // console.log(`[AI DEBUG] Checking Direct Special. Chef AP=${chef.ap}, UsedSpecial=${chef.usedSpecialThisTurn}`);
        // console.log(`[AI DEBUG] Allies found: ${allies.length}`);
        for (const ally of allies) {
             // console.log(`[AI DEBUG] Checking ally ${ally.id} for direct special: MP=${ally.mp}, MaxMP=${ally.maxMp}`);
             const dist = Math.abs(chef.gridX - ally.gridX) + Math.abs(chef.gridY - ally.gridY);
             const hasLOS = hasLineOfSight(chef.gridX, chef.gridY, ally.gridX, ally.gridY, blockers, mapGrid);
             // console.log(`[AI DEBUG] Ally ${ally.id}: Dist=${dist}, Range=${SPECIAL_RANGE}, HasLOS=${hasLOS}`);
             if (dist <= SPECIAL_RANGE && hasLOS) {
                 // console.log(`[AI DEBUG] Found ally ${ally.id} in range. Adding 'special' action.`);
                 actions.push({ type: 'special', target: ally, cost: { ap: SPECIAL_COST_AP } });
             }
        }
    }

    // 3. Move then Attack player
    if (chef.ap >= 2 && player) {
        const path = findPath(chef.gridX, chef.gridY, player.gridX, player.gridY, chef, isValid, blockers, mapGrid, cols, rows, true); // adjacent=true
        // console.log(`[AI DEBUG] Path for Move->Attack:`, path);
        if (path && path.length > 1) { // Path to adjacent exists
            const requiredMp = path.length - 1;
            const affordableMp = Math.min(requiredMp, chef.mp);
            
            if (affordableMp > 0) { // Can afford to move at least one step
                const effectivePath = path.slice(0, affordableMp + 1); // Truncate path based on affordable MP
                const canAttackAfterMove = (affordableMp === requiredMp); // Can only attack if the *full* path was affordable
                
                if (canAttackAfterMove) {
                    console.log(`[AI DEBUG] Chef can move (${affordableMp} MP) then attack.`);
                    actions.push({ 
                        type: 'move_attack', 
                        path: effectivePath, // Use truncated path
                        target: player, 
                        cost: { mp: affordableMp, ap: 2 } 
                    });
                } else {
                    // If can only move partially towards attack position, consider it an 'approach'
                     console.log(`[AI DEBUG] Chef can only move partially (${affordableMp} MP) towards attack position. Adding as move_approach.`);
                     // Avoid adding duplicate approach if one already exists
                     if (!actions.some(a => a.type === 'move_approach')) {
                         actions.push({ type: 'move_approach', path: effectivePath, cost: { mp: affordableMp } });
                     }
                }
            }
        }
    }

    // 4. Move then Special (Boost Ally MP)
    // Only consider if no direct special action was already possible for *any* ally
    if (chef.ap >= SPECIAL_COST_AP && !chef.usedSpecialThisTurn && !actions.some(a => a.type === 'special')) { 
        console.log(`[AI DEBUG] Checking Move-Special. Chef AP=${chef.ap}, MP=${chef.mp}, UsedSpecial=${chef.usedSpecialThisTurn}`);
        let bestMoveSpecialAction = null;

        for (const ally of allies) {
            console.log(`[AI DEBUG] Checking ally ${ally.id} for Move-Special: MP=${ally.mp}, MaxMP=${ally.maxMp}`);
            // Find best reachable tile within range of ally
            const reachableChefTiles = getTilesInRangeBFS(chef.gridX, chef.gridY, chef.mp, blockers, false, mapGrid, cols, rows);
             console.log(`[AI DEBUG] -> Ally ${ally.id}: Found ${reachableChefTiles.length} reachable tiles for Chef within ${chef.mp} MP.`);
            let bestTileForAlly = null;
            let minCostToTile = Infinity;

            for (const tile of reachableChefTiles) {
                const distToAlly = Math.abs(tile.x - ally.gridX) + Math.abs(tile.y - ally.gridY);
                 // Use the imported hasLineOfSight and pass mapGrid
                const hasLOSToAlly = hasLineOfSight(tile.x, tile.y, ally.gridX, ally.gridY, blockers, mapGrid);
                 console.log(`[AI DEBUG]    - Checking reachable tile (${tile.x},${tile.y}): Cost=${tile.cost}, DistToAlly=${distToAlly}, HasLOS=${hasLOSToAlly}`);
                
                if (distToAlly <= SPECIAL_RANGE && hasLOSToAlly) {
                    // This tile is a candidate. Is it cheaper to reach than previous best?
                    if (tile.cost < minCostToTile) {
                        minCostToTile = tile.cost;
                        bestTileForAlly = tile; // tile already contains {x, y, cost}
                    }
                }
            }

            // If we found a suitable tile reachable within MP
            if (bestTileForAlly) {
                console.log(`[AI DEBUG] -> Found best target tile (${bestTileForAlly.x},${bestTileForAlly.y}) for special on ${ally.id}. Cost: ${bestTileForAlly.cost} MP`);
                // We need the actual path to this tile
                const pathToBestTile = findPath(chef.gridX, chef.gridY, bestTileForAlly.x, bestTileForAlly.y, chef, isValid, blockers, mapGrid, cols, rows);
                 console.log(`[AI DEBUG] -> Path found to best tile: ${pathToBestTile ? `Length ${pathToBestTile.length}` : 'null'}`);
                
                if (pathToBestTile && pathToBestTile.length - 1 === bestTileForAlly.cost) { // Verify path cost matches BFS cost
                     console.log(`[AI DEBUG] -> Path cost matches BFS cost. Creating move_special action.`);
                    const currentAction = { 
                        type: 'move_special', 
                        path: pathToBestTile, 
                        target: ally, 
                        cost: { mp: bestTileForAlly.cost, ap: SPECIAL_COST_AP } 
                    };
                    // Keep track of the best move_special found so far (e.g., lowest MP cost?)
                    if (!bestMoveSpecialAction || currentAction.cost.mp < bestMoveSpecialAction.cost.mp) {
                        bestMoveSpecialAction = currentAction;
                    }
                } else {
                     console.warn(`[AI DEBUG] Path cost mismatch for Move-Special target tile (${bestTileForAlly.x},${bestTileForAlly.y}). BFS cost: ${bestTileForAlly.cost}, Path cost: ${pathToBestTile ? pathToBestTile.length - 1 : 'null'}`);
                }
            }
        }
        // Add the best move_special action found (if any)
        if (bestMoveSpecialAction) {
            console.log(`[AI DEBUG] Adding best 'move_special' action found:`, bestMoveSpecialAction);
            actions.push(bestMoveSpecialAction);
        }
    }

    // 5. Move towards Player if nothing else
    if (player && actions.length === 0) { // Only if no attack/special actions planned
         // Pass mapGrid, cols, rows to findPath
        const path = findPath(chef.gridX, chef.gridY, player.gridX, player.gridY, chef, isValid, blockers, mapGrid, cols, rows);
        console.log(`[AI DEBUG] Path for Move->Approach:`, path);
        if (path && path.length > 1) { // path includes start node
            const moveLength = Math.min(path.length - 1, chef.mp);
            if (moveLength > 0) {
                const movePath = path.slice(0, moveLength + 1);
                 console.log(`[AI DEBUG] Chef can move towards player.`);
                actions.push({ type: 'move_approach', path: movePath, cost: { mp: moveLength } });
            }
        }
    }
    // console.log(`[AI DEBUG] computeChefPlan final actions:`, actions);
    return actions;
}

/**
 * Chef de Guerre AI Logic.
 */
export async function chefDeGuerreAI(chef, moveAlongPathCallback, onMeleeAttack, onSpecialAbility, onComplete, allEntities, mapGrid, cols, rows) {
    console.log(`[AI DEBUG] ChefDeGuerre AI started for ${chef.id}`);
    const player = allEntities.find(e => e.aiType === 'player');
    let actionsTaken = 0; // Prevent infinite loops

    while ((chef.ap > 0 || chef.mp > 0) && actionsTaken < 5) { // Loop while resources available, limit actions
        actionsTaken++
        const possibleActions = computeChefPlan(chef, allEntities, mapGrid, cols, rows);
        console.log(`[AI] Chef Possible Actions:`, possibleActions);

        if (possibleActions.length === 0) {
            console.log(`[AI] Chef: No actions available.`);
            break;
        }

        // --- Action Prioritization (REVISED ORDER) --- 
        let bestAction = null;

        // 1. Attack if possible
        bestAction = possibleActions.find(a => a.type === 'attack');
        
        // 2. Move to Attack
        if (!bestAction) {
            bestAction = possibleActions.find(a => a.type === 'move_attack');
        } 

        // 3. Use Special if possible (on ally with lowest MP?)
        if (!bestAction) {
            const specialActions = possibleActions.filter(a => a.type === 'special');
            if (specialActions.length > 0) {
                 // Find ally with lowest MP percentage?
                 specialActions.sort((a, b) => (a.target.mp / a.target.maxMp) - (b.target.mp / b.target.maxMp));
                 bestAction = specialActions[0];
            }
        } 
       
        // 4. Move to use Special
         if (!bestAction) {
             const moveSpecialActions = possibleActions.filter(a => a.type === 'move_special');
              // Prioritize closest move? Or ally with lowest HP/MP?
             if (moveSpecialActions.length > 0) {
                 moveSpecialActions.sort((a, b) => a.cost.mp - b.cost.mp); // Sort by MP cost of move
                 bestAction = moveSpecialActions[0];
             }
        }
       
        // 5. Simple Approach
        if (!bestAction) {
            bestAction = possibleActions.find(a => a.type === 'move_approach');
        }

        // Fallback (shouldn't happen if approach is always possible)
        if (!bestAction && possibleActions.length > 0) bestAction = possibleActions[0]; // Keep fallback if actions exist
       
        console.log(`[AI] Chef Best Action:`, bestAction);

        // --- Execute Action ---
        let turnEnded = false;
        if (bestAction.type === 'attack') {
            // Check specific AP cost
            if (chef.ap >= bestAction.cost.ap) { 
                console.log(`[AI] Chef attacking player. Cost: ${bestAction.cost.ap} AP`);
                await onMeleeAttack(chef, bestAction.target);
                // Deduct specific AP cost
                chef.ap -= bestAction.cost.ap;
            } else { 
                console.log(`[AI] Chef cannot afford attack. Have ${chef.ap} AP, need ${bestAction.cost.ap} AP`);
                turnEnded = true; 
            }
        } else if (bestAction.type === 'special') {
            // Check specific AP cost
            if (chef.ap >= bestAction.cost.ap) { 
                console.log(`[AI] Chef using special on ${bestAction.target.aiType} ${bestAction.target.id.substring(0,4)}. Cost: ${bestAction.cost.ap} AP`);
                await onSpecialAbility(chef, bestAction.target);
                // Deduct specific AP cost
                chef.ap -= bestAction.cost.ap;
                chef.usedSpecialThisTurn = true; // Maybe track usage?
            } else { 
                console.log(`[AI] Chef cannot afford special. Have ${chef.ap} AP, need ${bestAction.cost.ap} AP`);
                turnEnded = true; 
            }
        } else if (bestAction.type === 'move_attack') {
             // Check specific MP cost first
             if (chef.mp >= bestAction.cost.mp) { 
                 console.log(`[AI] Chef moving to attack. Cost: ${bestAction.cost.mp} MP`);
                 await new Promise(resolve => moveAlongPathCallback(chef, bestAction.path, resolve));
                 const end = bestAction.path[bestAction.path.length - 1];
                 chef.gridX = end.x; chef.gridY = end.y;
                 // Deduct specific MP cost
                 chef.mp -= bestAction.cost.mp;
                 
                 // Now check if attack is possible (check specific AP cost)
                 if (chef.ap >= bestAction.cost.ap) { 
                     console.log(`[AI] Chef attacking player after moving. Cost: ${bestAction.cost.ap} AP`);
                     await onMeleeAttack(chef, bestAction.target);
                     // Deduct specific AP cost
                     chef.ap -= bestAction.cost.ap;
                 } else {
                    console.log(`[AI] Chef moved but cannot afford attack. Have ${chef.ap} AP, need ${bestAction.cost.ap} AP`);
                    // Don't set turnEnded=true here, move already happened
                 }
             } else { 
                 console.log(`[AI] Chef cannot afford move_attack (move part). Have ${chef.mp} MP, need ${bestAction.cost.mp} MP`);
                 turnEnded = true; 
            }
        } else if (bestAction.type === 'move_special') {
             // Check specific MP cost first
             if (chef.mp >= bestAction.cost.mp) { 
                 console.log(`[AI] Chef moving to use special. Cost: ${bestAction.cost.mp} MP`);
                 await new Promise(resolve => moveAlongPathCallback(chef, bestAction.path, resolve));
                 const end = bestAction.path[bestAction.path.length - 1];
                 chef.gridX = end.x; chef.gridY = end.y;
                 // Deduct specific MP cost
                 chef.mp -= bestAction.cost.mp;
                 
                 // Now check if special is possible (check specific AP cost)
                 if (chef.ap >= bestAction.cost.ap) { 
                    console.log(`[AI] Chef using special on ${bestAction.target.aiType} ${bestAction.target.id.substring(0,4)} after moving. Cost: ${bestAction.cost.ap} AP`);
                    await onSpecialAbility(chef, bestAction.target);
                    // Deduct specific AP cost
                    chef.ap -= bestAction.cost.ap;
                    chef.usedSpecialThisTurn = true;
                 } else {
                    console.log(`[AI] Chef moved but cannot afford special. Have ${chef.ap} AP, need ${bestAction.cost.ap} AP`);
                    // Don't set turnEnded=true here, move already happened
                 }
             } else { 
                console.log(`[AI] Chef cannot afford move_special (move part). Have ${chef.mp} MP, need ${bestAction.cost.mp} MP`);
                turnEnded = true; 
            }
        } else if (bestAction.type === 'move_approach') {
            // Check specific MP cost
            if (chef.mp >= bestAction.cost.mp) { 
                 console.log(`[AI] Chef moving to approach player. Cost: ${bestAction.cost.mp} MP`);
                 await new Promise(resolve => moveAlongPathCallback(chef, bestAction.path, resolve));
                 const end = bestAction.path[bestAction.path.length - 1];
                 chef.gridX = end.x; chef.gridY = end.y;
                 // Deduct specific MP cost
                 chef.mp -= bestAction.cost.mp;
            } else { 
                console.log(`[AI] Chef cannot afford move_approach. Have ${chef.mp} MP, need ${bestAction.cost.mp} MP`);
                turnEnded = true; 
            }
        }
       
        if (turnEnded) {
             console.log("[AI] Chef cannot afford action, ending turn early.");
             break;
        }
        await new Promise(r => setTimeout(r, 300)); // Increased delay between actions
    }

    console.log(`[AI DEBUG] ChefDeGuerre AI finished for ${chef.id}, calling onComplete.`);
    if (onComplete) onComplete();
}
