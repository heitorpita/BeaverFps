import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { scene } from '../core/scene.js'
import { physicsWorld } from '../physics/physics.js'

const loader = new GLTFLoader().setPath('/models/')

export function loadWorld() {
  return new Promise((resolve, reject) => {
    loader.load(
      'fps_map.glb', 
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
          physicsWorld.createPhysicsFromGLB(world)
        } catch (error) {
          // Continua sem física se falhar
        }
        
        resolve({ world })
      },
      
      (progress) => {
        // Progresso silencioso
      },
      
      (error) => {
        reject(error)
      }
    )
  })
}