'use strict';

const { Plugin, PluginSettingTab, Setting } = require('obsidian');

/*
 * ============================================================
 * SPARKLE PLUGIN
 * ============================================================
 *
 * Animated sparkles overlay with customizable colors and settings
 */

class SparklePlugin extends Plugin {
    async onload() {
        this.sparkles = [];
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.lastSpawnTime = 0;
        this.width = 0;
        this.height = 0;

        // Load settings
        this.loadSettings();

        // Install styles
        this.installStyles();

        // Create canvas overlay
        this.createCanvas();

        // Start animation
        this.startAnimation();

        // Register settings tab
        this.addSettingTab(new SparkleSettingTab(this.app, this));
    }

    onunload() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }

        if (this.styleEl) {
            this.styleEl.remove();
        }
    }

    loadSettings() {
        const settings = this.loadData() || {};
        
        this.settings = {
            sparkleCount: settings.sparkleCount ?? 15,
            minSize: settings.minSize ?? 1.5,
            maxSize: settings.maxSize ?? 4,
            minLifetime: settings.minLifetime ?? 1500,
            maxLifetime: settings.maxLifetime ?? 3000,
            wiggleDistance: settings.wiggleDistance ?? 4,
            maxRotation: settings.maxRotation ?? 10,
            fadeInDuration: settings.fadeInDuration ?? 500,
            fadeOutDuration: settings.fadeOutDuration ?? 800,
            colorPreset: settings.colorPreset ?? 'white'
        };
    }

    saveSettings() {
        this.saveData(this.settings);
    }

    installStyles() {
        this.styleEl = document.createElement('style');
        this.styleEl.textContent = `
            .sparkle-canvas {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                pointer-events: none;
                z-index: 9999;
                display: block;
            }
        `;
        document.head.appendChild(this.styleEl);
    }

    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'sparkle-canvas';
        
        // Ensure body exists
        if (!document.body) {
            console.error('Sparkles: document.body not available');
            return;
        }
        
        document.body.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('Sparkles: Could not get 2D context');
            return;
        }
        
        this.resizeCanvas();
        
        window.addEventListener('resize', () => this.resizeCanvas());
        
        console.log('Sparkles: Canvas created and initialized');
    }

    resizeCanvas() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    startAnimation() {
        const animate = (timestamp) => {
            this.tick(timestamp);
            this.animationId = requestAnimationFrame(animate);
        };
        this.animationId = requestAnimationFrame(animate);
        console.log('Sparkles: Animation started');
    }

    tick(timestamp) {
        if (!this.ctx) return;
        
        const now = Date.now();
        
        // Spawn new sparkles
        if (now - this.lastSpawnTime > 50) {
            this.spawnSparkles();
            this.lastSpawnTime = now;
        }

        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw sparkles
        let aliveCount = 0;
        for (const sparkle of this.sparkles) {
            if (sparkle.alive(now)) {
                this.drawSparkle(sparkle, now);
                aliveCount++;
            }
        }

        // Remove dead sparkles
        this.sparkles = this.sparkles.filter(s => s.alive(now));
        
        // Debug logging every second
        if (now % 1000 < 20) {
            console.log(`Sparkles: ${this.sparkles.length} total, ${aliveCount} alive`);
        }
    }

    spawnSparkles() {
        while (this.sparkles.length < this.settings.sparkleCount) {
            this.sparkles.push(this.createSparkle());
        }
    }

    createSparkle() {
        const starTypes = ['diamond', 'hollow_diamond', 'soft_star', 'six_point', 'eight_point'];
        
        // Capture settings at creation time
        const wiggleDistance = this.settings.wiggleDistance;
        const maxRotation = this.settings.maxRotation;
        const color = this.getColor();
        
        return {
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            size: this.randomRange(this.settings.minSize, this.settings.maxSize),
            birth: Date.now(),
            lifetime: this.randomRange(this.settings.minLifetime, this.settings.maxLifetime),
            phase: Math.random() * Math.PI * 2,
            wiggleX: this.randomRange(0.5, 1.5),
            wiggleY: this.randomRange(0.5, 1.5),
            rotationPhase: Math.random() * Math.PI * 2,
            rotationSpeed: this.randomRange(0.4, 1.2),
            starType: starTypes[Math.floor(Math.random() * starTypes.length)],
            alpha: this.randomRange(0.55, 1.0),
            wiggleDistance: wiggleDistance,
            maxRotation: maxRotation,
            color: color,
            
            alive(now) {
                return (now - this.birth) < this.lifetime;
            },
            
            progress(now) {
                return Math.min((now - this.birth) / this.lifetime, 1.0);
            },
            
            position(now) {
                const elapsed = (now - this.birth) / 1000;
                const x = this.x + Math.sin(elapsed * this.wiggleX + this.phase) * this.wiggleDistance;
                const y = this.y + Math.sin(elapsed * this.wiggleY + this.phase * 1.37) * this.wiggleDistance;
                return { x, y };
            },
            
            rotation(now) {
                const elapsed = (now - this.birth) / 1000;
                return Math.sin(elapsed * this.rotationSpeed + this.rotationPhase) * this.maxRotation;
            }
        };
    }

    randomRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    drawSparkle(sparkle, now) {
        let progress = sparkle.progress(now);
        
        // Clamp progress to avoid negative values from timing issues
        progress = Math.max(0, Math.min(1, progress));
        
        // Fade in/out - use proportional fade like the original Python script
        // Fade in over 20% of lifetime, fade out over 20% of lifetime
        const fadeIn = Math.min(progress * 5.0, 1.0);
        const fadeOut = Math.min((1 - progress) * 5.0, 1.0);
        const alpha = fadeIn * fadeOut * sparkle.alpha;
        
        // Skip drawing if alpha is too low
        if (alpha < 0.01) return;
        
        // Position
        const { x, y } = sparkle.position(now);
        
        // Pulse
        const pulse = 1.0 + Math.sin((now - sparkle.birth) / 1000 * 3 + sparkle.phase) * 0.10;
        const size = sparkle.size * pulse;
        
        // Rotation
        const rotation = sparkle.rotation(now) * (Math.PI / 180);
        
        // Use the sparkle's assigned color
        const color = sparkle.color;
        
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(rotation);
        
        // Soft glow
        this.ctx.globalAlpha = alpha * 0.08;
        this.ctx.fillStyle = color;
        this.drawShape(sparkle.starType, size * 1.8);
        
        this.ctx.globalAlpha = alpha * 0.12;
        this.drawShape(sparkle.starType, size * 1.35);
        
        // Main shape
        this.ctx.globalAlpha = alpha;
        this.ctx.fillStyle = color;
        
        if (sparkle.starType === 'hollow_diamond') {
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = Math.max(0.7, size * 0.22);
            this.drawShape(sparkle.starType, size, true);
        } else {
            this.drawShape(sparkle.starType, size);
        }
        
        this.ctx.restore();
    }

    drawShape(type, size, hollow = false) {
        this.ctx.beginPath();
        
        switch (type) {
            case 'diamond':
            case 'hollow_diamond':
                this.drawDiamond(size);
                break;
            case 'soft_star':
                this.drawSoftStar(size);
                break;
            case 'six_point':
                this.drawSixPoint(size);
                break;
            case 'eight_point':
                this.drawEightPoint(size);
                break;
        }
        
        if (hollow) {
            this.ctx.stroke();
        } else {
            this.ctx.fill();
        }
    }

    drawDiamond(size) {
        const long = size * 2.0;
        const short = size * 0.35;
        
        this.ctx.moveTo(0, -long);
        this.ctx.lineTo(short, -short);
        this.ctx.lineTo(long, 0);
        this.ctx.lineTo(short, short);
        this.ctx.lineTo(0, long);
        this.ctx.lineTo(-short, short);
        this.ctx.lineTo(-long, 0);
        this.ctx.lineTo(-short, -short);
        this.ctx.closePath();
    }

    drawSoftStar(size) {
        const outer = size * 1.8;
        const inner = size * 0.42;
        
        for (let i = 0; i < 10; i++) {
            const angle = -Math.PI / 2 + (i * Math.PI / 5);
            const radius = i % 2 === 0 ? outer : inner;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
    }

    drawSixPoint(size) {
        const outer = size * 1.8;
        const inner = size * 0.38;
        
        for (let i = 0; i < 12; i++) {
            const angle = -Math.PI / 2 + (i * Math.PI / 6);
            const radius = i % 2 === 0 ? outer : inner;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
    }

    drawEightPoint(size) {
        const outer = size * 1.9;
        const inner = size * 0.32;
        
        for (let i = 0; i < 16; i++) {
            const angle = -Math.PI / 2 + (i * Math.PI / 8);
            const radius = i % 2 === 0 ? outer : inner;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
    }

    getColor() {
        return this.getColorFromPreset(this.settings.colorPreset);
    }

    getColorFromPreset(preset) {
        // Flag color presets from SparkleConfig.kt
        const flagColors = {
            'rainbow': ['#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#0000FF', '#880088', '#FF00FF'],
            'gay-men': ['#078D70', '#26CEAA', '#98E8C1', '#FFFFFF', '#7BADE2', '#5049CC', '#3D1A78'],
            'lesbian': ['#D52D00', '#EF7627', '#FF9A56', '#FFFFFF', '#D162A4', '#B55690', '#A30262'],
            'bisexual': ['#D60270', '#9B4F96', '#0038A8'],
            'pansexual': ['#FF218C', '#FFD800', '#21B1FF'],
            'transgender': ['#5BCEFA', '#F5A9B8', '#FFFFFF'],
            'non-binary': ['#FCF434', '#FFFFFF', '#9C59D1', '#000000'],
            'asexual': ['#000000', '#A3A3A3', '#FFFFFF', '#800080'],
            'aromantic': ['#3DA542', '#A7D379', '#FFFFFF', '#A9A9A9', '#000000'],
            'aroace': ['#DD8A00', '#E9CC07', '#FFFFFF', '#65B0DD', '#213C57'],
            'demisexual': ['#000000', '#FFFFFF', '#6E0070', '#D2D2D2'],
            'genderfluid': ['#FF75A2', '#FFFFFF', '#BE18D6', '#000000', '#333EBD'],
            'genderqueer': ['#B57EDC', '#FFFFFF', '#4A8123'],
            'agender': ['#000000', '#B9B9B9', '#FFFFFF', '#B8F483'],
            'bigender': ['#C479D9', '#EDA5CD', '#D8D8D8', '#A4E8D8', '#6ADEC9'],
            'pangender': ['#FDF48D', '#F3B79C', '#FAC3EF', '#FFFFFF'],
            'omnisexual': ['#FF9A4D', '#FF53BF', '#FFFFFF', '#625FFF', '#1F9BFF'],
            'polysexual': ['#F61CB9', '#07D569', '#1C92F5'],
            'intersex': ['#FFD800', '#7902AA'],
            'two-spirit': ['#D62828', '#F77F00', '#FCBF49', '#2A9D8F', '#277DA1', '#7B2CBF'],
            'sapphic': ['#FF8DC7', '#FFFFFF', '#D629A9', '#7B1FA2'],
            'questioning': ['#FF75A2', '#FFFFFF', '#9C59D1', '#000000', '#5BCEFA'],
            'polyamorous': ['#009FE3', '#E50051', '#340C46', '#FFFFFF', '#FCBF00'],
            'abrosexual': ['#46D294', '#A3E9C8', '#FFFFFF', '#F5A9B8', '#EE1766'],
            'graysexual': ['#740195', '#B2B2B2', '#FFFFFF'],
            'grayromantic': ['#087D16', '#B2B2B2', '#FFFFFF'],
            'demigender': ['#7F7F7F', '#C4C4C4', '#FFEE70', '#FFFFFF'],
            'demiboy': ['#7F7F7F', '#C4C4C4', '#9AD9EB', '#FFFFFF'],
            'demigirl': ['#7F7F7F', '#C4C4C4', '#FFAEC9', '#FFFFFF'],
            'genderflux': ['#F47694', '#F2A3B9', '#CECECE', '#7CE0F7', '#3ECDF9', '#FFF48E'],
            'genderfae': ['#97C3A5', '#C3DEAE', '#F9FACD', '#FFFFFF', '#FCA2C4', '#DB8AE4', '#A97EDD'],
            'genderfaun': ['#FCD689', '#FFF09B', '#FAF9CD', '#FFFFFF', '#8EDED9', '#8CACDE', '#9782EC'],
            'xenogender': ['#FF6691', '#FF9997', '#FFB782', '#FBFFA6', '#84BBFF', '#9C84FF', '#A317FF'],
            'lithromantic': ['#7CBE42', '#FDEE23', '#A2A2A2'],
            'fraysexual': ['#226CB5', '#93E7DD', '#FFFFFF', '#636363'],
            'cupiosexual': ['#A0A0A0', '#C8BFE6', '#FFFFFF', '#FFB3DA'],
            'cupioromantic': ['#FCA9A3', '#FDC5C0', '#FFFFFF', '#C8BFE6', '#A0A0A0'],
            'trigender': ['#FF76A4', '#FFB3CB', '#FFFFFF', '#3DA542', '#9AC7E8', '#6D82D1', '#9C59D1'],
            'multigender': ['#3F47CD', '#00A3E8', '#FA7F27'],
            'polygender': ['#000000', '#8FA6BF', '#E875A8', '#F4E64D', '#39A9E8'],
            'androgyne': ['#FE007F', '#9A00FF', '#00B8E7'],
            'neutrois': ['#FFFFFF', '#1F9B00', '#000000'],
            'maverique': ['#FFF344', '#FFFFFF', '#F49622'],
            'omnigender': ['#F4A6C1', '#C8C4E2', '#A94BA8', '#7194C4', '#9AD8E8'],
            'aporagender': ['#F5A6C8', '#9A8AE8', '#F4D44D', '#7F9FE8'],
            'gendervoid': ['#0B164F', '#4A4A4A', '#000000'],
            'greygender': ['#FFFFFF', '#ABABAB', '#3D3D3D', '#9B59B6', '#000000'],
            'quoiromantic': ['#000000', '#8BCF45', '#55C7D9', '#A4A4A4']
        };

        // Single colors
        if (preset.startsWith('#') || preset === 'black' || preset === 'white' || preset === 'grey' || preset === 'red' || preset === 'orange' || preset === 'yellow' || preset === 'green' || preset === 'blue' || preset === 'purple' || preset === 'pink') {
            const singleColors = {
                'black': '#000000',
                'white': '#FFFFFF',
                'grey': '#888888',
                'red': '#FF0000',
                'orange': '#FF8800',
                'yellow': '#FFFF00',
                'green': '#00FF00',
                'blue': '#0000FF',
                'purple': '#880088',
                'pink': '#FF00FF'
            };
            return singleColors[preset] || preset;
        }

        // Flag/rainbow presets - return a random color from the gradient
        const colors = flagColors[preset];
        if (colors && colors.length > 0) {
            return colors[Math.floor(Math.random() * colors.length)];
        }

        // Fallback
        return '#FFFFFF';
    }
}

class SparkleSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName('Sparkle count')
            .setDesc('Number of sparkles on screen')
            .addSlider(slider => slider
                .setLimits(1, 200, 1)
                .setValue(this.plugin.settings.sparkleCount)
                .onChange(async (value) => {
                    this.plugin.settings.sparkleCount = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Min size')
            .setDesc('Minimum sparkle size')
            .addSlider(slider => slider
                .setLimits(1, 20, 0.5)
                .setValue(this.plugin.settings.minSize)
                .onChange(async (value) => {
                    this.plugin.settings.minSize = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max size')
            .setDesc('Maximum sparkle size')
            .addSlider(slider => slider
                .setLimits(1, 20, 0.5)
                .setValue(this.plugin.settings.maxSize)
                .onChange(async (value) => {
                    this.plugin.settings.maxSize = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Min lifetime (ms)')
            .setDesc('Minimum sparkle lifetime in milliseconds')
            .addSlider(slider => slider
                .setLimits(500, 10000, 100)
                .setValue(this.plugin.settings.minLifetime)
                .onChange(async (value) => {
                    this.plugin.settings.minLifetime = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max lifetime (ms)')
            .setDesc('Maximum sparkle lifetime in milliseconds')
            .addSlider(slider => slider
                .setLimits(500, 10000, 100)
                .setValue(this.plugin.settings.maxLifetime)
                .onChange(async (value) => {
                    this.plugin.settings.maxLifetime = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Wiggle distance')
            .setDesc('How far sparkles can drift')
            .addSlider(slider => slider
                .setLimits(0, 20, 0.5)
                .setValue(this.plugin.settings.wiggleDistance)
                .onChange(async (value) => {
                    this.plugin.settings.wiggleDistance = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max rotation')
            .setDesc('Maximum rotation angle')
            .addSlider(slider => slider
                .setLimits(0, 45, 1)
                .setValue(this.plugin.settings.maxRotation)
                .onChange(async (value) => {
                    this.plugin.settings.maxRotation = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Fade in duration (ms)')
            .setDesc('Fade in duration in milliseconds')
            .addSlider(slider => slider
                .setLimits(100, 2000, 50)
                .setValue(this.plugin.settings.fadeInDuration)
                .onChange(async (value) => {
                    this.plugin.settings.fadeInDuration = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Fade out duration (ms)')
            .setDesc('Fade out duration in milliseconds')
            .addSlider(slider => slider
                .setLimits(100, 2000, 50)
                .setValue(this.plugin.settings.fadeOutDuration)
                .onChange(async (value) => {
                    this.plugin.settings.fadeOutDuration = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Color preset')
            .setDesc('Color scheme for sparkles')
            .addDropdown(dropdown => {
                // Single colors
                dropdown.addOption('black', 'Black');
                dropdown.addOption('white', 'White');
                dropdown.addOption('grey', 'Grey');
                dropdown.addOption('red', 'Red');
                dropdown.addOption('orange', 'Orange');
                dropdown.addOption('yellow', 'Yellow');
                dropdown.addOption('green', 'Green');
                dropdown.addOption('blue', 'Blue');
                dropdown.addOption('purple', 'Purple');
                dropdown.addOption('pink', 'Pink');

                // Pride flags
                dropdown.addOption('rainbow', 'Rainbow');
                dropdown.addOption('gay-men', 'Gay Men');
                dropdown.addOption('lesbian', 'Lesbian');
                dropdown.addOption('bisexual', 'Bisexual');
                dropdown.addOption('pansexual', 'Pansexual');
                dropdown.addOption('transgender', 'Transgender');
                dropdown.addOption('non-binary', 'Non-Binary');
                dropdown.addOption('asexual', 'Asexual');
                dropdown.addOption('aromantic', 'Aromantic');
                dropdown.addOption('aroace', 'Aroace');
                dropdown.addOption('demisexual', 'Demisexual');
                dropdown.addOption('genderfluid', 'Genderfluid');
                dropdown.addOption('genderqueer', 'Genderqueer');
                dropdown.addOption('agender', 'Agender');
                dropdown.addOption('bigender', 'Bigender');
                dropdown.addOption('pangender', 'Pangender');
                dropdown.addOption('omnisexual', 'Omnisexual');
                dropdown.addOption('polysexual', 'Polysexual');
                dropdown.addOption('intersex', 'Intersex');
                dropdown.addOption('two-spirit', 'Two-Spirit');
                dropdown.addOption('sapphic', 'Sapphic');
                dropdown.addOption('questioning', 'Questioning');
                dropdown.addOption('polyamorous', 'Polyamorous');
                dropdown.addOption('abrosexual', 'Abrosexual');
                dropdown.addOption('graysexual', 'Graysexual');
                dropdown.addOption('grayromantic', 'Grayromantic');
                dropdown.addOption('demigender', 'Demigender');
                dropdown.addOption('demiboy', 'Demiboy');
                dropdown.addOption('demigirl', 'Demigirl');
                dropdown.addOption('genderflux', 'Genderflux');
                dropdown.addOption('genderfae', 'Genderfae');
                dropdown.addOption('genderfaun', 'Genderfaun');
                dropdown.addOption('xenogender', 'Xenogender');
                dropdown.addOption('lithromantic', 'Lithromantic');
                dropdown.addOption('fraysexual', 'Fraysexual');
                dropdown.addOption('cupiosexual', 'Cupiosexual');
                dropdown.addOption('cupioromantic', 'Cupioromantic');
                dropdown.addOption('trigender', 'Trigender');
                dropdown.addOption('multigender', 'Multigender');
                dropdown.addOption('polygender', 'Polygender');
                dropdown.addOption('androgyne', 'Androgyne');
                dropdown.addOption('neutrois', 'Neutrois');
                dropdown.addOption('maverique', 'Maverique');
                dropdown.addOption('omnigender', 'Omnigender');
                dropdown.addOption('aporagender', 'Aporagender');
                dropdown.addOption('gendervoid', 'Gendervoid');
                dropdown.addOption('greygender', 'Greygender');
                dropdown.addOption('quoiromantic', 'Quoiromantic');
                
                dropdown.setValue(this.plugin.settings.colorPreset);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.colorPreset = value;
                    await this.plugin.saveSettings();
                });
            });
    }
}

module.exports = SparklePlugin;
