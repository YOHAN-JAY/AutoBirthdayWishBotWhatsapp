const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { Poll } = require('whatsapp-web.js');
const { getBirthdays } = require('./birthdayChecker');

function startWebServer(client) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);
    const PORT = 3000;

    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.json());

    const allowedGroupId = '120363388371926819@g.us';
    
    // --- API Endpoints ---
    app.post('/api/logout', async (req, res) => {
        try {
            if (!isClientReady) return res.json({ success: true });
            console.log('User requested logout from Web UI...');
            await client.logout();
            console.log('Logged out successfully, pulling up a new Auth Session...');
            
            // Wait slightly before re-initializing to ensure Puppeteer closes cleanly
            setTimeout(() => {
                client.initialize().catch(err => console.error('Failed to re-initialize after logout:', err));
            }, 2000);
            
            res.json({ success: true });
        } catch (e) {
            console.error('API Logout Error:', e);
            res.status(500).json({ error: 'Failed to logout from WhatsApp.' });
        }
    });

    app.post('/api/announce', async (req, res) => {
        if (!isClientReady) return res.status(400).json({ error: 'Bot is not logged in.' });
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        try {
            await client.sendMessage(allowedGroupId, `📣 *ANNOUNCEMENT*\n\n${message}`);
            res.json({ success: true });
        } catch (e) {
            console.error('API Announce Error:', e);
            res.status(500).json({ error: 'WhatsApp client not ready or network error.' });
        }
    });

    app.post('/api/quiz', async (req, res) => {
        if (!isClientReady) return res.status(400).json({ error: 'Bot is not logged in.' });
        const { command } = req.body;
        if (!command) return res.status(400).json({ error: 'Command string is required' });

        try {
            // We can literally fake a message object and reuse the logic, OR 
            // since the core logic is in bot.js message_create, we have to either extract it or re-implement it here.
            // Let's re-implement the short poll logic here:
            const lines = command.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
            let commandText = lines[0].replace(/^\/(quiz|poll)\s+/i, '').trim();
            let timerSeconds = 30;
            let question = commandText;

            const timeMatch = commandText.match(/^(\d+)\s+(.*)/);
            if (timeMatch) {
                timerSeconds = parseInt(timeMatch[1], 10);
                question = timeMatch[2];
            }

            let correctAnswerText = null;
            const options = lines.slice(1).map(opt => {
                if (opt.startsWith('*')) {
                    const cleanOpt = opt.substring(1).trim();
                    correctAnswerText = cleanOpt;
                    return cleanOpt;
                }
                return opt;
            });

            const poll = new Poll(question, options);
            const pollMsg = await client.sendMessage(allowedGroupId, poll);

            // We must inject this into the global activeQuiz in bot.js, 
            // but activeQuiz is trapped in bot.js scope!
            // Workaround: Rather than duplicating state, let's just send the text to our own number,
            // which triggers the message_create event in bot.js natively!
            const myChatId = client.info.wid._serialized;
            await client.sendMessage(myChatId, command);

            res.json({ success: true });
            
        } catch (e) {
            console.error('API Quiz Error:', e);
            res.status(500).json({ error: 'Failed to process quiz.' });
        }
    });

    app.get('/api/reminders', (req, res) => {
        try {
            // We use the timezone offset logic implicitly handled in birthdayChecker by passing Colombo time
            const colomboTimeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" });
            const targetDate = new Date(colomboTimeStr);
            const { today, tomorrow, thisMonth } = getBirthdays(targetDate);
            res.json({ today, tomorrow, thisMonth });
        } catch(e) {
            res.status(500).json({ error: 'Failed to read reminders' });
        }
    });

    app.get('/api/birthdays', (req, res) => {
        const filePath = path.join(__dirname, 'BatchBirthdayList.txt');
        if (!fs.existsSync(filePath)) return res.json([]);
        
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        
        // Skip header
        const data = lines.slice(1).map(line => {
            const parts = line.split('\t');
            return {
                year: parts[0], month: parts[1], day: parts[2],
                gender: parts[3], age: parts[4], name: parts[5]
            };
        });
        res.json(data);
    });

    app.post('/api/birthdays', (req, res) => {
        const { birthdays } = req.body; // Array of birthday objects
        const filePath = path.join(__dirname, 'BatchBirthdayList.txt');
        
        try {
            let fileContent = 'Year\tMonth\tDay\tGender\tAge\tCallingName\n';
            birthdays.forEach(b => {
                fileContent += `${b.year}\t${b.month}\t${b.day}\t${b.gender}\t${b.age}\t${b.name}\n`;
            });
            
            fs.writeFileSync(filePath, fileContent, 'utf-8');
            res.json({ success: true });
        } catch (e) {
            console.error('Failed to save birthdays:', e);
            res.status(500).json({ error: 'Failed to write to database file.' });
        }
    });

    app.get('/api/group_members', async (req, res) => {
        if (!isClientReady) return res.json([]);
        
        try {
            const chat = await client.getChatById(allowedGroupId);
            const participants = chat.participants;
            const members = [];
            
            // Limit to avoid rate limits on DP fetching, or just do it concurrently safely
            for (let i = 0; i < participants.length; i++) {
                const p = participants[i];
                let dpUrl = null;
                let name = p.id.user;
                
                try {
                    const contact = await client.getContactById(p.id._serialized);
                    name = contact.name || contact.pushname || p.id.user;
                    dpUrl = await contact.getProfilePicUrl();
                } catch(e) {}
                
                members.push({
                    id: p.id._serialized,
                    name: name,
                    dp: dpUrl || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=100&auto=format&fit=crop'
                });
            }
            
            res.json(members);
        } catch (e) {
            console.error('Failed to fetch group members:', e);
            res.status(500).json({ error: 'Failed to fetch members' });
        }
    });

    // --- WebSockets ---
    let isClientReady = false;

    client.on('qr', (qr) => {
        isClientReady = false;
        io.emit('qr', qr);
    });

    client.on('ready', () => {
        isClientReady = true;
    });

    client.on('disconnected', () => {
        isClientReady = false;
    });
    
    client.on('presence_changed', (playerId, presence) => {
        // e.g., 'typing', 'recording', 'available', 'unavailable'
        const isOnline = ['typing', 'recording', 'available'].includes(presence);
        io.emit('participant_presence', { id: playerId, isOnline });
    });

    // Broadcast system stats every 5 seconds
    setInterval(() => {
        const totalMemMB = Math.floor(os.totalmem() / (1024 * 1024));
        const freeMemMB = Math.floor(os.freemem() / (1024 * 1024));
        const usedMemMB = totalMemMB - freeMemMB;
        
        const botUptime = process.uptime();
        const botHours = Math.floor(botUptime / 3600);
        const botMinutes = Math.floor((botUptime % 3600) / 60);

        io.emit('bot_status', {
            isReady: isClientReady,
            uptimeText: `${botHours}h ${botMinutes}m`,
            ramUsageText: `${usedMemMB} MB / ${totalMemMB} MB`,
            nodeVersion: process.version
        });
    }, 5000);

    server.listen(PORT, () => {
        console.log(`\n🌐 Web Dashboard is running on http://localhost:${PORT}`);
    });
}

module.exports = { startWebServer };
