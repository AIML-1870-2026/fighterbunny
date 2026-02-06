// ============== SETUP ==============
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');

// ============== STATE ==============
let boids = [];
let obstacles = [];
let stars = [];
let isPaused = false;
let boundaryMode = 'bounce';
let mouseMode = 'attract';
let trailsEnabled = true;
let trailAlpha = 0.15;
let obstaclesEnabled = true;
let currentTheme = 'minimal';

// Parameters (mutable)
let params = {
    separation: 0.05,
    alignment: 0.05,
    cohesion: 0.005,
    radius: 75,
    maxSpeed: 4,
    minSpeed: 2,
    separationDistance: 25
};

// Mouse state
let mouse = { x: 0, y: 0, active: false };
let draggedObstacle = null;

// FPS tracking
let frameCount = 0;
let lastFpsUpdate = performance.now();
let currentFps = 60;

// ============== CANVAS RESIZE ==============
function resizeCanvas() {
    canvas.width = window.innerWidth - 320;
    canvas.height = window.innerHeight;
    // Reinitialize stars for new canvas size
    if (stars.length > 0) {
        initStars(200);
    }
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============== PRESETS ==============
const presets = {
    schooling: {
        separation: 0.03,
        alignment: 0.12,
        cohesion: 0.008,
        radius: 100,
        maxSpeed: 4
    },
    chaotic: {
        separation: 0.08,
        alignment: 0.01,
        cohesion: 0.002,
        radius: 40,
        maxSpeed: 6
    },
    cluster: {
        separation: 0.04,
        alignment: 0.03,
        cohesion: 0.015,
        radius: 120,
        maxSpeed: 3
    }
};

// ============== THEME COLORS ==============
const themeColors = {
    minimal: {
        bg: '#0d0d1a',
        boid: '#ffb6c1',
        trail: 'rgba(255, 182, 193, 0.3)',
        obstacle: 'rgba(255, 105, 180, 0.6)',
        obstacleBorder: '#ff69b4'
    },
    neon: {
        bg: '#0a0a0a',
        boid: '#ff00ff',
        trail: 'rgba(255, 0, 255, 0.4)',
        obstacle: 'rgba(0, 255, 255, 0.4)',
        obstacleBorder: '#00ffff'
    },
    nature: {
        bg: '#1a2f1a',
        boid: '#98d998',
        trail: 'rgba(152, 217, 152, 0.3)',
        obstacle: 'rgba(139, 90, 43, 0.6)',
        obstacleBorder: '#8b5a2b'
    }
};

// ============== BOID CLASS ==============
class Boid {
    constructor(x, y) {
        this.x = x ?? Math.random() * canvas.width;
        this.y = y ?? Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * params.maxSpeed * 2;
        this.vy = (Math.random() - 0.5) * params.maxSpeed * 2;
        this.neighborCount = 0;
    }

    separation() {
        let moveX = 0, moveY = 0;
        for (const other of boids) {
            if (other !== this) {
                const dx = this.x - other.x;
                const dy = this.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < params.separationDistance && dist > 0) {
                    moveX += dx / dist;
                    moveY += dy / dist;
                }
            }
        }
        this.vx += moveX * params.separation;
        this.vy += moveY * params.separation;
    }

    alignment() {
        let avgVX = 0, avgVY = 0, neighbors = 0;
        for (const other of boids) {
            if (other !== this) {
                const dist = this.distance(other);
                if (dist < params.radius) {
                    avgVX += other.vx;
                    avgVY += other.vy;
                    neighbors++;
                }
            }
        }
        if (neighbors > 0) {
            avgVX /= neighbors;
            avgVY /= neighbors;
            this.vx += (avgVX - this.vx) * params.alignment;
            this.vy += (avgVY - this.vy) * params.alignment;
        }
        this.neighborCount = neighbors;
    }

    cohesion() {
        let centerX = 0, centerY = 0, neighbors = 0;
        for (const other of boids) {
            if (other !== this) {
                const dist = this.distance(other);
                if (dist < params.radius) {
                    centerX += other.x;
                    centerY += other.y;
                    neighbors++;
                }
            }
        }
        if (neighbors > 0) {
            centerX /= neighbors;
            centerY /= neighbors;
            this.vx += (centerX - this.x) * params.cohesion;
            this.vy += (centerY - this.y) * params.cohesion;
        }
    }

    avoidObstacles() {
        if (!obstaclesEnabled) return;
        for (const obs of obstacles) {
            const dx = this.x - obs.x;
            const dy = this.y - obs.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const avoidRadius = obs.radius + 50;

            if (dist < avoidRadius && dist > 0) {
                const force = (avoidRadius - dist) / avoidRadius;
                this.vx += (dx / dist) * force * 0.5;
                this.vy += (dy / dist) * force * 0.5;
            }
        }
    }

    followMouse() {
        if (!mouse.active || mouseMode === 'off') return;

        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 200 && dist > 0) {
            const force = (200 - dist) / 200 * 0.3;
            if (mouseMode === 'attract') {
                this.vx += (dx / dist) * force;
                this.vy += (dy / dist) * force;
            } else if (mouseMode === 'repel') {
                this.vx -= (dx / dist) * force * 1.5;
                this.vy -= (dy / dist) * force * 1.5;
            }
        }
    }

    distance(other) {
        return Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
    }

    limitSpeed() {
        const speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
        if (speed > params.maxSpeed) {
            this.vx = (this.vx / speed) * params.maxSpeed;
            this.vy = (this.vy / speed) * params.maxSpeed;
        }
        if (speed < params.minSpeed && speed > 0) {
            this.vx = (this.vx / speed) * params.minSpeed;
            this.vy = (this.vy / speed) * params.minSpeed;
        }
    }

    handleBoundary() {
        if (boundaryMode === 'wrap') {
            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
            if (this.y < 0) this.y = canvas.height;
            if (this.y > canvas.height) this.y = 0;
        } else {
            const margin = 50;
            const turnFactor = 0.5;
            if (this.x < margin) this.vx += turnFactor;
            if (this.x > canvas.width - margin) this.vx -= turnFactor;
            if (this.y < margin) this.vy += turnFactor;
            if (this.y > canvas.height - margin) this.vy -= turnFactor;
        }
    }

    update() {
        this.separation();
        this.alignment();
        this.cohesion();
        this.avoidObstacles();
        this.followMouse();
        this.limitSpeed();
        this.handleBoundary();
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        const colors = themeColors[currentTheme];
        const angle = Math.atan2(this.vy, this.vx);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-5, 5);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-5, -5);
        ctx.closePath();
        ctx.fillStyle = colors.boid;
        ctx.fill();
        ctx.restore();
    }

    getSpeed() {
        return Math.sqrt(this.vx ** 2 + this.vy ** 2);
    }
}

