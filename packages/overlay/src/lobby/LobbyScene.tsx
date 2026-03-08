import { useRef, Suspense } from 'react'
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
import { STATE } from '@ieom/shared'
import type { LobbyConfig } from '@ieom/shared'
import { useAppStore } from '../store/useAppStore'

// ── Room dimensions ────────────────────────────────────────────────────────
const ROOM_W = 12
const ROOM_H = 5
const ROOM_D = 10

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

// ── Bookshelf ─────────────────────────────────────────────────────────────
function Bookshelf({ position }: { position: [number, number, number] }) {
  const colors = ['#8b1a1a', '#1a5c8b', '#1a8b3a', '#8b7a1a', '#7a1a8b', '#8b4a1a', '#1a8b8b']
  return (
    <group position={position}>
      {/* Frame */}
      <Box args={[1.2, 1.8, 0.3]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#2a1f10" roughness={0.8} />
      </Box>
      {/* Shelves interior */}
      {[0.45, 0, -0.45, -0.9].map((y, si) => (
        <Box key={si} args={[1.1, 0.04, 0.28]} position={[0, y, 0.01]}>
          <meshStandardMaterial color="#3a2a16" roughness={0.75} />
        </Box>
      ))}
      {/* Books */}
      {[0.45, 0, -0.45].flatMap((y, ri) =>
        Array.from({ length: 6 }, (_, bi) => (
          <Box
            key={`${ri}-${bi}`}
            args={[0.1 + Math.sin(ri * 7 + bi * 3) * 0.03, 0.28 + Math.sin(bi) * 0.04, 0.22]}
            position={[-0.48 + bi * 0.18, y + 0.14 + Math.sin(bi) * 0.02, 0.01]}
          >
            <meshStandardMaterial color={colors[(ri * 3 + bi) % colors.length]} roughness={0.9} />
          </Box>
        ))
      )}
    </group>
  )
}

// ── Room geometry (floor, walls, ceiling) ────────────────────────────────
function Room({ wallColor, floorColor, floorReflectivity }: { wallColor: string; floorColor: string; floorReflectivity: number }) {
  return (
    <group>
      {/* Floor — reflective */}
      <Plane args={[ROOM_W, ROOM_D]} rotation={[-Math.PI / 2, 0, 0]} position={[0, -ROOM_H / 2, 0]}>
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

      {/* Back wall */}
      <Plane args={[ROOM_W, ROOM_H]} position={[0, 0, -ROOM_D / 2]}>
        <meshStandardMaterial color="#111118" roughness={0.95} side={THREE.FrontSide} />
      </Plane>
      {/* Left wall */}
      <Plane args={[ROOM_D, ROOM_H]} rotation={[0, Math.PI / 2, 0]} position={[-ROOM_W / 2, 0, 0]}>
        <meshStandardMaterial color={wallColor} roughness={0.95} side={THREE.FrontSide} />
      </Plane>
      {/* Right wall */}
      <Plane args={[ROOM_D, ROOM_H]} rotation={[0, -Math.PI / 2, 0]} position={[ROOM_W / 2, 0, 0]}>
        <meshStandardMaterial color={wallColor} roughness={0.95} side={THREE.FrontSide} />
      </Plane>
      {/* Ceiling */}
      <Plane args={[ROOM_W, ROOM_D]} rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM_H / 2, 0]}>
        <meshStandardMaterial color="#080810" roughness={1} side={THREE.FrontSide} />
      </Plane>
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

// ── Slow auto-panning camera ───────────────────────────────────────────────
function AutoCamera({ fov }: { fov: number }) {
  const camRef = useRef<THREE.PerspectiveCamera>(null!)

  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.12
    // Gentle arc: slight left-right sway, slight up-down bob
    if (camRef.current) {
      camRef.current.position.set(
        Math.sin(t) * 0.8,
        0.6 + Math.sin(t * 0.7) * 0.15,
        3.8 + Math.cos(t * 0.5) * 0.3,
      )
      camRef.current.lookAt(0, -0.2, -0.5)
    }
  })

  return <PerspectiveCamera ref={camRef} makeDefault fov={fov} near={0.1} far={50} />
}

