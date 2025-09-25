(function(){
  window.applyLevels = function(v, black, gamma, white) {
    if (white <= black) return 0;
    let n = (v - black) / (white - black);
    n = Math.max(0, Math.min(1, n));
    n = Math.pow(n, 1.0 / gamma);
    return n;
  };

  window.generateRoughnessMap = function() {
    if (!heightmapCanvas || !heightmapCanvas.width) return;
    const w = heightmapCanvas.width, h = heightmapCanvas.height;
    roughnessCanvas.width = w; roughnessCanvas.height = h;
    const src = heightmapCtx.getImageData(0,0,w,h).data;
    const out = roughnessCtx.createImageData(w,h);
    const darkI = parseFloat(roughDarkIntensity.value || 1);
    const lightI = parseFloat(roughLightIntensity.value || 1);
    const black = parseInt(levelsBlack.value||0,10);
    const white = parseInt(levelsWhite.value||255,10);
    const gamma = parseFloat(levelsGamma.value||1.0);
    const inv = invertRough && invertRough.checked;

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
    roughnessCtx.putImageData(out,0,0);

    // assign to material (prefer roughnessTexture)
    if (pbrMaterial) {
      try {
        if ('roughnessTexture' in pbrMaterial) {
          if (!pbrMaterial.roughnessTexture) pbrMaterial.roughnessTexture = new BABYLON.DynamicTexture("roughnessTex", roughnessCanvas, scene, false);
          else pbrMaterial.roughnessTexture.getContext().drawImage(roughnessCanvas,0,0);
          roughnessDynamicTexture = pbrMaterial.roughnessTexture;
        } else {
          if (!pbrMaterial.metallicTexture) pbrMaterial.metallicTexture = new BABYLON.DynamicTexture("metallicRough", roughnessCanvas, scene, false);
          else pbrMaterial.metallicTexture.getContext().drawImage(roughnessCanvas,0,0);
          roughnessDynamicTexture = pbrMaterial.metallicTexture;
          if ('useRoughnessFromMetallicTextureGreen' in pbrMaterial) pbrMaterial.useRoughnessFromMetallicTextureGreen = true;
        }
      } catch(e) { console.warn("Assign roughness texture failed", e); }
    }
    if (window.updateBabylonTextures) updateBabylonTextures();
  };

})();
