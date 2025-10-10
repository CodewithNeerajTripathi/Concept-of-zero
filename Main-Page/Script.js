const birds1 = document.getElementById("birds1");
const birds2 = document.getElementById("birds2");
const img0 = document.getElementById("image0");
const img1 = document.getElementById("image1");
const img2 = document.getElementById("image2");
const muteBtn = document.getElementById("mute-btn");
const mainPage = document.querySelector(".main-page");
const startBtn = document.getElementById("start-btn");
const endScreen = document.getElementById("end-screen");
const endButton = document.getElementById("end-btn");

// ---------------------- Audio Setup ----------------------
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

// Preload audios
audios.forEach((audio, index) => {
  audio.preload = index === 8 ? "auto" : "metadata";
  if (index === 8) audio.loop = true;
  audio.addEventListener("error", () => console.warn(`Audio ${index} failed to load`));
});

// ---------------------- State Management ----------------------
let firstBirdEnabled = false;
let secondBirdEnabled = false;
let isMuted = false;
let hasStarted = false;
const activeAnimations = new Set();
const frameCache = new Map();

// ---------------------- Animation Config ----------------------
const config = {
  flyInFrames: 150,
  idleFrames: 70,
  flyAwayStartFrame: 130,
  flyAwayEndFrame: 10,
  idleFPS: 24,
  flyAwayFPS: 30
};

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function padFrame(num) {
  if (!frameCache.has(num)) frameCache.set(num, String(num).padStart(5, "0"));
  return frameCache.get(num);
}

// ---------------------- Image Preloading ----------------------
async function preloadImages() {
  const promises = [];

  for (let i = config.flyAwayEndFrame; i <= config.flyAwayStartFrame; i++) {
    const img = new Image();
    img.src = `./Bird_Fly_off_alpha/Bird Fly off_${padFrame(i)}.png`;
    promises.push(new Promise(res => { img.onload = img.onerror = res; }));
  }

  for (let i = 0; i < config.idleFrames; i++) {
    const img = new Image();
    img.src = `./Bird_Idole_alpha/Bird Idole_${padFrame(i)}.png`;
    promises.push(new Promise(res => { img.onload = img.onerror = res; }));
  }

  await Promise.all(promises);
  console.log("✅ All bird frames preloaded!");
}

// ---------------------- Helper Functions ----------------------
function showImage(imgElement, delay = 100) {
  imgElement.style.display = "block";
  setTimeout(() => imgElement.style.transform = "translate(-50%, -50%) scale(1)", delay);
}

function hideImage(imgElement, duration = 800) {
  imgElement.style.transition = `all ${duration}ms ease`;
  imgElement.style.transform = "translate(-50%, -50%) scale(0.5)";
  imgElement.style.opacity = "0";
  setTimeout(() => {
    imgElement.style.display = "none";
    imgElement.style.opacity = "1";
    imgElement.style.transition = "";
  }, duration);
}

function playAudioSequence(audioIndices, onComplete) {
  if (!audioIndices.length) { if(onComplete) onComplete(); return; }
  let currentIndex = 0;

  function playNext() {
    if(currentIndex < audioIndices.length){
      const audio = audios[audioIndices[currentIndex]];
      audio.addEventListener("ended", () => { currentIndex++; playNext(); }, { once: true });
      audio.play().catch(e => console.warn(`Audio ${audioIndices[currentIndex]} play failed:`, e));
    } else { if(onComplete) onComplete(); }
  }

  playNext();
}

