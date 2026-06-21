const Jimp = require('jimp');

async function fix() {
  const orig = await Jimp.read('../public/logo.png');
  const w = orig.bitmap.width;
  const h = orig.bitmap.height;
  
  // Create a new image with a transparent background
  const out = new Jimp(w, h, 0x00000000);
  
  for(let y = 0; y < h; y++) {
    for(let x = 0; x < w; x++) {
      const hex = orig.getPixelColor(x, y);
      const rgba = Jimp.intToRGBA(hex);
      
      // if it's very bright/white, keep it transparent
      if (rgba.r > 240 && rgba.g > 240 && rgba.b > 240) {
        // leave transparent
      } else {
        // copy pixel with full opacity
        const opaqueHex = Jimp.rgbaToInt(rgba.r, rgba.g, rgba.b, 255);
        out.setPixelColor(opaqueHex, x, y);
      }
    }
  }
  
  await out.writeAsync('../public/logo.png');
  console.log("Fixed!");
}
fix();
