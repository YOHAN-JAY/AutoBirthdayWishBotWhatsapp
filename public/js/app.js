const socket = io();

// UI Elements
const statusIndicator = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const qrContainer = document.getElementById('qr-container');
const qrImg = document.getElementById('qrcode');

const uptimeEl = document.getElementById('uptime');
const ramUsageEl = document.getElementById('ramUsage');
const nodeVersionEl = document.getElementById('nodeVersion');

// Tabs Logic
const navLinks = document.querySelectorAll('.nav-links li');
const tabContents = document.querySelectorAll('.tab-content');

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        // Remove active class from all
        navLinks.forEach(l => l.classList.remove('active'));
        tabContents.forEach(t => t.classList.remove('active'));

        // Add active class to clicked
        link.classList.add('active');
        const tabId = link.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
    });
});

// Socket Events
socket.on('connect', () => {
    console.log('Connected to Web Server');
});

socket.on('bot_status', (data) => {
    // Update Connection Status
    if (data.isReady) {
        statusIndicator.classList.add('online');
        statusText.textContent = 'Bot Online';
        qrContainer.classList.add('hidden');
    } else {
        statusIndicator.classList.remove('online');
        statusText.textContent = 'Disconnected / Waiting';
    }

    // Update Stats
    uptimeEl.textContent = data.uptimeText;
    ramUsageEl.textContent = data.ramUsageText;
    nodeVersionEl.textContent = data.nodeVersion;
});

// Group Roster Online Events
socket.on('participant_presence', (data) => {
    const card = document.getElementById(`roster-user-${data.id}`);
    if (card) {
        if (data.isOnline) {
            card.classList.add('is-online');
        } else {
            card.classList.remove('is-online');
        }
    }
});

socket.on('qr', (qrData) => {
    // Show QR Container
    qrContainer.classList.remove('hidden');
    // Use an external API to generate the QR image from the raw text data
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrData)}`;
});

// Form Handlers
const quizForm = document.getElementById('quizForm');
const quizResult = document.getElementById('quizResult');

quizForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const question = document.getElementById('quizQuestion').value;
    const timer = document.getElementById('quizTimer').value;
    const optInputs = document.querySelectorAll('.opt-input');
    
    let options = [];
    optInputs.forEach(input => {
        if(input.value.trim() !== '') {
            options.push(input.value.trim());
        }
    });

    if (options.length < 2) {
        quizResult.className = 'form-feedback error';
        quizResult.innerHTML = 'You must provide at least 2 options.';
        return;
    }

    // Check if one has *
    const hasCorrect = options.some(opt => opt.startsWith('*'));
    if (!hasCorrect) {
        quizResult.className = 'form-feedback error';
        quizResult.innerHTML = 'You must prefix the correct option with an asterisk (*).';
        return;
    }

    // Construct the command string to send to the bot backend
    let commandString = `/quiz ${timer} ${question}\n${options.join('\n')}`;

    try {
        const response = await fetch('/api/quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: commandString })
        });
        
        const data = await response.json();
        
        if (data.success) {
            quizResult.className = 'form-feedback success';
            quizResult.innerHTML = 'Quiz broadcasted successfully to the group!';
            quizForm.reset();
        } else {
            quizResult.className = 'form-feedback error';
            quizResult.innerHTML = data.error || 'Failed to start quiz.';
        }
    } catch (e) {
        quizResult.className = 'form-feedback error';
        quizResult.innerHTML = 'Failed to connect to server.';
    }
});

const announceForm = document.getElementById('announceForm');
const announceResult = document.getElementById('announceResult');

announceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const text = document.getElementById('announceText').value;

    try {
        const response = await fetch('/api/announce', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });
        
        const data = await response.json();
        
        if (data.success) {
            announceResult.className = 'form-feedback success';
            announceResult.innerHTML = 'Announcement sent successfully!';
            announceForm.reset();
        } else {
            announceResult.className = 'form-feedback error';
            announceResult.innerHTML = data.error || 'Failed to send announcement.';
        }
    } catch (e) {
        announceResult.className = 'form-feedback error';
        announceResult.innerHTML = 'Failed to connect to server.';
    }
});

// Logout Handler
const logoutBtn = document.getElementById('logoutBtn');
const logoutFeedback = document.getElementById('logoutFeedback');

logoutBtn.addEventListener('click', async () => {
    const confirmLogout = confirm("Are you sure you want to log out the WhatsApp bot?\nThis will destroy the active session, but it will automatically try to generate a new QR code within a few seconds.");
    if (!confirmLogout) return;

    logoutBtn.disabled = true;
    logoutBtn.textContent = 'Logging out...';

    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            logoutFeedback.className = 'form-feedback success';
            logoutFeedback.innerHTML = 'Logged out successfully! Waiting for new Auth Session...';
        } else {
            logoutFeedback.className = 'form-feedback error';
            logoutFeedback.innerHTML = data.error || 'Failed to logout.';
            logoutBtn.disabled = false;
            logoutBtn.textContent = 'Log Out Device';
        }
    } catch (e) {
        logoutFeedback.className = 'form-feedback error';
        logoutFeedback.innerHTML = 'Failed to connect to server.';
        logoutBtn.disabled = false;
        logoutBtn.textContent = 'Log Out Device';
    }
});

// --- Birthday Management ---
let birthdaysData = [];

async function fetchReminders() {
    const list = document.getElementById('remindersList');
    try {
        const res = await fetch('/api/reminders');
        const data = await res.json();
        
        list.innerHTML = '';
        
        if (data.today.length > 0) {
            data.today.forEach(name => {
                list.innerHTML += `<li><span class="badge" style="background:var(--success);">Today</span> ${name}'s Birthday! 🎉</li>`;
            });
        }
        if (data.tomorrow.length > 0) {
            data.tomorrow.forEach(name => {
                list.innerHTML += `<li><span class="badge" style="background:#f59e0b;">Tomorrow</span> ${name}'s Birthday!</li>`;
            });
        }
        
        if (data.today.length === 0 && data.tomorrow.length === 0) {
            let monthText = 'No birthdays today or tomorrow.';
            if (data.thisMonth.length > 0) {
                monthText += ` (${data.thisMonth.length} later this month)`;
            }
            list.innerHTML = `<li style="color:var(--text-muted); font-weight:normal;">${monthText}</li>`;
        }
    } catch(e) {
        list.innerHTML = `<li style="color:var(--danger);">Failed to load reminders.</li>`;
    }
}

