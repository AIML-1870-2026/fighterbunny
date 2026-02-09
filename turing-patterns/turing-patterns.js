/**
 * Turing Patterns Explorer
 * A reaction-diffusion simulation implementing the Gray-Scott model
 */

// ============================================
// Configuration and Presets
// ============================================

const PRESETS = [
    { name: 'Leopard', f: 0.038, k: 0.061 },
    { name: 'Zebra', f: 0.033, k: 0.056 },
    { name: 'Bubbles', f: 0.025, k: 0.052 },
    { name: 'Worms', f: 0.054, k: 0.063 },
    { name: 'Honeycomb', f: 0.037, k: 0.059 },
    { name: 'Ripples', f: 0.018, k: 0.050 }
];

const COLOR_SCHEMES = [
    { name: 'Pink', id: 'pink' },
    { name: 'Ocean', id: 'ocean' },
    { name: 'Fire', id: 'heat' },
    { name: 'Grayscale', id: 'grayscale' },
    { name: 'Rainbow', id: 'rainbow' }
];

const COLOR_FUNCTIONS = {
    pink: (v) => {
        const colors = [
            [0, 0, 0], [30, 5, 20], [60, 10, 40], [100, 20, 60],
            [150, 40, 90], [200, 80, 130], [240, 130, 170], [255, 180, 210], [255, 220, 240]
        ];
        const idx = Math.min(Math.floor(v * (colors.length - 1)), colors.length - 2);
        const t = (v * (colors.length - 1)) - idx;
        return colors[idx].map((c, i) => Math.floor(c + t * (colors[idx + 1][i] - c)));
    },
    ocean: (v) => {
        const colors = [
            [10, 20, 60], [20, 50, 120], [30, 80, 160], [50, 120, 180],
            [80, 160, 200], [120, 190, 220], [180, 220, 240], [230, 245, 255]
        ];
        const idx = Math.min(Math.floor(v * (colors.length - 1)), colors.length - 2);
        const t = (v * (colors.length - 1)) - idx;
        return colors[idx].map((c, i) => Math.floor(c + t * (colors[idx + 1][i] - c)));
    },
    heat: (v) => {
        const colors = [
            [20, 10, 30], [80, 20, 50], [160, 40, 40], [220, 80, 30],
            [250, 150, 30], [255, 220, 80], [255, 255, 200]
        ];
        const idx = Math.min(Math.floor(v * (colors.length - 1)), colors.length - 2);
        const t = (v * (colors.length - 1)) - idx;
        return colors[idx].map((c, i) => Math.floor(c + t * (colors[idx + 1][i] - c)));
    },
    grayscale: (v) => {
        const c = Math.floor(v * 255);
        return [c, c, c];
    },
    purple: (v) => {
        const colors = [
            [20, 10, 40], [50, 20, 80], [80, 40, 140], [120, 60, 180],
            [160, 100, 200], [200, 150, 220], [230, 200, 245], [255, 240, 255]
        ];
        const idx = Math.min(Math.floor(v * (colors.length - 1)), colors.length - 2);
        const t = (v * (colors.length - 1)) - idx;
        return colors[idx].map((c, i) => Math.floor(c + t * (colors[idx + 1][i] - c)));
    },
    rainbow: (v) => {
        const h = v * 300;
        const s = 0.9, l = 0.5;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;
        let r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        return [Math.floor((r + m) * 255), Math.floor((g + m) * 255), Math.floor((b + m) * 255)];
    }
};

// ============================================
// Simulation Class
// ============================================

class TuringSimulation {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.size = width * height;

        this.u = new Float32Array(this.size);
        this.v = new Float32Array(this.size);
        this.uNext = new Float32Array(this.size);
        this.vNext = new Float32Array(this.size);

        this.Du = 0.16;
        this.Dv = 0.08;
        this.f = 0.038;
        this.k = 0.061;
        this.dt = 1.0;

