// ==========================================
// ocr.js — OCR Kill Tracking System
// Tesseract.js + Screen Capture API
// ==========================================

class OCRKillTracker {
  constructor(options = {}) {
    this.options = {
      interval: 600,        // ms between OCR scans
      cooldown: 3500,       // ms before re-counting same team kill
      threshold: 0.6,       // fuzzy match threshold (0-1)
      ...options
    };

    this.worker = null;
    this.stream = null;
    this.videoEl = null;
    this.previewCanvas = null;
    this.cropCanvas = null;
    this.running = false;
    this.intervalId = null;

    // Kill zone (fraction of video size): { x, y, w, h }
    this.killZone = { x: 0.55, y: 0.0, w: 0.45, h: 0.25 };

    this.teams = [];          // [{ index, name }]
    this.players = [];        // [{ name, teamIndex, playerIndex }]
    this.lastKillTime = {};   // { teamIndex_playerIndex: timestamp }
    this.lastOCRText = '';
    this.killCooldownMs = this.options.cooldown;
    this.scanCount = 0;

    this.onKill = null;       // callback(teamIndex, teamName)
    this.onOCRResult = null;  // callback(text)
    this.onStatusChange = null; // callback(status: 'idle'|'running'|'error')
    this.onLog = null;        // callback(msg, type)

    this._scanBound = this._scan.bind(this);
  }

  // ===== PUBLIC API =====

  setTeams(teams) {
    this.teams = teams;
    this.players = [];
    teams.forEach(t => {
      const playersList = t.players || [];
      playersList.forEach((p, pIdx) => {
        if (p && p.trim()) {
          this.players.push({
            name: p.trim(),
            teamIndex: t.index,
            playerIndex: pIdx
          });
        }
      });
    });
  }

  setKillZone(zone) { this.killZone = zone; }

