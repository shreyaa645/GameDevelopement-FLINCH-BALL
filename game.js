const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const backgroundAudio = document.getElementById("background-audio");
const hitAudio = document.getElementById("hit-audio");

const hudScore = document.getElementById("hud-score");
const hudBest = document.getElementById("hud-best");
const hudCombo = document.getElementById("hud-combo");
const hudNickname = document.getElementById("hud-nickname");
const diffFill = document.getElementById("diff-fill");

const pauseBtn = document.getElementById("pause-btn");
const resumeBtn = document.getElementById("resume-btn");
const soundToggle = document.getElementById("sound-toggle");
const pauseOverlay = document.getElementById("pause-overlay");

const screenShake = document.getElementById("screen-shake");
const hitFlash = document.getElementById("hit-flash");
const popupLayer = document.getElementById("popup-layer");
const achievementsLayer = document.getElementById("achievements");

let spacebarPressed = false;
let paused = false;
let soundOn = true;
let gameEnded = false;

let score = 0;
let combo = 1;
let baseSpeed = 3.2;
let obstacleTimer = 0;
let frame = 0;

const urlParams = new URLSearchParams(window.location.search);
const nickname = urlParams.get("nickname") || localStorage.getItem("nickname") || "PILOT";
const savedHighScore = parseInt(localStorage.getItem("highScore") || "0", 10);

hudNickname.textContent = nickname;
hudBest.textContent = savedHighScore.toLocaleString();

function setCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

setCanvasSize();
window.addEventListener("resize", setCanvasSize);

const fish = {
    x: 70,
    y: canvas.height / 2,
    width: 30,
    height: 30,
    velocity: 0,
    gravity: 0.5,
    jumpStrength: 8.8,
    hue: 180
};

let obstacles = [];
let trailParticles = [];
let burstParticles = [];
let stars = [];
let earnedMilestones = new Set();

const milestones = [100, 250, 500, 800, 1200, 1800, 2500];

for (let i = 0; i < 90; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 0.8 + 0.2,
        size: Math.random() * 1.7 + 0.4
    });
}

function playSound(audio) {
    if (!soundOn || !audio) return;

    try {
        audio.currentTime = 0;
        audio.play();
    } catch (error) {
        // Browser may block autoplay until user interacts.
    }
}

function startBackgroundMusic() {
    if (!soundOn || !backgroundAudio) return;

    try {
        backgroundAudio.volume = 0.35;
        backgroundAudio.play();
    } catch (error) {
        // Browser may block autoplay until user interacts.
    }
}

function togglePause() {
    if (gameEnded) return;

    paused = !paused;
    pauseOverlay.classList.toggle("hidden", !paused);

    if (paused) {
        backgroundAudio.pause();
    } else {
        startBackgroundMusic();
    }
}

pauseBtn.addEventListener("click", togglePause);
resumeBtn.addEventListener("click", togglePause);

soundToggle.addEventListener("click", () => {
    soundOn = !soundOn;
    soundToggle.textContent = soundOn ? "🔊" : "🔇";

    if (soundOn && !paused) {
        startBackgroundMusic();
    } else {
        backgroundAudio.pause();
    }
});

function showAchievement(text) {
    const toast = document.createElement("div");
    toast.className = "achievement";
    toast.textContent = "★ " + text;
    achievementsLayer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function spawnScorePopup(text, x, y) {
    const popup = document.createElement("div");
    popup.className = "score-popup";
    popup.textContent = text;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    popupLayer.appendChild(popup);

    setTimeout(() => {
        popup.remove();
    }, 1000);
}

function triggerImpactEffect() {
    playSound(hitAudio);

    hitFlash.classList.add("flash");
    screenShake.classList.remove("shake");
    void screenShake.offsetWidth;
    screenShake.classList.add("shake");

    spawnBurst(fish.x + fish.width / 2, fish.y + fish.height / 2, 34, 320);

    setTimeout(() => {
        hitFlash.classList.remove("flash");
    }, 90);
}

function spawnTrailParticle() {
    trailParticles.push({
        x: fish.x + fish.width / 2,
        y: fish.y + fish.height / 2,
        radius: fish.width / 2,
        life: 22,
        maxLife: 22,
        hue: fish.hue
    });
}

function spawnBurst(x, y, count, hue) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;

        burstParticles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 3 + 1,
            life: 32,
            maxLife: 32,
            hue: hue + (Math.random() * 50 - 25)
        });
    }
}

