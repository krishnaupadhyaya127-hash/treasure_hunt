// Web Audio API Sound Synthesizer for CyberHunt
// Zero external audio files required - 100% reliable offline/online

class SoundFX {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playClick() {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playSuccess() {
        if (!this.enabled) return;
        this.init();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.08);
            gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.08);
            gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + idx * 0.08 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.08 + 0.25);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + idx * 0.08);
            osc.stop(this.ctx.currentTime + idx * 0.08 + 0.25);
        });
    }

    playError() {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, this.ctx.currentTime);
        osc.frequency.setValueAtTime(110, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playAlarm() {
        if (!this.enabled) return;
        this.init();
        for (let i = 0; i < 2; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            const startTime = this.ctx.currentTime + (i * 0.15);
            osc.frequency.setValueAtTime(950, startTime);
            osc.frequency.setValueAtTime(600, startTime + 0.07);
            gain.gain.setValueAtTime(0.2, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.13);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.14);
        }
    }

    playMorse() {
        if (!this.enabled) return;
        this.init();
        // SOS CAFE: ... --- ... / -.-. .- ..-. .
        const pattern = [
            // S
            { d: 0.06, p: true }, { d: 0.06, p: false },
            { d: 0.06, p: true }, { d: 0.06, p: false },
            { d: 0.06, p: true }, { d: 0.15, p: false },
            // O
            { d: 0.18, p: true }, { d: 0.06, p: false },
            { d: 0.18, p: true }, { d: 0.06, p: false },
            { d: 0.18, p: true }, { d: 0.15, p: false },
            // S
            { d: 0.06, p: true }, { d: 0.06, p: false },
            { d: 0.06, p: true }, { d: 0.06, p: false },
            { d: 0.06, p: true }, { d: 0.30, p: false },
            // C
            { d: 0.18, p: true }, { d: 0.06, p: false },
            { d: 0.06, p: true }, { d: 0.06, p: false },
            { d: 0.18, p: true }, { d: 0.06, p: false },
            { d: 0.06, p: true }, { d: 0.15, p: false },
            // A
            { d: 0.06, p: true }, { d: 0.06, p: false },
            { d: 0.18, p: true }, { d: 0.15, p: false },
            // F
            { d: 0.06, p: true }, { d: 0.06, p: false },
            { d: 0.06, p: true }, { d: 0.06, p: false },
            { d: 0.18, p: true }, { d: 0.06, p: false },
            { d: 0.06, p: true }, { d: 0.15, p: false },
            // E
            { d: 0.06, p: true }
        ];

        let cursor = this.ctx.currentTime + 0.05;
        pattern.forEach(item => {
            if (item.p) {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(750, cursor);
                gain.gain.setValueAtTime(0.18, cursor);
                gain.gain.setValueAtTime(0.18, cursor + item.d - 0.01);
                gain.gain.linearRampToValueAtTime(0.001, cursor + item.d);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(cursor);
                osc.stop(cursor + item.d);
            }
            cursor += item.d;
        });
    }
}

window.sound = new SoundFX();
