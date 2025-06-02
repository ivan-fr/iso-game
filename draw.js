// draw.js
import { isoToScreen } from './grid.js'; // Import isoToScreen
import inventoryManager, { allItems } from './inventory.js'; // Import inventoryManager and allItems

// --- Simple Noise Helper ---
const noise_pattern = {};
for (let i = -50; i < 50; i++) {
    for (let j = -50; j < 50; j++) {
        noise_pattern[`${i},${j}`] = Math.random() * 0.08; // Small noise factor
    }
}
function get_noise(x, y) {
    const ix = Math.floor(x / 10) % 50;
    const iy = Math.floor(y / 10) % 50;
    return noise_pattern[`${ix},${iy}`] ?? 0.04;
}
// --- End Noise Helper ---

// --- Simple Image Cache ---
const imageCache = {};
function loadImage(src) {
    if (!imageCache[src]) {
        imageCache[src] = {
            img: new Image(),
            loaded: false
        };
        imageCache[src].img.onload = () => {
            imageCache[src].loaded = true;
            console.log(`Image loaded and cached: ${src}`);
        };
        imageCache[src].img.onerror = () => {
            console.error(`Failed to load image: ${src}`);
            // Optionally mark as failed or remove from cache
            imageCache[src].loaded = false; // Keep loaded false
        };
        imageCache[src].img.src = src;
    }
    return imageCache[src];
}
// --- End Simple Image Cache ---

