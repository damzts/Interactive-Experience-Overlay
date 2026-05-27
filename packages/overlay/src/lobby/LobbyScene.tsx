import { useMemo, useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  PerspectiveCamera,
  Float,
  MeshReflectorMaterial,
  Box,
  Cylinder,
  Sphere,
  Plane,
  Stars,
} from '@react-three/drei'
import * as THREE from 'three'
import { DEFAULT_CONFIG, STATE } from '@ieom/shared'
import type { LobbyConfig } from '@ieom/shared'
import { useAppStore } from '../store/useAppStore'
import { resolveSceneStyle } from '../services/SceneResolver.js'

// ── Room dimensions ────────────────────────────────────────────────────────
const ROOM_W = 12
const ROOM_H = 5
const ROOM_D = 10
const FLOOR_SIZE = 220
const SKY_HALL_RADIUS = 42
const SKY_HALL_HEIGHT = 32
const SKY_HALL_CENTER_Y = 10

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

function expandHexColor(value: string) {
  if (value.length === 4 || value.length === 5) {
    return `#${value.slice(1).split('').map((char) => char + char).join('')}`
  }
  return value
}

function readHexColor(value: string | undefined, fallback: string) {
  const fallbackExpanded = expandHexColor(fallback)
  const fallbackRgb = fallbackExpanded.length === 9 ? fallbackExpanded.slice(0, 7) : fallbackExpanded
  const candidate = value?.trim()

  if (!candidate || !HEX_COLOR_PATTERN.test(candidate)) {
    return { rgb: fallbackRgb, alpha: 1 }
  }

  const expanded = expandHexColor(candidate)
  return {
    rgb: expanded.length === 9 ? expanded.slice(0, 7) : expanded,
    alpha: expanded.length === 9 ? parseInt(expanded.slice(7, 9), 16) / 255 : 1,
  }
}

function resolveAlphaColor(value: string | undefined, fallback: string) {
  const fallbackColor = readHexColor(fallback, '#000000')
  const candidate = readHexColor(value, fallbackColor.rgb)

  if (candidate.alpha >= 0.999) {
    return candidate.rgb
  }

  const mixed = new THREE.Color(fallbackColor.rgb)
  mixed.lerp(new THREE.Color(candidate.rgb), candidate.alpha)
  return `#${mixed.getHexString()}`
}

function extractGradientColors(gradient: string) {
  return gradient.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g) ?? []
}

function blendColor(baseColor: string, tintColor: string, amount: number) {
  const base = readHexColor(baseColor, '#000000')
  const tint = readHexColor(tintColor, '#000000')
  const mixed = new THREE.Color(base.rgb)
  mixed.lerp(new THREE.Color(tint.rgb), THREE.MathUtils.clamp(amount * tint.alpha, 0, 1))
  return `#${mixed.getHexString()}`
}

function resolveBackdropColors(background: { type: string; color: string; gradient: string; opacity: number }, topColor: string, horizonColor: string) {
  if (background.type === 'color' && background.color) {
    return {
      topColor: blendColor(topColor, background.color, background.opacity),
      horizonColor: blendColor(horizonColor, background.color, background.opacity),
    }
  }

  if (background.type === 'gradient') {
    const colors = extractGradientColors(background.gradient)
    if (colors.length > 0) {
      const gradientTopColor = colors[0] as string
      const gradientHorizonColor = colors[colors.length - 1] ?? colors[0]
      return {
        topColor: blendColor(topColor, gradientTopColor, background.opacity),
        horizonColor: blendColor(horizonColor, gradientHorizonColor, background.opacity),
      }
    }
  }

  return { topColor, horizonColor }
}

