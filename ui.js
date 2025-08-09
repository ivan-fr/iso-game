import { getAllLivingEntities } from './game.js';

// Fonctions d'affichage, gestion UI, messages, barres de vie, input

// --- Audio Interaction Handling ---
let userInteracted = false;

function handleFirstInteraction() {
    if (userInteracted) return;
    userInteracted = true;
    console.log('Audio enabled by user interaction.');
    // Optional: Resume AudioContext if needed (good practice)
    // try {
    //     const anySound = sounds[Object.keys(sounds)[0]];
    //     if (anySound && anySound.context && anySound.context.state === 'suspended') {
    //         anySound.context.resume();
    //     }
    // } catch (e) { console.warn('Could not resume AudioContext:', e); }

    // Clean up listeners
    window.removeEventListener('click', handleFirstInteraction);
    window.removeEventListener('keydown', handleFirstInteraction);
}

export function initAudioInteraction() {
    // Listen for the first interaction
    window.addEventListener('click', handleFirstInteraction, { once: true, capture: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true, capture: true });
}
// --- End Audio Interaction Handling ---

// Affichage des messages
export function showMessage(text, duration = 2000) {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = text;
    messageBox.classList.add('show');
    clearTimeout(messageBox.timer);
    messageBox.timer = setTimeout(() => {
        messageBox.classList.remove('show');
    }, duration);
}

// Mise à jour des barres de vie
export function updateHealthBar(barElement, currentHp, maxHp) {
    const healthPercentage = Math.max(0, (currentHp / maxHp) * 100);
    // --- DEBUG LOG ---
    if (barElement.id === 'player-health-bar') {
        console.log(`[UI DEBUG] Updating player health bar: HP=${currentHp}, MaxHP=${maxHp}, Percent=${healthPercentage.toFixed(1)}`);
    }
    // --- END DEBUG LOG ---
    barElement.style.width = `${healthPercentage}%`;
    if (healthPercentage < 30) barElement.style.backgroundColor = '#e74c3c';
    else if (healthPercentage < 60) barElement.style.backgroundColor = '#f39c12';
    else {
        if (barElement.id === 'player-health-bar') barElement.style.backgroundColor = '#3498db';
        else barElement.style.backgroundColor = '#2ecc71';
    }
}

// Mise à jour de l'UI générale
export function updateUI(
    playerApDisplay, playerMpDisplay, bossApDisplay, bossMpDisplay,
    player, bossState, // Use dynamic boss state
    enemiesState, enemyCountDisplay, enemyTotalDisplay, enemyHpSummaryDisplay, // Use generic enemy state/displays
    playerHealthBar, bossHealthBar,
    currentTurn, isMoving, activeEnemy, playerState, endTurnButton, mobileEndTurnButton, gameOver, // Use activeEnemy, add mobileEndTurnButton
    isInLobby = false // Add lobby mode parameter
) {
    // In lobby mode, hide turn-based UI elements
    if (isInLobby) {
        // Hide combat-related UI
        const combatElements = [
            'boss-info-group',
            'enemy-info',
            'turnOrder',
            'spell-bar',
            'end-turn-button',
            'mobile-end-turn-button'
        ];
        
        combatElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });
        
        // Show lobby-specific message
        const messageBox = document.getElementById('messageBox');
        if (messageBox && messageBox.textContent.trim() === '') {
            showMessage('Welcome to the lobby! Move freely and explore the portals.', 4000);
        }
        
        // Update player stats without AP/MP restrictions
        playerApDisplay.textContent = '∞';
        playerMpDisplay.textContent = '∞';
        updateHealthBar(playerHealthBar, player.hp, player.maxHp);
        return;
    }
    
    // Show combat UI elements when not in lobby
    const combatElements = [
        'boss-info-group',
        'enemy-info', 
        'turnOrder',
        'spell-bar',
        'end-turn-button',
        'mobile-end-turn-button'
    ];
    
    combatElements.forEach(id => {
        const element = document.getElementById(id);
        if (element && (id === 'boss-info-group' ? bossState : true)) {
            element.style.display = bossState || id !== 'boss-info-group' ? 'block' : 'none';
        }
    });

    playerApDisplay.textContent = player.ap;
    playerMpDisplay.textContent = player.mp;
    updateHealthBar(playerHealthBar, player.hp, player.maxHp);

    // Update Boss Info (if boss exists in the room)
    const bossInfoGroup = document.getElementById('boss-info-group'); // Assuming info-group has this ID
    if (bossState && bossApDisplay && bossMpDisplay && bossHealthBar && bossInfoGroup) {
        bossInfoGroup.style.display = 'block'; // Show boss info
        bossApDisplay.textContent = bossState.ap;
        bossMpDisplay.textContent = bossState.mp;
        updateHealthBar(bossHealthBar, bossState.hp, bossState.maxHp);
    } else if (bossInfoGroup) {
         bossInfoGroup.style.display = 'none'; // Hide boss info
    }

    // Update Enemy Info (replaces sheep info)
    if (enemiesState && enemyCountDisplay && enemyTotalDisplay && enemyHpSummaryDisplay) {
        const livingEnemies = enemiesState.filter(e => e.hp > 0);
        const livingCount = livingEnemies.length + (bossState && bossState.hp > 0 ? 1 : 0); // Count living enemies + boss
        const totalCount = enemiesState.length + (bossState ? 1 : 0); // Total enemies + boss
                                            
        enemyCountDisplay.textContent = livingCount;
        enemyTotalDisplay.textContent = totalCount; 

        if (livingCount > 0) {
            // Aggregate HP from all living non-player entities
            const allLivingEnemies = getAllLivingEntities().filter(e => e !== player);
            const totalLivingHp = allLivingEnemies.reduce((sum, e) => sum + e.hp, 0);
            const totalMaxHp = allLivingEnemies.reduce((sum, e) => sum + e.maxHp, 0);
            enemyHpSummaryDisplay.textContent = `${totalLivingHp} / ${totalMaxHp} HP Total`;
        } else {
            enemyHpSummaryDisplay.textContent = "Aucun ennemi";
        }
        // Rename the label maybe?
        const enemyLabel = document.getElementById('enemy-label'); // Need to add this ID
        if (enemyLabel) enemyLabel.textContent = "Ennemis:"; 
    }

    endTurnButton.disabled = isMoving || activeEnemy || currentTurn !== 'player' || playerState !== 'idle' || gameOver;
    if (mobileEndTurnButton) {
        mobileEndTurnButton.disabled = isMoving || activeEnemy || currentTurn !== 'player' || playerState !== 'idle' || gameOver;
    }
}