        this.iterations = 0;
        this.reset();
    }

    reset() {
        this.u.fill(1);
        this.v.fill(0);

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const seedRadius = Math.min(this.width, this.height) / 8;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < seedRadius) {
                    const idx = y * this.width + x;
                    this.u[idx] = 0.5 + Math.random() * 0.1;
                    this.v[idx] = 0.25 + Math.random() * 0.1;
                }
            }
        }

        for (let i = 0; i < 8; i++) {
            const sx = Math.floor(Math.random() * this.width);
            const sy = Math.floor(Math.random() * this.height);
            this.addSpot(sx, sy, 8, 0.5);
        }

        this.iterations = 0;
    }

    clear() {
        this.u.fill(1);
        this.v.fill(0);
        this.iterations = 0;
    }

    addSpot(cx, cy, radius, intensity) {
        const r2 = radius * radius;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= r2) {
                    let x = (cx + dx + this.width) % this.width;
                    let y = (cy + dy + this.height) % this.height;
                    const idx = y * this.width + x;
                    this.v[idx] = Math.min(1, this.v[idx] + intensity);
                    this.u[idx] = Math.max(0, this.u[idx] - intensity * 0.5);
                }
            }
        }
    }

    laplacian(arr, x, y) {
        const w = this.width;
        const h = this.height;

        const xm = (x - 1 + w) % w;
        const xp = (x + 1) % w;
        const ym = (y - 1 + h) % h;
        const yp = (y + 1) % h;

        const center = arr[y * w + x];
        const left = arr[y * w + xm];
        const right = arr[y * w + xp];
        const up = arr[ym * w + x];
        const down = arr[yp * w + x];
        const ul = arr[ym * w + xm];
        const ur = arr[ym * w + xp];
        const dl = arr[yp * w + xm];
        const dr = arr[yp * w + xp];

        return (left + right + up + down) * 0.2 + (ul + ur + dl + dr) * 0.05 - center;
    }

    step() {
        const { u, v, uNext, vNext, Du, Dv, f, k, dt, width, height } = this;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                const uVal = u[idx];
                const vVal = v[idx];

                const lapU = this.laplacian(u, x, y);
                const lapV = this.laplacian(v, x, y);
                const uvv = uVal * vVal * vVal;

                uNext[idx] = uVal + dt * (Du * lapU - uvv + f * (1 - uVal));
                vNext[idx] = vVal + dt * (Dv * lapV + uvv - (f + k) * vVal);

                uNext[idx] = Math.max(0, Math.min(1, uNext[idx]));
                vNext[idx] = Math.max(0, Math.min(1, vNext[idx]));
            }
        }

        [this.u, this.uNext] = [this.uNext, this.u];
        [this.v, this.vNext] = [this.vNext, this.v];
        this.iterations++;
    }

    setParameters(params) {
        if (params.f !== undefined) this.f = params.f;
        if (params.k !== undefined) this.k = params.k;
    }
}

// ============================================
// Renderer Class
// ============================================

class Renderer {
    constructor(canvas, simulation) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.simulation = simulation;
        this.colorScheme = 'pink';
        this.resize();
    }

    resize() {
        this.canvas.width = this.simulation.width;
        this.canvas.height = this.simulation.height;
        this.imageData = this.ctx.createImageData(this.simulation.width, this.simulation.height);
    }

    render() {
        const { v } = this.simulation;
        const data = this.imageData.data;
        const colorFn = COLOR_FUNCTIONS[this.colorScheme];

        for (let i = 0; i < v.length; i++) {
            const [r, g, b] = colorFn(v[i]);
            const pixelIdx = i * 4;
            data[pixelIdx] = r;
            data[pixelIdx + 1] = g;
            data[pixelIdx + 2] = b;
            data[pixelIdx + 3] = 255;
        }

        this.ctx.putImageData(this.imageData, 0, 0);
    }

    setColorScheme(scheme) {
        this.colorScheme = scheme;
    }
}

// ============================================
// Phase Diagram
// ============================================

