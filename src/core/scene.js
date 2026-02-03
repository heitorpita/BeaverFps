import * as THREE from 'three'

export const scene = new THREE.Scene()
// Cor do céu azul claro
scene.background = new THREE.Color(0x88ccee)
// Fog para dar profundidade e realismo
scene.fog = new THREE.Fog(0x88ccee, 0, 50)