// ── CRT Monitor ──────────────────────────────────────────────────────────
function CRTMonitor({ position, glowColor = '#00c8e0' }: { position: [number, number, number]; glowColor?: string }) {
  const screenRef = useRef<THREE.Mesh>(null!)
  const glowRef   = useRef<THREE.PointLight>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    // Subtle screen flicker
    if (screenRef.current) {
      const mat = screenRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.8 + Math.sin(t * 60) * 0.02 + Math.sin(t * 13) * 0.05
    }
    if (glowRef.current) {
      glowRef.current.intensity = 0.6 + Math.sin(t * 2.3) * 0.05
    }
  })

  return (
    <group position={position}>
      {/* Monitor casing */}
      <Box args={[1.0, 0.75, 0.55]} position={[0, 0.375, 0]}>
        <meshStandardMaterial color="#2a2520" roughness={0.7} metalness={0.1} />
      </Box>
      {/* Screen bezel (inset) */}
      <Box args={[0.85, 0.62, 0.02]} position={[0, 0.375, 0.28]}>
        <meshStandardMaterial color="#1a1510" roughness={0.9} />
      </Box>
      {/* CRT screen — glowing */}
      <Box ref={screenRef} args={[0.76, 0.54, 0.01]} position={[0, 0.375, 0.29]}>
        <meshStandardMaterial
          color="#00b8c8"
          emissive="#006080"
          emissiveIntensity={0.8}
          roughness={0.1}
          metalness={0.0}
        />
      </Box>
      {/* Scanline overlay hint */}
      <Box args={[0.76, 0.54, 0.005]} position={[0, 0.375, 0.295]}>
        <meshStandardMaterial color="#000020" transparent opacity={0.15} roughness={1} />
      </Box>
      {/* Monitor base */}
      <Cylinder args={[0.18, 0.25, 0.08, 12]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#2a2520" roughness={0.8} />
      </Cylinder>
      {/* Neck */}
      <Cylinder args={[0.06, 0.08, 0.18, 8]} position={[0, 0.09, 0]}>
        <meshStandardMaterial color="#1e1a16" roughness={0.9} />
      </Cylinder>
      {/* CRT glow light */}
      <pointLight ref={glowRef} color={glowColor} intensity={0.6} distance={2.5} decay={2} position={[0, 0.375, 0.5]} />
    </group>
  )
}

// ── Keyboard ─────────────────────────────────────────────────────────────
function Keyboard({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Box args={[0.9, 0.04, 0.32]}>
        <meshStandardMaterial color="#1e1c18" roughness={0.8} metalness={0.05} />
      </Box>
      {/* Key rows - simple representation */}
      {[-0.08, 0, 0.08].map((rowZ, ri) =>
        [-0.35, -0.21, -0.07, 0.07, 0.21, 0.35].map((keyX, ki) => (
          <Box
            key={`${ri}-${ki}`}
            args={[0.07, 0.02, 0.07]}
            position={[keyX, 0.03, rowZ]}
          >
            <meshStandardMaterial color="#2d2b26" roughness={0.9} />
          </Box>
        ))
      )}
    </group>
  )
}

