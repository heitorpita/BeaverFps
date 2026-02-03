import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { TextureLoader } from 'three'
import { camera } from '../core/camera.js'
import { Input } from './controls.js'
import { scene } from '../core/scene.js'

// Referência ao NPCManager (definida depois para evitar dependência circular)
let npcManagerRef = null

export function setNPCManagerRef(manager) {
  npcManagerRef = manager
}

// Texture loader para carregar texturas manualmente
const textureLoader = new THREE.TextureLoader()

/**
 * Sistema de Arma FPS
 * Carrega modelo GLTF com animações de braços + pistola
 */
export class Weapon {
  constructor() {
    // Grupo que contém toda a arma
    this.weaponGroup = new THREE.Group()
    this.weaponGroup.name = 'WeaponGroup'
    
    // Modelo carregado
    this.model = null
    this.mixer = null
    this.animations = {}
    this.currentAction = null
    
    // Configurações da arma
    this.config = {
      // Posição e escala do modelo na câmera
      position: new THREE.Vector3(0, -0.30, -0.3),
      rotation: new THREE.Euler(0, Math.PI, 0),
      scale: new THREE.Vector3(1, 1, 1),
      
      // Configurações de tiro
      damage: 25,
      fireRate: 0.3,
      range: 100,
      
      // Configurações de recarga
      reloadTime: 2.0
    }
    
    // Estado da arma
    this.state = {
      isReady: false,
      isFiring: false,
      isReloading: false,
      isWalking: false,
      canFire: true,
      lastFireTime: 0,
      ammo: 12,
      maxAmmo: 12
    }
    
    // Raycaster para tiros
    this.raycaster = new THREE.Raycaster()
    this.crosshairCenter = new THREE.Vector2(0, 0)
    
    // Loader
    this.loader = new GLTFLoader()
  }
  
