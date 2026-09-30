const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let gameState = "title";

// ====================
// TECLAS
// ====================

const keys = {
    a: false,
    d: false,
    w: false
};

const mobileButtons = {
    left: document.getElementById("leftBtn"),
    right: document.getElementById("rightBtn"),
    jump: document.getElementById("jumpBtn")
};

function setMobileButtonState(button, pressed) {
    if (!button) {
        return;
    }

    button.style.transform = pressed ? "scale(0.96)" : "scale(1)";
    button.style.opacity = pressed ? "0.8" : "1";
}

function handleTouchMoveState(control, pressed) {
    if (control === "left") {
        keys.a = pressed;
        setMobileButtonState(mobileButtons.left, pressed);
    }

    if (control === "right") {
        keys.d = pressed;
        setMobileButtonState(mobileButtons.right, pressed);
    }

    if (control === "jump") {
        if (pressed && gameState === "playing") {
            jump();
        }

        setMobileButtonState(mobileButtons.jump, pressed);
    }
}

const audio = {
    ctx: null,

    init() {
        if (this.ctx) {
            return;
        }

        const AudioCtor =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioCtor) {
            return;
        }

        this.ctx = new AudioCtor();
    },

    resume() {
        this.init();

        if (this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume();
        }
    },

    tone({
        frequency = 440,
        duration = 0.12,
        type = "square",
        volume = 0.04,
        attack = 0.01,
        release = 0.12,
        sweep = 0
    }) {
        if (!this.ctx) {
            return;
        }

        const oscillator = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);

        if (sweep !== 0) {
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(60, frequency + sweep),
                now + duration
            );
        }

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(volume, now + attack);
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + duration + release
        );

        oscillator.connect(gain);
        gain.connect(this.ctx.destination);

        oscillator.start(now);
        oscillator.stop(now + duration + release);
    },

    playJump() {
        this.tone({
            frequency: 340,
            duration: 0.12,
            type: "square",
            volume: 0.045,
            sweep: 120
        });
    },

    playHit() {
        this.tone({
            frequency: 180,
            duration: 0.22,
            type: "sawtooth",
            volume: 0.065,
            sweep: -60
        });
    },

    playHeart() {
        this.tone({
            frequency: 660,
            duration: 0.14,
            type: "triangle",
            volume: 0.05,
            sweep: 180
        });
    },

    playWarning() {
        this.tone({
            frequency: 500,
            duration: 0.22,
            type: "triangle",
            volume: 0.04,
            sweep: 80
        });
    },

    playFireball() {
        this.tone({
            frequency: 110,
            duration: 0.18,
            type: "sawtooth",
            volume: 0.06,
            sweep: -30
        });
    },

    playLava() {
        this.tone({
            frequency: 90,
            duration: 0.35,
            type: "square",
            volume: 0.05,
            sweep: 25
        });
    }
};

const music = {
    ctx: null,
    masterGain: null,
    intervalId: null,
    currentMode: null,

    ensure() {
        audio.init();

        if (!audio.ctx) {
            return false;
        }

        if (!this.masterGain) {
            this.ctx = audio.ctx;
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.08;
            this.masterGain.connect(this.ctx.destination);
        }

        return true;
    },

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.currentMode = null;
    },

    playTone({
        frequency,
        duration = 0.18,
        type = "triangle",
        volume = 0.08,
        sweep = 0
    }) {
        if (!this.ensure()) {
            return;
        }

        const oscillator = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime;

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);

        if (sweep !== 0) {
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(60, frequency + sweep),
                now + duration
            );
        }

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + duration
        );

        oscillator.connect(gain);
        gain.connect(this.masterGain);

        oscillator.start(now);
        oscillator.stop(now + duration);
    },

    start(mode) {
        this.ensure();

        if (!this.ctx || !this.masterGain) {
            return;
        }

        this.stop();
        this.currentMode = mode;

        const themes = {
            title: [
                { frequency: 392.0, duration: 0.8, type: "triangle", volume: 0.05, sweep: 10 },
                { frequency: 493.88, duration: 0.8, type: "triangle", volume: 0.05, sweep: 8 },
                { frequency: 587.33, duration: 1.2, type: "triangle", volume: 0.06, sweep: 10 }
            ],
            playing: [
                { frequency: 110.0, duration: 1.6, type: "sine", volume: 0.04, sweep: 0 },
                { frequency: 146.83, duration: 2.0, type: "sine", volume: 0.04, sweep: 0 },
                { frequency: 196.0, duration: 2.4, type: "sine", volume: 0.045, sweep: 0 }
            ],
            gameover: [
                { frequency: 220.0, duration: 0.7, type: "sawtooth", volume: 0.05, sweep: -20 },
                { frequency: 174.61, duration: 0.8, type: "sawtooth", volume: 0.05, sweep: -18 },
                { frequency: 146.83, duration: 1.0, type: "sawtooth", volume: 0.06, sweep: -15 }
            ]
        };

        const sequence = themes[mode] || themes.title;
        let index = 0;

        const playNext = () => {
            if (this.currentMode !== mode) {
                return;
            }

            const note = sequence[index % sequence.length];
            if (note) {
                this.playTone(note);
            }

            index++;

            const delay = mode === "playing" ? 1800 : 1200;
            this.intervalId = setTimeout(playNext, delay);
        };

        playNext();
    }
};

// ====================
// DIFICULTAD
// ====================

let selectedDifficulty = "normal";
let lives = 3;

// ====================
// GEEDY
// ====================

const geedy = {
    x: 300,
    y: 280,
    width: 40,
    height: 40,

    speed: 4,
    velocityY: 0,
    jumpPower: 11,
    gravity: 0.5,

    onGround: false,

    invincible: false,
    invincibleTimer: 0
};

// ====================
// PLATAFORMAS
// ====================

const platforms = [
    // Suelo
    {
        x: 0,
        y: 320,
        width: 640,
        height: 40
    },

    // Plataforma izquierda
    {
        x: 70,
        y: 260,
        width: 150,
        height: 12
    },

    // Plataforma derecha
    {
        x: 420,
        y: 260,
        width: 150,
        height: 12
    },

    // Plataforma superior
    {
        x: 245,
        y: 180,
        width: 150,
        height: 12
    }
];

// ====================
// BOLA DE FUEGO
// ====================

const fireball = {
    x: 0,
    y: 0,
    size: 30,
    speed: 6,
    active: false,
    direction: 1
};

const ghost = {
    x: 0,
    y: 0,
    width: 24,
    height: 28,
    speed: 0.7,
    active: false,
    phase: 0
};

const slimeBall = {
    x: 0,
    y: 0,
    width: 18,
    height: 20,
    velocityY: 0,
    active: false,
    landed: false,
    platform: null
};

// ====================
// PRECAUCIÓN
// ====================

let warningActive = false;
let warningTimer = 0;