  async startCapture(previewCanvas) {
    this._log('กำลังเลือกหน้าจอ...', 'info');
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 10 } },
        audio: false
      });

      // Setup hidden video element
      this.videoEl = document.createElement('video');
      this.videoEl.srcObject = this.stream;
      this.videoEl.muted = true;
      this.videoEl.play();

      // Wait for video metadata
      await new Promise(res => { this.videoEl.onloadedmetadata = res; });

      this.previewCanvas = previewCanvas;
      this.cropCanvas = document.createElement('canvas');

      this._setStatus('running');
      this._log('จับหน้าจอสำเร็จ ✅', 'detected');
      return true;
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        this._log('ยกเลิกการเลือกหน้าจอ', 'info');
      } else {
        this._log('ไม่สามารถจับหน้าจอได้: ' + e.message, 'error');
      }
      this._setStatus('error');
      return false;
    }
  }

  async initWorker() {
    this._log('กำลังโหลด OCR Engine...', 'info');
    try {
      this.worker = await Tesseract.createWorker(['tha', 'eng'], 1, {
        logger: () => {}
      });
      await this.worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ._-[]{}()กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ็่้๊๋์ํ๎ะาำิีึืุูเแโใไ่้๊๋็์ํๆฯ'
      });
      this._log('OCR Engine พร้อม ✅', 'detected');
      return true;
    } catch (e) {
      this._log('โหลด OCR ไม่ได้: ' + e.message, 'error');
      return false;
    }
  }

  startScanning() {
    if (this.running || !this.worker || !this.stream) return;
    this.running = true;
    this.intervalId = setInterval(this._scanBound, this.options.interval);
    this._log('เริ่มสแกน Kill Feed อัตโนมัติ 🔍', 'detected');
    this._setStatus('running');
  }

  stopScanning() {
    this.running = false;
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    this._log('หยุดสแกนแล้ว', 'info');
    this._setStatus('idle');
  }

  async stop() {
    this.stopScanning();
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this._setStatus('idle');
  }

  // ===== INTERNAL =====

  async _scan() {
    if (!this.running || !this.videoEl || !this.previewCanvas) return;

    const vw = this.videoEl.videoWidth;
    const vh = this.videoEl.videoHeight;
    if (!vw || !vh) return;

    const ctx = this.previewCanvas.getContext('2d');
    this.previewCanvas.width = vw;
    this.previewCanvas.height = vh;

    // Draw full frame to preview
    ctx.drawImage(this.videoEl, 0, 0, vw, vh);

    // Draw kill zone highlight
    const zx = this.killZone.x * vw;
    const zy = this.killZone.y * vh;
    const zw = this.killZone.w * vw;
    const zh = this.killZone.h * vh;

    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(zx, zy, zw, zh);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(0,245,255,0.06)';
    ctx.fillRect(zx, zy, zw, zh);

    // Draw label
    ctx.fillStyle = '#00f5ff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('KILL FEED ZONE', zx + 6, zy + 18);

    // Crop kill zone for OCR
    this.cropCanvas.width = Math.max(1, zw);
    this.cropCanvas.height = Math.max(1, zh);
    const cropCtx = this.cropCanvas.getContext('2d');
    cropCtx.drawImage(this.videoEl, zx, zy, zw, zh, 0, 0, zw, zh);

    this.scanCount++;

    // Run OCR every 2 frames to reduce load
    if (this.scanCount % 2 !== 0) return;

    try {
      const { data: { text } } = await this.worker.recognize(this.cropCanvas);
      const cleaned = text.replace(/\s+/g, ' ').trim();

      if (this.onOCRResult) this.onOCRResult(cleaned);
      if (cleaned && cleaned !== this.lastOCRText) {
        this.lastOCRText = cleaned;
        this._parseKills(cleaned);
      }
    } catch (e) {
      // OCR error — silently skip
    }
  }

  _parseKills(text) {
    if (!this.players.length) return;

    const now = Date.now();
    const textLower = text.toLowerCase();

    for (const player of this.players) {
      const score = this._fuzzyScore(textLower, player.name.toLowerCase());
      if (score >= this.options.threshold) {
        const key = `${player.teamIndex}_${player.playerIndex}`;
        const lastTime = this.lastKillTime[key] || 0;
        if (now - lastTime > this.killCooldownMs) {
          this.lastKillTime[key] = now;
          const teamName = this.teams[player.teamIndex]?.name || `ทีม ${player.teamIndex + 1}`;
          this._log(`✅ OCR พบ Kill: ${player.name} (ทีม: ${teamName}) (match score: ${(score * 100).toFixed(0)}%)`, 'kill');
          if (this.onKill) this.onKill(player.teamIndex, player.playerIndex, player.name);
        }
      }
    }
  }

  // Fuzzy match: checks substring and character overlap
  _fuzzyScore(text, query) {
    if (!query || query.length < 2) return 0;

    // Exact substring
    if (text.includes(query)) return 1.0;

    // Check for partial match (sliding window)
    const qLen = query.length;
    let bestScore = 0;

    for (let i = 0; i <= text.length - Math.floor(qLen * 0.5); i++) {
      const window = text.substring(i, i + qLen + 2);
      let matches = 0;
      for (let c of query) {
        if (window.includes(c)) matches++;
      }
      const score = matches / qLen;
      if (score > bestScore) bestScore = score;
    }

    return bestScore;
  }

  _setStatus(status) {
    if (this.onStatusChange) this.onStatusChange(status);
  }

  _log(msg, type = 'info') {
    if (this.onLog) this.onLog(msg, type);
  }

  // ===== KILL ZONE DRAG SELECTOR =====
  // Call this to enable drag-select on the preview canvas
  enableZoneSelector(canvasEl) {
    let dragging = false;
    let startX, startY;

    canvasEl.style.cursor = 'crosshair';

    const getRelPos = (e) => {
      const rect = canvasEl.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height
      };
    };

    canvasEl.addEventListener('mousedown', (e) => {
      dragging = true;
      const pos = getRelPos(e);
      startX = pos.x; startY = pos.y;
      e.preventDefault();
    });

    canvasEl.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const pos = getRelPos(e);
      const x = Math.min(startX, pos.x);
      const y = Math.min(startY, pos.y);
      const w = Math.abs(pos.x - startX);
      const h = Math.abs(pos.y - startY);
      this.killZone = { x, y, w: Math.max(w, 0.01), h: Math.max(h, 0.01) };
    });

    canvasEl.addEventListener('mouseup', (e) => {
      dragging = false;
      this._log(`กำหนด Zone ใหม่: ${JSON.stringify({
        x: this.killZone.x.toFixed(2), y: this.killZone.y.toFixed(2),
        w: this.killZone.w.toFixed(2), h: this.killZone.h.toFixed(2)
      })}`, 'detected');
    });
  }
}
