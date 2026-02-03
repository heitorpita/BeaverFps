import * as THREE from 'three'

export const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.position.set(0, 3.5, 0)
// Ordem de rotação otimizada para FPS
camera.rotation.order = 'YXZ'


