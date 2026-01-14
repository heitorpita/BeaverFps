import * as THREE from 'three'

export function createLights() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(5, 10, 5)
  directionalLight.castShadow = true

  return {
    ambientLight,
    directionalLight
  }
}
