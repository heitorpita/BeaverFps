import { scene } from './core/scene.js'
import { renderer } from './core/renderer.js'
import { camera } from './core/camera.js'
import { startLoop, stopLoop } from './core/loop.js'
import { createStats } from './core/debug.js'
import { player, updatePlayer, initPlayer, positionPlayerAfterWorldLoad, getPlayer } from './player/player.js'
import { initControls, pauseControls, resumeControls, Input } from './player/controls.js'
import { loadWorld } from './world/loader.js'
import { createLights } from './core/lights.js'
import { physicsWorld } from './physics/physics.js'
import { createPhysicsDebug } from './physics/debug.js'
import { initDebugMenu } from './ui/debugMenu.js'
import { initWeapon, updateWeapon, setNPCManagerRef } from './player/weapon.js'
import { initNPCManager, updateNPCs, spawnMultipleNPCs, NPCManager, setNPCsTarget } from './entities/NPCManager.js'

// Estado do jogo
let gameState = 'menu' // 'menu', 'loading', 'playing', 'paused'
let gameInitialized = false
let gameLoop = null
let stats = null
let physicsDebug = null

// Elementos DOM
const menuOverlay = document.getElementById('menu-overlay')
const startGameBtn = document.getElementById('start-game-btn')
const loadingIndicator = document.getElementById('loading-indicator')

// Sistema de Menu
class MenuSystem {
  constructor() {
    this.init()
  }

  init() {
    // Event listener para botão de iniciar
    startGameBtn.addEventListener('click', () => {
      this.startGame()
    })

    // Event listener para ESC (voltar ao menu)
    document.addEventListener('keydown', (event) => {
      if (event.code === 'Escape' && gameState === 'playing') {
        this.pauseGame()
      }
    })
  }

  showMenu() {
    menuOverlay.classList.remove('hidden')
    loadingIndicator.classList.remove('visible')
    gameState = 'menu'
    
    // Pausar controles se o jogo estiver rodando
    if (gameInitialized) {
      pauseControls()
    }
  }

  hideMenu() {
    menuOverlay.classList.add('hidden')
    gameState = 'playing'
    
    // Resumir controles
    if (gameInitialized) {
      resumeControls()
    }
  }

  showLoading() {
    startGameBtn.style.display = 'none'
    loadingIndicator.classList.add('visible')
    gameState = 'loading'
  }

  hideLoading() {
    startGameBtn.style.display = 'block'
    loadingIndicator.classList.remove('visible')
  }

  async startGame() {
    if (gameInitialized) {
      // Jogo já foi inicializado, apenas esconder menu
      this.hideMenu()
      return
    }

    // Mostrar loading
    this.showLoading()

    try {
      // Inicializar o jogo
      await this.initGame()
      gameInitialized = true
      
      // Esconder loading e menu
      this.hideLoading()
      this.hideMenu()
    } catch (error) {
      this.hideLoading()
      alert('Erro ao carregar o jogo. Verifique o console para mais detalhes.')
    }
  }

  pauseGame() {
    if (gameState === 'playing') {
      this.showMenu()
    }
  }

  async initGame() {
    // 1. Inicializar mundo físico
    await physicsWorld.init()
    
    // 2. Configurar player
    player.add(camera)
    camera.position.set(0, 0.35, 0)
    scene.add(player)
    
    // 3. Inicializar física do player
    await initPlayer()
    
    // 3.1. Inicializar arma FPS
    await initWeapon()
    
    // 4. Criar luzes (HemisphereLight + DirectionalLight com sombras)
    const { fillLight, directionalLight } = createLights()
    scene.add(fillLight, directionalLight)
    
    // 5. Inicializar controles (começam pausados)
    initControls()
    pauseControls()
    
    // 6. Carregar mundo com física
    const worldData = await loadWorld()
    
    // 6.1. Posicionar player após mundo carregado
    positionPlayerAfterWorldLoad()
    
    // 6.2. Inicializar sistema de NPCs
    await initNPCManager()
    
    // 6.2.1. Conectar NPCManager à arma para detecção de acertos
    setNPCManagerRef(NPCManager)
    
    // 6.2.2. Definir player como alvo da IA dos NPCs
    setNPCsTarget(player)
    
    // 6.3. Spawnar inimigos com IA
    await spawnMultipleNPCs(3, {
      centerX: 5,
      centerZ: 5,
      spread: 10,
      y: 0,
      scale: 0.15,
      moveSpeed: 1.2,
      patrolRadius: 6,
      // Configurações de IA
      patrolSpeed: 1.5,
      chaseSpeed: 3.0,
      viewDistance: 12,
      attackDistance: 1.5,
      attackDamage: 10,
      showDebug: false  // Mudar para true para ver cone de visão
    })
    
    // 7. Configurar stats e debug
    stats = createStats()
    physicsDebug = createPhysicsDebug(scene)
    
    // 8. Iniciar loop principal
    gameLoop = startLoop(
      (delta) => {
        if (gameState !== 'playing') return
        
        stats.update()
        
        // Atualizar física
        physicsWorld.step(delta)
        
        // Atualizar debug de física
        physicsDebug.update()
        
        // Atualizar player
        updatePlayer(delta)
        
        // Atualizar arma (verificar se está andando)
        const isMoving = Input.keys.KeyW || Input.keys.KeyS || Input.keys.KeyA || Input.keys.KeyD
        updateWeapon(delta, isMoving)
        
        // Atualizar NPCs
        updateNPCs(delta)
      },
      () => {
        renderer.render(scene, camera)
      }
    )
  }
}

// Inicializar sistema de menu quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
  new MenuSystem()
  initDebugMenu()
})