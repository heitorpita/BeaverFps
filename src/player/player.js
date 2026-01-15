import { Player } from './PlayerClass.js'

// Instância global do player
let playerInstance = null

/**
 * Obtém a instância do player (singleton)
 */
export function getPlayer() {
  if (!playerInstance) {
    playerInstance = new Player()
  }
  return playerInstance
}

/**
 * Obtém a instância real da classe Player (para acesso aos métodos da classe)
 */
export function getPlayerInstance() {
  return getPlayer()
}

// Compatibilidade com código existente
export const player = new Proxy({}, {
  get(target, prop) {
    const playerInstance = getPlayer()
    
    // Mapear propriedades para manter compatibilidade
    if (prop === 'position') return playerInstance.object3D.position
    if (prop === 'rotation') return playerInstance.object3D.rotation
    if (prop === 'add') return playerInstance.object3D.add.bind(playerInstance.object3D)
    if (prop === 'getWorldDirection') return playerInstance.object3D.getWorldDirection.bind(playerInstance.object3D)
    
    // Outras propriedades
    return playerInstance.object3D[prop]
  },
  set(target, prop, value) {
    const playerInstance = getPlayer()
    playerInstance.object3D[prop] = value
    return true
  }
})

/**
 * Inicializa o player
 */
export async function initPlayer() {
  const playerInstance = getPlayer()
  await playerInstance.init()
  console.log('✅ Player inicializado via classe')
}

/**
 * Atualiza o player
 */
export function updatePlayer(delta) {
  const playerInstance = getPlayer()
  playerInstance.update(delta)
}

/**
 * Posiciona o player após carregamento do mundo
 */
export function positionPlayerAfterWorldLoad() {
  const playerInstance = getPlayer()
  playerInstance.positionAfterWorldLoad()
}

/**
 * Processa movimento do mouse
 */
export function processPlayerMouseMovement(deltaX, deltaY) {
  const playerInstance = getPlayer()
  playerInstance.processMouseMovement(deltaX, deltaY)
}

/**
 * Obtém posição do player
 */
export function getPlayerPosition() {
  const playerInstance = getPlayer()
  return playerInstance.getPosition()
}

/**
 * Define posição do player
 */
export function setPlayerPosition(x, y, z) {
  const playerInstance = getPlayer()
  playerInstance.setPosition(x, y, z)
}

/**
 * Verifica se o player está no chão
 */
export function getIsGrounded() {
  const playerInstance = getPlayer()
  return playerInstance.isGrounded()
}

/**
 * Configura FOV
 */
export function setPlayerFOV(fov) {
  const playerInstance = getPlayer()
  playerInstance.setFOV(fov)
}

/**
 * Configura velocidade de movimento
 */
export function setPlayerMovementSpeed(speed) {
  const playerInstance = getPlayer()
  playerInstance.setMovementSpeed(speed)
}

/**
 * Configura força do pulo
 */
export function setPlayerJumpForce(force) {
  const playerInstance = getPlayer()
  playerInstance.setJumpForce(force)
}

/**
 * Configura sensibilidade do mouse
 */
export function setPlayerMouseSensitivity(sensitivity) {
  const playerInstance = getPlayer()
  playerInstance.setMouseSensitivity(sensitivity)
}

/**
 * Debug do player
 */
export function debugPlayerPhysics() {
  const playerInstance = getPlayer()
  const debugInfo = playerInstance.getDebugInfo()
  console.log('🔧 Debug Player Physics:', debugInfo)
  return debugInfo
}

/**
 * Força um pulo (debug)
 */
export function forceJump() {
  const playerInstance = getPlayer()
  playerInstance.forceJump()
}

/**
 * Testa condições de pulo
 */
export function testJumpConditions() {
  const playerInstance = getPlayer()
  return playerInstance.testJumpConditions()
}

/**
 * Reseta sistema de pulo
 */
export function resetJumpSystem() {
  const playerInstance = getPlayer()
  playerInstance.resetJumpSystem()
}

/**
 * Cria chão visual para teste (mantido para compatibilidade)
 */
import * as THREE from 'three'
export function createVisualGround(scene) {
  const groundGeometry = new THREE.BoxGeometry(100, 1, 100)
  const groundMaterial = new THREE.MeshLambertMaterial({ 
    color: 0x444444, 
    transparent: true, 
    opacity: 0.8 
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.position.set(0, -1, 0)
  ground.receiveShadow = true
  scene.add(ground)
  
  console.log('👁️ Chão visual de teste criado')
  return ground
}

/**
 * Debug de objetos do mundo (mantido para compatibilidade)
 */
import { physicsWorld } from '../physics/physics.js'
import { scene } from '../core/scene.js'

export function debugWorldObjects() {
  if (!physicsWorld.world) {
    console.log('❌ Mundo físico não inicializado')
    return
  }
  
  const objects = []
  
  scene.traverse((child) => {
    if (child.isMesh && child.parent.name !== 'Scene') {
      const hasPhysics = physicsWorld.rigidBodies.has(child)
      const shouldHavePhysics = physicsWorld.shouldObjectHavePhysics(child.name.toLowerCase())
      
      objects.push({
        name: child.name,
        position: child.position,
        hasPhysics: hasPhysics,
        shouldHavePhysics: shouldHavePhysics,
        status: hasPhysics ? '✅ HAS PHYSICS' : shouldHavePhysics ? '❌ MISSING PHYSICS' : '⏭️ NO PHYSICS NEEDED'
      })
    }
  })
  
  console.log('🌍 Debug World Objects:', objects)
  console.log(`📊 Total: ${objects.length} objects, ${objects.filter(o => o.hasPhysics).length} with physics`)
  
  return objects
}

// Manter funções globais para compatibilidade
window.createVisualGround = createVisualGround
window.debugWorldObjects = debugWorldObjects