import { processPlayerMouseMovement } from './player.js'
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

let controlsActive = true

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

export function pauseControls() {
  controlsActive = false
  Object.keys(Input.keys).forEach(key => Input.keys[key] = false)
  if (document.pointerLockElement) {
    document.exitPointerLock()
  }
}

export function resumeControls() {
  controlsActive = true
}

function onMouseMove(e) {
  if (!document.pointerLockElement || !controlsActive) return

  Input.mouse.deltaX = e.movementX
  Input.mouse.deltaY = e.movementY

  processPlayerMouseMovement(Input.mouse.deltaX, Input.mouse.deltaY)
}

function onMouseDown(e) {
  if (!controlsActive) return
  if (e.button === 0) Input.mouse.left = true
  if (e.button === 2) Input.mouse.right = true
}

function onMouseUp(e) {
  if (!controlsActive) return
  if (e.button === 0) Input.mouse.left = false
  if (e.button === 2) Input.mouse.right = false
}

function onKeyDown(e) {
  if (!controlsActive) return
  Input.keys[e.code] = true
}

function onKeyUp(e) {
  if (!controlsActive) return
  Input.keys[e.code] = false
}