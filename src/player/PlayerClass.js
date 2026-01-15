import * as THREE from 'three'
import { physicsWorld } from '../physics/physics.js'
import { Input } from './controls.js'
import { camera } from '../core/camera.js'

/**
 * Classe responsável pelo estado e comportamento do jogador
 * Centraliza toda a lógica do jogador em uma única classe
 */
export class Player {
  constructor() {
    // Objeto 3D do player
    this.object3D = new THREE.Object3D()
    
    // Configurações do player
    this.config = {
      speed: 5.0,
      jumpForce: 4.5,
      radius: 0.3,
      height: 1.4,
      maxSpeed: 10.0,
      mouseSensitivity: 0.002,
      fov: 75
    }
    
    // Estado do player
    this.state = {
      isGrounded: false,
      canJump: true,
      lastJumpTime: 0,
      jumpCooldown: 300,
      health: 100,
      maxHealth: 100,
      stamina: 100,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      // Sistema de vida
      isAlive: true,
      isDamageInvulnerable: false,
      invulnerabilityTime: 0,
      invulnerabilityDuration: 1000, // 1 segundo de invulnerabilidade após dano
      lastDamageTime: 0
    }
    
    // Configurações de dano
    this.damageConfig = {
      fallDamageThreshold: -15.0, // Velocidade Y que causa dano por queda
      fallDamageMultiplier: 5.0,  // Multiplicador do dano por queda
      maxFallDamage: 80,          // Dano máximo por queda
      deathRespawnDelay: 3000     // Delay para respawn após morte (ms)
    }
    
    // Física
    this.physics = {
      rigidBody: null,
      collider: null
    }
    
    // Controles de câmera
    this.camera = {
      yaw: 0,
      pitch: 0,
      pitchLimit: Math.PI / 2
    }
    
    // Vetores auxiliares (para evitar criar novos a cada frame)
    this._forward = new THREE.Vector3()
    this._right = new THREE.Vector3()
    this._up = new THREE.Vector3(0, 1, 0)
    this._moveVector = new THREE.Vector3()
    this._rayOrigin = new THREE.Vector3()
    this._rayDirection = new THREE.Vector3(0, -1, 0)
    
    // Expor configuração globalmente para debug
    window.playerConfig = this.config
    this.initDebugFunctions()
  }
  
  /**
   * Inicializa o player e sua física
   */
  async init() {
    // Posição inicial
    this.object3D.position.set(0, 2, 0)
    this.state.position.copy(this.object3D.position)
    
    // Configurar câmera
    this.object3D.add(camera)
    camera.position.set(0, 0.35, 0)
    camera.fov = this.config.fov
    camera.updateProjectionMatrix()
    
    // Criar corpo físico
    const playerPhysics = physicsWorld.createPlayerBody(
      this.object3D.position,
      this.config.radius,
      this.config.height
    )
    
    this.physics.rigidBody = playerPhysics.rigidBody
    this.physics.collider = playerPhysics.collider
    
    console.log('🧑 Player inicializado:', {
      position: this.physics.rigidBody.translation(),
      mass: this.physics.collider.mass(),
      bodyType: this.physics.rigidBody.bodyType(),
      config: this.config
    })
  }
  
  /**
   * Atualiza o player a cada frame
   */
  update(delta) {
    if (!this.physics.rigidBody) return
    
    // Atualizar posição do objeto 3D baseado na física
    this.updatePosition()
    
    // Verificar se está no chão
    this.checkGrounded()
    
    // Processar movimento
    this.processMovement(delta)
    
    // Processar pulo
    this.processJump()
    
    // Aplicar movimento na física
    this.applyMovement()
    
    // Atualizar estado
    this.updateState(delta)
  }
  
  /**
   * Atualiza a posição do objeto 3D baseado na física
   */
  updatePosition() {
    const currentPos = this.physics.rigidBody.translation()
    this.object3D.position.set(currentPos.x, currentPos.y, currentPos.z)
    this.state.position.copy(this.object3D.position)
  }
  
