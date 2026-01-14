import { renderer } from "./renderer.js";
import { scene } from "./scene.js";
import { camera } from "./camera.js";

let lastTime = 0

export function startLoop(update, render) {
  function loop(time) {
    const delta = (time - lastTime) / 1000
    lastTime = time

    update(delta)
    render()

    requestAnimationFrame(loop)
  }

  requestAnimationFrame(loop)
}
