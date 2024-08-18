const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let gameState = {
    isRunning: false,
    gameTime: null,
    ticketLimit: 0,
    tickets: [],
    calledNumbers: [],
    nextNumber: null
};

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', ws => {
    console.log('Client connected');

    ws.on('message', message => {
        const data = JSON.parse(message);
        switch (data.type) {
            case 'START_GAME':
                startGame();
                break;
            case 'STOP_GAME':
                stopGame();
                break;
            case 'SET_GAME_TIME':
                gameState.gameTime = data.time;
                sendStateToClients();
                break;
            case 'SET_TICKET_LIMIT':
                gameState.ticketLimit = data.limit;
                generateTickets();
                sendStateToClients();
                break;
            case 'BOOK_TICKET':
                bookTicket(data.ticketId, data.name);
                sendStateToClients();
                break;
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

function sendStateToClients() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'UPDATE_STATE', state: gameState }));
        }
    });
}

function startGame() {
    gameState.isRunning = true;
    gameState.calledNumbers = [];
    gameState.nextNumber = generateNextNumber();
    sendStateToClients();
    announceNumberPeriodically();
}

function stopGame() {
    gameState.isRunning = false;
    if (gameInterval) clearInterval(gameInterval);
    sendStateToClients();
}

function announceNumberPeriodically() {
    gameInterval = setInterval(() => {
        if (gameState.isRunning) {
            const number = gameState.nextNumber;
            if (number) {
                gameState.calledNumbers.push(number);
                gameState.nextNumber = generateNextNumber();
                sendStateToClients();
            }
        } else {
            clearInterval(gameInterval);
        }
    }, 5000); // Adjust the interval as needed
}

function generateNextNumber() {
    const availableNumbers = Array.from({ length: 90 }, (_, i) => i + 1).filter(num => !gameState.calledNumbers.includes(num));
    return availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
}

function sendStateToClients() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'UPDATE_STATE', state: gameState }));
        }
    });
}

function generateTickets() {
    const tickets = [];
    for (let i = 0; i < gameState.ticketLimit; i++) {
        tickets.push(generateTicket(i + 1));
    }
    gameState.tickets = tickets;
}

function generateTicket(ticketId) {
    const ticket = Array.from({ length: 3 }, () => Array(9).fill(null));
    const columns = Array.from({ length: 9 }, (_, i) => Array.from({ length: 10 }, (_, j) => i * 10 + j + 1).filter(n => n <= 90));

    for (let row = 0; row < 3; row++) {
        const numbers = Array.from({ length: 5 }, () => {
            const col = Math.floor(Math.random() * 9);
            const number = columns[col].splice(Math.floor(Math.random() * columns[col].length), 1)[0];
            return { col, number };
        });
        numbers.forEach(({ col, number }) => {
            ticket[row][col] = number;
        });
    }

    return { id: ticketId, grid: ticket };
}

function bookTicket(ticketId, name) {
    const ticket = gameState.tickets.find(t => t.id === ticketId);
    if (ticket) {
        ticket.name = name;
    }
}

server.listen(3000, () => {
    console.log('Server is listening on port 3000');
});
