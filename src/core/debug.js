import Stats from 'three/addons/libs/stats.module.js'

export function createStats() {
  const stats = new Stats()
  stats.dom.style.position = 'absolute'
  stats.dom.style.top = '50px'
  stats.dom.style.left = '20px'

  document.body.appendChild(stats.dom)

  return stats
}
