import { player } from './player.js'
import { camera } from '../core/camera.js'

export const Input = {
  keys: {},
  mouse: {
    x: 0,
    y: 0,
    deltaX: 0,
    deltaY: 0,
    left: false,
    right: false,
    prevX: 0,
    prevY: 0
  }
}

let yaw = 0
let pitch = 0

export function initControls() {
  document.body.addEventListener('click', () => {
    document.body.requestPointerLock()
  })

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('mouseup', onMouseUp)

  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
}

function onMouseMove(e) {
  if (!document.pointerLockElement) return

  Input.mouse.deltaX = e.movementX
  Input.mouse.deltaY = e.movementY

  yaw   -= Input.mouse.deltaX * 0.002
  pitch -= Input.mouse.deltaY * 0.002

  pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch))

  player.rotation.y = yaw
  camera.rotation.x = pitch
}

function onMouseDown(e) {
  if (e.button === 0) Input.mouse.left = true
  if (e.button === 2) Input.mouse.right = true
}

function onMouseUp(e) {
  if (e.button === 0) Input.mouse.left = false
  if (e.button === 2) Input.mouse.right = false
}

function onKeyDown(e) {
  Input.keys[e.code] = true
}

function onKeyUp(e) {
  Input.keys[e.code] = false
}