class PhaseDiagram {
    constructor(canvas, onSelect) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onSelect = onSelect;
        this.currentF = 0.038;
        this.currentK = 0.061;

        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.render();
    }

    render() {
        const { ctx, canvas } = this;
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, w, h);

        // Draw pattern regions with circles
        const regions = [
            { name: 'Ripples', f: 0.018, k: 0.050, color: '#06b6d4' },
            { name: 'Zebra', f: 0.033, k: 0.056, color: '#f97316' },
            { name: 'Leopard', f: 0.038, k: 0.061, color: '#ef4444' },
            { name: 'Worms', f: 0.054, k: 0.063, color: '#eab308' },
            { name: 'Bubbles', f: 0.025, k: 0.052, color: '#22c55e' }
        ];

        regions.forEach(region => {
            const x = (region.f / 0.08) * w;
            const y = (1 - region.k / 0.08) * h;

            ctx.beginPath();
            ctx.arc(x, y, 18, 0, Math.PI * 2);
            ctx.fillStyle = region.color + '40';
            ctx.fill();
            ctx.strokeStyle = region.color;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#1e293b';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(region.name, x, y + 30);
        });

        // Draw axes
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20, h - 20);
        ctx.lineTo(w - 10, h - 20);
        ctx.moveTo(20, h - 20);
        ctx.lineTo(20, 10);
        ctx.stroke();

        // Axis labels
        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('F', w / 2, h - 5);
        ctx.save();
        ctx.translate(10, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('K', 0, 0);
        ctx.restore();

        // Current position marker
        const markerX = (this.currentF / 0.08) * w;
        const markerY = (1 - this.currentK / 0.08) * h;

        ctx.beginPath();
        ctx.arc(markerX, markerY, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ec4899';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const f = (x * scaleX / this.canvas.width) * 0.08;
        const k = (1 - (y * scaleY / this.canvas.height)) * 0.08;

        this.currentF = Math.max(0.005, Math.min(0.08, f));
        this.currentK = Math.max(0.03, Math.min(0.08, k));

        this.onSelect(this.currentF, this.currentK);
        this.render();
    }

    setPosition(f, k) {
        this.currentF = f;
        this.currentK = k;
        this.render();
    }
}

// ============================================
// Main Application
// ============================================

class TuringApp {
    constructor() {
        this.canvas = document.getElementById('simulation-canvas');
        this.simulation = new TuringSimulation(400, 400);
        this.renderer = new Renderer(this.canvas, this.simulation);

        this.isPlaying = true;
        this.speed = 10;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;

        this.isDrawing = false;
        this.brushSize = 15;

        this.activePreset = 0;
        this.activeColor = 0;

        this.initPresets();
        this.initColorButtons();
        this.initPhaseDiagram();
        this.initEventListeners();
        this.initKeyboardShortcuts();

        this.loadPreset(0);
        this.animate();
    }

