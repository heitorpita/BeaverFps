import * as THREE from 'three'

export function createLights() {
  // Luz hemisférica para iluminação ambiente realista (céu/chão)
  const fillLight = new THREE.HemisphereLight(0x8dc1de, 0x00668d, 1.5)
  fillLight.position.set(2, 1, 1)

  // Luz direcional principal (sol) com sombras de alta qualidade
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5)
  directionalLight.position.set(-5, 25, -1)
  directionalLight.castShadow = true
  
  // Configurações de sombra de alta qualidade
  directionalLight.shadow.camera.near = 0.01
  directionalLight.shadow.camera.far = 500
  directionalLight.shadow.camera.right = 30
  directionalLight.shadow.camera.left = -30
  directionalLight.shadow.camera.top = 30
  directionalLight.shadow.camera.bottom = -30
  directionalLight.shadow.mapSize.width = 1024
  directionalLight.shadow.mapSize.height = 1024
  directionalLight.shadow.radius = 4
  directionalLight.shadow.bias = -0.00006

  return {
    fillLight,
    directionalLight
  }
}
