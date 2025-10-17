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

    for (let i = 0; i < srcData.length; i += 4) {
      const luminance = srcData[i];
      let normalizedValue = applyLevels(luminance, black, gamma, white);
      
      if (invert) {
        normalizedValue = 1.0 - normalizedValue;
      }
      
      const finalValue = Math.round(normalizedValue * 255);
      outData[i] = outData[i + 1] = outData[i + 2] = finalValue;
      outData[i + 3] = 255;
    }
    rCtx.putImageData(outImageData, 0, 0);

    // --- MISE À JOUR COMPLÈTE DU MATÉRIAU BABYLONJS ---
    if (window.pbrMaterial && window.scene) {
      try {
        // ÉTAPE 1 : Ré-assigner la texture de base (Albedo/Source).
        if (window.sourceImage && window.sourceImage.src) {
          if (window.pbrMaterial.albedoTexture) window.pbrMaterial.albedoTexture.dispose();
          window.pbrMaterial.albedoTexture = new BABYLON.Texture(window.sourceImage.src, window.scene, false, true);
        }

        // ÉTAPE 2 : Ré-assigner la Normal Map (Bump).
        if (window.normalMapCanvas) {
            if (window.pbrMaterial.bumpTexture) window.pbrMaterial.bumpTexture.dispose();
            window.pbrMaterial.bumpTexture = new BABYLON.DynamicTexture("normalMap", window.normalMapCanvas, window.scene, false);
        }

        // ÉTAPE 3 : Assigner la nouvelle Roughness Map.
        if (window.pbrMaterial.metallicTexture) window.pbrMaterial.metallicTexture.dispose();
        window.pbrMaterial.metallicTexture = new BABYLON.DynamicTexture(
          "metallicRough",
          rCanvas,
          window.scene,
          false
        );

        // ÉTAPE 4 : Configurer le matériau pour lire les canaux.
        window.pbrMaterial.useRoughnessFromMetallicTextureGreen = true;
        window.pbrMaterial.useAmbientOcclusionFromMetallicTextureRed = false;
        window.pbrMaterial.useMetallicityFromMetallicTextureBlue = false;
        
        // =====================================================================
        // === CORRECTION : On respecte la valeur du slider global ===
        // =====================================================================
        // Au lieu de forcer la roughness à 1.0, on lit la valeur actuelle du slider.
        const roughnessSlider = document.getElementById('roughnessSlider');
        const currentRoughnessMultiplier = roughnessSlider ? parseFloat(roughnessSlider.value) : 1.0;
        
        window.pbrMaterial.metallic = 0.0; // Pas de metallicité
        window.pbrMaterial.roughness = currentRoughnessMultiplier; // Applique la valeur du slider comme multiplicateur

      } catch (e) {
        console.warn("⚠️ Échec de la mise à jour complète du matériau PBR :", e);
      }
    }

    if(window.updateBabylonTextures) {
        window.updateBabylonTextures();
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