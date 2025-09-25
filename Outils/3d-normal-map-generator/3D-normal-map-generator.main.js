(function(){
  // global canvases / images used by other modules
  window.sourceImage = new Image();
  window.sourceCanvas = document.createElement('canvas');
  window.sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  window.heightmapCanvas = document.createElement('canvas');
  window.heightmapCtx = heightmapCanvas.getContext('2d', { willReadFrequently: true });
  window.normalMapCanvas = document.getElementById('normalMapCanvas');
  window.ctx = normalMapCanvas.getContext('2d');
  window.roughnessCanvas = document.createElement('canvas');
  window.roughnessCtx = roughnessCanvas.getContext('2d', { willReadFrequently: true });
  window.roughnessDynamicTexture = null;

  // Babylon related globals
  window.engine = null;
  window.scene = null;
  window.pbrMaterial = null;
  window.cube = null;
  window.sphere = null;
  window.currentMesh = null;
  window.hdrTexture = null;

  // grab DOM controls used by other modules
  window.intensity = document.getElementById('intensity');
  window.smallDetails = document.getElementById('smallDetails');
  window.mediumDetails = document.getElementById('mediumDetails');
  window.largeDetails = document.getElementById('largeDetails');

  // heightmap controls (names match HTML ids)
  window.hmLargeShapes = document.getElementById('hmLargeShapes');
  window.hmMediumDetails = document.getElementById('hmMediumDetails');
  window.hmFineDetails = document.getElementById('hmFineDetails');
  window.hmIntensity = document.getElementById('hmIntensity');
  window.hmSmoothing = document.getElementById('hmSmoothing');
  window.enableHeightmap = document.getElementById('enableHeightmap');

  // roughness controls
  window.roughDarkIntensity = document.getElementById('roughDarkIntensity');
  window.roughLightIntensity = document.getElementById('roughLightIntensity');
  window.levelsBlack = document.getElementById('levelsBlack');
  window.levelsGamma = document.getElementById('levelsGamma');
  window.levelsWhite = document.getElementById('levelsWhite');
  window.invertRough = document.getElementById('invertRough');

  // invert checkboxes and format radios (opt fallback already present in HTML ref)
  window.invertR = document.getElementById('invertR');
  window.invertG = document.getElementById('invertG');
  window.invertB = document.getElementById('invertB');
  window.formatOpenGL = document.getElementById('formatOpenGL');
  window.formatDirectX = document.getElementById('formatDirectX');

  // preview buttons and image
  window.mainPreviewImage = document.getElementById('mainPreviewImage');
  window.viewNormalBtn = document.getElementById('viewNormalBtn');
  window.viewHeightmapBtn = document.getElementById('viewHeightmapBtn');
  window.viewSourceBtn = document.getElementById('viewSourceBtn');
  window.viewRoughBtn = document.getElementById('viewRoughBtn');

  // debounce helper
  function debounce(fn, delay){ let t; return function(...a){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,a), delay); }; }
  // create debounced wrappers that other modules expect
  window.debouncedGenerateNormalMap = debounce(()=>{ if (window.generateNormalMap) window.generateNormalMap(); }, 50);
  window.debouncedGenerateHeightmap = debounce(()=>{ if (window.generateHeightmap) window.generateHeightmap(); }, 50);
  window.debouncedGenerateRoughness = debounce(()=>{ if (window.generateRoughnessMap) window.generateRoughnessMap(); }, 80);

  // wire UI events to debounced functions
  [intensity, smallDetails, mediumDetails, largeDetails].forEach(s => s && s.addEventListener('input', () => { debouncedGenerateNormalMap(); }));
  [hmLargeShapes, hmMediumDetails, hmFineDetails, hmIntensity, hmSmoothing].forEach(s => s && s.addEventListener('input', () => { debouncedGenerateHeightmap(); }));
  [roughDarkIntensity, roughLightIntensity, levelsBlack, levelsGamma, levelsWhite, invertRough].forEach(s => s && s.addEventListener('input', () => { debouncedGenerateRoughness(); }));

  // image loader wiring
  const imageLoader = document.getElementById('imageLoader');
  imageLoader.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      sourceImage.onload = () => {
        sourceCanvas.width = sourceImage.width; sourceCanvas.height = sourceImage.height;
        heightmapCanvas.width = sourceImage.width; heightmapCanvas.height = sourceImage.height;
        normalMapCanvas.width = sourceImage.width; normalMapCanvas.height = sourceImage.height;

        // update Babylon textures if material ready
        if (pbrMaterial) {
          if (pbrMaterial.albedoTexture) pbrMaterial.albedoTexture.dispose();
          pbrMaterial.albedoTexture = new BABYLON.Texture(sourceImage.src, scene);
          if (pbrMaterial.bumpTexture) pbrMaterial.bumpTexture.dispose();
          pbrMaterial.bumpTexture = new BABYLON.DynamicTexture("normalMap", normalMapCanvas, scene, false);
        }
        // generate cascade
        if (window.generateHeightmap) window.generateHeightmap();
        // set default view
        if (viewNormalBtn) viewNormalBtn.click();
      };
      sourceImage.src = ev.target.result;
    };
    r.readAsDataURL(f);
  });

  // view switching
  const viewBtns = [viewNormalBtn, viewHeightmapBtn, viewSourceBtn, viewRoughBtn];
  function setActiveView(btn) {
    viewBtns.forEach(b => b && b.classList && b.classList.remove('active'));
    btn.classList.add('active');
    if (btn === viewNormalBtn) { mainPreviewImage.style.display = 'none'; normalMapCanvas.style.display = 'block'; }
    else {
      if (btn === viewHeightmapBtn) mainPreviewImage.src = heightmapCanvas.toDataURL();
      else if (btn === viewSourceBtn) mainPreviewImage.src = sourceImage.src;
      else if (btn === viewRoughBtn) mainPreviewImage.src = roughnessCanvas.toDataURL();
      mainPreviewImage.style.display = 'block'; normalMapCanvas.style.display = 'none';
    }
  }
  viewNormalBtn && viewNormalBtn.addEventListener('click', ()=>setActiveView(viewNormalBtn));
  viewHeightmapBtn && viewHeightmapBtn.addEventListener('click', ()=>setActiveView(viewHeightmapBtn));
  viewSourceBtn && viewSourceBtn.addEventListener('click', ()=>setActiveView(viewSourceBtn));
  viewRoughBtn && viewRoughBtn.addEventListener('click', ()=>setActiveView(viewRoughBtn));

  // Babylon init (copied/leaned from previous inline code)
  window.initBabylon = function(){
    const babylonCanvas = document.getElementById('threeCanvas');
    engine = new BABYLON.Engine(babylonCanvas, true, { preserveDrawingBuffer:true, stencil:true });
    scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera("camera",-Math.PI/2, Math.PI/2.5, 1.9, new BABYLON.Vector3(0,0,0), scene);
    camera.attachControl(babylonCanvas,true);
    camera.inputs.remove(camera.inputs.attached.mousewheel);
    hdrTexture = new BABYLON.CubeTexture.CreateFromPrefilteredData("https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    scene.environmentTexture = hdrTexture;
    scene.createDefaultSkybox(hdrTexture, true, 1000, 0.0);
    pbrMaterial = new BABYLON.PBRMaterial("pbr", scene);
    pbrMaterial.metallic = 0.2; pbrMaterial.roughness = parseFloat(document.getElementById('roughnessSlider').value || 0.6);
    cube = BABYLON.MeshBuilder.CreateBox("cube", {size:1}, scene); cube.material = pbrMaterial;
    sphere = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter:1.4, segments:64}, scene); sphere.material = pbrMaterial; sphere.setEnabled(false);
    currentMesh = cube;
    engine.runRenderLoop(()=>scene.render());
    window.addEventListener('resize', ()=>engine.resize());
  };
  window.updateBabylonTextures = function(){
    if (pbrMaterial && pbrMaterial.bumpTexture) try{ pbrMaterial.bumpTexture.update(); }catch(e){}
    if (roughnessDynamicTexture && roughnessDynamicTexture.update) try{ roughnessDynamicTexture.update(); }catch(e){}
    else if (pbrMaterial && pbrMaterial.roughnessTexture && pbrMaterial.roughnessTexture.update) try{ pbrMaterial.roughnessTexture.update(); }catch(e){}
  };

  // start
  initBabylon();
})();