function jump() {
    if (gameEnded || paused) return;

    fish.velocity = -fish.jumpStrength;
    spacebarPressed = true;
    spawnBurst(fish.x + fish.width / 2, fish.y + fish.height / 2, 10, fish.hue);
    startBackgroundMusic();
}

document.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        jump();
    }

    if (event.code === "KeyP" || event.code === "Escape") {
        togglePause();
    }

    if (event.code === "KeyM") {
        soundToggle.click();
    }
});

document.addEventListener("keyup", (event) => {
    if (event.code === "Space" || event.code === "Enter") {
        spacebarPressed = false;
    }
});

canvas.addEventListener("pointerdown", jump);

function createObstaclePair() {
    const minGap = Math.max(145, 220 - score / 80);
    const topHeight = Math.random() * (canvas.height - minGap - 160) + 60;
    const width = 38;
    const startX = canvas.width + 80;

    obstacles.push({
        x: startX,
        y: 0,
        width,
        height: topHeight,
        passed: false,
        pairId: Date.now() + Math.random()
    });

    obstacles.push({
        x: startX,
        y: topHeight + minGap,
        width,
        height: canvas.height - topHeight - minGap,
        passed: true,
        pairId: Date.now() + Math.random()
    });
}

function drawBackground() {
    const horizon = canvas.height * 0.68;

    for (const star of stars) {
        star.x -= baseSpeed * star.z * 0.4;

        if (star.x < 0) {
            star.x = canvas.width;
            star.y = Math.random() * canvas.height;
        }

        ctx.fillStyle = `rgba(255,255,255,${0.35 + star.z * 0.55})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    ctx.strokeStyle = "rgba(255, 44, 223, 0.25)";
    ctx.lineWidth = 1;

    const gridOffset = (frame * baseSpeed * 0.5) % 40;

    for (let i = 0; i < 22; i++) {
        const y = horizon + i * 22 - gridOffset;

        if (y > canvas.height) break;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    const centerX = canvas.width / 2;

    for (let i = -12; i <= 12; i++) {
        ctx.beginPath();
        ctx.moveTo(centerX + i * 55, horizon);
        ctx.lineTo(centerX + i * 520, canvas.height);
        ctx.stroke();
    }

    const horizonGlow = ctx.createLinearGradient(0, horizon - 5, 0, horizon + 5);
    horizonGlow.addColorStop(0, "rgba(255,44,223,0)");
    horizonGlow.addColorStop(0.5, "rgba(255,44,223,0.95)");
    horizonGlow.addColorStop(1, "rgba(255,44,223,0)");

    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, horizon - 3, canvas.width, 6);
}

function drawFish() {
    const centerX = fish.x + fish.width / 2;
    const centerY = fish.y + fish.height / 2;
    const radius = fish.width / 2;

    const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 44);
    glow.addColorStop(0, `hsla(${fish.hue},100%,65%,0.95)`);
    glow.addColorStop(0.4, `hsla(${fish.hue},100%,60%,0.38)`);
    glow.addColorStop(1, "transparent");

    ctx.fillStyle = glow;
    ctx.fillRect(centerX - 44, centerY - 44, 88, 88);

    const gradient = ctx.createRadialGradient(centerX - 4, centerY - 4, 2, centerX, centerY, radius);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.5, `hsl(${fish.hue}, 100%, 62%)`);
    gradient.addColorStop(1, `hsl(${(fish.hue + 60) % 360}, 100%, 38%)`);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.shadowBlur = 18;
    ctx.shadowColor = `hsl(${fish.hue}, 100%, 60%)`;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.stroke();
    ctx.closePath();
}

function drawTrailParticles() {
    for (const particle of trailParticles) {
        const alpha = particle.life / particle.maxLife;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${particle.hue}, 100%, 62%, ${alpha * 0.7})`;
        ctx.shadowBlur = 16;
        ctx.shadowColor = `hsl(${particle.hue}, 100%, 60%)`;
        ctx.fill();
        ctx.closePath();
    }

    ctx.shadowBlur = 0;
}

function drawBurstParticles() {
    for (const particle of burstParticles) {
        const alpha = particle.life / particle.maxLife;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${particle.hue}, 100%, 62%, ${alpha})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsl(${particle.hue}, 100%, 60%)`;
        ctx.fill();
        ctx.closePath();
    }

    ctx.shadowBlur = 0;
}

function drawObstacles() {
    const pulse = 0.5 + Math.sin(frame * 0.12) * 0.5;

    for (const obstacle of obstacles) {
        ctx.shadowBlur = 22 + pulse * 16;
        ctx.shadowColor = "#ff2cdf";

        const gradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x + obstacle.width, obstacle.y);
        gradient.addColorStop(0, "#9d4edd");
        gradient.addColorStop(0.5, "#ff2cdf");
        gradient.addColorStop(1, "#00fff7");

        ctx.fillStyle = gradient;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255,255,255,${0.35 + pulse * 0.4})`;
        ctx.fillRect(obstacle.x, obstacle.y, 2, obstacle.height);
        ctx.fillRect(obstacle.x + obstacle.width - 2, obstacle.y, 2, obstacle.height);
    }
}

