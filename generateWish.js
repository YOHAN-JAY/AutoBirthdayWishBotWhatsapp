const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

// Register the provided font
GlobalFonts.registerFromPath(path.join(__dirname, 'D-DINCONDENSED.TTF'), 'DDIN');

/**
 * Generates a Birthday Wish Image
 * @param {string} userName - The name to display on the card (ex: "JOHN DOE")
 * @param {string|Buffer} userImageSource - Path or Buffer to the user's profile image
 * @param {string} outputPath - Where to save the generated image
 */
async function generateBirthdayWish(userName, userImageSource, outputPath) {
  try {
    // 1. Load Background Image
    const bgPath = path.join(__dirname, 'Background.jpg');
    const bgImage = await loadImage(bgPath);
    
    // Canvas dimensions setup based on background size
    const width = bgImage.width;
    const height = bgImage.height;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw Background
    ctx.drawImage(bgImage, 0, 0, width, height);

    // 2. Load and Draw User Profile Picture (Circular with Border)
    const userImage = await loadImage(userImageSource);
    
    const cx = 1024; // Center X
    const cy = 750;  // Center Y
    const outerRadius = 370;
    const innerRadius = 350; // giving a 20px border
    const borderColor = '#214CFB'; // Vibrant blue found from analysis

    // Draw Blue Border
    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = borderColor;
    ctx.fill();

    // Draw Profile Image (clipped to circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2, true);
    ctx.clip();
    
    // Calculate aspect ratio / fit for the user image
    const imgRatio = userImage.width / userImage.height;
    let drawW = innerRadius * 2;
    let drawH = innerRadius * 2;
    let drawX = cx - innerRadius;
    let drawY = cy - innerRadius;
    
    if (imgRatio > 1) { // Landscape
      drawW = drawH * imgRatio;
      drawX = cx - (drawW / 2);
    } else { // Portrait or square
      drawH = drawW / imgRatio;
      drawY = cy - (drawH / 2);
    }

    ctx.drawImage(userImage, drawX, drawY, drawW, drawH);
    ctx.restore();

    // 3. Draw the Name Text
    const textY = 2030; // Adjusted based on original
    let mainName = userName.toUpperCase();

    // Setup for large background text outline (Watermark-like)
    ctx.font = '500px "DDIN"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    
    // Light gray stroke for background
    ctx.strokeStyle = 'rgba(230, 230, 230, 0.4)';
    ctx.lineWidth = 10;
    ctx.strokeText(mainName, cx, textY - 30);
    
    // Solid fill for the background text to hide balloons slightly
    ctx.fillStyle = 'rgba(250, 250, 250, 0.2)'; 
    ctx.fillText(mainName, cx, textY - 30);

    // --- Main foreground Name ---
    ctx.font = '300px "DDIN"';
    ctx.lineJoin = 'round';
    
    // 1. Draw the white stroke WITH the drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 10;

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 12;
    ctx.strokeText(mainName, cx, textY);
    
    // 2. Clear shadow so the inner fill is clean and flat
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 3. Draw the solid blue fill on top
    ctx.fillStyle = '#214CFB'; // Dynamic blue matching border
    ctx.fillText(mainName, cx, textY);


    // 4. Save to Output file
    const buffer = await canvas.encode('jpeg', 95);
    fs.writeFileSync(outputPath, buffer);
    console.log(`Birthday wish image successfully generated at: ${outputPath}`);

  } catch (error) {
    console.error('Error generating birthday wish:', error);
  }
}

// Export the module
module.exports = {
  generateBirthdayWish
};

// Allow running from command line for quick testing
if (require.main === module) {
  const args = process.argv.slice(2);
  const name = args[0] || 'JOHN DOE';
  // Use background as a placeholder for the profile image if none provided
  const imgPath = args[1] || path.join(__dirname, 'Background.jpg');
  const outFile = args[2] || path.join(__dirname, 'test_output.jpg');
  
  generateBirthdayWish(name, imgPath, outFile);
}
