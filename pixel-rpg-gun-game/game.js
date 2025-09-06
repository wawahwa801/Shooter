// Pixel RPG Gun Game
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 600;
        
        // Game state
        this.gameRunning = true;
        this.score = 0;
        this.wave = 1;
        this.monstersKilled = 0;
        
        // Audio context for sound effects
        this.audioContext = null;
        this.sounds = {};
        this.initAudio();
        
        // Player
        this.player = {
            x: this.canvas.width / 2,
            y: this.canvas.height / 2,
            size: 20,
            speed: 5,
            health: 100,
            maxHealth: 100,
            angle: 0,
            damage: 1,
            rapidFire: false,
            rapidFireTime: 0,
            level: 1,
            xp: 0,
            xpToNext: 100
        };
        
        // Input handling
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        
        // Game objects
        this.bullets = [];
        this.monsters = [];
        this.particles = [];
        this.powerUps = [];
        
        // Game timing
        this.lastMonsterSpawn = 0;
        this.monsterSpawnRate = 2000; // milliseconds
        this.lastShot = 0;
        this.shotCooldown = 200; // milliseconds
        this.lastWaveCheck = 0;
        this.monstersPerWave = 10;
        
        // Screen shake
        this.screenShake = 0;
        this.screenShakeIntensity = 0;
        
        // Level up system
        this.showingLevelUp = false;
        this.levelUpOptions = [];
        this.selectedOption = 0;
        
        this.setupEventListeners();
        this.gameLoop();
    }
    
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    playSound(frequency, duration, type = 'sine') {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    setupEventListeners() {
        // Keyboard input
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            // Level up screen navigation
            if (this.showingLevelUp) {
                if (e.key === 'ArrowUp' || e.key === 'w') {
                    this.selectedOption = Math.max(0, this.selectedOption - 1);
                } else if (e.key === 'ArrowDown' || e.key === 's') {
                    this.selectedOption = Math.min(this.levelUpOptions.length - 1, this.selectedOption + 1);
                } else if (e.key === 'Enter' || e.key === ' ') {
                    this.selectLevelUpOption();
                }
                return;
            }
            
            // Space bar shooting
            if (e.code === 'Space') {
                e.preventDefault();
                this.shoot();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // Mouse input
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        
        this.canvas.addEventListener('click', (e) => {
            this.shoot();
        });
    }
    
    update() {
        if (!this.gameRunning) return;
        
        // Pause game during level up screen
        if (this.showingLevelUp) {
            this.updateUI();
            return;
        }
        
        this.updatePlayer();
        this.updateBullets();
        this.updateMonsters();
        this.updateParticles();
        this.updatePowerUps();
        this.updatePlayerPowerUps();
        this.spawnMonsters();
        this.checkCollisions();
        this.checkLevelUp();
        this.checkWaveProgression();
        this.updateScreenShake();
        this.updateUI();
    }
    
    updatePlayer() {
        // Movement
        if (this.keys['w'] || this.keys['arrowup']) {
            this.player.y = Math.max(this.player.size, this.player.y - this.player.speed);
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            this.player.y = Math.min(this.canvas.height - this.player.size, this.player.y + this.player.speed);
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.player.x = Math.max(this.player.size, this.player.x - this.player.speed);
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            this.player.x = Math.min(this.canvas.width - this.player.size, this.player.x + this.player.speed);
        }
        
        // Calculate angle to mouse
        const dx = this.mouse.x - this.player.x;
        const dy = this.mouse.y - this.player.y;
        this.player.angle = Math.atan2(dy, dx);
    }
    
    shoot() {
        const now = Date.now();
        const currentCooldown = this.player.rapidFire ? this.shotCooldown / 3 : this.shotCooldown;
        if (now - this.lastShot < currentCooldown) return;
        
        this.lastShot = now;
        
        const bullet = {
            x: this.player.x,
            y: this.player.y,
            vx: Math.cos(this.player.angle) * 8,
            vy: Math.sin(this.player.angle) * 8,
            size: 4,
            life: 120 // frames
        };
        
        this.bullets.push(bullet);
        
        // Muzzle flash effect
        this.addParticles(this.player.x, this.player.y, 5, '#ffff00');
        
        // Shooting sound
        this.playSound(800, 0.1, 'square');
    }
    
    updateBullets() {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.x += bullet.vx;
            bullet.y += bullet.vy;
            bullet.life--;
            
            // Remove bullets that are off-screen or expired
            if (bullet.x < 0 || bullet.x > this.canvas.width || 
                bullet.y < 0 || bullet.y > this.canvas.height || 
                bullet.life <= 0) {
                this.bullets.splice(i, 1);
            }
        }
    }
    
    spawnMonsters() {
        const now = Date.now();
        if (now - this.lastMonsterSpawn > this.monsterSpawnRate) {
            this.lastMonsterSpawn = now;
            
            // Spawn monster from random edge
            const edge = Math.floor(Math.random() * 4);
            let x, y;
            
            switch (edge) {
                case 0: // Top
                    x = Math.random() * this.canvas.width;
                    y = -20;
                    break;
                case 1: // Right
                    x = this.canvas.width + 20;
                    y = Math.random() * this.canvas.height;
                    break;
                case 2: // Bottom
                    x = Math.random() * this.canvas.width;
                    y = this.canvas.height + 20;
                    break;
                case 3: // Left
                    x = -20;
                    y = Math.random() * this.canvas.height;
                    break;
            }
            
            const monster = {
                x: x,
                y: y,
                size: 15 + Math.random() * 10,
                speed: 1 + Math.random() * 2,
                health: 2 + Math.floor(Math.random() * 3),
                maxHealth: 2 + Math.floor(Math.random() * 3),
                color: this.getRandomMonsterColor(),
                lastAttack: 0,
                attackCooldown: 1000 + Math.random() * 1000
            };
            
            this.monsters.push(monster);
        }
    }
    
    getRandomMonsterColor() {
        const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    updateMonsters() {
        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const monster = this.monsters[i];
            
            // Move towards player
            const dx = this.player.x - monster.x;
            const dy = this.player.y - monster.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                monster.x += (dx / distance) * monster.speed;
                monster.y += (dy / distance) * monster.speed;
            }
            
            // Attack player if close enough
                            if (distance < 30) {
                    const now = Date.now();
                    if (now - monster.lastAttack > monster.attackCooldown) {
                        monster.lastAttack = now;
                        this.player.health -= 10;
                        this.addParticles(this.player.x, this.player.y, 8, '#ff0000');
                        this.addScreenShake(5);
                        this.playSound(150, 0.2, 'sawtooth');
                    }
                }
            
            // Remove dead monsters
            if (monster.health <= 0) {
                this.monsters.splice(i, 1);
                this.score += 10;
                this.monstersKilled++;
                this.addParticles(monster.x, monster.y, 15, monster.color);
                
                // Gain XP
                const xpGain = 10 + Math.floor(monster.size / 5);
                this.player.xp += xpGain;
                
                // Monster death sound and screen shake
                this.playSound(200, 0.3, 'sawtooth');
                this.addScreenShake(3);
            }
        }
    }
    
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            particle.alpha = particle.life / particle.maxLife;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    updatePowerUps() {
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            powerUp.life--;
            
            if (powerUp.life <= 0) {
                this.powerUps.splice(i, 1);
            }
        }
    }
    
    addParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                size: Math.random() * 3 + 1,
                color: color,
                life: 30 + Math.random() * 30,
                maxLife: 30 + Math.random() * 30,
                alpha: 1
            });
        }
    }
    
    checkCollisions() {
        // Bullet vs Monster collisions
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            for (let j = this.monsters.length - 1; j >= 0; j--) {
                const monster = this.monsters[j];
                const dx = bullet.x - monster.x;
                const dy = bullet.y - monster.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < bullet.size + monster.size) {
                    monster.health -= this.player.damage;
                    this.bullets.splice(i, 1);
                    this.addParticles(bullet.x, bullet.y, 5, '#ffffff');
                    break;
                }
            }
        }
        
        // Player vs Power-up collisions
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            const dx = this.player.x - powerUp.x;
            const dy = this.player.y - powerUp.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < this.player.size + powerUp.size) {
                this.applyPowerUp(powerUp);
                this.powerUps.splice(i, 1);
            }
        }
        
        // Check game over
        if (this.player.health <= 0) {
            this.gameRunning = false;
            this.gameOver();
        }
    }
    
    checkLevelUp() {
        if (this.player.xp >= this.player.xpToNext) {
            this.levelUp();
        }
    }
    
    levelUp() {
        this.player.level++;
        this.player.xp -= this.player.xpToNext;
        this.player.xpToNext = Math.floor(this.player.xpToNext * 1.5); // Increase XP requirement
        
        // Generate level up options
        this.generateLevelUpOptions();
        this.showingLevelUp = true;
        this.selectedOption = 0;
        
        // Level up sound
        this.playSound(800, 0.5, 'triangle');
    }
    
    generateLevelUpOptions() {
        const options = [
            { type: 'health', name: 'Max Health +25', description: 'Increase maximum health' },
            { type: 'speed', name: 'Speed +1', description: 'Move faster' },
            { type: 'damage', name: 'Damage +1', description: 'Bullets deal more damage' },
            { type: 'rapidFire', name: 'Rapid Fire', description: 'Shoot 3x faster for 10 seconds' },
            { type: 'heal', name: 'Heal +50', description: 'Restore health' }
        ];
        
        // Randomly select 3 options
        this.levelUpOptions = [];
        const availableOptions = [...options];
        
        for (let i = 0; i < 3; i++) {
            const randomIndex = Math.floor(Math.random() * availableOptions.length);
            this.levelUpOptions.push(availableOptions[randomIndex]);
            availableOptions.splice(randomIndex, 1);
        }
    }
    
    selectLevelUpOption() {
        const option = this.levelUpOptions[this.selectedOption];
        
        switch (option.type) {
            case 'health':
                this.player.maxHealth += 25;
                this.player.health += 25; // Also heal
                break;
            case 'speed':
                this.player.speed = Math.min(12, this.player.speed + 1);
                break;
            case 'damage':
                this.player.damage = Math.min(8, this.player.damage + 1);
                break;
            case 'rapidFire':
                this.player.rapidFire = true;
                this.player.rapidFireTime = 600; // 10 seconds at 60fps
                break;
            case 'heal':
                this.player.health = Math.min(this.player.maxHealth, this.player.health + 50);
                break;
        }
        
        this.showingLevelUp = false;
        this.playSound(400, 0.3, 'sine');
    }
    
    checkWaveProgression() {
        const now = Date.now();
        if (now - this.lastWaveCheck > 1000 && this.monsters.length === 0) {
            this.lastWaveCheck = now;
            this.wave++;
            this.monstersPerWave += 5;
            this.monsterSpawnRate = Math.max(500, this.monsterSpawnRate - 100);
            this.shotCooldown = Math.max(100, this.shotCooldown - 10);
            
            // Wave start sound
            this.playSound(600, 0.5, 'triangle');
        }
    }
    
    updateScreenShake() {
        if (this.screenShake > 0) {
            this.screenShake--;
        }
    }
    
    addScreenShake(intensity) {
        this.screenShake = 10;
        this.screenShakeIntensity = intensity;
    }
    
    getPowerUpColor(type) {
        const colors = {
            'health': '#00ff00',
            'speed': '#00aaff',
            'damage': '#ff4444',
            'rapidFire': '#ffff00'
        };
        return colors[type] || '#ffffff';
    }
    
    updatePlayerPowerUps() {
        // Update rapid fire timer
        if (this.player.rapidFire && this.player.rapidFireTime > 0) {
            this.player.rapidFireTime--;
            if (this.player.rapidFireTime <= 0) {
                this.player.rapidFire = false;
            }
        }
    }
    
    applyPowerUp(powerUp) {
        this.addParticles(powerUp.x, powerUp.y, 10, powerUp.color);
        this.playSound(400, 0.2, 'sine');
        
        switch (powerUp.type) {
            case 'health':
                this.player.health = Math.min(this.player.maxHealth, this.player.health + 25);
                break;
            case 'speed':
                this.player.speed = Math.min(10, this.player.speed + 1);
                break;
            case 'damage':
                this.player.damage = Math.min(5, this.player.damage + 1);
                break;
            case 'rapidFire':
                this.player.rapidFire = true;
                this.player.rapidFireTime = 300; // 5 seconds at 60fps
                break;
        }
    }
    
    updateUI() {
        document.getElementById('health').textContent = Math.max(0, this.player.health);
        document.getElementById('healthBar').style.width = (this.player.health / this.player.maxHealth * 100) + '%';
        document.getElementById('score').textContent = this.score;
        document.getElementById('monsterCount').textContent = this.monsters.length;
        
        // Add wave display
        const waveElement = document.getElementById('wave');
        if (!waveElement) {
            const ui = document.getElementById('ui');
            const waveDiv = document.createElement('div');
            waveDiv.id = 'wave';
            waveDiv.textContent = `Wave: ${this.wave}`;
            ui.appendChild(waveDiv);
        } else {
            waveElement.textContent = `Wave: ${this.wave}`;
        }
        
        // Add level and XP display
        this.updateLevelUI();
        
        // Add power-up status display
        this.updatePowerUpUI();
    }
    
    updatePowerUpUI() {
        const ui = document.getElementById('ui');
        
        // Remove existing power-up display
        const existingPowerUpUI = document.getElementById('powerUpUI');
        if (existingPowerUpUI) {
            existingPowerUpUI.remove();
        }
        
        // Create power-up status display
        const powerUpUI = document.createElement('div');
        powerUpUI.id = 'powerUpUI';
        powerUpUI.style.marginTop = '10px';
        powerUpUI.style.fontSize = '12px';
        
        let powerUpText = `Speed: ${this.player.speed} | Damage: ${this.player.damage}`;
        if (this.player.rapidFire) {
            powerUpText += ` | Rapid Fire: ${Math.ceil(this.player.rapidFireTime / 60)}s`;
        }
        
        powerUpUI.textContent = powerUpText;
        ui.appendChild(powerUpUI);
    }
    
    updateLevelUI() {
        const ui = document.getElementById('ui');
        
        // Remove existing level display
        const existingLevelUI = document.getElementById('levelUI');
        if (existingLevelUI) {
            existingLevelUI.remove();
        }
        
        // Create level and XP display
        const levelUI = document.createElement('div');
        levelUI.id = 'levelUI';
        levelUI.style.marginTop = '5px';
        levelUI.style.fontSize = '14px';
        
        const xpPercent = (this.player.xp / this.player.xpToNext * 100).toFixed(1);
        levelUI.innerHTML = `
            <div>Level: ${this.player.level}</div>
            <div>XP: ${this.player.xp}/${this.player.xpToNext} (${xpPercent}%)</div>
            <div class="xp-bar" style="width: 150px; height: 8px; border: 1px solid #333; background: #222; margin-top: 2px;">
                <div style="width: ${xpPercent}%; height: 100%; background: linear-gradient(90deg, #00ff00, #ffff00);"></div>
            </div>
        `;
        ui.appendChild(levelUI);
    }
    
    gameOver() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = '48px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 50);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Courier New';
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 20);
        this.ctx.fillText(`Level Reached: ${this.player.level}`, this.canvas.width / 2, this.canvas.height / 2 + 50);
        this.ctx.fillText(`Monsters Killed: ${this.monstersKilled}`, this.canvas.width / 2, this.canvas.height / 2 + 80);
        this.ctx.fillText('Refresh to play again', this.canvas.width / 2, this.canvas.height / 2 + 110);
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply screen shake
        if (this.screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShakeIntensity;
            const shakeY = (Math.random() - 0.5) * this.screenShakeIntensity;
            this.ctx.save();
            this.ctx.translate(shakeX, shakeY);
        }
        
        // Draw grid background
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        // Draw power-ups
        this.powerUps.forEach(powerUp => {
            this.ctx.fillStyle = powerUp.color;
            
            // Draw different shapes for different power-ups
            switch (powerUp.type) {
                case 'health':
                    // Heart shape (square)
                    this.ctx.fillRect(powerUp.x - powerUp.size/2, powerUp.y - powerUp.size/2, powerUp.size, powerUp.size);
                    break;
                case 'speed':
                    // Diamond shape
                    this.ctx.save();
                    this.ctx.translate(powerUp.x, powerUp.y);
                    this.ctx.rotate(Math.PI / 4);
                    this.ctx.fillRect(-powerUp.size/2, -powerUp.size/2, powerUp.size, powerUp.size);
                    this.ctx.restore();
                    break;
                case 'damage':
                    // Star shape (octagon approximation)
                    this.ctx.beginPath();
                    this.ctx.moveTo(powerUp.x, powerUp.y - powerUp.size/2);
                    this.ctx.lineTo(powerUp.x + powerUp.size/3, powerUp.y - powerUp.size/3);
                    this.ctx.lineTo(powerUp.x + powerUp.size/2, powerUp.y);
                    this.ctx.lineTo(powerUp.x + powerUp.size/3, powerUp.y + powerUp.size/3);
                    this.ctx.lineTo(powerUp.x, powerUp.y + powerUp.size/2);
                    this.ctx.lineTo(powerUp.x - powerUp.size/3, powerUp.y + powerUp.size/3);
                    this.ctx.lineTo(powerUp.x - powerUp.size/2, powerUp.y);
                    this.ctx.lineTo(powerUp.x - powerUp.size/3, powerUp.y - powerUp.size/3);
                    this.ctx.closePath();
                    this.ctx.fill();
                    break;
                case 'rapidFire':
                    // Circle
                    this.ctx.beginPath();
                    this.ctx.arc(powerUp.x, powerUp.y, powerUp.size/2, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;
                default:
                    this.ctx.fillRect(powerUp.x - powerUp.size/2, powerUp.y - powerUp.size/2, powerUp.size, powerUp.size);
            }
        });
        
        // Draw monsters
        this.monsters.forEach(monster => {
            // Monster body
            this.ctx.fillStyle = monster.color;
            this.ctx.fillRect(monster.x - monster.size/2, monster.y - monster.size/2, monster.size, monster.size);
            
            // Monster health bar
            if (monster.health < monster.maxHealth) {
                this.ctx.fillStyle = '#ff0000';
                this.ctx.fillRect(monster.x - monster.size/2, monster.y - monster.size/2 - 8, monster.size, 4);
                this.ctx.fillStyle = '#00ff00';
                this.ctx.fillRect(monster.x - monster.size/2, monster.y - monster.size/2 - 8, 
                    (monster.health / monster.maxHealth) * monster.size, 4);
            }
        });
        
        // Draw bullets
        this.ctx.fillStyle = '#ffff00';
        this.bullets.forEach(bullet => {
            this.ctx.fillRect(bullet.x - bullet.size/2, bullet.y - bullet.size/2, bullet.size, bullet.size);
        });
        
        // Draw player
        this.ctx.save();
        this.ctx.translate(this.player.x, this.player.y);
        this.ctx.rotate(this.player.angle);
        
        // Player body
        this.ctx.fillStyle = '#00aaff';
        this.ctx.fillRect(-this.player.size/2, -this.player.size/2, this.player.size, this.player.size);
        
        // Player gun
        this.ctx.fillStyle = '#666666';
        this.ctx.fillRect(this.player.size/2 - 2, -2, 15, 4);
        
        this.ctx.restore();
        
        // Draw particles
        this.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.alpha;
            this.ctx.fillStyle = particle.color;
            this.ctx.fillRect(particle.x - particle.size/2, particle.y - particle.size/2, particle.size, particle.size);
            this.ctx.restore();
        });
        
        // Restore screen shake transform
        if (this.screenShake > 0) {
            this.ctx.restore();
        }
        
        // Draw level up screen
        if (this.showingLevelUp) {
            this.renderLevelUpScreen();
        }
    }
    
    renderLevelUpScreen() {
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Level up title
        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = '48px Courier New';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('LEVEL UP!', this.canvas.width / 2, 150);
        
        // Level display
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Courier New';
        this.ctx.fillText(`Level ${this.player.level}`, this.canvas.width / 2, 200);
        
        // Instructions
        this.ctx.font = '16px Courier New';
        this.ctx.fillText('Choose your upgrade:', this.canvas.width / 2, 250);
        this.ctx.fillText('Use W/S or Arrow Keys to navigate, Enter/Space to select', this.canvas.width / 2, 280);
        
        // Draw options
        const startY = 320;
        const optionHeight = 60;
        
        this.levelUpOptions.forEach((option, index) => {
            const y = startY + index * optionHeight;
            const isSelected = index === this.selectedOption;
            
            // Background
            this.ctx.fillStyle = isSelected ? '#4444ff' : '#333333';
            this.ctx.fillRect(200, y - 25, 400, 50);
            
            // Border
            this.ctx.strokeStyle = isSelected ? '#ffffff' : '#666666';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(200, y - 25, 400, 50);
            
            // Text
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '18px Courier New';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(option.name, 220, y);
            
            this.ctx.font = '14px Courier New';
            this.ctx.fillStyle = '#cccccc';
            this.ctx.fillText(option.description, 220, y + 20);
            
            // Selection indicator
            if (isSelected) {
                this.ctx.fillStyle = '#ffff00';
                this.ctx.font = '24px Courier New';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('>', 180, y + 5);
                this.ctx.fillText('<', 620, y + 5);
            }
        });
        
        this.ctx.textAlign = 'center';
    }
    
    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    new Game();
});
