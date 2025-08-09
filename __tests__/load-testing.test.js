/**
 * Load testing for multiplayer scenarios
 */
import { jest } from '@jest/globals';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';

describe('Multiplayer Load Testing', () => {
    let httpServer;
    let io;
    let clients = [];
    
    const PORT = 3001;
    const SERVER_URL = `http://localhost:${PORT}`;
    
    beforeAll((done) => {
        httpServer = createServer();
        io = new Server(httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        // Basic server handlers for testing
        io.on('connection', (socket) => {
            socket.on('join-lobby', (data) => {
                socket.join(data.lobbyId);
                socket.emit('lobby-joined', { lobbyId: data.lobbyId });
            });
            
            socket.on('game-action', (data) => {
                socket.to(data.lobbyId).emit('game-action-received', data);
            });
            
            socket.on('disconnect', () => {
                // Handle cleanup
            });
        });
        
        httpServer.listen(PORT, done);
    });
    
    afterAll((done) => {
        clients.forEach(client => {
            if (client.connected) {
                client.disconnect();
            }
        });
        clients = [];
        
        io.close();
        httpServer.close(done);
    });
    
    afterEach(() => {
        // Clean up clients after each test
        clients.forEach(client => {
            if (client.connected) {
                client.disconnect();
            }
        });
        clients = [];
    });

    describe('Connection Load Testing', () => {
        test('should handle 10 concurrent connections', async () => {
            const connectionPromises = [];
            const CONNECTION_COUNT = 10;
            
            for (let i = 0; i < CONNECTION_COUNT; i++) {
                const promise = new Promise((resolve, reject) => {
                    const client = Client(SERVER_URL);
                    clients.push(client);
                    
                    const timeout = setTimeout(() => {
                        reject(new Error(`Client ${i} failed to connect within timeout`));
                    }, 5000);
                    
                    client.on('connect', () => {
                        clearTimeout(timeout);
                        resolve(client.id);
                    });
                    
                    client.on('connect_error', (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    });
                });
                
                connectionPromises.push(promise);
            }
            
            const connectedClientIds = await Promise.all(connectionPromises);
            
            expect(connectedClientIds).toHaveLength(CONNECTION_COUNT);
            expect(new Set(connectedClientIds).size).toBe(CONNECTION_COUNT); // All unique IDs
            
            // Verify all clients are connected
            clients.forEach(client => {
                expect(client.connected).toBe(true);
            });
        });

        test('should handle rapid connect/disconnect cycles', async () => {
            const CYCLE_COUNT = 5;
            const CLIENTS_PER_CYCLE = 5;
            
            for (let cycle = 0; cycle < CYCLE_COUNT; cycle++) {
                // Connect multiple clients
                const connectPromises = [];
                
                for (let i = 0; i < CLIENTS_PER_CYCLE; i++) {
                    const promise = new Promise((resolve) => {
                        const client = Client(SERVER_URL);
                        clients.push(client);
                        client.on('connect', () => resolve(client));
                    });
                    connectPromises.push(promise);
                }
                
                const connectedClients = await Promise.all(connectPromises);
                
                // Verify connections
                expect(connectedClients).toHaveLength(CLIENTS_PER_CYCLE);
                connectedClients.forEach(client => {
                    expect(client.connected).toBe(true);
                });
                
                // Disconnect all clients
                const disconnectPromises = connectedClients.map(client => {
                    return new Promise((resolve) => {
                        client.on('disconnect', resolve);
                        client.disconnect();
                    });
                });
                
                await Promise.all(disconnectPromises);
                
                // Clear clients array for next cycle
                clients = [];
            }
        }, 15000);
    });

    describe('Lobby Load Testing', () => {
        test('should handle multiple lobbies with concurrent players', async () => {
            const LOBBY_COUNT = 3;
            const PLAYERS_PER_LOBBY = 4;
            const lobbies = [];
            
            // Create lobbies and fill them with players
            for (let lobbyIndex = 0; lobbyIndex < LOBBY_COUNT; lobbyIndex++) {
                const lobbyId = `load-test-lobby-${lobbyIndex}`;
                const lobbyClients = [];
                
                for (let playerIndex = 0; playerIndex < PLAYERS_PER_LOBBY; playerIndex++) {
                    const client = Client(SERVER_URL);
                    clients.push(client);
                    lobbyClients.push(client);
                    
                    await new Promise((resolve) => {
                        client.on('connect', resolve);
                    });
                }
                
                // Join all players to the lobby
                const joinPromises = lobbyClients.map(client => {
                    return new Promise((resolve) => {
                        client.on('lobby-joined', resolve);
                        client.emit('join-lobby', { lobbyId });
                    });
                });
                
                await Promise.all(joinPromises);
                
                lobbies.push({
                    id: lobbyId,
                    clients: lobbyClients
                });
            }
            
            expect(lobbies).toHaveLength(LOBBY_COUNT);
            expect(clients).toHaveLength(LOBBY_COUNT * PLAYERS_PER_LOBBY);
            
            // Verify all clients are connected and in lobbies
            clients.forEach(client => {
                expect(client.connected).toBe(true);
            });
        }, 10000);

        test('should handle high-frequency game actions', async () => {
            const LOBBY_ID = 'high-frequency-test';
            const CLIENT_COUNT = 4;
            const ACTIONS_PER_CLIENT = 20;
            
            // Connect clients
            const connectPromises = [];
            for (let i = 0; i < CLIENT_COUNT; i++) {
                const promise = new Promise((resolve) => {
                    const client = Client(SERVER_URL);
                    clients.push(client);
                    client.on('connect', () => {
                        client.emit('join-lobby', { lobbyId: LOBBY_ID });
                        client.on('lobby-joined', () => resolve(client));
                    });
                });
                connectPromises.push(promise);
            }
            
            await Promise.all(connectPromises);
            
            // Track received actions
            const receivedActions = [];
            clients.forEach(client => {
                client.on('game-action-received', (data) => {
                    receivedActions.push(data);
                });
            });
            
            // Send rapid fire actions from all clients
            const actionPromises = [];
            clients.forEach((client, clientIndex) => {
                for (let actionIndex = 0; actionIndex < ACTIONS_PER_CLIENT; actionIndex++) {
                    const promise = new Promise((resolve) => {
                        const action = {
                            type: 'move',
                            playerId: client.id,
                            actionId: `${clientIndex}-${actionIndex}`,
                            timestamp: Date.now()
                        };
                        
                        client.emit('game-action', {
                            lobbyId: LOBBY_ID,
                            action
                        });
                        
                        // Resolve immediately after sending
                        setTimeout(resolve, 1);
                    });
                    actionPromises.push(promise);
                }
            });
            
            await Promise.all(actionPromises);
            
            // Wait for actions to be processed
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Should receive actions from other clients (not own actions)
            const expectedMinActions = (CLIENT_COUNT - 1) * ACTIONS_PER_CLIENT;
            expect(receivedActions.length).toBeGreaterThanOrEqual(expectedMinActions * 0.8); // Allow 20% tolerance
        }, 15000);
    });

    describe('Memory and Performance Testing', () => {
        test('should not leak memory with repeated connections', async () => {
            const initialMemory = process.memoryUsage();
            const CONNECTION_CYCLES = 10;
            const CLIENTS_PER_CYCLE = 5;
            
            for (let cycle = 0; cycle < CONNECTION_CYCLES; cycle++) {
                const cycleClients = [];
                
                // Create connections
                for (let i = 0; i < CLIENTS_PER_CYCLE; i++) {
                    const client = Client(SERVER_URL);
                    cycleClients.push(client);
                    
                    await new Promise((resolve) => {
                        client.on('connect', resolve);
                    });
                }
                
                // Do some work
                await Promise.all(cycleClients.map(client => {
                    return new Promise((resolve) => {
                        client.emit('join-lobby', { lobbyId: 'memory-test' });
                        client.on('lobby-joined', resolve);
                    });
                }));
                
                // Disconnect all
                await Promise.all(cycleClients.map(client => {
                    return new Promise((resolve) => {
                        client.on('disconnect', resolve);
                        client.disconnect();
                    });
                }));
                
                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }
            }
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // Memory increase should be reasonable (less than 50MB)
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        }, 30000);

        test('should maintain reasonable response times under load', async () => {
            const CLIENT_COUNT = 8;
            const TEST_DURATION = 5000; // 5 seconds
            const responseTimes = [];
            
            // Connect clients
            const connectPromises = [];
            for (let i = 0; i < CLIENT_COUNT; i++) {
                const promise = new Promise((resolve) => {
                    const client = Client(SERVER_URL);
                    clients.push(client);
                    client.on('connect', () => {
                        client.emit('join-lobby', { lobbyId: 'performance-test' });
                        client.on('lobby-joined', () => resolve(client));
                    });
                });
                connectPromises.push(promise);
            }
            
            await Promise.all(connectPromises);
            
            // Start performance test
            const startTime = Date.now();
            let testRunning = true;
            
            setTimeout(() => {
                testRunning = false;
            }, TEST_DURATION);
            
            const performancePromises = clients.map(async (client) => {
                let actionCount = 0;
                
                while (testRunning) {
                    const actionStart = Date.now();
                    
                    await new Promise((resolve) => {
                        const action = {
                            type: 'ping',
                            timestamp: actionStart,
                            actionId: `${client.id}-${actionCount++}`
                        };
                        
                        client.emit('game-action', {
                            lobbyId: 'performance-test',
                            action
                        });
                        
                        client.once('game-action-received', () => {
                            const responseTime = Date.now() - actionStart;
                            responseTimes.push(responseTime);
                            resolve();
                        });
                        
                        // Timeout protection
                        setTimeout(resolve, 1000);
                    });
                    
                    // Small delay between actions
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            });
            
            await Promise.all(performancePromises);
            
            // Analyze response times
            if (responseTimes.length > 0) {
                const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
                const maxResponseTime = Math.max(...responseTimes);
                
                console.log(`Average response time: ${avgResponseTime}ms`);
                console.log(`Max response time: ${maxResponseTime}ms`);
                console.log(`Total actions: ${responseTimes.length}`);
                
                // Response times should be reasonable
                expect(avgResponseTime).toBeLessThan(100); // Average under 100ms
                expect(maxResponseTime).toBeLessThan(500); // Max under 500ms
            }
        }, 20000);
    });

    describe('Error Recovery Testing', () => {
        test('should handle server restart gracefully', async () => {
            const CLIENT_COUNT = 3;
            const connectPromises = [];
            
            // Connect initial clients
            for (let i = 0; i < CLIENT_COUNT; i++) {
                const promise = new Promise((resolve) => {
                    const client = Client(SERVER_URL, {
                        reconnection: true,
                        reconnectionAttempts: 3,
                        reconnectionDelay: 100
                    });
                    clients.push(client);
                    client.on('connect', () => resolve(client));
                });
                connectPromises.push(promise);
            }
            
            await Promise.all(connectPromises);
            
            // Verify initial connections
            clients.forEach(client => {
                expect(client.connected).toBe(true);
            });
            
            // Simulate server restart by closing and reopening
            await new Promise((resolve) => {
                io.close(() => {
                    // Server is now closed
                    setTimeout(() => {
                        // Restart server
                        const newIo = new Server(httpServer, {
                            cors: {
                                origin: "*",
                                methods: ["GET", "POST"]
                            }
                        });
                        
                        newIo.on('connection', (socket) => {
                            socket.on('join-lobby', (data) => {
                                socket.join(data.lobbyId);
                                socket.emit('lobby-joined', { lobbyId: data.lobbyId });
                            });
                        });
                        
                        io = newIo;
                        resolve();
                    }, 500);
                });
            });
            
            // Wait for potential reconnections
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // At least some clients should have reconnected
            const connectedClients = clients.filter(client => client.connected);
            expect(connectedClients.length).toBeGreaterThan(0);
        }, 15000);
    });
});
