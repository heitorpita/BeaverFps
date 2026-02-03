import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { physicsWorld } from '../physics/physics.js'

/**
 * Estados possíveis do NPC
 */
export const NPCState = {
  IDLE: 'IDLE',
  PATROL: 'PATROL',
  ALERT: 'ALERT',
  CHASE: 'CHASE',
  ATTACK: 'ATTACK',
  DEAD: 'DEAD'
}

/**
 * Classe NPC - Personagem controlado por IA com estados
 * Sistema completo: Patrulha → Alerta → Perseguição → Ataque
 */
export class NPC {
  constructor(options = {}) {
    // Identificador único
    this.id = options.id || Math.random().toString(36).substr(2, 9)
    this.name = options.name || 'NPC'
    
    // Grupo 3D que contém o modelo
    this.group = new THREE.Group()
    this.group.name = `NPC_${this.id}`
    
    // Modelo e animações
    this.model = null
    this.mixer = null
    this.animations = {}
    this.currentAction = null
    
    // Estado do NPC
    this.state = NPCState.IDLE
    this.previousState = NPCState.IDLE
    this.isAlive = true
    this.health = options.health || 100
    this.maxHealth = options.health || 100
    
    // ========== CONFIGURAÇÕES DE IA ==========
    
    // Detecção e visão
    this.ai = {
      // Campo de visão (cone)
      fovAngle: options.fovAngle || Math.PI / 2,      // 90 graus
      viewDistance: options.viewDistance || 15,        // Distância máxima de visão
      
      // Distâncias de comportamento
      alertDistance: options.alertDistance || 12,      // Distância para ficar alerta
      chaseDistance: options.chaseDistance || 20,      // Distância máxima de perseguição
      attackDistance: options.attackDistance || 2,     // Distância para atacar
      loseTargetDistance: options.loseTargetDistance || 25, // Distância para perder o alvo
      
      // Timers e estados
      alertTimer: 0,
      alertDuration: options.alertDuration || 2.0,     // Tempo em alerta antes de perseguir
      attackCooldown: 0,
      attackRate: options.attackRate || 1.0,           // Ataques por segundo
      attackDamage: options.attackDamage || 10,        // Dano por ataque
      
      // Referência ao alvo (player)
      target: null,
      lastKnownTargetPos: new THREE.Vector3(),
      canSeeTarget: false,
      
      // Pathfinding simples
      currentWaypoint: null,
      waypointReachedDistance: 0.5
    }
    
    // Configurações de movimento
    this.moveSpeed = options.moveSpeed || 2.0
    this.patrolSpeed = options.patrolSpeed || 1.5
    this.chaseSpeed = options.chaseSpeed || 3.5
    this.rotationSpeed = options.rotationSpeed || 3.0
    this.direction = new THREE.Vector3(0, 0, 1)
    this.targetDirection = new THREE.Vector3(0, 0, 1)
    this.velocity = new THREE.Vector3()
    
    // Configurações de patrulha
    this.patrolRadius = options.patrolRadius || 10
    this.patrolCenter = new THREE.Vector3()
    this.patrolPoints = []
    this.currentPatrolIndex = 0
    this.changeDirectionTimer = 0
    this.changeDirectionInterval = options.changeDirectionInterval || 3
    
    // Posição inicial
    this.spawnPosition = options.position 
      ? new THREE.Vector3().copy(options.position) 
      : new THREE.Vector3(0, 0, 0)
    
    // Configurações visuais
    this.scale = options.scale || 1.0
    
    // Configurações de física
    this.physics = {
      rigidBody: null,
      collider: null,
      radius: options.physicsRadius || 0.25,
      height: options.physicsHeight || 1.0
    }
    this.isGrounded = false
    
    // Vetores auxiliares (evitar criar novos a cada frame)
    this._toTarget = new THREE.Vector3()
    this._forward = new THREE.Vector3()
    
    // Debug visual
    this.debugMesh = null
    this.showDebug = options.showDebug || false
    
    // Loader
    this.loader = new GLTFLoader()
    
    // Flag de carregamento
    this.isLoaded = false
    
    // Gerar pontos de patrulha
    this.generatePatrolPoints()
  }
  
