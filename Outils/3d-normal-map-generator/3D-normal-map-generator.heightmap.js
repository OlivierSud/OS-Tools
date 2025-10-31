(function(){
  // generateHeightmap uses globals defined in main.js: sourceImage, sourceCanvas, heightmapCanvas, heightmapCtx, hm* sliders
  window.generateHeightmap = function () {
    if (!window.sourceImage || !window.sourceImage.src) return;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    heightmapCtx.clearRect(0,0,width,height);

    // Decide mode: 'auto' -> original pipeline; 'edges' -> sobel edge-detection; 'source' -> draw source image
    const mode = (document.getElementById('heightmapMode') && document.getElementById('heightmapMode').value) || 'auto';
    if (mode === 'auto') {
       const largeShapesStrength = parseFloat(hmLargeShapes.value);
       const mediumDetailsStrength = parseFloat(hmMediumDetails.value);
       const fineDetailsStrength = parseFloat(hmFineDetails.value);
       const intensity = parseFloat(hmIntensity.value);
       const smoothing = parseFloat(hmSmoothing.value);
 
       // temp canvases (set willReadFrequently)
       const tempCanvas1 = document.createElement('canvas');
       tempCanvas1.width = width; tempCanvas1.height = height;
       const tempCtx1 = tempCanvas1.getContext('2d', { willReadFrequently: true });
 
       const tempCanvas2 = document.createElement('canvas');
       tempCanvas2.width = width; tempCanvas2.height = height;
       const tempCtx2 = tempCanvas2.getContext('2d', { willReadFrequently: true });
 
       // fine layer
       tempCtx1.filter = 'grayscale(1)';
       tempCtx1.drawImage(sourceImage,0,0);
       tempCtx1.filter = 'none';
       const fineData = tempCtx1.getImageData(0,0,width,height).data;
 
       // medium blur
       tempCtx2.filter = 'blur(2px)';
       tempCtx2.drawImage(tempCanvas1,0,0);
       tempCtx2.filter = 'none';
       const mediumData = tempCtx2.getImageData(0,0,width,height).data;
 
       // large blur
       tempCtx1.filter = 'blur(8px)';
       tempCtx1.drawImage(tempCanvas1,0,0);
       tempCtx1.filter = 'none';
       const largeData = tempCtx1.getImageData(0,0,width,height).data;
 
       const combinedValues = new Float32Array(width*height);
       let min = Infinity, max = -Infinity;
       for (let i=0; i<fineData.length; i+=4) {
         const v_fine = fineData[i];
         const v_medium = mediumData[i];
         const v_large = largeData[i];
         const largeComponent = v_large * largeShapesStrength;
         const mediumComponent = (v_medium - v_large) * mediumDetailsStrength;
         const fineComponent = (v_fine - v_medium) * fineDetailsStrength;
         const finalValue = largeComponent + mediumComponent + fineComponent;
         combinedValues[i/4] = finalValue;
         if (finalValue < min) min = finalValue;
         if (finalValue > max) max = finalValue;
       }
 
       const finalImageData = heightmapCtx.createImageData(width, height);
       const finalData = finalImageData.data;
       const range = max - min;
       for (let i=0;i<combinedValues.length;i++){
         let normalized = 0;
         if (range > 0.001) normalized = 255 * (combinedValues[i] - min) / range;
         const j = i*4;
         finalData[j] = finalData[j+1] = finalData[j+2] = normalized;
         finalData[j+3] = 255;
       }
 
       // intensity & clamp
       for (let i=0;i<finalData.length;i+=4){
         let val = finalData[i];
         val = ((val/255 - 0.5) * intensity + 0.5) * 255;
         val = Math.max(0, Math.min(255, val));
         finalData[i] = finalData[i+1] = finalData[i+2] = val;
       }
 
       heightmapCtx.putImageData(finalImageData, 0, 0);
       if (smoothing > 0) {
         tempCtx1.clearRect(0,0,width,height);
         tempCtx1.drawImage(heightmapCanvas,0,0);
         heightmapCtx.clearRect(0,0,width,height);
         heightmapCtx.filter = `blur(${smoothing}px)`;
         heightmapCtx.drawImage(tempCanvas1,0,0);
         heightmapCtx.filter = 'none';
       }
    } else if (mode === 'edges') {
      // Edge detection (Sobel) on the source image -> heightmap
      try {
        // draw source to temp canvas and get grayscale
        const tmp = document.createElement('canvas'); tmp.width = width; tmp.height = height;
        const tctx = tmp.getContext('2d', { willReadFrequently: true });
        tctx.drawImage(sourceImage,0,0,width,height);
        const src = tctx.getImageData(0,0,width,height);
        const srcd = src.data;
        const out = tctx.createImageData(width,height); // reuse tctx for ImageData creation
        const outd = out.data;
        // Sobel kernels
        const kxWeights = [[-1,0,1],[-2,0,2],[-1,0,1]];
        const kyWeights = [[-1,-2,-1],[0,0,0],[1,2,1]];
        for (let y=0; y<height; y++){
          for (let x=0; x<width; x++){
            let gx=0, gy=0;
            // iterate 3x3
            for (let ky=-1; ky<=1; ky++){
              for (let kx=-1; kx<=1; kx++){
                const sx = x + kx, sy = y + ky;
                // clamp
                const cx = Math.max(0, Math.min(width-1, sx));
                const cy = Math.max(0, Math.min(height-1, sy));
                const si = (cy*width + cx) * 4;
                const gray = Math.round(0.299*srcd[si] + 0.587*srcd[si+1] + 0.114*srcd[si+2]);
                gx += gray * kxWeights[ky+1][kx+1];
                gy += gray * kyWeights[ky+1][kx+1];
              }
            }
            const mag = Math.sqrt(gx*gx + gy*gy);
            const idx = (y*width + x)*4;
            outd[idx] = outd[idx+1] = outd[idx+2] = mag > 255 ? 255 : Math.round(mag);
            outd[idx+3] = 255;
          }
        }

        // Apply levels sliders (black/gamma/white) if present
        const black = parseInt(document.getElementById('edgeLevelsBlack')?.value || 0, 10);
        const white = parseInt(document.getElementById('edgeLevelsWhite')?.value || 255, 10);
        const gamma = parseFloat(document.getElementById('edgeLevelsGamma')?.value || 1.0);
        const threshold = parseInt(document.getElementById('edgeThreshold')?.value || 0, 10);
        const invert = !!document.getElementById('invertEdges')?.checked;

        // Map using levels, then apply threshold/inversion to produce final ImageData BEFORE blur
        for (let i=0;i<outd.length;i+=4){
          let v = outd[i];
          // normalize using levels
          let n = (v - black) / ((white - black) || 1);
          n = Math.max(0, Math.min(1, n));
          n = Math.pow(n, 1.0 / (gamma || 1.0));
          let mapped = Math.round(n * 255);

          // apply threshold/inversion on mapped value (final result)
          if (threshold > 0) {
            const v2 = mapped >= threshold ? 255 : 0;
            mapped = invert ? 255 - v2 : v2;
          } else if (invert) {
            mapped = 255 - mapped;
          }

          outd[i] = outd[i+1] = outd[i+2] = mapped;
          outd[i+3] = 255;
        }

        // Put to a temporary canvas (tmp2) containing the final (pre-blur) image
        const tmp2 = document.createElement('canvas'); tmp2.width = width; tmp2.height = height;
        const tctx2 = tmp2.getContext('2d');
        tctx2.putImageData(out, 0, 0);

        // Now draw tmp2 to heightmapCanvas, applying blur if requested (blur applies to final image)
        const edgeBlur = parseInt(document.getElementById('edgeBlur')?.value || 0, 10);
        heightmapCtx.clearRect(0,0,width,height);
        if (edgeBlur > 0) {
          try {
            heightmapCtx.filter = `blur(${edgeBlur}px)`;
            heightmapCtx.drawImage(tmp2, 0, 0);
            heightmapCtx.filter = 'none';
          } catch(e) {
            // if filter not supported, fallback to draw (no blur)
            heightmapCtx.drawImage(tmp2, 0, 0);
          }
        } else {
          heightmapCtx.drawImage(tmp2, 0, 0);
        }

      } catch(e){
        console.warn("Edge detection failed (CORS or memory):", e);
        // fallback: draw source grayscale
        try { heightmapCtx.drawImage(sourceImage,0,0); } catch(err){}
      }
    }
 
     // notify downstream
    if (window.generateNormalMap) window.generateNormalMap();
    if (window.debouncedGenerateRoughness) window.debouncedGenerateRoughness();
   };
})();