  /**
   * Verifica se o player está no chão usando raycast
   */
  checkGrounded() {
    if (!physicsWorld.world) {
      this.state.isGrounded = false
      return
    }
    
    const playerPos = this.physics.rigidBody.translation()
    this._rayOrigin.set(playerPos.x, playerPos.y, playerPos.z)
    
    const hit = physicsWorld.castRay(
      this._rayOrigin,
      this._rayDirection,
      this.config.height / 2 + 0.5
    )
    
    const wasGrounded = this.state.isGrounded
    this.state.isGrounded = hit !== null && hit.distance <= (this.config.height / 2 + 0.3)
    
    // DEBUG: Log mudanças de estado do chão
    if (wasGrounded !== this.state.isGrounded) {
      console.log('🏃 Estado do chão mudou:', this.state.isGrounded ? 'NO CHÃO' : 'NO AR')
    }
  }
  
  /**
   * Processa o movimento baseado no input
   */
  processMovement(delta) {
    this._moveVector.set(0, 0, 0)
    
    // Obter direções da câmera
    this.object3D.getWorldDirection(this._forward)
    this._forward.y = 0
    this._forward.normalize()
    this._right.crossVectors(this._forward, this._up)
    
    // Input de movimento
    if (Input.keys.KeyW) this._moveVector.addScaledVector(this._forward, -1)
    if (Input.keys.KeyS) this._moveVector.addScaledVector(this._forward, 1)
    if (Input.keys.KeyA) this._moveVector.addScaledVector(this._right, 1)
    if (Input.keys.KeyD) this._moveVector.addScaledVector(this._right, -1)
    
    // Normalizar para movimento diagonal consistente
    if (this._moveVector.length() > 0) {
      this._moveVector.normalize()
      
      // Usar velocidade do debug menu se disponível
      const currentSpeed = (window.debugConfig?.movementSpeed) || this.config.speed
      this._moveVector.multiplyScalar(currentSpeed)
    }
  }
  
  /**
   * Processa o pulo
   */
  processJump() {
    const spacePressed = Input.keys.Space || Input.keys[' ']
    
    // DEBUG: Mostrar sempre que Space é pressionado
    if (spacePressed) {
      console.log('🎮 SPACE PRESSIONADO!')
      console.log('- isGrounded:', this.state.isGrounded)
      console.log('- Posição Y:', this.object3D.position.y.toFixed(2))
      
      if (this.state.isGrounded) {
        console.log('✅ Condições ok - executando pulo!')
        this.jump()
      } else {
        console.log('❌ Não pode pular - não está no chão')
        
        // Se não está no chão, vamos forçar para estar (debug)
        console.log('🔧 DEBUG: Forçando isGrounded = true para teste')
        this.state.isGrounded = true
        this.jump()
      }
    }
  }
  
  /**
   * Executa o pulo
   */
  jump() {
    const currentVel = this.physics.rigidBody.linvel()
    const jumpForce = (window.debugConfig?.jumpForce) || this.config.jumpForce
    
    this.physics.rigidBody.setLinvel({
      x: currentVel.x,
      y: jumpForce,
      z: currentVel.z
    }, true)
    
    console.log('🦘 PULO! Força aplicada:', jumpForce)
  }
  
  /**
   * Aplica o movimento calculado na física
   */
  applyMovement() {
    const currentVel = this.physics.rigidBody.linvel()
    
    const targetVelocity = {
      x: this._moveVector.x,
      y: currentVel.y, // Manter velocidade Y para gravidade
      z: this._moveVector.z
    }
    
    // Limitar velocidade máxima horizontal
    const horizontalSpeed = Math.sqrt(targetVelocity.x * targetVelocity.x + targetVelocity.z * targetVelocity.z)
    if (horizontalSpeed > this.config.maxSpeed) {
      const scale = this.config.maxSpeed / horizontalSpeed
      targetVelocity.x *= scale
      targetVelocity.z *= scale
    }
    
    // Aplicar velocidade
    this.physics.rigidBody.setLinvel(targetVelocity, true)
    this.state.velocity.set(targetVelocity.x, targetVelocity.y, targetVelocity.z)
  }
  
  /**
   * Atualiza o estado do player
   */
  updateState(delta) {
    // Atualizar sistema de invulnerabilidade
    this.updateInvulnerability(delta)
    
    // Atualizar stamina (exemplo)
    if (this._moveVector.length() > 0) {
      this.state.stamina = Math.max(0, this.state.stamina - 10 * delta)
    } else {
      this.state.stamina = Math.min(100, this.state.stamina + 20 * delta)
    }
    
    // Verificar dano por queda (apenas se estiver vivo)
    if (this.state.isAlive) {
      this.checkFallDamage()
    }
  }
  