// ---------------------- Birds Animation ----------------------
function animateBird(bird, targetLeftRatio, targetTopRatio, birdSizeRatio, birdIndex) {
  let idleAnim = null;
  let clickHandler = null;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const startLeft = -0.2 * screenWidth;
  const startTop = 0.14 * screenHeight;
  const targetLeft = screenWidth * targetLeftRatio;
  const targetTop = screenHeight * targetTopRatio;
  bird.style.width = (screenWidth * birdSizeRatio) + "px";

  let flyFrame = config.flyInFrames;

  function flyIn() {
    if(flyFrame >= 2){
      const progress = (config.flyInFrames - flyFrame) / (config.flyInFrames - 1);
      bird.style.left = startLeft + progress*(targetLeft-startLeft) + "px";
      bird.style.top = startTop + progress*(targetTop-startTop) + "px";
      const spriteFrame = Math.floor(110-(progress*109))+1;
      bird.src = `../Bird_Fly_off_alpha/Bird Fly off_${padFrame(spriteFrame)}.png`;
      flyFrame--;
      const animId = requestAnimationFrame(flyIn);
      activeAnimations.add(animId);
    } else {
      bird.style.left = targetLeft + "px";
      bird.style.top = targetTop + "px";
      bird.src = `../Bird_Fly_off_alpha/Bird Fly off_00001.png`;
      startIdle();
    }
  }

  function startIdle() {
    let idleFrame = 35;
    let lastTime = performance.now();

    function idleLoop(time) {
      const elapsed = time - lastTime;
      if(elapsed >= 1000/config.idleFPS){
        bird.src = `../Bird_Idole_alpha/Bird Idole_${padFrame(idleFrame)}.png`;
        idleFrame = (idleFrame+1) % config.idleFrames;
        lastTime = time;
      }
      idleAnim = requestAnimationFrame(idleLoop);
      activeAnimations.add(idleAnim);
    }

    idleAnim = requestAnimationFrame(idleLoop);

    clickHandler = () => {
      if((birdIndex===1 && firstBirdEnabled) || (birdIndex===2 && secondBirdEnabled)){
        bird.removeEventListener("click", clickHandler);
        flyAway(bird, birdIndex);
      }
    };

    bird.addEventListener("click", clickHandler);
  }

  function flyAway(bird, birdIndex) {
    if(idleAnim) cancelAnimationFrame(idleAnim);

    const startX = bird.offsetLeft;
    const startY = bird.offsetTop;
    const endX = screenWidth*1.5;
    const endY = -0.3*screenHeight;

    const totalFrames = config.flyAwayStartFrame-config.flyAwayEndFrame;
    let currentStep=0;
    const totalSteps = totalFrames*(60/config.flyAwayFPS)*2;
    let lastTime = performance.now();

    function flyLoop(time){
      if(currentStep <= totalSteps){
        const progress = currentStep/totalSteps;
        const eased = easeOutCubic(progress);
        bird.style.left = startX + eased*(endX-startX) + "px";
        bird.style.top = startY + eased*(endY-startY) + "px";

        const elapsed = time-lastTime;
        if(elapsed >= 1000/config.flyAwayFPS){
          const frameProgress = progress*totalFrames;
          const currentFrame = config.flyAwayStartFrame-Math.floor(frameProgress);
          bird.src = `../Bird_Fly_off_alpha/Bird Fly off_${padFrame(Math.max(config.flyAwayEndFrame, currentFrame))}.png`;
          lastTime = time;
        }

        currentStep++;
        requestAnimationFrame(flyLoop);
      } else { bird.style.display = "none"; }
    }

    requestAnimationFrame(flyLoop);

    if(birdIndex===1 && firstBirdEnabled){
      firstBirdEnabled = false; secondBirdEnabled=false;
      playAudioSequence([1,2,3],()=>{ secondBirdEnabled=true; });
    } else if(birdIndex===2 && secondBirdEnabled){
      secondBirdEnabled=false;
      playAudioSequence([4,5,6,7]);
    }
  }

  requestAnimationFrame(flyIn);
}

// ---------------------- End Screen ----------------------
function showEndScreen(){
  const fadeOut = setInterval(() => {
    if(audios[8].volume>0.05) audios[8].volume-=0.05;
    else { audios[8].pause(); clearInterval(fadeOut); }
  },100);

  if(endScreen){ endScreen.style.display="flex"; setTimeout(()=>{endScreen.style.opacity="1";},100); }
  setTimeout(()=>goToNextPage(),5000);
}

function goToNextPage(){ window.location.href="../index.html"; }

// ---------------------- Image Events ----------------------
function setupImageEvents(){
  audios[0].addEventListener("play",()=>showImage(img2,100),{once:true});
  audios[0].addEventListener("ended",()=>{ hideImage(img2,800); firstBirdEnabled=true;},{once:true});

  audios[3].addEventListener("play",()=>showImage(img1,100),{once:true});
  audios[3].addEventListener("ended",()=>hideImage(img1,800),{once:true});

  audios[7].addEventListener("play",()=>showImage(img0,100),{once:true});
  audios[7].addEventListener("ended",()=>{ hideImage(img0,800); setTimeout(showEndScreen,1000); },{once:true});
}

// ---------------------- Mute Button ----------------------
function setupMuteButton(){
  muteBtn.addEventListener("click",()=>{ isMuted=!isMuted; audios.forEach(audio=>audio.muted=isMuted); muteBtn.textContent=isMuted?"🔇":"🔊"; });
}