  /**
   * Gera pontos de patrulha ao redor da posição inicial
   */
  generatePatrolPoints() {
    const numPoints = 4
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2
      const point = new THREE.Vector3(
        this.spawnPosition.x + Math.cos(angle) * this.patrolRadius * 0.7,
        this.spawnPosition.y,
        this.spawnPosition.z + Math.sin(angle) * this.patrolRadius * 0.7
      )
      this.patrolPoints.push(point)
    }
  }
  
  /**
   * Define o alvo (player) para a IA
   */
  setTarget(target) {
    this.ai.target = target
  }
  
  /**
   * Carrega o modelo do NPC
   */
  async load(modelPath) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        modelPath,
        (gltf) => {
          this.model = gltf.scene
          this.model.name = `Model_${this.id}`
          
          // Configurar escala
          this.model.scale.setScalar(this.scale)
          
          // Habilitar sombras em todos os meshes
          this.model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true
              child.receiveShadow = true
            }
          })
          
          // Adicionar modelo ao grupo
          this.group.add(this.model)
          
          // Configurar posição inicial
          this.group.position.copy(this.spawnPosition)
          this.patrolCenter.copy(this.spawnPosition)
          
          // Criar corpo físico
          this.createPhysicsBody()
          
          // Criar debug visual se habilitado
          if (this.showDebug) {
            this.createDebugVisuals()
          }
          
          // Configurar animações se existirem
          if (gltf.animations && gltf.animations.length > 0) {
            this.setupAnimations(gltf.animations)
          }
          
          this.isLoaded = true
          this.state = NPCState.PATROL
          
          resolve(this)
        },
        (progress) => {},
        (error) => {
          reject(error)
        }
      )
    })
  }
  
  /**
   * Cria visuais de debug (cone de visão)
   */
  createDebugVisuals() {
    // Cone de visão
    const coneGeometry = new THREE.ConeGeometry(
      Math.tan(this.ai.fovAngle / 2) * this.ai.viewDistance,
      this.ai.viewDistance,
      16,
      1,
      true
    )
    const coneMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    })
    this.debugMesh = new THREE.Mesh(coneGeometry, coneMaterial)
    this.debugMesh.rotation.x = Math.PI / 2
    this.debugMesh.position.z = this.ai.viewDistance / 2
    this.group.add(this.debugMesh)
  }
  
  /**
   * Cria o corpo físico do NPC
   */
  createPhysicsBody() {
    if (!physicsWorld.world) {
      console.warn('⚠️ Mundo físico não inicializado')
      return
    }
    
    const physics = physicsWorld.createNPCBody(
      this.spawnPosition,
      this.physics.radius,
      this.physics.height
    )
    
    this.physics.rigidBody = physics.rigidBody
    this.physics.collider = physics.collider
  }
  
  /**
   * Configura as animações do modelo
   */
  setupAnimations(animations) {
    this.mixer = new THREE.AnimationMixer(this.model)
    
    animations.forEach((clip) => {
      const action = this.mixer.clipAction(clip)
      this.animations[clip.name] = action
    })
    
    // Iniciar com animação idle ou walk
    const walkAnim = this.findAnimation(['walk', 'walking', 'run', 'running'])
    const idleAnim = this.findAnimation(['idle', 'stand', 'standing'])
    
    if (walkAnim) {
      this.playAnimation(walkAnim)
    } else if (idleAnim) {
      this.playAnimation(idleAnim)
    } else if (Object.keys(this.animations).length > 0) {
      this.playAnimation(Object.keys(this.animations)[0])
    }
  }
  
  /**
   * Encontra uma animação por nome parcial
   */
  findAnimation(keywords) {
    for (const name of Object.keys(this.animations)) {
      const lowerName = name.toLowerCase()
      for (const keyword of keywords) {
        if (lowerName.includes(keyword)) {
          return name
        }
      }
    }
    return null
  }
  
  /**
   * Toca uma animação específica
   */
  playAnimation(name, options = {}) {
    const action = this.animations[name]
    if (!action) return
    
    const fadeTime = options.fadeTime || 0.3
    const loop = options.loop !== undefined ? options.loop : true
    
    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.fadeOut(fadeTime)
    }
    
    action.reset()
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce)
    action.clampWhenFinished = !loop
    action.fadeIn(fadeTime)
    action.play()
    
    this.currentAction = action
  }
  
  // ========== SISTEMA DE IA ==========
  
  /**
   * Verifica se o NPC pode ver o alvo (cone de visão)
   */
  canSeeTarget() {
    if (!this.ai.target) return false
    
    const targetPos = this.getTargetPosition()
    if (!targetPos) return false
    
    // Vetor do NPC para o alvo
    this._toTarget.subVectors(targetPos, this.group.position)
    const distance = this._toTarget.length()
    
    // Verificar distância máxima
    if (distance > this.ai.viewDistance) return false
    
    // Normalizar para comparar ângulo
    this._toTarget.normalize()
    
    // Direção que o NPC está olhando
    this._forward.set(0, 0, 1).applyQuaternion(this.group.quaternion)
    this._forward.y = 0
    this._forward.normalize()
    
    // Calcular ângulo entre direção e alvo
    const dot = this._forward.dot(this._toTarget)
    const angle = Math.acos(Math.min(Math.max(dot, -1), 1))
    
    // Verificar se está dentro do cone de visão
    if (angle > this.ai.fovAngle / 2) return false
    
    return true
  }
  
  /**
   * Obtém a posição do alvo
   */
  getTargetPosition() {
    if (!this.ai.target) return null
    
    if (this.ai.target.position) {
      return this.ai.target.position
    }
    if (this.ai.target instanceof THREE.Vector3) {
      return this.ai.target
    }
    return null
  }
  
  /**
   * Calcula distância até o alvo
   */
  getDistanceToTarget() {
    const targetPos = this.getTargetPosition()
    if (!targetPos) return Infinity
    
    return this.group.position.distanceTo(targetPos)
  }
  
  /**
   * Muda o estado da IA
   */
  changeState(newState) {
    if (this.state === newState) return
    
    this.previousState = this.state
    this.state = newState
    
    this.onStateChange(this.previousState, newState)
  }
  
  /**
   * Callback quando o estado muda
   */
  onStateChange(oldState, newState) {
    // Mudar cor do debug baseado no estado
    if (this.debugMesh) {
      const colors = {
        [NPCState.PATROL]: 0x00ff00,
        [NPCState.ALERT]: 0xffff00,
        [NPCState.CHASE]: 0xff8800,
        [NPCState.ATTACK]: 0xff0000,
        [NPCState.DEAD]: 0x666666
      }
      this.debugMesh.material.color.setHex(colors[newState] || 0xffffff)
    }
    
    // Mudar animação baseado no estado
    switch (newState) {
      case NPCState.PATROL:
        const walkAnim = this.findAnimation(['walk', 'walking'])
        if (walkAnim) this.playAnimation(walkAnim)
        break
      case NPCState.ALERT:
        const idleAnim = this.findAnimation(['idle', 'stand'])
        if (idleAnim) this.playAnimation(idleAnim)
        break
      case NPCState.CHASE:
        const runAnim = this.findAnimation(['run', 'running', 'walk'])
        if (runAnim) this.playAnimation(runAnim)
        break
      case NPCState.ATTACK:
        const attackAnim = this.findAnimation(['attack', 'hit', 'punch'])
        if (attackAnim) this.playAnimation(attackAnim)
        break
    }
  }
  
  /**
   * Atualiza o NPC (chamado a cada frame)
   */
  update(delta) {
    if (!this.isLoaded || !this.isAlive) return
    
    // Atualizar animações
    if (this.mixer) {
      this.mixer.update(delta)
    }
    
    // Atualizar cooldowns
    if (this.ai.attackCooldown > 0) {
      this.ai.attackCooldown -= delta
    }
    
    // Verificar visão do alvo
    this.ai.canSeeTarget = this.canSeeTarget()
    
    // Máquina de estados
    switch (this.state) {
      case NPCState.IDLE:
        this.updateIdle(delta)
        break
      case NPCState.PATROL:
        this.updatePatrol(delta)
        break
      case NPCState.ALERT:
        this.updateAlert(delta)
        break
      case NPCState.CHASE:
        this.updateChase(delta)
        break
      case NPCState.ATTACK:
        this.updateAttack(delta)
        break
      case NPCState.DEAD:
        break
    }
  }
  
  /**
   * Estado: IDLE
   */
  updateIdle(delta) {
    if (this.ai.canSeeTarget) {
      this.changeState(NPCState.ALERT)
      return
    }
    
    this.changeDirectionTimer += delta
    if (this.changeDirectionTimer >= 2.0) {
      this.changeDirectionTimer = 0
      this.changeState(NPCState.PATROL)
    }
  }
  
  /**
   * Estado: PATROL
   */
  updatePatrol(delta) {
    if (this.ai.canSeeTarget) {
      this.ai.lastKnownTargetPos.copy(this.getTargetPosition())
      this.changeState(NPCState.ALERT)
      return
    }
    
    if (this.patrolPoints.length > 0) {
      const targetPoint = this.patrolPoints[this.currentPatrolIndex]
      this.moveTowards(targetPoint, this.patrolSpeed, delta)
      
      const dist = this.group.position.distanceTo(targetPoint)
      if (dist < this.ai.waypointReachedDistance) {
        this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length
      }
    } else {
      this.updateRandomPatrol(delta)
    }
  }
  
  /**
   * Patrulha aleatória
   */
  updateRandomPatrol(delta) {
    this.changeDirectionTimer += delta
    
    if (this.changeDirectionTimer >= this.changeDirectionInterval) {
      this.changeDirectionTimer = 0
      this.pickNewDirection()
    }
    
    this.direction.lerp(this.targetDirection, this.rotationSpeed * delta)
    this.direction.normalize()
    
    this.moveInDirection(this.direction, this.patrolSpeed, delta)
    
    const distFromCenter = this.group.position.distanceTo(this.patrolCenter)
    if (distFromCenter > this.patrolRadius) {
      this.targetDirection.subVectors(this.patrolCenter, this.group.position)
      this.targetDirection.y = 0
      this.targetDirection.normalize()
    }
  }
  
  /**
   * Estado: ALERT
   */
  updateAlert(delta) {
    this.lookAt(this.ai.lastKnownTargetPos)
    
    this.ai.alertTimer += delta
    
    if (this.ai.canSeeTarget) {
      this.ai.lastKnownTargetPos.copy(this.getTargetPosition())
      
      if (this.ai.alertTimer >= this.ai.alertDuration) {
        this.ai.alertTimer = 0
        this.changeState(NPCState.CHASE)
      }
    } else {
      if (this.ai.alertTimer >= this.ai.alertDuration * 2) {
        this.ai.alertTimer = 0
        this.changeState(NPCState.PATROL)
      }
    }
  }
  
  /**
   * Estado: CHASE
   */
  updateChase(delta) {
    const distance = this.getDistanceToTarget()
    
    if (!this.ai.canSeeTarget) {
      this.moveTowards(this.ai.lastKnownTargetPos, this.chaseSpeed, delta)
      
      const distToLastKnown = this.group.position.distanceTo(this.ai.lastKnownTargetPos)
      if (distToLastKnown < 1.0) {
        this.changeState(NPCState.PATROL)
      }
      return
    }
    
    this.ai.lastKnownTargetPos.copy(this.getTargetPosition())
    
    if (distance <= this.ai.attackDistance) {
      this.changeState(NPCState.ATTACK)
      return
    }
    
    if (distance > this.ai.loseTargetDistance) {
      this.changeState(NPCState.PATROL)
      return
    }
    
    this.moveTowards(this.getTargetPosition(), this.chaseSpeed, delta)
  }
  
  /**
   * Estado: ATTACK
   */
  updateAttack(delta) {
    const distance = this.getDistanceToTarget()
    
    const targetPos = this.getTargetPosition()
    if (targetPos) {
      this.lookAt(targetPos)
    }
    
    if (distance > this.ai.attackDistance * 1.5) {
      this.changeState(NPCState.CHASE)
      return
    }
    
    if (this.ai.attackCooldown <= 0) {
      this.performAttack()
      this.ai.attackCooldown = 1.0 / this.ai.attackRate
    }
  }
  
  /**
   * Executa um ataque
   */
  performAttack() {
    const attackAnim = this.findAnimation(['attack', 'hit', 'punch'])
    if (attackAnim) {
      this.playAnimation(attackAnim, { loop: false })
    }
    
    if (this.ai.target && typeof this.ai.target.takeDamage === 'function') {
      this.ai.target.takeDamage(this.ai.attackDamage)
    }
    
    window.dispatchEvent(new CustomEvent('npc-attack', {
      detail: {
        npc: this,
        damage: this.ai.attackDamage,
        target: this.ai.target
      }
    }))
  }
  
  // ========== MOVIMENTO ==========
  
  /**
   * Move em direção a um ponto
   */
  moveTowards(targetPos, speed, delta) {
    if (!targetPos) return
    
    this.targetDirection.subVectors(targetPos, this.group.position)
    this.targetDirection.y = 0
    
    if (this.targetDirection.lengthSq() < 0.01) return
    
    this.targetDirection.normalize()
    
    this.direction.lerp(this.targetDirection, this.rotationSpeed * delta)
    this.direction.normalize()
    
    this.moveInDirection(this.direction, speed, delta)
  }
  
  /**
   * Move na direção especificada
   */
  moveInDirection(direction, speed, delta) {
    this.velocity.copy(direction).multiplyScalar(speed * delta)
    
    const newPosition = this.group.position.clone().add(this.velocity)
    
    if (physicsWorld.world) {
      const groundCheck = physicsWorld.npcGroundCheck(newPosition)
      this.isGrounded = groundCheck.grounded
      
      if (this.isGrounded) {
        newPosition.y = groundCheck.groundY + 0.1
      }
    }
    
    this.group.position.copy(newPosition)
    
    if (this.physics.rigidBody) {
      physicsWorld.moveNPCBody(this.physics.rigidBody, {
        x: newPosition.x,
        y: newPosition.y,
        z: newPosition.z
      })
    }
    
    if (direction.lengthSq() > 0.001) {
      const angle = Math.atan2(direction.x, direction.z)
      this.group.rotation.y = angle
    }
  }
  
  /**
   * Olha para uma posição
   */
  lookAt(position) {
    if (!position) return
    
    const direction = new THREE.Vector3()
    direction.subVectors(position, this.group.position)
    direction.y = 0
    
    if (direction.lengthSq() > 0.001) {
      const angle = Math.atan2(direction.x, direction.z)
      const currentAngle = this.group.rotation.y
      const diff = angle - currentAngle
      this.group.rotation.y += diff * 0.1
    }
  }
  
  /**
   * Escolhe uma nova direção aleatória
   */
  pickNewDirection() {
    const angle = Math.random() * Math.PI * 2
    this.targetDirection.set(
      Math.sin(angle),
      0,
      Math.cos(angle)
    )
  }
  
  // ========== DANO E MORTE ==========
  
  /**
   * Aplica dano ao NPC
   */
  takeDamage(amount) {
    if (!this.isAlive) return
    
    this.health -= amount
    
    if (this.state === NPCState.PATROL || this.state === NPCState.IDLE) {
      if (this.ai.target) {
        this.ai.lastKnownTargetPos.copy(this.getTargetPosition())
      }
      this.changeState(NPCState.CHASE)
    }
    
    if (this.health <= 0) {
      this.die()
    }
  }
  
  /**
   * Mata o NPC
   */
  die() {
    if (!this.isAlive) return
    
    this.isAlive = false
    this.health = 0
    this.changeState(NPCState.DEAD)
    
    this.applyDeathEffect()
    
    const deathAnim = this.findAnimation(['death', 'die', 'dead', 'fall'])
    if (deathAnim) {
      this.playAnimation(deathAnim, { loop: false })
    }
    
    window.dispatchEvent(new CustomEvent('npc-death', {
      detail: { npc: this }
    }))
  }
  
  /**
   * Aplica efeito visual de morte
   */
  applyDeathEffect() {
    const duration = 1.0
    let elapsed = 0
    const startScale = this.group.scale.x
    
    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone()
        child.material.transparent = true
        child.material.color.setHex(0xff0000)
      }
    })
    
    const animateDeath = () => {
      elapsed += 0.016
      const t = Math.min(elapsed / duration, 1)
      
      const scale = startScale * (1 - t)
      this.group.scale.setScalar(Math.max(scale, 0.01))
      
      this.group.position.y += 0.02
      this.group.rotation.y += 0.1
      
      this.model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.opacity = 1 - t
        }
      })
      
      if (t < 1) {
        requestAnimationFrame(animateDeath)
      } else {
        this.group.visible = false
      }
    }
    
    animateDeath()
  }
  
  /**
   * Revive o NPC
   */
  revive() {
    this.isAlive = true
    this.health = this.maxHealth
    this.changeState(NPCState.PATROL)
    
    this.group.visible = true
    this.group.scale.setScalar(this.scale)
    this.group.position.copy(this.spawnPosition)
    this.group.rotation.set(0, 0, 0)
    
    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.opacity = 1
        child.material.color.setHex(0xffffff)
      }
    })
    
    const walkAnim = this.findAnimation(['walk', 'walking', 'run', 'running', 'idle'])
    if (walkAnim) {
      this.playAnimation(walkAnim)
    }
  }
  
  // ========== UTILITÁRIOS ==========
  
  getPosition() {
    return this.group.position.clone()
  }
  
  setPosition(x, y, z) {
    if (x instanceof THREE.Vector3) {
      this.group.position.copy(x)
    } else {
      this.group.position.set(x, y, z)
    }
  }
  
  dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction()
    }
    
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose()
        if (child.material.map) child.material.map.dispose()
        child.material.dispose()
      }
    })
  }
}