// ── Desk ─────────────────────────────────────────────────────────────────
function Desk({ position, glowColor }: { position: [number, number, number]; glowColor: string }) {
  return (
    <group position={position}>
      {/* Desk surface */}
      <Box args={[2.4, 0.06, 1.1]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#3d2e1e" roughness={0.7} metalness={0.02} />
      </Box>
      {/* Legs */}
      {([-1.05, 1.05] as number[]).flatMap((x) =>
        ([-0.45, 0.45] as number[]).map((z) => (
          <Box key={`${x}-${z}`} args={[0.06, 0.78, 0.06]} position={[x, -0.42, z]}>
            <meshStandardMaterial color="#2a1f10" roughness={0.9} />
          </Box>
        ))
      )}
      {/* Monitor on desk */}
      <CRTMonitor position={[0, 0.03, -0.22]} glowColor={glowColor} />
      {/* Keyboard */}
      <Keyboard position={[0, 0.03, 0.22]} />
      {/* Mouse */}
      <Box args={[0.1, 0.03, 0.15]} position={[0.55, 0.03, 0.22]}>
        <meshStandardMaterial color="#181512" roughness={0.8} />
      </Box>
      {/* Coffee mug */}
      <Cylinder args={[0.05, 0.045, 0.12, 12]} position={[-0.8, 0.09, 0.1]}>
        <meshStandardMaterial color="#4a3020" roughness={0.6} />
      </Cylinder>
      {/* Desk lamp arm */}
      <Cylinder args={[0.015, 0.015, 0.45, 6]} position={[0.9, 0.25, -0.3]} rotation={[0.3, 0, -0.2]}>
        <meshStandardMaterial color="#555" roughness={0.5} metalness={0.6} />
      </Cylinder>
      {/* Lamp shade */}
      <Cylinder args={[0.1, 0.07, 0.1, 8]} position={[0.78, 0.46, -0.36]}>
        <meshStandardMaterial color="#c8a020" roughness={0.5} metalness={0.1} emissive="#a07010" emissiveIntensity={0.3} />
      </Cylinder>
      {/* Lamp light */}
      <pointLight color="#ffd070" intensity={0.8} distance={2} decay={2} position={[0.78, 0.42, -0.36]} />
    </group>
  )
}

function VirtualPet({
  position,
  color,
  accessoryColor,
}: {
  position: [number, number, number]
  color: string
  accessoryColor: string
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const eyeLeftRef = useRef<THREE.Mesh>(null!)
  const eyeRightRef = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 2.4) * 0.04
      groupRef.current.rotation.y = Math.sin(t * 0.9) * 0.18
    }
    const blink = Math.max(0.16, Math.abs(Math.sin(t * 1.7)) > 0.97 ? 0.16 : 1)
    if (eyeLeftRef.current) eyeLeftRef.current.scale.y = blink
    if (eyeRightRef.current) eyeRightRef.current.scale.y = blink
  })

  return (
    <group ref={groupRef} position={position}>
      <Sphere args={[0.14, 18, 18]}>
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
      </Sphere>
      <Sphere args={[0.04, 10, 10]} position={[-0.12, 0.03, 0]}>
        <meshStandardMaterial color={accessoryColor} emissive={accessoryColor} emissiveIntensity={0.35} />
      </Sphere>
      <Sphere args={[0.018, 8, 8]} position={[-0.04, 0.02, 0.12]} ref={eyeLeftRef}>
        <meshStandardMaterial color="#101820" />
      </Sphere>
      <Sphere args={[0.018, 8, 8]} position={[0.04, 0.02, 0.12]} ref={eyeRightRef}>
        <meshStandardMaterial color="#101820" />
      </Sphere>
      <Box args={[0.08, 0.02, 0.02]} position={[0, -0.04, 0.12]}>
        <meshStandardMaterial color="#101820" />
      </Box>
    </group>
  )
}

function LavaLamp({
  position,
  glassColor,
  liquidColor,
  glowColor,
}: {
  position: [number, number, number]
  glassColor: string
  liquidColor: string
  glowColor: string
}) {
  const blobOneRef = useRef<THREE.Mesh>(null!)
  const blobTwoRef = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (blobOneRef.current) {
      blobOneRef.current.position.y = 0.18 + Math.sin(t * 1.2) * 0.14
      blobOneRef.current.scale.setScalar(0.95 + Math.sin(t * 1.1) * 0.08)
    }
    if (blobTwoRef.current) {
      blobTwoRef.current.position.y = -0.02 + Math.sin(t * 1.6 + 1.4) * 0.12
      blobTwoRef.current.scale.setScalar(0.8 + Math.cos(t * 1.4) * 0.06)
    }
  })

  return (
    <group position={position}>
      <Cylinder args={[0.08, 0.1, 0.12, 16]} position={[0, -0.28, 0]}>
        <meshStandardMaterial color="#d9dde4" roughness={0.45} metalness={0.22} />
      </Cylinder>
      <Cylinder args={[0.08, 0.08, 0.48, 20]} position={[0, 0, 0]}>
        <meshStandardMaterial color={glassColor} transparent opacity={0.35} roughness={0.08} metalness={0.08} />
      </Cylinder>
      <Sphere ref={blobOneRef} args={[0.07, 14, 14]} position={[0, 0.18, 0]}>
        <meshStandardMaterial color={liquidColor} emissive={glowColor} emissiveIntensity={0.55} roughness={0.25} />
      </Sphere>
      <Sphere ref={blobTwoRef} args={[0.055, 14, 14]} position={[0.01, -0.02, 0.01]}>
        <meshStandardMaterial color={liquidColor} emissive={glowColor} emissiveIntensity={0.45} roughness={0.3} />
      </Sphere>
      <pointLight color={glowColor} intensity={0.45} distance={1.6} decay={2} position={[0, 0.12, 0.16]} />
    </group>
  )
}

