import * as THREE from 'three'
import { physicsWorld } from '../physics/physics.js'
import { Input } from './controls.js'
import { camera } from '../core/camera.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AnimationMixer } from 'three'

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

loader.load('models/glock.glb', (gltf) => {
  this.armModel = gltf.scene

  // Escala (quase sempre grande demais vindo do Blender)
  this.armModel.scale.setScalar(0.2)

  // Posição relativa à câmera (FPS)
  this.armModel.position.set(0, -0.300, -0.140)

  // ROTACIONAR para frente da câmera
  this.armModel.rotation.set(0, Math.PI, 0)

  // 👉 MUITO IMPORTANTE
  camera.add(this.armModel)

  // Debug: evita culling estranho
  this.armModel.traverse((child) => {
    if (child.isMesh) {
      child.frustumCulled = false
    }
  })

  // // Animações
  // if (gltf.animations.length) {
  //   this.mixer = new AnimationMixer(this.armModel)
  //   this.action = this.mixer.clipAction(gltf.animations[0])
  //   this.action.play()
  // }

  console.log('🔫 Glock FPS posicionada corretamente')
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

    if(this.mixer) {
      this.mixer.update(delta)
    }

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
