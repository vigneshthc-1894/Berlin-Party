// BERLIN TECHNO SCROLLYTELLING LOGIC
console.log("INITIALIZING VOID...");

const config = {
    frameCount: 602,
    preloadCount: 30,
    imagePath: (index) => {
        if (index <= 200) return `./assets/Scene 1/ezgif-frame-${String(index).padStart(3, '0')}.jpg`;
        if (index <= 400) return `./assets/Scene 2/ezgif-frame-${String(index - 200).padStart(3, '0')}.jpg`;
        return `./assets/Scene 3/ezgif-frame-${String(index - 400).padStart(3, '0')}.jpg`;
    },
    canvasId: 'hero-lightpass',
    loaderId: 'preloader'
};

// --- STATE ---
const state = {
    currentFrame: 1,
    loadedImages: new Map(), // Use Map for faster lookup and cleanup
    isPreloading: true,
    canvasMetrics: { width: 0, height: 0 }
};

// Memory Management bounds
const MEMORY_AHEAD = 60;
const MEMORY_BEHIND = 30;

// --- DOM ELEMENTS ---
const canvas = document.getElementById(config.canvasId);
const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency
const preloader = document.getElementById(config.loaderId);
const progressBar = document.querySelector('.progress-bar');
const progressPercent = document.querySelector('.progress-percent');

// --- SETUP CANVAS CACHE & SCALING (Mobile Opt) ---
// Cap DPR at 2 for performance on ultra-high-res mobile devices
function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { innerWidth: w, innerHeight: h } = window;

    state.canvasMetrics.width = w;
    state.canvasMetrics.height = h;

    canvas.width = w * dpr;
    canvas.height = h * dpr;

    // Scale context to ensure correct drawing
    ctx.scale(dpr, dpr);

    // Redraw immediately on resize
    renderFrame(state.currentFrame);
}

window.addEventListener('resize', () => {
    // Basic debounce for resize
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(resizeCanvas, 100);
});

// --- CORE RENDERING LOOP ---
// We ONLY draw inside requestAnimationFrame for buttery smooth performance.
let animationFrameId = null;
let lastRenderedFrame = -1;

function renderLoop() {
    // Only render if the frame actually changed
    if (state.currentFrame !== lastRenderedFrame) {
        renderFrame(state.currentFrame);

        // Manage memory dynamically during scrolling
        if (!state.isPreloading) {
            manageMemory(state.currentFrame);
        }

        lastRenderedFrame = state.currentFrame;
    }
    animationFrameId = requestAnimationFrame(renderLoop);
}

function renderFrame(index) {
    if (!ctx) return;

    const img = state.loadedImages.get(index);

    if (img && img.complete && img.naturalWidth !== 0) {
        // Calculate Object-Fit: Cover mathematics
        const w = state.canvasMetrics.width;
        const h = state.canvasMetrics.height;
        const imgW = img.width;
        const imgH = img.height;

        const ratio = Math.max(w / imgW, h / imgH);
        const drawW = imgW * ratio;
        const drawH = imgH * ratio;

        // Center the image
        const x = (w - drawW) / 2;
        const y = (h - drawH) / 2;

        // Draw the image
        ctx.fillStyle = '#000000'; // Brutalist black background fallback
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, x, y, drawW, drawH);
    }
}

// --- IMAGE LOADING & MEMORY MANAGEMENT ---
function loadImage(index) {
    return new Promise((resolve) => {
        if (state.loadedImages.has(index)) {
            // Check if it's already requested
            resolve(state.loadedImages.get(index));
            return;
        }

        const img = new Image();
        img.src = config.imagePath(index);

        // Immediately set so we don't request it again by sliding window
        state.loadedImages.set(index, img);

        img.onload = () => {
            resolve(img);
        };

        img.onerror = () => {
            console.warn(`Missing asset: ${img.src}`);
            state.loadedImages.delete(index);
            resolve(null);
        };
    });
}

function manageMemory(currentIndex) {
    const minKeep = Math.max(1, currentIndex - MEMORY_BEHIND);
    const maxKeep = Math.min(config.frameCount, currentIndex + MEMORY_AHEAD);

    // 1. Unload images outside the window to free memory
    for (const [key, img] of state.loadedImages.entries()) {
        if (key < minKeep || key > maxKeep) {
            // Use 1x1 transparent gif instead of '' to prevent the browser from requesting the base URL
            img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
            state.loadedImages.delete(key);
        }
    }

    // 2. Load missing images inside the window
    for (let i = minKeep; i <= maxKeep; i++) {
        if (!state.loadedImages.has(i)) {
            loadImage(i);
        }
    }
}

// Preload the first batch blocking the UI
async function executePreload() {
    let loaded = 0;
    const preloadPromises = [];

    // Load concurrently instead of sequentially
    for (let i = 1; i <= config.preloadCount; i++) {
        const p = loadImage(i).then(() => {
            loaded++;
            // Update UI
            const percent = Math.floor((loaded / config.preloadCount) * 100);
            progressBar.style.width = `${percent}%`;
            progressPercent.textContent = `${percent}%`;
        });
        preloadPromises.push(p);
    }

    await Promise.all(preloadPromises);

    // Preload complete. Remove loader, start render loop.
    preloader.style.transform = 'translateY(-100%)';
    setTimeout(() => preloader.remove(), 1000);

    state.isPreloading = false;

    // Initial draw
    resizeCanvas();
    renderLoop();

    // Initialize Lenis and GSAP now that initial assets are ready
    initScroll();
}

// --- SCROLL LOGIC & GSAP ---
function initScroll() {
    // Initialize Lenis
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothTouch: true,
        touchMultiplier: 2,
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    // GSAP ScrollTrigger to map sequence
    gsap.to(state, {
        currentFrame: config.frameCount,
        snap: "currentFrame", // Snap to nearest whole integer frame
        ease: "none",
        scrollTrigger: {
            trigger: "#smooth-wrapper",
            start: "top top",
            end: "bottom bottom",
            scrub: 0.5 // 0.5 scrub adds slight catching up inertia
        }
    });
}

// --- BOOTSTRAP ---
document.addEventListener("DOMContentLoaded", () => {
    executePreload();
});
