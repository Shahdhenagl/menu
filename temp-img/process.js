const Jimp = require('jimp');

async function main() {
  try {
    console.log("Reading image...");
    const image = await Jimp.read('../public/logo.png');
    
    console.log("Processing pixels...");
    // Make white pixels transparent
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      
      // If the pixel is close to white
      if (red > 235 && green > 235 && blue > 235) {
        this.bitmap.data[idx + 3] = 0; // Set alpha to 0 (transparent)
      }
    });

    console.log("Saving image...");
    await image.writeAsync('../public/logo_transparent.png');
    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