// Fonction pour dessiner une tuile isométrique
export function drawTile(ctx, gridX, gridY, type, highlightColor, highlightType, tileImage, tileImageLoaded, mapGrid, TILE_W, TILE_H, currentGridCols, currentGridRows, drawOnlyObstacleVisual = false) {
    const pos = isoToScreen(gridX, gridY);

    ctx.save();
    ctx.translate(Math.round(pos.x), Math.round(pos.y));

    // Define topPath (diamond shape) for all tiles upfront
    const topPath = new Path2D();
    topPath.moveTo(0, -TILE_H / 2);
    topPath.lineTo(TILE_W / 2, 0);
    topPath.lineTo(0, TILE_H / 2);
    topPath.lineTo(-TILE_W / 2, 0);
    topPath.closePath();

    // --- Gestion des obstacles (type === 1) ---
    if (type === 1) {
        // 1. Draw base tile underneath (ONLY if not just drawing the visual)
        if (!drawOnlyObstacleVisual) {
            if (tileImageLoaded) {
                ctx.save();
                ctx.clip(topPath);
                ctx.drawImage(tileImage, -TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
                ctx.restore();
            } else {
                // Fallback base color (consistent with regular tiles)
                const base_color = (gridX + gridY) % 2 === 0 ? '#C8B88A' : '#DDCBAC'; // Slightly lighter earthy tones
                ctx.fillStyle = base_color;
                ctx.fill(topPath);
                // Subtle gradient overlay for fallback
                ctx.save();
                const grad = ctx.createLinearGradient(-TILE_W/4, -TILE_H/2, TILE_W/4, TILE_H/2);
                grad.addColorStop(0, 'rgba(255,255,255,0.08)');
                grad.addColorStop(0.5, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(0,0,0,0.05)');
                ctx.fillStyle = grad;
                ctx.fill(topPath);
                ctx.restore();
            }
        }

        // 2. Draw Obstacle Image or Fallback (ALWAYS draw if type is 1)
        const useArbre = (gridX + gridY) % 2 === 0;
        let img = null;
        if (useArbre && window.arbreImage && window.arbreImage.complete) img = window.arbreImage;
        if (!useArbre && window.caisseImage && window.caisseImage.complete) img = window.caisseImage;

        if (img) {
            // Draw obstacle shadow first
            ctx.save();
            const shadowOffsetX = 4 * (TILE_W/80);
            const shadowOffsetY = 8 * (TILE_H/40);
            const shadowPosX = shadowOffsetX;
            const shadowPosY = shadowOffsetY;
            const shadowRadiusX = TILE_W * 0.45;
            const shadowRadiusY = TILE_H * 0.28;

            // Use topPath for clipping the shadow to the tile
            ctx.clip(topPath); // Clip to the tile area first

            // Create radial gradient for soft shadow
            const shadowGradient = ctx.createRadialGradient(
                shadowPosX, shadowPosY, 0, // Inner circle (center)
                shadowPosX, shadowPosY, Math.max(shadowRadiusX, shadowRadiusY) // Outer circle (radius)
            );
            shadowGradient.addColorStop(0, 'rgba(44, 62, 80, 0.4)'); // Darker, more opaque center
            shadowGradient.addColorStop(0.7, 'rgba(44, 62, 80, 0.2)'); // Mid fade
            shadowGradient.addColorStop(1, 'rgba(44, 62, 80, 0)');   // Fully transparent edge

            ctx.fillStyle = shadowGradient;
            ctx.beginPath();
            // Draw ellipse slightly larger than original radius to account for gradient fading
            ctx.ellipse(shadowPosX, shadowPosY, shadowRadiusX * 1.1, shadowRadiusY * 1.1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore(); // Restore from clip

            // Draw the image itself
            ctx.save();
            let verticalOffset;
            let drawWidth, drawHeight;
            if (useArbre) {
                drawWidth = TILE_W * 1.1; // Slightly larger tree
                drawHeight = img.height * (drawWidth / img.width);
                verticalOffset = TILE_H / 2 - drawHeight + (TILE_H * 0.1); // Anchor slightly lower
            } else { // Caisse
                drawWidth = TILE_W * 0.85; // Slightly larger box
                drawHeight = img.height * (drawWidth / img.width);
                verticalOffset = TILE_H / 2 - drawHeight + (TILE_H * 0.05); // Anchor slightly lower
            }
            ctx.drawImage(img, -drawWidth/2, verticalOffset, drawWidth, drawHeight);
            ctx.restore();

        } else { // Fallback obstacle drawing (improved 3D block)
            ctx.save();
            const obHeight = TILE_H * 0.9; // Taller block
            const topY = - TILE_H / 2;
            const bottomY = topY + obHeight;
            const obColorTop = '#a08472'; // Lighter brown top
            const obColorSideDark = '#654321'; // Darker brown
            const obColorSideLight = '#8a6d4f'; // Medium brown

            // Draw sides first (with subtle gradients)
            const gradDark = ctx.createLinearGradient(-TILE_W/2, topY, -TILE_W/2, bottomY + TILE_H/2);
            gradDark.addColorStop(0, obColorSideLight); // Lighter top of side
            gradDark.addColorStop(1, obColorSideDark); // Darker bottom
            ctx.fillStyle = gradDark;
            ctx.beginPath();
            ctx.moveTo(-TILE_W / 2, topY); // Top-Left
            ctx.lineTo(0, topY + TILE_H / 2); // Top-Center
            ctx.lineTo(0, bottomY + TILE_H / 2); // Bottom-Center
            ctx.lineTo(-TILE_W / 2, bottomY); // Bottom-Left
            ctx.closePath();
            ctx.fill();

            const gradLight = ctx.createLinearGradient(TILE_W/2, topY, TILE_W/2, bottomY + TILE_H/2);
            gradLight.addColorStop(0, obColorTop); // Lighter top of side
            gradLight.addColorStop(1, obColorSideLight); // Darker bottom
            ctx.fillStyle = gradLight;
            ctx.beginPath();
            ctx.moveTo(TILE_W / 2, topY); // Top-Right
            ctx.lineTo(0, topY + TILE_H / 2); // Top-Center
            ctx.lineTo(0, bottomY + TILE_H / 2); // Bottom-Center
            ctx.lineTo(TILE_W / 2, bottomY); // Bottom-Right
            ctx.closePath();
            ctx.fill();

            // Draw top face
            ctx.fillStyle = obColorTop;
            ctx.beginPath();
            ctx.moveTo(0, topY); // Center
            ctx.lineTo(TILE_W / 2, topY + TILE_H / 4); // Right-Mid
            ctx.lineTo(0, topY + TILE_H / 2); // Center-Bottom
            ctx.lineTo(-TILE_W / 2, topY + TILE_H / 4); // Left-Mid
            ctx.closePath();
            ctx.fill();

            // Stroke for definition
            ctx.strokeStyle = 'rgba(40, 20, 10, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke(); // Stroke the top face
            // Stroke side edges too
            ctx.beginPath();
            ctx.moveTo(-TILE_W/2, topY); ctx.lineTo(-TILE_W/2, bottomY); ctx.stroke();
            ctx.moveTo(TILE_W/2, topY); ctx.lineTo(TILE_W/2, bottomY); ctx.stroke();
            ctx.moveTo(0, topY + TILE_H/2); ctx.lineTo(0, bottomY + TILE_H/2); ctx.stroke();

            ctx.restore();
        }

    // --- Regular Walkable Tile (type !== 1) ---
    } else {
        let leftEdgePath = null;
        let rightEdgePath = null;

        // Determine edge visibility (Simplified: only check direct neighbors)
        const depth = 14 * (TILE_W / 80); // Slightly deeper edge, scaled
        const isLeftEdge = gridX === 0 || mapGrid[gridY]?.[gridX - 1] === 1;
        const isRightEdge = gridX === currentGridCols - 1 || mapGrid[gridY]?.[gridX + 1] === 1;
        const isBottomLeftEdge = gridY === currentGridRows - 1 || mapGrid[gridY + 1]?.[gridX] === 1;
        const isBottomRightEdge = gridY === currentGridRows - 1 || mapGrid[gridY + 1]?.[gridX] === 1;
        // Note: A true bottom edge needs two faces. We simplify by drawing left/right faces based on *adjacent* bottom tiles.

        if (isLeftEdge || isBottomLeftEdge) {
            leftEdgePath = new Path2D();
            leftEdgePath.moveTo(-TILE_W / 2, 0); // Tile Mid-Left
            leftEdgePath.lineTo(-TILE_W / 2, depth); // Tile Bottom-Left (depth)
            leftEdgePath.lineTo(0, TILE_H / 2 + depth); // Tile Bottom-Center (depth)
            leftEdgePath.lineTo(0, TILE_H / 2); // Tile Bottom-Center
            leftEdgePath.closePath();
        }
        if (isRightEdge || isBottomRightEdge) {
            rightEdgePath = new Path2D();
            rightEdgePath.moveTo(TILE_W / 2, 0); // Tile Mid-Right
            rightEdgePath.lineTo(TILE_W / 2, depth); // Tile Bottom-Right (depth)
            rightEdgePath.lineTo(0, TILE_H / 2 + depth); // Tile Bottom-Center (depth)
            rightEdgePath.lineTo(0, TILE_H / 2); // Tile Bottom-Center
            rightEdgePath.closePath();
        }

        // Draw Top Face (Diamond Shape)
        if (tileImageLoaded) {
            ctx.save();
            ctx.clip(topPath);
            ctx.drawImage(tileImage, -TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
            ctx.restore();
        } else {
            // Fallback tile colors (slightly lighter earthy tones)
            const base_color = (gridX + gridY) % 2 === 0 ? '#CBBFA0' : '#E1D0B1'; // Slightly adjusted base tones
            ctx.fillStyle = base_color;
            ctx.fill(topPath); // Fill base color first

            // Add subtle gradient overlay (refined)
            ctx.save();
            ctx.clip(topPath); // Clip gradient to tile top
            const grad = ctx.createLinearGradient(-TILE_W/2 * 0.8, -TILE_H/2 * 0.8, TILE_W/2 * 0.8, TILE_H/2 * 0.8); // Gradient covers more of the tile
            grad.addColorStop(0, 'rgba(255,255,255,0.12)'); // Slightly stronger highlight
            grad.addColorStop(0.4, 'rgba(255,255,255,0)');   // Fade highlight quicker
            grad.addColorStop(0.6, 'rgba(0,0,0,0)');         // Start shadow later
            grad.addColorStop(1, 'rgba(0,0,0,0.10)');      // Slightly stronger shadow
            ctx.fillStyle = grad;
            ctx.fill(topPath);
            ctx.restore(); // Restore from clip

            // Add subtle noise overlay (kept from before)
            ctx.save();
            ctx.clip(topPath);
            ctx.globalAlpha = 0.4; // Slightly less intense noise
            for (let nx = -TILE_W / 2; nx < TILE_W / 2; nx += 5) { // Larger noise pattern
                for (let ny = -TILE_H / 2; ny < TILE_H / 2; ny += 5) {
                    if ((Math.abs(nx) / (TILE_W / 2)) + (Math.abs(ny) / (TILE_H / 2)) <= 1.05) { // Check inside diamond
                        let noise_val = get_noise(pos.x + nx, pos.y + ny);
                        let noise_color_val = Math.floor(190 + noise_val * 150);
                        ctx.fillStyle = `rgba(${noise_color_val},${noise_color_val},${noise_color_val}, 0.08)`; // Fainter noise
                        ctx.fillRect(Math.round(nx), Math.round(ny), 5, 5);
                    }
                }
            }
            ctx.restore();

            // Add subtle stroke for definition if no image
            ctx.strokeStyle = 'rgba(0,0,0,0.12)'; // Slightly darker stroke
            ctx.lineWidth = 1.5;
            ctx.stroke(topPath);
        }

        // Draw the edge faces AFTER the top face
        const edgeColorDark = '#7f5f3f'; // Darker edge color
        const edgeColorLight = '#9a7d5f'; // Lighter edge color
        const edgeStrokeColor = 'rgba(50, 30, 15, 0.4)'; // Darker edge stroke

        if (leftEdgePath) {
            ctx.save();
            const gradEdge = ctx.createLinearGradient(-TILE_W/2, 0, 0, TILE_H/2 + depth);
            gradEdge.addColorStop(0, edgeColorLight); // Lighter top of edge
            gradEdge.addColorStop(1, edgeColorDark); // Darker bottom
            ctx.fillStyle = gradEdge;
            // ctx.globalAlpha = 0.85; // Edges slightly more opaque
            ctx.fill(leftEdgePath);
            ctx.strokeStyle = edgeStrokeColor;
            ctx.lineWidth = 1;
            ctx.stroke(leftEdgePath);
            ctx.restore();
        }
        if (rightEdgePath) {
             ctx.save();
             const gradEdge = ctx.createLinearGradient(TILE_W/2, 0, 0, TILE_H/2 + depth);
             gradEdge.addColorStop(0, edgeColorLight); // Lighter top of edge
             gradEdge.addColorStop(1, edgeColorDark); // Darker bottom
             ctx.fillStyle = gradEdge;
            // ctx.globalAlpha = 0.80;
            ctx.fill(rightEdgePath);
            ctx.strokeStyle = edgeStrokeColor;
            ctx.lineWidth = 1;
            ctx.stroke(rightEdgePath);
            ctx.restore();
        }
    }

    // --- Draw Highlight Overlay (applied to all tile types if present) ---
    if (highlightColor) {
        ctx.save();
        ctx.fillStyle = highlightColor; // Use the potentially pulsating color string passed in
        ctx.fill(topPath); // Fill the main highlight color

        // --- Conditional Border/Effect based on highlightType --- 
        const now = performance.now();
        const pulseFast = 0.8 + 0.2 * Math.sin(now / 150); // Faster pulse for hover/target

        if (highlightType.includes('_hover')) { 
            // HOVERED TILE: Strong pulsating white outline + inner glow
            ctx.save(); // Save before applying glow/stroke effects

            // Inner Glow
            ctx.clip(topPath); // Clip glow to the tile shape
            const innerGlowGrad = ctx.createRadialGradient(
                0, 0, 0, // Inner circle center (radius 0)
                0, 0, TILE_W * 0.6 // Outer circle radius (adjust as needed)
            );
            // Use pulseFast for pulsating alpha
            innerGlowGrad.addColorStop(0, `rgba(255, 255, 255, ${0.20 * pulseFast})`); 
            innerGlowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Fade out
            ctx.fillStyle = innerGlowGrad;
            ctx.fill(topPath); // Fill the glow *before* the stroke
            // Clip is still active for the stroke

            // Outline
             // Pulsating alpha directly in the color string
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + 0.3 * pulseFast})`;
            ctx.lineWidth = 1.5 * pulseFast; // Pulsating width
            ctx.stroke(topPath); // Stroke the outline

            ctx.restore(); // Restore from the save (removes clip and resets style)

        } else if (highlightType.includes('_range')) {
            // RANGE TILES (Intermediate): Subtle static inner border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'; // Subtle dark static border
            ctx.lineWidth = 1.5; // Static width
            ctx.globalAlpha = 0.5; // Static alpha for border
            ctx.stroke(topPath); // Stroke directly on the fill
        }
        // Add more conditions here if other highlight types need specific borders
        // else { /* Default or no border for other types if needed */ }
        
        // --- End Conditional Border --- 

        ctx.restore(); // Restore context from highlight save
    }

    ctx.restore(); // Restore from translate
}

// Fonction pour dessiner la grille
export function drawGrid(
    ctx, mapGrid, currentGridCols, currentGridRows, 
    playerState, reachableTiles, attackableTiles, hoveredTile, 
    SPELLS, selectedSpellIndex, TILE_W, TILE_H, 
    hasLineOfSight, // Assumes this function now gets mapGrid from game.js or elsewhere
    player, 
    drawTileFn, tileImage, tileImageLoaded, 
    entitiesToDraw, // Renamed from entities
    // NEW: Receive enemy hover state
    enemyHoveredReachableTiles,
    hoveredEnemyId 
) {
    // --- Determine the primary hover target tile --- 
    let primaryHoverX = -1;
    let primaryHoverY = -1;
    const hoveredEnemy = entitiesToDraw.find(item => item.entity?.id === hoveredEnemyId)?.entity;
    if (hoveredEnemy) {
        primaryHoverX = hoveredEnemy.gridX;
        primaryHoverY = hoveredEnemy.gridY;
    } else if (hoveredTile) {
        primaryHoverX = hoveredTile.x;
        primaryHoverY = hoveredTile.y;
    }
    // --------------------------------------------

    // --- Animation Timing --- 
    const now = performance.now();
    const pulseSlow = 0.85 + 0.15 * Math.sin(now / 350); // Slower pulse for general range
    const pulseFast = 0.8 + 0.2 * Math.sin(now / 150); // Faster pulse for hover/target

    // 1. Dessiner toutes les tuiles de sol et highlights (UNIQUEMENT TYPE 0)
    for (let y = 0; y < currentGridRows; y++) { // Use current dimensions
        for (let x = 0; x < currentGridCols; x++) { // Use current dimensions
            const tileType = mapGrid[y]?.[x] ?? 0;
            if (tileType === 1) continue; // SKIP OBSTACLES IN THIS LOOP
            
            let highlight = null;
            let highlightType = 'none'; // To track highlight type for effects

            // Player move/aim highlights
            if (playerState === 'idle' && reachableTiles.some(t => t.x === x && t.y === y && t.cost <= player.mp)) {
                // Base highlight for reachable tiles
                highlight = `rgba(46, 204, 113, ${0.15 + 0.15 * pulseSlow})`; // Pulsating alpha
                highlightType = 'move_range';
            } else if (playerState === 'aiming' && attackableTiles.some(t => t.x === x && t.y === y)) {
                // Base highlight for attackable tiles (can also pulse if desired)
                highlight = `rgba(52, 152, 219, ${0.15 + 0.15 * pulseSlow})`; // Pulsating blue alpha
                highlightType = 'attack_range';
            }
            
            // Enemy hover range highlight (can override player highlights)
            if (playerState !== 'aiming' && enemyHoveredReachableTiles.some(t => t.x === x && t.y === y)) {
                highlight = `rgba(230, 126, 34, ${0.35 + 0.15 * pulseSlow})`; // Pulsating orange alpha
                highlightType = 'enemy_range';
            }
            
            // Darker highlight for the specific hovered enemy tile (overrides enemy range)
            if (hoveredEnemy && hoveredEnemy.gridX === x && hoveredEnemy.gridY === y) {
                highlight = `rgba(211, 84, 0, ${0.5 + 0.15 * pulseFast})`; // Stronger pulsating orange
                highlightType = 'enemy_hover';
            }
            
            // Bright highlight for the primary action target tile (move/aim/hover)
            // This overrides previous highlights for the specific hovered tile
            if (primaryHoverX === x && primaryHoverY === y) { 
                if (playerState === 'idle' && reachableTiles.some(t => t.x === x && t.y === y && t.cost <= player.mp)) {
                    // Use the faster pulse for the specific move target
                    highlight = `rgba(39, 174, 96, ${0.6 + 0.2 * pulseFast})`; 
                    highlightType = 'move_hover';
                } else if (playerState === 'aiming' && attackableTiles.some(t => t.x === x && t.y === y)) {
                    // Use the faster pulse for the specific aim target
                    highlight = `rgba(41, 128, 185, ${0.6 + 0.2 * pulseFast})`;
                    highlightType = 'aim_hover';
                } else if (!hoveredEnemy && highlightType !== 'enemy_range') { // Apply default white hover only if no other highlight type applies (except basic enemy range)
                    highlight = `rgba(255, 255, 255, ${0.4 + 0.15 * pulseFast})`;
                    highlightType = 'default_hover';
                }
            }
            
            // Draw the tile, passing the determined highlight color/alpha
            drawTileFn(
                ctx, x, y,
                tileType, 
                highlight, // Pass the pulsating RGBA string
                highlightType, // Pass the type string
                tileImage, tileImageLoaded,
                mapGrid, TILE_W, TILE_H, 
                currentGridCols, currentGridRows
                // Note: The drawTile function itself was already updated to handle RGBA highlights
            );
        }
    }

    // --- Draw Entity Shadows (AFTER base tiles, BEFORE previews/entities) ---
    ctx.save();
    // Shadow color is now part of the gradient
    entitiesToDraw.forEach(item => {
        const entity = item.entity;
        if (!entity || entity.hp <= 0 || entity._isDying) return; // Only draw for living, non-dying entities

        // Use current screen coords if available, otherwise calculate
        const screenX = entity.screenX ?? isoToScreen(entity.gridX, entity.gridY).x;
        const screenY = entity.screenY ?? isoToScreen(entity.gridX, entity.gridY).y;

        // Draw shadow ellipse centered at entity base
        const shadowRadiusX = TILE_W * 0.35;
        const shadowRadiusY = TILE_H * 0.20;
        const shadowYOffset = TILE_H * 0.15; // Offset shadow slightly down from entity center
        const shadowDrawY = screenY + shadowYOffset;

        // Create radial gradient for soft shadow
        const shadowGradient = ctx.createRadialGradient(
            screenX, shadowDrawY, 0, // Inner circle center
            screenX, shadowDrawY, Math.max(shadowRadiusX, shadowRadiusY) // Outer circle radius
        );
        shadowGradient.addColorStop(0, 'rgba(44, 62, 80, 0.35)'); // Center shadow color & alpha
        shadowGradient.addColorStop(0.8, 'rgba(44, 62, 80, 0.1)'); // Mid fade
        shadowGradient.addColorStop(1, 'rgba(44, 62, 80, 0)');    // Transparent edge

        ctx.fillStyle = shadowGradient;
        ctx.beginPath();
        // Draw ellipse slightly larger to account for gradient fade
        ctx.ellipse(screenX, shadowDrawY, shadowRadiusX * 1.2, shadowRadiusY * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
    // --- End Entity Shadows ---

    // --- Draw Spell Preview Overlays (AoE / Push) --- 
    if (playerState === 'aiming') {
        const spell = SPELLS[selectedSpellIndex];
        // Determine the center for the preview - ALWAYS use hoveredTile now
        let previewCenterX = -1, previewCenterY = -1;
        if (hoveredTile) { // Base preview on hovered tile only
            previewCenterX = hoveredTile.x;
            previewCenterY = hoveredTile.y;
        }

        // Only draw previews if we have a valid center tile
        if (previewCenterX !== -1) {
            // Define pulse effect here, usable by both push and aoe previews
            const now = performance.now(); 
            const pulseSubtle = 0.85 + 0.15 * Math.sin(now / 250); 

            // Draw Push Preview
            if (spell && spell.push) {
                // Use previewCenterX, previewCenterY derived from hoveredTile
                let x = previewCenterX;
                let y = previewCenterY;
                let dx = x - player.gridX; // Direction from player to target
                let dy = y - player.gridY;

                // --- Align direction logic with applyPush --- 
                if (dx === 0 && dy === 0) dx = 1; // Avoid zero vector, push right (same as applyPush)
                // Determine primary axis, prioritizing vertical on tie (same as applyPush)
                if (!(dx === 0 && dy === 0)) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        dx = Math.sign(dx); dy = 0;
                    } else { // Prioritize vertical (dy) or use dy if dx is 0
                        dy = Math.sign(dy); dx = 0;
                    }
                    // Start highlighting *one step* away from the target
                    let pushX = x + dx;
                    let pushY = y + dy;
                    // Use the push distance from the spell definition
                    const pushDistance = spell.push || 0; 
                    for (let step = 0; step < pushDistance; step++) {
                        if (
                            pushX < 0 || pushX >= currentGridCols ||
                            pushY < 0 || pushY >= currentGridRows ||
                            mapGrid[pushY]?.[pushX] === 1
                        ) break;
                        ctx.save();
                        const pos = isoToScreen(pushX, pushY);
                        ctx.translate(Math.round(pos.x), Math.round(pos.y));
                        ctx.beginPath();
                        ctx.moveTo(0, -TILE_H / 2);
                        ctx.lineTo(TILE_W / 2, 0);
                        ctx.lineTo(0, TILE_H / 2);
                        ctx.lineTo(-TILE_W / 2, 0);
                        ctx.closePath();
                        // Apply pulsing alpha to fillStyle
                        ctx.fillStyle = `rgba(0, 184, 148, ${0.55 * pulseSubtle})`; 
                        ctx.fill();
                        ctx.restore();
                        pushX += dx; pushY += dy;
                    }
                }
            } else if (spell && spell.aoe) {
                // Use previewCenterX, previewCenterY derived from hoveredTile
                const x = previewCenterX;
                const y = previewCenterY;
                const aoeTiles = [
                    {x: x, y: y},
                    {x: x + 1, y: y},
                    {x: x - 1, y: y},
                    {x: x, y: y + 1},
                    {x: x, y: y - 1}
                ];
                for (const tile of aoeTiles) {
                    if (tile.x >= 0 && tile.x < currentGridCols && tile.y >= 0 && tile.y < currentGridRows) {
                        ctx.save();
                        const pos = isoToScreen(tile.x, tile.y);
                        ctx.translate(Math.round(pos.x), Math.round(pos.y));
                        ctx.beginPath();
                        ctx.moveTo(0, -TILE_H / 2);
                        ctx.lineTo(TILE_W / 2, 0);
                        ctx.lineTo(0, TILE_H / 2);
                        ctx.lineTo(-TILE_W / 2, 0);
                        ctx.closePath();
                        // Apply pulsing alpha to fillStyle
                        ctx.fillStyle = `rgba(230, 126, 34, ${0.65 * pulseSubtle})`; 
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }
        }
    }

    // 2. Collect drawables (obstacles and entities) for Z-sorting
    let drawables = [];
    // Obstacles
    for (let y = 0; y < currentGridRows; y++) { // Use current dimensions
        for (let x = 0; x < currentGridCols; x++) { // Use current dimensions
            if (mapGrid[y]?.[x] === 1) {
                const pos = isoToScreen(x, y);
                // Drawable for obstacle: Draw BASE first, then visual
                drawables.push({
                    type: 'obstacle',
                    x, y,
                    screenY: pos.y, // Sort based on base position
                    draw: () => {
                         // Call drawTile normally for obstacles, passing the base tile image
                         drawTileFn(
                             ctx, x, y, 
                             1, // type = obstacle
                             null, // highlightColor
                             'none', // highlightType
                             tileImage, // Pass the base tile image (sol.png)
                             tileImageLoaded, // Pass its loaded status
                             mapGrid, TILE_W, TILE_H, 
                             currentGridCols, currentGridRows,
                             false // drawOnlyObstacleVisual = false (allow base draw)
                         );
                    }
                });
            }
        }
    }
    // Entities
    for (const item of entitiesToDraw) { // Use passed list
         if (!item.entity) continue;
        // Use entity's current screenY if available (for animations), else calculate
        const screenY = (typeof item.entity.screenY === 'number') 
                        ? item.entity.screenY 
                        : isoToScreen(item.entity.gridX, item.entity.gridY).y;

        // Capture hoveredEnemyId in the closure for this entity
        const isHovered = item.entity.id === hoveredEnemyId;

        drawables.push({
            type: 'entity',
            screenY: screenY + TILE_H / 4, // Adjust sort Y slightly downwards
            draw: () => drawEntity( // Call drawEntity with necessary info
                ctx, item.entity, 
                item.image, item.loaded, 
                TILE_W, TILE_H, item.currentTurn, 
                isHovered // Pass hover status
            )
            });
        }

    // 3. Sort drawables by screenY 
    drawables.sort((a, b) => a.screenY - b.screenY);
    
    // 4. Execute draw functions in sorted order
    for (const d of drawables) {
         try { d.draw(); } catch(e) { console.error("Error drawing drawable:", d, e); }
    }
}

// Fonction pour dessiner une entité (joueur ou ennemi)
export function drawEntity(ctx, entity, entityImage, imageLoaded, TILE_W, TILE_H, currentTurn, isHovered) {
    if (!entity) return; // Safety check

    const now = performance.now();
    const alpha = entity.hp <= 0 ? 0.5 : 1; // Base alpha for health

    // --- Determine Screen Position --- 
    // PRIORITIZE entity.screenX/Y if they exist (updated by animation)
    let screenX, screenY;
    if (typeof entity.screenX === 'number' && typeof entity.screenY === 'number') {
        screenX = entity.screenX;
        screenY = entity.screenY;
        // console.log(`[DRAW DEBUG] Using entity.screenX/Y: ${screenX.toFixed(1)}, ${screenY.toFixed(1)}`);
    } else {
        // Fallback: Calculate from grid position if screen coords aren't set
        const pos = isoToScreen(entity.gridX, entity.gridY); 
        screenX = pos.x;
        screenY = pos.y;
        // Optionally update the entity's screen coords here if they were missing
        // entity.screenX = screenX;
        // entity.screenY = screenY;
        // console.log(`[DRAW DEBUG] Fallback to grid calc screenX/Y: ${screenX.toFixed(1)}, ${screenY.toFixed(1)}`);
    }
    // ------------------------------- 

    ctx.save(); // Save context state

    // --- Determine Final Alpha and Scale (prioritize death anim) ---
    let finalAlpha = alpha; // Start with base alpha
    let finalScale = 1.0; // Start with base scale

    if (entity._isDying && typeof entity._deathAlpha === 'number') {
        finalAlpha = entity._deathAlpha; // Override alpha if dying
        finalScale = entity._deathScale ?? finalScale; // Override scale if dying (use ?? for safety)
        console.log(`[DRAW DEATH] Entity ${entity.id} Applying death anim: Alpha=${finalAlpha.toFixed(2)}, Scale=${finalScale.toFixed(2)}`);
    } else if (entity.isCasting) { // Apply casting anim only if *not* dying
        const elapsed = now - (entity.castStartTime || 0);
        const duration = entity.castingDuration || 300;

        if (elapsed < duration) {
            const t = elapsed / duration;
            finalScale = 1.0 + 0.15 * Math.sin(t * Math.PI); // Override scale for casting
        } else {
            entity.isCasting = false; // Reset flag here too, although draw loop might reset it first
        }
    }
    // -----------------------------------------------------------

    // Apply base alpha (health state) + any casting boost
    ctx.globalAlpha = finalAlpha;

    // Outline if it's the current turn (only if alive)
    if (entity.id === currentTurn && entity.hp > 0) {
        ctx.shadowColor = 'yellow';
        ctx.shadowBlur = 15; // Slightly smaller blur
    }

    // Apply scale transform centered on the entity BASE
    // Use the determined screenX/screenY for transforms
    const centerX = screenX; 
    const centerY = screenY + TILE_H / 2; 
    ctx.translate(centerX, centerY);
    ctx.scale(finalScale, finalScale); // Use finalScale
    ctx.translate(-centerX, -centerY);

    // Draw entity image or fallback
    if (imageLoaded && entityImage) {
        const sizeRatio = (entity.size || 28) / 28;
        // Make width consistent, use aspect ratio for height
        const imgWidth = TILE_W * 0.9 * sizeRatio; 
        const aspectRatio = entityImage.naturalHeight / entityImage.naturalWidth; // Use natural dimensions for aspect ratio
        const imgHeight = imgWidth * aspectRatio;
        
        // Use the determined screenX/screenY for drawing
        const drawX = screenX - imgWidth / 2; 
        const drawY = screenY - imgHeight + TILE_H / 4; 

        // Draw BASE entity image first
        ctx.drawImage(entityImage, drawX, drawY, imgWidth, imgHeight);

        // --- Draw Equipped Head Item (if player) ---
        if (entity.id === 'player') {
            const headItemId = inventoryManager.getEquippedItem('head');
            if (headItemId && allItems[headItemId]) {
                const headItemData = allItems[headItemId];
                const headItemImageSrc = headItemData.img;
                if (headItemImageSrc) {
                    const cachedHeadItem = loadImage(headItemImageSrc); // Use cache
                    if (cachedHeadItem.loaded) {
                         // Draw head item slightly above the base image draw position
                         // Adjustments might be needed based on player sprite and head item sprite alignment
                         const headDrawWidth = imgWidth * 0.4; // Smaller size for headgear relative to body
                         const headAspectRatio = cachedHeadItem.img.naturalHeight / cachedHeadItem.img.naturalWidth;
                         const headDrawHeight = headDrawWidth * headAspectRatio;
                         const headDrawX = drawX + (imgWidth - headDrawWidth) / 2; // Center headgear horizontally
                         const headDrawY = drawY + headDrawHeight / 2; // Position slightly overlapping top of base sprite head

                         ctx.drawImage(cachedHeadItem.img, headDrawX, headDrawY, headDrawWidth, headDrawHeight);
                    } else {
                         // Image not loaded yet, maybe log or draw a placeholder?
                         console.warn(`Head item image not loaded yet: ${headItemImageSrc}`);
                    }
                }
            }
            // Add checks for other slots (body, weapon, etc.) here if needed
        }
        // --- End Draw Equipped Head Item ---

    } else {
        // Fallback circle drawing (centered on screenX, screenY)
        ctx.fillStyle = entity.color || 'grey';
        ctx.beginPath();
        ctx.arc(screenX, screenY - TILE_H / 4, TILE_W * 0.3 * finalScale, 0, Math.PI * 2); 
        ctx.fill();
    }

    // Restore shadow settings if applied
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // --- Draw HP/AP/MP Display (if hovered and alive) ---
    if (isHovered && entity.hp > 0 && typeof entity.maxHp === 'number' && finalAlpha === 1) {
        // Build the text string
        let statsText = `HP: ${entity.hp}/${entity.maxHp}`;
        if (typeof entity.ap === 'number' && typeof entity.maxAp === 'number') {
            statsText += `  ⚡ ${entity.ap}/${entity.maxAp}`;
        }
        if (typeof entity.mp === 'number' && typeof entity.maxMp === 'number') {
            statsText += `  🏃 ${entity.mp}/${entity.maxMp}`;
        }

        const baseFontSize = Math.max(9, TILE_W * 0.18); // Slightly smaller font
        ctx.font = `bold ${baseFontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const textMetrics = ctx.measureText(statsText);
        const textWidth = textMetrics.width;
        const textHeight = baseFontSize;
        const padding = 3;

        // Determine the top of the entity visual (more robustly)
        let entityTopY = screenY - TILE_H / 4; // Fallback top (center of circle)
        if (imageLoaded && entityImage) {
            const sizeRatio = (entity.size || 28) / 28;
            const imgWidth = TILE_W * 0.9 * sizeRatio; 
            const aspectRatio = entityImage.naturalHeight / entityImage.naturalWidth;
            const imgHeight = imgWidth * aspectRatio;
            entityTopY = screenY - imgHeight + TILE_H / 4; // Top of the drawn image
        }

        const hpTextY = entityTopY - 5; // Gap above entity visual
        const hpTextX = screenX; // Center text horizontally

        // Draw background rectangle
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(
            hpTextX - textWidth / 2 - padding,
            hpTextY - textHeight - padding,
            textWidth + padding * 2,
            textHeight + padding * 2
        );

        // Determine text color
        const hpRatio = entity.hp / entity.maxHp;
        let textColor = '#FFFFFF';
        if (hpRatio < 0.6) textColor = '#f1c40f';
        if (hpRatio < 0.3) textColor = '#e74c3c';

        // Draw Text
        ctx.fillStyle = textColor;
        ctx.fillText(statsText, hpTextX, hpTextY);
    }
    // --- END HP/AP/MP DISPLAY ---

    ctx.restore(); // Restore original context state
}

// Fonction pour dessiner les projectiles
export function drawProjectiles(ctx, projectiles, SPELLS) {
    projectiles.forEach(p => {
        ctx.save();
        const now = performance.now(); // Get time for animations

        if (p.owner === 'player') {
            let spellColor = '#f1c40f'; // Default Yellow for Spell 0
            let spellIndex = p.spellIndex ?? 0; // Default to 0 if undefined
            if (typeof spellIndex === 'number' && SPELLS && SPELLS[spellIndex]) {
                spellColor = SPELLS[spellIndex].color;
            }

            // --- Player Spell 0 (Mono-cible - Yellow) ---
            if (spellIndex === 0) {
                const baseRadius = 10;
                const pulseFactor = 0.15 * Math.sin(now / 150); // Gentle pulse
                const rotationSpeed = now / 180;
                const starPoints = 5; // Pentagram shape

                ctx.save();
                ctx.translate(p.x, p.y);

                // Trail (particle-like sparks)
                ctx.globalAlpha = 0.5;
                for (let t = 1; t <= 8; t++) {
                    const trailAlpha = 0.4 * (1 - t / 9);
                    if (trailAlpha <= 0) continue;
                    ctx.globalAlpha = trailAlpha;
                    const trailX = -p.dx * t * 2; // Spaced further back
                    const trailY = -p.dy * t * 2;
                    const sparkSize = Math.max(1, 4 - t * 0.5);
                    ctx.fillStyle = `rgba(255, 223, 100, ${trailAlpha * 0.8})`; // Yellowish-white sparks
                    ctx.beginPath();
                    ctx.arc(trailX + (Math.random() - 0.5) * 8, trailY + (Math.random() - 0.5) * 8, sparkSize, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore(); // Restore from trail drawing translation

                // Main Projectile (Star)
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(rotationSpeed);
                ctx.globalAlpha = 0.95;

                // Outer Glow
                ctx.beginPath();
                ctx.arc(0, 0, baseRadius * (1.6 + pulseFactor * 0.8), 0, Math.PI * 2);
                const gradGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius * (1.6 + pulseFactor * 0.8));
                gradGlow.addColorStop(0, `rgba(255, 235, 150, 0.5)`); // Brighter center
                gradGlow.addColorStop(1, `rgba(255, 200, 50, 0)`); // Fade out
                ctx.fillStyle = gradGlow;
                ctx.fill();

                // Star Shape
                ctx.beginPath();
                for (let i = 0; i < starPoints * 2; i++) {
                    const angle = Math.PI / starPoints * i - Math.PI / 2; // Start pointing up
                    const radius = i % 2 === 0 ? baseRadius * (1.1 + pulseFactor) : baseRadius * 0.5 * (1.1 + pulseFactor);
                    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
                }
                ctx.closePath();

                ctx.shadowColor = spellColor;
                ctx.shadowBlur = 15;
                ctx.fillStyle = '#fff'; // Bright white core
                ctx.fill();
                ctx.strokeStyle = spellColor; // Yellow outline
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.restore(); // Restore from main projectile drawing

            // --- Player Spell 1 (Zone croix - Orange) ---
            } else if (spellIndex === 1) {
                const baseRadius = 11;
                const pulse = 0.8 + 0.2 * Math.sin(now / 100); // Faster, stronger pulse
                const rotation = now / 500; // Slow rotation

                ctx.save();
                ctx.translate(p.x, p.y);

                // Trail (Wispy, expanding)
                ctx.globalAlpha = 0.4;
                 for (let t = 1; t <= 6; t++) {
                    const trailAlpha = 0.3 * (1 - t / 7);
                    if (trailAlpha <= 0) continue;
                    ctx.globalAlpha = trailAlpha;
                    const trailX = -p.dx * t * 2.5;
                    const trailY = -p.dy * t * 2.5;
                    const trailRadius = Math.max(1, (8 - t * 0.8) * pulse); // Expanding trail
                    ctx.fillStyle = `rgba(255, 165, 80, ${trailAlpha * 0.7})`; // Orange-ish trail
                    ctx.beginPath();
                    ctx.arc(trailX, trailY, trailRadius, 0, Math.PI * 2);
                    ctx.fill();
                 }
                 ctx.restore(); // Restore from trail drawing

                 // Main Projectile (Orb + Crackling Energy)
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(rotation);
                ctx.globalAlpha = 0.9;

                // Outer Energy Field
                ctx.beginPath();
                ctx.arc(0, 0, baseRadius * 1.8 * pulse, 0, Math.PI * 2);
                const gradGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius * 1.8 * pulse);
                gradGlow.addColorStop(0, `rgba(255, 180, 100, 0.4)`);
                gradGlow.addColorStop(1, `rgba(230, 126, 34, 0)`);
                ctx.fillStyle = gradGlow;
                ctx.fill();

                 // Central Orb
                ctx.beginPath();
                ctx.arc(0, 0, baseRadius * pulse, 0, Math.PI * 2);
                ctx.fillStyle = spellColor; // Solid orange core
                ctx.shadowColor = spellColor;
                ctx.shadowBlur = 20;
                ctx.fill();

                // Crackling Energy Lines (randomized)
                ctx.globalAlpha = 0.6 * pulse;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                const numLines = 5;
                for (let i = 0; i < numLines; i++) {
                    ctx.save();
                    ctx.rotate(Math.random() * Math.PI * 2); // Random angle
                    ctx.beginPath();
                    ctx.moveTo(baseRadius * 0.8 * pulse, 0); // Start near core edge
                    // Jagged line outwards
                    const endRadius = baseRadius * (1.5 + Math.random() * 0.5) * pulse;
                    ctx.lineTo(endRadius * 0.4, (Math.random() - 0.5) * 8);
                    ctx.lineTo(endRadius, 0);
                    ctx.stroke();
                    ctx.restore();
                }

                ctx.restore(); // Restore from main projectile drawing

            // --- Player Spell 2 (Poussée - Green) ---
            } else if (spellIndex === 2) {
                const arrowLength = 35;
                const arrowWidth = 14;
                const angle = Math.atan2(p.dy, p.dx);
                const speedFactor = Math.min(1, (now % 200) / 100); // Faster effect cycle for speed lines

                // Trail (Turbulent Wake)
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(angle);
                ctx.globalAlpha = 0.4;
                for (let t = 1; t <= 7; t++) {
                    const trailAlpha = 0.35 * (1 - t / 8);
                    if (trailAlpha <= 0) continue;
                    ctx.globalAlpha = trailAlpha;
                    const trailX = -arrowLength * 0.8 - t * 4; // Start behind arrow
                    const trailY = (Math.random() - 0.5) * (arrowWidth * 0.8 + t); // Widening wake
                    const trailSize = Math.max(1, 5 - t * 0.6);
                    ctx.fillStyle = `rgba(80, 255, 180, ${trailAlpha * 0.6})`; // Lighter green wake
                    ctx.beginPath();
                    ctx.arc(trailX, trailY, trailSize, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore(); // Restore from trail drawing

                // Main Arrow
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(angle);
                ctx.globalAlpha = 0.95;

                // Leading "Shockwave" / Distortion (subtle)
                ctx.globalAlpha = 0.2 + 0.3 * speedFactor;
                ctx.fillStyle = `rgba(180, 255, 220, ${0.2 * speedFactor})`;
                ctx.beginPath();
                ctx.arc(arrowLength * 0.3, 0, arrowWidth * 1.2, -Math.PI/2.5, Math.PI/2.5); // Arc in front
                ctx.fill();

                // Arrow Shape (more dynamic)
                ctx.beginPath();
                ctx.moveTo(arrowLength * 0.4, 0); // Point slightly behind actual tip for effect
                ctx.lineTo(0, arrowWidth / 2); // Back corner
                ctx.lineTo(-arrowLength * 0.2, arrowWidth * 0.3); // Indent
                ctx.lineTo(-arrowLength * 0.1, 0); // Center back
                ctx.lineTo(-arrowLength * 0.2, -arrowWidth * 0.3); // Indent other side
                ctx.lineTo(0, -arrowWidth / 2); // Other back corner
                ctx.closePath();

                const gradArrow = ctx.createLinearGradient(-arrowLength * 0.2, 0, arrowLength * 0.4, 0);
                gradArrow.addColorStop(0, spellColor); // Darker green base
                gradArrow.addColorStop(1, '#aaffdd'); // Lighter green tip
                ctx.fillStyle = gradArrow;
                ctx.shadowColor = '#50ffaa';
                ctx.shadowBlur = 18;
                ctx.fill();
                ctx.strokeStyle = '#fff'; // White outline for contrast
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.restore(); // Restore from main projectile

            }
        // --- Boss Projectile (Red Fireball) ---
        } else if (p.owner === 'boss') {
            const baseRadius = 12;
            const flicker = 0.9 + 0.2 * Math.random(); // Random flicker
            const pulse = 0.95 + 0.1 * Math.sin(now / 80); // Slight pulse

            // Trail (Embers)
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.globalAlpha = 0.7;
            for (let t = 1; t <= 10; t++) {
                const trailAlpha = 0.5 * (1 - t / 11);
                if (trailAlpha <= 0) continue;
                ctx.globalAlpha = trailAlpha * flicker;
                const trailX = -p.dx * t * 1.5; // Closer trail
                const trailY = -p.dy * t * 1.5;
                const emberSize = Math.max(1, 5 - t * 0.4);
                ctx.fillStyle = `rgba(255, ${Math.floor(100 + Math.random() * 50)}, 0, ${trailAlpha})`; // Orange/Red Embers
                ctx.beginPath();
                ctx.arc(trailX + (Math.random() - 0.5) * 10, trailY + (Math.random() - 0.5) * 10, emberSize, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // Main Fireball
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.globalAlpha = 0.9 * flicker; // Apply flicker to main ball too

            // Heat Haze (subtle outer ring)
             ctx.globalAlpha = 0.15 * flicker;
             ctx.beginPath();
             ctx.arc(0, 0, baseRadius * 2.2 * pulse, 0, Math.PI * 2);
             ctx.fillStyle = `rgba(255, 100, 50, 0.2)`; // Faint orange haze
             ctx.fill();

            // Fireball Core
            ctx.beginPath();
            ctx.arc(0, 0, baseRadius * pulse * flicker, 0, Math.PI * 2);
            const gradFire = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius * pulse * flicker);
            gradFire.addColorStop(0, '#ffffff'); // White hot center
            gradFire.addColorStop(0.3, '#ffdd00'); // Yellow
            gradFire.addColorStop(0.8, '#ff6600'); // Orange
            gradFire.addColorStop(1, p.color || '#e74c3c'); // Outer red (use projectile color if available)
            ctx.fillStyle = gradFire;
            ctx.shadowColor = p.color || '#e74c3c';
            ctx.shadowBlur = 25;
            ctx.fill();

            ctx.restore();

        // --- sheep Projectile (Brown - Mud Clod) ---
        } else if (p.owner === 'sheep') {
            const baseRadius = 9;
            const rotation = now / 200; // Slow rotation
            const splatFactor = Math.sin(now / 100) * 2; // For irregular shape

            // Trail (Dusty/Muddy)
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.globalAlpha = 0.5;
            for (let t = 1; t <= 6; t++) {
                const trailAlpha = 0.4 * (1 - t / 7);
                if (trailAlpha <= 0) continue;
                ctx.globalAlpha = trailAlpha;
                const trailX = -p.dx * t * 2;
                const trailY = -p.dy * t * 2;
                const dustSize = Math.max(1, 6 - t * 0.7);
                ctx.fillStyle = `rgba(160, 110, 75, ${trailAlpha * 0.7})`; // Dusty brown
                ctx.beginPath();
                ctx.arc(trailX + (Math.random() - 0.5) * 5, trailY + (Math.random() - 0.5) * 5, dustSize, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // Main Mud Clod (Irregular shape)
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(rotation);
            ctx.globalAlpha = 0.95;

            ctx.beginPath();
            const points = 7; // More irregular
            for(let i=0; i<points; ++i) {
                const angle = Math.PI * 2 / points * i;
                const radius = baseRadius * (0.8 + Math.random() * 0.4); // Random radius per point
                const xPoint = Math.cos(angle) * radius + (i % 2 === 0 ? splatFactor : -splatFactor); // Offset points for irregularity
                const yPoint = Math.sin(angle) * radius + (i % 2 !== 0 ? splatFactor : -splatFactor);
                if(i === 0) ctx.moveTo(xPoint, yPoint);
                else ctx.lineTo(xPoint, yPoint);
            }
            ctx.closePath();

            const mudColor = '#8B4513'; // SaddleBrown
            const darkerMud = '#65340B';
            ctx.fillStyle = mudColor;
            ctx.shadowColor = darkerMud;
            ctx.shadowBlur = 5;
            ctx.fill();
            ctx.strokeStyle = darkerMud; // Dark outline
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.restore();

        // --- sheepist Noir Projectile (Dark Orb) ---
        } else if (p.owner === 'sheepist_noir') {
            const baseRadius = 10;
            const pulse = 0.9 + 0.1 * Math.sin(now / 250); // Slow, heavy pulse
            const swirlAngle = now / 800; // Slow swirl

            // Trail (Thick, Dark, Swirling)
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.globalAlpha = 0.6;
             for (let t = 1; t <= 8; t++) {
                const trailAlpha = 0.5 * (1 - t / 9);
                if (trailAlpha <= 0) continue;
                ctx.globalAlpha = trailAlpha * pulse;
                const trailX = -p.dx * t * 1.8;
                const trailY = -p.dy * t * 1.8;
                const trailRadius = Math.max(2, 7 - t * 0.6);
                // Swirl effect
                const swirlOffsetX = Math.cos(swirlAngle + t * 0.5) * t * 0.8;
                const swirlOffsetY = Math.sin(swirlAngle + t * 0.5) * t * 0.8;

                ctx.fillStyle = `rgba(60, 70, 90, ${trailAlpha * 0.8})`; // Dark blue-gray trail
                ctx.beginPath();
                ctx.arc(trailX + swirlOffsetX, trailY + swirlOffsetY, trailRadius, 0, Math.PI * 2);
                ctx.fill();
             }
             ctx.restore(); // Restore from trail drawing

            // Main Dark Orb
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.globalAlpha = 0.95;

            // Dark Outer Aura
            ctx.beginPath();
            ctx.arc(0, 0, baseRadius * 1.7 * pulse, 0, Math.PI * 2);
            const gradAura = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius * 1.7 * pulse);
            gradAura.addColorStop(0, `rgba(80, 90, 110, 0.3)`);
            gradAura.addColorStop(1, `rgba(44, 62, 80, 0)`);
            ctx.fillStyle = gradAura;
            ctx.fill();

            // Core Orb
            ctx.beginPath();
            ctx.arc(0, 0, baseRadius * pulse, 0, Math.PI * 2);
            const gradCore = ctx.createRadialGradient(0, 0, baseRadius * 0.2 * pulse, 0, 0, baseRadius * pulse);
            gradCore.addColorStop(0, '#566573'); // Lighter gray-blue center
            gradCore.addColorStop(1, '#2c3e50'); // Dark grayish blue edge
            ctx.fillStyle = gradCore;
            ctx.shadowColor = '#1a2530'; // Very dark shadow
            ctx.shadowBlur = 18;
            ctx.fill();
            // Subtle inner swirl lines
            ctx.globalAlpha = 0.2 * pulse;
            ctx.strokeStyle = '#778899'; // LightSlateGray
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -baseRadius * 0.6);
            ctx.bezierCurveTo(baseRadius * 0.5, -baseRadius * 0.3, baseRadius * 0.3, baseRadius * 0.5, 0, baseRadius * 0.7);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, baseRadius * 0.6);
            ctx.bezierCurveTo(-baseRadius * 0.5, baseRadius * 0.3, -baseRadius * 0.3, -baseRadius * 0.5, 0, -baseRadius * 0.7);
            ctx.stroke();

            ctx.restore(); // Restore from main orb
        }
        ctx.restore(); // Restore the state saved at the beginning of this projectile's drawing logic
    });
}

// Fonction pour dessiner les animations de dégâts
export function drawDamageAnimations(ctx, damageAnimations, TILE_W) { // Added TILE_W parameter
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Use game font, make size relative to TILE_W
    const fontSize = Math.round(TILE_W * 0.375); // 80 * 0.375 = 30px
    ctx.font = `bold ${fontSize}px "Press Start 2P", cursive`; 

    const TILE_H = TILE_W / 2; // Define TILE_H based on TILE_W for consistency

    const now = performance.now(); // Get current time if needed for independent calcs

    for (let i = damageAnimations.length - 1; i >= 0; i--) {
        const anim = damageAnimations[i];
        // Ensure time and duration are valid numbers
        const duration = anim.duration || 900;
        const time = anim.time || 0;
        const progress = Math.min(time / duration, 1); 

        if (progress >= 1) {
            // This check might be redundant if gameTick handles removal, but safe to keep
             // damageAnimations.splice(i, 1); // Let gameTick handle removal
            continue;
        }

        // Calculate vertical offset (float upwards)
        const floatDistance = 60; // Increased float distance
        const yOffset = -floatDistance * progress;

        // Calculate alpha (fade out)
        const fadeStartProgress = 0.4; // Start fading a bit earlier
        let alpha = 1.0;
        if (progress > fadeStartProgress) {
            alpha = 1.0 - (progress - fadeStartProgress) / (1.0 - fadeStartProgress);
        }
        alpha = Math.max(0, alpha); // Ensure alpha doesn't go below 0

        // Convert grid coordinates to screen coordinates
        // Ensure isoToScreen is correctly imported and working
        const screenPos = isoToScreen(anim.x, anim.y);
        if (!screenPos) { // Add safety check
             console.warn("[Draw Dmg] Could not get screenPos for animation at", anim.x, anim.y);
             continue;
        }

        // Apply animation effects
        ctx.globalAlpha = alpha;
        ctx.fillStyle = anim.color || '#ff0000'; // Use animation color or default red
        // Add stroke for visibility
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'; // Darker stroke
        ctx.lineWidth = 4; // Thicker stroke

        const drawX = screenPos.x;
        // Adjust starting point slightly higher above the tile center
        const drawY = screenPos.y - (TILE_H * 0.6) + yOffset; 

        // Draw text
        // Prepend '-' to the damage value
        const damageText = `-${anim.value}`;
        ctx.strokeText(damageText, drawX, drawY); // Draw stroke first
        ctx.fillText(damageText, drawX, drawY);   // Then fill

    }
    ctx.restore();
}

export function drawBackground(ctx, canvas) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    // Adjusted gradient colors for a slightly different mood
    grad.addColorStop(0, '#87CEEB'); // Lighter Sky Blue top
    grad.addColorStop(0.6, '#B0E0E6'); // Powder Blue middle
    grad.addColorStop(1, '#ADD8E6'); // Light Blue bottom
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Draw end game overlay (like legacy drawEndGame)
export function drawEndGameOverlay(ctx, canvas, gameOver, player) {
    if (gameOver) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = player.hp > 0 ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.font = '32px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#222';
        ctx.shadowBlur = 12;
        ctx.fillText(player.hp > 0 ? 'VICTOIRE !' : 'GAME OVER', canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }
}

// Utility: sort and draw entities by Y (for correct isometric overlap)
// Note: This function seems unused currently as drawGrid handles Z-sorting
export function drawEntitiesSorted(ctx, entities, drawEntityFn) {
    entities.sort((a, b) => (a.entity.screenY || 0) - (b.entity.screenY || 0));
    entities.forEach(item => drawEntityFn(ctx, item.entity, item.color, ...item.args));
}

// NEW Function: Draw Buff Animations
export function drawBuffAnimations(ctx, animations) {
    if (!animations || animations.length === 0) return;

    ctx.save();
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 2;

    animations.forEach(anim => {
        const elapsed = anim.time ?? 0;
        const duration = anim.duration;
        const progress = Math.min(1, elapsed / duration);

        // Fade out over the duration
        anim.alpha = 1 - progress; 
        // Move upwards
        const moveDistance = 40; // Pixels to move up
        anim.y = anim.startY - (moveDistance * progress); 

        ctx.globalAlpha = anim.alpha;
        ctx.fillStyle = anim.color;
        ctx.fillText(anim.text, anim.x, anim.y);
    });

    ctx.restore();
}