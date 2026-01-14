import * as THREE from 'three'
import { physicsWorld } from '../physics/physics.js'

class PhysicsDebug {
  constructor(scene) {
    this.scene = scene
    this.debugObjects = []
    this.enabled = false
    this.material = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, 
      transparent: true, 
      opacity: 0.3,
      wireframe: true 
    })
  }

  enable() {
    this.enabled = true
    this.createDebugObjects()
  }

  disable() {
    this.enabled = false
    this.clearDebugObjects()
  }

  toggle() {
    if (this.enabled) {
      this.disable()
    } else {
      this.enable()
    }
  }

  createDebugObjects() {
    if (!physicsWorld.world) return

    // Limpar objetos de debug existentes
    this.clearDebugObjects()

    // Criar representações visuais dos colliders
    physicsWorld.colliders.forEach((collider, mesh) => {
      const debugMesh = this.createDebugMesh(collider)
      if (debugMesh) {
        this.scene.add(debugMesh)
        this.debugObjects.push(debugMesh)
      }
    })
  }

  createDebugMesh(collider) {
    const shape = collider.shape
    let geometry = null

    switch (shape.type) {
      case 'Cuboid':
        const halfExtents = shape.halfExtents
        geometry = new THREE.BoxGeometry(
          halfExtents.x * 2,
          halfExtents.y * 2,
          halfExtents.z * 2
        )
        break
        
      case 'Ball':
        const radius = shape.radius
        geometry = new THREE.SphereGeometry(radius, 8, 6)
        break
        
      case 'Capsule':
        const capsuleRadius = shape.radius
        const capsuleHeight = shape.halfHeight * 2
        geometry = new THREE.CapsuleGeometry(capsuleRadius, capsuleHeight, 4, 8)
        break
    }

    if (geometry) {
      const debugMesh = new THREE.Mesh(geometry, this.material)
      
      // Posicionar o debug mesh
      const translation = collider.translation()
      const rotation = collider.rotation()
      
      debugMesh.position.set(translation.x, translation.y, translation.z)
      debugMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      
      return debugMesh
    }

    return null
  }

  clearDebugObjects() {
    this.debugObjects.forEach(obj => {
      this.scene.remove(obj)
      obj.geometry?.dispose()
    })
    this.debugObjects = []
  }

  update() {
    if (!this.enabled) return

    // Atualizar posições dos objetos de debug se necessário
    // (Para objetos dinâmicos)
  }
}

let physicsDebug = null

export function createPhysicsDebug(scene) {
  physicsDebug = new PhysicsDebug(scene)
  
  // Adicionar controle por teclado (F1 para toggle)
  window.addEventListener('keydown', (event) => {
    if (event.code === 'F1') {
      event.preventDefault()
      physicsDebug.toggle()
      console.log('Physics debug:', physicsDebug.enabled ? 'ON' : 'OFF')
    }
  })
  
  return physicsDebug
}

export function getPhysicsDebug() {
  return physicsDebug
}
