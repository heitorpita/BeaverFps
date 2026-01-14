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
  // Limpar todas as teclas
  Object.keys(Input.keys).forEach(key => Input.keys[key] = false)
  // Sair do pointer lock
  if (document.pointerLockElement) {
    document.exitPointerLock()
  }
  console.log('🔒 Controles pausados')
}

export function resumeControls() {
  controlsActive = true
  console.log('🔓 Controles resumidos')
}

function onMouseMove(e) {
  if (!document.pointerLockElement || !controlsActive) return

  Input.mouse.deltaX = e.movementX
  Input.mouse.deltaY = e.movementY

  // Usar a função da classe Player para processar movimento do mouse
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
  // Debug para Space
  if (e.code === 'Space') {
    console.log('🎹 SPACE DOWN - Code:', e.code, 'Key:', e.key)
  }
}

function onKeyUp(e) {
  if (!controlsActive) return
  Input.keys[e.code] = false
  // Debug para Space
  if (e.code === 'Space') {
    console.log('🎹 SPACE UP - Code:', e.code, 'Key:', e.key)
  }
}

// Debug - mostrar teclas pressionadas
function debugKeys() {
  const pressedKeys = Object.keys(Input.keys).filter(key => Input.keys[key])
  if (pressedKeys.length > 0) {
    console.log('🎹 Teclas pressionadas:', pressedKeys)
  }
}

// Expor função de debug globalmente
window.debugKeys = debugKeys

// Função para testar detecção da tecla Space especificamente
export function testSpaceKey() {
  console.log('🧪 Teste da tecla Space:')
  console.log('- Input.keys.Space:', Input.keys.Space)
  console.log('- Input.keys[" "]:', Input.keys[' '])
  console.log('- Todas as teclas ativas:', Object.keys(Input.keys).filter(k => Input.keys[k]))
  
  const spacePressed = Input.keys.Space || Input.keys[' ']
  console.log('- Space detectado:', spacePressed)
  
  return spacePressed
}

// Expor globalmente
window.testSpaceKey = testSpaceKey