const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { generateBirthdayWish } = require('./generateWish');
const { getBirthdays } = require('./birthdayChecker');

// Find a suitable local browser (Chrome or Edge) since we skipped downloading Chromium due to network errors
const chromePaths = [
    // Windows Paths
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    // Linux Paths
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
];
const localExecutable = chromePaths.find(p => fs.existsSync(p));

if (!localExecutable) {
    console.error('Could not find Google Chrome or Microsoft Edge installed on your PC! Please install Chrome.');
    process.exit(1);
}

// Initialize the WhatsApp Client
// LocalAuth saves the session so you don't need to scan the QR code every time
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: localExecutable, // Use existing system browser!
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Event: Emit QR code to the terminal for scanning
client.on('qr', (qr) => {
    console.log('\n--- SCAN THIS QR CODE WITH YOUR WHATSAPP ---');
    qrcode.generate(qr, { small: true });
});

// Event: Client successfully authenticated and ready
client.on('ready', async () => {
    console.log('\n✅ WhatsApp AutoBirthdayWishBot is READY and actively listening for messages!');

    // Send a message to the bot owner's "Message Yourself" chat
    try {
        const myChatId = client.info.wid._serialized;
        await client.sendMessage(myChatId, '🎉 *AutoBirthdayWishBot* is successfully connected and online!\n\nSend a picture here with the caption `/wish <Name>` to quickly generate a birthday card.');
        console.log('-> Sent startup notification to your self-chat!');
    } catch (e) {
        console.error('Failed to send startup notification to self-chat:', e);
    }

    // --- Daily Automatic Birthday Reminder ---
    // Schedule a job to run every day at 05:00 AM (GMT+5:30)
    console.log('🗓️ Scheduling Daily Birthday Reminder Cron Job for 05:00 AM (Asia/Colombo)...');
    cron.schedule('0 5 * * *', async () => {
        // Evaluate the date actively in the GMT+5:30 timezone to prevent server timezone mismatch bugs
        const colomboTimeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" });
        const targetDate = new Date(colomboTimeStr);

        const { today, tomorrow } = getBirthdays(targetDate);
        
        const mainGroupId = '120363388371926819@g.us';

        // 1. Send reminders for Tomorrow's birthdays
        if (tomorrow.length > 0) {
            const tmrwNames = tomorrow.join(', ');
            try {
                await client.sendMessage(mainGroupId, `⚠️ *REMINDER!* Tomorrow is the birthday of: *${tmrwNames}!*\n\nAdmins, please prepare a photo and run \`/wish <Name>\` tomorrow!`);
                console.log(`[Cron] Sent Tomorrow reminder in group for: ${tmrwNames}`);
            } catch (err) { }
        }

        // 2. Send reminders for Today's birthdays
        if (today.length > 0) {
            const todayNames = today.join(', ');
            try {
                await client.sendMessage(mainGroupId, `🎉 *🎂 HAPPY BIRTHDAY ALERT! 🎂*\n\nToday is the birthday of: *${todayNames}!*\n\nAdmins: Don't forget to generate their wishing card today using the \`/wish\` command!`);
                console.log(`[Cron] Sent Today reminder in group for: ${todayNames}`);
            } catch (err) { }
        }
    }, {
        scheduled: true,
        timezone: "Asia/Colombo"
    });
    // -----------------------------------------
});

