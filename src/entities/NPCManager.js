import * as THREE from 'three'
import { NPC, NPCState } from './NPC.js'
import { scene } from '../core/scene.js'

/**
 * Gerenciador de NPCs
 * Controla todos os NPCs do jogo
 */
class NPCManagerClass {
  constructor() {
    // Lista de todos os NPCs
    this.npcs = []
    
    // Referência ao player (target para IA)
    this.playerTarget = null
    
    // Configurações padrão
    this.defaultModelPath = '/models/a_crazy_boy_enemy_for_games_free_with_face.glb'
    
    // Flag de inicialização
    this.isInitialized = false
  }
  
  /**
   * Define o player como alvo para todos os NPCs
   */
  setPlayerTarget(player) {
    this.playerTarget = player
    
    // Atualizar todos os NPCs existentes
    for (const npc of this.npcs) {
      npc.setTarget(player)
    }
  }
  
  /**
   * Inicializa o gerenciador de NPCs
   */
  async init() {
    if (this.isInitialized) return
    
    this.isInitialized = true
    
    return this
  }
  
  /**
   * Spawna um NPC no mundo
   */
  async spawnNPC(options = {}) {
    const npc = new NPC({
      name: options.name || `Enemy_${this.npcs.length + 1}`,
      position: options.position || new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        0,
        (Math.random() - 0.5) * 10
      ),
      health: options.health || 100,
      moveSpeed: options.moveSpeed || 1.5,
      patrolRadius: options.patrolRadius || 8,
      changeDirectionInterval: options.changeDirectionInterval || 2 + Math.random() * 3,
      scale: options.scale || 0.5,
      
      // Configurações de IA
      patrolSpeed: options.patrolSpeed || 1.5,
      chaseSpeed: options.chaseSpeed || 3.5,
      viewDistance: options.viewDistance || 15,
      fovAngle: options.fovAngle || Math.PI / 2,
      attackDistance: options.attackDistance || 2,
      attackDamage: options.attackDamage || 10,
      showDebug: options.showDebug || false
    })
    
    try {
      // Carregar modelo
      const modelPath = options.modelPath || this.defaultModelPath
      await npc.load(modelPath)
      
      // Definir player como alvo se já existir
      if (this.playerTarget) {
        npc.setTarget(this.playerTarget)
      }
      
      // Adicionar à cena
      scene.add(npc.group)
      
      // Adicionar à lista
      this.npcs.push(npc)
      
      return npc
    } catch (error) {
      return null
    }
  }
  
  /**
   * Spawna múltiplos NPCs
   */
  async spawnMultiple(count, options = {}) {
    const promises = []
    
    for (let i = 0; i < count; i++) {
      // Posição aleatória em torno de um ponto central
      const centerX = options.centerX || 0
      const centerZ = options.centerZ || 0
      const spread = options.spread || 15
      
      const position = new THREE.Vector3(
        centerX + (Math.random() - 0.5) * spread,
        options.y || 0,
        centerZ + (Math.random() - 0.5) * spread
      )
      
      promises.push(this.spawnNPC({
        ...options,
        position,
        name: `Enemy_${this.npcs.length + 1}`
      }))
    }
    
    const results = await Promise.all(promises)
    return results.filter(npc => npc !== null)
  }
  
  /**
   * Atualiza todos os NPCs (chamado a cada frame)
   */
  update(delta) {
    for (const npc of this.npcs) {
      npc.update(delta)
    }
  }
  
  /**
   * Retorna todos os NPCs vivos
   */
  getAliveNPCs() {
    return this.npcs.filter(npc => npc.isAlive)
  }
  
  /**
   * Retorna todos os NPCs mortos
   */
  getDeadNPCs() {
    return this.npcs.filter(npc => !npc.isAlive)
  }
  
  /**
   * Encontra NPC por ID
   */
  getNPCById(id) {
    return this.npcs.find(npc => npc.id === id)
  }
  
  /**
   * Encontra NPC mais próximo de uma posição
   */
  getClosestNPC(position, aliveOnly = true) {
    let closest = null
    let closestDistance = Infinity
    
    const searchList = aliveOnly ? this.getAliveNPCs() : this.npcs
    
    for (const npc of searchList) {
      const distance = position.distanceTo(npc.getPosition())
      if (distance < closestDistance) {
        closestDistance = distance
        closest = npc
      }
    }
    
    return { npc: closest, distance: closestDistance }
  }
  
  /**
   * Aplica dano a um NPC específico
   */
  damageNPC(npc, amount) {
    if (npc && npc.isAlive) {
      npc.takeDamage(amount)
    }
  }
  
  /**
   * Mata todos os NPCs
   */
  killAll() {
    for (const npc of this.npcs) {
      if (npc.isAlive) {
        npc.die()
      }
    }
  }
  
  /**
   * Revive todos os NPCs
   */
  reviveAll() {
    for (const npc of this.npcs) {
      if (!npc.isAlive) {
        npc.revive()
      }
    }
  }
  
  /**
   * Remove um NPC específico
   */
  removeNPC(npc) {
    const index = this.npcs.indexOf(npc)
    if (index > -1) {
      scene.remove(npc.group)
      npc.dispose()
      this.npcs.splice(index, 1)
    }
  }
  
  /**
   * Remove todos os NPCs
   */
  removeAll() {
    for (const npc of [...this.npcs]) {
      this.removeNPC(npc)
    }
  }
  
  /**
   * Retorna estatísticas dos NPCs
   */
  getStats() {
    return {
      total: this.npcs.length,
      alive: this.getAliveNPCs().length,
      dead: this.getDeadNPCs().length
    }
  }
}

// Singleton
export const NPCManager = new NPCManagerClass()

// Funções de conveniência
export async function initNPCManager() {
  return NPCManager.init()
}

export function updateNPCs(delta) {
  NPCManager.update(delta)
}

export function setNPCsTarget(player) {
  NPCManager.setPlayerTarget(player)
}

export async function spawnNPC(options) {
  return NPCManager.spawnNPC(options)
}

export async function spawnMultipleNPCs(count, options) {
  return NPCManager.spawnMultiple(count, options)
}
