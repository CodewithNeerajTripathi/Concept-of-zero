const birds1 = document.getElementById("birds1");
const birds2 = document.getElementById("birds2");
const img0 = document.getElementById("image0");
const img1 = document.getElementById("image1");
const img2 = document.getElementById("image2");
const muteBtn = document.getElementById("mute-btn");
const endScreen = document.getElementById("end-screen");
const endButton = document.getElementById("end-btn");

const audios = [
  new Audio("../draft_audio/1.mp3"),
  new Audio("../draft_audio/2.mp3"),
  new Audio("../draft_audio/3.mp3"),
  new Audio("../draft_audio/4.mp3"),
  new Audio("../draft_audio/5.mp3"),
  new Audio("../draft_audio/6.mp3"),
  new Audio("../draft_audio/7.mp3"),
  new Audio("../draft_audio/8.mp3"),
  new Audio("../draft_audio/Bird_Misc_01.wav")
];

audios.forEach((audio, index) => {
  audio.preload = index === 8 ? "auto" : "metadata";
  if (index === 8) audio.loop = true;
  audio.addEventListener("error", () => console.warn(`Audio ${index} failed to load`));
});

let firstBirdEnabled = false;
let secondBirdEnabled = false;
let isMuted = false;
let hasStarted = false;
const activeAnimations = new Set();
const frameCache = new Map();
const imageCache = {};

const config = {
  flyInFrames: 90,
  idleFrames: 51,
  flyAwayStartFrame: 104,
  flyAwayEndFrame: 0,
  idleFPS: 24,
  flyAwayFPS: 30
};

// ==================== RESPONSIVE BRANCH POSITIONS ====================
const branchPositions = {
  // Mobile Landscape (480px - 768px)
  mobile: {
    branch1: { left: 0.38, top: 0.25, size: 0.15 },
    branch2: { left: 0.28, top: 0.30, size: 0.15 }
  },
  
  // Tablet Landscape (768px - 1024px)
  tablet: {
    branch1: { left: 0.36, top: 0.22, size: 0.18 },
    branch2: { left: 0.26, top: 0.26, size: 0.18 }
  },
  
  // Desktop (1024px - 1440px)
  desktop: {
    branch1: { left: 0.35, top: 0.187, size: 0.20 },
    branch2: { left: 0.25, top: 0.22, size: 0.20 }
  },
  
  // Large Desktop (1440px+)
  large: {
    branch1: { left: 0.34, top: 0.18, size: 0.22 },
    branch2: { left: 0.24, top: 0.21, size: 0.22 }
  }
};

function getScreenCategory() {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  if (width < 1440) return 'desktop';
  return 'large';
}

