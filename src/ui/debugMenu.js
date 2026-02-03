import { camera } from '../core/camera.js'
import { 
  setPlayerMouseSensitivity, 
  setPlayerMovementSpeed, 
  setPlayerFOV, 
  setPlayerJumpForce 
} from '../player/player.js'
import { NPCManager, spawnNPC } from '../entities/NPCManager.js'
import * as THREE from 'three'

// Configurações do menu debug
const debugConfig = {
  // Configurações do player que serão ajustáveis
  mouseSensitivity: 0.002,
  movementSpeed: 5.0,
  fov: 75,
  jumpForce: 4.5
}

// Expor globalmente para que o player possa usar
window.debugConfig = debugConfig

// Estado do menu
let menuVisible = false
let currentSection = 0 // 0 = Player, 1 = Scene
let currentOption = 0
let menuElement = null

// Seções do menu
const menuSections = [
  {
    title: 'PLAYER',
    options: [
      { 
        label: 'Mouse Sensitivity', 
        key: 'mouseSensitivity', 
        min: 0.0005, 
        max: 0.01, 
        step: 0.0005,
        format: (val) => (val * 1000).toFixed(1)
      },
      { 
        label: 'Movement Speed', 
        key: 'movementSpeed', 
        min: 1.0, 
        max: 20.0, 
        step: 0.5,
        format: (val) => val.toFixed(1)
      },
      { 
        label: 'Field of View', 
        key: 'fov', 
        min: 30, 
        max: 120, 
        step: 5,
        format: (val) => val.toFixed(0) + '°'
      },
      { 
        label: 'Jump Force', 
        key: 'jumpForce', 
        min: 1.0, 
        max: 10.0, 
        step: 0.5,
        format: (val) => val.toFixed(1)
      }
    ]
  },
  {
    title: 'ENEMIES',
    options: [
      { label: 'Spawn Enemy (Front)', action: 'spawnEnemyFront' },
      { label: 'Spawn Enemy (Random)', action: 'spawnEnemyRandom' },
      { label: 'Spawn 3 Enemies', action: 'spawn3Enemies' },
      { label: 'Kill All Enemies', action: 'killAllEnemies' },
      { label: 'Revive All Enemies', action: 'reviveAllEnemies' },
      { label: 'Remove All Enemies', action: 'removeAllEnemies' }
    ]
  }
]

// Criar elemento do menu no DOM
function createMenuElement() {
  menuElement = document.createElement('div')
  menuElement.id = 'debug-menu'
  menuElement.innerHTML = `
    <div class="debug-menu-container">
      <div class="debug-menu-header">
        <div class="debug-menu-title">DEBUG MENU</div>
        <div class="debug-menu-subtitle">Use ↑↓ to navigate, ←→ to adjust, F to close</div>
      </div>
      <div class="debug-menu-content">
        <div class="debug-menu-sections"></div>
      </div>
    </div>
  `
  
  // Adicionar estilos
  const style = document.createElement('style')
  style.textContent = `
    #debug-menu {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2000;
      display: none;
      pointer-events: none;
    }
    
    #debug-menu.visible {
      display: block;
    }
    
    .debug-menu-container {
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #00ff88;
      border-radius: 8px;
      padding: 20px;
      min-width: 400px;
      font-family: 'Courier New', monospace;
      color: #ffffff;
      box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
    }
    
    .debug-menu-header {
      text-align: center;
      margin-bottom: 20px;
    }
    
    .debug-menu-title {
      font-size: 24px;
      font-weight: bold;
      color: #00ff88;
      margin-bottom: 8px;
      letter-spacing: 2px;
    }
    
    .debug-menu-subtitle {
      font-size: 12px;
      color: #888888;
      margin-bottom: 10px;
    }
    
    .debug-section {
      margin-bottom: 20px;
    }
    
    .debug-section-title {
      font-size: 16px;
      font-weight: bold;
      color: #00ccff;
      margin-bottom: 10px;
      padding: 5px 0;
      border-bottom: 1px solid #333333;
    }
    
    .debug-section-title.active {
      color: #00ff88;
      background: rgba(0, 255, 136, 0.1);
      padding: 5px 10px;
      margin: 0 -10px 10px -10px;
    }
    
    .debug-option {
      padding: 5px 10px;
      margin: 2px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
    }
    
    .debug-option.selected {
      background: rgba(0, 255, 136, 0.2);
      color: #00ff88;
      border-left: 3px solid #00ff88;
      padding-left: 7px;
    }
    
    .debug-option-label {
      flex: 1;
    }
    
    .debug-option-value {
      color: #ffff00;
      font-weight: bold;
      min-width: 80px;
      text-align: right;
    }
    
    .debug-option-action {
      color: #ff6666;
      font-style: italic;
    }
  `
  
  document.head.appendChild(style)
  document.body.appendChild(menuElement)
}