const fireballDelay = 1000;
const enemyInterval = 5000;
let enemyCurrentInterval = enemyInterval;

let enemyTimer = 0;
let ghostTimer = 0;
let slimeTimer = 0;
let slimeSlowTimer = 0;

const normalGeedySpeed = geedy.speed;
const normalGeedyJumpPower = geedy.jumpPower;

const warningParticles = [];

// ====================
// CORAZONES
// ====================

const hearts = [];

let heartTimer = 0;

const heartIntervalFacil = 10000;
const heartIntervalNormal = 15000;

const heartMaxFacil = 5;
const heartMaxNormal = 3;

const heartPositions = [
    { x: 115, y: 225 },
    { x: 465, y: 225 },
    { x: 285, y: 145 },
    { x: 175, y: 285 },
    { x: 445, y: 285 },
    { x: 320, y: 285 },
    { x: 95, y: 285 },
    { x: 535, y: 285 }
];

function getMaxLives() {

    if (selectedDifficulty === "facil") {
        return 5;
    }

    if (selectedDifficulty === "dificil") {
        return 1;
    }

    return 3;
}

function getHeartInterval() {

    if (selectedDifficulty === "facil") {
        return heartIntervalFacil;
    }

    if (selectedDifficulty === "normal") {
        return heartIntervalNormal;
    }

    return Infinity;
}

function getGhostSpawnInterval() {

    if (selectedDifficulty === "facil") {
        return 60000;
    }

    if (selectedDifficulty === "normal") {
        return 30000;
    }

    return 0;
}

function getHeartMax() {

    if (selectedDifficulty === "facil") {
        return heartMaxFacil;
    }

    if (selectedDifficulty === "normal") {
        return heartMaxNormal;
    }

    return 0;
}

function spawnHeart() {

    if (
        selectedDifficulty === "dificil" ||
        hearts.length >= getHeartMax()
    ) {
        return;
    }

    const availablePositions =
        heartPositions.filter(
            position =>
                !hearts.some(
                    heart =>
                        heart.x === position.x &&
                        heart.y === position.y
                )
        );

    if (availablePositions.length === 0) {
        return;
    }

    const position =
        availablePositions[
            Math.floor(
                Math.random() *
                availablePositions.length
            )
        ];

    hearts.push({
        x: position.x,
        y: position.y,
        size: 22
    });
}

function updateHearts(deltaTime) {

    if (selectedDifficulty === "dificil") {

        hearts.length = 0;
        heartTimer = 0;

        return;
    }

    heartTimer += deltaTime;

    if (
        heartTimer >=
        getHeartInterval()
    ) {

        heartTimer = 0;

        spawnHeart();
    }

    for (
        let i = hearts.length - 1;
        i >= 0;
        i--
    ) {

        const heart = hearts[i];

        const collision =
            geedy.x <
                heart.x + heart.size &&
            geedy.x + geedy.width >
                heart.x &&
            geedy.y <
                heart.y + heart.size &&
            geedy.y + geedy.height >
                heart.y;

        if (collision) {

            if (
                lives <
                getMaxLives()
            ) {

                lives++;
                audio.playHeart();

                hearts.splice(
                    i,
                    1
                );
            }
        }
    }
}

function drawHeart(
    x,
    y,
    size
) {

    ctx.fillStyle =
        "#ff3b5c";

    const s =
        size / 8;

    ctx.fillRect(
        x + s,
        y,
        s * 2,
        s
    );

    ctx.fillRect(
        x + s * 5,
        y,
        s * 2,
        s
    );

    ctx.fillRect(
        x,
        y + s,
        s * 8,
        s * 2
    );

    ctx.fillRect(
        x + s,
        y + s * 3,
        s * 6,
        s * 2
    );

    ctx.fillRect(
        x + s * 2,
        y + s * 5,
        s * 4,
        s
    );

    ctx.fillRect(
        x + s * 3,
        y + s * 6,
        s * 2,
        s
    );
}

function drawHearts() {

    for (
        const heart of hearts
    ) {

        drawHeart(
            heart.x,
            heart.y,
            heart.size
        );
    }
}

// ====================
// LAVA
// ====================

let lavaState = "none";
// none
// warning
// rising
// holding
// lowering

let lavaTimer = 0;
let survivalTimer = 0;

// ====================
// PUNTAJE
// ====================

const MAX_SCORE = 999999;

const highScores = {
    facil: Math.min(
        MAX_SCORE,
        Number(localStorage.getItem("geedyHighScoreFacil")) || 0
    ),

    normal: Math.min(
        MAX_SCORE,
        Number(localStorage.getItem("geedyHighScoreNormal")) || 0
    ),

    dificil: Math.min(
        MAX_SCORE,
        Number(localStorage.getItem("geedyHighScoreDificil")) || 0
    )
};

function getScore() {

    return Math.min(
        MAX_SCORE,
        Math.floor(survivalTimer / 1000) * 10
    );
}

function saveHighScore() {

    const score = getScore();

    if (score > highScores[selectedDifficulty]) {

        highScores[selectedDifficulty] = score;

        const key =
            "geedyHighScore" +
            selectedDifficulty.charAt(0).toUpperCase() +
            selectedDifficulty.slice(1);

        localStorage.setItem(key, String(score));
    }
}

function drawScore() {

    ctx.textAlign = "right";
    ctx.fillStyle = "white";
    ctx.font = "bold 18px Arial";

    ctx.fillText(
        "PUNTOS: " + getScore(),
        canvas.width - 15,
        25
    );
}

const firstLavaTime = 30000;
const lavaInterval = 15000;

const lavaWarningTime = 3000;
const lavaRiseTime = 2000;
const lavaHoldTime = 3000;
const lavaLowerTime = 2000;

let lavaDamageGiven = false;

const lavaParticles = [];

// ====================
// DIBUJAR GEEDY
// ====================

function drawGeedy(x, y) {

    let color =
        "#5DE6FF";

    // Parpadeo durante inmunidad
    if (geedy.invincible) {

        const blink =
            Math.floor(
                geedy.invincibleTimer /
                100
            ) % 2;

        if (blink === 1) {
            color =
                "#164E63";
        }
    }

    // Cuerpo
    ctx.fillStyle =
        color;

    ctx.fillRect(
        x,
        y,
        40,
        40
    );

    // Brillo
    ctx.fillStyle =
        "#B8F7FF";

    ctx.fillRect(
        x + 4,
        y + 4,
        8,
        5
    );

    // Ojos
    ctx.fillStyle =
        "black";

    ctx.fillRect(
        x + 9,
        y + 10,
        7,
        7
    );

    ctx.fillRect(
        x + 24,
        y + 10,
        7,
        7
    );

    // Boca
    ctx.fillRect(
        x + 14,
        y + 27,
        12,
        4
    );
}

// ====================
// FONDO
// ====================