/**
 * Update the spell bar selection UI to highlight the selected spell.
 * @param {number} selectedSpellIndex
 */
export function updateSpellBarSelection(selectedSpellIndex) {
    for (let i = 0; i < 3; i++) {
        const btn = document.getElementById('spell-btn-' + i);
        if (btn) {
            btn.style.outline = (i === selectedSpellIndex) ? '3px solid #fff' : 'none';
            btn.style.background = (i === selectedSpellIndex) ? 'rgba(255,255,255,0.12)' : 'none';
        }
    }
}

/**
 * Set up event listeners for the spell bar buttons.
 * @param {function(number):void} setSelectedSpellFn - Function to set the selected spell index.
 * @param {function():number} getSelectedSpellIndexFn - Function to get the selected spell index.
 * @param {Array} SPELLS - Array of spell objects.
 * @param {function(string, number=):void} showMessageFn - Function to show a message.
 * @param {function():void} updateAllUIFn - Function to update all UI.
 */
export function setupSpellBarListeners(setSelectedSpellFn, getSelectedSpellIndexFn, SPELLS, showMessageFn, updateAllUIFn) {
    for (let i = 0; i < 3; i++) {
        const btn = document.getElementById('spell-btn-' + i);
        if (btn) {
            const spellIndex = i; // Capture index for listeners

            // Click listener (for mouse and fallback)
            btn.addEventListener('click', function() {
                // Check if the click was likely from a touch that already handled spell selection
                if (btn.dataset.touchSpellSelected === 'true') {
                    btn.dataset.touchSpellSelected = 'false'; // Reset flag
                    return; // Avoid double processing
                }
                setSelectedSpellFn(spellIndex);
                updateSpellBarSelection(spellIndex);
                showMessageFn(`Sort sélectionné : ${SPELLS[spellIndex].name}`);
                updateAllUIFn();
            });

            // Touchend listener for more reliable touch selection
            btn.addEventListener('touchend', function(event) {
                // Only select spell if a tooltip was NOT shown by a hold action
                // The tooltip logic in setupSpellTooltips will handle hiding the tooltip
                // and call event.preventDefault() if it showed a tooltip.
                // This touchend listener is for quick taps that *don't* show a tooltip.
                if (btn.dataset.tooltipShownByHold !== 'true') {
                    // It was a quick tap, not a hold for tooltip
                    setSelectedSpellFn(spellIndex);
                    updateSpellBarSelection(spellIndex);
                    showMessageFn(`Sort sélectionné : ${SPELLS[spellIndex].name}`);
                    updateAllUIFn();
                    btn.dataset.touchSpellSelected = 'true'; // Mark that touch handled it

                    // We might need to prevent default here if the subsequent emulated click
                    // causes issues, but let's test without it first.
                    // event.preventDefault(); // Potentially add if double selection occurs
                }
                // If tooltipShownByHold was true, the touchend in setupSpellTooltips handles it.
            });
        }
    }
    updateSpellBarSelection(getSelectedSpellIndexFn());
}

