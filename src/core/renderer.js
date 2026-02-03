import * as THREE from 'three'

export const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)

// Ativar sombras com VSM para sombras suaves
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.VSMShadowMap

// Tone mapping cinematográfico para cores mais realistas
renderer.toneMapping = THREE.ACESFilmicToneMapping

document.body.appendChild(renderer.domElement)