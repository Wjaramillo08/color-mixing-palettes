/* ==========================================================================
   js/app.js - Lógica del Mezclador de Pintura (Bloqueo Directo en Fijar Color)
   ========================================================================== */

let currentProportions = { r: 43, y: 40, b: 0, k: 3, w: 14 };
let currentHexColor = "E67E22";
let undoStack = []; 
let savedColors = JSON.parse(localStorage.getItem('savedPalettes') || '[]');
let esModoPartes = false;
let ultimoCambioFueFoto = false;
let estadoPrevioAFoto = null; 
let modoRuedaActivo = false;
let arrastrandoEnRueda = false;
let expandirMezclasGuardadas = false;

const colorDisplay = document.getElementById('colorDisplay');
const hexInput = document.getElementById('hexInput');
const modeToggle = document.getElementById('modeToggle');
const lockColorToggle = document.getElementById('lockColorToggle');
const zoomSlider = document.getElementById('zoomSlider');
const zoomVal = document.getElementById('zoomVal');
const sampleSizeSelect = document.getElementById('sampleSize');
const previewImage = document.getElementById('previewImage');
const dropZone = document.getElementById('dropZone');
const uploadPrompt = document.getElementById('uploadPrompt');
const wheelCanvas = document.getElementById('wheelCanvas');
const ctxWheel = wheelCanvas.getContext('2d');
const undoBtn = document.getElementById('undoBtn');
const saveBtn = document.getElementById('saveBtn');
const newImgBtn = document.getElementById('newImgBtn');
const savedList = document.getElementById('savedList');

const sliders = { r: document.getElementById('slider-r'), y: document.getElementById('slider-y'), b: document.getElementById('slider-b'), k: document.getElementById('slider-k'), w: document.getElementById('slider-w') };
const boxes = { r: document.getElementById('box-r'), y: document.getElementById('box-y'), b: document.getElementById('box-b'), k: document.getElementById('box-k'), w: document.getElementById('box-w') };

newImgBtn.addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

function guardarEstadoEnHistorial(origenFoto = false) {
    const copiaEstado = { proportions: { ...currentProportions }, hex: currentHexColor };
    if (origenFoto) {
        if (!ultimoCambioFueFoto) {
            estadoPrevioAFoto = copiaEstado;
            undoStack.push(estadoPrevioAFoto);
            ultimoCambioFueFoto = true;
        } else {
            undoStack = undoStack.filter(state => state !== estadoPrevioAFoto);
            undoStack.push(estadoPrevioAFoto);
        }
    } else {
        ultimoCambioFueFoto = false;
        estadoPrevioAFoto = null;
        if (undoStack.length > 0) {
            const ultimo = undoStack[undoStack.length - 1];
            if (ultimo.proportions.r === copiaEstado.proportions.r && 
                ultimo.proportions.y === copiaEstado.proportions.y && 
                ultimo.proportions.b === copiaEstado.proportions.b && 
                ultimo.proportions.k === copiaEstado.proportions.k && 
                ultimo.proportions.w === copiaEstado.proportions.w) {
                return;
            }
        }
        undoStack.push(copiaEstado);
    }
    if (undoStack.length > 40) undoStack.shift();
    actualizarBotonUndo();
}

undoBtn.addEventListener('click', () => {
    if (undoStack.length === 0) return;
    const estadoAnterior = undoStack.pop();
    currentProportions = estadoAnterior.proportions;
    currentHexColor = estadoAnterior.hex;
    if (ultimoCambioFueFoto && undoStack.length === 0) {
        ultimoCambioFueFoto = false;
        estadoPrevioAFoto = null;
    }
    actualizarBotonUndo();
    renderizarHerramienta();
});

function actualizarBotonUndo() {
    undoBtn.disabled = undoStack.length === 0;
    undoBtn.textContent = `⤺ Deshacer (${undoStack.length})`;
}

/* ==========================================================================
   CONVERSIÓN PIGMENTARIA RYB REALISTA
   ========================================================================== */
