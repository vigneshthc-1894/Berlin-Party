// BERLIN TECHNO SCROLLYTELLING LOGIC
console.log("INITIALIZING VOID...");

const config = {
    frameCount: 450,
    preloadCount: 60,
    imagePath: (index) => `./assets/frames/frame-${String(index).padStart(3, '0')}.jpg?v=3`,
    canvasId: 'hero-lightpass',
    loaderId: 'preloader'
};

// --- STATE ---
const state = {
    currentFrame: 1,
    loadedImages: new Map(), // Use Map for faster lookup and potentially easier cleanup
    imagesToLoad: [], // Queue for background loading
    isPreloading: true,
    canvasMetrics: { width: 0, height: 0 }
};

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
        lastRenderedFrame = state.currentFrame;
    }
    animationFrameId = requestAnimationFrame(renderLoop);
}

function renderFrame(index) {
    if (!ctx) return;

    const img = state.loadedImages.get(index);

    if (img && img.complete) {
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
    } else {
        // Fallback or loading state if scrubbing too fast
        // We just leave the canvas or draw a minimal loading indicator
        // Doing nothing is often better to prevent flashing
    }
}

// --- IMAGE LOADING (ASYNC / BACKGROUND) ---
// Function to load a specific image and return a promise
function loadImage(index) {
    return new Promise((resolve, reject) => {
        if (state.loadedImages.has(index)) {
            resolve(state.loadedImages.get(index));
            return;
        }

        const img = new Image();
        img.src = config.imagePath(index);

        img.onload = () => {
            state.loadedImages.set(index, img);
            resolve(img);
        };

        img.onerror = () => {
            // If image fails to load, gracefully continue. 
            // In a real scenario, this might be a missing asset.
            console.warn(`Missing asset: ${img.src}`);
            state.loadedImages.set(index, null); // Set null to prevent infinite retries
            resolve(null);
        };
    });
}

// Preload the first batch blocking the UI
async function executePreload() {
    let loaded = 0;

    for (let i = 1; i <= config.preloadCount; i++) {
        await loadImage(i);
        loaded++;

        // Update UI
        const percent = Math.floor((loaded / config.preloadCount) * 100);
        progressBar.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;

        // Optional: slight artificial delay for the aesthetic of the loader
        await new Promise(r => setTimeout(r, 10));
    }

    // Preload complete. Remove loader, start render loop and background loading.
    preloader.style.transform = 'translateY(-100%)';
    setTimeout(() => preloader.remove(), 1000);

    state.isPreloading = false;

    // Initial draw
    resizeCanvas();
    renderLoop();

    // Start lazy loading the rest
    startBackgroundLoader();

    // Initialize Lenis and GSAP now that initial assets are ready
    initScroll();
}

// Asynchronously load the remaining frames without blocking main thread.
// Browsers natively handle Image objects gracefully in background.
async function startBackgroundLoader() {
    for (let i = config.preloadCount + 1; i <= config.frameCount; i++) {
        // We just trigger the load. We don't strictly await unless we want to stagger.
        // Let's stagger slightly to prevent network choke.
        await loadImage(i);

        // Yield to main thread briefly every 10 frames to ensure zero UI jank
        if (i % 10 === 0) {
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    }
    console.log("ALL FRAMES LOADED IN BACKGROUND.");
}

// --- SCROLL LOGIC & GSAP ---
function initScroll() {
    // Initialize Lenis
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Custom brutal easing
        direction: 'vertical',
        gestureDirection: 'vertical',
        smooth: true,
        smoothTouch: false, // Too heavy for mobile usually, native mobile scroll is fine
        touchMultiplier: 2,
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    // GSAP ScrollTrigger to map sequence
    // The playhead scrubs from frame 1 to 450 based on document height
    gsap.to(state, {
        currentFrame: config.frameCount,
        snap: "currentFrame", // Snap to nearest whole integer frame
        ease: "none",
        scrollTrigger: {
            trigger: "#smooth-wrapper",
            start: "top top",
            end: "bottom bottom",
            scrub: 0.5, // 0.5 scrub adds slight catching up inertia (premium feel)
            onUpdate: (self) => {
                // We update currentFrame here automatically via GSAP
                // renderLoop will pick it up on next rAF
            }
        }
    });
}

// --- BOOTSTRAP ---
document.addEventListener("DOMContentLoaded", () => {
    executePreload();
});
