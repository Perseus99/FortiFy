import * as Phaser from 'phaser'

// ── Constants ────────────────────────────────────────────────
const COLS = 20
const ROWS = 12
const CELL = 48
const UI_H = 64
const GAME_W = COLS * CELL   // 960
const GAME_H = ROWS * CELL + UI_H  // 640

const WAYPOINTS = [
  { col: 0,  row: 5 },
  { col: 5,  row: 5 },
  { col: 5,  row: 2 },
  { col: 12, row: 2 },
  { col: 12, row: 8 },
  { col: 17, row: 8 },
  { col: 17, row: 5 },
  { col: 20, row: 5 },
]

function buildPathCells() {
  const set = new Set<string>()
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    const a = WAYPOINTS[i], b = WAYPOINTS[i + 1]
    if (a.col === b.col) {
      for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++)
        set.add(`${a.col},${r}`)
    } else {
      for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++)
        set.add(`${c},${a.row}`)
    }
  }
  return set
}

const PATH_CELLS = buildPathCells()
const cx = (col: number) => col * CELL + CELL / 2
const cy = (row: number) => UI_H + row * CELL + CELL / 2

// ── Tower definitions ────────────────────────────────────────
type TowerType = 'archer' | 'cannon'
const TOWERS = {
  archer: { name: 'Archer', cost: 50,  damage: 20, range: 2.5, fireRate: 900,  color: 0x22c55e },
  cannon: { name: 'Cannon', cost: 120, damage: 60, range: 2.0, fireRate: 2400, color: 0x3b82f6 },
}

// ── Enemy definitions ────────────────────────────────────────
type EnemyType = 'foodie' | 'impulse' | 'subscription' | 'nightowl' | 'debt'

const ENEMY_DEFS: Record<EnemyType, { emoji: string; label: string; hpMult: number; speedMult: number; cityDmg: number; scale: number; hpColor: number }> = {
  foodie:       { emoji: '🍔', label: 'Foodie',             hpMult: 0.8, speedMult: 1.0, cityDmg: 15, scale: 1.0,  hpColor: 0x22c55e },
  impulse:      { emoji: '🛍️', label: 'Impulse Buyer',      hpMult: 0.6, speedMult: 1.5, cityDmg: 10, scale: 0.85, hpColor: 0xf59e0b },
  subscription: { emoji: '📱', label: 'Subscription Creep', hpMult: 1.8, speedMult: 0.6, cityDmg: 25, scale: 1.15, hpColor: 0xa855f7 },
  nightowl:     { emoji: '🎬', label: 'Night Owl',           hpMult: 1.0, speedMult: 1.2, cityDmg: 15, scale: 1.0,  hpColor: 0x38bdf8 },
  debt:         { emoji: '💳', label: 'Debt Collector',      hpMult: 2.5, speedMult: 0.8, cityDmg: 35, scale: 1.35, hpColor: 0xef4444 },
}

