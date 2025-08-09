// Room configurations

// Helper function to create a basic grid
function createEmptyGrid(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(0));
}

export const ROOMS = [
    // --- Room -1: LOBBY ---
    {
        id: -1,
        name: "Lobby",
        rows: 12,
        cols: 16,
        playerStart: { x: 8, y: 8 },
        mapGrid: (() => {
            const grid = createEmptyGrid(12, 16);
            // Decorative obstacles and paths
            grid[2][2] = 1; grid[2][3] = 1; grid[2][4] = 1; // Top left decoration
            grid[2][12] = 1; grid[2][13] = 1; grid[2][14] = 1; // Top right decoration
            grid[9][2] = 1; grid[9][3] = 1; grid[9][4] = 1; // Bottom left decoration
            grid[9][12] = 1; grid[9][13] = 1; grid[9][14] = 1; // Bottom right decoration
            
            // Central fountain/decoration
            grid[5][7] = 1; grid[5][8] = 1;
            grid[6][7] = 1; grid[6][8] = 1;
            
            return grid;
        })(),
        enemies: [],
        dungeonPortals: [
            { 
                gridX: 2, 
                gridY: 1, 
                targetRoom: 0, 
                name: "Training Grounds",
                description: "A safe place to practice your skills"
            },
            { 
                gridX: 14, 
                gridY: 1, 
                targetRoom: 1, 
                name: "War Chief's Antechamber",
                description: "Face the War Chief's minions"
            },
            { 
                gridX: 8, 
                gridY: 1, 
                targetRoom: 2, 
                name: "Throne Room",
                description: "The final challenge awaits"
            }
        ]
    },
    // --- Room 0 ---
    {
        id: 0,
        name: "Salle d'entraînement",
        rows: 10,
        cols: 12,
        playerStart: { x: 1, y: 1 },
        mapGrid: (() => {
            const grid = createEmptyGrid(10, 12);
            // Simple obstacles
            grid[3][3] = 1; grid[3][4] = 1; grid[3][5] = 1;
            grid[6][6] = 1; grid[6][7] = 1; grid[6][8] = 1;
             grid[4][8] = 1; grid[5][8] = 1;
            return grid;
        })(),
        enemies: [
            { type: 'sheep', gridX: 8, gridY: 2 },
            { type: 'sheep', gridX: 3, gridY: 7 },
            { type: 'sheepist_noir', gridX: 10, gridY: 4 },
            { type: 'sheepist_noir', gridX: 5, gridY: 5 },
        ],
        exitPortal: { gridX: 1, gridY: 1, targetRoom: -1 } // Return to lobby
    },
    // --- Room 1 ---
    {
        id: 1,
        name: "Antichambre du Chef",
        rows: 14,
        cols: 14,
        playerStart: { x: 1, y: 6 },
         // Using original L-shape layout for this room
        mapGrid: (() => {
            const GRID_ROWS = 14;
            const GRID_COLS = 14;
             const grid = createEmptyGrid(GRID_ROWS, GRID_COLS);
             const isTopLeftL = (x,y) => (x === 3 && y >= 3 && y <= 5) || (y === 3 && x >= 3 && x <= 5);
             const isTopRightL = (x,y) => (x === GRID_COLS-4 && y >= 3 && y <= 5) || (y === 3 && x >= GRID_COLS-6 && x <= GRID_COLS-4);
             const isBottomLeftL = (x,y) => (x === 3 && y >= GRID_ROWS-6 && y <= GRID_ROWS-4) || (y === GRID_ROWS-4 && x >= 3 && x <= 5);
             const isBottomRightL = (x,y) => (x === GRID_COLS-4 && y >= GRID_ROWS-6 && y <= GRID_ROWS-4) || (y === GRID_ROWS-4 && x >= GRID_COLS-6 && x <= GRID_COLS-4);
             for (let y = 0; y < GRID_ROWS; y++) {
                 for (let x = 0; x < GRID_COLS; x++) {
                     if (isTopLeftL(x,y) || isTopRightL(x,y) || isBottomLeftL(x,y) || isBottomRightL(x,y)) {
                         grid[y][x] = 1;
                     }
                 }
             }
            return grid;
        })(),
        enemies: [
            { type: 'sheep', gridX: 10, gridY: 2 },
            { type: 'sheep', gridX: 4, gridY: 11 },
            { type: 'sheepist_noir', gridX: 7, gridY: 7 },
            { type: 'chef_de_guerre', gridX: 11, gridY: 11 },
        ],
        exitPortal: { gridX: 1, gridY: 6, targetRoom: -1 } // Return to lobby
    },
    // --- Room 2 ---
    {
        id: 2,
        name: "Salle du Trône",
        rows: 16,
        cols: 16,
        playerStart: { x: 1, y: 7 },
        mapGrid: (() => {
            const grid = createEmptyGrid(16, 16);
            // Central platform and pillars
            for(let i=5; i<11; i++) { grid[5][i] = 1; grid[10][i] = 1; } // Top/Bottom walls
            for(let i=6; i<10; i++) { 
                // Skip one spot on the left wall to create an exit
                if (i !== 7) { grid[i][5] = 1; } // Left wall (with gap at y=7)
                grid[i][10] = 1; // Right wall
            }
            grid[3][3] = 1; grid[3][12] = 1; grid[12][3] = 1; grid[12][12] = 1; // Corner pillars
            return grid;
        })(),
        enemies: [
            { type: 'sheep', gridX: 7, gridY: 8 }, // Center
            { type: 'sheepist_noir', gridX: 14, gridY: 7 }, // Right
            { type: 'chef_de_guerre', gridX: 7, gridY: 14 }, // Bottom
            { type: 'boss', gridX: 14, gridY: 1 }, // Top Right
        ],
        exitPortal: { gridX: 1, gridY: 7, targetRoom: -1 } // Return to lobby
    },
];

// Function to get room data by ID
export function getRoomData(roomId) {
    return ROOMS.find(room => room.id === roomId);
}