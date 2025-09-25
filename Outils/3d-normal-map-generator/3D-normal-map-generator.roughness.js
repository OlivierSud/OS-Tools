(function(){
  window.applyLevels = function(v, black, gamma, white) {
    if (white <= black) return 0;
    let n = (v - black) / (white - black);
    n = Math.max(0, Math.min(1, n));
    n = Math.pow(n, 1.0 / gamma);
    return n;
  };

  window.generateRoughnessMap = function() {
    // ensure global canvases/context exist
    const rCanvas = window.roughnessCanvas || (window.roughnessCanvas = document.createElement('canvas'));
    const rCtx = window.roughnessCtx || (window.roughnessCtx = rCanvas.getContext('2d', { willReadFrequently: true }));
    if (!heightmapCanvas || !heightmapCanvas.width) return;
    const w = heightmapCanvas.width, h = heightmapCanvas.height;
    rCanvas.width = w; rCanvas.height = h;

    const src = heightmapCtx.getImageData(0,0,w,h).data;
    const out = rCtx.createImageData(w,h);
    const darkI = parseFloat( (window.roughDarkIntensity && window.roughDarkIntensity.value) || 1 );
    const lightI = parseFloat( (window.roughLightIntensity && window.roughLightIntensity.value) || 1 );
    const black = parseInt( (window.levelsBlack && window.levelsBlack.value) || 0, 10 );
    const white = parseInt( (window.levelsWhite && window.levelsWhite.value) || 255, 10 );
    const gamma = parseFloat( (window.levelsGamma && window.levelsGamma.value) || 1.0 );
    const inv = (window.invertRough && window.invertRough.checked);

    for (let i=0;i<src.length;i+=4){
      const lum = src[i];
      let n = applyLevels(lum, black, gamma, white);
      if (n < 0.5) n = (n / 0.5) * Math.max(0, darkI * 0.5);
      else n = 0.5 + ((n - 0.5) / 0.5) * Math.max(0, lightI * 0.5);
      n = Math.max(0, Math.min(1, n));
      if (inv) n = 1 - n;
      const v = Math.round(n * 255);
      out.data[i] = out.data[i+1] = out.data[i+2] = v;
      out.data[i+3] = 255;
    }
    rCtx.putImageData(out,0,0);

    // assign to material (prefer roughnessTexture)
    if (window.pbrMaterial) {
      try {
        if ('roughnessTexture' in window.pbrMaterial) {
          if (!window.pbrMaterial.roughnessTexture) {
            window.pbrMaterial.roughnessTexture = new BABYLON.DynamicTexture("roughnessTex", rCanvas, window.scene, false);
            window.roughnessDynamicTexture = window.pbrMaterial.roughnessTexture;
          } else {
            window.pbrMaterial.roughnessTexture.getContext().drawImage(rCanvas,0,0);
            window.roughnessDynamicTexture = window.pbrMaterial.roughnessTexture;
          }
        } else {
          if (!window.pbrMaterial.metallicTexture) {
            window.pbrMaterial.metallicTexture = new BABYLON.DynamicTexture("metallicRough", rCanvas, window.scene, false);
            window.roughnessDynamicTexture = window.pbrMaterial.metallicTexture;
          } else {
            window.pbrMaterial.metallicTexture.getContext().drawImage(rCanvas,0,0);
            window.roughnessDynamicTexture = window.pbrMaterial.metallicTexture;
          }
          if ('useRoughnessFromMetallicTextureGreen' in window.pbrMaterial) {
            window.pbrMaterial.useRoughnessFromMetallicTextureGreen = true;
          }
        }
      } catch(e) { console.warn("Assign roughness texture failed", e); }
    }

    if (window.updateBabylonTextures) updateBabylonTextures();

    // update preview if roughness view active
    try {
      if (window.viewRoughBtn && window.viewRoughBtn.classList.contains('active') && window.mainPreviewImage) {
        window.mainPreviewImage.src = rCanvas.toDataURL();
      }
    } catch(e){ /* ignore */ }
  };

})();