  /**
   * Carrega e inicializa a arma
   */
  async init() {
    try {
      const gltf = await this.loadModel('/fps_pistol_animations/scene.gltf')
      
      this.model = gltf.scene
      this.model.name = 'FPS_Arms_Pistol'
      
      // Configurar posição, rotação e escala
      this.model.position.copy(this.config.position)
      this.model.rotation.copy(this.config.rotation)
      this.model.scale.copy(this.config.scale)
      
      // Carregar e aplicar texturas manualmente
      await this.applyTextures()
      
      // Habilitar sombras
      this.model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true
          child.receiveShadow = true
          // Garantir que o material renderize corretamente
          if (child.material) {
            child.material.side = THREE.FrontSide
            child.material.needsUpdate = true
          }
        }
      })
      
      // Adicionar ao grupo
      this.weaponGroup.add(this.model)
      
      // Configurar animações
      this.setupAnimations(gltf.animations)
      
      // Adicionar grupo à câmera
      camera.add(this.weaponGroup)
      
      // Criar UI
      this.createCrosshair()
      this.updateAmmoUI()
      
      // Iniciar com animação Idle
      this.playAnimation('idle')
      
      this.state.isReady = true
      
    } catch (error) {
      // Erro ao carregar arma
    }
  }
  
  /**
   * Carrega o modelo GLTF
   */
  loadModel(path) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => resolve(gltf),
        (progress) => {},
        (error) => reject(error)
      )
    })
  }
  
  /**
   * Carrega uma textura
   */
  loadTexture(path) {
    return new Promise((resolve, reject) => {
      textureLoader.load(
        path,
        (texture) => {
          texture.flipY = false // GLTF usa flipY = false
          texture.colorSpace = THREE.SRGBColorSpace
          resolve(texture)
        },
        undefined,
        (error) => reject(error)
      )
    })
  }
  
  /**
   * Aplica as texturas aos materiais da arma
   */
  async applyTextures() {
    const basePath = '/fps_pistol_animations/textures/'
    
    // Definir texturas para cada material
    const textureConfig = {
      'arms': {
        diffuse: 'arms_diffuse.png',
        normal: 'arms_normal.png',
        specular: 'arms_specularGlossiness.png',
        occlusion: 'arms_occlusion.png'
      },
      'Material': {
        diffuse: 'Material_diffuse.png',
        normal: 'Material_normal.png',
        specular: 'Material_specularGlossiness.png'
      }
    }
    
    // Carregar todas as texturas
    const loadedTextures = {}
    
    for (const [materialName, textures] of Object.entries(textureConfig)) {
      loadedTextures[materialName] = {}
      
      for (const [type, filename] of Object.entries(textures)) {
        try {
          const texture = await this.loadTexture(basePath + filename)
          loadedTextures[materialName][type] = texture
        } catch (error) {
          // Falha silenciosa ao carregar textura
        }
      }
    }
    
    // Aplicar texturas aos meshes
    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        const materialName = child.material.name
        const textures = loadedTextures[materialName]
        
        if (textures) {
          // Criar novo material PBR com as texturas
          const newMaterial = new THREE.MeshStandardMaterial({
            name: materialName,
            map: textures.diffuse || null,
            normalMap: textures.normal || null,
            aoMap: textures.occlusion || null,
            roughness: 0.5,
            metalness: 0.3,
            side: THREE.FrontSide
          })
          
          // Se tiver textura specular, usar para ajustar roughness/metalness
          if (textures.specular) {
            // A textura specularGlossiness contém specular (RGB) e glossiness (A)
            // Vamos usar como roughnessMap invertida
            newMaterial.roughnessMap = textures.specular
            newMaterial.metalnessMap = textures.specular
            newMaterial.roughness = 1.0
            newMaterial.metalness = 1.0
          }
          
          child.material = newMaterial
          child.material.needsUpdate = true
        }
      }
    })
  }

  /**
   * Configura as animações do modelo
   */
  setupAnimations(animations) {
    this.mixer = new THREE.AnimationMixer(this.model)
    
    // Mapear animações por nome simplificado
    const animationMap = {
      'idle': 'Armature|FPS_Pistol_Idle',
      'walk': 'Armature|FPS_Pistol_Walk',
      'fire': 'Armature|FPS_Pistol_Fire',
      'reload': 'Armature|FPS_Pistol_Reload_easy',
      'reload_full': 'Armature|FPS_Pistol_Reload_full'
    }
    
    animations.forEach((clip) => {
      // Encontrar nome simplificado
      const simpleName = Object.keys(animationMap).find(
        key => animationMap[key] === clip.name
      )
      
      if (simpleName) {
        const action = this.mixer.clipAction(clip)
        this.animations[simpleName] = action
      }
    })
    
    // Configurar propriedades das animações
    if (this.animations.idle) {
      this.animations.idle.setLoop(THREE.LoopRepeat)
    }
    
    if (this.animations.walk) {
      this.animations.walk.setLoop(THREE.LoopRepeat)
    }
    
    if (this.animations.fire) {
      this.animations.fire.setLoop(THREE.LoopOnce)
      this.animations.fire.clampWhenFinished = true
    }
    
    if (this.animations.reload) {
      this.animations.reload.setLoop(THREE.LoopOnce)
      this.animations.reload.clampWhenFinished = true
    }
    
    if (this.animations.reload_full) {
      this.animations.reload_full.setLoop(THREE.LoopOnce)
      this.animations.reload_full.clampWhenFinished = true
    }
    
    // Listener para quando animação terminar
    this.mixer.addEventListener('finished', (e) => {
      this.onAnimationFinished(e)
    })
  }
  
  /**
   * Toca uma animação
   */
  playAnimation(name, crossFadeDuration = 0.2) {
    const newAction = this.animations[name]
    
    if (!newAction) {
      console.warn(`⚠️ Animação não encontrada: ${name}`)
      return
    }
    
    if (this.currentAction === newAction) {
      return
    }
    
    // Reset da nova animação
    newAction.reset()
    newAction.play()
    
    // Crossfade da animação anterior
    if (this.currentAction) {
      newAction.crossFadeFrom(this.currentAction, crossFadeDuration, true)
    }
    
    this.currentAction = newAction
  }
  
  /**
   * Callback quando uma animação termina
   */
  onAnimationFinished(event) {
    const finishedAction = event.action
    
    // Se terminou animação de tiro, voltar para idle ou walk
    if (finishedAction === this.animations.fire) {
      this.state.isFiring = false
      this.state.canFire = true
      this.playAnimation(this.state.isWalking ? 'walk' : 'idle')
    }
    
    // Se terminou animação de recarga
    if (finishedAction === this.animations.reload || finishedAction === this.animations.reload_full) {
      this.state.isReloading = false
      this.state.ammo = this.state.maxAmmo
      this.updateAmmoUI()
      this.playAnimation(this.state.isWalking ? 'walk' : 'idle')
    }
  }
  
  /**
   * Atualiza a arma a cada frame
   */
  update(delta, isMoving = false) {
    if (!this.state.isReady) return
    
    // Atualizar mixer de animações
    if (this.mixer) {
      this.mixer.update(delta)
    }
    
    // Atualizar estado de movimento
    this.state.isWalking = isMoving
    
    // Processar input
    this.processInput(delta)
    
    // Atualizar animação de movimento (se não estiver atirando ou recarregando)
    if (!this.state.isFiring && !this.state.isReloading) {
      if (isMoving && this.currentAction !== this.animations.walk) {
        this.playAnimation('walk')
      } else if (!isMoving && this.currentAction !== this.animations.idle) {
        this.playAnimation('idle')
      }
    }
  }
  
  /**
   * Processa input do jogador
   */
  processInput(delta) {
    // Botão esquerdo = atirar
    if (Input.mouse.left && this.state.canFire && !this.state.isReloading) {
      this.fire()
    }
    
    // R = recarregar
    if (Input.keys.KeyR && !this.state.isReloading && this.state.ammo < this.state.maxAmmo) {
      this.reload()
    }
  }
  
  /**
   * Dispara a arma
   */
  fire() {
    const now = performance.now() / 1000
    
    if (now - this.state.lastFireTime < this.config.fireRate) {
      return
    }
    
    if (this.state.ammo <= 0) {
      // Auto reload
      this.reload()
      return
    }
    
    this.state.lastFireTime = now
    this.state.ammo--
    this.state.isFiring = true
    this.state.canFire = false
    
    // Tocar animação de tiro
    this.playAnimation('fire', 0.05)
    
    // Executar raycast
    this.performRaycast()
    
    // Atualizar UI
    this.updateAmmoUI()
  }
  
  /**
   * Executa raycast para verificar acerto
   */
  performRaycast() {
    this.raycaster.setFromCamera(this.crosshairCenter, camera)
    
    // Filtrar objetos (ignorar a própria arma)
    const objectsToTest = scene.children.filter(obj => {
      return obj !== this.weaponGroup && obj.name !== 'WeaponGroup'
    })
    
    const intersects = this.raycaster.intersectObjects(objectsToTest, true)
    
    if (intersects.length > 0) {
      const hit = intersects[0]
      
      // Verificar se acertou um NPC
      const hitNPC = this.checkNPCHit(hit.object)
      
      if (hitNPC) {
        // Aplicar dano ao NPC
        hitNPC.takeDamage(this.config.damage)
        
        // Criar efeito de impacto vermelho (sangue)
        this.createImpactEffect(hit.point, hit.face?.normal, 0xff0000)
      } else {
        // Criar efeito de impacto normal
        this.createImpactEffect(hit.point, hit.face?.normal)
      }
    }
  }
  
  /**
   * Verifica se o objeto atingido pertence a um NPC
   */
  checkNPCHit(hitObject) {
    if (!npcManagerRef) return null
    
    // Subir na hierarquia até encontrar o grupo do NPC
    let current = hitObject
    
    while (current) {
      // Verificar se é um grupo de NPC
      if (current.name && current.name.startsWith('NPC_')) {
        // Encontrar o NPC correspondente
        const npcId = current.name.replace('NPC_', '')
        const npc = npcManagerRef.npcs.find(n => n.id === npcId)
        
        if (npc && npc.isAlive) {
          return npc
        }
      }
      
      current = current.parent
    }
    
    return null
  }
  
  /**
   * Cria efeito visual de impacto
   */
  createImpactEffect(position, normal, color = 0xffff00) {
    const impactGeometry = new THREE.SphereGeometry(0.05, 8, 8)
    const impactMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1
    })
    
    const impact = new THREE.Mesh(impactGeometry, impactMaterial)
    impact.position.copy(position)
    scene.add(impact)
    
    // Animar e remover
    let opacity = 1
    const fadeOut = () => {
      opacity -= 0.1
      impactMaterial.opacity = opacity
      
      if (opacity <= 0) {
        scene.remove(impact)
        impactGeometry.dispose()
        impactMaterial.dispose()
      } else {
        requestAnimationFrame(fadeOut)
      }
    }
    
    setTimeout(fadeOut, 50)
  }
  
  /**
   * Recarrega a arma
   */
  reload() {
    if (this.state.isReloading) return
    
    this.state.isReloading = true
    
    // Tocar animação de recarga (usar reload_full se munição = 0)
    const reloadAnim = this.state.ammo === 0 ? 'reload_full' : 'reload'
    this.playAnimation(reloadAnim, 0.1)
  }
  
  /**
   * Atualiza UI de munição
   */
  updateAmmoUI() {
    let ammoDisplay = document.getElementById('ammo-display')
    
    if (!ammoDisplay) {
      ammoDisplay = document.createElement('div')
      ammoDisplay.id = 'ammo-display'
      ammoDisplay.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        font-family: 'Arial Black', sans-serif;
        font-size: 28px;
        font-weight: bold;
        color: white;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
        z-index: 1000;
        user-select: none;
      `
      document.body.appendChild(ammoDisplay)
    }
    
    // Cor baseada na munição
    if (this.state.ammo === 0) {
      ammoDisplay.style.color = '#ff4444'
    } else if (this.state.ammo <= 4) {
      ammoDisplay.style.color = '#ffaa00'
    } else {
      ammoDisplay.style.color = 'white'
    }
    
    ammoDisplay.textContent = `${this.state.ammo} / ${this.state.maxAmmo}`
  }
  
  /**
   * Cria crosshair na tela
   */
  createCrosshair() {
    let crosshair = document.getElementById('crosshair')
    
    if (crosshair) return
    
    crosshair = document.createElement('div')
    crosshair.id = 'crosshair'
    crosshair.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      pointer-events: none;
    `
    
    // Ponto central
    const center = document.createElement('div')
    center.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 4px;
      height: 4px;
      background: white;
      border-radius: 50%;
      box-shadow: 0 0 3px rgba(0,0,0,0.8);
    `
    crosshair.appendChild(center)
    
    // Linhas
    const lineStyle = `
      position: absolute;
      background: white;
      box-shadow: 0 0 2px rgba(0,0,0,0.8);
    `
    
    const top = document.createElement('div')
    top.style.cssText = lineStyle + `
      width: 2px;
      height: 12px;
      left: 50%;
      transform: translateX(-50%);
      top: -18px;
    `
    crosshair.appendChild(top)
    
    const bottom = document.createElement('div')
    bottom.style.cssText = lineStyle + `
      width: 2px;
      height: 12px;
      left: 50%;
      transform: translateX(-50%);
      bottom: -18px;
    `
    crosshair.appendChild(bottom)
    
    const left = document.createElement('div')
    left.style.cssText = lineStyle + `
      width: 12px;
      height: 2px;
      top: 50%;
      transform: translateY(-50%);
      left: -18px;
    `
    crosshair.appendChild(left)
    
    const right = document.createElement('div')
    right.style.cssText = lineStyle + `
      width: 12px;
      height: 2px;
      top: 50%;
      transform: translateY(-50%);
      right: -18px;
    `
    crosshair.appendChild(right)
    
    document.body.appendChild(crosshair)
  }
  
  /**
   * Ajusta posição da arma
   */
  setPosition(x, y, z) {
    this.config.position.set(x, y, z)
    if (this.model) {
      this.model.position.copy(this.config.position)
    }
  }
  
  /**
   * Ajusta escala da arma
   */
  setScale(scale) {
    this.config.scale.setScalar(scale)
    if (this.model) {
      this.model.scale.copy(this.config.scale)
    }
  }
  
  /**
   * Ajusta rotação da arma
   */
  setRotation(x, y, z) {
    this.config.rotation.set(x, y, z)
    if (this.model) {
      this.model.rotation.copy(this.config.rotation)
    }
  }
  
  /**
   * Limpa recursos
   */
  dispose() {
    camera.remove(this.weaponGroup)
    
    // Remover UI
    const ammoDisplay = document.getElementById('ammo-display')
    if (ammoDisplay) ammoDisplay.remove()
    
    const crosshair = document.getElementById('crosshair')
    if (crosshair) crosshair.remove()
    
    // Limpar animações
    if (this.mixer) {
      this.mixer.stopAllAction()
    }
  }
}

// Instância singleton
let weaponInstance = null

export function getWeapon() {
  if (!weaponInstance) {
    weaponInstance = new Weapon()
  }
  return weaponInstance
}

export async function initWeapon() {
  const weapon = getWeapon()
  await weapon.init()
  return weapon
}

export function updateWeapon(delta, isMoving = false) {
  if (weaponInstance) {
    weaponInstance.update(delta, isMoving)
  }
}
