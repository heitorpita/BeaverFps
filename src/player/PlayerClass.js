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
      fov: 57
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
  }
  
  /**
   * Inicializa o player e sua física
   */
  async init() {
    // Posição inicial
    this.object3D.position.set(0, 4, 4)
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
    
    if (spacePressed && this.state.isGrounded) {
      this.jump()
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
    this.setPosition(0, 5, 4)
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
  }
  
  /**
   * Configura a velocidade de movimento
   */
  setMovementSpeed(speed) {
    this.config.speed = speed
  }
  
  /**
   * Configura a força do pulo
   */
  setJumpForce(force) {
    this.config.jumpForce = force
  }
  
  /**
   * Configura a sensibilidade do mouse
   */
  setMouseSensitivity(sensitivity) {
    this.config.mouseSensitivity = sensitivity
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
  }
}