// ---------------------- Start Experience ----------------------
function startExperience(){
  if(hasStarted) return;
  hasStarted=true;
  if(startBtn){ startBtn.style.opacity="0"; setTimeout(()=>startBtn.style.display="none",500); }

  const playBg=()=>{ audios[8].play().catch(e=>{ document.addEventListener("click",()=>audios[8].play(),{once:true}); }); };
  playBg();

  setTimeout(()=>audios[0].play(),2000);

  animateBird(birds1,0.35,0.187,0.20,1);
  setTimeout(()=>animateBird(birds2,0.25,0.22,0.20,2),1000);
}

// ---------------------- Initialization ----------------------
async function initApp(){
  await preloadImages();
  setupImageEvents();
  setupMuteButton();

  if(endButton) endButton.addEventListener("click",goToNextPage);

  const fromEntry = document.referrer.includes('entry') || sessionStorage.getItem('userInteracted');
  if(fromEntry){ sessionStorage.removeItem('userInteracted'); startExperience(); }
  else if(startBtn){ startBtn.addEventListener("click",startExperience); startBtn.style.display="flex"; }
  else startExperience();
}

// ---------------------- Event Listeners ----------------------
window.addEventListener("load",initApp);
window.addEventListener("beforeunload",()=>{
  activeAnimations.forEach(id=>cancelAnimationFrame(id));
  audios.forEach(audio=>{ audio.pause(); audio.src=""; });
  activeAnimations.clear();
  frameCache.clear();
});

// ---------------------- Home Button ----------------------
const homeBtn = document.getElementById("home-btn");
const homeConfirm = document.getElementById("home-confirm");
const homeYes = document.getElementById("home-yes");
const homeNo = document.getElementById("home-no");

if(homeBtn && homeConfirm && homeYes && homeNo){
  homeBtn.addEventListener("click",()=>{ homeConfirm.style.display="flex"; });
  homeYes.addEventListener("click",()=>window.location.href="../index.html");
  homeNo.addEventListener("click",()=>{ homeConfirm.style.display="none"; });
}

// ---------------------- Subtitles ----------------------
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

function showSubtitle(index){
  if(!subtitles[index]) return;
  const sub=subtitles[index];
  sub.style.display="block";
  setTimeout(()=>{ sub.style.opacity=1; sub.style.transform="translateX(-50%) scale(1)"; },50);
}

function hideSubtitle(index){
  if(!subtitles[index]) return;
  const sub=subtitles[index];
  sub.style.opacity=0;
  sub.style.transform="translateX(-50%) scale(0.2)";
  setTimeout(()=>sub.style.display="none",500);
}

// ---------------------- Subtitle Sequence ----------------------
audios.forEach((audio,index)=>{
  if(index===0){ // Audio0: sub0 1.3sec, sub1 audio duration
    audio.addEventListener("play",()=>{
  showSubtitle(0);                  // sub0 show
  setTimeout(()=>{
    hideSubtitle(0);                // sub0 hide after 1.5s
    showSubtitle(1);                // sub1 show after sub0 hide
  },1500);
});

    audio.addEventListener("ended",()=>hideSubtitle(1));
  } else if(index>=1 && index<=6){ // Audio1-6: sub2-7 during audio
    audio.addEventListener("play",()=>showSubtitle(index+1));
    audio.addEventListener("ended",()=>hideSubtitle(index+1));
  } else if(index===7){ // Audio7: sub8 1sec → sub9 3sec → sub10
    audio.addEventListener("play",()=>{
      showSubtitle(8);
      setTimeout(()=>hideSubtitle(8),1500);
      setTimeout(()=>{
        showSubtitle(9);
        setTimeout(()=>hideSubtitle(9),3000);
        setTimeout(()=>showSubtitle(10),3000);
      },1500);
    });
    audio.addEventListener("ended",()=>hideSubtitle(10));
  }
});

// ---------------------- Press Birds Image ----------------------
const pressBirdsImg = document.getElementById("pressBirdsImg");
audios[0].addEventListener("ended",()=>{
  pressBirdsImg.style.display="block";
  setTimeout(()=>{ pressBirdsImg.style.opacity=1; pressBirdsImg.style.transform="translateX(-50%) scale(1)"; },50);
});

const hidePressImage=()=>{
  pressBirdsImg.style.opacity=0;
  pressBirdsImg.style.transform="translateX(-50%) scale(0.5)";
  setTimeout(()=>pressBirdsImg.style.display="none",500);
};

birds1.addEventListener("click", hidePressImage);
birds2.addEventListener("click", hidePressImage);
