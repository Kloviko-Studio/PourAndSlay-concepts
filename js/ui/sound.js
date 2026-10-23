var PS = globalThis.PS || (globalThis.PS = {});
(function () {
  'use strict';
  // Soft Web Audio synth carried over from legacy/v1.html; settings.sound is the on/off switch.
  const Snd = {
    on: true, ctx: null, bus: null,
    init() {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    // lazy master bus: gain -> compressor so stacked sounds never clip
    out() {
      if (!this.bus) {
        const c = this.ctx, g = c.createGain(), k = c.createDynamicsCompressor();
        g.gain.value = .8;
        g.connect(k).connect(c.destination);
        this.bus = g;
      }
      return this.bus;
    },
    tone(f, d, type = 'sine', v = .1, f2 = null, delay = 0) {
      if (!this.on || !this.ctx) return;
      const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(this.out());
      o.start(t); o.stop(t + d + .02);
    },
    // lowpassed noise with a soft attack: muffled puff, not static
    noise(d, v = .15, cut = 800) {
      if (!this.on || !this.ctx) return;
      const b = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * d), this.ctx.sampleRate), data = b.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter(), t = this.ctx.currentTime;
      f.type = 'lowpass'; f.frequency.value = cut;
      s.buffer = b;
      g.gain.setValueAtTime(.0001, t);
      g.gain.linearRampToValueAtTime(v, t + .008);
      g.gain.exponentialRampToValueAtTime(.0001, t + d);
      s.connect(f).connect(g).connect(this.out()); s.start(t);
    },
    play(n, x = 0) {
      if (!this.on) return;
      this.init();
      if (!this.ctx) return;
      const arp = (base, steps, type = 'triangle', v = .07, gap = .06) => steps.forEach((s, i) => this.tone(base * 2 ** (s / 12), .2, type, v, null, i * gap));
      switch (n) {
        case 'select': this.tone(560, .06, 'triangle', .05); break;
        case 'bad': this.tone(190, .14, 'triangle', .04, 140); break;
        case 'pour': this.tone(280, .2, 'sine', .07, 560); this.tone(400, .14, 'sine', .04, 760, .08); break;
        case 'drop': this.tone(700, .06, 'sine', .04, 950); break;
        case 'close': arp(520 * 1.12 ** Math.min(x, 6), [0, 4, 7]); break;
        case 'combo': arp(660, [0, 4, 7, 12], 'triangle', .04, .05); break;
        case 'hit': this.tone(190, .13, 'sine', .14, 70); this.noise(.06, .03, 600); break;
        case 'hurt': this.tone(130, .24, 'sine', .16, 50); this.tone(260, .12, 'triangle', .04, 120); this.noise(.1, .04, 500); break;
        case 'shield': this.tone(420, .22, 'sine', .07, 840); break;
        case 'heal': arp(600, [0, 4, 7, 12], 'sine', .05, .05); break;
        case 'stone': this.tone(150, .12, 'sine', .15, 85); this.tone(300, .05, 'triangle', .04, 200); break;
        case 'freeze': this.tone(1400, .3, 'sine', .04, 700); break;
        case 'poison': this.tone(240, .25, 'sine', .05, 180); this.tone(320, .18, 'triangle', .03, 250, .06); break;
        case 'zap': this.tone(900, .08, 'square', .03, 300); this.noise(.05, .03, 2000); break;
        case 'win': arp(523, [0, 4, 7, 12, 16], 'triangle', .07, .08); break;
        case 'lose': arp(392, [0, -3, -7, -12], 'triangle', .05, .14); break;
        case 'coin': this.tone(1320, .08, 'triangle', .035, 1760); break;
        case 'gem': this.tone(1760, .1, 'sine', .04, 2350); this.tone(2350, .12, 'sine', .025, null, .05); break;
        case 'unlock': arp(440, [0, 7, 12, 16, 19], 'triangle', .06, .07); break;
        case 'buy': arp(700, [0, 7, 12], 'triangle', .05, .05); break;
        case 'swipe': this.tone(330, .1, 'sine', .03, 440); break;
      }
    },
  };
  PS.Snd = Snd;
})();
