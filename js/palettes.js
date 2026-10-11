/* ==========================================================================
   js/palettes.js - Generador de Paletas, Armonías Teóricas y Modales
   ========================================================================== */

// Base de datos de paletas por categoría según la teoría del color
const BASE_PALETTES = [
    { id: 1, title: "Ocaso Cálido", category: "calidas", colors: ["#D35400", "#E67E22", "#F1C40F", "#E74C3C", "#C0392B"] },
    { id: 2, title: "Tierra de Siena", category: "calidas", colors: ["#8B4513", "#A0522D", "#CD853F", "#DEB887", "#F5DEB3"] },
    { id: 3, title: "Noche Profunda", category: "frias", colors: ["#1B2631", "#283747", "#2E4053", "#5D6D7E", "#AEB6BF"] },
    { id: 4, title: "Marina de Urabá", category: "frias", colors: ["#117864", "#16A085", "#48C9B0", "#76D7C4", "#A3E4D7"] },
    { id: 5, title: "Primavera Dulce", category: "pastel", colors: ["#FADBD8", "#F5CBA7", "#FCF3CF", "#D4EFDF", "#D6EAF8"] },
    { id: 6, title: "Bruma Suave", category: "pastel", colors: ["#E8DAEF", "#D4E6F1", "#D1F2EB", "#FCF3CF", "#FADBD8"] },
    { id: 7, title: "Complementarios Puros", category: "contraste", colors: ["#0055B8", "#FF3B30", "#FFCC00", "#000000", "#FFFFFF"] },
    { id: 8, title: "Tríada Vibrante", category: "contraste", colors: ["#8E44AD", "#27AE60", "#D35400", "#2980B9", "#F1C40F"] }
];

let activePaletteModal = null;

// Inicializa las paletas al cargar la aplicación
document.addEventListener("DOMContentLoaded", () => {
    generarPaletaSorpresa();
    renderizarGridPaletas('todas');
});

// 1. GENERADOR "SORPRÉNDEME CON NUEVA PALETA"
function generarPaletaSorpresa() {
    const hueBase = Math.floor(Math.random() * 360);
    const count = 5;
    const colors = [];
    
    for (let i = 0; i < count; i++) {
        const h = (hueBase + (i * 35)) % 360;
        const s = 50 + Math.floor(Math.random() * 40);
        const l = 40 + Math.floor(Math.random() * 30);
        colors.push(hslToHex(h, s, l));
    }

    const container = document.getElementById("surprisePaletteContainer");
    container.innerHTML = crearBarraPaletaHTML("Paleta Sorpresa", colors);
}

// 2. COMPLETADOR DE PALETA PERSONALIZADA (1-3 Colores -> N Colores)
function generarPaletaCompletada() {
    const inputs = [
        document.getElementById("hexSeed1").value.trim().replace('#', ''),
        document.getElementById("hexSeed2").value.trim().replace('#', ''),
        document.getElementById("hexSeed3").value.trim().replace('#', '')
    ].filter(v => /^[0-9A-Fa-f]{6}$/.test(v));

    if (inputs.length === 0) {
        alert("Ingresa al menos un código HEX válido (ej. E67E22).");
        return;
    }

    const totalN = parseInt(document.getElementById("paletteNCount").value) || 5;
    const resultColors = inputs.map(h => "#" + h.toUpperCase());

    let baseHsl = hexToHsl(inputs[0]);
    let faltantes = totalN - resultColors.length;

    for (let i = 1; i <= faltantes; i++) {
        let newHue = (baseHsl.h + (i * (360 / (totalN + 1)))) % 360;
        resultColors.push(hslToHex(newHue, baseHsl.s, baseHsl.l));
    }

    const container = document.getElementById("customBuildContainer");
    container.innerHTML = crearBarraPaletaHTML("Paleta Personalizada", resultColors);
}

// 3. RENDERIZADO Y FILTRADO POR CATEGORÍA
function filtrarCategoria(cat, elemento) {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    elemento.classList.add('active');
    renderizarGridPaletas(cat);
}

function renderizarGridPaletas(categoria) {
    const grid = document.getElementById("palettesGrid");
    const filtradas = (categoria === 'todas') 
        ? BASE_PALETTES 
        : BASE_PALETTES.filter(p => p.category === categoria);

    grid.innerHTML = filtradas.map(p => `
        <div style="background:#f5f5f7; padding:10px; border-radius:10px; border:1px solid #e5e5e7;">
            <div style="font-size:12px; font-weight:600; margin-bottom:6px; color:#1d1d1f;">${p.title}</div>
            ${crearBarraPaletaHTML(p.title, p.colors)}
        </div>
    `).join('');
}

// Genera la vista previa interactiva en miniatura
function crearBarraPaletaHTML(titulo, colorsArray) {
    const colorsJson = JSON.stringify(colorsArray).replace(/"/g, '&quot;');
    const swatches = colorsArray.map(c => `
        <div class="palette-color-swatch" style="background-color: ${c};" title="${c}"></div>
    `).join('');

    return `
        <div class="palette-bar" onclick="abrirModalDetalle('${titulo}', ${colorsJson})">
            ${swatches}
        </div>
    `;
}

// 4. MODAL DETALLADO DE LA PALETA
function abrirModalDetalle(titulo, colorsArray) {
    activePaletteModal = { titulo, colorsArray };
    document.getElementById("modalPaletteTitle").textContent = titulo;
    
    // Muestra la barra superior en grande
    document.getElementById("modalPaletteBar").innerHTML = `
        <div class="palette-bar" style="height: 50px; cursor:default;">
            ${colorsArray.map(c => `<div class="palette-color-swatch" style="background-color: ${c};"></div>`).join('')}
        </div>
    `;

    // Genera la lista de códigos HEX para seleccionar y enviar al Mezclador
    document.getElementById("modalColorsList").innerHTML = colorsArray.map(c => `
        <div class="modal-color-row" onclick="seleccionarColorDePaleta('${c}')">
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="modal-swatch-circle" style="background-color:${c};"></div>
                <span style="font-family:monospace; font-size:13px; font-weight:600;">${c}</span>
            </div>
            <span style="font-size:12px; color:#0066cc; font-weight:600;">Cargar en Mezclador ➔</span>
        </div>
    `).join('');

    document.getElementById("paletteModal").classList.add("active");
}

function seleccionarColorDePaleta(hex) {
    cerrarModalDetalleDirecto();
    cargarColorEnMezclador(hex);
}

function cerrarModalDetalle(e) {
    if (e.target.id === "paletteModal") {
        document.getElementById("paletteModal").classList.remove("active");
    }
}

function cerrarModalDetalleDirecto() {
    document.getElementById("paletteModal").classList.remove("active");
}

// Funciones auxiliares de conversión HSL / HEX
function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x = c * (1 - Math.abs((h / 60) % 2 - 1));
    let m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

    r = Math.round((r + m) * 255).toString(16).padStart(2, '0');
    g = Math.round((g + m) * 255).toString(16).padStart(2, '0');
    b = Math.round((b + m) * 255).toString(16).padStart(2, '0');

    return `#${r}${g}${b}`.toUpperCase();
}

function hexToHsl(hex) {
    let r = parseInt(hex.slice(0, 2), 16) / 255;
    let g = parseInt(hex.slice(2, 4), 16) / 255;
    let b = parseInt(hex.slice(4, 6), 16) / 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
}
