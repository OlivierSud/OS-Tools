(function(){
  // generateHeightmap uses globals defined in main.js: sourceImage, sourceCanvas, heightmapCanvas, heightmapCtx, hm* sliders
  window.generateHeightmap = function() {
    if (!window.sourceImage || !window.sourceImage.src) return;
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    heightmapCtx.clearRect(0,0,width,height);

    if (enableHeightmap && enableHeightmap.checked) {
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
    } else {
      heightmapCtx.drawImage(sourceImage,0,0);
    }

    // notify downstream
    if (window.generateNormalMap) window.generateNormalMap();
    if (window.debouncedGenerateRoughness) window.debouncedGenerateRoughness();
  };
})();