function drawBackground() {

    ctx.fillStyle =
        "#05051a";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    // Estrellas

    ctx.fillStyle =
        "white";

    ctx.fillRect(
        80,
        60,
        2,
        2
    );

    ctx.fillRect(
        180,
        100,
        2,
        2
    );

    ctx.fillRect(
        400,
        70,
        2,
        2
    );

    ctx.fillRect(
        520,
        130,
        2,
        2
    );

    ctx.fillRect(
        580,
        50,
        2,
        2
    );

    ctx.fillRect(
        120,
        150,
        2,
        2
    );

    ctx.fillRect(
        470,
        100,
        2,
        2
    );

    ctx.fillRect(
        350,
        50,
        2,
        2
    );

    ctx.fillRect(
        40,
        120,
        2,
        2
    );

    ctx.fillRect(
        610,
        180,
        2,
        2
    );

    // Luna pixelada

    ctx.fillStyle =
        "#24245c";

    ctx.fillRect(
        535,
        45,
        30,
        30
    );

    ctx.fillRect(
        528,
        52,
        44,
        16
    );

    ctx.fillStyle =
        "#05051a";

    ctx.fillRect(
        545,
        42,
        25,
        22
    );
}

// ====================
// PLATAFORMAS
// ====================

function drawPlatforms() {

    for (
        const platform of platforms
    ) {

        // Cuerpo

        ctx.fillStyle =
            "#18233a";

        ctx.fillRect(
            platform.x,
            platform.y,
            platform.width,
            platform.height
        );

        // Borde azul

        ctx.fillStyle =
            "#5DE6FF";

        ctx.fillRect(
            platform.x,
            platform.y,
            platform.width,
            4
        );

        // Detalles

        ctx.fillStyle =
            "#263653";

        for (
            let x = platform.x;
            x <
                platform.x +
                platform.width;
            x += 32
        ) {

            ctx.fillRect(
                x + 5,
                platform.y + 7,
                18,
                3
            );
        }
    }
}

// ====================
// VIDAS
// ====================

function drawLives() {

    ctx.textAlign =
        "left";

    ctx.font =
        "20px Arial";

    ctx.fillStyle =
        "white";

    ctx.fillText(
        "VIDAS:",
        15,
        25
    );

    for (
        let i = 0;
        i < lives;
        i++
    ) {

        ctx.fillStyle =
            "#5DE6FF";

        ctx.fillRect(
            85 + i * 30,
            10,
            20,
            20
        );

        // Ojos

        ctx.fillStyle =
            "black";

        ctx.fillRect(
            89 + i * 30,
            15,
            5,
            5
        );

        ctx.fillRect(
            100 + i * 30,
            15,
            5,
            5
        );
    }
}

// ====================
// PARTÍCULAS DEL AVISO
// ====================

function createWarningParticles() {

    for (
        let i = 0;
        i < 18;
        i++
    ) {

        warningParticles.push({

            x: 575,

            y: 155,

            vx:
                (Math.random() - 0.5) *
                3,

            vy:
                (Math.random() - 0.5) *
                3,

            size:
                Math.random() < 0.5
                    ? 3
                    : 5,

            life:
                500 +
                Math.random() *
                500
        });
    }
}

function updateWarningParticles(
    deltaTime
) {

    for (
        let i =
            warningParticles.length - 1;
        i >= 0;
        i--
    ) {

        const p =
            warningParticles[i];

        p.x +=
            p.vx;

        p.y +=
            p.vy;

        p.life -=
            deltaTime;

        if (
            p.life <= 0
        ) {

            warningParticles.splice(
                i,
                1
            );
        }
    }
}

// ====================
// SIGNO DE PRECAUCIÓN
// ====================

function drawWarning() {

    if (
        !warningActive
    ) {

        return;
    }

    // Fondo rojo

    ctx.fillStyle =
        "#ff2020";

    ctx.fillRect(
        540,
        135,
        70,
        55
    );

    // Triángulo amarillo

    ctx.fillStyle =
        "#ffff00";

    ctx.beginPath();

    ctx.moveTo(
        575,
        140
    );

    ctx.lineTo(
        550,
        180
    );

    ctx.lineTo(
        600,
        180
    );

    ctx.closePath();

    ctx.fill();

    // Signo !

    ctx.fillStyle =
        "black";

    ctx.font =
        "bold 28px Arial";

    ctx.textAlign =
        "center";

    ctx.fillText(
        "!",
        575,
        172
    );

    // Partículas amarillas

    for (
        const p of warningParticles
    ) {

        ctx.fillStyle =
            Math.random() < 0.5
                ? "#ffff00"
                : "#ff8c00";

        ctx.fillRect(
            Math.floor(p.x),
            Math.floor(p.y),
            p.size,
            p.size
        );
    }
}

// ====================
// CREAR BOLA DE FUEGO
// ====================

function shootFireball() {

    // Dirección aleatoria

    fireball.direction =
        Math.random() < 0.5
            ? 1
            : -1;

    // Izquierda -> derecha

    if (
        fireball.direction === 1
    ) {

        fireball.x =
            -fireball.size;
    }

    // Derecha -> izquierda

    else {

        fireball.x =
            canvas.width;
    }

    // Altura de Geedy

    fireball.y =
        geedy.y + 5;

    fireball.active =
        true;

    audio.playFireball();
}

// ====================
// DIBUJAR BOLA DE FUEGO
// ====================

function drawFireball() {

    if (
        !fireball.active
    ) {

        return;
    }

    const x =
        Math.floor(
            fireball.x
        );

    const y =
        Math.floor(
            fireball.y
        );

    // Cola

    if (
        fireball.direction === 1
    ) {

        ctx.fillStyle =
            "#ff3b00";

        ctx.fillRect(
            x - 14,
            y + 8,
            14,
            14
        );

        ctx.fillStyle =
            "#ff8c00";

        ctx.fillRect(
            x - 24,
            y + 12,
            10,
            8
        );

        ctx.fillStyle =
            "#FFD400";

        ctx.fillRect(
            x - 32,
            y + 14,
            8,
            4
        );
    }

    else {

        ctx.fillStyle =
            "#ff3b00";

        ctx.fillRect(
            x + 30,
            y + 8,
            14,
            14
        );

        ctx.fillStyle =
            "#ff8c00";

        ctx.fillRect(
            x + 44,
            y + 12,
            10,
            8
        );

        ctx.fillStyle =
            "#FFD400";

        ctx.fillRect(
            x + 54,
            y + 14,
            8,
            4
        );
    }

    // Exterior rojo

    ctx.fillStyle =
        "#ff2500";

    ctx.fillRect(
        x,
        y,
        30,
        30
    );

    // Naranja

    ctx.fillStyle =
        "#ff5a00";

    ctx.fillRect(
        x + 5,
        y + 5,
        20,
        20
    );

    // Amarillo

    ctx.fillStyle =
        "#FFD400";

    ctx.fillRect(
        x + 9,
        y + 8,
        13,
        14
    );

    // Centro blanco

    ctx.fillStyle =
        "#fff4a3";

    ctx.fillRect(
        x + 13,
        y + 11,
        7,
        8
    );

    // Chispas

    ctx.fillStyle =
        "#ff8c00";

    ctx.fillRect(
        x + 3,
        y - 5,
        5,
        5
    );

    ctx.fillRect(
        x + 22,
        y + 30,
        5,
        5
    );
}