// ============== STAR CLASS ==============
class Star {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.twinkleSpeed = Math.random() * 0.02 + 0.01;
        this.twinkleOffset = Math.random() * Math.PI * 2;
        // Pastel pink color variations
        const pinkVariant = Math.floor(Math.random() * 4);
        this.colors = [
            'rgba(255, 182, 193,',  // light pink
            'rgba(255, 192, 203,',  // pink
            'rgba(255, 209, 220,',  // lighter pink
            'rgba(255, 228, 235,'   // very light pink
        ];
        this.baseColor = this.colors[pinkVariant];
    }

    draw(time) {
        const twinkle = Math.sin(time * this.twinkleSpeed + this.twinkleOffset) * 0.4 + 0.6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.baseColor + twinkle + ')';
        ctx.fill();

        // Add glow effect for larger stars
        if (this.size > 1.5) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
            ctx.fillStyle = this.baseColor + (twinkle * 0.2) + ')';
            ctx.fill();
        }
    }
}

// ============== OBSTACLE CLASS ==============
class Obstacle {
    constructor(x, y, radius = 40) {
        this.x = x;
        this.y = y;
        this.radius = radius;
    }

    draw() {
        const colors = themeColors[currentTheme];
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = colors.obstacle;
        ctx.fill();
        ctx.strokeStyle = colors.obstacleBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    contains(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        return Math.sqrt(dx * dx + dy * dy) < this.radius;
    }
}

// ============== INITIALIZATION ==============
function initBoids(count = 150) {
    boids = [];
    for (let i = 0; i < count; i++) {
        boids.push(new Boid());
    }
}

function initObstacles() {
    obstacles = [
        new Obstacle(canvas.width * 0.3, canvas.height * 0.4, 50),
        new Obstacle(canvas.width * 0.7, canvas.height * 0.6, 40)
    ];
}

function initStars(count = 200) {
    stars = [];
    for (let i = 0; i < count; i++) {
        stars.push(new Star());
    }
}

// ============== CONTROL FUNCTIONS ==============
function updateParam(name, value) {
    value = parseFloat(value);
    document.getElementById(`${name}-val`).textContent = value.toFixed(name === 'radius' || name === 'speed' ? 0 : 3);

    switch(name) {
        case 'separation': params.separation = value; break;
        case 'alignment': params.alignment = value; break;
        case 'cohesion': params.cohesion = value; break;
        case 'radius': params.radius = value; break;
        case 'speed': params.maxSpeed = value; break;
    }
}

function applyPreset(name) {
    const preset = presets[name];
    if (!preset) return;

    params.separation = preset.separation;
    params.alignment = preset.alignment;
    params.cohesion = preset.cohesion;
    params.radius = preset.radius;
    params.maxSpeed = preset.maxSpeed;

    // Update UI
    document.getElementById('separation').value = preset.separation;
    document.getElementById('separation-val').textContent = preset.separation.toFixed(3);
    document.getElementById('alignment').value = preset.alignment;
    document.getElementById('alignment-val').textContent = preset.alignment.toFixed(3);
    document.getElementById('cohesion').value = preset.cohesion;
    document.getElementById('cohesion-val').textContent = preset.cohesion.toFixed(3);
    document.getElementById('radius').value = preset.radius;
    document.getElementById('radius-val').textContent = preset.radius;
    document.getElementById('speed').value = preset.maxSpeed;
    document.getElementById('speed-val').textContent = preset.maxSpeed;
}

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pause-btn');
    const overlay = document.getElementById('pause-overlay');
    btn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
    overlay.style.display = isPaused ? 'block' : 'none';
}

