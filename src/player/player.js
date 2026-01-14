import * as THREE from 'three'
import { Input } from './controls.js'

export const player = new THREE.Object3D()

const forward = new THREE.Vector3()
const right = new THREE.Vector3()
const up = new THREE.Vector3(0, 1, 0)

export function updatePlayer(delta) {
  const speed = 5

  player.getWorldDirection(forward)
  forward.y = 0
  forward.normalize()

  right.crossVectors(forward, up)

  if (Input.keys.KeyS) player.position.addScaledVector(forward, speed * delta)
  if (Input.keys.KeyW) player.position.addScaledVector(forward, -speed * delta)
  if (Input.keys.KeyD) player.position.addScaledVector(right, -speed * delta)
  if (Input.keys.KeyA) player.position.addScaledVector(right, speed * delta)
}
