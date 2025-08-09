/**
 * Simplified Integration tests for Socket.IO server
 */
import { jest } from '@jest/globals';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';

// Simple Socket.IO functionality tests
describe('Socket.IO Basic Integration', () => {
    let httpServer;
    let io;
    let clientSocket;
    let serverSocket;

    beforeAll((done) => {
        httpServer = createServer();
        io = new Server(httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        httpServer.listen(() => {
            const port = httpServer.address().port;
            clientSocket = new Client(`http://localhost:${port}`, {
                autoConnect: false
            });

            io.on('connection', (socket) => {
                serverSocket = socket;
            });

            clientSocket.connect();
            clientSocket.on('connect', done);
        });
    }, 10000);

    afterAll((done) => {
        io.close();
        clientSocket.close();
        httpServer.close(done);
    }, 10000);

    test('should establish connection', (done) => {
        expect(serverSocket).toBeDefined();
        expect(clientSocket.connected).toBe(true);
        done();
    });

    test('should send and receive messages', (done) => {
        serverSocket.on('test-message', (data) => {
            expect(data.content).toBe('hello');
            serverSocket.emit('test-response', { status: 'received' });
        });

        clientSocket.on('test-response', (data) => {
            expect(data.status).toBe('received');
            done();
        });

        clientSocket.emit('test-message', { content: 'hello' });
    });

    test('should handle multiple message types', (done) => {
        let messagesReceived = 0;
        let completed = false;
        
        const checkCompletion = () => {
            if (messagesReceived === 2 && !completed) {
                completed = true;
                done();
            }
        };
        
        serverSocket.on('player-action', (data) => {
            serverSocket.emit('action-confirmed', { actionId: data.actionId });
            messagesReceived++;
        });

        serverSocket.on('game-state', (data) => {
            serverSocket.emit('state-updated', { gameId: data.gameId });
            messagesReceived++;
        });

        clientSocket.on('action-confirmed', (data) => {
            expect(data.actionId).toBe('move-123');
            checkCompletion();
        });

        clientSocket.on('state-updated', (data) => {
            expect(data.gameId).toBe('game-456');
            checkCompletion();
        });

        clientSocket.emit('player-action', { actionId: 'move-123' });
        clientSocket.emit('game-state', { gameId: 'game-456' });
    });
});