function rgbToRyb(r, g, b) {
    let rN = r / 255, gN = g / 255, bN = b / 255;
    
    let max = Math.max(rN, gN, bN);
    let min = Math.min(rN, gN, bN);
    let lightness = (max + min) / 2;

    let k = lightness < 0.35 ? (1 - max) * 0.8 : 0;
    let w = min;

    let rP = rN - w, gP = gN - w, bP = bN - w;

    let yP = Math.min(rP, gP);
    rP -= yP; gP -= yP;

    let bMix = bP + (gP * 0.5);
    let rMix = rP;
    let yMix = yP + (gP * 0.5);

    let total = rMix + yMix + bMix + k + w;
    if (total === 0) return { r: 0, y: 0, b: 0, k: 0, w: 100 };

    return {
        r: (rMix / total) * 100,
        y: (yMix / total) * 100,
        b: (bMix / total) * 100,
        k: (k / total) * 100,
        w: (w / total) * 100
    };
}

function aplicarHexManual() {
    let val = hexInput.value.trim().replace('#', '');
    if (/^[0-9A-Fa-f]{6}$/.test(val)) {
        guardarEstadoEnHistorial(false);
        currentHexColor = val.toUpperCase();
        
        const r = parseInt(val.slice(0, 2), 16);
        const g = parseInt(val.slice(2, 4), 16);
        const b = parseInt(val.slice(4, 6), 16);
        
        currentProportions = rgbToRyb(r, g, b);
        renderizarHerramienta();
    } else {
        renderizarHerramienta();
    }
}

hexInput.addEventListener('change', aplicarHexManual);
hexInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        aplicarHexManual();
        hexInput.blur();
    }
});

colorDisplay.addEventListener('click', (e) => {
    e.stopPropagation();
    modoRuedaActivo = !modoRuedaActivo;
    
    scale = 1; posX = 0; posY = 0;
    zoomSlider.value = 1; zoomVal.textContent = "1.0x";

    if (modoRuedaActivo) {
        wheelCanvas.style.display = 'block';
        if (previewImage.src) previewImage.style.display = 'none';
        uploadPrompt.style.display = 'none';
        zoomSlider.disabled = false;
        dibujarRuedaCromatica();
    } else {
        wheelCanvas.style.display = 'none';
        if (previewImage.src) {
            previewImage.style.display = 'block';
            zoomSlider.disabled = false;
        } else {
            uploadPrompt.style.display = 'block';
            zoomSlider.disabled = true;
        }
    }
    limitarYAplicarTransformacion();
});

function dibujarRuedaCromatica() {
    const width = wheelCanvas.width;
    const height = wheelCanvas.height;
    const radius = width / 2 - 5;
    const ctx = ctxWheel;
    
    ctx.clearRect(0, 0, width, height);

    for (let x = -radius; x < radius; x++) {
        for (let y = -radius; y < radius; y++) {
            const distance = Math.sqrt(x * x + y * y);
            if (distance <= radius) {
                let angle = Math.atan2(y, x) * (180 / Math.PI);
                if (angle < 0) angle += 360;
                
                const sat = distance / radius;
                ctx.fillStyle = `hsl(${angle}, ${sat * 100}%, 50%)`;
                ctx.fillRect(width / 2 + x, height / 2 + y, 1, 1);
            }
        }
    }

    const r = parseInt(currentHexColor.slice(0, 2), 16);
    const g = parseInt(currentHexColor.slice(2, 4), 16);
    const b = parseInt(currentHexColor.slice(4, 6), 16);

    const hsl = rgbToHsl(r, g, b);
    const angleRad = hsl.h * (Math.PI / 180);
    const distPx = hsl.s * radius;

    const pinX = width / 2 + distPx * Math.cos(angleRad);
    const pinY = height / 2 + distPx * Math.sin(angleRad);

    ctx.beginPath();
    ctx.arc(pinX, pinY, 6, 0, 2 * Math.PI);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#000000';
    ctx.fill();

    if (modoRuedaActivo && scale > 1) {
        centrarRuedaEnPuntero(pinX, pinY);
    }
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
    }
    return { h, s, l };
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h / 360 + 1/3);
        g = hue2rgb(p, q, h / 360);
        b = hue2rgb(p, q, h / 360 - 1/3);
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