// ── Neon accent strips on back wall ──────────────────────────────────────
function NeonStrip({ y, color }: { y: number; color: string }) {
  const ref = useRef<THREE.PointLight>(null!)
  useFrame((state) => {
    if (ref.current) {
      ref.current.intensity = 0.3 + Math.sin(state.clock.elapsedTime * 1.5 + y) * 0.08
    }
  })
  return (
    <group>
      <Box args={[3.0, 0.04, 0.02]} position={[0, y, -ROOM_D / 2 + 0.02]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </Box>
      <pointLight ref={ref} color={color} intensity={0.3} distance={4} decay={2} position={[0, y, -ROOM_D / 2 + 0.3]} />
    </group>
  )
}

// ── Scene root ──────────────────────────────────────────────────────────
function Scene() {
  const config = useAppStore((s) => s.config)
  const env = config.scenes[STATE.LOBBY]?.lobbyConfig

  const fogColor         = env?.fogColor         ?? '#080810'
  const fogNear          = env?.fogNear           ?? 6
  const fogFar           = env?.fogFar            ?? 22
  const ambientColor     = env?.ambientColor      ?? '#1e1a3a'
  const ambientIntensity = env?.ambientIntensity  ?? 0.28
  const wallColor        = env?.wallColor         ?? '#0f0f16'
  const floorColor       = env?.floorColor        ?? '#0d0d14'
  const floorRefl        = env?.floorReflectivity ?? 0.6
  const crtGlow          = env?.crtGlowColor      ?? '#00c8e0'
  const neonStrips       = env?.neonStrips        ?? true
  const neonColors       = env?.neonColors        ?? (['#00c8ff', '#8000ff'] as [string, string])
  const showDust         = env?.dustMotes         ?? true
  const cameraFov        = env?.cameraFov         ?? 62
  const starsCount       = env?.starsCount        ?? 400

  return (
    <>
      <AutoCamera fov={cameraFov} />
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />

      {/* Ambient — soft purple-blue fill */}
      <ambientLight intensity={ambientIntensity} color={ambientColor} />

      {/* Overhead ceiling — cool blue-white main fill */}
      <pointLight color="#4060d0" intensity={1.8} distance={14} decay={2} position={[0, ROOM_H / 2 - 0.4, -1]} />
      {/* Secondary overhead warm fill to prevent flat look */}
      <pointLight color="#a080ff" intensity={0.7} distance={10} decay={2} position={[-2, ROOM_H / 2 - 0.6, 1]} />
      {/* Back corner deep blue mood */}
      <pointLight color="#0a2060" intensity={1.2} distance={10} decay={2} position={[-ROOM_W / 2 + 1, -0.5, -ROOM_D / 2 + 1]} />
      {/* Right-side rim light — cold blue-grey edge separation */}
      <pointLight color="#203080" intensity={0.9} distance={8} decay={2} position={[ROOM_W / 2 - 0.8, 0.5, -1]} />

      <Room wallColor={wallColor} floorColor={floorColor} floorReflectivity={floorRefl} />

      {/* Desk centred slightly back */}
      <Desk position={[0, -ROOM_H / 2 + 0.81, -0.6]} glowColor={crtGlow} />
      {/* Bookshelf on the right wall */}
      <Bookshelf position={[ROOM_W / 2 - 0.9, -ROOM_H / 2 + 0.9, -2.5]} />

      {/* Neon accent strips */}
      {neonStrips && (
        <>
          <NeonStrip y={0.4}  color={neonColors[0]} />
          <NeonStrip y={-0.3} color={neonColors[1]} />
        </>
      )}

      {/* Floating dust */}
      {showDust && <DustMotes />}

      {/* Stars visible through "window" atmosphere */}
      <Stars radius={30} depth={8} count={starsCount} factor={1.5} saturation={0.5} fade speed={0.3} />
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