  /**
   * Verifica e aplica dano por queda se necessário
   */
  checkFallDamage() {
    if (!this.state.isGrounded || this.state.isAlive) return
    
    const fallVelocity = this.physics.rigidBody.linvel().y
    
    if (fallVelocity < this.damageConfig.fallDamageThreshold) {
      const damage = Math.min(
        this.damageConfig.maxFallDamage,
        -fallVelocity * this.damageConfig.fallDamageMultiplier
      )
      
      console.log(`💥 Dano por queda: ${damage}`)
      this.applyDamage(damage)
    }
  }
  
  /**
   * Aplica dano ao jogador
   */
  applyDamage(amount) {
    if (this.state.isDamageInvulnerable) return
    
    this.state.health = Math.max(0, this.state.health - amount)
    this.state.lastDamageTime = Date.now()
    
    console.log(`❤️ Dano recebido: ${amount}. Vida restante: ${this.state.health}`)
    
    // Ativar invulnerabilidade temporária
    this.activateInvulnerability()
    
    // Verificar morte
    if (this.state.health === 0) {
      this.die()
    }
    
    // Disparar eventos de dano
    this.triggerHealthEvent('onDamage', amount)
  }
  
  /**
   * Ativa a invulnerabilidade temporária
   */
  activateInvulnerability() {
    this.state.isDamageInvulnerable = true
    
    setTimeout(() => {
      this.state.isDamageInvulnerable = false
    }, this.state.invulnerabilityDuration)
    
    console.log(`🛡️ Invulnerabilidade ativada por ${this.state.invulnerabilityDuration}ms`)
  }
  
  /**
   * Mata o jogador e inicia o respawn
   */
  die() {
    this.state.isAlive = false
    this.state.health = 0
    
    console.log('💀 Jogador morreu')
    
    // Disparar evento de morte
    this.triggerHealthEvent('onDeath')
    
    // Iniciar respawn após delay
    setTimeout(() => {
      this.respawn()
    }, this.damageConfig.deathRespawnDelay)
  }
  
  /**
   * Respawn do jogador
   */
  respawn() {
    this.state.isAlive = true
    this.state.health = this.state.maxHealth
    
    // Reposicionar o jogador (exemplo: posição fixa ou aleatória)
    this.setPosition(0, 5, 0)
    
    console.log('🔄 Jogador respawnado')
    
    // Disparar evento de respawn
    this.triggerHealthEvent('onRespawn')
  }
  
  /**
   * Dispara eventos relacionados à saúde
   */
  triggerHealthEvent(eventName, ...args) {
    const eventHandlers = this.healthEvents[eventName] || []
    for (const handler of eventHandlers) {
      handler(...args)
    }
  }
  
  /**
   * Processa o movimento do mouse para rotação da câmera
   */
  processMouseMovement(deltaX, deltaY) {
    const sensitivity = (window.debugConfig?.mouseSensitivity) || this.config.mouseSensitivity
    
    this.camera.yaw -= deltaX * sensitivity
    this.camera.pitch -= deltaY * sensitivity
    
    // Limitar pitch
    this.camera.pitch = Math.max(-this.camera.pitchLimit, Math.min(this.camera.pitchLimit, this.camera.pitch))
    
    // Aplicar rotações
    this.object3D.rotation.y = this.camera.yaw
    camera.rotation.x = this.camera.pitch
  }
  
  /**
   * Define a posição do player
   */
  setPosition(x, y, z) {
    this.object3D.position.set(x, y, z)
    this.state.position.set(x, y, z)
    
    if (this.physics.rigidBody) {
      this.physics.rigidBody.setTranslation({ x, y, z }, true)
      this.physics.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }
  }
  
  /**
   * Posiciona o player após o mundo ser carregado
   */
  positionAfterWorldLoad() {
    this.setPosition(0, 5, 0) // 5 metros acima da origem
    console.log('🎯 Player posicionado após carregamento do mundo')
  }
  
  /**
   * Obtém a posição atual do player
   */
  getPosition() {
    return this.state.position.clone()
  }
  
  /**
   * Verifica se o player está no chão
   */
  isGrounded() {
    return this.state.isGrounded
  }
  
  /**
   * Configura o FOV da câmera
   */
  setFOV(fov) {
    this.config.fov = fov
    camera.fov = fov
    camera.updateProjectionMatrix()
    console.log(`📷 FOV alterado para ${fov}°`)
  }
  