// Event: Message Handler (Listens to both incoming messages and messages you send yourself)
client.on('message_create', async (msg) => {
    // We only care about messages that contain the /wish command
    const content = msg.body.trim();
    
    // --- Utility: Get Group/Chat ID ---
    if (content.toLowerCase() === '/getid') {
        const chat = await msg.getChat();
        return msg.reply(`The ID for this chat is: *${chat.id._serialized}*`);
    }
    // ----------------------------------

    // --- Command: Show Upcoming Birthdays ---
    if (content.toLowerCase() === '/birthdays' || content.toLowerCase() === '/upcoming' || content.toLowerCase() === '/reminders') {
        // Enforce the calculation to match GMT+5:30
        const colomboTimeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Colombo" });
        const date = new Date(colomboTimeStr);

        const { today, tomorrow, thisMonth } = getBirthdays(date);
        const monthName = date.toLocaleString('default', { month: 'long' });

        let replyText = `🗓️ *Birthdays in ${monthName}:*\n\n`;
        
        if (today.length > 0) {
            replyText += `*🎂 TODAY:* ${today.join(', ')}\n`;
        }
        if (tomorrow.length > 0) {
            replyText += `*⚠️ TOMORROW:* ${tomorrow.join(', ')}\n`;
        }

        replyText += `\n*All Birthdays this Month:*\n`;
        if (thisMonth.length === 0) {
            replyText += `_No birthdays found in this month._`;
        } else {
            thisMonth.forEach(b => {
                const marker = (b.day === date.getDate()) ? '🎂 ' : '';
                replyText += `- ${b.day} ${monthName}: ${marker}*${b.name}*\n`;
            });
        }

        return msg.reply(replyText.trim());
    }
    // ----------------------------------------

    // --- Command: Show System Info ---
    if (content.toLowerCase() === '/system' || content.toLowerCase() === '/sysinfo' || content.toLowerCase() === '/info') {
        const os = require('os');
        
        const totalMemMB = Math.floor(os.totalmem() / (1024 * 1024));
        const freeMemMB = Math.floor(os.freemem() / (1024 * 1024));
        const usedMemMB = totalMemMB - freeMemMB;
        
        const botUptime = process.uptime();
        const botHours = Math.floor(botUptime / 3600);
        const botMinutes = Math.floor((botUptime % 3600) / 60);
        
        const sysUptime = os.uptime();
        const sysHours = Math.floor(sysUptime / 3600);
        const sysMinutes = Math.floor((sysUptime % 3600) / 60);

        let replyText = `💻 *System Information*\n\n`;
        replyText += `*Platform:* ${os.type()} ${os.release()} (${os.arch()})\n`;
        if (os.cpus() && os.cpus().length > 0) {
            replyText += `*CPU:* ${os.cpus()[0].model}\n`;
        }
        replyText += `*RAM:* ${usedMemMB} MB / ${totalMemMB} MB\n`;
        replyText += `*System Uptime:* ${sysHours}h ${sysMinutes}m\n`;
        replyText += `*Bot Uptime:* ${botHours}h ${botMinutes}m\n`;
        replyText += `*Node.js:* ${process.version}`;

        return msg.reply(replyText.trim());
    }
    // ---------------------------------

    if (content.toLowerCase().startsWith('/wish ')) {

        // --- Authorization & Allowed Chats Check ---
        const chat = await msg.getChat();
        
        // Restrict bot to the specific SE Batch 06 Group AND your self-chat
        const allowedGroupId = '120363388371926819@g.us';
        const myChatId = client.info.wid._serialized;
        
        if (chat.id._serialized !== allowedGroupId && chat.id._serialized !== myChatId) {
            return msg.reply('❌ The `/wish` command is not allowed in this chat!');
        }

        if (chat.isGroup) {
            // In groups, msg.author identifies the specific user who sent the message
            const senderId = msg.author || msg.from;
            // Locate the user in the group participant list
            const participant = chat.participants.find(p => p.id._serialized === senderId);

            // Allow execution if it's the bot owner running it OR if the participant is a group admin/superadmin
            const isBotOwner = msg.fromMe;
            const isAdmin = participant && (participant.isAdmin || participant.isSuperAdmin);

            if (!isBotOwner && !isAdmin) {
                return msg.reply('❌ Sorry, only group admins can use the `/wish` command!');
            }
        }
        // ---------------------------------------

        const nameToWish = content.substring(6).trim(); // Extract the name

        if (!nameToWish) {
            return msg.reply('Please provide a name! Example: /wish JOHN DOE');
        }

        // Check if the message actually has an image attached
        if (msg.hasMedia) {
            try {
                // Let the user know we're working on it
                await msg.reply(`Generating birthday wish for *${nameToWish}*... Please wait ⏳`);

                // Download the media (profile picture attached to the message)
                const media = await msg.downloadMedia();

                if (!media.mimetype.startsWith('image/')) {
                    return msg.reply('The attached media must be an image!');
                }

                // Convert base64 media data to a Node Buffer, which generateWish.js can handle
                const imageBuffer = Buffer.from(media.data, 'base64');

                // Define where to temporarily save our output file
                const timestamp = Date.now();
                const outputFilePath = path.join(__dirname, `temp_wish_${timestamp}.jpg`);

                // Call our logic to build the image
                await generateBirthdayWish(nameToWish, imageBuffer, outputFilePath);

                // Load the generated file into a MessageMedia object
                const generatedMedia = MessageMedia.fromFilePath(outputFilePath);

                // Reply to the user with the generated birthday image!
                await msg.reply(generatedMedia, chat.id._serialized, {
                    caption: `🎉 _*Happy Birthday, ${nameToWish}*_ 🎉

May your day be filled with joy, laughter, and all the things you love. 🎈🌟

Here’s to another year of incredible achievements and memorable moments. 🎊🥂
> _SE Batch 06_` });

                // Cleanup: Delete the generated file from the server so we don't clutter the disk
                fs.unlinkSync(outputFilePath);

            } catch (error) {
                console.error('Error generating or sending wish:', error);
                await msg.reply('An error occurred while generating the birthday wish. 😔');
            }
        } else {
            // Provided the command, but no image attached
            return msg.reply('Please attach an image (photo) with the caption `/wish <Name>` so I can build the card!');
        }
    }
});

// Start the client
console.log('Initializing WhatsApp Client... This might take a few moments.');
client.initialize();
