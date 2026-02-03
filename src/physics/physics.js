import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

class PhysicsWorld {
  constructor() {
    this.world = null
    this.eventQueue = null
    this.rigidBodies = new Map() // Mapear objetos Three.js para rigid bodies
    this.colliders = new Map()
  }

  async init() {
    // Inicializar Rapier
    await RAPIER.init()
    
    // Criar mundo com gravidade
    // Valores de exemplo:
    // -9.81 = Gravidade terrestre real
    // -5.0 = Gravidade mais fraca (pulos mais altos)
    // -20.0 = Gravidade mais forte (queda mais rápida)
    // 0.0 = Sem gravidade (flutuar no espaço)
    const gravity = { x: 0.0, y: -9.81, z: 0.0 }
    this.world = new RAPIER.World(gravity)
    
    // Event queue para detecção de colisões
    this.eventQueue = new RAPIER.EventQueue(true)
  }

  createRigidBody(bodyDesc, mesh) {
    const rigidBody = this.world.createRigidBody(bodyDesc)
    this.rigidBodies.set(mesh, rigidBody)
    return rigidBody
  }

  createCollider(colliderDesc, rigidBody, mesh = null) {
    const collider = this.world.createCollider(colliderDesc, rigidBody)
    if (mesh) {
      this.colliders.set(mesh, collider)
    }
    return collider
  }

  // Criar chão de teste básico
  createTestGround() {
    // Criar um chão invisível grande para testes
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(0, -1, 0) // 1 metro abaixo da origem
    
    const rigidBody = this.world.createRigidBody(rigidBodyDesc)
    
    // Chão grande de 100x100 metros
    const colliderDesc = RAPIER.ColliderDesc.cuboid(50, 0.5, 50)
      .setFriction(0.8)
      .setRestitution(0.0)
    
    this.world.createCollider(colliderDesc, rigidBody)
  }

  // Criar corpo físico para objetos estáticos (mundo/cenário)
  createStaticBody(mesh) {
    try {
      const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
        .setRotation(mesh.quaternion)
      
      const rigidBody = this.createRigidBody(rigidBodyDesc, mesh)
      
      // Criar collider baseado na geometria do mesh
      const geometry = mesh.geometry
      if (geometry && geometry.attributes.position) {
        let colliderDesc
        
        // Para geometrias simples
        if (geometry.type === 'BoxGeometry') {
          const box = geometry.parameters
          colliderDesc = RAPIER.ColliderDesc.cuboid(
            (box.width * mesh.scale.x) / 2, 
            (box.height * mesh.scale.y) / 2, 
            (box.depth * mesh.scale.z) / 2
          )
        } else {
          // Para geometrias complexas (GLTF), usar trimesh
          const vertices = geometry.attributes.position.array
          
          if (vertices && vertices.length > 0) {
            const indices = geometry.index ? geometry.index.array : null
            
            // Aplicar escala aos vértices
            const scaledVertices = new Float32Array(vertices.length)
            for (let i = 0; i < vertices.length; i += 3) {
              scaledVertices[i] = vertices[i] * mesh.scale.x
              scaledVertices[i + 1] = vertices[i + 1] * mesh.scale.y
              scaledVertices[i + 2] = vertices[i + 2] * mesh.scale.z
            }
            
            if (indices && indices.length > 0) {
              // Usar trimesh para geometrias complexas
              colliderDesc = RAPIER.ColliderDesc.trimesh(scaledVertices, indices)
            } else {
              // Fallback para convex hull se não houver índices
              try {
                colliderDesc = RAPIER.ColliderDesc.convexHull(scaledVertices)
              } catch (e) {
                console.warn(`Erro ao criar convex hull para ${mesh.name}, usando box padrão`, e)
                // Fallback para uma caixa simples baseada na bounding box
                geometry.computeBoundingBox()
                const box = geometry.boundingBox
                const sizeX = (box.max.x - box.min.x) * mesh.scale.x / 2
                const sizeY = (box.max.y - box.min.y) * mesh.scale.y / 2
                const sizeZ = (box.max.z - box.min.z) * mesh.scale.z / 2
                colliderDesc = RAPIER.ColliderDesc.cuboid(sizeX, sizeY, sizeZ)
              }
            }
          }
        }
        
        if (colliderDesc) {
          colliderDesc.setFriction(0.8)
          colliderDesc.setRestitution(0.0)
          
          this.createCollider(colliderDesc, rigidBody, mesh)
          return rigidBody
        }
      }
    } catch (error) {
      console.error(`Erro ao criar corpo estático para ${mesh.name}:`, error)
    }
    
    return null
  }