  /**
   * Configura a velocidade de movimento
   */
  setMovementSpeed(speed) {
    this.config.speed = speed
    console.log(`🏃 Velocidade de movimento alterada para ${speed}`)
  }
  
  /**
   * Configura a força do pulo
   */
  setJumpForce(force) {
    this.config.jumpForce = force
    console.log(`🦘 Força do pulo alterada para ${force}`)
  }
  
  /**
   * Configura a sensibilidade do mouse
   */
  setMouseSensitivity(sensitivity) {
    this.config.mouseSensitivity = sensitivity
    console.log(`🖱️ Sensibilidade do mouse alterada para ${sensitivity}`)
  }
  
  /**
   * Debug: obtém informações do player
   */
  getDebugInfo() {
    if (!this.physics.rigidBody) {
      return { error: 'Player não inicializado' }
    }
    
    const pos = this.physics.rigidBody.translation()
    const vel = this.physics.rigidBody.linvel()
    
    return {
      position: { x: pos.x.toFixed(2), y: pos.y.toFixed(2), z: pos.z.toFixed(2) },
      velocity: { x: vel.x.toFixed(2), y: vel.y.toFixed(2), z: vel.z.toFixed(2) },
      state: {
        isGrounded: this.state.isGrounded,
        canJump: this.state.canJump,
        health: this.state.health,
        stamina: this.state.stamina.toFixed(1),
        isAlive: this.state.isAlive
      },
      config: this.config,
      camera: {
        yaw: (this.camera.yaw * 180 / Math.PI).toFixed(1) + '°',
        pitch: (this.camera.pitch * 180 / Math.PI).toFixed(1) + '°'
      },
      input: {
        spacePressed: Input.keys.Space || Input.keys[' '],
        movement: {
          w: Input.keys.KeyW,
          a: Input.keys.KeyA,
          s: Input.keys.KeyS,
          d: Input.keys.KeyD
        }
      }
    }
  }
  
  /**
   * Força um pulo (para debug)
   */
  forceJump() {
    if (!this.physics.rigidBody) {
      console.log('❌ Player não inicializado')
      return
    }
    
    this.jump()
    console.log('🦘 PULO FORÇADO!')
  }
  
  /**
   * Testa todas as condições de pulo
   */
  testJumpConditions() {
    const now = Date.now()
    const spacePressed = Input.keys.Space || Input.keys[' ']
    
    console.log('🧪 TESTE DE CONDIÇÕES DE PULO:')
    console.log('1. Space pressionado:', spacePressed)
    console.log('2. canJump:', this.state.canJump)
    console.log('3. isGrounded:', this.state.isGrounded)
    console.log('4. Tempo desde último pulo:', now - this.state.lastJumpTime, 'ms')
    console.log('5. Cooldown necessário:', this.state.jumpCooldown, 'ms')
    
    const cooldownOk = (now - this.state.lastJumpTime > this.state.jumpCooldown)
    const allConditions = spacePressed && this.state.canJump && this.state.isGrounded && cooldownOk
    
    console.log('🎯 RESULTADO: Pulo deveria funcionar?', allConditions)
    
    return allConditions
  }
  
  /**
   * Reseta o sistema de pulo
   */
  resetJumpSystem() {
    this.state.canJump = true
    this.state.lastJumpTime = 0
    console.log('🔄 Sistema de pulo resetado!')
  }
  
