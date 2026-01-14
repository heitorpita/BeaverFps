import * as THREE from 'three'
import { physicsWorld } from '../physics/physics.js'
import { Input } from './controls.js'
import { scene } from '../core/scene.js'
import { camera } from '../core/camera.js'

export const player = new THREE.Object3D()

// Propriedades do player
const playerConfig = {
  speed: 5.0,
  jumpForce: 4.5,  // Aumentei para garantir que seja visível
  radius: 0.3,
  height: 1.4,  // Altura do collider físico (deve corresponder à câmera)
  maxSpeed: 10.0
}

// Variáveis de controle
let playerRigidBody = null
let playerCollider = null
let isGrounded = false
let velocity = new THREE.Vector3()

// Vetores auxiliares
const forward = new THREE.Vector3()
const right = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)
const rayOrigin = new THREE.Vector3()
const rayDirection = new THREE.Vector3(0, -1, 0)

export async function initPlayer() {
  // Inicialmente posicionar em uma posição temporária
  player.position.set(0, 2, 0)
  
  // Criar corpo físico do player
  const playerPhysics = physicsWorld.createPlayerBody(
    player.position,
    playerConfig.radius,
    playerConfig.height
  )
  
  playerRigidBody = playerPhysics.rigidBody
  playerCollider = playerPhysics.collider
  
  console.log('🧑 Player físico inicializado:', {
    position: playerRigidBody.translation(),
    mass: playerCollider.mass(),
    bodyType: playerRigidBody.bodyType()
  })
}

// Função para posicionar o player após o mundo ser carregado
export function positionPlayerAfterWorldLoad() {
  if (!playerRigidBody) {
    console.warn('⚠️ Player não inicializado ainda')
    return
  }
  
  // Posição simples e segura
  setPlayerPosition(0, 5, 0) // 5 metros acima da origem
  
  console.log('🎯 Player posicionado após carregamento do mundo')
}

export function updatePlayer(delta) {
  if (!playerRigidBody) return
  
  // Obter posição atual do rigid body
  const currentPos = playerRigidBody.translation()
  const currentVel = playerRigidBody.linvel()
  
  // Atualizar posição do objeto Three.js
  player.position.set(currentPos.x, currentPos.y, currentPos.z)
  
  // Verificar se está no chão
  checkGrounded()
  
  // DEBUG: Mostrar quando Space é pressionado
  if (Input.keys.Space || Input.keys[' ']) {
    console.log('🎮 SPACE DETECTADO! Keys:', {
      Space: Input.keys.Space,
      SpaceChar: Input.keys[' '],
      allKeys: Object.keys(Input.keys).filter(k => Input.keys[k])
    })
  }
  
  // Calcular movimento baseado no input
  const moveVector = new THREE.Vector3()
  
  // Obter direção da câmera
  player.getWorldDirection(forward)
  forward.y = 0
  forward.normalize()
  right.crossVectors(forward, up)
  
  // Input de movimento
  if (Input.keys.KeyS) moveVector.addScaledVector(forward, 1)
  if (Input.keys.KeyW) moveVector.addScaledVector(forward, -1)
  if (Input.keys.KeyA) moveVector.addScaledVector(right, 1)
  if (Input.keys.KeyD) moveVector.addScaledVector(right, -1)
  
  // Normalizar para movimento diagonal consistente
  if (moveVector.length() > 0) {
    moveVector.normalize()
    moveVector.multiplyScalar(playerConfig.speed)
  }
  
  // Para corpos dinâmicos, aplicamos impulsos em vez de definir velocidade diretamente
  // Manter a velocidade Y (gravidade) mas controlar X e Z
  const targetVelocity = {
    x: moveVector.x,
    y: currentVel.y, // Manter velocidade Y para gravidade
    z: moveVector.z
  }
  
  // PULO SUPER SIMPLES - SEM CONDIÇÕES RIGOROSAS
  if (Input.keys.Space || Input.keys[' ']) {
    targetVelocity.y = playerConfig.jumpForce
    console.log('🦘 PULO! Space detectado!')
  }
  
  // Debug: Tecla G para testar gravidade (teleportar para cima)
  if (Input.keys.KeyG) {
    setPlayerPosition(player.position.x, player.position.y + 10, player.position.z)
    console.log('🚀 Player teleportado para cima para testar gravidade')
  }
  
  // Limitar velocidade máxima horizontal
  const horizontalSpeed = Math.sqrt(targetVelocity.x * targetVelocity.x + targetVelocity.z * targetVelocity.z)
  if (horizontalSpeed > playerConfig.maxSpeed) {
    const scale = playerConfig.maxSpeed / horizontalSpeed
    targetVelocity.x *= scale
    targetVelocity.z *= scale
  }
  
  // Aplicar velocidade
  playerRigidBody.setLinvel(targetVelocity, true)
}