async function fetchBirthdays() {
    const tbody = document.getElementById('birthdaysTableBody');
    try {
        const res = await fetch('/api/birthdays');
        birthdaysData = await res.json();
        renderBirthdaysTable();
        renderCharts();
    } catch(e) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:var(--danger);text-align:center;">Failed to load data.</td></tr>`;
    }
}

function renderBirthdaysTable() {
    const tbody = document.getElementById('birthdaysTableBody');
    tbody.innerHTML = '';
    
    if(birthdaysData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No birthdays found.</td></tr>`;
        return;
    }
    
    birthdaysData.forEach((b, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">${b.name}</td>
            <td>${b.year}-${b.month.padStart(2, '0')}-${b.day.padStart(2, '0')}</td>
            <td>${b.age}</td>
            <td>${b.gender}</td>
            <td><button class="btn danger" onclick="deleteBirthday(${index})">Delete</button></td>
        `;
        tbody.appendChild(tr);
    });
}

const addBirthdayForm = document.getElementById('addBirthdayForm');
const bdFormFeedback = document.getElementById('bdFormFeedback');

addBirthdayForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    bdFormFeedback.style.display = 'none';
    
    const newEntry = {
        year: document.getElementById('bdYear').value,
        month: document.getElementById('bdMonth').value,
        day: document.getElementById('bdDay').value,
        gender: document.getElementById('bdGender').value,
        age: document.getElementById('bdAge').value,
        name: document.getElementById('bdName').value.trim().toUpperCase() // convention seen in file
    };
    
    birthdaysData.push(newEntry);
    
    await saveBirthdays();
    addBirthdayForm.reset();
});

window.deleteBirthday = async function(index) {
    if(confirm(`Are you sure you want to remove ${birthdaysData[index].name} from the database?`)) {
        birthdaysData.splice(index, 1);
        await saveBirthdays();
    }
};

async function saveBirthdays() {
    const btn = addBirthdayForm.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    
    try {
        const response = await fetch('/api/birthdays', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ birthdays: birthdaysData })
        });
        const data = await response.json();
        
        if(data.success) {
            renderBirthdaysTable();
            fetchReminders(); // Refresh dashboard widget
            bdFormFeedback.className = 'form-feedback success';
            bdFormFeedback.innerHTML = 'Database updated successfully!';
            bdFormFeedback.style.display = 'block';
            setTimeout(() => bdFormFeedback.style.display = 'none', 3000);
        } else {
            bdFormFeedback.className = 'form-feedback error';
            bdFormFeedback.innerHTML = data.error || 'Failed to update database.';
            bdFormFeedback.style.display = 'block';
        }
    } catch(e) {
        bdFormFeedback.className = 'form-feedback error';
        bdFormFeedback.innerHTML = 'Network error saving database.';
        bdFormFeedback.style.display = 'block';
    }
    
    btn.disabled = false;
    btn.textContent = 'Add Person';
}

// --- Group Roster ---
async function fetchGroupMembers() {
    const container = document.getElementById('rosterContainer');
    try {
        const res = await fetch('/api/group_members');
        const members = await res.json();
        
        container.innerHTML = '';
        members.forEach(m => {
            container.innerHTML += `
                <div class="roster-card" id="roster-user-${m.id}">
                    <div class="online-indicator"></div>
                    <img class="roster-dp" src="${m.dp}" alt="${m.name}" onerror="this.src='https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=100&auto=format&fit=crop'">
                    <span class="roster-name">${m.name}</span>
                </div>
            `;
        });
    } catch(e) {
        container.innerHTML = `<span style="color:var(--danger)">Failed to load members.</span>`;
    }
}

// --- Data Visualization (Chart.js) ---
let monthChartInstance = null;
let genderChartInstance = null;

function renderCharts() {
    // Tally by month
    const monthsArray = Array(12).fill(0);
    let males = 0;
    let females = 0;

    birthdaysData.forEach(b => {
        const mIdx = parseInt(b.month, 10) - 1;
        if (mIdx >= 0 && mIdx < 12) monthsArray[mIdx]++;
        
        if (b.gender.toLowerCase() === 'male') males++;
        else if (b.gender.toLowerCase() === 'female') females++;
    });

    const mCtx = document.getElementById('monthChart');
    const gCtx = document.getElementById('genderChart');

    if (!mCtx || !gCtx) return;

    if (monthChartInstance) monthChartInstance.destroy();
    if (genderChartInstance) genderChartInstance.destroy();

    monthChartInstance = new Chart(mCtx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Birthdays',
                data: monthsArray,
                backgroundColor: 'rgba(99, 102, 241, 0.7)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    genderChartInstance = new Chart(gCtx, {
        type: 'doughnut',
        data: {
            labels: ['Male', 'Female'],
            datasets: [{
                data: [males, females],
                backgroundColor: ['#3b82f6', '#ec4899'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Initial Fetch
fetchReminders();
fetchBirthdays();
fetchGroupMembers();