function procesarSeleccionRueda(clientX, clientY) {
    const rect = wheelCanvas.getBoundingClientRect();
    const localX = (clientX - rect.left) * (wheelCanvas.width / rect.width);
    const localY = (clientY - rect.top) * (wheelCanvas.height / rect.height);
    
    const cX = localX - wheelCanvas.width / 2;
    const cY = localY - wheelCanvas.height / 2;
    const radius = wheelCanvas.width / 2 - 5;
    
    const distance = Math.sqrt(cX * cX + cY * cY);
    const clampedDist = Math.min(distance, radius);
    
    let angle = Math.atan2(cY, cX) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    
    const sat = clampedDist / radius;
    const rgb = hslToRgb(angle, sat, 0.5);
    
    currentHexColor = [rgb.r, rgb.g, rgb.b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
    currentProportions = rgbToRyb(rgb.r, rgb.g, rgb.b);
    
    renderizarHerramienta();
}

wheelCanvas.addEventListener('mousedown', (e) => {
    arrastrandoEnRueda = true;
    guardarEstadoEnHistorial(true);
    procesarSeleccionRueda(e.clientX, e.clientY);
});
window.addEventListener('mousemove', (e) => {
    if (arrastrandoEnRueda) procesarSeleccionRueda(e.clientX, e.clientY);
});
window.addEventListener('mouseup', () => { arrastrandoEnRueda = false; });

wheelCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        arrastrandoEnRueda = true;
        guardarEstadoEnHistorial(true);
        procesarSeleccionRueda(e.touches[0].clientX, e.touches[0].clientY);
    }
}, {passive: true});
window.addEventListener('touchmove', (e) => {
    if (arrastrandoEnRueda && e.touches.length === 1) {
        procesarSeleccionRueda(e.touches[0].clientX, e.touches[0].clientY);
    }
});
window.addEventListener('touchend', () => { arrastrandoEnRueda = false; });

let scale = 1, posX = 0, posY = 0, isDragging = false, startX = 0, startY = 0, haHechoPaneo = false;

function centrarRuedaEnPuntero(pinX, pinY) {
    const centroX = wheelCanvas.width / 2;
    const centroY = wheelCanvas.height / 2;
    const offsetX = (centroX - pinX) * scale;
    const offsetY = (centroY - pinY) * scale;
    
    posX = offsetX;
    posY = offsetY;
    limitarYAplicarTransformacion();
}

zoomSlider.addEventListener('input', (e) => {
    scale = parseFloat(e.target.value);
    zoomVal.textContent = scale.toFixed(1) + "x";
    
    if (modoRuedaActivo) {
        dibujarRuedaCromatica();
    } else {
        limitarYAplicarTransformacion();
    }
});

dropZone.addEventListener('mousedown', (e) => {
    if ((!previewImage.src && !modoRuedaActivo)) return;
    isDragging = true; haHechoPaneo = false;
    startX = e.clientX - posX; startY = e.clientY - posY;
    e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const currentX = e.clientX - startX; const currentY = e.clientY - startY;
    if (Math.abs(currentX - posX) > 5 || Math.abs(currentY - posY) > 5) haHechoPaneo = true;
    posX = currentX; posY = currentY;
    limitarYAplicarTransformacion();
});
window.addEventListener('mouseup', () => { isDragging = false; });

dropZone.addEventListener('touchstart', (e) => {
    if ((!previewImage.src && !modoRuedaActivo)) return;
    if (e.touches.length === 1) {
        isDragging = true; haHechoPaneo = false;
        startX = e.touches[0].clientX - posX; startY = e.touches[0].clientY - posY;
    }
}, {passive: true});
window.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX - startX; const currentY = e.touches[0].clientY - startY;
    if (Math.abs(currentX - posX) > 5 || Math.abs(currentY - posY) > 5) haHechoPaneo = true;
    posX = currentX; posY = currentY;
    limitarYAplicarTransformacion();
});
window.addEventListener('touchend', () => { isDragging = false; });