function getBranchPosition(branchNumber) {
  const category = getScreenCategory();
  const branchKey = `branch${branchNumber}`;
  return branchPositions[category][branchKey];
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function padFrame(num) {
  if (!frameCache.has(num)) frameCache.set(num, String(num).padStart(5, "0"));
  return frameCache.get(num);
}

async function preloadImages() {
  const promises = [];
  console.log("🚀 Starting image preload...");
  for (let i = config.flyAwayEndFrame; i <= config.flyAwayStartFrame; i++) {
    const key = `fly_${i}`;
    const src = `../BirdFlyOff/BirdFlyOff_${padFrame(i)}.png`;
    const img = new Image();
    img.src = src;
    imageCache[key] = img;
    promises.push(new Promise(res => { img.onload = () => res(true); img.onerror = () => res(false); }));
  }
  for (let i = 0; i < config.idleFrames; i++) {
    const key = `idle_${i}`;
    const src = `../BirdIdole/BirdIdole_${padFrame(i)}.png`;
    const img = new Image();
    img.src = src;
    imageCache[key] = img;
    promises.push(new Promise(res => { img.onload = () => res(true); img.onerror = () => res(false); }));
  }
  await Promise.all(promises);
}

// ✅ Initialize images
function initializeImage(imgElement) {
  imgElement.style.display = "none";
  imgElement.style.opacity = "0";
  imgElement.style.transform = "translate(-50%, -50%) scale(0.2)";
  imgElement.style.transition = "all 0.5s ease";
}

function initializePressBirdsImg() {
  const pressBirdsImg = document.getElementById("pressBirdsImg");
  if (pressBirdsImg) {
    pressBirdsImg.style.display = "none";
    pressBirdsImg.style.opacity = "0";
    pressBirdsImg.style.transform = "translateX(-50%) scale(0.5)";
    pressBirdsImg.style.transition = "all 0.5s ease";
  }
}

// Initialize on load
if (img0) initializeImage(img0);
if (img1) initializeImage(img1);
if (img2) initializeImage(img2);
initializePressBirdsImg();

// ✅ Smooth show/hide
function showImage(imgElement, delay = 100) {
  imgElement.style.display = "block";
  imgElement.style.transition = "all 0.5s ease";
  imgElement.offsetHeight;
  setTimeout(() => {
    imgElement.style.opacity = "1";
    imgElement.style.transform = "translate(-50%, -50%) scale(1)";
    imgElement.classList.add("floating");
  }, delay);
}

function hideImage(imgElement, duration = 800) {
  imgElement.style.transition = `all ${duration}ms ease`;
  imgElement.classList.remove("floating");
  imgElement.style.opacity = "0.0";
  imgElement.style.transform = "translate(-50%, -50%) scale(0.0)";
  setTimeout(() => {
    imgElement.style.display = "none";
    imgElement.style.transition = "all 0.5s ease";
  }, duration);
}

// -------------------- Audio Sequence --------------------
function playAudioSequence(audioIndices, onComplete) {
  if (!audioIndices.length) { if (onComplete) onComplete(); return; }
  let currentIndex = 0;
  function playNext() {
    if (currentIndex < audioIndices.length) {
      const audio = audios[audioIndices[currentIndex]];
      audio.addEventListener("ended", () => { currentIndex++; playNext(); }, { once: true });
      audio.play().catch(e => console.warn(`Audio ${audioIndices[currentIndex]} play failed:`, e));
    } else { if (onComplete) onComplete(); }
  }
  playNext();
}

// -------------------- Bird Animations (RESPONSIVE) --------------------
function animateBird(bird, birdIndex) {
  let idleAnim = null;
  let clickHandler = null;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
  // Get responsive branch position
  const branchPos = getBranchPosition(birdIndex);
  
  const startLeft = -0.2 * screenWidth;
  const startTop = 0.14 * screenHeight;
  const targetLeft = screenWidth * branchPos.left;
  const targetTop = screenHeight * branchPos.top;
  bird.style.width = (screenWidth * branchPos.size) + "px";
  let flyFrame = config.flyInFrames;

  function flyIn() {
    const startFrame = 40;
    const endFrame = 0;

    if (flyFrame >= 2) {
      const progress = (config.flyInFrames - flyFrame) / (config.flyInFrames - 1);
      bird.style.left = startLeft + progress * (targetLeft - startLeft) + "px";
      bird.style.top = startTop + progress * (targetTop - startTop) + "px";

      const spriteFrame = Math.round(startFrame - (startFrame - endFrame) * progress);
      const cacheKey = `fly_${spriteFrame}`;
      const cachedImg = imageCache[cacheKey];
      bird.src = cachedImg ? cachedImg.src : `../BirdFlyOff/BirdFlyOff_${padFrame(spriteFrame)}.png`;

      flyFrame--;
      const animId = requestAnimationFrame(flyIn);
      activeAnimations.add(animId);
    } else {
      bird.style.left = targetLeft + "px";
      bird.style.top = targetTop + "px";
      startIdle();
    }
  }

  function startIdle() {
    let idleFrame = 35;
    let lastTime = performance.now();
    function idleLoop(time) {
      const elapsed = time - lastTime;
      if (elapsed >= 1000 / config.idleFPS) {
        const cacheKey = `idle_${idleFrame}`;
        const cachedImg = imageCache[cacheKey];
        bird.src = cachedImg ? cachedImg.src : `../BirdIdole/BirdIdole_${padFrame(idleFrame)}.png`;
        idleFrame = (idleFrame + 1) % config.idleFrames;
        lastTime = time;
      }
      idleAnim = requestAnimationFrame(idleLoop);
      activeAnimations.add(idleAnim);
    }
    idleAnim = requestAnimationFrame(idleLoop);

    clickHandler = () => {
      if ((birdIndex === 1 && firstBirdEnabled) || (birdIndex === 2 && secondBirdEnabled)) {
        bird.removeEventListener("click", clickHandler);
        flyAway(bird, birdIndex);
      }
    };
    bird.addEventListener("click", clickHandler);
  }

  function flyAway(bird, birdIndex) {
    if (idleAnim) cancelAnimationFrame(idleAnim);
    const startX = bird.offsetLeft;
    const startY = bird.offsetTop;
    const endX = screenWidth * 1.5;
    const endY = -0.3 * screenHeight;
    const totalFrames = config.flyAwayStartFrame - config.flyAwayEndFrame;
    let currentStep = 0;
    const totalSteps = totalFrames * (60 / config.flyAwayFPS) * 2;
    let lastTime = performance.now();

    function flyLoop(time) {
      if (currentStep <= totalSteps) {
        const progress = currentStep / totalSteps;
        const eased = easeOutCubic(progress);
        bird.style.left = startX + eased * (endX - startX) + "px";
        bird.style.top = startY + eased * (endY - startY) + "px";
        const elapsed = time - lastTime;
        if (elapsed >= 1000 / config.flyAwayFPS) {
          const frameProgress = progress * totalFrames;
          const currentFrame = config.flyAwayStartFrame - Math.floor(frameProgress);
          const frameNum = Math.max(config.flyAwayEndFrame, currentFrame);
          const cacheKey = `fly_${frameNum}`;
          const cachedImg = imageCache[cacheKey];
          bird.src = cachedImg ? cachedImg.src : `../BirdFlyOff/BirdFlyOff_${padFrame(frameNum)}.png`;
          lastTime = time;
        }
        currentStep++;
        requestAnimationFrame(flyLoop);
      } else {
        bird.style.display = "none";
      }
    }
    requestAnimationFrame(flyLoop);

    if (birdIndex === 1 && firstBirdEnabled) {
      firstBirdEnabled = false;
      secondBirdEnabled = false;
      playAudioSequence([1, 2, 3], () => { secondBirdEnabled = true; });
    } else if (birdIndex === 2 && secondBirdEnabled) {
      secondBirdEnabled = false;
      playAudioSequence([4, 5, 6, 7]);
    }
  }

  requestAnimationFrame(flyIn);
}

// -------------------- End Screen --------------------
function showEndScreen() {
  const fadeOut = setInterval(() => {
    if (audios[8].volume > 0.05) audios[8].volume -= 0.05;
    else { audios[8].pause(); clearInterval(fadeOut); }
  }, 100);
  if (endScreen) { endScreen.style.display = "flex"; setTimeout(() => { endScreen.style.opacity = "1"; }, 100); }
}

function goToNextPage() { window.location.href = "../index.html"; }

// -------------------- Image Events --------------------
function setupImageEvents() {
  audios[0].addEventListener("play", () => showImage(img2, 100), { once: true });
  audios[0].addEventListener("ended", () => { hideImage(img2, 800); firstBirdEnabled = true; }, { once: true });

  audios[3].addEventListener("play", () => showImage(img1, 100), { once: true });
  audios[3].addEventListener("ended", () => hideImage(img1, 800), { once: true });

  audios[7].addEventListener("play", () => showImage(img0, 100), { once: true });
  audios[7].addEventListener("ended", () => { hideImage(img0, 800); setTimeout(showEndScreen, 1000); }, { once: true });
}

// -------------------- Mute --------------------
function setupMuteButton() {
  muteBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    audios.forEach(audio => audio.muted = isMuted);
    muteBtn.textContent = isMuted ? "🔇" : "🔊";
  });
}