function checkGrounded() {
  if (!physicsWorld.world) {
    isGrounded = false
    return
  }
  
  // Raycast para baixo para verificar se está no chão
  const playerPos = playerRigidBody.translation()
  rayOrigin.set(playerPos.x, playerPos.y, playerPos.z)
  
  const hit = physicsWorld.castRay(
    rayOrigin,
    rayDirection,
    playerConfig.height / 2 + 0.5
  )
  
  isGrounded = hit !== null && hit.distance <= (playerConfig.height / 2 + 0.3)
}

export function getPlayerPosition() {
  return player.position.clone()
}

export function setPlayerPosition(x, y, z) {
  player.position.set(x, y, z)
  if (playerRigidBody) {
    playerRigidBody.setTranslation({ x, y, z }, true)
    playerRigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }
}

export function getIsGrounded() {
  return isGrounded
}

// Função para ajustar altura do player (câmera + física)
export function setPlayerHeight(newHeight) {
  playerConfig.height = newHeight
  camera.position.y = newHeight
  
  if (playerRigidBody && playerCollider) {
    // Recriar collider com nova altura
    console.log(`📏 Altura do player alterada para ${newHeight}m`)
    console.log('⚠️ Reinicie o jogo para aplicar a nova altura física completamente')
  }
  
  console.log(`📏 Altura da câmera ajustada para ${newHeight}m`)
}

// Função para debug - verificar se a física está funcionando
export function debugPhysics() {
  if (!playerRigidBody) {
    console.log('❌ Player rigid body não inicializado')
    return
  }
  
  const pos = playerRigidBody.translation()
  const vel = playerRigidBody.linvel()
  
  // Teste de raycast manual
  const testRayOrigin = { x: pos.x, y: pos.y, z: pos.z }
  const testRayDir = { x: 0, y: -1, z: 0 }
  const hit = physicsWorld.castRay(testRayOrigin, testRayDir, 5)
  
  console.log('🔧 Debug Física Player:', {
    position: { x: pos.x.toFixed(2), y: pos.y.toFixed(2), z: pos.z.toFixed(2) },
    velocity: { x: vel.x.toFixed(2), y: vel.y.toFixed(2), z: vel.z.toFixed(2) },
    isGrounded: isGrounded,
    bodyType: playerRigidBody.bodyType(),
    raycastHit: hit ? { distance: hit.distance.toFixed(2), point: hit.point } : 'NO HIT',
    worldColliders: physicsWorld.colliders.size,
    jumpForce: playerConfig.jumpForce,
    canJump: isGrounded && (Input.keys.Space || Input.keys[' ']),
    spacePressed: Input.keys.Space || Input.keys[' '] || false
  })
  
  // Informações do mundo físico
  console.log('🌍 Debug Mundo Físico:', {
    rigidBodies: physicsWorld.rigidBodies.size,
    colliders: physicsWorld.colliders.size,
    worldExists: !!physicsWorld.world
  })
}

// Expor função globalmente para teste no console
window.debugPlayerPhysics = debugPhysics