function limitarYAplicarTransformacion() {
    if (scale === 1) { posX = 0; posY = 0; }
    const transformStr = `translate(${posX}px, ${posY}px) scale(${scale})`;
    if (modoRuedaActivo) {
        wheelCanvas.style.transform = transformStr;
    } else {
        previewImage.style.transform = transformStr;
    }
}

function porcentajeAFraccionTexto(pct) {
    if (pct < 1.5) return "0";
    const totalPartes = pct / 50; 
    const entero = Math.floor(totalPartes);
    const residuo = totalPartes - entero;

    let fraccionStr = "";
    if (residuo >= 0.875) fraccionStr = "1";
    else if (residuo >= 0.625) fraccionStr = "3/4";
    else if (residuo >= 0.416) fraccionStr = "1/2";
    else if (residuo >= 0.291) fraccionStr = "1/3";
    else if (residuo >= 0.187) fraccionStr = "1/4";
    else if (residuo >= 0.062) fraccionStr = "1/8";

    if (fraccionStr === "1") return (entero + 1) + "";
    if (entero > 0) return fraccionStr !== "" ? `${entero} ${fraccionStr}` : `${entero}`;
    return fraccionStr !== "" ? fraccionStr : "0";
}

/* ==========================================================================
   ACTUALIZACIÓN DE PROPORCIONES (MEZCLA LIBRE)
   ========================================================================== */
function balancearProporciones(llaveModificada, objetivoValor) {
    // Si se mueve un slider, la mezcla cambia y se calcula el nuevo color
    currentProportions[llaveModificada] = Math.min(100, Math.max(0, objetivoValor));
    const rgbObj = obtenerRgbActual();
    currentHexColor = [rgbObj.r, rgbObj.g, rgbObj.b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
    
    renderizarHerramienta();
}

const RYB_CUBE = [[1,1,1], [1,1,0], [1,0,0], [1,0.5,0], [0.16,0.38,0.68], [0,0.5,0], [0.5,0,0.5], [0.2,0.2,0.2]];

function interpolarRyb(rN, yN, bN) {
    let rgb = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
        const c000 = RYB_CUBE[0][i], c100 = RYB_CUBE[2][i], c010 = RYB_CUBE[1][i], c110 = RYB_CUBE[3][i],
              c001 = RYB_CUBE[4][i], c101 = RYB_CUBE[6][i], c011 = RYB_CUBE[5][i], c111 = RYB_CUBE[7][i];
        const c00 = c000 * (1 - rN) + c100 * rN;
        const c10 = c010 * (1 - rN) + c110 * rN;
        const c01 = c001 * (1 - rN) + c101 * rN;
        const c11 = c011 * (1 - rN) + c111 * rN;
        const c0 = c00 * (1 - yN) + c10 * yN; const c1 = c01 * (1 - yN) + c11 * yN;
        rgb[i] = c0 * (1 - bN) + c1 * bN;
    }
    return rgb;
}

function obtenerRgbActual() {
    const rMat = currentProportions.r / 100;
    const yMat = currentProportions.y / 100;
    const bMat = currentProportions.b / 100;
    
    let rgbBase = interpolarRyb(rMat, yMat, bMat);
    
    const factorK = 1 - (currentProportions.k / 100);
    let r = rgbBase[0] * factorK;
    let g = rgbBase[1] * factorK;
    let b = rgbBase[2] * factorK;
    
    const factorW = currentProportions.w / 100;
    r = r * (1 - factorW) + factorW;
    g = g * (1 - factorW) + factorW;
    b = b * (1 - factorW) + factorW;

    return {
        r: Math.min(255, Math.max(0, Math.round(r * 255))),
        g: Math.min(255, Math.max(0, Math.round(g * 255))),
        b: Math.min(255, Math.max(0, Math.round(b * 255)))
    };
}

