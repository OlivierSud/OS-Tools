(function () {
  /**
   * Applique une correction de niveaux de type Photoshop sur une valeur de pixel.
   * @param {number} v - La valeur d'entrée (0–255).
   * @param {number} black - Le niveau de noir (0-255).
   * @param {number} gamma - La correction gamma (généralement entre 0.1 et 3).
   * @param {number} white - Le niveau de blanc (0-255).
   * @returns {number} La valeur normalisée entre 0 et 1.
   */
  window.applyLevels = function (v, black, gamma, white) {
    if (white <= black) return 0;
    let n = (v - black) / (white - black);
    n = Math.max(0, Math.min(1, n));
    n = Math.pow(n, 1.0 / gamma);
    return n;
  };

  /**
   * Génère la Roughness Map à partir de la Heightmap et met à jour l'intégralité du matériau PBR
   * pour assurer la cohérence du shader.
   */
  window.generateRoughnessMap = function () {
    if (!window.heightmapCanvas || !window.heightmapCtx) {
      console.warn("Heightmap non disponible — la génération de la roughness map est annulée.");
      return;
    }

    const w = heightmapCanvas.width;
    const h = heightmapCanvas.height;
    if (!w || !h) return;

    const rCanvas = window.roughnessCanvas || (window.roughnessCanvas = document.createElement("canvas"));
    const rCtx = window.roughnessCtx || (window.roughnessCtx = rCanvas.getContext("2d", { willReadFrequently: true }));

    rCanvas.width = w;
    rCanvas.height = h;

    const srcData = heightmapCtx.getImageData(0, 0, w, h).data;
    const outImageData = rCtx.createImageData(w, h);
    const outData = outImageData.data;

    const black = parseInt(document.getElementById("levelsBlack")?.value || 0);
    const white = parseInt(document.getElementById("levelsWhite")?.value || 255);
    const gamma = parseFloat(document.getElementById("levelsGamma")?.value || 1);
    const invert = document.getElementById("invertRough")?.checked;

    // Encode roughness in GREEN channel only (R=0,B=0,G=roughness)
    for (let i = 0; i < srcData.length; i += 4) {
      const luminance = srcData[i];
      let normalizedValue = applyLevels(luminance, black, gamma, white);
      if (invert) normalizedValue = 1.0 - normalizedValue;
      const finalValue = Math.round(normalizedValue * 255);
      // Keep roughness as grayscale (R=G=B=finalValue) — viewer decides which channel to sample.
      outData[i] = finalValue;
      outData[i + 1] = finalValue;
      outData[i + 2] = finalValue;
      outData[i + 3] = 255;
    }
    rCtx.putImageData(outImageData, 0, 0);

    // Notifier le runtime central (main.js) pour appliquer la roughness via DynamicTexture
    if (typeof window.applyRoughnessFromCanvas === 'function') {
      try { window.applyRoughnessFromCanvas(rCanvas); } catch(e){ console.warn("applyRoughnessFromCanvas failed", e); }
    } else {
      // fallback : demander la mise à jour globale si possible
      try { if (typeof window.updateBabylonTextures === 'function') window.updateBabylonTextures(); } catch(e){/*ignore*/ }
    }

    try {
      if (
        window.viewRoughBtn &&
        window.viewRoughBtn.classList.contains("active") &&
        window.mainPreviewImage
      ) {
        window.mainPreviewImage.src = rCanvas.toDataURL();
      }
    } catch (e) {
      console.warn("Impossible d’actualiser l’aperçu de la roughness map.", e);
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    const roughnessControls = ["levelsBlack", "levelsGamma", "levelsWhite", "invertRough"];
    roughnessControls.forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
          element.addEventListener("input", window.debouncedGenerateRoughness);
        }
      }
    );
  });
})();