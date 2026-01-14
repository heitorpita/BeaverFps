import { scene } from './core/scene.js'
import { renderer } from './core/renderer.js'
import { camera } from './core/camera.js'
import { startLoop } from './core/loop.js'
import { createStats } from './core/debug.js'
import { player, updatePlayer, initPlayer, positionPlayerAfterWorldLoad } from './player/player.js'
import { initControls } from './player/controls.js'
import { loadWorld } from './world/loader.js'
import { createLights } from './core/lights.js'
import { physicsWorld } from './physics/physics.js'
import { createPhysicsDebug } from './physics/debug.js'

async function initGame() {
  console.log('🚀 Inicializando BeaverFps com física...')
  
  // 1. Inicializar mundo físico
  await physicsWorld.init()
  
  // 2. Configurar player
  player.add(camera)
  camera.position.set(0, 0.35, 0)
  scene.add(player)
  
  // 3. Inicializar física do player
  await initPlayer()
  
  // 4. Criar luzes
  const { ambientLight, directionalLight } = createLights()
  scene.add(ambientLight, directionalLight)
  
  // 5. Inicializar controles
  initControls()
  
  // 6. Carregar mundo com física
  const worldData = await loadWorld()
  
  // 6.1. Posicionar player após mundo carregado
  positionPlayerAfterWorldLoad()
  
  // 7. Configurar stats e debug
  const stats = createStats()
  const physicsDebug = createPhysicsDebug(scene)
  
  // 8. Iniciar loop principal
  startLoop(
    (delta) => {
      stats.update()
      
      // Atualizar física
      physicsWorld.step(delta)
      
      // Atualizar debug de física
      physicsDebug.update()
      
      // Atualizar player
      updatePlayer(delta)
    },
    () => {
      renderer.render(scene, camera)
    }
  )
  
  console.log('✅ Jogo inicializado com sucesso!')
}

// Inicializar o jogo
initGame().catch(error => {
  console.error('❌ Erro ao inicializar o jogo:', error)
})