function spawnGhost() {

    if (
        ghost.active
    ) {

        return;
    }

    const side =
        Math.random() < 0.5
            ? "left"
            : "right";

    ghost.x =
        side === "left"
            ? -ghost.width
            : canvas.width;

    ghost.y =
        Math.random() *
        (canvas.height - 120) +
        30;

    ghost.phase =
        Math.random() *
        Math.PI * 2;

    ghost.active =
        true;
}

function drawGhost() {

    if (
        !ghost.active
    ) {

        return;
    }

    const x =
        Math.floor(
            ghost.x
        );

    const y =
        Math.floor(
            ghost.y +
            Math.sin(
                (performance.now() / 300) +
                ghost.phase
            ) * 2
        );

    ctx.fillStyle =
        "rgba(210, 232, 255, 0.9)";

    ctx.fillRect(
        x,
        y,
        ghost.width,
        ghost.height
    );

    ctx.fillStyle =
        "rgba(255, 255, 255, 0.7)";

    ctx.fillRect(
        x + 4,
        y + 5,
        5,
        7
    );

    ctx.fillRect(
        x + ghost.width - 9,
        y + 5,
        5,
        7
    );

    ctx.fillStyle =
        "#1b2e43";

    ctx.fillRect(
        x + 5,
        y + 15,
        4,
        4
    );

    ctx.fillRect(
        x + ghost.width - 9,
        y + 15,
        4,
        4
    );

    ctx.fillStyle =
        "rgba(255, 255, 255, 0.5)";

    ctx.fillRect(
        x + 7,
        y + ghost.height - 4,
        ghost.width - 14,
        4
    );
}

function updateGhost(
    deltaTime
) {

    if (
        !ghost.active
    ) {

        return;
    }

    const targetX =
        geedy.x +
        geedy.width / 2;

    const targetY =
        geedy.y +
        geedy.height / 2;

    const centerX =
        ghost.x +
        ghost.width / 2;

    const centerY =
        ghost.y +
        ghost.height / 2;

    const dx =
        targetX - centerX;

    const dy =
        targetY - centerY;

    const distance =
        Math.hypot(dx, dy) || 1;

    const moveX =
        (dx / distance) *
        ghost.speed *
        (deltaTime / 16.67);

    const moveY =
        (dy / distance) *
        ghost.speed *
        (deltaTime / 16.67);

    ghost.x += moveX;
    ghost.y += moveY;

    const collision =
        ghost.x <
            geedy.x + geedy.width &&
        ghost.x + ghost.width >
            geedy.x &&
        ghost.y <
            geedy.y + geedy.height &&
        ghost.y + ghost.height >
            geedy.y;

    if (
        collision
    ) {

        ghost.active =
            false;

        loseLife();
    }
}

// ====================
// ACTUALIZAR BOLA
// ====================

function updateFireball(
    deltaTime
) {

    if (
        !fireball.active
    ) {

        return;
    }

    const movement =
        fireball.speed *
        (deltaTime / 16.67);

    fireball.x +=
        movement *
        fireball.direction;

    // Sale por la derecha

    if (
        fireball.direction === 1 &&
        fireball.x > canvas.width
    ) {

        fireball.active =
            false;

        return;
    }

    // Sale por la izquierda

    if (
        fireball.direction === -1 &&
        fireball.x +
            fireball.size <
            0
    ) {

        fireball.active =
            false;

        return;
    }

    // Inmunidad

    if (
        geedy.invincible
    ) {

        return;
    }

    // Colisión

    if (
        fireball.x <
            geedy.x +
            geedy.width &&

        fireball.x +
            fireball.size >
            geedy.x &&

        fireball.y <
            geedy.y +
            geedy.height &&

        fireball.y +
            fireball.size >
            geedy.y
    ) {

        fireball.active =
            false;

        loseLife();
    }
}

// ====================
// PERDER VIDA
// ====================

function loseLife() {

    if (
        gameState !==
        "playing"
    ) {

        return;
    }

    lives--;
    audio.playHit();

    geedy.invincible =
        true;

    geedy.invincibleTimer =
        2000;

    if (
        lives <= 0
    ) {

        lives = 0;

        saveHighScore();

        gameState =
            "gameover";

        geedy.invincible =
            false;

        warningActive =
            false;

        fireball.active =
            false;

        lavaState =
            "none";
    }
}

// ====================
// INMUNIDAD
// ====================

function updateInvincibility(
    deltaTime
) {

    if (
        !geedy.invincible
    ) {

        return;
    }

    geedy.invincibleTimer -=
        deltaTime;

    if (
        geedy.invincibleTimer <=
        0
    ) {

        geedy.invincibleTimer =
            0;

        geedy.invincible =
            false;
    }
}

// ====================
// ATAQUES
// ====================

function getSlimeSpawnInterval() {

    if (selectedDifficulty === "facil") {
        return 20000;
    }

    if (selectedDifficulty === "dificil") {
        return 5000;
    }

    return 10000;
}

function spawnSlimeBall() {

    const targetPlatforms =
        platforms.slice(1);

    slimeBall.platform =
        targetPlatforms[
            Math.floor(
                Math.random() * targetPlatforms.length
            )
        ];

    slimeBall.width =
        slimeBall.platform.width;

    slimeBall.x =
        slimeBall.platform.x;

    slimeBall.y =
        -slimeBall.height;

    slimeBall.velocityY =
        0;

    slimeBall.active =
        true;

    slimeBall.landed =
        false;
}

function updateSlimeBall(deltaTime) {

    slimeTimer +=
        deltaTime;

    slimeSlowTimer =
        Math.max(
            0,
            slimeSlowTimer - deltaTime
        );

    if (
        slimeSlowTimer === 0
    ) {

        geedy.speed =
            normalGeedySpeed;

        geedy.jumpPower =
            normalGeedyJumpPower;
    }

    if (
        !slimeBall.active &&
        slimeTimer >=
            getSlimeSpawnInterval()
    ) {

        slimeTimer =
            0;

        spawnSlimeBall();
    }

    if (
        !slimeBall.active
    ) {

        return;
    }

    if (
        !slimeBall.landed
    ) {

        slimeBall.velocityY +=
            0.45 *
            (deltaTime / 16.67);

        slimeBall.y +=
            slimeBall.velocityY *
            (deltaTime / 16.67);

        const platform =
            slimeBall.platform;

        if (
            slimeBall.y + slimeBall.height >=
                platform.y
        ) {

            slimeBall.y =
                platform.y -
                slimeBall.height;

            slimeBall.velocityY =
                0;

            slimeBall.landed =
                true;
        }
    }

    const touchingPlayer =
        slimeBall.x < geedy.x + geedy.width &&
        slimeBall.x + slimeBall.width > geedy.x &&
        slimeBall.y < geedy.y + geedy.height &&
        slimeBall.y + slimeBall.height > geedy.y;

    if (
        touchingPlayer
    ) {

        slimeBall.active =
            false;

        slimeSlowTimer =
            2500;

        geedy.speed =
            normalGeedySpeed * 0.5;

        geedy.jumpPower =
            normalGeedyJumpPower * 0.75;

        audio.playHit();
    }
}