// -------------------- Start (RESPONSIVE) --------------------
function startExperience() {
  if (hasStarted) return;
  hasStarted = true;
  const playBg = () => {
    audios[8].play().catch(e => { document.addEventListener("click", () => audios[8].play(), { once: true }); });
  };
  playBg();
  setTimeout(() => audios[0].play(), 2000);
  animateBird(birds1, 1);
  setTimeout(() => animateBird(birds2, 2), 1000);
}

async function initApp() {
  await preloadImages();
  setupImageEvents();
  setupMuteButton();
  if (endButton) endButton.addEventListener("click", goToNextPage);
  startExperience();
}

// -------------------- Orientation Check --------------------
let orientationOverlay = null;

function checkOrientation() {
  const isLandscape = window.innerWidth > window.innerHeight;
  
  if (!isLandscape) {
    audios.forEach(audio => audio.pause());
    
    if (!orientationOverlay) {
      orientationOverlay = document.createElement("div");
      orientationOverlay.id = "orientationOverlay";
      orientationOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: linear-gradient(135deg, #53dce6 0%, #19626d 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        text-align: center;
        font-family: Arial, sans-serif;
        z-index: 99999;
      `;
      orientationOverlay.innerHTML = `
        <div style="font-size: 80px; margin-bottom: 30px; animation: rotate 2s infinite;">📱</div>
        <div style="font-size: 28px; font-weight: bold; margin-bottom: 20px; letter-spacing: 1px;">Please Rotate Your Phone</div>
        <div style="font-size: 18px; opacity: 0.9;">Experience works best in landscape mode</div>
        <style>
          @keyframes rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      document.body.appendChild(orientationOverlay);
    } else {
      orientationOverlay.style.display = "flex";
    }
  } else {
    if (orientationOverlay) {
      orientationOverlay.style.display = "none";
    }
    
    if (!hasStarted) {
      initApp();
    }
  }
}

window.addEventListener("load", checkOrientation);
window.addEventListener("orientationchange", checkOrientation);
window.addEventListener("resize", checkOrientation);

// -------------------- Resize Handler (RESPONSIVE) --------------------
let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // If birds are already landed, reposition them
    if (hasStarted) {
      const branch1Pos = getBranchPosition(1);
      const branch2Pos = getBranchPosition(2);
      
      if (birds1 && birds1.style.display !== "none") {
        birds1.style.left = (window.innerWidth * branch1Pos.left) + "px";
        birds1.style.top = (window.innerHeight * branch1Pos.top) + "px";
        birds1.style.width = (window.innerWidth * branch1Pos.size) + "px";
      }
      
      if (birds2 && birds2.style.display !== "none") {
        birds2.style.left = (window.innerWidth * branch2Pos.left) + "px";
        birds2.style.top = (window.innerHeight * branch2Pos.top) + "px";
        birds2.style.width = (window.innerWidth * branch2Pos.size) + "px";
      }
    }
  }, 250);
});

