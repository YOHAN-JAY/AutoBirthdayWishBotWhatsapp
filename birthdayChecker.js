const fs = require('fs');
const path = require('path');

/**
 * Reads BatchBirthdayList.txt and returns birthdays happening today, tomorrow, or this month.
 * Extracted data format: Year\tMonth\tDay\tGender\tAge\tCallingName
 */
function getBirthdays(targetDate = new Date()) {
    const filePath = path.join(__dirname, 'BatchBirthdayList.txt');
    
    if (!fs.existsSync(filePath)) {
        console.error(`Error: Could not find ${filePath}`);
        return { today: [], tomorrow: [], thisMonth: [] };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    
    // Skip the first row (headers) and skip empty lines
    const dataLines = lines.slice(1).filter(line => line.trim().length > 0);
    
    // Establish logic
    const targetMonth = targetDate.getMonth() + 1; // getMonth() is 0-indexed (Jan=0), so add 1
    const targetDay = targetDate.getDate();
    
    // Calculate tomorrow's month/day safely considering leap years/end of month
    const tomorrowDate = new Date(targetDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tmrwMonth = tomorrowDate.getMonth() + 1;
    const tmrwDay = tomorrowDate.getDate();

    const todayBirthdays = [];
    const tomorrowBirthdays = [];
    const upcomingMonthBirthdays = []; // Holds all birthdays strictly for the current month

    dataLines.forEach(line => {
        // Splitting by \t (tab) character based on the text file format
        const parts = line.split('\t');
        if (parts.length < 6) return; // Skip broken rows

        const monthStr = parts[1];
        const dayStr = parts[2];
        const nameStr = parts[5];

        if (!monthStr || !dayStr || !nameStr) return;
        
        const month = parseInt(monthStr.trim(), 10);
        const day = parseInt(dayStr.trim(), 10);
        const callingName = nameStr.trim();
        
        // Is it today?
        if (month === targetMonth && day === targetDay) {
            todayBirthdays.push(callingName);
        }
        
        // Is it tomorrow?
        if (month === tmrwMonth && day === tmrwDay) {
            tomorrowBirthdays.push(callingName);
        }
        
        // Is it this month?
        if (month === targetMonth) {
            upcomingMonthBirthdays.push({ name: callingName, day });
        }
    });

    // Sort the month list chronologically by day
    upcomingMonthBirthdays.sort((a, b) => a.day - b.day);

    return {
        today: todayBirthdays,
        tomorrow: tomorrowBirthdays,
        thisMonth: upcomingMonthBirthdays
    };
}

module.exports = {
    getBirthdays
};