// Renderizar o menu
function renderMenu() {
  if (!menuElement) return
  
  const sectionsContainer = menuElement.querySelector('.debug-menu-sections')
  sectionsContainer.innerHTML = ''
  
  menuSections.forEach((section, sectionIndex) => {
    const sectionDiv = document.createElement('div')
    sectionDiv.className = 'debug-section'
    
    const titleDiv = document.createElement('div')
    titleDiv.className = `debug-section-title ${currentSection === sectionIndex ? 'active' : ''}`
    titleDiv.textContent = section.title
    sectionDiv.appendChild(titleDiv)
    
    if (currentSection === sectionIndex) {
      section.options.forEach((option, optionIndex) => {
        const optionDiv = document.createElement('div')
        optionDiv.className = `debug-option ${currentOption === optionIndex ? 'selected' : ''}`
        
        const labelDiv = document.createElement('div')
        labelDiv.className = 'debug-option-label'
        labelDiv.textContent = option.label
        
        const valueDiv = document.createElement('div')
        
        if (option.key) {
          // Opção com valor ajustável
          valueDiv.className = 'debug-option-value'
          const currentValue = debugConfig[option.key]
          valueDiv.textContent = option.format ? option.format(currentValue) : currentValue
        } else {
          // Opção de ação
          valueDiv.className = 'debug-option-action'
          valueDiv.textContent = '[ENTER]'
        }
        
        optionDiv.appendChild(labelDiv)
        optionDiv.appendChild(valueDiv)
        sectionDiv.appendChild(optionDiv)
      })
    }
    
    sectionsContainer.appendChild(sectionDiv)
  })
}

// Aplicar mudança de configuração
function applyConfigChange(key, value) {
  debugConfig[key] = value
  
  switch (key) {
    case 'fov':
      setPlayerFOV(value)
      break
    case 'mouseSensitivity':
      setPlayerMouseSensitivity(value)
      break
    case 'movementSpeed':
      setPlayerMovementSpeed(value)
      break
    case 'jumpForce':
      setPlayerJumpForce(value)
      break
  }
  
  // Manter configuração global para compatibilidade
  window.debugConfig = debugConfig
}

// Executar ação do menu
function executeAction(action) {
  switch (action) {
    case 'spawnEnemyFront':
      spawnEnemyInFront()
      break
    case 'spawnEnemyRandom':
      spawnEnemyRandom()
      break
    case 'spawn3Enemies':
      spawn3Enemies()
      break
    case 'killAllEnemies':
      NPCManager.killAll()
      break
    case 'reviveAllEnemies':
      NPCManager.reviveAll()
      break
    case 'removeAllEnemies':
      NPCManager.removeAll()
      break
  }
}

// Spawna inimigo na frente do player
async function spawnEnemyInFront() {
  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  forward.y = 0
  forward.normalize()
  
  const spawnPos = new THREE.Vector3()
  spawnPos.copy(camera.position)
  spawnPos.addScaledVector(forward, 5) // 5 metros na frente
  spawnPos.y = 0
  
  const npc = await spawnNPC({
    position: spawnPos,
    scale: 0.15,
    chaseSpeed: 3.0,
    viewDistance: 12,
    showDebug: false
  })
}