  /**
   * Inicializa funções de debug globais
   */
  initDebugFunctions() {
    window.debugPlayer = () => console.log('🔧 Player Debug Info:', this.getDebugInfo())
    window.testJump = () => this.forceJump()
    window.testJumpConditions = () => this.testJumpConditions()
    window.resetJumpSystem = () => this.resetJumpSystem()
    window.setPlayerPosition = (x, y, z) => this.setPosition(x, y, z)
    window.setJumpForce = (force) => this.setJumpForce(force)
    window.setMovementSpeed = (speed) => this.setMovementSpeed(speed)
    window.setMouseSensitivity = (sens) => this.setMouseSensitivity(sens)
    window.setPlayerFOV = (fov) => this.setFOV(fov)
    
    // Nova função para testar pulo em tempo real
    window.testJumpNow = () => {
      console.log('🧪 TESTE DE PULO EM TEMPO REAL:')
      console.log('1. Space pressionado:', Input.keys.Space || Input.keys[' '])
      console.log('2. Player no chão:', this.state.isGrounded)
      console.log('3. Posição Y atual:', this.object3D.position.y.toFixed(2))
      
      if (this.state.isGrounded) {
        console.log('✅ Tentando pular...')
        this.jump()
      } else {
        console.log('❌ Não pode pular - não está no chão')
      }
    }
    
    // Funções de debug para sistema de vida
    window.testDamage = (amount = 20) => {
      this.takeDamage(amount, 'debug')
      console.log(`💥 Dano de teste aplicado: ${amount}`)
    }
    
    window.testHeal = (amount = 25) => {
      this.heal(amount)
      console.log(`💚 Cura de teste aplicada: ${amount}`)
    }
    
    window.testDeath = () => {
      this.takeDamage(this.state.health, 'debug-death')
      console.log('💀 Morte de teste forçada')
    }
    
    window.testFallDamage = () => {
      // Simular queda forçando velocidade negativa
      if (this.physics.rigidBody) {
        this.physics.rigidBody.setLinvel({ x: 0, y: -20, z: 0 }, true)
        console.log('🪂 Simulando queda para teste de dano')
      }
    }
    
    window.getHealthInfo = () => {
      const info = this.getHealthInfo()
      console.log('❤️ INFO DE VIDA:', info)
      return info
    }
    
    // Presets úteis
    window.jumpPresets = () => {
      console.log('🎮 PRESETS DE TESTE:')
      console.log('=== PULO ===')
      console.log('setJumpForce(5)   // Pulo baixo')
      console.log('setJumpForce(10)  // Pulo normal') 
      console.log('setJumpForce(15)  // Pulo alto')
      console.log('setJumpForce(20)  // Super pulo')
      console.log('testJumpNow()     // Testar pulo agora')
      console.log('')
      console.log('=== VIDA ===')
      console.log('testDamage(20)    // Aplicar 20 de dano')
      console.log('testHeal(25)      // Curar 25 pontos')
      console.log('testDeath()       // Forçar morte')
      console.log('testFallDamage()  // Simular dano por queda')
      console.log('getHealthInfo()   // Ver informações de vida')
    }
  }
  
  // ===== SISTEMA DE VIDA =====
  
  /**
   * Aplica dano ao player
   * @param {number} amount - Quantidade de dano
   * @param {string} source - Fonte do dano (fall, enemy, environment, etc.)
   * @param {Object} options - Opções adicionais
   */
  takeDamage(amount, source = 'unknown', options = {}) {
    if (!this.state.isAlive || this.state.isDamageInvulnerable) {
      return false
    }
    
    const finalDamage = Math.max(0, Math.min(amount, this.state.health))
    
    console.log(`💥 Player recebeu ${finalDamage} de dano (fonte: ${source})`)
    
    // Aplicar dano
    this.state.health = Math.max(0, this.state.health - finalDamage)
    this.state.lastDamageTime = Date.now()
    
    // Ativar invulnerabilidade temporária
    this.state.isDamageInvulnerable = true
    this.state.invulnerabilityTime = this.state.invulnerabilityDuration
    
    // Disparar evento de dano
    this.triggerHealthEvent('onDamage', {
      damage: finalDamage,
      source: source,
      remainingHealth: this.state.health,
      options: options
    })
    
    // Disparar evento de mudança de vida
    this.triggerHealthEvent('onHealthChange', {
      health: this.state.health,
      maxHealth: this.state.maxHealth,
      percentage: (this.state.health / this.state.maxHealth) * 100
    })
    
    // Verificar se morreu
    if (this.state.health <= 0) {
      this.die(source)
    }
    
    return true
  }
  
  /**
   * Cura o player
   * @param {number} amount - Quantidade de cura
   */
  heal(amount) {
    if (!this.state.isAlive) return false
    
    const oldHealth = this.state.health
    this.state.health = Math.min(this.state.maxHealth, this.state.health + amount)
    const actualHeal = this.state.health - oldHealth
    
    if (actualHeal > 0) {
      console.log(`💚 Player curado em ${actualHeal} pontos`)
      
      // Disparar evento de mudança de vida
      this.triggerHealthEvent('onHealthChange', {
        health: this.state.health,
        maxHealth: this.state.maxHealth,
        percentage: (this.state.health / this.state.maxHealth) * 100
      })
    }
    
    return actualHeal > 0
  }
  