function buildSpawnQueue(enemyCount: number): EnemyType[] {
  let pool: EnemyType[]
  if (enemyCount <= 8) {
    pool = [...Array(5).fill('foodie'), ...Array(3).fill('subscription')] as EnemyType[]
  } else if (enemyCount <= 14) {
    pool = [...Array(6).fill('foodie'), ...Array(4).fill('impulse'), ...Array(2).fill('subscription'), ...Array(2).fill('nightowl')] as EnemyType[]
  } else {
    pool = [...Array(5).fill('foodie'), ...Array(4).fill('impulse'), ...Array(4).fill('subscription'), ...Array(4).fill('nightowl'), ...Array(3).fill('debt')] as EnemyType[]
  }
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

// ── Types ────────────────────────────────────────────────────
export interface GameInitData {
  points: number
  cityHealth: number
  waveConfig: {
    enemy_count: number
    enemy_speed: number
    enemy_hp: number
    spawn_rate: number
  }
}

interface EnemyObj {
  container: Phaser.GameObjects.Container
  hpFill: Phaser.GameObjects.Graphics
  hp: number
  maxHp: number
  wpIdx: number
  alive: boolean
  cityDmg: number
  speedMult: number
}

interface TowerObj {
  col: number
  row: number
  type: TowerType
  container: Phaser.GameObjects.Container
  rangeCircle: Phaser.GameObjects.Graphics
  lastFired: number
  barrel?: Phaser.GameObjects.Graphics
}

// ── Scene ────────────────────────────────────────────────────
export class GameScene extends Phaser.Scene {
  private points = 200
  private cityHealth = 100
  private waveConfig = { enemy_count: 14, enemy_speed: 1.2, enemy_hp: 100, spawn_rate: 1.8 }

  private towers: TowerObj[] = []
  private enemies: EnemyObj[] = []
  private selected: TowerType = 'archer'
  private spawned = 0
  private resolved = 0
  private over = false
  private spawnQueue: EnemyType[] = []
  private spawnIdx = 0

  private ptText!: Phaser.GameObjects.Text
  private hpText!: Phaser.GameObjects.Text
  private wvText!: Phaser.GameObjects.Text
  private msgText!: Phaser.GameObjects.Text
  private selHighlight!: Phaser.GameObjects.Graphics
  private archerBtn!: Phaser.GameObjects.Container
  private cannonBtn!: Phaser.GameObjects.Container
  private hoverCell!: Phaser.GameObjects.Graphics
  private cityHpBar!: Phaser.GameObjects.Graphics

  constructor() { super({ key: 'GameScene' }) }

  init(data: GameInitData) {
    if (data) {
      this.points     = data.points     ?? 200
      this.cityHealth = data.cityHealth ?? 100
      if (data.waveConfig) this.waveConfig = data.waveConfig
    }
    this.towers = []; this.enemies = []
    this.spawned = 0; this.resolved = 0; this.over = false
  }

  create() {
    this.drawBackground()
    this.drawGrid()
    this.drawPath()
    this.drawLandmarks()
    this.createUI()
    this.createSelector()
    this.setupInput()
    this.startWave()
  }

  // ── Map drawing ────────────────────────────────────────────

  private drawBackground() {
    const bg = this.add.graphics()
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (!PATH_CELLS.has(`${c},${r}`)) {
          bg.fillStyle((c + r) % 2 === 0 ? 0x1a2e1a : 0x1c311c, 1)
          bg.fillRect(c * CELL, UI_H + r * CELL, CELL, CELL)
        }
      }
    }
  }

  private drawGrid() {
    const g = this.add.graphics()
    g.lineStyle(1, 0x2a4a2a, 0.35)
    for (let c = 0; c <= COLS; c++) { g.moveTo(c * CELL, UI_H); g.lineTo(c * CELL, UI_H + ROWS * CELL) }
    for (let r = 0; r <= ROWS; r++) { g.moveTo(0, UI_H + r * CELL); g.lineTo(GAME_W, UI_H + r * CELL) }
    g.strokePath()
    this.hoverCell = this.add.graphics()
  }

  private drawPath() {
    const g = this.add.graphics()
    PATH_CELLS.forEach(key => {
      const [col, row] = key.split(',').map(Number)
      const x = col * CELL, y = UI_H + row * CELL
      // Base dirt
      g.fillStyle(0x8b6914, 1).fillRect(x, y, CELL, CELL)
      // Center lighter strip
      g.fillStyle(0xa07820, 0.5).fillRect(x + 5, y + 5, CELL - 10, CELL - 10)
      // Edge shadows
      g.fillStyle(0x5a4410, 0.6)
      g.fillRect(x, y, CELL, 2)
      g.fillRect(x, y + CELL - 2, CELL, 2)
    })
    // Mid-segment dots
    g.fillStyle(0xd4a017, 0.45)
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      const a = WAYPOINTS[i], b = WAYPOINTS[i + 1]
      g.fillCircle(cx((a.col + b.col) / 2), cy((a.row + b.row) / 2), 3)
    }
  }

  private drawLandmarks() {
    // Entry portal
    this.add.text(cx(0), cy(5), '⚡', { fontSize: '28px' }).setOrigin(0.5).setDepth(2)
    // Castle at exit
    this.add.text(GAME_W - 18, cy(5), '🏰', { fontSize: '34px' }).setOrigin(0.5).setDepth(2)
    // Decorative trees
    const trees: [number, number][] = [
      [2,1],[8,1],[14,1],[18,1],
      [2,10],[7,10],[14,10],[18,10],
      [1,4],[3,7],[8,6],[15,4],[10,4],[10,10],
    ]
    for (const [c, r] of trees) {
      if (!PATH_CELLS.has(`${c},${r}`)) {
        this.add.text(cx(c), cy(r), '🌲', { fontSize: '20px' }).setOrigin(0.5).setAlpha(0.75).setDepth(1)
      }
    }
  }

  // ── UI ─────────────────────────────────────────────────────

  private createUI() {
    const bar = this.add.graphics()
    bar.fillStyle(0x080e1a, 1).fillRect(0, 0, GAME_W, UI_H)
    bar.lineStyle(2, 0xf59e0b, 0.5).strokeRect(0, 0, GAME_W, UI_H)

    this.add.text(14, 8, '⚔️  FORTIFYFI', { fontSize: '13px', color: '#f59e0b', fontStyle: 'bold' })

    this.add.text(14, 32, '💰', { fontSize: '13px' })
    this.ptText = this.add.text(32, 33, `${this.points} pts`, { fontSize: '12px', color: '#fbbf24' })

    this.add.text(155, 32, '🏰', { fontSize: '13px' })
    this.hpText = this.add.text(173, 33, `${this.cityHealth} HP`, { fontSize: '12px', color: '#f87171' })
    this.cityHpBar = this.add.graphics()
    this.drawCityHpBar()

    this.add.text(360, 32, '👾', { fontSize: '13px' })
    this.wvText = this.add.text(378, 33, `0/${this.waveConfig.enemy_count}`, { fontSize: '12px', color: '#94a3b8' })

    this.msgText = this.add.text(GAME_W / 2, UI_H + (ROWS * CELL) / 2, '', {
      fontSize: '42px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(20)
  }

  private drawCityHpBar() {
    this.cityHpBar.clear()
    const x = 230, y = 36, w = 110, h = 10
    const pct = Math.max(0, this.cityHealth / 100)
    const color = pct > 0.5 ? 0x22c55e : pct > 0.25 ? 0xf59e0b : 0xef4444
    this.cityHpBar.fillStyle(0x1f2937, 1).fillRoundedRect(x, y, w, h, 4)
    if (pct > 0) this.cityHpBar.fillStyle(color, 1).fillRoundedRect(x, y, Math.round(w * pct), h, 4)
    this.cityHpBar.lineStyle(1, 0x374151, 1).strokeRoundedRect(x, y, w, h, 4)
  }

  private createSelector() {
    this.selHighlight = this.add.graphics()

    // Archer button
    const aBg = this.add.graphics()
    aBg.fillStyle(0x14532d, 1).fillRoundedRect(0, 0, 128, 26, 5)
    aBg.lineStyle(1, 0x22c55e, 0.5).strokeRoundedRect(0, 0, 128, 26, 5)
    const aIcon  = this.add.text(6, 4, '🏹', { fontSize: '14px' })
    const aLabel = this.add.text(26, 6, 'Archer  50pts', { fontSize: '11px', color: '#86efac' })
    this.archerBtn = this.add.container(GAME_W - 290, 19, [aBg, aIcon, aLabel])
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, 128, 26), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => this.selectTower('archer'))
      .on('pointerover', () => this.input.setDefaultCursor('pointer'))
      .on('pointerout',  () => this.input.setDefaultCursor('default'))

    // Cannon button
    const cBg = this.add.graphics()
    cBg.fillStyle(0x1e3a5f, 1).fillRoundedRect(0, 0, 138, 26, 5)
    cBg.lineStyle(1, 0x3b82f6, 0.5).strokeRoundedRect(0, 0, 138, 26, 5)
    const cIcon  = this.add.text(6, 4, '💣', { fontSize: '14px' })
    const cLabel = this.add.text(26, 6, 'Cannon  120pts', { fontSize: '11px', color: '#93c5fd' })
    this.cannonBtn = this.add.container(GAME_W - 148, 19, [cBg, cIcon, cLabel])
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, 138, 26), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => this.selectTower('cannon'))
      .on('pointerover', () => this.input.setDefaultCursor('pointer'))
      .on('pointerout',  () => this.input.setDefaultCursor('default'))

    this.refreshHighlight()
  }

  private selectTower(t: TowerType) { this.selected = t; this.refreshHighlight() }

  private refreshHighlight() {
    this.selHighlight.clear()
    this.selHighlight.lineStyle(2, 0xf59e0b, 1)
    const btn = this.selected === 'archer' ? this.archerBtn : this.cannonBtn
    const w   = this.selected === 'archer' ? 128 : 138
    this.selHighlight.strokeRoundedRect(btn.x - 3, btn.y - 3, w + 6, 32, 6)
  }

  // ── Input ──────────────────────────────────────────────────

  private setupInput() {
    this.game.canvas.addEventListener('contextmenu', e => e.preventDefault())
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.hoverCell.clear()
      if (p.y < UI_H) return
      const col = Math.floor(p.x / CELL)
      const row = Math.floor((p.y - UI_H) / CELL)
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return
      if (PATH_CELLS.has(`${col},${row}`)) return
      if (this.towers.find(t => t.col === col && t.row === row)) return
      const canAfford = this.points >= TOWERS[this.selected].cost
      this.hoverCell.fillStyle(canAfford ? 0xf59e0b : 0xef4444, 0.28)
      this.hoverCell.fillRoundedRect(col * CELL + 2, UI_H + row * CELL + 2, CELL - 4, CELL - 4, 5)
    })

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.over || p.y < UI_H) return
      const col = Math.floor(p.x / CELL)
      const row = Math.floor((p.y - UI_H) / CELL)
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return
      if (PATH_CELLS.has(`${col},${row}`)) return
      if (this.towers.find(t => t.col === col && t.row === row)) return
      if (this.points < TOWERS[this.selected].cost) { this.flash('Not enough points!', '#ef4444'); return }
      this.placeTower(col, row, this.selected)
    })
  }

  // ── Tower placement ─────────────────────────────────────────

  private placeTower(col: number, row: number, type: TowerType) {
    const def = TOWERS[type]
    this.points -= def.cost
    this.updateHUD()

    const x = cx(col), y = cy(row)
    const g = this.add.graphics()
    let barrel: Phaser.GameObjects.Graphics | undefined

    if (type === 'archer') {
      // Base
      g.fillStyle(0x475569, 1).fillRect(-20, -6, 40, 22)
      // Tower body
      g.fillStyle(0x334155, 1).fillRect(-14, -24, 28, 22)
      // Crenellations
      g.fillStyle(0x475569, 1)
      g.fillRect(-14, -32, 8, 10)
      g.fillRect(-3,  -32, 8, 10)
      g.fillRect(7,   -32, 7, 10)
      // Arrow slit
      g.fillStyle(0x0f172a, 1).fillRect(-2, -20, 4, 10)
      // Color accent stripe
      g.fillStyle(0x22c55e, 0.9).fillRect(-14, -24, 28, 3)
      // Embrasure shadow
      g.fillStyle(0x000000, 0.2).fillRect(-14, -12, 28, 4)
    } else {
      // Platform
      g.fillStyle(0x374151, 1).fillCircle(0, 8, 18)
      g.fillStyle(0x4b5563, 1).fillCircle(0, 5, 14)
      // Body
      g.fillStyle(0x1f2937, 1).fillRect(-10, -4, 20, 16)
      // Blue accent
      g.fillStyle(0x3b82f6, 0.8).fillCircle(0, 4, 5)
      // Rotating barrel
      barrel = this.add.graphics()
      barrel.fillStyle(0x111827, 1).fillRect(2, -4, 22, 8)
      barrel.fillStyle(0x374151, 1).fillCircle(0, 0, 8)
      barrel.fillStyle(0x6b7280, 0.6).fillRect(20, -2, 4, 4)
    }

    const rc = this.add.graphics()
    rc.lineStyle(1, def.color, 0.18).strokeCircle(0, 0, def.range * CELL)
    rc.setVisible(false)

    const children: Phaser.GameObjects.GameObject[] = [rc, g]
    if (barrel) children.push(barrel)

    const container = this.add.container(x, y, children).setDepth(2)
      .setInteractive(new Phaser.Geom.Circle(0, 0, CELL / 2), Phaser.Geom.Circle.Contains)
      .on('pointerover', () => { rc.setVisible(true); this.input.setDefaultCursor('pointer') })
      .on('pointerout',  () => { rc.setVisible(false); this.input.setDefaultCursor('default') })

    // Pop-in animation
    container.setScale(0.1)
    this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.easeOut' })

    const towerObj: TowerObj = { col, row, type, container, rangeCircle: rc, lastFired: 0, barrel }
    this.towers.push(towerObj)

    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) this.sellTower(towerObj)
    })
  }

  // ── Wave spawning ───────────────────────────────────────────

  private startWave() {
    this.showCountdown(3)
  }

  private showCountdown(n: number) {
    if (n <= 0) {
      const go = this.add.text(GAME_W / 2, UI_H + (ROWS * CELL) / 2, '⚔️  DEFEND!', {
        fontSize: '52px', color: '#22c55e', fontStyle: 'bold', stroke: '#000000', strokeThickness: 7,
      }).setOrigin(0.5).setDepth(25)
      this.tweens.add({
        targets: go, alpha: 0, scaleX: 1.6, scaleY: 1.6,
        duration: 900, delay: 400, ease: 'Power2',
        onComplete: () => go.destroy(),
      })
      this.spawnQueue = buildSpawnQueue(this.waveConfig.enemy_count)
      this.spawnIdx = 0
      const delay = (1 / this.waveConfig.spawn_rate) * 1000
      this.time.addEvent({ delay, repeat: this.waveConfig.enemy_count - 1, callback: this.spawnEnemy, callbackScope: this })
      return
    }
    const txt = this.add.text(GAME_W / 2, UI_H + (ROWS * CELL) / 2, String(n), {
      fontSize: '100px', color: '#f59e0b', fontStyle: 'bold', stroke: '#000000', strokeThickness: 10,
    }).setOrigin(0.5).setDepth(25).setScale(0.3).setAlpha(0)
    this.tweens.add({
      targets: txt, alpha: 1, scaleX: 1, scaleY: 1, duration: 250, ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({
        targets: txt, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 500, delay: 280, ease: 'Power2',
        onComplete: () => { txt.destroy(); this.showCountdown(n - 1) },
      }),
    })
  }

  private spawnEnemy() {
    if (this.over) return
    this.spawned++
    this.updateHUD()

    const def = ENEMY_DEFS[this.spawnQueue[this.spawnIdx++ % this.spawnQueue.length] ?? 'foodie']
    const hp = Math.round(this.waveConfig.enemy_hp * def.hpMult)

    const body = this.add.text(0, 2, def.emoji, { fontSize: '26px' }).setOrigin(0.5)
    this.tweens.add({ targets: body, y: -3, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

    const hpBg = this.add.graphics()
    hpBg.fillStyle(0x1f2937, 1).fillRoundedRect(-18, -30, 36, 7, 3)
    hpBg.lineStyle(1, 0x374151, 1).strokeRoundedRect(-18, -30, 36, 7, 3)

    const hpFill = this.add.graphics()
    hpFill.fillStyle(def.hpColor, 1).fillRoundedRect(-18, -30, 36, 7, 3)

    const container = this.add.container(cx(WAYPOINTS[0].col), cy(WAYPOINTS[0].row), [body, hpBg, hpFill])
      .setDepth(4).setScale(0)
    this.tweens.add({ targets: container, scaleX: def.scale, scaleY: def.scale, duration: 220, ease: 'Back.easeOut' })

    // Name label pop
    const label = this.add.text(cx(WAYPOINTS[0].col), cy(WAYPOINTS[0].row) - 36, def.label, {
      fontSize: '10px', color: '#ffffff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(5).setAlpha(0)
    this.tweens.add({ targets: label, alpha: 1, y: cy(WAYPOINTS[0].row) - 44, duration: 300,
      onComplete: () => this.tweens.add({ targets: label, alpha: 0, duration: 600, delay: 500, onComplete: () => label.destroy() }) })

    const enemy: EnemyObj = {
      container, hpFill, hp, maxHp: hp,
      wpIdx: 1, alive: true,
      cityDmg: def.cityDmg, speedMult: def.speedMult,
    }
    this.enemies.push(enemy)
    this.moveEnemy(enemy)
  }

  private moveEnemy(enemy: EnemyObj) {
    if (!enemy.alive) return
    if (enemy.wpIdx >= WAYPOINTS.length) { this.enemyExit(enemy); return }
    const wp = WAYPOINTS[enemy.wpIdx]
    const tx = cx(wp.col), ty = cy(wp.row)
    const dist = Phaser.Math.Distance.Between(enemy.container.x, enemy.container.y, tx, ty)
    const duration = (dist / (CELL * this.waveConfig.enemy_speed * enemy.speedMult)) * 1000
    this.tweens.add({
      targets: enemy.container, x: tx, y: ty, duration, ease: 'Linear',
      onComplete: () => { if (!enemy.alive) return; enemy.wpIdx++; this.moveEnemy(enemy) },
    })
  }

  private enemyExit(enemy: EnemyObj) {
    if (!enemy.alive) return
    enemy.alive = false
    this.cameras.main.shake(180, 0.012)
    enemy.container.destroy()
    this.cityHealth = Math.max(0, this.cityHealth - enemy.cityDmg)
    this.resolved++
    this.updateHUD()
    if (this.cityHealth <= 0) { this.endGame(false); return }
    this.checkWaveDone()
  }

  private damageEnemy(enemy: EnemyObj, dmg: number) {
    if (!enemy.alive) return
    enemy.hp = Math.max(0, enemy.hp - dmg)

    const pct = enemy.hp / enemy.maxHp
    enemy.hpFill.clear()
    const color = pct > 0.5 ? 0x22c55e : pct > 0.25 ? 0xf59e0b : 0xef4444
    enemy.hpFill.fillStyle(color, 1).fillRoundedRect(-18, -30, Math.round(36 * pct), 7, 3)

    // Hit flash
    enemy.container.setAlpha(0.55)
    this.time.delayedCall(90, () => { if (enemy.alive) enemy.container.setAlpha(1) })

    // Danger scaling — enemy grows when low HP
    if (pct <= 0.25 && enemy.alive) {
      this.tweens.add({ targets: enemy.container, scaleX: 1.25, scaleY: 1.25, duration: 150, ease: 'Power2' })
    }

    if (enemy.hp <= 0) {
      enemy.alive = false
      this.tweens.killTweensOf(enemy.container)
      this.spawnDeathParticles(enemy.container.x, enemy.container.y)
      this.tweens.add({
        targets: enemy.container, alpha: 0, scaleX: 1.9, scaleY: 1.9, duration: 240, ease: 'Power2',
        onComplete: () => enemy.container.destroy(),
      })
      this.points += 10
      this.resolved++
      this.updateHUD()
      this.checkWaveDone()
    }
  }

  private spawnDeathParticles(x: number, y: number) {
    const colors = [0xfbbf24, 0xf59e0b, 0x22c55e, 0xffffff, 0xfcd34d]
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4
      const dist  = Phaser.Math.Between(15, 48)
      const p = this.add.circle(x, y, Phaser.Math.Between(2, 5), colors[i % colors.length]).setDepth(10)
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: Phaser.Math.Between(280, 580), ease: 'Power2',
        onComplete: () => p.destroy(),
      })
    }
    const coin = this.add.text(x, y - 8, '+💰', { fontSize: '15px' }).setOrigin(0.5).setDepth(11)
    this.tweens.add({ targets: coin, y: y - 42, alpha: 0, duration: 750, ease: 'Power2', onComplete: () => coin.destroy() })
  }

  private checkWaveDone() {
    if (this.over) return
    if (this.resolved >= this.waveConfig.enemy_count) this.endGame(this.cityHealth > 0)
  }

  // ── Update ─────────────────────────────────────────────────

  update(time: number) {
    if (this.over) return

    for (const tower of this.towers) {
      // Cannon barrel tracks nearest enemy
      if (tower.type === 'cannon' && tower.barrel) {
        const tx = cx(tower.col), ty = cy(tower.row)
        let nearest: EnemyObj | null = null, nearestDist = Infinity
        for (const e of this.enemies) {
          if (!e.alive) continue
          const d = Phaser.Math.Distance.Between(tx, ty, e.container.x, e.container.y)
          if (d < nearestDist) { nearest = e; nearestDist = d }
        }
        if (nearest) tower.barrel.setRotation(Phaser.Math.Angle.Between(tx, ty, nearest.container.x, nearest.container.y))
      }

      const def = TOWERS[tower.type]
      if (time - tower.lastFired < def.fireRate) continue

      const tx = cx(tower.col), ty = cy(tower.row)
      const rangePx = def.range * CELL
      let target: EnemyObj | null = null, bestProgress = -Infinity

      for (const e of this.enemies) {
        if (!e.alive) continue
        const d = Phaser.Math.Distance.Between(tx, ty, e.container.x, e.container.y)
        if (d > rangePx) continue
        // Prioritise enemy furthest along path (highest wpIdx), tiebreak by distance to next waypoint
        const nextWp = WAYPOINTS[Math.min(e.wpIdx, WAYPOINTS.length - 1)]
        const distToNext = Phaser.Math.Distance.Between(e.container.x, e.container.y, cx(nextWp.col), cy(nextWp.row))
        const progress = e.wpIdx * 10000 - distToNext
        if (progress > bestProgress) { target = e; bestProgress = progress }
      }

      if (target) {
        tower.lastFired = time
        this.tweens.add({ targets: tower.container, scaleX: 1.12, scaleY: 1.12, duration: 80, yoyo: true, ease: 'Power2' })
        this.shoot(tower, target)
      }
    }
  }

  private sellTower(tower: TowerObj) {
    const idx = this.towers.indexOf(tower)
    if (idx === -1) return
    const refund = Math.floor(TOWERS[tower.type].cost / 2)
    this.towers.splice(idx, 1)
    tower.container.destroy()
    this.points += refund
    this.updateHUD()
    this.flash(`Sold! +${refund}pts`, '#fbbf24')
  }

  private shoot(tower: TowerObj, enemy: EnemyObj) {
    const def = TOWERS[tower.type]
    const startX = cx(tower.col), startY = cy(tower.row)

    const proj = this.add.graphics().setDepth(5)
    if (tower.type === 'archer') {
      proj.fillStyle(0xfbbf24, 1).fillTriangle(0, -5, 4, 5, -4, 5)
    } else {
      proj.fillStyle(0x1f2937, 1).fillCircle(0, 0, 7)
      proj.fillStyle(0x4b5563, 1).fillCircle(-2, -2, 3)
    }
    proj.x = startX; proj.y = startY

    this.tweens.add({
      targets: proj, x: enemy.container.x, y: enemy.container.y,
      duration: 150, ease: 'Linear',
      onComplete: () => {
        proj.destroy()
        if (!enemy.alive) return

        // Muzzle flash
        const flash = this.add.circle(startX, startY, 14, 0xffffff, 0.65).setDepth(5)
        this.tweens.add({ targets: flash, alpha: 0, scale: 0.2, duration: 180, onComplete: () => flash.destroy() })

        this.damageEnemy(enemy, def.damage)

        if (tower.type === 'cannon') {
          // Expanding ring
          const ring = this.add.graphics().setDepth(5)
          ring.lineStyle(3, 0x3b82f6, 0.85)
          ring.strokeCircle(enemy.container.x, enemy.container.y, 10)
          this.tweens.add({ targets: ring, scaleX: 3.8, scaleY: 3.8, alpha: 0, duration: 360, onComplete: () => ring.destroy() })

          for (const e of this.enemies) {
            if (!e.alive || e === enemy) continue
            if (Phaser.Math.Distance.Between(e.container.x, e.container.y, enemy.container.x, enemy.container.y) < 32)
              this.damageEnemy(e, Math.floor(def.damage * 0.5))
          }
        }
      },
    })
  }

  // ── Game over ───────────────────────────────────────────────

  private endGame(won: boolean) {
    if (this.over) return
    this.over = true
    this.msgText.setText(won ? '🏰 FORTRESS HELD!' : '💀 FORTRESS FELL!').setColor(won ? '#22c55e' : '#ef4444')
    this.cameras.main.flash(600, won ? 0 : 80, won ? 80 : 0, 0, false)
    window.dispatchEvent(new CustomEvent('fortifyfi:gameover', {
      detail: { won, points: this.points, cityHealth: this.cityHealth },
    }))
  }

  // ── Helpers ─────────────────────────────────────────────────

  private updateHUD() {
    this.ptText.setText(`${this.points} pts`)
    this.hpText.setText(`${this.cityHealth} HP`)
    this.wvText.setText(`${this.spawned}/${this.waveConfig.enemy_count}`)
    this.drawCityHpBar()
  }

  private flash(msg: string, color: string) {
    const t = this.add.text(GAME_W / 2, UI_H + 60, msg, {
      fontSize: '16px', color, fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15)
    this.tweens.add({ targets: t, alpha: 0, y: UI_H + 38, duration: 1400, onComplete: () => t.destroy() })
  }
}
