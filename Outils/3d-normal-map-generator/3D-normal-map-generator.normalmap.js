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

    // Appliquer le rendu de la normal map, avec option de flou final si demandé
    const normalBlurVal = parseFloat((window.normalBlur && window.normalBlur.value) || 0);
    if (normalBlurVal <= 0.001) {
		// pas de flou demandé — rendu direct
		ctx.putImageData(dest, 0, 0);
	} else {
		// === Préparer canvas centre contenant dest ===
		const center = document.createElement('canvas');
		center.width = width; center.height = height;
		const cctx = center.getContext('2d');
		cctx.putImageData(dest, 0, 0);

		// IMPORTANT : forcer le canal alpha à 255 sur la tuile centrale
		try {
			const centerData = cctx.getImageData(0, 0, width, height);
			const cd = centerData.data;
			for (let i = 0; i < cd.length; i += 4) {
				cd[i + 3] = 255;
			}
			cctx.putImageData(centerData, 0, 0);
		} catch (e) {
			// si getImageData bloque (CORS), on continue sans forcer alpha
			console.warn('Impossible de forcer alpha sur center canvas (CORS?)', e);
		}

		// padding en fonction du rayon de flou (sécurisé)
		const pad = Math.ceil(Math.max(2, normalBlurVal * 2)) + 2;

		// === créer canvas temporaire tilé (3x3) en répétition (wrap) ===
		const tmp = document.createElement('canvas');
		tmp.width = width + pad * 2;
		tmp.height = height + pad * 2;
		const tctx = tmp.getContext('2d');

		// Remplir tmp avec des copies répétées (wrap) de center (3x3)
		for (let ty = -1; ty <= 1; ty++) {
			for (let tx = -1; tx <= 1; tx++) {
				const dx = pad + tx * width;
				const dy = pad + ty * height;
				tctx.drawImage(center, dx, dy);
			}
		}

		// === Tentative 1 : utiliser ctx.filter (performant si supporté) ===
		let did = false;
		try {
			// essaye d'appliquer le flou CSS2D en ne dessinant que la région centrale
			ctx.clearRect(0, 0, width, height);
			ctx.filter = `blur(${normalBlurVal}px)`;
			// drawImage(source, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
			ctx.drawImage(tmp, pad, pad, width, height, 0, 0, width, height);
			ctx.filter = 'none';
			did = true;

			// sécurité : s'assurer que le canal alpha final est opaque (prévenir artefacts)
			try {
				const finalData = ctx.getImageData(0, 0, width, height);
				const fd = finalData.data;
				for (let i = 0; i < fd.length; i += 4) fd[i + 3] = 255;
				ctx.putImageData(finalData, 0, 0);
			} catch (e) {
				// ignore si interdit par CORS ou coût élevé
			}
		} catch (e) {
			// ctx.filter non supporté ou erreur — on passera au fallback
			console.warn('ctx.filter blur failed, fallback to JS blur', e);
			try { ctx.filter = 'none'; } catch(_) {}
			did = false;
		}

		// === Fallback JS : appliquer blur séparable (box blur) sur la région centrale ===
		if (!did) {
			// récupérer pixels de la région centrale du tmp
			const tmpCtx = tmp.getContext('2d');
			let imgData = tmpCtx.getImageData(pad, pad, width, height);

			// appliquer blur JS (séparable) sur RGB uniquement, puis forcer alpha=255
			const blurredData = separableBoxBlur(imgData, Math.max(1, Math.round(normalBlurVal)));

			// forcer alpha opaque sur le résultat pour éviter dégradés alpha le long des bords
			const bd = blurredData.data;
			for (let i = 0; i < bd.length; i += 4) {
				bd[i + 3] = 255;
			}

			// dessiner le résultat final
			ctx.clearRect(0, 0, width, height);
			ctx.putImageData(blurredData, 0, 0);
		}
	}

	// separable box blur (simple, raisonnable perf pour tailles modérées)
	// Remarque : la fonction existante peut rester inchangée, elle prend et retourne ImageData
	function separableBoxBlur(imageData, radius) {
		if (radius <= 0) return imageData;
		const w = imageData.width, h = imageData.height;
		const src = imageData.data;
		const tmp = new Uint8ClampedArray(src.length);
		const out = new Uint8ClampedArray(src.length);
		const channels = 4;
		const kernel = radius * 2 + 1;

		// horizontal pass
		for (let y = 0; y < h; y++) {
			for (let c = 0; c < channels; c++) {
				let sum = 0;
				// init window
				for (let x = -radius; x <= radius; x++) {
					const xi = Math.min(w - 1, Math.max(0, x));
					sum += src[(y * w + xi) * channels + c];
				}
				for (let x = 0; x < w; x++) {
					tmp[(y * w + x) * channels + c] = Math.round(sum / kernel);
					// slide window
					const left = x - radius;
					const right = x + radius + 1;
					const leftIdx = (y * w + Math.max(0, left)) * channels + c;
					const rightIdx = (y * w + Math.min(w - 1, right)) * channels + c;
					sum += src[rightIdx] - src[leftIdx];
				}
			}
		}

		// vertical pass (reads tmp, writes out)
		for (let x = 0; x < w; x++) {
			for (let c = 0; c < channels; c++) {
				let sum = 0;
				for (let y = -radius; y <= radius; y++) {
					const yi = Math.min(h - 1, Math.max(0, y));
					sum += tmp[(yi * w + x) * channels + c];
				}
				for (let y = 0; y < h; y++) {
					out[(y * w + x) * channels + c] = Math.round(sum / kernel);
					const top = y - radius;
					const bottom = y + radius + 1;
					const topIdx = (Math.max(0, top) * w + x) * channels + c;
					const botIdx = (Math.min(h - 1, bottom) * w + x) * channels + c;
					sum += tmp[botIdx] - tmp[topIdx];
				}
			}
		}

		return new ImageData(out, w, h);
	}

    if (viewHeightmapBtn && viewHeightmapBtn.classList.contains('active')) {
      mainPreviewImage.src = heightmapCanvas.toDataURL();
    }
    if (window.updateBabylonTextures) updateBabylonTextures();
    if (window.debouncedGenerateRoughness) window.debouncedGenerateRoughness();
  };
})();
