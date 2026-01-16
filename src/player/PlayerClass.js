import * as THREE from 'three'
import { physicsWorld } from '../physics/physics.js'
import { Input, updateInputActions } from './controls.js'
import { camera } from '../core/camera.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AnimationMixer, LoopOnce, LoopRepeat } from 'three'

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
      fov: 39.5
    }
    
    // Estado do player
    this.state = {
      isGrounded: false,
      canJump: true,
      lastJumpTime: 0,
      jumpCooldown: 300,
      health: 100,
      stamina: 100,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3()
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
    
    // Sistema de armas com State Machine aprimorado
    this.weapon = {
      model: null,
      mixer: null,
      animations: {},
      currentAction: null,
      state: 'idle', // idle | shooting | reloading | drawing | hiding | slideBack | reloadEmpty
      equipped: false,
      slot: 1, // Slot atual da arma (1-5)
      
      // Munição
      ammo: 17,
      maxAmmo: 17,
      
      // Mapeamento estado → animação
      stateMap: {
        idle: null,           // Não precisa de animação, apenas fica parado
        shooting: 'Fire',
        reloading: 'Reload',
        reloadEmpty: 'ReloadEmpty',
        drawing: 'Draw',
        hiding: 'Holster',
        slideBack: 'SlideBack'
      },
      
      // ⚡ VELOCIDADE DAS ANIMAÇÕES (timeScale) - AJUSTE AQUI!
      // Valores maiores = mais rápido | 1.0 = velocidade normal
      animationSpeed: {
        Fire: 4.5,         // 🔫 Tiro - 2.5x mais rápido
        Reload: 1.5,       // 🔄 Reload - 1.5x mais rápido
        ReloadEmpty: 1.3,  // 🔄 Reload vazio - 1.3x mais rápido
        Draw: 1.8,         // 🗡️ Sacar - 1.8x mais rápido
        Holster: 1.5,      // 🔒 Guardar - 1.5x mais rápido
        SlideBack: 2.0     // 🔧 Slide - 2.0x mais rápido
      },
      
      // Prioridade dos estados (maior = mais prioritário)
      statePriority: {
        idle: 0,
        drawing: 1,
        hiding: 1,
        slideBack: 2,
        shooting: 3,
        reloading: 4,
        reloadEmpty: 4
      }
    }
    
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

const loader = new GLTFLoader()
const textureLoader = new THREE.TextureLoader()

loader.load('models/glock.glb', (gltf) => {
  this.weapon.model = gltf.scene

  // Escala (quase sempre grande demais vindo do Blender)
  this.weapon.model.scale.setScalar(0.2)

  // Posição relativa à câmera (FPS)
  this.weapon.model.position.set(0, -0.300, -0.140)

  // ROTACIONAR para frente da câmera
  this.weapon.model.rotation.set(0, Math.PI, 0)

  // 👉 MUITO IMPORTANTE
  camera.add(this.weapon.model)

  // Carregar e aplicar texturas externas
  this.loadAndApplyTextures(textureLoader)

  // Debug: evita culling estranho e melhora materiais
  this.weapon.model.traverse((child) => {
    if (child.isMesh) {
      child.frustumCulled = false
      // Melhorar qualidade das texturas
      if (child.material && child.material.map) {
        child.material.map.anisotropy = 16
        child.material.map.minFilter = THREE.LinearMipmapLinearFilter
        child.material.map.magFilter = THREE.LinearFilter
      }
    }
  })

  // Configurar animações
  if (gltf.animations && gltf.animations.length > 0) {
    this.weapon.mixer = new AnimationMixer(this.weapon.model)
    
    // Armazenar todas as animações por nome
    console.log('📋 Animações encontradas no modelo:')
    gltf.animations.forEach(clip => {
      const action = this.weapon.mixer.clipAction(clip)
      this.weapon.animations[clip.name] = action
      
      // Configurar todas as animações para LoopOnce por padrão
      action.setLoop(LoopOnce, 1)
      action.clampWhenFinished = true
      
      console.log(`  📼 "${clip.name}" (duração: ${clip.duration.toFixed(2)}s)`)
    })
    
    console.log('🎬 Animações carregadas:', Object.keys(this.weapon.animations))
    console.log('📊 Animações disponíveis:')
    console.log('   - Draw: Sacar arma')
    console.log('   - Fire: Atirar')
    console.log('   - Reload: Recarregar')
    console.log('   - ReloadEmpty: Recarregar vazia')
    console.log('   - SlideBack: Puxar slide')
    console.log('   - Holster: Guardar arma')
    
    // Evento global do mixer - STATE MACHINE
    this.weapon.mixer.addEventListener('finished', (e) => {
      this.onAnimationFinished(e)
    })
    
    // Iniciar com Draw (sacar arma)
    this.setWeaponState('drawing')
    this.weapon.equipped = true
  } else {
    console.log('⚠️ Nenhuma animação encontrada no modelo!')
  }

  console.log('🔫 Glock FPS carregada!')
  console.log('🎮 Controles: Click esquerdo = Atirar | R = Recarregar | 1 = Equipar arma')
  console.log('⚡ Use setAnimSpeed("Fire", 3.0) para ajustar velocidade das animações')
  
  // Funções de debug globais
  window.listWeaponAnimations = () => {
    console.log('🎬 Animações disponíveis:', Object.keys(this.weapon.animations))
    return Object.keys(this.weapon.animations)
  }
  
  window.playAnimation = (name) => {
    this.playWeaponAnimation(name)
  }
  
  window.getWeaponState = () => {
    console.log('🔫 Estado atual:', this.weapon.state)
    console.log('🔫 Munição:', this.weapon.ammo, '/', this.weapon.maxAmmo)
    return { state: this.weapon.state, ammo: this.weapon.ammo }
  }
  
  // ⚡ FUNÇÕES PARA AJUSTAR VELOCIDADE EM TEMPO REAL
  window.setAnimSpeed = (animName, speed) => {
    if (this.weapon.animationSpeed[animName] !== undefined) {
      this.weapon.animationSpeed[animName] = speed
      console.log(`⚡ Velocidade de "${animName}" ajustada para ${speed}x`)
    } else {
      console.warn(`❌ Animação "${animName}" não encontrada`)
      console.log('📋 Disponíveis:', Object.keys(this.weapon.animationSpeed))
    }
  }
  
  window.getAnimSpeeds = () => {
    console.log('⚡ Velocidades atuais das animações:')
    Object.entries(this.weapon.animationSpeed).forEach(([name, speed]) => {
      console.log(`   ${name}: ${speed}x`)
    })
    return this.weapon.animationSpeed
  }
  
  window.setFireSpeed = (speed) => {
    this.weapon.animationSpeed.Fire = speed
    console.log(`🔫 Velocidade do tiro: ${speed}x`)
  }
  
  window.setReloadSpeed = (speed) => {
    this.weapon.animationSpeed.Reload = speed
    this.weapon.animationSpeed.ReloadEmpty = speed
    console.log(`🔄 Velocidade do reload: ${speed}x`)
  }
})
  }
  
  /**
   * Carrega e aplica texturas externas nos materiais
   */
  loadAndApplyTextures(textureLoader) {
    // Mapeamento de materiais para texturas
    const textureMap = {
      'Hand_D': 'models/textures/Hand_D_baseColor.png',
      'Glove_D': 'models/textures/Glove_D_baseColor.png'
    }
    
    this.weapon.model.traverse((child) => {
      if (child.isMesh && child.material) {
        const materialName = child.material.name
        
        if (textureMap[materialName]) {
          textureLoader.load(textureMap[materialName], (texture) => {
            texture.flipY = false // GLB geralmente não precisa flip
            texture.colorSpace = THREE.SRGBColorSpace
            texture.anisotropy = 16
            
            child.material.map = texture
            child.material.needsUpdate = true
            
            console.log(`✅ Textura aplicada: ${materialName} -> ${textureMap[materialName]}`)
          }, undefined, (error) => {
            console.warn(`⚠️ Erro ao carregar textura para ${materialName}:`, error)
          })
        }
      }
    })
  }
  
  /**
   * Callback quando uma animação termina
   */
  onAnimationFinished(event) {
    const finishedAction = event.action
    const clipName = finishedAction.getClip().name
    
    console.log(`🎬 Animação "${clipName}" finalizada`)
    
    switch (this.weapon.state) {
      case 'shooting':
        // Após atirar, volta para idle
        // Diminui munição
        if (this.weapon.ammo > 0) {
          this.weapon.ammo--
        }
        this.weapon.state = 'idle'
        console.log(`🔫 Munição: ${this.weapon.ammo}/${this.weapon.maxAmmo}`)
        break
        
      case 'reloading':
      case 'reloadEmpty':
        // Após recarregar, volta para idle e enche munição
        this.weapon.ammo = this.weapon.maxAmmo
        this.weapon.state = 'idle'
        console.log(`🔫 Recarregado! Munição: ${this.weapon.ammo}/${this.weapon.maxAmmo}`)
        break
        
      case 'drawing':
      case 'slideBack':
        // Volta para idle após essas animações
        this.weapon.state = 'idle'
        console.log('🔄 Estado: idle')
        break
        
      case 'hiding':
        // Após holster, arma fica guardada
        this.weapon.equipped = false
        this.weapon.state = 'idle'
        this.weapon.model.visible = false
        console.log('🔒 Arma guardada')
        break
    }
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

    // Atualizar animações da arma
    if (this.weapon.mixer) {
      this.weapon.mixer.update(delta)
    }
    
    // Processar inputs da arma
    this.processWeaponInput()
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
    // Atualizar stamina (exemplo)
    if (this._moveVector.length() > 0) {
      this.state.stamina = Math.max(0, this.state.stamina - 10 * delta)
    } else {
      this.state.stamina = Math.min(100, this.state.stamina + 20 * delta)
    }
  }
  
  /**
   * Processa inputs da arma (STATE MACHINE com prioridades)
   * INPUT → STATE → ANIMATION
   * Usa Input.actions do controls.js (detecção de borda)
   */
  processWeaponInput() {
    if (!this.weapon.mixer) return
    
    // Atualizar detecção de borda dos inputs
    updateInputActions()
    
    // Prioridade: Reload e Fire podem interromper outras ações menores
    const currentPriority = this.weapon.statePriority[this.weapon.state] || 0
    
    // Se arma não está equipada, só pode sacar
    if (!this.weapon.equipped) {
      if (Input.actions.weaponSlot1) {
        this.weapon.model.visible = true
        this.weapon.equipped = true
        this.setWeaponState('drawing')
      }
      return
    }
    
    // PRIORIDADE 1: Recarregar (tecla R) - maior prioridade
    if (Input.actions.reload && this.weapon.ammo < this.weapon.maxAmmo) {
      // Reload tem prioridade alta, pode interromper shooting
      if (currentPriority < this.weapon.statePriority.reloading) {
        // Usa ReloadEmpty se munição = 0
        if (this.weapon.ammo === 0) {
          this.setWeaponState('reloadEmpty')
        } else {
          this.setWeaponState('reloading')
        }
        return
      }
    }
    
    // PRIORIDADE 2: Atirar (botão esquerdo do mouse)
    if (Input.actions.shoot && this.weapon.ammo > 0) {
      if (currentPriority < this.weapon.statePriority.shooting) {
        this.setWeaponState('shooting')
        return
      }
    }
    
    // Se não está em idle, não aceita comandos de menor prioridade
    if (this.weapon.state !== 'idle') return
    
    // Guardar arma (tecla 1 quando já está equipada)
    if (Input.actions.weaponSlot1) {
      this.setWeaponState('hiding')
    }
  }
  
  /**
   * Muda o estado da arma e toca a animação correspondente
   */
  setWeaponState(state) {
    if (this.weapon.state === state) return
    
    const animName = this.weapon.stateMap[state]
    
    // idle não precisa de animação
    if (state === 'idle') {
      this.weapon.state = state
      return
    }
    
    if (!animName) {
      console.warn(`❌ Estado '${state}' não tem animação mapeada`)
      return
    }
    
    this.weapon.state = state
    this.playWeaponAnimation(animName)
    
    console.log(`🔫 Estado: ${state}`)
  }
  
  /**
   * Toca uma animação da arma por nome (versão robusta com transições)
   * ⚡ A velocidade é controlada por this.weapon.animationSpeed
   */
  playWeaponAnimation(name) {
    const action = this.weapon.animations[name]
    
    if (!action) {
      console.warn(`❌ Animação '${name}' não encontrada`)
      console.log('📋 Disponíveis:', Object.keys(this.weapon.animations))
      return
    }
    
    // Parar animação atual suavemente
    if (this.weapon.currentAction && this.weapon.currentAction !== action) {
      this.weapon.currentAction.fadeOut(0.05) // Transição mais rápida
    }
    
    // ⚡ APLICAR VELOCIDADE DA ANIMAÇÃO
    const speed = this.weapon.animationSpeed[name] || 1.0
    action.timeScale = speed
    
    // Resetar e tocar a nova animação
    action.reset()
    action.fadeIn(0.05) // Transição mais rápida
    action.play()
    
    this.weapon.currentAction = action
    
    console.log(`🎬 Tocando: ${name} (velocidade: ${speed}x)`)
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
        stamina: this.state.stamina.toFixed(1)
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
    
    // Presets úteis
    window.jumpPresets = () => {
      console.log('🎮 PRESETS DE PULO:')
      console.log('setJumpForce(5)   // Pulo baixo')
      console.log('setJumpForce(10)  // Pulo normal') 
      console.log('setJumpForce(15)  // Pulo alto')
      console.log('setJumpForce(20)  // Super pulo')
      console.log('testJumpNow()     // Testar pulo agora')
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