function drawSlimeBall() {

    if (
        !slimeBall.active
    ) {

        return;
    }

    ctx.fillStyle =
        "#65e35f";

    ctx.fillRect(
        slimeBall.x,
        slimeBall.y + 5,
        slimeBall.width,
        slimeBall.height - 5
    );

    ctx.fillRect(
        slimeBall.x + 4,
        slimeBall.y,
        slimeBall.width - 8,
        6
    );

    ctx.fillStyle =
        "#123d20";

    ctx.fillRect(
        slimeBall.x + 5,
        slimeBall.y + 9,
        3,
        4
    );

    ctx.fillRect(
        slimeBall.x + slimeBall.width - 8,
        slimeBall.y + 9,
        3,
        4
    );
}

function updateEnemy(
    deltaTime
) {

    enemyTimer +=
        deltaTime;
    ghostTimer +=
        deltaTime;

    if (
        !ghost.active &&
        ghostTimer >=
            getGhostSpawnInterval()
    ) {

        spawnGhost();
        ghostTimer =
            0;
    }

    if (
        selectedDifficulty === "dificil" &&
        !ghost.active &&
        getGhostSpawnInterval() === 0
    ) {

        spawnGhost();
    }

    // Cada bola hace que la siguiente tarde
    // un poco menos en aparecer.

    if (
        enemyTimer >=
            (
                selectedDifficulty === "facil"
                    ? 6000
                    : enemyCurrentInterval
            ) &&

        !warningActive &&

        !fireball.active
    ) {

        warningActive =
            true;

        audio.playWarning();

        warningTimer =
            0;

        enemyTimer =
            0;

        createWarningParticles();
    }

    // Aviso

    if (
        warningActive
    ) {

        warningTimer +=
            deltaTime;

        if (
            warningTimer >=
            fireballDelay
        ) {

            warningActive =
                false;

            shootFireball();

            // Normal: -0,01 segundos
            // Difícil: -0,05 segundos

            if (
                selectedDifficulty === "normal"
            ) {

                enemyCurrentInterval =
                    Math.max(
                        1000,
                        enemyCurrentInterval - 10
                    );
            }

            else if (
                selectedDifficulty === "dificil"
            ) {

                enemyCurrentInterval =
                    Math.max(
                        1000,
                        enemyCurrentInterval - 50
                    );
            }
        }
    }

    updateWarningParticles(
        deltaTime
    );

    updateFireball(
        deltaTime
    );

    updateGhost(
        deltaTime
    );

    updateSlimeBall(
        deltaTime
    );
}

// ====================
// MOVIMIENTO GEEDY
// ====================

function updateGeedy(
    deltaTime
) {

    const movement =
        geedy.speed *
        (deltaTime / 16.67);

    // Izquierda

    if (
        keys.a
    ) {

        geedy.x -=
            movement;
    }

    // Derecha

    if (
        keys.d
    ) {

        geedy.x +=
            movement;
    }

    // Límites

    if (
        geedy.x < 0
    ) {

        geedy.x =
            0;
    }

    if (
        geedy.x +
            geedy.width >
            canvas.width
    ) {

        geedy.x =
            canvas.width -
            geedy.width;
    }

    const previousY =
        geedy.y;

    // Gravedad

    geedy.velocityY +=
        geedy.gravity *
        (deltaTime / 16.67);

    geedy.y +=
        geedy.velocityY *
        (deltaTime / 16.67);

    geedy.onGround =
        false;

    // Plataformas

    for (
        const platform of platforms
    ) {

        const geedyBottom =
            geedy.y +
            geedy.height;

        const previousBottom =
            previousY +
            geedy.height;

        const horizontal =
            geedy.x +
                geedy.width >
                platform.x &&

            geedy.x <
                platform.x +
                platform.width;

        const landing =
            geedy.velocityY >= 0 &&

            previousBottom <=
                platform.y &&

            geedyBottom >=
                platform.y;

        if (
            horizontal &&
            landing
        ) {

            geedy.y =
                platform.y -
                geedy.height;

            geedy.velocityY =
                0;

            geedy.onGround =
                true;
        }
    }
}

// ====================
// SALTO
// ====================

function jump() {

    if (
        geedy.onGround
    ) {

        geedy.velocityY =
            -geedy.jumpPower;

        geedy.onGround =
            false;
        audio.playJump();
    }
}

// ====================
// LAVA
// ====================

function startLavaWarning() {

    lavaState =
        "warning";

    lavaTimer =
        0;

    lavaDamageGiven =
        false;

    audio.playWarning();
}

function startLava() {

    lavaState =
        "rising";

    lavaTimer =
        0;

    lavaDamageGiven =
        false;

    audio.playLava();
    createLavaParticles();
}

function updateLava(
    deltaTime
) {

    // ====================
    // PRÓXIMA LAVA
    // ====================

    let nextLavaTime;

    const easyFirstLavaTime =
        selectedDifficulty === "facil"
            ? 45000
            : selectedDifficulty === "dificil"
                ? 15000
                : firstLavaTime;

    const easyLavaInterval =
        selectedDifficulty === "facil"
            ? 20000
            : selectedDifficulty === "dificil"
                ? 10000
                : lavaInterval;

    if (
                survivalTimer <
        easyFirstLavaTime
    ) {

        nextLavaTime =
            easyFirstLavaTime;
    }

    else {

        const elapsed =
            survivalTimer -
            easyFirstLavaTime;

        const completed =
            Math.floor(
                elapsed /
                easyLavaInterval
            );

        nextLavaTime =
            easyFirstLavaTime +
            completed *
            easyLavaInterval;

        // Si acabó completamente
        // el evento actual,
        // preparar el siguiente

        if (
            survivalTimer >
                nextLavaTime +
                lavaRiseTime +
                lavaHoldTime +
                lavaLowerTime
        ) {

            nextLavaTime +=
                easyLavaInterval;
        }
    }

    // ====================
    // AVISO 3 SEGUNDOS ANTES
    // ====================

    if (
        lavaState === "none" &&

        survivalTimer >=
            nextLavaTime -
            lavaWarningTime &&

        survivalTimer <
            nextLavaTime
    ) {

        startLavaWarning();
    }

    // ====================
    // EMPIEZA LAVA
    // ====================

    if (
        lavaState === "warning" &&

        survivalTimer >=
            nextLavaTime
    ) {

        startLava();
    }

    // ====================
    // SUBIENDO
    // ====================

    if (
        lavaState === "rising"
    ) {

        lavaTimer +=
            deltaTime;

        if (
            lavaTimer >=
            lavaRiseTime
        ) {

            lavaTimer =
                lavaRiseTime;

            lavaState =
                "holding";
        }
    }

    // ====================
    // ARRIBA
    // ====================

    else if (
        lavaState === "holding"
    ) {

        lavaTimer +=
            deltaTime;

        if (
            lavaTimer >=
            lavaHoldTime
        ) {

            lavaTimer =
                lavaHoldTime;

            lavaState =
                "lowering";
        }
    }

    // ====================
    // BAJANDO
    // ====================

    else if (
        lavaState === "lowering"
    ) {

        lavaTimer +=
            deltaTime;

        if (
            lavaTimer >=
            lavaLowerTime
        ) {

            lavaTimer =
                lavaLowerTime;

            lavaState =
                "none";

            lavaTimer =
                0;
        }
    }

    updateLavaParticles(
        deltaTime
    );

    checkLavaCollision();
}