function FishTank({
  position,
  glassColor,
  waterColor,
  fishColor,
  fishCount,
}: {
  position: [number, number, number]
  glassColor: string
  waterColor: string
  fishColor: string
  fishCount: number
}) {
  const fishRefs = useRef<Array<THREE.Group | null>>([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    fishRefs.current.forEach((fish, index) => {
      if (!fish) return
      const speed = 0.55 + index * 0.08
      fish.position.x = Math.sin(t * speed + index * 1.7) * 0.36
      fish.position.y = Math.sin(t * (speed + 0.4) + index) * 0.08
      fish.position.z = Math.cos(t * (speed + 0.2) + index * 1.3) * 0.1
      fish.rotation.y = Math.cos(t * speed + index * 1.7) > 0 ? 0 : Math.PI
    })
  })

  return (
    <group position={position}>
      <Box args={[1.05, 0.52, 0.38]}>
        <meshStandardMaterial color={glassColor} transparent opacity={0.18} roughness={0.08} metalness={0.1} />
      </Box>
      <Box args={[0.98, 0.42, 0.32]} position={[0, 0.02, 0]}>
        <meshStandardMaterial color={waterColor} transparent opacity={0.55} roughness={0.2} />
      </Box>
      <Box args={[1.08, 0.06, 0.42]} position={[0, -0.29, 0]}>
        <meshStandardMaterial color="#f2f4fa" roughness={0.45} metalness={0.12} />
      </Box>
      {Array.from({ length: fishCount }).map((_, index) => (
        <group key={index} ref={(node) => { fishRefs.current[index] = node }} position={[0, 0, 0]}>
          <Sphere args={[0.045, 10, 10]}>
            <meshStandardMaterial color={fishColor} roughness={0.45} />
          </Sphere>
          <Box args={[0.045, 0.03, 0.01]} position={[-0.045, 0, 0]}>
            <meshStandardMaterial color={fishColor} roughness={0.45} />
          </Box>
        </group>
      ))}
      <pointLight color={waterColor} intensity={0.35} distance={1.8} decay={2} position={[0, 0.15, 0.22]} />
    </group>
  )
}

// ── Open-world geometry (floor only) ─────────────────────────────────────
function GroundPlane({ floorColor, floorReflectivity }: { floorColor: string; floorReflectivity: number }) {
  return (
    <Plane args={[FLOOR_SIZE, FLOOR_SIZE]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -ROOM_H / 2, 0]}>
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={512}
        mixBlur={1}
        mixStrength={60}
        roughness={1 - floorReflectivity}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color={floorColor}
        metalness={floorReflectivity}
        mirror={0}
      />
    </Plane>
  )
}

