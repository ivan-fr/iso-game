// Point d'entrée principal, initialisation, boucle de jeu, import des modules

import { initGame } from './game.js';
import inventoryManager from './inventory.js'; // Import to ensure instantiation
import { startGameLoop } from './loop.js';
import './script.js'; // Import to execute its setup code

// Boucle de jeu, initialisation, gestion des événements, orchestration à migrer ici depuis game.js

window.addEventListener('DOMContentLoaded', () => {
    // Optional: Log inventoryManager to confirm it's loaded
    console.log("Inventory Manager loaded in main.js:", inventoryManager);
    initGame();
    startGameLoop();
});