// ====================
// ALTURA LAVA
// ====================

function getLavaTop() {

    if (
        lavaState === "none"
    ) {

        return 320;
    }

    if (
        lavaState === "warning"
    ) {

        return 320;
    }

    if (
        lavaState === "rising"
    ) {

        const progress =
            lavaTimer /
            lavaRiseTime;

        return (
            320 -
            60 * progress
        );
    }

    if (
        lavaState === "holding"
    ) {

        return 260;
    }

    if (
        lavaState === "lowering"
    ) {

        const progress =
            lavaTimer /
            lavaLowerTime;

        return (
            260 +
            60 * progress
        );
    }

    return 320;
}

// ====================
// COLISIÓN LAVA
// ====================

function checkLavaCollision() {

    if (
        lavaState !== "rising" &&
        lavaState !== "holding" &&
        lavaState !== "lowering"
    ) {

        return;
    }

    if (
        lavaDamageGiven
    ) {

        return;
    }

    const lavaTop =
        getLavaTop();

    const geedyBottom =
        geedy.y +
        geedy.height;

    if (
        geedyBottom >=
        lavaTop
    ) {

        lavaDamageGiven =
            true;

        loseLife();
    }
}

// ====================
// PARTÍCULAS LAVA
// ====================

function createLavaParticles() {

    for (
        let i = 0;
        i < 40;
        i++
    ) {

        lavaParticles.push({

            x:
                Math.random() *
                canvas.width,

            y:
                320,

            vx:
                (Math.random() - 0.5) *
                2,

            vy:
                -(
                    1 +
                    Math.random() * 3
                ),

            size:
                Math.random() < 0.5
                    ? 4
                    : 7,

            life:
                800 +
                Math.random() * 1200
        });
    }
}

function updateLavaParticles(
    deltaTime
) {

    for (
        let i =
            lavaParticles.length - 1;
        i >= 0;
        i--
    ) {

        const p =
            lavaParticles[i];

        p.x +=
            p.vx *
            (deltaTime / 16.67);

        p.y +=
            p.vy *
            (deltaTime / 16.67);

        p.vy +=
            0.05 *
            (deltaTime / 16.67);

        p.life -=
            deltaTime;

        if (
            p.life <= 0
        ) {

            lavaParticles.splice(
                i,
                1
            );
        }
    }
}

// ====================
// DIBUJAR LAVA
// ====================

function drawLava() {

    if (
        lavaState === "none" ||
        lavaState === "warning"
    ) {

        return;
    }

    const lavaTop =
        Math.floor(
            getLavaTop()
        );

    ctx.fillStyle =
        "#d71919";

    ctx.fillRect(
        0,
        lavaTop,
        canvas.width,
        canvas.height -
            lavaTop
    );

    ctx.fillStyle =
        "#ff5a00";

    for (
        let x = 0;
        x < canvas.width;
        x += 32
    ) {

        const offset =
            Math.floor(
                Math.sin(
                    (
                        x +
                        Math.floor(
                            survivalTimer /
                            100
                        )
                    ) / 20
                ) * 4
            );

        ctx.fillRect(
            x,
            lavaTop + offset,
            20,
            8
        );
    }

    ctx.fillStyle =
        "#FFD400";

    for (
        let x = 10;
        x < canvas.width;
        x += 48
    ) {

        ctx.fillRect(
            x,
            lavaTop + 10,
            12,
            6
        );
    }

    ctx.fillStyle =
        "#8f0d0d";

    for (
        let x = 0;
        x < canvas.width;
        x += 40
    ) {

        ctx.fillRect(
            x + 20,
            lavaTop + 20,
            14,
            12
        );
    }

    for (
        const p of lavaParticles
    ) {

        if (
            p.y < lavaTop
        ) {

            continue;
        }

        ctx.fillStyle =
            Math.random() < 0.5
                ? "#FFD400"
                : "#ff8c00";

        ctx.fillRect(
            Math.floor(p.x),
            Math.floor(p.y),
            p.size,
            p.size
        );
    }
}

// ====================
// AVISO ¡SUBE!
// ====================

function drawLavaWarning() {

    if (
        lavaState !== "warning"
    ) {

        return;
    }

    ctx.fillStyle =
        "black";

    ctx.fillRect(
        190,
        45,
        260,
        85
    );

    ctx.fillStyle =
        "#FFD400";

    ctx.fillRect(
        190,
        45,
        260,
        5
    );

    ctx.fillRect(
        190,
        125,
        260,
        5
    );

    ctx.fillRect(
        190,
        45,
        5,
        85
    );

    ctx.fillRect(
        445,
        45,
        5,
        85
    );

    ctx.textAlign =
        "center";

    ctx.fillStyle =
        "#FFD400";

    ctx.font =
        "bold 32px Arial";

    ctx.fillText(
        "¡SUBE!",
        canvas.width / 2,
        82
    );

    ctx.fillStyle =
        "white";

    ctx.fillRect(
        312,
        92,
        16,
        25
    );

    ctx.fillRect(
        302,
        102,
        36,
        8
    );

    ctx.fillRect(
        307,
        97,
        26,
        5
    );

    ctx.fillRect(
        312,
        92,
        16,
        5
    );
}

// ====================
// PANTALLA DE TÍTULO
// ====================

