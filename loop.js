import { drawBackground, drawBuffAnimations, drawDamageAnimations, drawEndGameOverlay, drawGrid, drawProjectiles, drawTile } from './draw.js';
import { player } from './entities.js';
import {
    attackableTiles,
    bossState,
    buffAnimations,
    currentGridCols, currentGridRows,
    currentMapGrid,
    damageAnimations,
    enemiesState,
    enemyHoveredReachableTiles,
    gameOver, gameTick,
    hoveredEnemyId,
    hoveredTile,
    playerState,
    projectiles,
    reachableTiles
} from './game.js';
import { TILE_H, TILE_W, hasLineOfSight } from './grid.js';
import { SPELLS, getSelectedSpellIndex } from './spells.js';
import { PerformanceUtils } from './utils/helpers.js';

// Image loading (mimic game_legacy.js)
const tileImage = new window.Image();
tileImage.src = 'sol.png';
let tileImageLoaded = false;
tileImage.onload = () => { tileImageLoaded = true; };
const bossImage = new window.Image();
let bossImageLoaded = false;
bossImage.src = 'boss.png';
bossImage.onload = () => { bossImageLoaded = true; };
const playerImage = new window.Image();
let playerImageLoaded = false;
playerImage.src = 'joueur.png';
playerImage.onload = () => { playerImageLoaded = true; };

// Chargement des images d'obstacles
window.arbreImage = new window.Image();
window.arbreImage.src = 'arbre.png';
window.caisseImage = new window.Image();
window.caisseImage.src = 'caisse.png';

// Chargement de l'image des sheeps
window.sheepImage = new window.Image();
window.sheepImage.src = 'sheep.png'; // chemin sans './' pour cohérence
let sheepImageLoaded = false; // Use a local flag like others
window.sheepImage.onload = () => { 
    window.sheepImage.loaded = true; 
    sheepImageLoaded = true; // Set the flag
};

const sheepistNoirImage = new window.Image();
let sheepistNoirImageLoaded = false;
sheepistNoirImage.src = 'sheepist_noir.png';
sheepistNoirImage.onload = () => { sheepistNoirImageLoaded = true; };

const chefImage = new window.Image();
let chefImageLoaded = false;
chefImage.src = 'chef.png';
chefImage.onload = () => { chefImageLoaded = true; };

// Pass image refs to draw functions if needed, or handle globally in draw.js
// Consider a central asset loader later.
window.loadedImages = {
    tile: tileImage, player: playerImage, boss: bossImage, 
    sheep: window.sheepImage, // Keep using window ref here
    sheepist_noir: sheepistNoirImage, chef: chefImage,
    chef_de_guerre: chefImage, // Add mapping for aiType
    arbre: window.arbreImage, 
    caisse: window.caisseImage
};
window.loadedImageStatus = {
     tile: tileImage.complete, // Use direct complete status
     player: playerImage.complete, // Use direct complete status
     boss: bossImage.complete, // Use direct complete status
     sheep: window.sheepImage.complete, // Use direct complete status
     sheepist_noir: sheepistNoirImage.complete, // Use direct complete status
     chef: chefImage.complete, // Use direct complete status
     chef_de_guerre: chefImage.complete, // Add mapping for aiType
     arbre: window.arbreImage.complete, // Use direct complete status
     caisse: window.caisseImage.complete // Use direct complete status
};

// Performance tracking
let frameCount = 0;
let lastFrameTime = 0;
let averageFrameTime = 16.67; // ~60fps

export function startGameLoop() {
    function gameLoop(timestamp = 0) {
        PerformanceUtils.startTimer('gameLoop');
        
        const canvas = document.getElementById('gameCanvas');
        if (!canvas) return; // Skip frame if canvas not ready
        const ctx = canvas.getContext('2d');

        // Update loaded status directly each frame (simplest approach)
        window.loadedImageStatus.tile = tileImage.complete;
        window.loadedImageStatus.player = playerImage.complete;
        window.loadedImageStatus.boss = bossImage.complete;
        window.loadedImageStatus.sheep = window.sheepImage.complete;
        window.loadedImageStatus.sheepist_noir = sheepistNoirImage.complete;
        window.loadedImageStatus.chef = chefImage.complete;
        window.loadedImageStatus.chef_de_guerre = chefImage.complete; // Update status too
        window.loadedImageStatus.arbre = window.arbreImage.complete;
        window.loadedImageStatus.caisse = window.caisseImage.complete;

        PerformanceUtils.startTimer('drawBackground');
        drawBackground(ctx, canvas);
        PerformanceUtils.endTimer('drawBackground');

        // Get current entities to draw
        PerformanceUtils.startTimer('entityMapping');
        const currentEntities = [
            { entity: player, image: window.loadedImages.player, loaded: window.loadedImageStatus.player },
             ...(bossState ? [{ entity: bossState, image: window.loadedImages.boss, loaded: window.loadedImageStatus.boss }] : []),
            ...enemiesState.map(e => ({
                 entity: e, 
                 image: window.loadedImages[e.aiType], 
                 loaded: window.loadedImageStatus[e.aiType] ?? false
             }))
         ].filter(item => !!item.entity); // Keep only entities that exist, DO NOT filter by hp > 0
        PerformanceUtils.endTimer('entityMapping');

        // Call drawGrid with current state
        PerformanceUtils.startTimer('drawGrid');
        drawGrid(
            ctx,
            currentMapGrid, // Pass current map
            currentGridCols, // Pass current dimensions
            currentGridRows,
            playerState,
            reachableTiles,
            attackableTiles,
            hoveredTile,
            SPELLS,
            getSelectedSpellIndex(),
            TILE_W,
            TILE_H,
            hasLineOfSight, // Pass LoS function (might need grid passed to it)
            player,
            drawTile, // Pass drawTile function
            window.loadedImages.tile, // Pass tile image ref
            window.loadedImageStatus.tile, // Pass tile loaded status
            currentEntities, // Pass dynamic list of entities to draw
            enemyHoveredReachableTiles,
            hoveredEnemyId
        );
        PerformanceUtils.endTimer('drawGrid');

        PerformanceUtils.startTimer('drawEffects');
        drawProjectiles(ctx, projectiles, SPELLS);
        drawDamageAnimations(ctx, damageAnimations, TILE_W); // Pass TILE_W
        drawBuffAnimations(ctx, buffAnimations);
        drawEndGameOverlay(ctx, canvas, gameOver, player);
        PerformanceUtils.endTimer('drawEffects');
        
        PerformanceUtils.startTimer('gameTick');
        gameTick(); // Updates projectiles etc.
        PerformanceUtils.endTimer('gameTick');
        
        // Performance monitoring
        const frameTime = PerformanceUtils.endTimer('gameLoop');
        frameCount++;
        
        // Calculate moving average frame time
        averageFrameTime = averageFrameTime * 0.9 + frameTime * 0.1;
        
        // Log performance warnings if frame takes too long
        if (frameTime > 33.33) { // More than ~30fps
            console.warn(`[Performance] Slow frame: ${frameTime.toFixed(2)}ms (avg: ${averageFrameTime.toFixed(2)}ms)`);
        }
        
        // Log performance stats every 5 seconds in development
        if (process.env.NODE_ENV === 'development' && frameCount % 300 === 0) {
            console.log(`[Performance] Frame ${frameCount}: ${frameTime.toFixed(2)}ms (avg: ${averageFrameTime.toFixed(2)}ms, ~${(1000/averageFrameTime).toFixed(1)}fps)`);
        }
        
        requestAnimationFrame(gameLoop);
    }
    gameLoop();
}