function renderizarHerramienta() {
    const estaBloqueadoElColor = lockColorToggle.checked;

    Object.keys(currentProportions).forEach(key => {
        const pct = currentProportions[key];
        const sliderEl = sliders[key];

        sliderEl.value = Math.round(pct);
        // Deshabilitar sliders si "Fijar color" está activo
        sliderEl.disabled = estaBloqueadoElColor;

        if (esModoPartes) {
            boxes[key].innerHTML = `<span class="parts-text">${porcentajeAFraccionTexto(pct)}</span>`;
        } else {
            boxes[key].innerHTML = `<input type="number" id="num-${key}" class="percentage-input" min="0" max="100" value="${Math.round(pct)}" ${estaBloqueadoElColor ? 'disabled' : ''}><span style="font-size:12px;margin-left:1px;color:#86868b">%</span>`;
            
            if (!estaBloqueadoElColor) {
                const nuevoInput = document.getElementById(`num-${key}`);
                nuevoInput.addEventListener('focus', () => { guardarEstadoEnHistorial(false); });
                nuevoInput.addEventListener('change', (e) => { 
                    guardarEstadoEnHistorial(false);
                    balancearProporciones(key, parseInt(e.target.value) || 0); 
                });
            }
        }
    });

    colorDisplay.style.backgroundColor = '#' + currentHexColor;
    if (document.activeElement !== hexInput) {
        hexInput.value = currentHexColor;
    }

    if (modoRuedaActivo) dibujarRuedaCromatica();
}

lockColorToggle.addEventListener('change', () => {
    renderizarHerramienta();
});

window.cargarColorEnMezclador = function(hex) {
    const val = hex.replace('#', '').toUpperCase();
    guardarEstadoEnHistorial(false);
    currentHexColor = val;
    const r = parseInt(val.slice(0, 2), 16);
    const g = parseInt(val.slice(2, 4), 16);
    const b = parseInt(val.slice(4, 6), 16);
    
    currentProportions = rgbToRyb(r, g, b);
    renderizarHerramienta();

    const modalEl = document.getElementById("paletteModal");
    if (modalEl) modalEl.classList.remove("active");

    switchPage('mixer');
};

Object.keys(sliders).forEach(key => {
    sliders[key].addEventListener('mousedown', () => { guardarEstadoEnHistorial(false); });
    sliders[key].addEventListener('touchstart', () => { guardarEstadoEnHistorial(false); }, {passive: true});
    sliders[key].addEventListener('input', (e) => { 
        balancearProporciones(key, parseInt(e.target.value)); 
    });
});

modeToggle.addEventListener('change', (e) => {
    esModoPartes = e.target.checked;
    document.getElementById('lbl-pct').classList.toggle('active', !esModoPartes);
    document.getElementById('lbl-parts').classList.toggle('active', esModoPartes);
    document.getElementById('panelTitle').textContent = esModoPartes ? "Proporciones en Partes (Base 50% = 1 Parte)" : "Proporciones de la Paleta";
    renderizarHerramienta();
});

saveBtn.addEventListener('click', () => {
    const hex = '#' + currentHexColor;
    const propCopia = { ...currentProportions };
    
    savedColors.unshift({ hex, proportions: propCopia, id: Date.now() });
    localStorage.setItem('savedPalettes', JSON.stringify(savedColors));
    renderizarListaGuardados();
});

window.cargarMezclaGuardada = function(id) {
    const item = savedColors.find(c => c.id === id);
    if (item) {
        guardarEstadoEnHistorial(false);
        currentProportions = { ...item.proportions };
        currentHexColor = item.hex.replace('#', '');
        renderizarHerramienta();
    }
};

window.borrarMezclaGuardada = function(id) {
    savedColors = savedColors.filter(c => c.id !== id);
    localStorage.setItem('savedPalettes', JSON.stringify(savedColors));
    renderizarListaGuardados();
};

