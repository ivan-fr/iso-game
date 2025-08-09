// Point d'entrée principal, initialisation, boucle de jeu, import des modules

import { initGame } from './game.js';
import inventoryManager from './inventory.js'; // Import to ensure instantiation
import { startGameLoop } from './loop.js';
import './script.js'; // Import to execute its setup code

// Boucle de jeu, initialisation, gestion des événements, orchestration à migrer ici depuis game.js

window.addEventListener('DOMContentLoaded', () => {
    // Optional: Log inventoryManager to confirm it's loaded
    console.log("Inventory Manager loaded in main.js:", inventoryManager);
    // Start in lobby (room -1) instead of room 0
    initGame(-1); // Pass lobby room ID to start there
    startGameLoop();
});