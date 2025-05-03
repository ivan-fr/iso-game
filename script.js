// Existing script.js code...
// Make sure to include the setup for canvas, context, player, enemies etc.

// Import the inventory manager instance
import inventoryManager from './inventory.js';
// Import specific data needed by the UI rendering
import { allItems, allRecipes, allResources } from './inventory.js'; // Also import allResources and allItems

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element Selections ---
    const inventoryButton = document.getElementById('inventory-button');
    const inventoryModal = document.getElementById('inventory-modal');
    const closeButton = inventoryModal?.querySelector('.close-button'); // Add null checks
    const resourceList = document.getElementById('resource-list');
    const itemList = document.getElementById('item-list');
    const craftingList = document.getElementById('crafting-list');
    const equipmentSlots = {
        head: document.getElementById('slot-head'),
        // Add other slots when needed
    };
    const endMatchScreen = document.getElementById('end-match-screen');
    const dropSummaryContainer = document.getElementById('drop-summary');
    const finalScoreDisplay = document.getElementById('final-score');
    const restartButton = document.getElementById('restart-button');
    const nextRoomButton = document.getElementById('next-room-button');
    const endMatchTitle = document.getElementById('end-match-title');
    const tooltipElement = document.createElement('div'); // Moved tooltip creation inside

    // --- Tooltip Initialization ---
    tooltipElement.className = 'tooltip';
    document.body.appendChild(tooltipElement);
    let tooltipTimeout; // Keep timeout variable scoped

    // --- Tooltip Functions --- (showTooltip, hideTooltip defined here or outside if needed globally)
    function showTooltip(element, content) {
        clearTimeout(tooltipTimeout);
        tooltipElement.innerHTML = content;
        tooltipElement.style.display = 'block';

        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltipElement.getBoundingClientRect();

        // Position above the element, centered horizontally
        let top = rect.top - tooltipRect.height - 10 + window.scrollY;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2) + window.scrollX;

        // Adjust if tooltip goes off-screen
        if (top < 0) {
            top = rect.bottom + 10 + window.scrollY; // Position below if not enough space above
        }
        if (left < 0) {
            left = 5; // Prevent going off left edge
        }
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 5; // Prevent going off right edge
        }

        tooltipElement.style.top = `${top}px`;
        tooltipElement.style.left = `${left}px`;

        // Hide tooltip after a delay if mouse leaves the target element
        element.addEventListener('mouseleave', () => {
            tooltipTimeout = setTimeout(hideTooltip, 300); // Short delay before hiding
        });
        tooltipElement.addEventListener('mouseenter', () => { // Keep tooltip if mouse enters it
            clearTimeout(tooltipTimeout);
        });
        tooltipElement.addEventListener('mouseleave', () => { // Hide if mouse leaves tooltip
            tooltipTimeout = setTimeout(hideTooltip, 100);
        });
    }

    function hideTooltip() {
        clearTimeout(tooltipTimeout);
        tooltipElement.style.display = 'none';
    }


    // --- Inventory UI Functions ---
    function openInventory() {
        if (!inventoryModal) return;
        // Ensure the modal is in the DOM and displayed before starting the transition
        inventoryModal.style.display = 'block'; 
        inventoryModal.offsetHeight; // Force reflow/repaint
        
        // Use setTimeout to apply opacity change in the next tick
        setTimeout(() => {
            inventoryModal.style.opacity = '1';
        }, 0);

        updateInventoryUI(); // Update content when opened
        openTab(null, 'resources-tab'); // Default to resources tab
    }

    function closeInventory() {
        if (!inventoryModal) return;
        
        // Start the fade-out transition
        inventoryModal.style.opacity = '0';

        // Hide the element after the transition completes
        inventoryModal.addEventListener('transitionend', function handleTransitionEnd() {
            inventoryModal.style.display = 'none';
            // Important: Remove the listener to prevent multiple executions
            inventoryModal.removeEventListener('transitionend', handleTransitionEnd);
        });

        hideTooltip(); // Ensure tooltip is hidden when inventory closes
    }

    function openTab(evt, tabName) {
        if (!inventoryModal) return;
        let i, tabcontent, tablinks;
        tabcontent = inventoryModal.getElementsByClassName("tab-content");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        tablinks = inventoryModal.getElementsByClassName("tab-link");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        const currentTab = document.getElementById(tabName);
        if(currentTab) currentTab.style.display = "block";

        if (evt && evt.currentTarget) {
            evt.currentTarget.className += " active";
        } else {
            // If opened programmatically, find the correct button to mark active
            const button = Array.from(tablinks).find(btn => btn.getAttribute('onclick')?.includes(`'${tabName}'`));
            if (button) button.className += " active";
        }
        hideTooltip(); // Hide tooltip when switching tabs
    }

    // --- UI Rendering Functions --- (createInventoryItemElement, createCraftingRecipeElement)
    function createInventoryItemElement(itemData, count, type = 'resource') {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        div.dataset.itemId = itemData.id; // Store item ID for interactions
        div.dataset.itemType = type; // Store type ('resource', 'item', 'equipment')

        const img = document.createElement('img');
        img.src = itemData.img;
        img.alt = itemData.name;
        div.appendChild(img);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'inventory-item-name';
        nameSpan.textContent = itemData.name;
        div.appendChild(nameSpan);

        if (count > 1 && type !== 'resource') { // Only show count > 1 for non-resources (or always for resources)
            const countSpan = document.createElement('span');
            countSpan.className = 'inventory-item-count';
            countSpan.textContent = `x${count}`;
            div.appendChild(countSpan);
        } else if (type === 'resource') {
            const countSpan = document.createElement('span');
            countSpan.className = 'inventory-item-count';
            countSpan.textContent = `x${count}`;
            div.appendChild(countSpan);
        }


        // Add Tooltip Event Listener
        div.addEventListener('mouseenter', (event) => {
            let tooltipContent = `<div class="tooltip-title">${itemData.name}</div>`;
            tooltipContent += `<div class="tooltip-type">${itemData.type.charAt(0).toUpperCase() + itemData.type.slice(1)}</div>`;

            if (itemData.type === 'equipment' && itemData.stats) {
                tooltipContent += '<div>';
                for (const stat in itemData.stats) {
                    let sign = itemData.stats[stat] > 0 ? '+' : '';
                    tooltipContent += `<span class="tooltip-stat">${stat.toUpperCase()}: ${sign}${itemData.stats[stat]}</span><br>`;
                }
                tooltipContent += '</div>';
            } else if (type === 'resource') {
                tooltipContent += `<div>Owned: ${count}</div>`;
            }
            // Add more details if needed (description, value, etc.)

            showTooltip(event.currentTarget, tooltipContent);
        });
        // Basic mouseleave for item itself, tooltip logic handles the rest
        // div.addEventListener('mouseleave', hideTooltip);

        return div;
    }

    function createCraftingRecipeElement(recipeId) {
        const recipe = allRecipes[recipeId];
        const craftedItem = allItems[recipe.itemId];
        if (!recipe || !craftedItem) return null;

        const div = document.createElement('div');
        div.className = 'crafting-recipe';

        // Output Item
        const outputDiv = document.createElement('div');
        outputDiv.className = 'crafting-recipe-output';
        const outputImg = document.createElement('img');
        outputImg.src = craftedItem.img;
        outputImg.alt = craftedItem.name;
        const outputName = document.createElement('span');
        outputName.textContent = craftedItem.name;
        outputDiv.appendChild(outputImg);
        outputDiv.appendChild(outputName);
        div.appendChild(outputDiv);

        // Add tooltip for output item
        outputDiv.addEventListener('mouseenter', (event) => {
            let tooltipContent = `<div class="tooltip-title">${craftedItem.name}</div>`;
            tooltipContent += `<div class="tooltip-type">${craftedItem.type.charAt(0).toUpperCase() + craftedItem.type.slice(1)}</div>`;
            if (craftedItem.stats) {
                tooltipContent += '<div>';
                for (const stat in craftedItem.stats) {
                    let sign = craftedItem.stats[stat] > 0 ? '+' : '';
                    tooltipContent += `<span class="tooltip-stat">${stat.toUpperCase()}: ${sign}${craftedItem.stats[stat]}</span><br>`;
                }
                tooltipContent += '</div>';
            }
            showTooltip(event.currentTarget, tooltipContent);
        });
        // outputDiv.addEventListener('mouseleave', hideTooltip);


        // Ingredients
        const ingredientsDiv = document.createElement('div');
        ingredientsDiv.className = 'crafting-recipe-ingredients';
        let canCraft = true;
        recipe.ingredients.forEach(ing => {
            const resource = allResources[ing.resourceId];
            const currentAmount = inventoryManager.getResourceCount(ing.resourceId);
            const hasEnough = currentAmount >= ing.quantity;
            if (!hasEnough) canCraft = false;

            const ingDiv = document.createElement('div');
            ingDiv.className = 'ingredient';
            const ingImg = document.createElement('img');
            ingImg.src = resource?.img || 'assets/default_icon.png'; // Add fallback
            ingImg.alt = resource?.name || 'Unknown Resource';
            const ingText = document.createElement('span');
            ingText.innerHTML = `<span class="required">${ing.quantity}</span> <span class="${hasEnough ? 'available' : 'missing'}">(${currentAmount})</span>`;
            ingDiv.appendChild(ingImg);
            ingDiv.appendChild(ingText);
            ingredientsDiv.appendChild(ingDiv);

            // Add tooltip for ingredient
            ingDiv.addEventListener('mouseenter', (event) => {
                let tooltipContent = `<div class="tooltip-title">${resource?.name || 'Unknown'}</div>`;
                tooltipContent += `<div>Required: ${ing.quantity}</div>`;
                tooltipContent += `<div>Owned: ${currentAmount}</div>`;
                showTooltip(event.currentTarget, tooltipContent);
            });
            // ingDiv.addEventListener('mouseleave', hideTooltip);

        });
        div.appendChild(ingredientsDiv);

        // Craft Button
        const craftButton = document.createElement('button');
        craftButton.className = 'craft-button';
        craftButton.textContent = 'Craft';
        craftButton.disabled = !canCraft;
        craftButton.onclick = () => {
            if (inventoryManager.craftItem(recipeId)) {
                // Success feedback? (Optional)
                // UI will update automatically via inventoryManager.updateUI() -> which calls window.updateInventoryUI
            } else {
                // Failure feedback? (e.g., shake button, show message)
                console.log("Crafting failed for:", recipeId);
            }
        };
        div.appendChild(craftButton);

        return div;
    }


    // --- Main UI Update Function ---
    function renderInventory() {
        if (!resourceList || !itemList || !craftingList) return; // Add checks

        // Clear previous content
        resourceList.innerHTML = '';
        itemList.innerHTML = '';
        craftingList.innerHTML = '';
        // Clear equipment slots (handled separately in renderEquipment)

        // Render Resources
        for (const resourceId in inventoryManager.resources) {
            const count = inventoryManager.resources[resourceId];
            if (count > 0 && allResources[resourceId]) {
                const elem = createInventoryItemElement(allResources[resourceId], count, 'resource');
                resourceList.appendChild(elem);
            }
        }
        if (resourceList.children.length === 0) {
            resourceList.innerHTML = '<p style="text-align: center; color: #888;">No resources yet.</p>';
        }

        // Render Items
        for (const itemId in inventoryManager.items) {
            const count = inventoryManager.items[itemId];
            if (count > 0 && allItems[itemId]) {
                const itemData = allItems[itemId];
                const elem = createInventoryItemElement(itemData, count, itemData.type); // Pass type
                // Add double-click listener for equipping
                if (itemData.type === 'equipment') {
                    elem.addEventListener('dblclick', () => {
                        if (inventoryManager.equipItem(itemId)) {
                             // Successfully equipped, now update stats
                             if(typeof window.updatePlayerStatsUI === 'function' && typeof window.player !== 'undefined') {
                                 window.updatePlayerStatsUI(window.player);
                             } else {
                                console.warn("Could not update player stats after equipping.");
                             }
                        }
                    });
                }
                itemList.appendChild(elem);
            }
        }
        if (itemList.children.length === 0) {
            itemList.innerHTML = '<p style="text-align: center; color: #888;">No items yet. Try crafting!</p>';
        }

        // Render Crafting Recipes
        for (const recipeId in allRecipes) {
            const elem = createCraftingRecipeElement(recipeId);
            if (elem) {
                craftingList.appendChild(elem);
            }
        }
        if (craftingList.children.length === 0) {
            craftingList.innerHTML = '<p style="text-align: center; color: #888;">No recipes available.</p>';
        }

        // Render Equipment
        renderEquipment();
    }

    // --- Equipment Rendering ---
    function renderEquipment() {
        for (const slot in equipmentSlots) {
            const displayDiv = equipmentSlots[slot];
            if (!displayDiv) continue; // Add check

            displayDiv.innerHTML = ''; // Clear previous
            displayDiv.classList.remove('empty'); // Remove empty class
            displayDiv.style.cursor = 'default'; // Reset cursor

             // Simple way to remove old listeners: Clone and replace
            const newDisplayDiv = displayDiv.cloneNode(true);
            displayDiv.parentNode.replaceChild(newDisplayDiv, displayDiv);
            equipmentSlots[slot] = newDisplayDiv; // Update reference


            const equippedItemId = inventoryManager.equipment[slot];
            if (equippedItemId && allItems[equippedItemId]) {
                const itemData = allItems[equippedItemId];
                const img = document.createElement('img');
                img.src = itemData.img;
                img.alt = itemData.name;
                const nameSpan = document.createElement('span');
                nameSpan.textContent = itemData.name;

                newDisplayDiv.appendChild(img);
                newDisplayDiv.appendChild(nameSpan);

                // Add tooltip
                newDisplayDiv.addEventListener('mouseenter', (event) => {
                    let tooltipContent = `<div class="tooltip-title">${itemData.name}</div>`;
                    tooltipContent += `<div class="tooltip-type">${itemData.type.charAt(0).toUpperCase() + itemData.type.slice(1)} (Equipped)</div>`;
                    if (itemData.stats) {
                        tooltipContent += '<div>';
                        for (const stat in itemData.stats) {
                            let sign = itemData.stats[stat] > 0 ? '+' : '';
                            tooltipContent += `<span class="tooltip-stat">${stat.toUpperCase()}: ${sign}${itemData.stats[stat]}</span><br>`;
                        }
                        tooltipContent += '</div>';
                    }
                    showTooltip(event.currentTarget, tooltipContent);
                });
                // newDisplayDiv.addEventListener('mouseleave', hideTooltip);


                // Add click to unequip
                newDisplayDiv.onclick = () => { // Use single click on the slot to unequip
                    if (inventoryManager.unequipItem(slot)) {
                        // Successfully unequipped, now update stats
                         if(typeof window.updatePlayerStatsUI === 'function' && typeof window.player !== 'undefined') {
                             window.updatePlayerStatsUI(window.player);
                         } else {
                            console.warn("Could not update player stats after unequipping.");
                         }
                    }
                };
                newDisplayDiv.style.cursor = 'pointer';


            } else {
                newDisplayDiv.textContent = 'Empty';
                newDisplayDiv.classList.add('empty');
            }
        }
    }


    // --- End Match Screen Functions ---
    /**
     * Displays the end match screen (victory or game over).
 * @param {boolean} isVictory - True if the player won, false if game over.
 * @param {number} finalScore - The player's final score.
 * @param {Object} defeatedEnemiesCount - Counts of defeated enemies by type.
 */
    function showEndMatchScreen(isVictory, finalScore, defeatedEnemiesCount) {
        console.log('showEndMatchScreen called (inside DOMContentLoaded):', { isVictory, finalScore, defeatedEnemiesCount });

        // Ensure elements exist before manipulating
        if (!endMatchScreen || !dropSummaryContainer || !finalScoreDisplay || !endMatchTitle || !restartButton || !nextRoomButton) {
            console.error("One or more end-match screen elements not found!");
            return;
        }

        // --- Calculate and Display Drops ONLY on Victory ---
        if (isVictory) {
            if (!inventoryManager) {
                console.error("Inventory Manager not initialized when showing end match screen!");
                dropSummaryContainer.innerHTML = '<h4>Resources Acquired:</h4><p>Error calculating drops.</p>';
            } else {
                const drops = inventoryManager.calculateDrops(defeatedEnemiesCount);
                console.log('Calculated drops:', drops);

                let dropHtml = '<h4>Resources Acquired:</h4>';
                const dropKeys = Object.keys(drops);
                if (drops && dropKeys.length > 0) {
                    dropHtml += '<ul>';
                    dropKeys.forEach(itemId => {
                        const quantity = drops[itemId];
                        const resourceData = allResources[itemId];
                        if (resourceData) {
                            dropHtml += `<li><img src="${resourceData.icon || resourceData.img || 'assets/default_icon.png'}" alt="${resourceData.name}" class="drop-icon"> ${resourceData.name} x ${quantity}</li>`;
                        } else {
                            console.warn(`Resource data not found for drop item ID: ${itemId}`);
                        }
                    });
                    dropHtml += '</ul>';
                } else if (defeatedEnemiesCount && Object.values(defeatedEnemiesCount).some(count => count > 0)) {
                    dropHtml += '<p>No resources dropped this time.</p>';
                } else {
                    dropHtml += '<p>No enemies defeated.</p>';
                }
                dropSummaryContainer.innerHTML = dropHtml;
            }
             dropSummaryContainer.style.display = 'block'; // Show drop container on victory
        } else {
             // On Game Over, clear and hide the drop summary
             dropSummaryContainer.innerHTML = '';
             dropSummaryContainer.style.display = 'none';
        }
        // --- End Drop Calculation ---

        finalScoreDisplay.textContent = finalScore;

        if (isVictory) {
            endMatchTitle.textContent = "Victory!";
            restartButton.style.display = 'none';
            nextRoomButton.style.display = 'inline-block'; // Show next room button
        } else {
            endMatchTitle.textContent = "Game Over!";
            restartButton.style.display = 'inline-block'; // Show restart button
            nextRoomButton.style.display = 'none';
        }

        endMatchScreen.style.display = 'flex'; // Use flex for centering
        endMatchScreen.style.opacity = '1'; // Force opacity to ensure visibility
    }

    // Function to hide the end match screen
    function hideEndMatchScreen() {
        if (!endMatchScreen) return;
        endMatchScreen.style.display = 'none';
    }

    // --- Stat Update Functions ---
    function applyEquipmentStats(player) { // Accept player object
        // Assuming 'player' is your player object with base stats
        // This needs to be accessible, perhaps make player part of a global game state object?
        // if (typeof window.player !== 'undefined') { // Check passed player instead
        if (player && typeof inventoryManager !== 'undefined') { // Added check for inventoryManager
            // Store old max AP before recalculating bonuses
            const oldMaxAp = player.baseMaxAp + (player.paBonus || 0);

            // Reset to base stats first (if base stats are stored separately)
            // player.damage = player.baseDamage;
            // player.maxPA = player.baseMaxPA;
            // player.maxHealth = player.baseMaxHealth // etc.

            // Then add bonuses
            player.damageBonus = inventoryManager.getStatBonus('damage');
            player.paBonus = inventoryManager.getStatBonus('pa');
            player.mpBonus = inventoryManager.getStatBonus('mp'); // Added MP Bonus
            // Apply other stat bonuses similarly

            // Calculate new max AP and the difference
            const newMaxAp = player.baseMaxAp + player.paBonus;
            const apDifference = newMaxAp - oldMaxAp;
            const currentApBeforeAdjustment = player.ap; // Store current AP before potential changes

            // Adjust current AP if max AP changed
            if (apDifference > 0) {
                 // If Max AP increased, only add the difference if player had AP > 0 before
                 if (currentApBeforeAdjustment > 0) {
                     player.ap = Math.min(newMaxAp, currentApBeforeAdjustment + apDifference);
                     console.log(`Max AP increased by ${apDifference}. Current AP adjusted to ${player.ap}/${newMaxAp}`);
                 } else {
                     // Player was at 0 AP, keep AP at 0 despite max increase
                     player.ap = 0;
                     console.log(`Max AP increased by ${apDifference}, but player had 0 AP. Current AP remains ${player.ap}/${newMaxAp}`);
                 }
            } else if (apDifference < 0) {
                 // If Max AP decreased, cap current AP at the new lower maximum
                 player.ap = Math.min(newMaxAp, currentApBeforeAdjustment);
                 console.log(`Max AP decreased by ${Math.abs(apDifference)}. Current AP capped at ${player.ap}/${newMaxAp}`);
            }

            // Update player.maxAp (used in startPlayerTurn)
            player.maxAp = newMaxAp; 

            // Update UI elements that show stats
            updatePlayerDisplayStats(player); // Pass player along

            console.log(`Equipment Applied: Damage Bonus=${player.damageBonus}, PA Bonus=${player.paBonus}, MP Bonus=${player.mpBonus}`);
        } else {
             console.warn("applyEquipmentStats: player object was not provided.");
        }
    }

    function updatePlayerDisplayStats(player) { // Accept player object
        // Update health, PA, damage display etc. based on player stats + bonuses
        // Uses the new spans added in index.html inside #player-stats
        const hpDisplay = document.getElementById('ui-player-hp');
        const maxHpDisplay = document.getElementById('ui-player-max-hp');
        const apDisplay = document.getElementById('ui-player-ap');
        const maxApDisplay = document.getElementById('ui-player-max-ap');
        const mpDisplay = document.getElementById('ui-player-mp');
        const maxMpDisplay = document.getElementById('ui-player-max-mp');
        const dmgBonusDisplay = document.getElementById('ui-player-dmg-bonus');
         const playerHealthBar = document.getElementById('player-health-bar'); // Moved up
         const oldPlayerApDisplay = document.getElementById('player-ap'); // Moved up
         const oldPlayerMpDisplay = document.getElementById('player-mp'); // Moved up

        // if (typeof window.player !== 'undefined' && typeof inventoryManager !== 'undefined') { // Check passed player instead
        if (player && typeof inventoryManager !== 'undefined') {
            // const player = window.player; // Use local ref - NO, use parameter
            const currentHp = player.hp;
            const maxHp = player.maxHp; // Assuming maxHP isn't boosted by equipment for now
            const currentAp = player.ap;
            // Recalculate maxAp based on base + bonus
            const maxAp = player.baseMaxAp + inventoryManager.getStatBonus('pa');
            const currentMp = player.mp;
            const maxMp = player.baseMaxMp + inventoryManager.getStatBonus('mp'); // Apply MP bonus
            const damageBonus = inventoryManager.getStatBonus('damage');
            console.log("[Init Trace] Inside updatePlayerDisplayStats, reading values: currentAp =", currentAp, "maxAp =", maxAp); // Log 3

            if (hpDisplay) hpDisplay.textContent = currentHp;
            if (maxHpDisplay) maxHpDisplay.textContent = maxHp;
            if (apDisplay) apDisplay.textContent = currentAp;
            if (maxApDisplay) maxApDisplay.textContent = maxAp;
            if (mpDisplay) mpDisplay.textContent = currentMp;
            if (maxMpDisplay) maxMpDisplay.textContent = maxMp;
            if (dmgBonusDisplay) {
                dmgBonusDisplay.textContent = damageBonus > 0 ? `+${damageBonus}` : '0';
                dmgBonusDisplay.style.color = damageBonus > 0 ? '#4CAF50' : 'inherit'; // Green if bonus > 0
            }

            // Also update the AP/MP display in the older info bar for consistency?
            if (oldPlayerApDisplay) oldPlayerApDisplay.textContent = `AP: ${currentAp}`;
            if (oldPlayerMpDisplay) oldPlayerMpDisplay.textContent = `MP: ${currentMp}`; // Updated format

            // Update player health bar in the older info bar
            if (playerHealthBar) {
                const healthPercent = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
                playerHealthBar.style.width = `${healthPercent}%`;
                // Change color based on health?
                if (healthPercent < 30) playerHealthBar.style.background = 'linear-gradient(to bottom, #e74c3c, #c0392b)'; // Red
                else if (healthPercent < 60) playerHealthBar.style.background = 'linear-gradient(to bottom, #f1c40f, #f39c12)'; // Yellow
                else playerHealthBar.style.background = 'linear-gradient(to bottom, #74b9ff, #0984e3)'; // Blue (Default)
            }

        } else {
             console.warn("updatePlayerDisplayStats: player object or inventoryManager not available.");
            // Clear fields if player or inventory not available
            if (hpDisplay) hpDisplay.textContent = '?';
            if (maxHpDisplay) maxHpDisplay.textContent = '?';
            if (apDisplay) apDisplay.textContent = '?';
            if (maxApDisplay) maxApDisplay.textContent = '?';
            if (mpDisplay) mpDisplay.textContent = '?';
            if (maxMpDisplay) maxMpDisplay.textContent = '?';
            if (dmgBonusDisplay) {
                dmgBonusDisplay.textContent = '?';
                dmgBonusDisplay.style.color = 'inherit';
            }
            if (oldPlayerApDisplay) oldPlayerApDisplay.textContent = '?';
            if (oldPlayerMpDisplay) oldPlayerMpDisplay.textContent = '?';
            if (playerHealthBar) playerHealthBar.style.width = `100%`;
        }
    }


    // --- Event Listeners ---
    if(inventoryButton) inventoryButton.addEventListener('click', openInventory);
    if(closeButton) closeButton.addEventListener('click', closeInventory);

    // Add event listeners for tab buttons
    const tabButtons = inventoryModal?.querySelectorAll('.tab-link');
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const tabName = event.currentTarget.getAttribute('data-tab');
                if (tabName) {
                    openTab(event, tabName);
                }
            });
        });
    }

    // Close inventory if clicking outside the modal content
    window.addEventListener('click', (event) => {
        if (event.target === inventoryModal) {
            closeInventory();
        }
    });

    // Close modals with Escape key
    window.addEventListener('keydown', (event) => {
         // Close inventory
        if (event.key === 'Escape' && inventoryModal?.style.display === 'block') {
            closeInventory();
        }
        // Close end match screen (only if Game Over?)
        if (event.key === 'Escape' && endMatchScreen?.style.display === 'flex') {
            // Decide what happens: close modal and restart? Or just close?
            // For now, let's mimic restart button functionality if it's game over
            if (restartButton?.style.display !== 'none') { // If restart button is visible (game over)
                location.reload();
            }
            // If it's victory, maybe just close the modal and wait for button click?
            // Or trigger next room? For simplicity, let's not close on Esc for victory for now.
            // hideEndMatchScreen(); // Optionally just hide it
        }
    });

     // End Match Screen Button Listeners
    if (restartButton) {
        restartButton.addEventListener('click', () => {
            // Reset inventory? Or keep it persistent? Let's keep it for now.
            // Optionally clear:
            // localStorage.removeItem('inventory_resources');
            // localStorage.removeItem('inventory_items');
            // localStorage.removeItem('inventory_equipment');
            // inventoryManager = new InventoryManager(); // Reinitialize
            location.reload(); // Simple way to restart the game
        });
    } else {
         console.error("#restart-button not found");
    }

     if (nextRoomButton) {
        nextRoomButton.addEventListener('click', () => {
            console.log("[Next Room Button] Clicked. Attempting to load next room...");
            // Assuming loadRoom is globally accessible from game.js or exported
            // and currentRoomId is managed correctly in game.js
            // Let's assume it will be exposed as window.currentGame.loadRoom
            if (typeof window.currentGame?.loadRoom === 'function' && typeof window.currentGame?.currentRoomId !== 'undefined') {
                 console.log("Calling window.currentGame.loadRoom with ID:", window.currentGame.currentRoomId);
                window.currentGame.loadRoom(window.currentGame.currentRoomId); // Assumes currentRoomId was already incremented
                hideEndMatchScreen(); // Hide modal
            } else {
                console.error("[Next Room Button] Cannot find loadRoom function or currentRoomId on window.currentGame. Game object:", window.currentGame);
                // Optionally, provide feedback to the user
                alert("Error: Could not proceed to the next room. Check console for details.");
            }
        });
    } else {
        console.error("#next-room-button not found");
    }


    // --- Initial Setup ---
    renderInventory();    // Initial render of the inventory panel (though hidden)

    // --- Expose functions needed globally AFTER they are defined ---
    // Make updateInventoryUI globally accessible for InventoryManager
    window.updateInventoryUI = renderInventory;
    // Explicitly expose functions needed by other modules on the window object
    window.showEndMatchScreen = showEndMatchScreen;
    window.hideEndMatchScreen = hideEndMatchScreen;
    window.applyEquipmentStats = applyEquipmentStats;
    window.updatePlayerDisplayStats = updatePlayerDisplayStats;

    // NEW: Function to explicitly trigger both stat updates
    function updatePlayerStatsUI(player) { // Accept player object
        console.log("[UI Update Trigger] updatePlayerStatsUI called.");
        // Pass player to the functions
        applyEquipmentStats(player);
        // updatePlayerDisplayStats(player); // Called by applyEquipmentStats now
    }
    window.updatePlayerStatsUI = updatePlayerStatsUI;

    // --- Initialize Game (if applicable) ---
    // If your main game initialization happens elsewhere (e.g., in game.js),
    // ensure it runs *after* this DOMContentLoaded listener completes,
    // or include its initialization call here if appropriate.
    // Example: if (typeof initializeGame === 'function') { initializeGame(); }

}); // End of DOMContentLoaded listener


// ... Global variables or functions that MUST be defined outside DOMContentLoaded ...
// e.g., If 'player' or 'enemies' objects are created here and used by imported modules like game.js immediately.
// However, it's generally safer to initialize everything that interacts with the DOM inside DOMContentLoaded.

// Ensure InventoryManager is accessible globally if needed by other scripts before DOMContentLoaded
// (though it's better if dependencies are managed via imports/exports)
// window.inventoryManager = inventoryManager; // Usually not needed if imported correctly

// ... rest of your script.js, IF ANY PARTS NEED TO RUN BEFORE DOM IS READY ...
// Typically, most code should be inside the DOMContentLoaded listener or triggered by it.
// If game.js relies on things being set up immediately (like `window.player`),
// those specific setups might need careful placement, or game.js logic
// should also wait for DOMContentLoaded or a custom 'ready' event.

// Example: If game.js needs player object defined globally right away
// window.player = { /* initial player data */ };
// This is generally discouraged; prefer modules or a central game state object.
// If game.js is also a module, it can import necessary functions/data.
// If game.js expects global functions like showEndMatchScreen, ensure they are assigned
// to window inside DOMContentLoaded as done above.

// ... rest of your script.js, including game loop (animate function), event listeners for game actions etc. 