function drawTitleScreen() {

    drawBackground();

    ctx.textAlign =
        "center";

    ctx.fillStyle =
        "#5DE6FF";

    ctx.font =
        "bold 60px Arial";

    ctx.fillText(
        "GEEDY",
        canvas.width / 2,
        75
    );

    ctx.globalAlpha =
        0.35;

    drawGeedy(
        300,
        82
    );

    ctx.globalAlpha =
        1;

    ctx.fillStyle =
        "white";

    ctx.font =
        "bold 18px Arial";

    ctx.fillText(
        "ELIGE LA DIFICULTAD",
        canvas.width / 2,
        118
    );

    drawDifficultyButton(
        180,
        125,
        280,
        48,
        "FÁCIL",
        "#35d07f"
    );

    drawDifficultyButton(
        180,
        185,
        280,
        48,
        "NORMAL",
        "#FFD400"
    );

    drawDifficultyButton(
        180,
        245,
        280,
        48,
        "DIFÍCIL",
        "#ff4040"
    );

    ctx.fillStyle =
        "#FFD400";

    ctx.font =
        "bold 14px Arial";

    ctx.fillText(
        "RÉCORDS  FÁCIL: " + highScores.facil +
        "   NORMAL: " + highScores.normal +
        "   DIFÍCIL: " + highScores.dificil,
        canvas.width / 2,
        309
    );

    ctx.fillStyle =
        "#aaaaaa";

    ctx.font =
        "14px Arial";

    ctx.fillText(
        "A / D = MOVER     W / ESPACIO = SALTAR",
        canvas.width / 2,
        325
    );
}

// ====================
// BOTÓN DIFICULTAD
// ====================

function drawDifficultyButton(
    x,
    y,
    width,
    height,
    text,
    color
) {

    ctx.fillStyle =
        "black";

    ctx.fillRect(
        x - 4,
        y - 4,
        width + 8,
        height + 8
    );

    ctx.fillStyle =
        color;

    ctx.fillRect(
        x,
        y,
        width,
        height
    );

    ctx.fillStyle =
        "black";

    ctx.font =
        "bold 22px Arial";

    ctx.textAlign =
        "center";

    ctx.fillText(
        text,
        x + width / 2,
        y + 31
    );
}

// ====================
// GAME OVER
// ====================

function drawGameOver() {

    drawBackground();

    ctx.textAlign =
        "center";

    ctx.fillStyle =
        "#ff3030";

    ctx.font =
        "bold 55px Arial";

    ctx.fillText(
        "GAME OVER",
        canvas.width / 2,
        95
    );

    ctx.fillStyle =
        "white";

    ctx.font =
        "18px Arial";

    ctx.fillText(
        "Dificultad: " +
        selectedDifficulty.toUpperCase(),
        canvas.width / 2,
        125
    );

    ctx.fillStyle =
        "#FFD400";

    ctx.font =
        "bold 20px Arial";

    ctx.fillText(
        "PUNTOS: " + getScore(),
        canvas.width / 2,
        148
    );

    ctx.fillStyle =
        "#5DE6FF";

    ctx.fillRect(
        220,
        150,
        200,
        50
    );

    ctx.fillStyle =
        "black";

    ctx.font =
        "bold 22px Arial";

    ctx.fillText(
        "RESTART",
        canvas.width / 2,
        183
    );

    ctx.fillStyle =
        "#FFD400";

    ctx.fillRect(
        180,
        220,
        280,
        50
    );

    ctx.fillStyle =
        "black";

    ctx.fillText(
        "PANTALLA DE TÍTULO",
        canvas.width / 2,
        253
    );
}

// ====================
// REINICIAR PARTIDA
// ====================

function restartGame(
    selectedLives = 3
) {

    lives =
        selectedLives;

    geedy.x =
        300;

    geedy.y =
        280;

    geedy.velocityY =
        0;

    geedy.onGround =
        false;

    geedy.invincible =
        false;

    geedy.invincibleTimer =
        0;

    fireball.active =
        false;

    fireball.x =
        0;

    fireball.y =
        0;

    warningActive =
        false;

    warningTimer =
        0;

    enemyTimer =
        0;

    enemyCurrentInterval =
        selectedDifficulty === "facil"
            ? 6000
            : selectedDifficulty === "dificil"
                ? 2500
                : enemyInterval;

    warningParticles.length =
        0;

    ghost.active =
        false;

    ghostTimer =
        0;

    slimeTimer =
        0;

    slimeSlowTimer =
        0;

    geedy.speed =
        normalGeedySpeed;

    geedy.jumpPower =
        normalGeedyJumpPower;

    slimeBall.active =
        false;

    slimeBall.landed =
        false;

    slimeBall.platform =
        null;

    if (
        selectedDifficulty === "dificil"
    ) {

        ghost.active =
            true;

        ghost.x =
            -ghost.width;

        ghost.y =
            60;
    }

    survivalTimer =
        0;

    lavaState =
        "none";

    lavaTimer =
        0;

    lavaDamageGiven =
        false;

    lavaParticles.length =
        0;

    hearts.length =
        0;

    heartTimer =
        0;

    gameState =
        "playing";
}

// ====================
// PAUSA
// ====================

function drawPauseButton() {

    ctx.fillStyle =
        "#FFD400";

    ctx.fillRect(
        555,
        35,
        70,
        28
    );

    ctx.fillStyle =
        "black";

    ctx.font =
        "bold 16px Arial";

    ctx.textAlign =
        "center";

    ctx.fillText(
        "PAUSA",
        590,
        55
    );
}

function drawPauseScreen() {

    drawGame();

    ctx.fillStyle =
        "rgba(0, 0, 0, 0.75)";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.textAlign =
        "center";

    ctx.fillStyle =
        "#5DE6FF";

    ctx.font =
        "bold 48px Arial";

    ctx.fillText(
        "PAUSA",
        canvas.width / 2,
        90
    );

    ctx.fillStyle =
        "#5DE6FF";

    ctx.fillRect(
        180,
        125,
        280,
        50
    );

    ctx.fillStyle =
        "black";

    ctx.font =
        "bold 22px Arial";

    ctx.fillText(
        "REANUDAR JUEGO",
        canvas.width / 2,
        158
    );

    ctx.fillStyle =
        "#FFD400";

    ctx.fillRect(
        180,
        195,
        280,
        50
    );

    ctx.fillStyle =
        "black";

    ctx.fillText(
        "PANTALLA DE TÍTULO",
        canvas.width / 2,
        228
    );
}

// ====================
// DIBUJAR JUEGO
// ====================

function drawGame() {

    drawBackground();

    drawPlatforms();

    drawLava();

    drawLives();

    drawScore();

    drawPauseButton();

    drawHearts();

    drawWarning();

    drawLavaWarning();

    drawFireball();

    drawGhost();

    drawSlimeBall();

    drawGeedy(
        geedy.x,
        geedy.y
    );
}

// ====================
// BUCLE PRINCIPAL
// ====================

let lastTime =
    performance.now();