    initPresets() {
        const grid = document.getElementById('preset-grid');
        PRESETS.forEach((preset, index) => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn' + (index === 0 ? ' active' : '');
            btn.textContent = preset.name;
            btn.addEventListener('click', () => this.loadPreset(index));
            grid.appendChild(btn);
        });
    }

    initColorButtons() {
        const grid = document.getElementById('color-grid');
        COLOR_SCHEMES.forEach((scheme, index) => {
            const btn = document.createElement('button');
            btn.className = 'color-btn' + (index === 0 ? ' active' : '');
            btn.textContent = scheme.name;
            btn.addEventListener('click', () => this.setColorScheme(index));
            grid.appendChild(btn);
        });
    }

    initPhaseDiagram() {
        const phaseCanvas = document.getElementById('phase-canvas');
        this.phaseDiagram = new PhaseDiagram(phaseCanvas, (f, k) => {
            this.simulation.setParameters({ f, k });
            document.getElementById('feed-rate').value = f;
            document.getElementById('kill-rate').value = k;
            document.getElementById('feed-value').textContent = f.toFixed(3);
            document.getElementById('kill-value').textContent = k.toFixed(3);
            this.clearActivePreset();
        });
    }

    loadPreset(index) {
        const preset = PRESETS[index];
        this.simulation.setParameters({ f: preset.f, k: preset.k });

        document.getElementById('feed-rate').value = preset.f;
        document.getElementById('kill-rate').value = preset.k;
        document.getElementById('feed-value').textContent = preset.f.toFixed(3);
        document.getElementById('kill-value').textContent = preset.k.toFixed(3);

        this.phaseDiagram.setPosition(preset.f, preset.k);

        document.querySelectorAll('.preset-btn').forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });
        this.activePreset = index;
    }

    clearActivePreset() {
        document.querySelectorAll('.preset-btn').forEach(el => {
            el.classList.remove('active');
        });
        this.activePreset = -1;
    }

    setColorScheme(index) {
        const scheme = COLOR_SCHEMES[index];
        this.renderer.setColorScheme(scheme.id);

        document.querySelectorAll('.color-btn').forEach((el, i) => {
            el.classList.toggle('active', i === index);
        });
        this.activeColor = index;

        if (!this.isPlaying) {
            this.renderer.render();
        }
    }

    initEventListeners() {
        // Play/Pause
        document.getElementById('play-pause-btn').addEventListener('click', () => this.togglePlay());
        document.getElementById('reset-btn').addEventListener('click', () => this.reset());
        document.getElementById('clear-btn').addEventListener('click', () => this.clear());
        document.getElementById('save-image-btn').addEventListener('click', () => this.saveImage());

        // Sliders
        document.getElementById('feed-rate').addEventListener('input', (e) => {
            const f = parseFloat(e.target.value);
            this.simulation.setParameters({ f });
            document.getElementById('feed-value').textContent = f.toFixed(3);
            this.phaseDiagram.setPosition(f, this.simulation.k);
            this.clearActivePreset();
        });

        document.getElementById('kill-rate').addEventListener('input', (e) => {
            const k = parseFloat(e.target.value);
            this.simulation.setParameters({ k });
            document.getElementById('kill-value').textContent = k.toFixed(3);
            this.phaseDiagram.setPosition(this.simulation.f, k);
            this.clearActivePreset();
        });

        document.getElementById('speed-slider').addEventListener('input', (e) => {
            this.speed = parseInt(e.target.value);
            document.getElementById('speed-value').textContent = this.speed + 'x';
        });

        // Canvas drawing
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseleave', () => this.stopDrawing());

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startDrawing(e.touches[0]);
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.draw(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', () => this.stopDrawing());

        // Modal
        document.getElementById('about-btn').addEventListener('click', () => {
            document.getElementById('about-modal').style.display = 'flex';
        });
        document.getElementById('close-modal').addEventListener('click', () => {
            document.getElementById('about-modal').style.display = 'none';
        });
    }

    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;

            switch (e.key.toLowerCase()) {
                case ' ':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'r':
                    this.reset();
                    break;
                case 'c':
                    this.clear();
                    break;
                case 's':
                    e.preventDefault();
                    this.saveImage();
                    break;
                case '1': case '2': case '3': case '4': case '5': case '6':
                    this.loadPreset(parseInt(e.key) - 1);
                    break;
            }
        });
    }

    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.simulation.width / rect.width;
        const scaleY = this.simulation.height / rect.height;

        return {
            x: Math.floor((e.clientX - rect.left) * scaleX),
            y: Math.floor((e.clientY - rect.top) * scaleY)
        };
    }

    startDrawing(e) {
        this.isDrawing = true;
        this.draw(e);
    }

    draw(e) {
        if (!this.isDrawing) return;
        const { x, y } = this.getCanvasCoords(e);
        this.simulation.addSpot(x, y, this.brushSize, 0.8);
        if (!this.isPlaying) {
            this.renderer.render();
        }
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        document.getElementById('play-pause-btn').textContent = this.isPlaying ? 'Pause' : 'Play';
        if (this.isPlaying) {
            this.lastFrameTime = performance.now();
            this.animate();
        }
    }

    reset() {
        this.simulation.reset();
        this.renderer.render();
        this.updateCounters();
    }

    clear() {
        this.simulation.clear();
        this.renderer.render();
        this.updateCounters();
    }

    animate() {
        if (!this.isPlaying) return;

        for (let i = 0; i < this.speed; i++) {
            this.simulation.step();
        }

        this.renderer.render();
        this.frameCount++;

        const now = performance.now();
        if (now - this.lastFrameTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFrameTime = now;
            this.updateCounters();
        }

        requestAnimationFrame(() => this.animate());
    }

    updateCounters() {
        document.getElementById('fps-counter').textContent = this.fps;
        document.getElementById('iteration-counter').textContent = this.simulation.iterations;
    }

    saveImage() {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `turing-pattern-${timestamp}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TuringApp();
});
