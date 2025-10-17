(function(){
  window.getPixel = function(imageData, x, y) {
    const w = imageData.width, h = imageData.height;
    let xr = x % w; if (xr < 0) xr += w;
    let yr = y % h; if (yr < 0) yr += h;
    const i = (yr * w + xr) * 4;
    return imageData.data[i] * 0.299 + imageData.data[i+1] * 0.587 + imageData.data[i+2] * 0.114;
  };

  window.generateNormalMap = function() {
    if (!heightmapCanvas || !heightmapCanvas.width) return;
    const width = heightmapCanvas.width, height = heightmapCanvas.height;
    const intensityRaw = parseFloat(intensity.value)/100;
    const strength = Math.pow(intensityRaw,2)*2.5;
    const sStr = parseFloat(smallDetails.value);
    const mStr = parseFloat(mediumDetails.value);
    const lStr = parseFloat(largeDetails.value);

    const maxBlur = 4;
    const blurAmount = 1.0 - sStr;
    const blurRadius = maxBlur * Math.pow(blurAmount,2);

    sourceCtx.clearRect(0,0,width,height);
    sourceCtx.filter = `blur(${blurRadius}px)`;
    sourceCtx.drawImage(heightmapCanvas,0,0);
    sourceCtx.filter = 'none';

    const srcData = sourceCtx.getImageData(0,0,width,height);
    const dest = ctx.createImageData(width,height);
    const d = dest.data;

    // Vérifie si la case "inverser la normal map" est cochée
    const invertAll = window.invertNormal && window.invertNormal.checked;

    for (let y=0;y<height;y++){
      for (let x=0;x<width;x++){
        const n_x1 = getPixel(srcData, x-1, y), n_x2 = getPixel(srcData, x+1, y);
        const n_y1 = getPixel(srcData, x, y-1), n_y2 = getPixel(srcData, x, y+1);
        const m_x1 = getPixel(srcData, x-2, y), m_x2 = getPixel(srcData, x+2, y);
        const m_y1 = getPixel(srcData, x, y-2), m_y2 = getPixel(srcData, x, y+2);
        const l_x1 = getPixel(srcData, x-4, y), l_x2 = getPixel(srcData, x+4, y);
        const l_y1 = getPixel(srcData, x, y-4), l_y2 = getPixel(srcData, x, y+4);

        let dx = (n_x2 - n_x1) * sStr + (m_x2 - m_x1) * mStr + (l_x2 - l_x1) * lStr;
        let dy = (n_y2 - n_y1) * sStr + (m_y2 - m_y1) * mStr + (l_y2 - l_y1) * lStr;

        // Calcul du vecteur normal
        let normal = { x: -dx * strength, y: -dy * strength, z: 1.0 };

        // ✅ Inversion complète du vecteur si demandé
        if (invertAll) {
          normal.x = -normal.x;
          normal.y = -normal.y;
          normal.z = -normal.z;
        }

        // Normalisation
        const len = Math.sqrt(normal.x*normal.x + normal.y*normal.y + normal.z*normal.z);
        if (len>0){ normal.x/=len; normal.y/=len; normal.z/=len; }

        let r = (normal.x*0.5 + 0.5)*255;
        let g = (normal.y*0.5 + 0.5)*255;
        let b = (normal.z*0.5 + 0.5)*255;

        // Inversions individuelles existantes
        if (invertR && invertR.checked) r = 255 - r;
        if (invertG && invertG.checked) g = 255 - g;
        if (invertB && invertB.checked) b = 255 - b;

        const idx = (y*width + x)*4;
        d[idx]=r; d[idx+1]=g; d[idx+2]=b; d[idx+3]=255;
      }
    }

    ctx.putImageData(dest,0,0);
    if (viewHeightmapBtn && viewHeightmapBtn.classList.contains('active')) {
      mainPreviewImage.src = heightmapCanvas.toDataURL();
    }
    if (window.updateBabylonTextures) updateBabylonTextures();
    if (window.debouncedGenerateRoughness) window.debouncedGenerateRoughness();
  };
})();
