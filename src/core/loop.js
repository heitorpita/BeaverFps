import { renderer } from "./renderer.js";
import { scene } from "./scene.js";
import { camera } from "./camera.js";

let lastTime = 0
let animationFrameId = null
let isLoopRunning = false

export function startLoop(update, render) {
  if (isLoopRunning) {
    return
  }

  isLoopRunning = true

  function loop(time) {
    if (!isLoopRunning) return

    const delta = (time - lastTime) / 1000
    lastTime = time

    update(delta)
    render()

    animationFrameId = requestAnimationFrame(loop)
  }

  animationFrameId = requestAnimationFrame(loop)
}

export function stopLoop() {
  isLoopRunning = false
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}
