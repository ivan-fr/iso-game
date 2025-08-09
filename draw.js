// draw.js
import { isoToScreen } from './grid.js'; // Import isoToScreen
import inventoryManager, { allItems } from './inventory.js'; // Import inventoryManager and allItems

// --- Projectile Helper Functions ---

/**
 * Draws a particle trail behind a moving object
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Current x position
 * @param {number} y - Current y position
 * @param {number} dx - x velocity
 * @param {number} dy - y velocity
 * @param {Object} options - Configuration options
 */
function drawParticleTrail(ctx, x, y, dx, dy, {
  count = 6,          // Number of particles
  sizeBase = 3,       // Base size of particles
  sizeDecay = 0.5,    // How quickly particles shrink
  alphaBase = 0.4,    // Base alpha
  alphaDecay = 0.1,   // How quickly particles fade
  distance = 2,       // Distance between particles
  color = '#ffffff',  // Particle color
  jitter = 4,         // Random position jitter
  speedFactor = 1     // Adjusts trail length
} = {}) {
  ctx.save();
  ctx.translate(x, y);
  
  for (let i = 1; i <= count; i++) {
    const alpha = alphaBase * (1 - i / (count + 1));
    if (alpha <= 0) continue;
    
    ctx.globalAlpha = alpha;
    const particleX = -dx * i * distance * speedFactor;
    const particleY = -dy * i * distance * speedFactor;
    const size = Math.max(0.5, sizeBase - i * sizeDecay);
    
    // Add some randomness to position
    const jitterX = (Math.random() - 0.5) * jitter * (i / count);
    const jitterY = (Math.random() - 0.5) * jitter * (i / count);
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(particleX + jitterX, particleY + jitterY, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Draws a glow effect around a point
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Center x position
 * @param {number} y - Center y position
 * @param {number} radius - Base radius of the glow
 * @param {string} color - Base color of the glow
 * @param {Object} options - Configuration options
 */
function drawGlowEffect(ctx, x, y, radius, color, {
  pulse = 0,          // Pulsing amount (0-1)
  alpha = 0.5,        // Maximum alpha
  blur = 15,          // Blur amount
  layers = 2,         // Number of glow layers
  gradient = true     // Use gradient if true, solid color if false
} = {}) {
  ctx.save();
  ctx.translate(x, y);
  
  const currentRadius = radius * (1 + pulse * 0.2);
  
  for (let i = layers; i > 0; i--) {
    const layerRadius = currentRadius * (1 + (i / layers));
    const layerAlpha = (alpha * (i / layers)) / 2; // Fade out outer layers
    
    ctx.beginPath();
    ctx.arc(0, 0, layerRadius, 0, Math.PI * 2);
    
    if (gradient) {
      const gradient = ctx.createRadialGradient(
        0, 0, 0,
        0, 0, layerRadius
      );
      gradient.addColorStop(0, `rgba(${hexToRgb(color).join(',')}, ${layerAlpha})`);
      gradient.addColorStop(1, `rgba(${hexToRgb(color).join(',')}, 0)`);
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = color;
      ctx.globalAlpha = layerAlpha;
    }
    
    ctx.shadowColor = color;
    ctx.shadowBlur = blur * (i / layers);
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * Converts hex color to RGB array
 * @param {string} hex - Hex color string (#RRGGBB or #RGB)
 * @returns {number[]} [r, g, b] values (0-255)
 */
function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse r, g, b values
  let r, g, b;
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  
  return [r, g, b];
}

/**
 * Draws a star shape
 * @param {CanvasRenderingContext2D} ctx - The canvas context
 * @param {number} x - Center x position
 * @param {number} y - Center y position
 * @param {number} radius - Outer radius of the star
 * @param {number} points - Number of points
 * @param {Object} options - Configuration options
 */
function drawStar(ctx, x, y, radius, points, {
  innerRadiusRatio = 0.5,  // Ratio of inner to outer radius
  rotation = 0,            // Rotation in radians
  fillStyle = '#ffffff',   // Fill color
  strokeStyle = null,      // Stroke color (optional)
  lineWidth = 1            // Stroke width
} = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  
  const innerRadius = radius * innerRadiusRatio;
  const angleStep = (Math.PI * 2) / points;
  
  ctx.beginPath();
  
  for (let i = 0; i < points * 2; i++) {
    const angle = i * angleStep / 2 - Math.PI / 2; // Start from top
    const r = i % 2 === 0 ? radius : innerRadius;
    
    if (i === 0) {
      ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    } else {
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
  }
  
  ctx.closePath();
  
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  
  ctx.restore();
}

// --- End Projectile Helper Functions ---

// --- Projectile Configurations ---
const PROJECTILE_TYPES = {
  // Player Spell 0 (Mono-target - Yellow Star)
  player_spell_0: {
    type: 'star',
    baseRadius: 10,
    color: '#f1c40f',
    trail: {
      count: 8,
      sizeBase: 4,
      sizeDecay: 0.5,
      alphaBase: 0.4,
      distance: 2,
      color: 'rgba(255, 223, 100, 0.8)',
      jitter: 8,
      speedFactor: 1
    },
    glow: {
      radius: 16,
      color: '#f1c40f',
      alpha: 0.5,
      blur: 15,
      pulse: 0.15
    },
    star: {
      points: 5,
      innerRadiusRatio: 0.5,
      fill: '#ffffff',
      stroke: '#f1c40f',
      lineWidth: 2
    }
  },
  
  // Player Spell 1 (Zone - Orange Orb)
  player_spell_1: {
    type: 'orb',
    baseRadius: 11,
    color: '#ff8c00',
    trail: {
      count: 6,
      sizeBase: 5,
      sizeDecay: 0.8,
      alphaBase: 0.4,
      distance: 2.5,
      color: 'rgba(255, 165, 80, 0.7)',
      jitter: 5,
      speedFactor: 1.2
    },
    glow: {
      radius: 20,
      color: '#ff8c00',
      alpha: 0.6,
      blur: 20,
      pulse: 0.2
    },
    orb: {
      coreColor: '#ff8c00',
      edgeColor: '#ff6600',
      crackles: 5,
      crackleLength: 0.5
    }
  },
  
  // Player Spell 2 (Push - Green Arrow)
  player_spell_2: {
    type: 'arrow',
    length: 35,
    width: 14,
    color: '#2ecc71',
    trail: {
      count: 7,
      sizeBase: 5,
      sizeDecay: 0.6,
      alphaBase: 0.4,
      distance: 2.5,
      color: 'rgba(80, 255, 180, 0.6)',
      jitter: 6,
      speedFactor: 1.3
    },
    arrow: {
      tipLength: 0.4,
      indent: 0.2,
      fillGradient: ['#2ecc71', '#aaffdd'],
      stroke: '#ffffff',
      lineWidth: 1.5
    }
  },
  
  // Boss Projectile (Red Fireball)
  boss: {
    type: 'fireball',
    baseRadius: 12,
    color: '#e74c3c',
    trail: {
      count: 10,
      sizeBase: 5,
      sizeDecay: 0.4,
      alphaBase: 0.5,
      distance: 1.5,
      color: 'rgba(255, 120, 50, 0.8)',
      jitter: 10,
      speedFactor: 1.2
    },
    fireball: {
      coreColor: '#ffffff',
      midColor: '#ffdd00',
      outerColor: '#ff6600',
      edgeColor: '#e74c3c',
      flicker: 0.2,
      heatHaze: true
    }
  },
  
  // Sheep Projectile (Brown Mud Clod)
  sheep: {
    type: 'mud',
    baseRadius: 9,
    color: '#8B4513',
    trail: {
      count: 6,
      sizeBase: 6,
      sizeDecay: 0.7,
      alphaBase: 0.4,
      distance: 2,
      color: 'rgba(160, 110, 75, 0.7)',
      jitter: 5,
      speedFactor: 1.0
    },
    mud: {
      points: 7,
      irregularity: 0.4,
      fill: '#8B4513',
      stroke: '#65340B',
      lineWidth: 1,
      splatFactor: 2.0
    }
  },
  
  // Sheepist Noir Projectile (Dark Orb)
  sheepist_noir: {
    type: 'dark_orb',
    baseRadius: 10,
    color: '#2c3e50',
    trail: {
      count: 8,
      sizeBase: 7,
      sizeDecay: 0.6,
      alphaBase: 0.5,
      distance: 1.8,
      color: 'rgba(60, 70, 90, 0.8)',
      jitter: 3,
      speedFactor: 1.0,
      swirl: true,
      swirlIntensity: 0.8
    },
    darkOrb: {
      coreColor: '#566573',
      edgeColor: '#2c3e50',
      auraColor: 'rgba(80, 90, 110, 0.3)',
      auraRadius: 1.7,
      swirls: 2,
      swirlColor: 'rgba(119, 136, 153, 0.2)'
    }
  }
};

// --- End Projectile Configurations ---

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
            if (playerState === 'idle' && reachableTiles && reachableTiles.some(t => t.x === x && t.y === y && t.cost <= player.mp)) {
                // Base highlight for reachable tiles
                highlight = `rgba(46, 204, 113, ${0.15 + 0.15 * pulseSlow})`; // Pulsating alpha
                highlightType = 'move_range';
            } else if (playerState === 'aiming' && attackableTiles && attackableTiles.some(t => t.x === x && t.y === y)) {
                // Base highlight for attackable tiles (can also pulse if desired)
                highlight = `rgba(52, 152, 219, ${0.15 + 0.15 * pulseSlow})`; // Pulsating blue alpha
                highlightType = 'attack_range';
            }
            
            // Enemy hover range highlight (can override player highlights)
            if (playerState !== 'aiming' && enemyHoveredReachableTiles && enemyHoveredReachableTiles.some(t => t.x === x && t.y === y)) {
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
                if (playerState === 'idle' && reachableTiles && reachableTiles.some(t => t.x === x && t.y === y && t.cost <= player.mp)) {
                    // Use the faster pulse for the specific move target
                    highlight = `rgba(39, 174, 96, ${0.6 + 0.2 * pulseFast})`; 
                    highlightType = 'move_hover';
                } else if (playerState === 'aiming' && attackableTiles && attackableTiles.some(t => t.x === x && t.y === y)) {
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

/**
 * Draws projectiles on the canvas
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
 * @param {Array} projectiles - Array of projectile objects to draw
 * @param {Array} SPELLS - Array of spell configurations
 */
export function drawProjectiles(ctx, projectiles, SPELLS) {
    const now = performance.now();
    
    projectiles.forEach(p => {
        ctx.save();
        
        // Determine projectile type and configuration
        let config;
        let spellIndex = 0;
        
        if (p.owner === 'player') {
            spellIndex = p.spellIndex ?? 0;
            const spellKey = `player_spell_${spellIndex}`;
            config = { ...PROJECTILE_TYPES[spellKey] };
            
            // Override color from SPELLS if available
            if (SPELLS?.[spellIndex]?.color) {
                config.color = SPELLS[spellIndex].color;
                if (config.glow) config.glow.color = SPELLS[spellIndex].color;
                if (config.star) config.star.stroke = SPELLS[spellIndex].color;
            }
        } else {
            // Boss or enemy projectile
            config = { ...PROJECTILE_TYPES[p.owner] };
            if (p.color) config.color = p.color;
        }
        
        if (!config) {
            console.warn(`No configuration found for projectile type: ${p.owner}${spellIndex !== undefined ? ` (spell ${spellIndex})` : ''}`);
            ctx.restore();
            return;
        }
        
        // Add position and velocity to config for the helper functions
        config.x = p.x;
        config.y = p.y;
        config.dx = p.dx;
        config.dy = p.dy;
        
        // Draw trail if configured
        if (config.trail) {
            if (config.trail.swirl) {
                // Handle swirling trail (e.g., for sheepist_noir)
                const swirlAngle = now / 800;
                for (let t = 1; t <= config.trail.count; t++) {
                    const alpha = config.trail.alphaBase * (1 - t / (config.trail.count + 1));
                    if (alpha <= 0) continue;
                    
                    const swirlOffsetX = Math.cos(swirlAngle + t * 0.5) * t * 0.8;
                    const swirlOffsetY = Math.sin(swirlAngle + t * 0.5) * t * 0.8;
                    
                    drawParticleTrail(ctx, p.x + swirlOffsetX, p.y + swirlOffsetY, p.dx, p.dy, {
                        ...config.trail,
                        count: 1, // Draw one particle at a time in the loop
                        alphaBase: alpha,
                        jitter: 0 // No jitter for swirling trail
                    });
                }
            } else {
                // Standard particle trail
                drawParticleTrail(ctx, p.x, p.y, p.dx, p.dy, config.trail);
            }
        }
        
        // Draw the main projectile
        ctx.save();
        ctx.translate(p.x, p.y);
        
        // Apply rotation if the projectile has direction
        if (p.dx !== 0 || p.dy !== 0) {
            const angle = Math.atan2(p.dy, p.dx);
            ctx.rotate(angle);
        }
        
        // Draw based on projectile type
        switch (config.type) {
            case 'star':
                drawStarProjectile(ctx, config, now);
                break;
                
            case 'orb':
                drawOrbProjectile(ctx, config, now);
                break;
                
            case 'arrow':
                drawArrowProjectile(ctx, config, now);
                break;
                
            case 'fireball':
                drawFireballProjectile(ctx, config, now);
                break;
                
            case 'mud':
                drawMudProjectile(ctx, config, now);
                break;
                
            case 'dark_orb':
                drawDarkOrbProjectile(ctx, config, now);
                break;
                
            default:
                console.warn(`Unknown projectile type: ${config.type}`);
        }
        
        ctx.restore(); // Restore from main projectile transform
        ctx.restore(); // Restore from initial save
    });
}

/**
 * Draws a star-shaped projectile (e.g., player spell 0)
 */
function drawStarProjectile(ctx, config, now) {
    const pulse = Math.sin(now / 150) * config.glow.pulse;
    const rotation = now / 180;
    
    // Draw glow effect
    if (config.glow) {
        drawGlowEffect(ctx, 0, 0, config.glow.radius, config.glow.color, {
            pulse: pulse,
            alpha: config.glow.alpha,
            blur: config.glow.blur
        });
    }
    
    // Draw star
    if (config.star) {
        ctx.save();
        ctx.rotate(rotation);
        drawStar(ctx, 0, 0, config.baseRadius * (1.1 + pulse), config.star.points, {
            innerRadiusRatio: config.star.innerRadiusRatio,
            fillStyle: config.star.fill,
            strokeStyle: config.star.stroke,
            lineWidth: config.star.lineWidth
        });
        ctx.restore();
    }
}

/**
 * Draws an orb projectile with crackling energy (e.g., player spell 1)
 */
function drawOrbProjectile(ctx, config, now) {
    const pulse = 0.8 + 0.2 * Math.sin(now / 100);
    const rotation = now / 500;
    
    // Draw glow effect
    if (config.glow) {
        drawGlowEffect(ctx, 0, 0, config.glow.radius * pulse, config.glow.color, {
            alpha: config.glow.alpha,
            blur: config.glow.blur,
            pulse: pulse - 0.8 // Normalize pulse to 0-0.4 range
        });
    }
    
    // Save state for rotation
    ctx.save();
    ctx.rotate(rotation);
    
    // Draw central orb
    if (config.orb) {
        // Outer energy field
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, config.baseRadius * 1.8 * pulse);
        gradient.addColorStop(0, `rgba(255, 180, 100, 0.4)`);
        gradient.addColorStop(1, `rgba(230, 126, 34, 0)`);
        
        ctx.beginPath();
        ctx.arc(0, 0, config.baseRadius * 1.8 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Central orb
        const orbGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, config.baseRadius * pulse);
        orbGradient.addColorStop(0, config.orb.coreColor);
        orbGradient.addColorStop(1, config.orb.edgeColor);
        
        ctx.beginPath();
        ctx.arc(0, 0, config.baseRadius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = orbGradient;
        ctx.shadowColor = config.color;
        ctx.shadowBlur = 20;
        ctx.fill();
        
        // Crackling energy lines
        ctx.globalAlpha = 0.6 * pulse;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        
        for (let i = 0; i < config.orb.crackles; i++) {
            ctx.save();
            ctx.rotate(Math.random() * Math.PI * 2);
            
            ctx.beginPath();
            ctx.moveTo(config.baseRadius * 0.8 * pulse, 0);
            
            // Create jagged line
            const endRadius = config.baseRadius * (1.5 + Math.random() * 0.5) * pulse;
            ctx.lineTo(endRadius * 0.4, (Math.random() - 0.5) * 8);
            ctx.lineTo(endRadius, 0);
            
            ctx.stroke();
            ctx.restore();
        }
        
        // Reset global alpha
        ctx.globalAlpha = 1.0;
    }
    
    ctx.restore(); // Restore from rotation
}

/**
 * Draws an arrow projectile (e.g., player spell 2 - push)
 */
function drawArrowProjectile(ctx, config, now) {
    const pulse = 0.9 + 0.1 * Math.sin(now / 150);
    const angle = Math.atan2(config.dy, config.dx);
    
    // Draw glow effect
    if (config.glow) {
        drawGlowEffect(ctx, 0, 0, config.glow.radius * pulse, config.glow.color, {
            alpha: config.glow.alpha,
            blur: config.glow.blur,
            pulse: pulse - 0.9 // Normalize pulse to 0-0.2 range
        });
    }
    
    // Save state for rotation
    ctx.save();
    ctx.rotate(angle);
    
    // Draw arrow components
    const width = config.baseWidth * pulse;
    const height = config.baseHeight * pulse;
    
    // Arrow shaft
    ctx.fillStyle = config.color;
    ctx.shadowColor = config.color;
    ctx.shadowBlur = 10;
    
    // Draw the main shaft
    ctx.fillRect(-width * 0.8, -height * 0.5, width * 1.6, height);
    
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(width * 0.8, 0);
    ctx.lineTo(width * 1.6, -height * 1.5);
    ctx.lineTo(width * 1.6, height * 1.5);
    ctx.closePath();
    ctx.fill();
    
    // Arrow fletching
    ctx.beginPath();
    ctx.moveTo(-width * 0.8, -height * 0.8);
    ctx.lineTo(-width * 1.2, 0);
    ctx.lineTo(-width * 0.8, height * 0.8);
    ctx.closePath();
    ctx.fill();
    
    // Motion lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
        const yOffset = (i - 1) * height * 0.6;
        ctx.beginPath();
        ctx.moveTo(-width * 0.7, yOffset);
        ctx.lineTo(-width * 1.1, yOffset);
        ctx.stroke();
    }
    
    ctx.restore(); // Restore from rotation
}

/**
 * Draws a fireball projectile (e.g., boss fireball)
 */
function drawFireballProjectile(ctx, config, now) {
    const flicker = 0.9 + 0.2 * Math.random(); // Random flicker
    const pulse = 0.95 + 0.1 * Math.sin(now / 80); // Slight pulse
    
    // Draw glow effect
    if (config.glow) {
        drawGlowEffect(ctx, 0, 0, config.glow.radius * pulse * flicker, config.glow.color, {
            alpha: config.glow.alpha * flicker,
            blur: config.glow.blur,
            pulse: 0.1 + 0.1 * Math.sin(now / 100) // Subtle pulse
        });
    }
    
    // Draw fireball core
    if (config.fireball) {
        // Outer flame aura
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, config.baseRadius * 1.5 * pulse);
        gradient.addColorStop(0, `rgba(255, 200, 0, ${0.7 * flicker})`);
        gradient.addColorStop(0.7, `rgba(255, 100, 0, ${0.4 * flicker})`);
        gradient.addColorStop(1, `rgba(200, 30, 0, 0)`);
        
        ctx.beginPath();
        ctx.arc(0, 0, config.baseRadius * 1.5 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Inner fireball
        const innerGradient = ctx.createRadialGradient(
            0, 0, 0,
            0, 0, config.baseRadius * pulse
        );
        innerGradient.addColorStop(0, '#ffff00');
        innerGradient.addColorStop(0.7, '#ff6600');
        innerGradient.addColorStop(1, '#ff0000');
        
        ctx.beginPath();
        ctx.arc(0, 0, config.baseRadius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = innerGradient;
        ctx.fill();
        
        // Add some fire-like texture with semi-transparent yellow/red circles
        ctx.save();
        ctx.globalAlpha = 0.6 * flicker;
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * config.baseRadius * 0.6;
            const size = 1 + Math.random() * 3;
            
            ctx.beginPath();
            ctx.arc(
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                size,
                0,
                Math.PI * 2
            );
            ctx.fillStyle = Math.random() > 0.5 ? '#ff9900' : '#ff3300';
            ctx.fill();
        }
        ctx.restore();
    }
}

/**
 * Draws a mud projectile (e.g., sheep projectile)
 */
function drawMudProjectile(ctx, config, now) {
    const rotation = now / 200; // Slow rotation
    const splatFactor = Math.sin(now / 100) * 2; // For irregular shape
    
    // Draw trail effect
    if (config.trail) {
        drawParticleTrail(ctx, 0, 0, config.dx, config.dy, {
            count: 6,
            sizeBase: 6,
            sizeDecay: 0.7,
            alphaBase: 0.4,
            alphaDecay: 0.1,
            distance: 2,
            color: '#A06E4B', // Dusty brown
            jitter: 5,
            speedFactor: 2
        });
    }
    
    // Save state for rotation and translation
    ctx.save();
    ctx.translate(0, 0); // Position will be handled by the caller
    ctx.rotate(rotation);
    
    // Draw mud clod (irregular shape)
    if (config.mud) {
        ctx.beginPath();
        const points = 7; // More irregular
        for (let i = 0; i < points; ++i) {
            const angle = (Math.PI * 2 / points) * i;
            const radius = config.baseRadius * (0.8 + Math.random() * 0.4); // Random radius per point
            const xPoint = Math.cos(angle) * radius + (i % 2 === 0 ? splatFactor : -splatFactor); // Offset points for irregularity
            const yPoint = Math.sin(angle) * radius + (i % 2 !== 0 ? splatFactor : -splatFactor);
            if (i === 0) {
                ctx.moveTo(xPoint, yPoint);
            } else {
                ctx.lineTo(xPoint, yPoint);
            }
        }
        ctx.closePath();
        
        // Fill mud clod
        ctx.fillStyle = config.mud.color || '#8B4513'; // SaddleBrown
        ctx.shadowColor = config.mud.darkerColor || '#65340B';
        ctx.shadowBlur = 5;
        ctx.fill();
        
        // Add outline
        ctx.strokeStyle = config.mud.darkerColor || '#65340B';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Add some texture
        ctx.save();
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * config.baseRadius * 0.8;
            const size = 1 + Math.random() * 2;
            
            ctx.beginPath();
            ctx.arc(
                Math.cos(angle) * dist,
                Math.sin(angle) * dist,
                size,
                0,
                Math.PI * 2
            );
            ctx.fillStyle = Math.random() > 0.5 ? '#A0522D' : '#8B4513';
            ctx.fill();
        }
        ctx.restore();
    }
    
    ctx.restore(); // Restore from rotation and translation
}

/**
 * Draws a dark orb projectile (e.g., sheepist_noir projectile)
 */
function drawDarkOrbProjectile(ctx, config, now) {
    const pulse = 0.9 + 0.1 * Math.sin(now / 250); // Slow, heavy pulse
    const swirlAngle = now / 800; // Slow swirl
    
    // Draw trail with swirl effect
    if (config.trail) {
        ctx.save();
        ctx.translate(0, 0); // Position handled by caller
        ctx.globalAlpha = 0.6;
        
        for (let t = 1; t <= config.trail.count; t++) {
            const trailAlpha = config.trail.alphaBase * (1 - t / (config.trail.count + 1));
            if (trailAlpha <= 0) continue;
            
            ctx.globalAlpha = trailAlpha * pulse;
            const trailX = -config.dx * t * 1.8;
            const trailY = -config.dy * t * 1.8;
            const trailRadius = Math.max(2, config.trail.sizeBase - t * 0.6);
            
            // Add swirl effect if enabled
            let swirlOffsetX = 0;
            let swirlOffsetY = 0;
            if (config.trail.swirl) {
                const swirlIntensity = config.trail.swirlIntensity || 0.8;
                swirlOffsetX = Math.cos(swirlAngle + t * 0.5) * t * swirlIntensity;
                swirlOffsetY = Math.sin(swirlAngle + t * 0.5) * t * swirlIntensity;
            }
            
            ctx.fillStyle = config.trail.color || `rgba(60, 70, 90, ${trailAlpha * 0.8})`;
            ctx.beginPath();
            ctx.arc(
                trailX + swirlOffsetX, 
                trailY + swirlOffsetY, 
                trailRadius, 
                0, 
                Math.PI * 2
            );
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    // Save state for main orb drawing
    ctx.save();
    
    // Draw dark orb
    if (config.darkOrb) {
        // Outer aura
        const auraRadius = config.baseRadius * (config.darkOrb.auraRadius || 1.7) * pulse;
        const auraGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, auraRadius);
        auraGradient.addColorStop(0, `rgba(80, 90, 110, 0.3)`);
        auraGradient.addColorStop(1, 'rgba(44, 62, 80, 0)');
        
        ctx.beginPath();
        ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
        ctx.fillStyle = auraGradient;
        ctx.fill();
        
        // Core orb
        const coreGradient = ctx.createRadialGradient(
            0, 0, config.baseRadius * 0.2 * pulse,
            0, 0, config.baseRadius * pulse
        );
        coreGradient.addColorStop(0, config.darkOrb.coreColor || '#566573');
        coreGradient.addColorStop(1, config.darkOrb.edgeColor || '#2c3e50');
        
        ctx.beginPath();
        ctx.arc(0, 0, config.baseRadius * pulse, 0, Math.PI * 2);
        ctx.fillStyle = coreGradient;
        ctx.shadowColor = '#1a2530';
        ctx.shadowBlur = 18;
        ctx.fill();
        
        // Inner swirls
        ctx.save();
        ctx.globalAlpha = 0.2 * pulse;
        ctx.strokeStyle = config.darkOrb.swirlColor || 'rgba(119, 136, 153, 0.2)';
        ctx.lineWidth = 1;
        
        const swirls = config.darkOrb.swirls || 2;
        for (let i = 0; i < swirls; i++) {
            const angleOffset = (i / swirls) * Math.PI * 2;
            const points = [];
            
            // Create swirl points
            for (let a = 0; a < Math.PI * 2; a += 0.1) {
                const r = config.baseRadius * (0.3 + Math.sin(a * 3) * 0.1);
                points.push({
                    x: Math.cos(a + angleOffset) * r,
                    y: Math.sin(a + angleOffset) * r * 0.5
                });
            }
            
            // Draw swirl
            ctx.beginPath();
            points.forEach((p, idx) => {
                if (idx === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    ctx.restore(); // Restore from main orb drawing
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