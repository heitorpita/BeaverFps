import { processPlayerMouseMovement } from './player.js'

export const Input = {
  keys: {},

  mouse: {
    left: false,
    right: false,
    deltaX: 0,
    deltaY: 0
  },

  // Estado anterior (para detecção de borda)
  prev: {
    mouseLeft: false,
    keyR: false,
    digit1: false
  },

  // Ações detectadas por borda (true SOMENTE no frame do evento)
  actions: {
    shoot: false,
    reload: false,
    weaponSlot1: false
  }
}

let controlsActive = true

// ==============================
// INIT
// ==============================
export function initControls() {
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('mousemove', onMouseMove)

  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)

  console.log('🎮 Controles inicializados')
}

// ==============================
// UPDATE (CHAMAR TODO FRAME)
// ==============================
export function updateInputActions() {
  Input.actions.shoot =
    Input.mouse.left && !Input.prev.mouseLeft

  Input.actions.reload =
    Input.keys.KeyR && !Input.prev.keyR

  Input.actions.weaponSlot1 =
    Input.keys.Digit1 && !Input.prev.digit1

  // Atualizar estado anterior
  Input.prev.mouseLeft = Input.mouse.left
  Input.prev.keyR = !!Input.keys.KeyR
  Input.prev.digit1 = !!Input.keys.Digit1
}

// ==============================
// PAUSE / RESUME
// ==============================
export function pauseControls() {
  controlsActive = false

  Object.keys(Input.keys).forEach(k => Input.keys[k] = false)
  Input.mouse.left = false
  Input.mouse.right = false

  if (document.pointerLockElement) {
    document.exitPointerLock()
  }

  console.log('🔒 Controles pausados')
}

export function resumeControls() {
  controlsActive = true
  console.log('🔓 Controles resumidos')
}

// ==============================
// EVENTS
// ==============================
function onMouseDown(e) {
  if (!controlsActive) return

  if (e.button === 0) {
    Input.mouse.left = true

    // Ativar pointer lock com botão esquerdo
    if (!document.pointerLockElement) {
      document.body.requestPointerLock()
    }
  }

  if (e.button === 2) {
    Input.mouse.right = true
  }
}

function onMouseUp(e) {
  if (!controlsActive) return

  if (e.button === 0) Input.mouse.left = false
  if (e.button === 2) Input.mouse.right = false
}

function onMouseMove(e) {
  if (!controlsActive) return
  if (!document.pointerLockElement) return

  Input.mouse.deltaX = e.movementX
  Input.mouse.deltaY = e.movementY

  processPlayerMouseMovement(
    Input.mouse.deltaX,
    Input.mouse.deltaY
  )
}

function onKeyDown(e) {
  if (!controlsActive) return
  Input.keys[e.code] = true
}

function onKeyUp(e) {
  if (!controlsActive) return
  Input.keys[e.code] = false
}

// ==============================
// DEBUG (opcional)
// ==============================
export function debugInput() {
  console.log({
    keys: Object.keys(Input.keys).filter(k => Input.keys[k]),
    mouseLeft: Input.mouse.left,
    actions: Input.actions
  })
}

window.debugInput = debugInput