function resetSimulation() {
    initBoids(150);
    initObstacles();
}

function addBoids(count) {
    for (let i = 0; i < count; i++) {
        boids.push(new Boid());
    }
}

function removeBoids(count) {
    boids.splice(0, Math.min(count, boids.length - 1));
}

function setBoundaryMode(mode) {
    boundaryMode = mode;
    document.getElementById('bounce-btn').classList.toggle('active', mode === 'bounce');
    document.getElementById('wrap-btn').classList.toggle('active', mode === 'wrap');
}

function setMouseMode(mode) {
    mouseMode = mode;
    document.getElementById('mouse-off').classList.toggle('active', mode === 'off');
    document.getElementById('mouse-attract').classList.toggle('active', mode === 'attract');
    document.getElementById('mouse-repel').classList.toggle('active', mode === 'repel');
}

function toggleTrails() {
    trailsEnabled = document.getElementById('trails-enabled').checked;
}

function updateTrailLength(value) {
    trailAlpha = parseFloat(value);
    document.getElementById('trail-val').textContent = value;
}

function toggleObstacles() {
    obstaclesEnabled = document.getElementById('obstacles-enabled').checked;
}

function addObstacle() {
    const x = Math.random() * (canvas.width - 100) + 50;
    const y = Math.random() * (canvas.height - 100) + 50;
    obstacles.push(new Obstacle(x, y, 30 + Math.random() * 30));
}

function clearObstacles() {
    obstacles = [];
}

function setTheme(theme) {
    currentTheme = theme;
    document.body.className = theme === 'minimal' ? '' : `theme-${theme}`;
    document.getElementById('theme-minimal').classList.toggle('active', theme === 'minimal');
    document.getElementById('theme-neon').classList.toggle('active', theme === 'neon');
    document.getElementById('theme-nature').classList.toggle('active', theme === 'nature');
}

// ============== STATS ==============
function updateStats() {
    const now = performance.now();
    frameCount++;

    if (now - lastFpsUpdate >= 500) {
        currentFps = Math.round(frameCount * 1000 / (now - lastFpsUpdate));
        frameCount = 0;
        lastFpsUpdate = now;
        document.getElementById('fps').textContent = currentFps;
    }

    document.getElementById('boid-count').textContent = boids.length;

    if (boids.length > 0) {
        const avgSpeed = boids.reduce((sum, b) => sum + b.getSpeed(), 0) / boids.length;
        const avgNeighbors = boids.reduce((sum, b) => sum + b.neighborCount, 0) / boids.length;
        document.getElementById('avg-speed').textContent = avgSpeed.toFixed(1);
        document.getElementById('avg-neighbors').textContent = avgNeighbors.toFixed(1);
    }
}

// ============== MOUSE EVENTS ==============
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;

    if (draggedObstacle) {
        draggedObstacle.x = mouse.x;
        draggedObstacle.y = mouse.y;
    }
});

canvas.addEventListener('mouseleave', () => {
    mouse.active = false;
});

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on obstacle
    for (const obs of obstacles) {
        if (obs.contains(x, y)) {
            draggedObstacle = obs;
            return;
        }
    }

    // Shift+click to add obstacle
    if (e.shiftKey) {
        obstacles.push(new Obstacle(x, y, 35));
    } else {
        // Regular click to spawn boid
        boids.push(new Boid(x, y));
    }
});

canvas.addEventListener('mouseup', () => {
    draggedObstacle = null;
});

// ============== TOOLTIPS ==============
document.querySelectorAll('[data-tooltip]').forEach(el => {
    el.addEventListener('mouseenter', (e) => {
        tooltip.textContent = e.target.dataset.tooltip;
        tooltip.style.display = 'block';
        const rect = e.target.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.bottom + 5) + 'px';
    });
    el.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
});

// ============== ANIMATION LOOP ==============
let animationTime = 0;

function animate() {
    animationTime += 16; // Approximate frame time
    const colors = themeColors[currentTheme];

    // Clear with trail effect or solid
    if (trailsEnabled) {
        ctx.fillStyle = colors.bg;
        ctx.globalAlpha = trailAlpha;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
    } else {
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw twinkling stars
    for (const star of stars) {
        star.draw(animationTime);
    }

    // Draw boundary indicator for wrap mode
    if (boundaryMode === 'wrap') {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        ctx.setLineDash([]);
    }

    // Update and draw boids
    if (!isPaused) {
        for (const boid of boids) {
            boid.update();
        }
    }

    for (const boid of boids) {
        boid.draw();
    }

    // Draw obstacles
    if (obstaclesEnabled) {
        for (const obs of obstacles) {
            obs.draw();
        }
    }

    // Draw mouse influence indicator
    if (mouse.active && mouseMode !== 'off') {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 200, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 130, 171, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ff82ab';
        ctx.fill();
    }

    updateStats();
    requestAnimationFrame(animate);
}

// ============== START ==============
initBoids(150);
initObstacles();
initStars(200);
animate();