  // Criar corpo físico para NPC (cápsula como o player, mas com IA)
  createNPCBody(position, radius = 0.3, height = 1.4) {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x, position.y, position.z)
    
    const rigidBody = this.world.createRigidBody(rigidBodyDesc)
    
    // Collider em formato de cápsula
    const colliderDesc = RAPIER.ColliderDesc.capsule(height / 2, radius)
      .setFriction(0.5)
      .setRestitution(0.0)
    
    const collider = this.world.createCollider(colliderDesc, rigidBody)
    
    return { rigidBody, collider }
  }

  // Mover NPC com física (kinematic)
  moveNPCBody(rigidBody, newPosition) {
    if (rigidBody) {
      rigidBody.setNextKinematicTranslation(newPosition)
    }
  }

  // Raycast para NPC verificar chão
  npcGroundCheck(position, maxDistance = 2.0) {
    const origin = { x: position.x, y: position.y + 0.5, z: position.z }
    const direction = { x: 0, y: -1, z: 0 }
    
    const hit = this.castRay(origin, direction, maxDistance)
    
    if (hit) {
      return {
        grounded: hit.distance <= 1.0,
        groundY: hit.point.y
      }
    }
    
    return { grounded: false, groundY: position.y }
  }

  // Criar corpo físico dinâmico (player, objetos móveis)
  createDynamicBody(mesh, mass = 1.0) {
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setRotation(mesh.quaternion)
    
    const rigidBody = this.createRigidBody(rigidBodyDesc, mesh)
    
    // Criar collider
    const geometry = mesh.geometry
    let colliderDesc
    
    if (geometry.type === 'BoxGeometry') {
      const box = geometry.parameters
      colliderDesc = RAPIER.ColliderDesc.cuboid(
        box.width / 2, 
        box.height / 2, 
        box.depth / 2
      )
    } else if (geometry.type === 'SphereGeometry') {
      const sphere = geometry.parameters
      colliderDesc = RAPIER.ColliderDesc.ball(sphere.radius)
    } else {
      // Para geometrias complexas
      const vertices = geometry.attributes.position.array
      colliderDesc = RAPIER.ColliderDesc.convexHull(vertices)
    }
    
    if (colliderDesc) {
      colliderDesc.setMass(mass)
      colliderDesc.setRestitution(0.3) // Elasticidade
      colliderDesc.setFriction(0.5) // Atrito
      
      this.createCollider(colliderDesc, rigidBody, mesh)
    }
    
    return rigidBody
  }

  // Criar corpo físico para o player (cápsula)
  createPlayerBody(position, radius = 0.3, height = 1.6) {
    // Usar corpo dinâmico para ser afetado pela gravidade
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .lockRotations() // Player não rota com física
      .setLinearDamping(2.0) // Damping para controle mais suave
    
    const rigidBody = this.world.createRigidBody(rigidBodyDesc)
    
    // Collider em formato de cápsula
    const colliderDesc = RAPIER.ColliderDesc.capsule(height / 2, radius)
      .setMass(70.0) // 70kg
      .setFriction(0.8)
      .setRestitution(0.0)
    
    const collider = this.world.createCollider(colliderDesc, rigidBody)
    
    return { rigidBody, collider }
  }

  // Atualizar simulação
  step(deltaTime) {
    if (!this.world) return
    
    // Step da simulação com timestep fixo (mais estável)
    // Rapier recomenda timesteps fixos para estabilidade
    const fixedTimeStep = 1.0 / 60.0 // 60 FPS
    this.world.timestep = fixedTimeStep
    this.world.step(this.eventQueue)
    
    // Sincronizar objetos Three.js com rigid bodies
    this.rigidBodies.forEach((rigidBody, mesh) => {
      if (rigidBody.bodyType() === RAPIER.RigidBodyType.Dynamic) {
        const position = rigidBody.translation()
        const rotation = rigidBody.rotation()
        
        mesh.position.set(position.x, position.y, position.z)
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      }
    })
    
    // Processar eventos de colisão
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      // Aqui você pode implementar lógica de colisão
      if (started) {
        // console.log('Collision started between', handle1, 'and', handle2)
      }
    })
  }

  // Raycast para detecção de colisões
  castRay(origin, direction, maxDistance = 1000, solid = true) {
    if (!this.world) return null
    
    const ray = new RAPIER.Ray(origin, direction)
    const hit = this.world.castRay(ray, maxDistance, solid)
    
    if (hit) {
      return {
        distance: hit.toi,
        point: ray.pointAt(hit.toi),
        normal: hit.normal
      }
    }
    
    return null
  }

  // Cleanup
  destroy() {
    if (this.world) {
      this.world.free()
    }
    if (this.eventQueue) {
      this.eventQueue.free()
    }
  }

  // Função para alterar a gravidade dinamicamente
  setGravity(x = 0.0, y = -9.81, z = 0.0) {
    if (this.world) {
      this.world.gravity = { x, y, z }
    }
  }

  // Função para obter a gravidade atual
  getGravity() {
    if (this.world) {
      return this.world.gravity
    }
    return { x: 0, y: 0, z: 0 }
  }

  // Função específica para criar física a partir de um modelo GLB carregado
  createPhysicsFromGLB(gltfScene) {
    const physicsObjects = []
    let colliderCount = 0
    
    gltfScene.traverse((child) => {
      if (child.isMesh) {
        const name = child.name.toLowerCase()
        
        // Determinar se o objeto deve ter física baseado no nome
        const shouldHavePhysics = this.shouldObjectHavePhysics(name)
        
        if (shouldHavePhysics) {
          try {
            // Criar corpo físico estático
            const rigidBody = this.createStaticBody(child)
            
            if (rigidBody) {
              physicsObjects.push({ mesh: child, rigidBody })
              colliderCount++
            }
          } catch (error) {
            // Erro silencioso para objetos que não suportam física
          }
        }
      }
    })
    
    return physicsObjects
  }

  // Determinar quais objetos do GLB devem ter física
  shouldObjectHavePhysics(objectName) {
    // Objetos que DEVEM ter física (chão, paredes, obstáculos)
    const shouldHavePhysics = [
      'collision', 'wall', 'floor', 'ground', 'platform', 
      'building', 'structure', 'obstacle', 'barrier',
      'ceiling', 'roof', 'pillar', 'column', 'bridge',
      'terrain', 'landscape', 'mesa', 'rock', 'stone'
    ]
    
    // Objetos que NÃO devem ter física (decorações, efeitos visuais)
    const shouldNotHavePhysics = [
      'decoration', 'decor', 'plant', 'grass', 'leaf',
      'particle', 'effect', 'light', 'glow', 'spark',
      'ui', 'interface', 'hud', 'text', 'label'
    ]
    
    // Verificar se deve NÃO ter física primeiro (mais específico)
    if (shouldNotHavePhysics.some(keyword => objectName.includes(keyword))) {
      return false
    }
    
    // Verificar se deve ter física
    if (shouldHavePhysics.some(keyword => objectName.includes(keyword))) {
      return true
    }
    
    // Por padrão, objetos têm física (estratégia conservadora)
    // Você pode mudar para `false` se preferir que seja mais seletivo
    return true
  }
}

// Instância global do mundo físico
export const physicsWorld = new PhysicsWorld()

// Função para encontrar uma posição segura para spawnar o player
physicsWorld.findSafeSpawnPosition = function(worldBounds = { minY: -10, maxY: 50 }) {
  // Tentar algumas posições padrão
  const testPositions = [
    { x: 0, y: 5, z: 0 },      // Centro, 5m acima
    { x: 5, y: 5, z: 5 },      // Offset do centro
    { x: -5, y: 5, z: -5 },    // Outro offset
    { x: 0, y: 10, z: 0 },     // Mais alto se necessário
    { x: 0, y: 15, z: 0 }      // Ainda mais alto
  ]
  
  for (const testPos of testPositions) {
    // Raycast para baixo para encontrar o chão
    const hit = this.castRay(
      testPos,
      { x: 0, y: -1, z: 0 },
      Math.abs(testPos.y - worldBounds.minY) + 5
    )
    
    if (hit) {
      // Posição segura: um pouco acima do chão encontrado
      const safeY = hit.point.y + 2 // 2 metros acima do chão
      return { x: testPos.x, y: safeY, z: testPos.z }
    }
  }
  
  // Fallback: posição padrão alta
    return { x: 0, y: 5, z: 0 }
  }