function updateFish() {
    fish.velocity += fish.gravity;
    fish.y += fish.velocity;
    fish.hue = (fish.hue + 1.4) % 360;

    if (fish.y < 0 || fish.y + fish.height > canvas.height) {
        triggerImpactEffect();
        gameOver();
    }
}

function updateParticles() {
    spawnTrailParticle();

    for (const particle of trailParticles) {
        particle.life--;
    }

    trailParticles = trailParticles.filter((particle) => particle.life > 0);

    for (const particle of burstParticles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.12;
        particle.life--;
    }

    burstParticles = burstParticles.filter((particle) => particle.life > 0);
}

function circleRectCollision(rect) {
    const centerX = fish.x + fish.width / 2;
    const centerY = fish.y + fish.height / 2;
    const radius = fish.width / 2 - 2;

    const closestX = Math.max(rect.x, Math.min(centerX, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(centerY, rect.y + rect.height));

    const dx = centerX - closestX;
    const dy = centerY - closestY;

    return dx * dx + dy * dy < radius * radius;
}

function updateObstacles() {
    obstacleTimer -= baseSpeed;

    if (obstacleTimer <= 0) {
        createObstaclePair();
        obstacleTimer = Math.max(300, 650 - score * 0.08);
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.x -= baseSpeed;

        if (circleRectCollision(obstacle)) {
            triggerImpactEffect();
            gameOver();
            return;
        }

        if (!obstacle.passed && obstacle.x + obstacle.width < fish.x) {
            obstacle.passed = true;

            combo++;
            const bonus = 10 * combo;
            score += bonus;

            spawnScorePopup(`+${bonus}`, fish.x + 42, fish.y);
            spawnBurst(obstacle.x + obstacle.width, fish.y + fish.height / 2, 14, 60);
            bumpScore();

            if (combo >= 3) {
                hudCombo.classList.add("hot");
            }

            if (combo === 3) showAchievement("COMBO x3");
            if (combo === 6) showAchievement("FIRE STREAK x6");
            if (combo === 10) showAchievement("LEGENDARY x10");
        }

        if (obstacle.x + obstacle.width < 0) {
            obstacles.splice(i, 1);
        }
    }
}

function bumpScore() {
    hudScore.classList.remove("bump");
    void hudScore.offsetWidth;
    hudScore.classList.add("bump");
}

function updateHud() {
    hudScore.textContent = score.toLocaleString();
    hudCombo.textContent = "x" + combo;
    hudBest.textContent = Math.max(savedHighScore, score).toLocaleString();

    if (combo < 3) {
        hudCombo.classList.remove("hot");
    }

    diffFill.style.width = `${Math.min(100, score / 25)}%`;

    for (const milestone of milestones) {
        if (score >= milestone && !earnedMilestones.has(milestone)) {
            earnedMilestones.add(milestone);
            showAchievement(`MILESTONE ${milestone}`);
            spawnBurst(canvas.width / 2, canvas.height / 2, 36, Math.random() * 360);
        }
    }
}

function gameOver() {
    if (gameEnded) return;

    gameEnded = true;
    paused = true;

    const previousHigh = parseInt(localStorage.getItem("highScore") || "0", 10);
    const isNewHigh = score > previousHigh;

    if (isNewHigh) {
        localStorage.setItem("highScore", score);
    }

    localStorage.setItem("finalScore", score);
    localStorage.setItem("finalNickname", nickname);
    localStorage.setItem("finalIsHigh", isNewHigh ? "1" : "0");

    setTimeout(() => {
        window.location.href = "retry.html";
    }, 650);
}

function updateGame() {
    if (paused || gameEnded) return;

    frame++;
    score++;
    baseSpeed = 3.2 + Math.min(4.2, score / 700);

    updateFish();
    updateParticles();
    updateObstacles();
    updateHud();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();
    drawTrailParticles();
    drawObstacles();
    drawBurstParticles();
    drawFish();

    requestAnimationFrame(draw);
}

draw();

setInterval(updateGame, 1000 / 60);