(function(){
  "use strict";

  // === global canvases / images used by other modules ===
  window.sourceImage = new Image();
  window.sourceCanvas = document.createElement('canvas');
  window.sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });

  window.heightmapCanvas = document.createElement('canvas');
  window.heightmapCtx = heightmapCanvas.getContext('2d', { willReadFrequently: true });

  // normalMapCanvas exists in HTML; fallback to created canvas if not present
  window.normalMapCanvas = document.getElementById('normalMapCanvas') || document.createElement('canvas');
  window.ctx = normalMapCanvas.getContext('2d');

  window.roughnessCanvas = document.createElement('canvas');
  window.roughnessCtx = roughnessCanvas.getContext('2d', { willReadFrequently: true });
  window.roughnessDynamicTexture = null;

  // === Babylon related globals ===
  window.engine = null;
  window.scene = null;
  window.pbrMaterial = null;
  window.cube = null;
  window.sphere = null;
  window.currentMesh = null;
  window.hdrTexture = null;

  // === grab DOM controls used by other modules (tolerant) ===
  const $ = id => document.getElementById(id) || null;

  window.intensity = $('intensity');
  window.smallDetails = $('smallDetails');
  window.mediumDetails = $('mediumDetails');
  window.largeDetails = $('largeDetails');
  window.invertNormal = $('invertNormal');


  // heightmap controls (names match HTML ids)
  window.hmLargeShapes = $('hmLargeShapes');
  window.hmMediumDetails = $('hmMediumDetails');
  window.hmFineDetails = $('hmFineDetails');
  window.hmIntensity = $('hmIntensity');
  window.hmSmoothing = $('hmSmoothing');
  window.enableHeightmap = $('enableHeightmap');

  // roughness controls (some may be absent depending on HTML version)
  window.roughDarkIntensity = $('roughDarkIntensity');
  window.roughLightIntensity = $('roughLightIntensity');
  window.levelsBlack = $('levelsBlack');
  window.levelsGamma = $('levelsGamma');
  window.levelsWhite = $('levelsWhite');
  window.invertRough = $('invertRough');

  // optional invert/format controls
  window.invertR = $('invertR');
  window.invertG = $('invertG');
  window.invertB = $('invertB');
  window.formatOpenGL = $('formatOpenGL');
  window.formatDirectX = $('formatDirectX');

  // preview buttons and image
  window.mainPreviewImage = $('mainPreviewImage');
  window.viewNormalBtn = $('viewNormalBtn');
  window.viewHeightmapBtn = $('viewHeightmapBtn');
  window.viewSourceBtn = $('viewSourceBtn');
  window.viewRoughBtn = $('viewRoughBtn');

  // debounce helper
  function debounce(fn, delay){ let t; return function(...a){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,a), delay); }; }

  // create debounced wrappers that other modules expect (tolerant if functions missing)
  window.debouncedGenerateNormalMap = debounce(()=>{ if (window.generateNormalMap) try { window.generateNormalMap(); } catch(e){ console.warn("generateNormalMap error", e); } }, 50);
  window.debouncedGenerateHeightmap = debounce(()=>{ if (window.generateHeightmap) try { window.generateHeightmap(); } catch(e){ console.warn("generateHeightmap error", e); } }, 50);
  window.debouncedGenerateRoughness = debounce(()=>{ if (window.generateRoughnessMap) try { window.generateRoughnessMap(); } catch(e){ console.warn("generateRoughnessMap error", e); } }, 80);

  // wire UI events to debounced functions (safe checks)
  [window.intensity, window.smallDetails, window.mediumDetails, window.largeDetails].forEach(s => {
    if (s && s.addEventListener) s.addEventListener('input', () => { window.debouncedGenerateNormalMap(); });
  });
  [window.hmLargeShapes, window.hmMediumDetails, window.hmFineDetails, window.hmIntensity, window.hmSmoothing].forEach(s => {
    if (s && s.addEventListener) s.addEventListener('input', () => { window.debouncedGenerateHeightmap(); });
  });

  // include both old rough sliders (if present) and new level sliders (if present)
  [window.roughDarkIntensity, window.roughLightIntensity, window.levelsBlack, window.levelsGamma, window.levelsWhite, window.invertRough].forEach(s => {
    if (s && s.addEventListener) s.addEventListener('input', () => { window.debouncedGenerateRoughness(); });
  });

  

  // === image loader wiring (safeguarded) ===
  const imageLoader = $('imageLoader');
  if (imageLoader) {
    imageLoader.addEventListener('change', e => {
      const f = e.target.files[0];
      window.sourceFileName = f.name; // nom avec extension
      window.sourceFileNameBase = f.name.replace(/\.[^/.]+$/, ""); // nom avec extension
      if (!f) return;
      const r = new FileReader();
      r.onload = ev => {
        // set image src, then onload configure canvases
        sourceImage.onload = () => {
          try {
            sourceCanvas.width = sourceImage.width; sourceCanvas.height = sourceImage.height;
            heightmapCanvas.width = sourceImage.width; heightmapCanvas.height = sourceImage.height;
            normalMapCanvas.width = sourceImage.width; normalMapCanvas.height = sourceImage.height;
          } catch(e){ console.warn("Erreur dimension canvas :", e); }

          // update Babylon textures if material ready
          try {
            if (window.pbrMaterial && window.scene) {
              // albedo
              if (window.pbrMaterial.albedoTexture) { try { window.pbrMaterial.albedoTexture.dispose(); } catch(_){} }
              window.pbrMaterial.albedoTexture = new BABYLON.Texture(sourceImage.src, window.scene);

              // bump/normal dynamic texture
              if (window.pbrMaterial.bumpTexture) { try { window.pbrMaterial.bumpTexture.dispose(); } catch(_){} }
              window.pbrMaterial.bumpTexture = new BABYLON.DynamicTexture("normalMap", normalMapCanvas, window.scene, false);

              // Si une roughnessCanvas existe déjà, appliquer via la même méthode (DynamicTexture)
              if (window.roughnessCanvas) {
                try { if (typeof window.applyRoughnessFromCanvas === 'function') window.applyRoughnessFromCanvas(window.roughnessCanvas); } catch(e){ console.warn("applyRoughnessFromCanvas failed", e); }
              }
            }
          } catch(e){ console.warn("Erreur update Babylon textures après chargement image :", e); }

          // generate cascade
          if (window.generateHeightmap) window.generateHeightmap();

          // set default view (safe)
          if (window.viewNormalBtn && window.viewNormalBtn.click) window.viewNormalBtn.click();

          if (typeof updateExportNames === "function") updateExportNames();
        };
        sourceImage.src = ev.target.result;
      };
      r.readAsDataURL(f);
    });
  } else {
    console.warn("imageLoader input introuvable - import disabled.");
  }

  // === view switching (safe) ===
  const viewBtns = [window.viewNormalBtn, window.viewHeightmapBtn, window.viewSourceBtn, window.viewRoughBtn].filter(Boolean);
  function setActiveView(btn) {
    viewBtns.forEach(b => b && b.classList && b.classList.remove('active'));
    if (!btn) return;
    btn.classList.add('active');

    try {
      if (btn === window.viewNormalBtn) {
        if (window.mainPreviewImage) window.mainPreviewImage.style.display = 'none';
        if (window.normalMapCanvas) window.normalMapCanvas.style.display = 'block';
      } else {
        if (btn === window.viewHeightmapBtn) {
          if (window.mainPreviewImage) window.mainPreviewImage.src = heightmapCanvas.toDataURL();
        } else if (btn === window.viewSourceBtn) {
          if (window.mainPreviewImage) window.mainPreviewImage.src = window.sourceImage?.src || '';
        } else if (btn === window.viewRoughBtn) {
          if (window.mainPreviewImage) {
            try { window.mainPreviewImage.src = window.roughnessCanvas.toDataURL(); } catch(e){ console.warn("roughness canvas toDataURL failed", e); }
          }
        }
        if (window.mainPreviewImage) window.mainPreviewImage.style.display = 'block';
        if (window.normalMapCanvas) window.normalMapCanvas.style.display = 'none';
      }
    } catch(e){ console.warn("Erreur changement view :", e); }
  }
  if (window.viewNormalBtn) window.viewNormalBtn.addEventListener('click', ()=>setActiveView(window.viewNormalBtn));
  if (window.viewHeightmapBtn) window.viewHeightmapBtn.addEventListener('click', ()=>setActiveView(window.viewHeightmapBtn));
  if (window.viewSourceBtn) window.viewSourceBtn.addEventListener('click', ()=>setActiveView(window.viewSourceBtn));
  if (window.viewRoughBtn) window.viewRoughBtn.addEventListener('click', ()=>setActiveView(window.viewRoughBtn));

  // === Babylon init (robuste) ===
  window.initBabylon = function(){
    try {
      const babylonCanvas = document.getElementById('threeCanvas');
      if (!babylonCanvas) {
        console.warn("Canvas threeCanvas introuvable — aperçu 3D désactivé.");
        return;
      }

      // Si engine déjà initialisé, on ne réinitialise pas
      if (window.engine && window.scene) return;

      window.engine = new BABYLON.Engine(babylonCanvas, true, { preserveDrawingBuffer:true, stencil:true });
      window.scene = new BABYLON.Scene(window.engine);

      const camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 2,
        Math.PI / 2.5,
        2.5, // distance initiale (radius)
        new BABYLON.Vector3(0, 0, 0),
        window.scene
      );

      // Active les contrôles (souris, molette)
      camera.attachControl(babylonCanvas, true);

      // Limite le zoom avant/arrière
      camera.lowerRadiusLimit = 2;  // zoom minimum (plus petit = plus proche)
      camera.upperRadiusLimit = 3;  // zoom maximum (plus grand = plus loin)

      // (Optionnel) vitesse de zoom
      camera.wheelPrecision = 50;

      // (Optionnel) limite d'inclinaison verticale
      camera.lowerBetaLimit = 0.3;
      camera.upperBetaLimit = 2.8;



      // Ajout d'une lumière de secours pour garantir la visibilité
      const light = new BABYLON.HemisphericLight("fallbackLight", new BABYLON.Vector3(0, 1, 0), window.scene);
      light.intensity = 0.7;

      // try to load environment, but don't hard-fail if remote load fails
      try {
        window.hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData("https://assets.babylonjs.com/environments/environmentSpecular.env", window.scene);
        window.scene.environmentTexture = window.hdrTexture;
        window.scene.createDefaultSkybox(window.hdrTexture, true, 1000, 0.0);
      } catch(e){ console.warn("Chargement environment HDR échoué :", e); }

      // create material
      window.pbrMaterial = new BABYLON.PBRMaterial("pbr", window.scene);
      window.pbrMaterial.metallic = 0.2;
      window.pbrMaterial.roughness = 0.5; // Initial value from the new slider

      // Par défaut, configurer le matériau pour accepter roughness depuis metallicTexture (canal G)
      try {
        window.pbrMaterial.useRoughnessFromMetallicTextureGreen = true;
        window.pbrMaterial.useAmbientOcclusionFromMetallicTextureRed = false;
        window.pbrMaterial.useMetallicityFromMetallicTextureBlue = false;
      } catch(e){ /* ignore if properties not present */ }

      // if a roughness canvas already exists, apply it now
      if (window.roughnessCanvas && typeof window.generateRoughnessMap === 'function') {
        try { window.generateRoughnessMap(); } catch(e){ /* ignore */ }
      }

      // create geometry previews
      window.cube = BABYLON.MeshBuilder.CreateBox("cube", {size:1}, window.scene);
      window.cube.material = window.pbrMaterial;

      window.sphere = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter:1.4, segments:64}, window.scene);
      window.sphere.material = window.pbrMaterial;
      
      // S'assurer que le mesh par défaut est visible
      window.cube.setEnabled(true);
      window.sphere.setEnabled(false);

      window.currentMesh = window.cube;

      // render loop
      window.engine.runRenderLoop(()=> { try { if (window.scene) window.scene.render(); } catch(e){ console.warn("render error", e); } });

      window.addEventListener('resize', ()=> { try { if (window.engine) window.engine.resize(); } catch(e){} });

    } catch(err) {
      console.warn("Impossible d'initialiser Babylon (initBabylon) :", err);
      try { window.engine = null; window.scene = null; } catch(_) {}
    }
  };

  // ensure update function is available globally
  window.updateBabylonTextures = function(){
    try {
      if (window.pbrMaterial && window.pbrMaterial.bumpTexture && window.pbrMaterial.bumpTexture.update) {
        window.pbrMaterial.bumpTexture.update();
      }
    } catch(e){ console.warn("bumpTexture.update failed", e); }

    try {
      // La texture de roughness est dans le canal `metallicTexture`
      if (window.pbrMaterial && window.pbrMaterial.metallicTexture) {
        // some dynamic textures have update(), others don't; try to replace with a new DynamicTexture if needed
        try {
          if (window.pbrMaterial.metallicTexture.update) window.pbrMaterial.metallicTexture.update();
        } catch(e) { console.warn("metallicTexture.update failed", e); }
      }
    } catch(e){ console.warn("metallicTexture (for roughness) update failed", e); }

    try { if (window.engine) window.engine.resize(); } catch(e){}
  };

  // Applique la roughness canvas au matériau PBR en utilisant DynamicTexture (comme la normal map)
  window.applyRoughnessFromCanvas = function(canvas){
    if (!canvas || !window.scene || !window.pbrMaterial) return;
    try {
      // Dispose ancienne texture si présente
      try { if (window.pbrMaterial.metallicTexture) { window.pbrMaterial.metallicTexture.dispose(); } } catch(e){/*ignore*/ }

      // Créer DynamicTexture directement depuis le canvas (méthode identique à la normal map)
      // on force la DynamicTexture (live) pour que les mises à jour de canvas soient prises en compte
      const dyn = new BABYLON.DynamicTexture("roughnessDyn", canvas, window.scene, false);
      dyn.wrapU = dyn.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;

      // Pour compatibilité maximale : utiliser metallicTexture + lire la roughness depuis le canal GREEN
      // (la roughnessCanvas est en NB => R=G=B, donc G contient la donnée de roughness)
      window.pbrMaterial.metallicTexture = dyn;

      // Configurer les flags pour lire la roughness depuis le canal G de metallicTexture
      if ('useRoughnessFromMetallicTextureAlpha' in window.pbrMaterial) {
        // Si alpha est disponible mais canvas n'a pas d'alpha utile, désactiver et basculer sur green
        window.pbrMaterial.useRoughnessFromMetallicTextureAlpha = false;
      }
      if ('useRoughnessFromMetallicTextureGreen' in window.pbrMaterial) {
        window.pbrMaterial.useRoughnessFromMetallicTextureGreen = true;
      }
      // Désactiver les autres usages de canaux pour éviter conflits
      if ('useAmbientOcclusionFromMetallicTextureRed' in window.pbrMaterial) window.pbrMaterial.useAmbientOcclusionFromMetallicTextureRed = false;
      if ('useMetallicityFromMetallicTextureBlue' in window.pbrMaterial) window.pbrMaterial.useMetallicityFromMetallicTextureBlue = false;

      // Appliquer le multiplicateur global depuis le slider "roughnessSlider"
      const roughnessSlider = document.getElementById('roughnessSlider');
      const currentRoughnessMultiplier = roughnessSlider ? parseFloat(roughnessSlider.value) : window.pbrMaterial.roughness || 1.0;
      // Le scalar roughness multiplie la texture (texture * roughness)
      window.pbrMaterial.roughness = currentRoughnessMultiplier;

      // Forcer la mise à jour des textures/materials
      if (window.updateBabylonTextures) window.updateBabylonTextures();
      if (window.scene && window.scene.markAllMaterialsAsDirty) window.scene.markAllMaterialsAsDirty(BABYLON.Constants.MATERIAL_TextureDirtyFlag || 1);

      console.info("Roughness DynamicTexture appliquée au matériau PBR (metallicTexture, roughness->G).");
    } catch (e) {
      console.warn("Erreur applyRoughnessFromCanvas :", e);
    }
  };


  // === start (init Babylon after DOM ready to be safe) ===
  function startOnceReady() {
    try { 
      window.initBabylon(); 
    } catch(e){ 
      console.warn("initBabylon error on start", e); 
    }

    // =====================================================================
    // === NOUVEAU : Connexion des contrôles 3D ===
    // =====================================================================

    // 1. Gestion du slider de Roughness globale
    const roughnessSlider = $('roughnessSlider');
    const roughnessValue = $('roughnessValue');
    if (roughnessSlider && roughnessValue) {
      roughnessSlider.addEventListener('input', () => {
        // Met à jour la valeur numérique affichée
        const val = parseFloat(roughnessSlider.value);
        roughnessValue.textContent = val.toFixed(2);
        
        // Applique la nouvelle valeur au matériau PBR
        if (window.pbrMaterial) {
          window.pbrMaterial.roughness = val;
        }
      });
    }

    // 2. Gestion des boutons pour changer de forme
    const btnCube = $('btnCube');
    const btnSphere = $('btnSphere');
    if (btnCube && btnSphere) {
      btnCube.addEventListener('click', () => {
        if (window.cube && window.sphere) {
          window.cube.setEnabled(true);
          window.sphere.setEnabled(false);
        }
      });
      
      btnSphere.addEventListener('click', () => {
        if (window.cube && window.sphere) {
          window.cube.setEnabled(false);
          window.sphere.setEnabled(true);
        }
      });
    }

// 3. Bouton pour faire défiler les environnements HDR
const btnSwitchEnv = $('btnSwitchEnv');
if (btnSwitchEnv) {
  // === Liste des environnements disponibles ===
  const envList = [
    { name: "🏢 Street", url: "https://assets.babylonjs.com/environments/environmentSpecular.env" },
    { name: "⛰️ Country", url: "https://playground.babylonjs.com/textures/country.env" },
    { name: "📸 Studio", url: "https://playground.babylonjs.com/textures/Studio_Softbox_2Umbrellas_cube_specular.dds" },
    { name: "🏰 Ruin", url: "https://playground.babylonjs.com/textures/SpecularHDR.dds" },
    { name: "🌛 Night", url: "https://playground.babylonjs.com/textures/night.env" },
    { name: "🌳 Forest", url: "https://playground.babylonjs.com/textures/forest.env" },
    { name: "🏯 Temple", url: "https://playground.babylonjs.com/textures/room.env" }
  ];

  let currentEnvIndex = 0;

  // Fonction de chargement d'environnement
  function loadEnvironment(index) {
    const env = envList[index % envList.length];
    if (!env || !window.scene) return;

    try {
      // Supprime l'ancien HDR si présent
      if (window.hdrTexture) {
        try { window.hdrTexture.dispose(); } catch (_) {}
      }

      // Crée et applique le nouveau
      window.hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(env.url, window.scene);
      window.scene.environmentTexture = window.hdrTexture;
      window.scene.createDefaultSkybox(window.hdrTexture, true, 1000, 0.0);

      // Change le texte du bouton pour indiquer l'environnement courant
      btnSwitchEnv.textContent = `Env: ${env.name}`;

      console.log(`✅ Environnement chargé : ${env.name}`);
    } catch (e) {
      console.warn("Erreur lors du chargement de l'environnement :", e);
    }
  }

  // Clique = passe au suivant
  btnSwitchEnv.addEventListener('click', () => {
    currentEnvIndex = (currentEnvIndex + 1) % envList.length;
    loadEnvironment(currentEnvIndex);
  });

  // Charge le premier au démarrage
  loadEnvironment(currentEnvIndex);
}

// 4. Gestion du popup d’export
const exportBtn = $('exportTexturesBtn');
const exportPopup = $('exportPopup');
const cancelExport = $('cancelExport');

if (exportBtn && exportPopup) {
  exportBtn.addEventListener('click', () => {
    exportPopup.style.display = 'flex'; // Affiche la popup (grâce à display:flex dans ton CSS)
  });
}

if (cancelExport && exportPopup) {
  cancelExport.addEventListener('click', () => {
    exportPopup.style.display = 'none'; // Cache la popup
  });
}

// Option : fermer la popup si on clique à l’extérieur
if (exportPopup) {
  exportPopup.addEventListener('click', (e) => {
    if (e.target === exportPopup) exportPopup.style.display = 'none';
  });
}

// 5. Auto-remplissage et export des textures
const exportInputs = {
  base: $('nameBase'),
  rough: $('nameRough'),
  high: $('nameHigh'),
  nm: $('nameNM'),
};

function updateExportNames() {
  const baseName = window.sourceFileNameBase || "texture";
  if (exportInputs.base) exportInputs.base.value = `${baseName}_base.png`;
  if (exportInputs.rough) exportInputs.rough.value = `${baseName}_rough.png`;
  if (exportInputs.high) exportInputs.high.value = `${baseName}_height.png`;
  if (exportInputs.nm) exportInputs.nm.value = `${baseName}_normal.png`;
}

// Dès qu'on ouvre la popup → on met à jour les noms
if (exportBtn && exportPopup) {
  exportBtn.addEventListener('click', () => {
    updateExportNames();
    exportPopup.style.display = 'flex';
  });
}

// Fonction utilitaire pour enregistrer un canvas sous forme d’image PNG
function saveCanvasAsImage(canvas, filename) {
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Gestion des boutons 💾
document.querySelectorAll('.save-icon').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.type;
    const input = exportInputs[type];
    const filename = (input?.value || `export_${type}.png`).trim();

    switch (type) {
      case 'base':
        // Si une image source est chargée, on télécharge directement cette image
        if (window.sourceImage && window.sourceImage.src) {
          const link = document.createElement('a');
          link.download = filename;
          link.href = window.sourceImage.src;
          link.click();
        } else if (window.sourceCanvas) {
          // fallback si jamais l'image n'existe plus
          saveCanvasAsImage(window.sourceCanvas, filename);
        }
        break;

      case 'rough':
        if (window.roughnessCanvas) saveCanvasAsImage(window.roughnessCanvas, filename);
        break;
      case 'high':
        if (window.heightmapCanvas) saveCanvasAsImage(window.heightmapCanvas, filename);
        break;
      case 'nm':
        if (window.normalMapCanvas) saveCanvasAsImage(window.normalMapCanvas, filename);
        break;
      default:
        console.warn("Type de texture inconnu :", type);
    }
  });
});



  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(startOnceReady, 20);
  } else {
    document.addEventListener('DOMContentLoaded', startOnceReady);
  }

  


})();