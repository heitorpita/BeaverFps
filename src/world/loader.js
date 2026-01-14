import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { scene } from '../core/scene.js'
import { physicsWorld } from '../physics/physics.js'

const loader = new GLTFLoader().setPath('/models/')

export function loadWorld() {
  return new Promise((resolve, reject) => {
    loader.load(
      'collision-world.glb', 
      (gltf) => {
        const world = gltf.scene
        scene.add(world)

        // Configurar propriedades visuais
        world.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
            
            // Melhorar qualidade dos materiais
            if (child.material.map) {
              child.material.map.anisotropy = 4
            }
          }
        })

        // Tentar criar física (se falhar, continua sem)
        try {
          const physicsObjects = physicsWorld.createPhysicsFromGLB(world)
          console.log(`🌍 Mundo carregado com ${physicsObjects.length} objetos físicos`)
        } catch (error) {
          console.warn('⚠️ Erro na física, continuando sem:', error)
        }
        
        resolve({ world })
      },
      
      (progress) => {
        const percent = (progress.loaded / progress.total * 100).toFixed(1)
        console.log(`📦 Carregando mundo: ${percent}%`)
      },
      
      (error) => {
        console.error('❌ Erro ao carregar mundo:', error)
        reject(error)
      }
    )
  })
}