function renderizarListaGuardados() {
    if (savedColors.length === 0) {
        savedList.innerHTML = `<div style="font-size: 12px; color: #86868b; text-align: center;">No hay mezclas guardadas aún.</div>`;
        return;
    }

    const mostradas = expandirMezclasGuardadas ? savedColors : savedColors.slice(0, 2);

    let html = mostradas.map(item => {
        const p = item.proportions;
        const resumenText = `R:${Math.round(p.r)}% Y:${Math.round(p.y)}% B:${Math.round(p.b)}% K:${Math.round(p.k)}% W:${Math.round(p.w)}%`;
        return `
            <div class="saved-card">
                <div class="saved-card-left">
                    <div class="saved-circle" style="background-color: ${item.hex};"></div>
                    <div class="saved-info">
                        <span class="saved-hex">${item.hex}</span>
                        <span class="saved-details">${resumenText}</span>
                    </div>
                </div>
                <div class="saved-actions">
                    <button class="btn-small" onclick="cargarMezclaGuardada(${item.id})">Cargar</button>
                    <button class="btn-small btn-del" onclick="borrarMezclaGuardada(${item.id})">✕</button>
                </div>
            </div>
        `;
    }).join('');

    if (savedColors.length > 2) {
        html += `
            <button class="toggle-expand-btn" onclick="toggleExpandirMezclas()">
                ${expandirMezclasGuardadas ? '▲ Ver menos' : `▼ Ver más (${savedColors.length - 2} restantes)`}
            </button>
        `;
    }

    savedList.innerHTML = html;
}

window.toggleExpandirMezclas = function() {
    expandirMezclasGuardadas = !expandirMezclasGuardadas;
    renderizarListaGuardados();
};

const fileInput = document.getElementById('fileInput');
const canvasAux = document.getElementById('canvasAux');
const ctxAux = canvasAux.getContext('2d');

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            previewImage.src = event.target.result;
            previewImage.style.display = 'block';
            wheelCanvas.style.display = 'none';
            modoRuedaActivo = false;
            uploadPrompt.style.display = 'none';
            zoomSlider.disabled = false;
            scale = 1; posX = 0; posY = 0; zoomSlider.value = 1; zoomVal.textContent = "1.0x";
            limitarYAplicarTransformacion();
        }
        reader.readAsDataURL(file);
    }
});

previewImage.addEventListener('click', function(e) {
    if (haHechoPaneo || modoRuedaActivo) return; 
    e.stopPropagation();

    guardarEstadoEnHistorial(true);

    canvasAux.width = previewImage.naturalWidth;
    canvasAux.height = previewImage.naturalHeight;
    ctxAux.drawImage(previewImage, 0, 0);

    const rectImg = previewImage.getBoundingClientRect();
    const clickXVisual = e.clientX - rectImg.left;
    const clickYVisual = e.clientY - rectImg.top;

    const xCenterX = Math.floor((clickXVisual / rectImg.width) * canvasAux.width);
    const yCenterY = Math.floor((clickYVisual / rectImg.height) * canvasAux.height);

    const size = parseInt(sampleSizeSelect.value) || 1;
    const half = Math.floor(size / 2);

    let sumR = 0, sumG = 0, sumB = 0, count = 0;

    for (let dx = -half; dx <= half; dx++) {
        for (let dy = -half; dy <= half; dy++) {
            const px = xCenterX + dx;
            const py = yCenterY + dy;

            if (px >= 0 && px < canvasAux.width && py >= 0 && py < canvasAux.height) {
                const data = ctxAux.getImageData(px, py, 1, 1).data;
                if (data[3] > 0) { 
                    sumR += data[0];
                    sumG += data[1];
                    sumB += data[2];
                    count++;
                }
            }
        }
    }

    if (count > 0) {
        const avgR = Math.round(sumR / count);
        const avgG = Math.round(sumG / count);
        const avgB = Math.round(sumB / count);

        currentHexColor = [avgR, avgG, avgB].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
        currentProportions = rgbToRyb(avgR, avgG, avgB);
        renderizarHerramienta();
    }
});

renderizarHerramienta();
renderizarListaGuardados();