// Spawna inimigo em posição aleatória
async function spawnEnemyRandom() {
  const spawnPos = new THREE.Vector3(
    (Math.random() - 0.5) * 20,
    0,
    (Math.random() - 0.5) * 20
  )
  
  const npc = await spawnNPC({
    position: spawnPos,
    scale: 0.15,
    chaseSpeed: 3.0,
    viewDistance: 12,
    showDebug: false
  })
}

// Spawna 3 inimigos ao redor do player
async function spawn3Enemies() {
  const playerPos = camera.position.clone()
  playerPos.y = 0
  
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2
    const distance = 8 + Math.random() * 5
    
    const spawnPos = new THREE.Vector3(
      playerPos.x + Math.cos(angle) * distance,
      0,
      playerPos.z + Math.sin(angle) * distance
    )
    
    await spawnNPC({
      position: spawnPos,
      scale: 0.15,
      chaseSpeed: 3.0,
      viewDistance: 12,
      showDebug: false
    })
  }
}

// Navegação do menu
function navigateMenu(direction) {
  const currentSectionData = menuSections[currentSection]
  const maxOptions = currentSectionData.options.length - 1
  
  switch (direction) {
    case 'up':
      if (currentOption > 0) {
        currentOption--
      } else {
        // Ir para seção anterior
        if (currentSection > 0) {
          currentSection--
          currentOption = menuSections[currentSection].options.length - 1
        }
      }
      break
      
    case 'down':
      if (currentOption < maxOptions) {
        currentOption++
      } else {
        // Ir para próxima seção
        if (currentSection < menuSections.length - 1) {
          currentSection++
          currentOption = 0
        }
      }
      break
      
    case 'left':
      const leftOption = currentSectionData.options[currentOption]
      if (leftOption.key) {
        const currentValue = debugConfig[leftOption.key]
        const newValue = Math.max(leftOption.min, currentValue - leftOption.step)
        applyConfigChange(leftOption.key, newValue)
      }
      break
      
    case 'right':
      const rightOption = currentSectionData.options[currentOption]
      if (rightOption.key) {
        const currentValue = debugConfig[rightOption.key]
        const newValue = Math.min(rightOption.max, currentValue + rightOption.step)
        applyConfigChange(rightOption.key, newValue)
      }
      break
      
    case 'enter':
      const enterOption = currentSectionData.options[currentOption]
      if (enterOption.action) {
        executeAction(enterOption.action)
      }
      break
  }
  
  renderMenu()
}

// Mostrar/esconder menu
export function toggleDebugMenu() {
  menuVisible = !menuVisible
  
  if (!menuElement) {
    createMenuElement()
  }
  
  if (menuVisible) {
    menuElement.classList.add('visible')
    renderMenu()
  } else {
    menuElement.classList.remove('visible')
  }
}

// Event listeners para navegação
export function initDebugMenu() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'F' || event.key === 'f') {
      event.preventDefault()
      toggleDebugMenu()
      return
    }
    
    if (!menuVisible) return
    
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        navigateMenu('up')
        break
      case 'ArrowDown':
        event.preventDefault()
        navigateMenu('down')
        break
      case 'ArrowLeft':
        event.preventDefault()
        navigateMenu('left')
        break
      case 'ArrowRight':
        event.preventDefault()
        navigateMenu('right')
        break
      case 'Enter':
        event.preventDefault()
        navigateMenu('enter')
        break
      case 'Escape':
        event.preventDefault()
        toggleDebugMenu()
        break
    }
  })
  
  // Expor configurações globalmente para outros módulos
  window.debugConfig = debugConfig
}

// Exportar configurações para outros módulos
export { debugConfig }