// Função para testar pulo manual
function testJump() {
  if (!playerRigidBody) {
    console.log('❌ Player não inicializado')
    return
  }
  
  const currentVel = playerRigidBody.linvel()
  playerRigidBody.setLinvel({
    x: currentVel.x,
    y: playerConfig.jumpForce,
    z: currentVel.z
  }, true)
  
  console.log('🦘 PULO FORÇADO aplicado!')
}

// Função para ver estado das teclas
function showKeys() {
  console.log('🎹 Estado das teclas:', {
    Space: Input.keys.Space,
    SpaceChar: Input.keys[' '],
    allPressed: Object.keys(Input.keys).filter(k => Input.keys[k])
  })
}

// Expor globalmente para testes
window.testJump = testJump
window.showKeys = showKeys

// Função para ajustar força do pulo em tempo real
function setJumpForce(newForce) {
  playerConfig.jumpForce = newForce
  console.log(`🦘 Força do pulo alterada para: ${newForce}`)
  console.log('💡 Teste pressionando Space ou execute: testJump()')
}

// Presets de pulo
function jumpPresets() {
  console.log('🎮 PRESETS DE PULO:')
  console.log('setJumpForce(5)   // Pulo baixo')
  console.log('setJumpForce(10)  // Pulo normal') 
  console.log('setJumpForce(15)  // Pulo alto')
  console.log('setJumpForce(20)  // Super pulo')
  console.log('setJumpForce(30)  // Mega pulo')
}

// Expor globalmente
window.setJumpForce = setJumpForce
window.jumpPresets = jumpPresets

// Função para criar um chão visual de teste
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

// Expor função globalmente
window.createVisualGround = createVisualGround

// Função de debug para listar todos os objetos do GLB e seu status de física
export function debugWorldObjects() {
  if (!physicsWorld.world) {
    console.log('❌ Mundo físico não inicializado')
    return
  }
  
  const objects = []
  
  // Encontrar o mundo carregado no scene
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

// Expor globalmente
window.debugWorldObjects = debugWorldObjects

// Função para forçar pulo (para teste)
export function forceJump() {
  if (!playerRigidBody) {
    console.log('❌ Player não inicializado')
    return
  }
  
  const currentVel = playerRigidBody.linvel()
  const jumpVelocity = {
    x: currentVel.x,
    y: playerConfig.jumpForce,
    z: currentVel.z
  }
  
  playerRigidBody.setLinvel(jumpVelocity, true)
  console.log('🦘 PULO FORÇADO! Velocidade aplicada:', jumpVelocity)
}

// Expor globalmente para testes
window.forceJump = forceJump
window.testJump = forceJump
window.setPlayerHeight = setPlayerHeight

// Função para testar todas as condições de pulo
export function testJumpConditions() {
  const now = Date.now()
  const jumpCooldown = 300
  
  console.log('🧪 TESTE DE CONDIÇÕES DE PULO:')
  console.log('1. Space pressionado:', Input.keys.Space || Input.keys[' '])
  console.log('2. canJump:', canJump)
  console.log('3. Tempo desde último pulo:', now - lastJumpTime, 'ms (precisa > 300ms)')
  console.log('4. isGrounded:', isGrounded)
  console.log('5. Player position:', playerRigidBody?.translation())
  console.log('6. Player velocity:', playerRigidBody?.linvel())
  
  const allConditions = (Input.keys.Space || Input.keys[' ']) && canJump && (now - lastJumpTime > jumpCooldown) && isGrounded
  console.log('🎯 RESULTADO: Pulo deveria funcionar?', allConditions)
  
  return allConditions
}

// Função para resetar sistema de pulo
export function resetJumpSystem() {
  canJump = true
  lastJumpTime = 0
  console.log('🔄 Sistema de pulo resetado!')
}

// Expor globalmente
window.testJumpConditions = testJumpConditions
window.resetJumpSystem = resetJumpSystem