window.addEventListener("beforeunload", () => {
  activeAnimations.forEach(id => cancelAnimationFrame(id));
  audios.forEach(audio => { audio.pause(); audio.src = ""; });
  activeAnimations.clear();
  frameCache.clear();
});

// -------------------- Home Button --------------------
const homeBtn = document.getElementById("home-btn");
const homeConfirm = document.getElementById("home-confirm");
const homeYes = document.getElementById("home-yes");
const homeNo = document.getElementById("home-no");

if (homeBtn && homeConfirm && homeYes && homeNo) {
  homeBtn.addEventListener("click", () => { homeConfirm.style.display = "flex"; });
  homeYes.addEventListener("click", () => window.location.href = "../index.html");
  homeNo.addEventListener("click", () => { homeConfirm.style.display = "none"; });
}

// -------------------- Subtitles --------------------
const subtitles = [
  document.getElementById("subtitle0"),
  document.getElementById("subtitle1"),
  document.getElementById("subtitle2"),
  document.getElementById("subtitle3"),
  document.getElementById("subtitle4"),
  document.getElementById("subtitle5"),
  document.getElementById("subtitle6"),
  document.getElementById("subtitle7"),
  document.getElementById("subtitle8"),
  document.getElementById("subtitle9"),
  document.getElementById("subtitle10")
];

function showSubtitle(index) {
  if (!subtitles[index]) return;
  const sub = subtitles[index];
  sub.style.display = "block";
  setTimeout(() => { sub.style.opacity = 1; sub.style.transform = "translateX(-50%) scale(1)"; }, 50);
}

function hideSubtitle(index) {
  if (!subtitles[index]) return;
  const sub = subtitles[index];
  sub.style.opacity = 0;
  sub.style.transform = "translateX(-50%) scale(0.2)";
  setTimeout(() => sub.style.display = "none", 500);
}

audios.forEach((audio, index) => {
  if (index === 0) {
    audio.addEventListener("play", () => {
      showSubtitle(0);
      setTimeout(() => { hideSubtitle(0); showSubtitle(1); }, 1500);
    });
    audio.addEventListener("ended", () => hideSubtitle(1));
  } else if (index >= 1 && index <= 6) {
    audio.addEventListener("play", () => showSubtitle(index + 1));
    audio.addEventListener("ended", () => hideSubtitle(index + 1));
  } else if (index === 7) {
    audio.addEventListener("play", () => {
      showSubtitle(8);
      setTimeout(() => hideSubtitle(8), 1500);
      setTimeout(() => { showSubtitle(9); setTimeout(() => hideSubtitle(9), 3000); setTimeout(() => showSubtitle(10), 3000); }, 1500);
    });
    audio.addEventListener("ended", () => hideSubtitle(10));
  }
});

// -------------------- Press Birds --------------------
const pressBirdsImg = document.getElementById("pressBirdsImg");

function showPressBirdsImage() {
  if (!pressBirdsImg) return;
  pressBirdsImg.style.display = "block";
  pressBirdsImg.style.transition = "all 0.5s ease";
  pressBirdsImg.offsetHeight;
  setTimeout(() => {
    pressBirdsImg.style.opacity = "1";
    pressBirdsImg.style.transform = "translateX(-50%) scale(1)";
    pressBirdsImg.classList.add("floating");
  }, 50);
}

const hidePressImage = () => {
  if (!pressBirdsImg) return;
  pressBirdsImg.classList.remove("floating");
  pressBirdsImg.style.transition = "all 0.5s ease";
  pressBirdsImg.style.opacity = "0";
  pressBirdsImg.style.transform = "translateX(-50%) scale(0.5)";
  setTimeout(() => {
    pressBirdsImg.style.display = "none";
  }, 500);
};

if (birds1) birds1.addEventListener("click", hidePressImage);
if (birds2) birds2.addEventListener("click", hidePressImage);

if (audios[0]) audios[0].addEventListener("ended", showPressBirdsImage);
if (audios[3]) audios[3].addEventListener("ended", showPressBirdsImage);