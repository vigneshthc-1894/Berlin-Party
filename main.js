// =============================================
// BERLIN TECHNO SCROLLYTELLING — CORE ENGINE
// No Lenis. Pure GSAP ScrollTrigger + Native Scroll.
// =============================================
console.log("INITIALIZING VOID...");

const config = {
    frameCount: 602,
    preloadCount: 30,
    imagePath: (index) => {
        if (index <= 200) return `./assets/Scene%201/ezgif-frame-${String(index).padStart(3, '0')}.jpg`;
        if (index <= 400) return `./assets/Scene%202/ezgif-frame-${String(index - 200).padStart(3, '0')}.jpg`;
        return `./assets/Scene%203/ezgif-frame-${String(index - 400).padStart(3, '0')}.jpg`;
    },
    canvasId: 'hero-lightpass',
    loaderId: 'preloader'
};

// --- STATE ---
const state = {
    currentFrame: 1,
    targetFrame: 1,
    loadedImages: new Map(),
    isPreloading: true,
    canvasMetrics: { width: 0, height: 0 }
};

// Memory Management
const MEMORY_AHEAD = 80;
const MEMORY_BEHIND = 40;

// --- DOM ELEMENTS ---
const canvas = document.getElementById(config.canvasId);
const ctx = canvas.getContext('2d', { alpha: false });
const preloader = document.getElementById(config.loaderId);
const progressBar = document.querySelector('.progress-bar');
const progressPercent = document.querySelector('.progress-percent');

// --- CANVAS SIZING ---
function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    state.canvasMetrics.width = w;
    state.canvasMetrics.height = h;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawFrame(Math.round(state.currentFrame));
}

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, 150);
});

// --- RENDER LOOP ---
let lastDrawnFrame = -1;

function renderLoop() {
    const frameIndex = Math.round(state.currentFrame);

    if (frameIndex !== lastDrawnFrame) {
        drawFrame(frameIndex);
        manageMemory(frameIndex);
        lastDrawnFrame = frameIndex;
    }

    requestAnimationFrame(renderLoop);
}

function drawFrame(index) {
    if (!ctx) return;
    const img = state.loadedImages.get(index);

    if (img && img.complete && img.naturalWidth > 0) {
        const w = state.canvasMetrics.width;
        const h = state.canvasMetrics.height;
        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;

        // Object-fit: cover
        const ratio = Math.max(w / imgW, h / imgH);
        const drawW = imgW * ratio;
        const drawH = imgH * ratio;
        const x = (w - drawW) / 2;
        const y = (h - drawH) / 2;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, x, y, drawW, drawH);
    }
}

// --- IMAGE LOADING ---
function loadImage(index) {
    return new Promise((resolve) => {
        if (state.loadedImages.has(index)) {
            resolve(state.loadedImages.get(index));
            return;
        }

        const img = new Image();
        state.loadedImages.set(index, img); // Reserve slot immediately

        img.onload = () => resolve(img);
        img.onerror = () => {
            console.warn(`Missing: ${config.imagePath(index)}`);
            state.loadedImages.delete(index);
            resolve(null);
        };

        img.src = config.imagePath(index);
    });
}

// --- MEMORY MANAGEMENT ---
function manageMemory(currentIndex) {
    const minKeep = Math.max(1, currentIndex - MEMORY_BEHIND);
    const maxKeep = Math.min(config.frameCount, currentIndex + MEMORY_AHEAD);

    // Unload distant frames
    for (const [key, img] of state.loadedImages.entries()) {
        if (key < minKeep || key > maxKeep) {
            if (img && img.src) {
                img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
            }
            state.loadedImages.delete(key);
        }
    }

    // Load nearby frames
    for (let i = minKeep; i <= maxKeep; i++) {
        if (!state.loadedImages.has(i)) {
            loadImage(i);
        }
    }
}

// --- PRELOADER ---
async function executePreload() {
    let loaded = 0;
    const promises = [];

    for (let i = 1; i <= config.preloadCount; i++) {
        const p = loadImage(i).then(() => {
            loaded++;
            const pct = Math.floor((loaded / config.preloadCount) * 100);
            progressBar.style.width = `${pct}%`;
            progressPercent.textContent = `${pct}%`;
        });
        promises.push(p);
    }

    await Promise.all(promises);

    // Hide preloader
    preloader.classList.add('hidden');
    setTimeout(() => { if (preloader.parentNode) preloader.parentNode.removeChild(preloader); }, 1000);

    state.isPreloading = false;

    // Boot
    resizeCanvas();
    renderLoop();
    initScrollTrigger();
}

// --- SCROLL TRIGGER (NO LENIS) ---
function initScrollTrigger() {
    gsap.to(state, {
        currentFrame: config.frameCount,
        ease: "none",
        snap: { currentFrame: 1 },
        scrollTrigger: {
            trigger: "#scroll-container",
            start: "top top",
            end: "bottom bottom",
            scrub: 0.5,
            invalidateOnRefresh: true,
        }
    });
}

// --- BOOTSTRAP ---
document.addEventListener("DOMContentLoaded", () => {
    executePreload();
});
