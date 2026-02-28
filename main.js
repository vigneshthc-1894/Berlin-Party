// =============================================
// BERLIN TECHNO SCROLLYTELLING — CORE ENGINE v3
// GSAP ScrollTrigger + Native Scroll
// Optimized for mobile: smooth scrub, stable viewport, clean rendering
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
    loadedImages: new Map(),
    isPreloading: true,
    canvasW: 0,
    canvasH: 0,
    dpr: 1,
    lastWidth: 0, // Track width to avoid resize on address bar toggle
};

// Memory Management
const MEMORY_AHEAD = 80;
const MEMORY_BEHIND = 40;

// --- DOM ---
const canvas = document.getElementById(config.canvasId);
const ctx = canvas.getContext('2d', { alpha: false });
const preloader = document.getElementById(config.loaderId);
const progressBar = document.querySelector('.progress-bar');
const progressPercent = document.querySelector('.progress-percent');

// --- CANVAS SIZING ---
// On mobile, the address bar showing/hiding changes innerHeight.
// We only do a full resize when the WIDTH changes to avoid constant reflows.
function resizeCanvas(force) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Skip resize if only height changed (mobile address bar toggle)
    if (!force && w === state.lastWidth && state.canvasW > 0) {
        // Just update the drawing metrics for the new height
        state.canvasH = h;
        return;
    }

    state.lastWidth = w;
    // Use DPR 1 on mobile to match low-res source frames, 2 on desktop
    state.dpr = w <= 768 ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    state.canvasW = w;
    state.canvasH = h;

    canvas.width = w * state.dpr;
    canvas.height = h * state.dpr;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    drawFrame(Math.round(state.currentFrame));
}

// Also handle orientation change cleanly
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => resizeCanvas(false), 200);
});
window.addEventListener('orientationchange', () => {
    setTimeout(() => resizeCanvas(true), 300);
});

// --- RENDER LOOP ---
// Use interpolation for ultra-smooth frame transitions
let displayFrame = 1;
const LERP_SPEED = 0.3; // Smoothing factor

function renderLoop() {
    // Smoothly interpolate toward the target frame for buttery motion
    const target = state.currentFrame;
    displayFrame += (target - displayFrame) * LERP_SPEED;

    const frameIndex = Math.max(1, Math.min(config.frameCount, Math.round(displayFrame)));

    drawFrame(frameIndex);
    manageMemory(frameIndex);

    requestAnimationFrame(renderLoop);
}

function drawFrame(index) {
    if (!ctx) return;
    const img = state.loadedImages.get(index);
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const w = state.canvasW;
    const h = state.canvasH;

    // Recalculate canvas buffer if viewport height changed (address bar)
    if (canvas.height !== h * state.dpr) {
        canvas.height = h * state.dpr;
        ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
    }

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

// --- IMAGE LOADING ---
function loadImage(index) {
    return new Promise((resolve) => {
        if (state.loadedImages.has(index)) {
            resolve(state.loadedImages.get(index));
            return;
        }

        const img = new Image();
        state.loadedImages.set(index, img);

        img.onload = () => resolve(img);
        img.onerror = () => {
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

    for (const [key, img] of state.loadedImages.entries()) {
        if (key < minKeep || key > maxKeep) {
            if (img && img.src) {
                img.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
            }
            state.loadedImages.delete(key);
        }
    }

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

    preloader.classList.add('hidden');
    setTimeout(() => { if (preloader.parentNode) preloader.parentNode.removeChild(preloader); }, 1200);

    state.isPreloading = false;

    resizeCanvas(true);
    renderLoop();
    initScrollTrigger();
    initRevealAnimations();
    initCounters();
    initTicketCards();
}

// --- SCROLL TRIGGER ---
function initScrollTrigger() {
    gsap.to(state, {
        currentFrame: config.frameCount,
        ease: "none",
        // No snap — snap causes visible jank/stutter on mobile
        scrollTrigger: {
            trigger: "#scroll-container",
            start: "top top",
            end: "bottom bottom",
            // scrub: true = instant sync (smoothing handled by our LERP)
            scrub: true,
            invalidateOnRefresh: true,
        }
    });
}

// --- GSAP SCROLL REVEAL ANIMATIONS ---
function initRevealAnimations() {
    const elements = document.querySelectorAll('.anim-reveal');

    elements.forEach((el) => {
        gsap.to(el, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
                trigger: el,
                start: "top 88%",
                end: "top 55%",
                toggleActions: "play none none reverse",
            }
        });
    });
}

// --- COUNTER ANIMATION ---
function initCounters() {
    const counters = document.querySelectorAll('.counter');

    counters.forEach((counter) => {
        const target = parseInt(counter.getAttribute('data-target'), 10);

        gsap.to({ val: 0 }, {
            val: target,
            duration: 2,
            ease: "power2.out",
            scrollTrigger: {
                trigger: counter,
                start: "top 80%",
                toggleActions: "play none none reverse",
            },
            onUpdate: function () {
                counter.textContent = Math.round(this.targets()[0].val);
            }
        });
    });
}

// --- TICKET CARD SELECTION ---
function initTicketCards() {
    const cards = document.querySelectorAll('.ticket-card');

    cards.forEach((card) => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });
    });

    const ctaBtn = document.getElementById('cta-get-stamped');
    if (ctaBtn) {
        ctaBtn.addEventListener('click', () => {
            ctaBtn.textContent = 'STAMPED ✓';
            ctaBtn.style.background = '#FF3300';
            ctaBtn.style.borderColor = '#FF3300';

            setTimeout(() => {
                ctaBtn.textContent = 'GET STAMPED';
                ctaBtn.style.background = '';
                ctaBtn.style.borderColor = '';
            }, 2000);
        });
    }
}

// --- BOOTSTRAP ---
document.addEventListener("DOMContentLoaded", () => {
    executePreload();
});