  /**
   * Mata o player
   * @param {string} cause - Causa da morte
   */
  die(cause = 'unknown') {
    if (!this.state.isAlive) return
    
    this.state.isAlive = false
    this.state.health = 0
    
    console.log(`💀 Player morreu (causa: ${cause})`)
    
    // Disparar evento de morte
    this.triggerHealthEvent('onDeath', {
      cause: cause,
      position: this.state.position.clone()
    })
    
    // Programar respawn
    setTimeout(() => {
      this.respawn()
    }, this.damageConfig.deathRespawnDelay)
  }
  
  /**
   * Respawna o player
   */
  respawn() {
    // Restaurar vida
    this.state.health = this.state.maxHealth
    this.state.isAlive = true
    this.state.isDamageInvulnerable = false
    this.state.invulnerabilityTime = 0
    
    // Reposicionar player
    this.setPosition(0, 5, 0) // Posição de spawn
    
    console.log('🔄 Player respawnou')
    
    // Disparar evento de respawn
    this.triggerHealthEvent('onRespawn', {
      health: this.state.health,
      position: this.state.position.clone()
    })
    
    // Disparar evento de mudança de vida
    this.triggerHealthEvent('onHealthChange', {
      health: this.state.health,
      maxHealth: this.state.maxHealth,
      percentage: 100
    })
  }
  
  /**
   * Verifica dano por queda
   */
  checkFallDamage() {
    if (!this.physics.rigidBody) return
    
    const currentVel = this.physics.rigidBody.linvel()
    
    // Se a velocidade Y é muito negativa e player acabou de tocar o chão
    if (this.state.isGrounded && currentVel.y < this.damageConfig.fallDamageThreshold) {
      const fallSpeed = Math.abs(currentVel.y)
      const damage = Math.min(
        fallSpeed * this.damageConfig.fallDamageMultiplier,
        this.damageConfig.maxFallDamage
      )
      
      this.takeDamage(damage, 'fall', { fallSpeed: fallSpeed })
    }
  }
  
  /**
   * Atualiza sistema de invulnerabilidade
   * @param {number} delta - Delta time
   */
  updateInvulnerability(delta) {
    if (this.state.isDamageInvulnerable) {
      this.state.invulnerabilityTime -= delta * 1000
      
      if (this.state.invulnerabilityTime <= 0) {
        this.state.isDamageInvulnerable = false
        this.state.invulnerabilityTime = 0
      }
    }
  }
  
  /**
   * Adiciona listener para eventos de vida
   * @param {string} event - Nome do evento
   * @param {function} callback - Função callback
   */
  onHealthEvent(event, callback) {
    if (this.healthEvents[event]) {
      this.healthEvents[event].push(callback)
    }
  }
  
  /**
   * Remove listener de eventos de vida
   * @param {string} event - Nome do evento
   * @param {function} callback - Função callback
   */
  offHealthEvent(event, callback) {
    if (this.healthEvents[event]) {
      const index = this.healthEvents[event].indexOf(callback)
      if (index > -1) {
        this.healthEvents[event].splice(index, 1)
      }
    }
  }
  
  /**
   * Dispara evento de vida
   * @param {string} event - Nome do evento
   * @param {Object} data - Dados do evento
   */
  triggerHealthEvent(event, data) {
    if (this.healthEvents[event]) {
      this.healthEvents[event].forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Erro no evento ${event}:`, error)
        }
      })
    }
  }
  
  /**
   * Obtém informações de vida
   */
  getHealthInfo() {
    return {
      health: this.state.health,
      maxHealth: this.state.maxHealth,
      percentage: (this.state.health / this.state.maxHealth) * 100,
      isAlive: this.state.isAlive,
      isInvulnerable: this.state.isDamageInvulnerable,
      invulnerabilityTimeLeft: this.state.invulnerabilityTime
    }
  }
  
  /**
   * Limpa recursos quando o player é destruído
   */
  dispose() {
    if (this.physics.rigidBody) {
      physicsWorld.world.removeRigidBody(this.physics.rigidBody)
    }
    
    if (this.physics.collider) {
      physicsWorld.world.removeCollider(this.physics.collider, true)
    }
    
    // Limpar funções globais
    delete window.debugPlayer
    delete window.testJump
    delete window.testJumpConditions
    delete window.resetJumpSystem
    delete window.setPlayerPosition
    delete window.setJumpForce
    delete window.setMovementSpeed
    delete window.setMouseSensitivity
    delete window.setPlayerFOV
    delete window.jumpPresets
    delete window.playerConfig
    
    console.log('🧹 Player disposed')
  }
}
