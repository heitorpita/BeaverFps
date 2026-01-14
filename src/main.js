import { scene } from './core/scene.js'
import { renderer } from './core/renderer.js'
import { camera } from './core/camera.js'
import { startLoop } from './core/loop.js'
import { createStats } from './core/debug.js'
import { player, updatePlayer } from './player/player.js'
import { initControls } from './player/controls.js'

import { loadWorld } from './world/loader.js'
import { createLights } from './core/lights.js'

// câmera no player (FPS)
player.add(camera)
camera.position.set(0, 1.6, 0)

const stats = createStats();


scene.add(player)

// luz
const { ambientLight, directionalLight } = createLights()
scene.add(ambientLight, directionalLight)

// input
initControls()

// mundo
loadWorld()

startLoop(
  (delta) => {
    stats.update()
    updatePlayer(delta)
  },
  () => {
    renderer.render(scene, camera)
  }
)