function SkyHall({ topColor, horizonColor }: { topColor: string; horizonColor: string }) {
  const resolvedTopColor = resolveAlphaColor(topColor, '#dceeff')
  const resolvedHorizonColor = resolveAlphaColor(horizonColor, '#f8fbff')

  const wallGeometry = useMemo(() => {
    const hall = new THREE.CylinderGeometry(SKY_HALL_RADIUS, SKY_HALL_RADIUS, SKY_HALL_HEIGHT, 56, 28, true)
    const positions = hall.attributes.position
    const colors = new Float32Array(positions.count * 3)
    const top = new THREE.Color(resolvedTopColor)
    const horizon = new THREE.Color(resolvedHorizonColor)
    const lower = horizon.clone().lerp(top, 0.06)
    const horizonBandColor = horizon.clone().lerp(top, 0.18)
    const mixed = new THREE.Color()

    for (let index = 0; index < positions.count; index += 1) {
      const y = positions.getY(index)
      const t = THREE.MathUtils.clamp((y + SKY_HALL_HEIGHT / 2) / SKY_HALL_HEIGHT, 0, 1)
      const skyBlend = THREE.MathUtils.smoothstep(t, 0.24, 1)
      const horizonBand = THREE.MathUtils.clamp(1 - Math.abs(t - 0.34) / 0.18, 0, 1)
      mixed.copy(lower).lerp(top, Math.pow(skyBlend, 0.92))
      mixed.lerp(horizonBandColor, horizonBand * 0.72)
      colors[index * 3] = mixed.r
      colors[index * 3 + 1] = mixed.g
      colors[index * 3 + 2] = mixed.b
    }

    hall.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return hall
  }, [resolvedTopColor, resolvedHorizonColor])

  const ceilingGeometry = useMemo(() => new THREE.CircleGeometry(SKY_HALL_RADIUS, 56), [])

  return (
    <group position={[0, SKY_HALL_CENTER_Y, 0]}>
      <mesh geometry={wallGeometry}>
        <meshBasicMaterial side={THREE.BackSide} vertexColors fog={false} toneMapped={false} />
      </mesh>
      <mesh geometry={ceilingGeometry} rotation={[Math.PI / 2, 0, 0]} position={[0, SKY_HALL_HEIGHT / 2 - 0.02, 0]}>
        <meshBasicMaterial color={resolvedTopColor} side={THREE.DoubleSide} fog={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ── Floating dust particles ───────────────────────────────────────────────
function DustMotes() {
  const count = 40
  const positions = Array.from({ length: count }, () => [
    (Math.random() - 0.5) * ROOM_W * 0.8,
    (Math.random() - 0.5) * ROOM_H * 0.8,
    (Math.random() - 0.5) * ROOM_D * 0.8,
  ] as [number, number, number])

  return (
    <>
      {positions.map((pos, i) => (
        <Float key={i} speed={0.2 + Math.random() * 0.3} rotationIntensity={0} floatIntensity={0.5}>
          <Sphere args={[0.008, 4, 4]} position={pos}>
            <meshStandardMaterial color="#a0a0c0" emissive="#6060a0" emissiveIntensity={0.5} transparent opacity={0.6} />
          </Sphere>
        </Float>
      ))}
    </>
  )
}

// ── Slow cinematic orbit camera ───────────────────────────────────────────
function AutoCamera({ fov }: { fov: number }) {
  const camRef = useRef<THREE.PerspectiveCamera>(null!)
  const targetRef = useRef(new THREE.Vector3(0.1, -0.48, -0.42))

  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.085
    if (camRef.current) {
      camRef.current.position.set(
        1.95 + Math.sin(t) * 0.9 + Math.sin(t * 0.36) * 0.22,
        0.92 + Math.sin(t * 0.47) * 0.16,
        4.7 + Math.cos(t * 0.62) * 0.48 + Math.cos(t * 0.24) * 0.14,
      )
      targetRef.current.set(
        0.08 + Math.sin(t * 0.41) * 0.14,
        -0.5 + Math.sin(t * 0.28) * 0.04,
        -0.42 + Math.cos(t * 0.38) * 0.08,
      )
      camRef.current.lookAt(targetRef.current)
    }
  })

  return <PerspectiveCamera ref={camRef} makeDefault fov={fov} near={0.1} far={50} />
}

// ── Scene root ──────────────────────────────────────────────────────────
function Scene() {
  const config = useAppStore((s) => s.config)
  const env = config.scenes[STATE.LOBBY]?.lobbyConfig
  const lobbyStyle = resolveSceneStyle(config, STATE.LOBBY)
  const lobbyBackground = lobbyStyle.background
  const defaultLobbyBackground = DEFAULT_CONFIG.scenes[STATE.LOBBY].style?.background ?? config.overlayStyle.background

  const fogColor         = resolveAlphaColor(env?.fogColor, '#080810')
  const fogNear          = env?.fogNear           ?? 6
  const fogFar           = env?.fogFar            ?? 22
  const ambientColor     = resolveAlphaColor(env?.ambientColor, '#1e1a3a')
  const ambientIntensity = env?.ambientIntensity  ?? 0.28
  const baseSkyTopColor      = resolveAlphaColor(env?.skyTopColor ?? env?.skyColor, '#dceeff')
  const baseSkyHorizonColor  = resolveAlphaColor(env?.skyHorizonColor ?? env?.skyColor, '#f8fbff')
  const floorColor       = resolveAlphaColor(env?.floorColor, '#0d0d14')
  const floorRefl        = env?.floorReflectivity ?? 0.6
  const crtGlow          = resolveAlphaColor(env?.crtGlowColor, '#00c8e0')
  const showDust         = env?.dustMotes         ?? true
  const cameraFov        = env?.cameraFov         ?? 62
  const starsCount       = env?.starsCount        ?? 400
  const virtualPet       = env?.virtualPet
  const lavaLamp         = env?.lavaLamp
  const fishTank         = env?.fishTank
  const hasCustomLobbyBackground = JSON.stringify(lobbyBackground) !== JSON.stringify(defaultLobbyBackground)
  const { topColor: skyTopColor, horizonColor: skyHorizonColor } = hasCustomLobbyBackground
    ? resolveBackdropColors(lobbyBackground, baseSkyTopColor, baseSkyHorizonColor)
    : { topColor: baseSkyTopColor, horizonColor: baseSkyHorizonColor }

  return (
    <>
      <AutoCamera fov={cameraFov} />
      <color attach="background" args={[skyHorizonColor]} />
      <SkyHall topColor={skyTopColor} horizonColor={skyHorizonColor} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

      {/* Ambient base fill */}
      <ambientLight intensity={ambientIntensity} color={ambientColor} />
      <hemisphereLight color={skyTopColor} groundColor={floorColor} intensity={0.72} />
      <directionalLight color="#ffffff" intensity={1.18} position={[4.8, 7.4, 4.9]} />
      <directionalLight color="#d7ecff" intensity={0.5} position={[-5.2, 3.4, -6.4]} />
      <pointLight color="#ffffff" intensity={2.35} distance={18} decay={2} position={[0.8, 2.5, 2.6]} />
      <pointLight color="#d9efff" intensity={0.72} distance={13} decay={2} position={[3.8, 1.1, -1.9]} />
      <pointLight color={crtGlow} intensity={0.26} distance={4.8} decay={2} position={[0, -ROOM_H / 2 + 1.28, -0.06]} />

      <GroundPlane floorColor={floorColor} floorReflectivity={floorRefl} />

      {/* Desk centred slightly back */}
      <Desk position={[0, -ROOM_H / 2 + 0.81, -0.6]} glowColor={crtGlow} />

      {virtualPet?.enabled && (
        <VirtualPet
          position={[-0.58, -ROOM_H / 2 + 1.03, 0.1]}
          color={resolveAlphaColor(virtualPet.color, '#7fd0ff')}
          accessoryColor={resolveAlphaColor(virtualPet.accessoryColor, '#ffe27a')}
        />
      )}

      {lavaLamp?.enabled && (
        <LavaLamp
          position={[0.78, -ROOM_H / 2 + 1.18, -0.18]}
          glassColor={resolveAlphaColor(lavaLamp.glassColor, '#eff6ff')}
          liquidColor={resolveAlphaColor(lavaLamp.liquidColor, '#7ec8ff')}
          glowColor={resolveAlphaColor(lavaLamp.glowColor, '#9be7ff')}
        />
      )}

      {fishTank?.enabled && (
        <FishTank
          position={[2.7, -ROOM_H / 2 + 0.32, -0.65]}
          glassColor={resolveAlphaColor(fishTank.glassColor, '#e9f7ff')}
          waterColor={resolveAlphaColor(fishTank.waterColor, '#dcf6ff')}
          fishColor={resolveAlphaColor(fishTank.fishColor, '#ffb347')}
          fishCount={fishTank.fishCount}
        />
      )}

      {/* Floating dust */}
      {showDust && <DustMotes />}

      {starsCount > 0 && <Stars radius={30} depth={8} count={starsCount} factor={1.5} saturation={0.5} fade speed={0.3} />}
    </>
  )
}

// ── LobbyScene — full-screen R3F canvas, only mounted in LOBBY state ───────
export function LobbyScene() {
  return (
    <Canvas
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 1.5]}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}