/**
 * Update all UI elements.
 */
export function updateAllUI({
    playerApDisplay,
    playerMpDisplay,
    bossApDisplay, // Passed but handled conditionally in updateUI
    bossMpDisplay,
    player,
    boss, // Renamed from bossState for consistency? No, keep bossState
    enemiesState, 
    enemyCountDisplay, 
    enemyTotalDisplay, 
    enemyHpSummaryDisplay, 
    playerHealthBar,
    bossHealthBar,
    currentTurn,
    isMoving,
    activeEnemy, 
    playerState,
    endTurnButton,
    mobileEndTurnButton, // Add mobileEndTurnButton
    gameOver,
    isInLobby = false // Add lobby mode parameter
}) {
    // Call updateUI with all params including lobby mode
    updateUI(
        playerApDisplay, playerMpDisplay, bossApDisplay, bossMpDisplay,
        player, boss, // Pass bossState here
        enemiesState, enemyCountDisplay, enemyTotalDisplay, enemyHpSummaryDisplay,
        playerHealthBar, bossHealthBar,
        currentTurn, isMoving, activeEnemy, playerState, endTurnButton, mobileEndTurnButton, gameOver,
        isInLobby // Pass lobby mode to updateUI
    );
    // Cursor feedback
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    if (gameOver) canvas.style.cursor = 'default';
    else if (isInLobby) canvas.style.cursor = 'pointer'; // Always pointer in lobby for free movement
    // else if (currentTurn !== 'player' || isBossActing) canvas.style.cursor = 'default';
    else if (currentTurn !== 'player' || activeEnemy) canvas.style.cursor = 'default'; // Use activeEnemy
    else if (playerState === 'aiming') canvas.style.cursor = 'crosshair';
    else if (playerState === 'idle') canvas.style.cursor = 'pointer';
    else canvas.style.cursor = 'default';
}

// --- Sound system ---
const sounds = {
    turn: new Audio('./arcade-ui-4-229502.mp3'), // free chime
    damage: new Audio('./damage-40114.mp3'), // free hit
    spell: new Audio('./magic-spell-6005.mp3'), // free cast
    move: new Audio('./running-14658.mp3'), // Son de déplacement continu
};

export function playSound(name) {
    // Don't play sounds until user interacts
    if (!userInteracted) {
        // console.log('playSound skipped: user has not interacted yet.');
        return; 
    }

    if (sounds[name]) {
        try { // Add try...catch for robustness
            if (name === 'move') {
                sounds.move.loop = true;
                sounds.move.currentTime = 0;
                sounds.move.play();
            } else {
                sounds[name].currentTime = 0;
                sounds[name].play().catch(e => { 
                    // Catch potential errors even after interaction (e.g., context issues)
                    console.warn(`Could not play sound "${name}":`, e);
                    // Attempt to re-enable on error? Maybe too aggressive.
                    // userInteracted = false; 
                    // initAudioInteraction(); 
                });
            }
        } catch (e) {
             console.error(`Error in playSound("${name}"):`, e);
        }
    }
}

export function stopSound(name) {
    if (sounds[name]) {
        sounds[name].pause();
        sounds[name].currentTime = 0;
    }
}

// --- Turn order indicator animation ---
// Pass bossState to conditionally show/hide boss indicator
export function updateTurnOrder(currentTurn, bossState) {
    const playerEl = document.getElementById('turnOrder-player');
    const bossEl = document.getElementById('turnOrder-boss');
    const enemyEl = document.getElementById('turnOrder-enemy'); // Rename sheep to generic Enemy
    const bossArrow = document.getElementById('turnOrder-arrow-boss');
    const enemyArrow = document.getElementById('turnOrder-arrow-enemy');

    if (!playerEl || !bossEl || !enemyEl || !bossArrow || !enemyArrow) return;

    // Show/hide boss based on room
    const bossVisible = !!bossState;
    bossEl.style.display = bossVisible ? 'inline-block' : 'none';
    bossArrow.style.display = bossVisible ? 'inline' : 'none';

    // Reset styles
    playerEl.style.transform = 'scale(1)';
    bossEl.style.transform = 'scale(1)';
    enemyEl.style.transform = 'scale(1)';
    playerEl.style.background = '#3498db55'; // Dimmed default
    bossEl.style.background = '#c0392b55';
    enemyEl.style.background = '#8e44ad55'; // Dimmed purple for enemies

    // Highlight current turn
    if (currentTurn === 'player') {
        playerEl.style.background = '#3498db';
        playerEl.style.transform = 'scale(1.12)';
    } else { // Enemies turn
         enemyEl.style.background = '#8e44ad';
         enemyEl.style.transform = 'scale(1.12)';
    }
}