function gameLoop(
    currentTime
) {

    let deltaTime =
        currentTime -
        lastTime;

    lastTime =
        currentTime;

    if (
        deltaTime > 50
    ) {

        deltaTime =
            50;
    }

    if (
        gameState === "title"
    ) {

        if (music.currentMode !== "title") {
            music.start("title");
        }

        drawTitleScreen();
    }

    else if (
        gameState === "playing"
    ) {

        if (music.currentMode !== "playing") {
            music.start("playing");
        }

        survivalTimer +=
            deltaTime;

        updateGeedy(
            deltaTime
        );

        updateEnemy(
            deltaTime
        );

        updateInvincibility(
            deltaTime
        );

        updateHearts(
            deltaTime
        );

        updateLava(
            deltaTime
        );

        drawGame();
    }

    else if (
        gameState === "paused"
    ) {

        drawPauseScreen();
    }

    else if (
        gameState === "gameover"
    ) {

        if (music.currentMode !== "gameover") {
            music.start("gameover");
        }

        drawGameOver();
    }

    requestAnimationFrame(
        gameLoop
    );
}

// ====================
// TECLADO
// ====================

document.addEventListener(
    "keydown",
    function(event) {

        audio.resume();

        const key =
            event.key.toLowerCase();

        if (
            key === "escape"
        ) {

            if (
                gameState === "playing"
            ) {

                gameState =
                    "paused";

                return;
            }

            if (
                gameState === "paused"
            ) {

                gameState =
                    "playing";

                return;
            }
        }

        if (
            key === "m"
        ) {

            if (music.currentMode === "playing") {
                music.stop();
            }
            else if (gameState === "title") {
                music.start("title");
            }
        }

        if (
            key === "a"
        ) {

            keys.a =
                true;
        }

        if (
            key === "d"
        ) {

            keys.d =
                true;
        }

        if (
            key === "w"
        ) {

            keys.w =
                true;
        }

        if (
            event.code ===
                "Space" &&

            gameState ===
                "title"
        ) {

            selectedDifficulty =
                "normal";

            restartGame(
                3
            );

            return;
        }

        if (
            (
                key === "w" ||
                event.code ===
                    "Space"
            ) &&

            gameState ===
                "playing"
        ) {

            jump();
        }
    }
);

// ====================
// SOLTAR TECLAS
// ====================

document.addEventListener(
    "keyup",
    function(event) {

        const key =
            event.key.toLowerCase();

        if (
            key === "a"
        ) {

            keys.a =
                false;
        }

        if (
            key === "d"
        ) {

            keys.d =
                false;
        }

        if (
            key === "w"
        ) {

            keys.w =
                false;
        }
    }
);

if (mobileButtons.left) {
    mobileButtons.left.addEventListener("pointerdown", function(event) {
        event.preventDefault();
        handleTouchMoveState("left", true);
    });

    mobileButtons.left.addEventListener("pointerup", function() {
        handleTouchMoveState("left", false);
    });

    mobileButtons.left.addEventListener("pointerleave", function() {
        handleTouchMoveState("left", false);
    });

    mobileButtons.left.addEventListener("pointercancel", function() {
        handleTouchMoveState("left", false);
    });
}

if (mobileButtons.right) {
    mobileButtons.right.addEventListener("pointerdown", function(event) {
        event.preventDefault();
        handleTouchMoveState("right", true);
    });

    mobileButtons.right.addEventListener("pointerup", function() {
        handleTouchMoveState("right", false);
    });

    mobileButtons.right.addEventListener("pointerleave", function() {
        handleTouchMoveState("right", false);
    });

    mobileButtons.right.addEventListener("pointercancel", function() {
        handleTouchMoveState("right", false);
    });
}

if (mobileButtons.jump) {
    mobileButtons.jump.addEventListener("pointerdown", function(event) {
        event.preventDefault();
        handleTouchMoveState("jump", true);
    });

    mobileButtons.jump.addEventListener("pointerup", function() {
        handleTouchMoveState("jump", false);
    });

    mobileButtons.jump.addEventListener("pointerleave", function() {
        handleTouchMoveState("jump", false);
    });

    mobileButtons.jump.addEventListener("pointercancel", function() {
        handleTouchMoveState("jump", false);
    });
}

// ====================
// CLICS
// ====================

canvas.addEventListener(
    "click",
    function(event) {

        audio.resume();

        const rect =
            canvas.getBoundingClientRect();

        const mouseX =
            (
                event.clientX -
                rect.left
            ) *
            (
                canvas.width /
                rect.width
            );

        const mouseY =
            (
                event.clientY -
                rect.top
            ) *
            (
                canvas.height /
                rect.height
            );

        // ====================
        // BOTÓN PAUSA
        // ====================

        if (
            gameState === "playing" &&
            mouseX >= 555 &&
            mouseX <= 625 &&
            mouseY >= 35 &&
            mouseY <= 63
        ) {

            gameState =
                "paused";

            return;
        }

        // ====================
        // MENÚ DE PAUSA
        // ====================

        if (
            gameState === "paused"
        ) {

            if (
                mouseX >= 180 &&
                mouseX <= 460 &&
                mouseY >= 125 &&
                mouseY <= 175
            ) {

                gameState =
                    "playing";

                return;
            }

            if (
                mouseX >= 180 &&
                mouseX <= 460 &&
                mouseY >= 195 &&
                mouseY <= 245
            ) {

                gameState =
                    "title";

                return;
            }
        }

        // ====================
        // MENÚ
        // ====================

        if (
            gameState ===
                "title"
        ) {

            if (
                mouseX >= 180 &&
                mouseX <= 460 &&
                mouseY >= 125 &&
                mouseY <= 173
            ) {

                selectedDifficulty =
                    "facil";

                restartGame(
                    5
                );

                return;
            }

            if (
                mouseX >= 180 &&
                mouseX <= 460 &&
                mouseY >= 185 &&
                mouseY <= 233
            ) {

                selectedDifficulty =
                    "normal";

                restartGame(
                    3
                );

                return;
            }

            if (
                mouseX >= 180 &&
                mouseX <= 460 &&
                mouseY >= 245 &&
                mouseY <= 293
            ) {

                selectedDifficulty =
                    "dificil";

                restartGame(
                    1
                );

                return;
            }
        }

        // ====================
        // GAME OVER
        // ====================

        if (
            gameState ===
                "gameover"
        ) {

            if (
                mouseX >= 220 &&
                mouseX <= 420 &&
                mouseY >= 150 &&
                mouseY <= 200
            ) {

                let restartLives =
                    3;

                if (
                    selectedDifficulty ===
                    "facil"
                ) {

                    restartLives =
                        5;
                }

                if (
                    selectedDifficulty ===
                    "dificil"
                ) {

                    restartLives =
                        1;
                }

                restartGame(
                    restartLives
                );

                return;
            }

            if (
                mouseX >= 180 &&
                mouseX <= 460 &&
                mouseY >= 220 &&
                mouseY <= 270
            ) {

                gameState =
                    "title";

                return;
            }
        }
    }
);

// ====================
// INICIAR JUEGO
// ====================

requestAnimationFrame(
    gameLoop
)