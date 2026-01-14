import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { scene } from '../core/scene.js'

const loader = new GLTFLoader().setPath('/models/')

export function loadWorld() {
  loader.load('collision-world.glb', (gltf) => {
    const world = gltf.scene
    scene.add(world)

    world.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    console.log('🌍 Mundo carregado')
  })
}