// --- Spell tooltips ---
export function setupSpellTooltips(SPELLS) {
    const tooltip = document.getElementById('spellTooltip');
    const HOLD_DURATION = 500; // ms
    const MOVE_THRESHOLD = 10; // pixels

    for (let i = 0; i < SPELLS.length; i++) {
        const btn = document.getElementById('spell-btn-' + i);
        if (!btn) continue;

        let tooltipTimer = null;
        let touchStartX, touchStartY;
        btn.dataset.tooltipShownByHold = 'false'; // Custom data attribute

        const showTooltip = () => {
            tooltip.style.display = 'block';
            tooltip.innerHTML = `<b>${SPELLS[i].name}</b><br>Portée: ${SPELLS[i].range}<br>Dégâts: ${SPELLS[i].damage().toString().replace(/\D/g,'')}+<br>${SPELLS[i].aoe ? 'Zone croix' : SPELLS[i].push ? 'Poussée' : 'Mono-cible'}`;
            const rect = btn.getBoundingClientRect();
            const ttWidth = tooltip.offsetWidth;
            const ttHeight = tooltip.offsetHeight;
            let left = rect.left + (rect.width - ttWidth) / 2;
            left = Math.max(8, Math.min(left, window.innerWidth - ttWidth - 8));
            const top = rect.top - ttHeight - 8 + window.scrollY;
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        };

        const hideTooltip = () => {
            tooltip.style.display = 'none';
        };

        // Desktop hover
        btn.addEventListener('mouseenter', e => {
            // Don't show mouse tooltip if one is already shown by touch-hold
            if (btn.dataset.tooltipShownByHold === 'true') return;
            showTooltip();
        });
        btn.addEventListener('mouseleave', () => {
            // Don't hide if it was shown by touch-hold and touch is still ongoing (edge case, mostly for safety)
            if (btn.dataset.tooltipShownByHold === 'true') return;
            hideTooltip();
        });

        // Touch interactions
        btn.addEventListener('touchstart', e => {
            e.preventDefault(); // Prevent click event firing immediately after touch, and other defaults
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            btn.dataset.tooltipShownByHold = 'false'; // Reset flag
            clearTimeout(tooltipTimer); // Clear any existing timer
            tooltipTimer = setTimeout(() => {
                showTooltip();
                btn.dataset.tooltipShownByHold = 'true';
            }, HOLD_DURATION);
        }, { passive: false });

        btn.addEventListener('touchmove', e => {
            if (!tooltipTimer) return; // No timer active
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            if (Math.abs(touchX - touchStartX) > MOVE_THRESHOLD || Math.abs(touchY - touchStartY) > MOVE_THRESHOLD) {
                clearTimeout(tooltipTimer);
                // If tooltip was already shown by hold and then user drags off, hide it
                if (btn.dataset.tooltipShownByHold === 'true') {
                    hideTooltip();
                    btn.dataset.tooltipShownByHold = 'false';
                }
            }
        }, { passive: false });

        btn.addEventListener('touchend', e => {
            // e.preventDefault(); // Careful with this, it can prevent click event for spell selection
            clearTimeout(tooltipTimer);
            if (btn.dataset.tooltipShownByHold === 'true') {
                // If tooltip was shown by hold, we hide it and potentially consume the event
                // so it doesn't also select the spell.
                e.preventDefault(); // Prevent click if tooltip was shown
                hideTooltip();
                btn.dataset.tooltipShownByHold = 'false';
            }
            // If it was a quick tap (tooltipTimer didn't fire to show tooltip),
            // the absence of e.preventDefault() here (or if it was conditional)
            // allows the browser to generate a 'click' event, which setupSpellBarListeners handles.
        }, { passive: false });
        
        btn.addEventListener('touchcancel', e => {
            clearTimeout(tooltipTimer);
            if (btn.dataset.tooltipShownByHold === 'true') {
                hideTooltip();
                btn.dataset.tooltipShownByHold = 'false';
            }
        }, { passive: false });
    }
}
