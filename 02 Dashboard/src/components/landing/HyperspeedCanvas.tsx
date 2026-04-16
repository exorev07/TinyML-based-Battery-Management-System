import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function HyperspeedCanvas({ style }: { style?: React.CSSProperties }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function nsin(val: number) { return Math.sin(val) * 0.5 + 0.5; }
    void nsin; // suppress unused warning

    const xyUniforms = {
      uFreq: { value: new THREE.Vector2(5, 2) },
      uAmp:  { value: new THREE.Vector2(8, 8) }
    }

    const xyDistortion = {
      uniforms: xyUniforms,
      getDistortion: `
        uniform vec2 uFreq;
        uniform vec2 uAmp;
        #define PI 3.14159265358979
        vec3 getDistortion(float progress){
          float movementProgressFix = 0.02;
          return vec3(
            cos(progress * PI * uFreq.x + uTime) * uAmp.x - cos(movementProgressFix * PI * uFreq.x + uTime) * uAmp.x,
            sin(progress * PI * uFreq.y + PI/2. + uTime) * uAmp.y - sin(movementProgressFix * PI * uFreq.y + PI/2. + uTime) * uAmp.y,
            0.
          );
        }
      `,
      getJS: (progress: number, time: number) => {
        const movementProgressFix = 0.02
        const uFreq = xyUniforms.uFreq.value
        const uAmp  = xyUniforms.uAmp.value
        const d = new THREE.Vector3(
          Math.cos(progress * Math.PI * uFreq.x + time) * uAmp.x - Math.cos(movementProgressFix * Math.PI * uFreq.x + time) * uAmp.x,
          Math.sin(progress * Math.PI * uFreq.y + time + Math.PI / 2) * uAmp.y - Math.sin(movementProgressFix * Math.PI * uFreq.y + time + Math.PI / 2) * uAmp.y,
          0
        )
        return d.multiply(new THREE.Vector3(0.5, 0.4, 1)).add(new THREE.Vector3(0, 0, -3))
      }
    }

    function random(base: number | [number, number]): number {
      if (Array.isArray(base)) return Math.random() * (base[1] - base[0]) + base[0]
      return Math.random() * base
    }
    function pickRandom<T>(arr: T[]): T {
      return arr[Math.floor(Math.random() * arr.length)]
    }

    const options = {
      distortion: xyDistortion,
      length: 400, roadWidth: 18, islandWidth: 0, lanesPerRoad: 3,
      fov: 90, carLightsFade: 0.4,
      totalSideLightSticks: 100, lightPairsPerRoadWay: 80,
      shoulderLinesWidthPercentage: 0.05, brokenLinesWidthPercentage: 0.1, brokenLinesLengthPercentage: 0.5,
      lightStickWidth: [0.02, 0.05] as [number,number], lightStickHeight: [0.3, 0.7] as [number,number],
      movingAwaySpeed: [20, 50] as [number,number], movingCloserSpeed: [-150, -230] as [number,number],
      carLightsLength: [20, 80] as [number,number], carLightsRadius: [0.03, 0.08] as [number,number],
      carWidthPercentage: [0.1, 0.5] as [number,number], carShiftX: [-0.5, 0.5] as [number,number], carFloorSeparation: [0, 0.1] as [number,number],
      colors: {
        roadColor: 526344, islandColor: 657930, background: 0,
        shoulderLines: 1250072, brokenLines: 1250072,
        leftCars:  [11636189, 13215976, 10187468],
        rightCars: [12632256, 10526904, 11842740],
        sticks: 7947197
      }
    }

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false })
    renderer.setSize(container.offsetWidth, container.offsetHeight, false)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setClearColor(0x000000, 1)
    container.appendChild(renderer.domElement)

    const camera = new THREE.PerspectiveCamera(options.fov, container.offsetWidth / container.offsetHeight, 0.1, 10000)
    camera.position.set(0, 8, -5)

    const scene = new THREE.Scene()
    const fog = new THREE.Fog(options.colors.background, options.length * 0.2, options.length * 500)
    scene.fog = fog

    const fogUniforms = {
      fogColor: { value: fog.color },
      fogNear:  { value: fog.near },
      fogFar:   { value: fog.far }
    }

    const roadVertex = `
      #define USE_FOG;
      uniform float uTime;
      ${THREE.ShaderChunk['fog_pars_vertex']}
      uniform float uTravelLength;
      varying vec2 vUv;
      #include <getDistortion_vertex>
      void main() {
        vec3 transformed = position.xyz;
        vec3 distortion = getDistortion((transformed.y + uTravelLength / 2.) / uTravelLength);
        transformed.x += distortion.x;
        transformed.z += distortion.y;
        transformed.y += -1. * distortion.z;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
        gl_Position = projectionMatrix * mvPosition;
        vUv = uv;
        ${THREE.ShaderChunk['fog_vertex']}
      }
    `
    const roadMarkings_vars = `
      uniform float uLanes;
      uniform vec3 uBrokenLinesColor;
      uniform vec3 uShoulderLinesColor;
      uniform float uShoulderLinesWidthPercentage;
      uniform float uBrokenLinesWidthPercentage;
      uniform float uBrokenLinesLengthPercentage;
    `
    const roadMarkings_fragment = `
      uv.y = mod(uv.y + uTime * 0.05, 1.);
      float laneWidth = 1.0 / uLanes;
      float brokenLineWidth = laneWidth * uBrokenLinesWidthPercentage;
      float laneEmptySpace = 1. - uBrokenLinesLengthPercentage;
      float brokenLines = step(1.0 - brokenLineWidth, fract(uv.x * 2.0)) * step(laneEmptySpace, fract(uv.y * 10.0));
      float sideLines = step(1.0 - brokenLineWidth, fract((uv.x - laneWidth * (uLanes - 1.0)) * 2.0)) + step(brokenLineWidth, uv.x);
      brokenLines = mix(brokenLines, sideLines, uv.x);
    `
    const roadBaseFragment = `
      #define USE_FOG;
      varying vec2 vUv;
      uniform vec3 uColor;
      uniform float uTime;
      #include <roadMarkings_vars>
      ${THREE.ShaderChunk['fog_pars_fragment']}
      void main() {
        vec2 uv = vUv;
        vec3 color = vec3(uColor);
        #include <roadMarkings_fragment>
        gl_FragColor = vec4(color, 1.);
        ${THREE.ShaderChunk['fog_fragment']}
      }
    `
    const islandFragment = roadBaseFragment.replace('#include <roadMarkings_fragment>', '').replace('#include <roadMarkings_vars>', '')
    const roadFragment   = roadBaseFragment.replace('#include <roadMarkings_fragment>', roadMarkings_fragment).replace('#include <roadMarkings_vars>', roadMarkings_vars)

    function createRoadPlane(side: number, isRoad: boolean) {
      const uTime = { value: 0 }
      const geometry = new THREE.PlaneGeometry(isRoad ? options.roadWidth : options.islandWidth, options.length, 20, 100)
      let uniforms: Record<string, any> = {
        uTravelLength: { value: options.length },
        uColor: { value: new THREE.Color(isRoad ? options.colors.roadColor : options.colors.islandColor) },
        uTime, ...fogUniforms
      }
      if (isRoad) {
        uniforms = {
          ...uniforms,
          uLanes: { value: options.lanesPerRoad },
          uBrokenLinesColor: { value: new THREE.Color(options.colors.brokenLines) },
          uShoulderLinesColor: { value: new THREE.Color(options.colors.shoulderLines) },
          uShoulderLinesWidthPercentage: { value: options.shoulderLinesWidthPercentage },
          uBrokenLinesLengthPercentage:  { value: options.brokenLinesLengthPercentage },
          uBrokenLinesWidthPercentage:   { value: options.brokenLinesWidthPercentage },
          ...options.distortion.uniforms
        }
      }
      const material = new THREE.ShaderMaterial({
        fragmentShader: isRoad ? roadFragment : islandFragment,
        vertexShader: roadVertex,
        side: THREE.DoubleSide, uniforms
      })
      material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <getDistortion_vertex>', options.distortion.getDistortion)
      }
      const mesh = new THREE.Mesh(geometry, material)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.z = -options.length / 2
      mesh.position.x += (options.islandWidth / 2 + options.roadWidth / 2) * side
      scene.add(mesh)
      return { mesh, uTime }
    }

    const leftRoad  = createRoadPlane(-1, true)
    const rightRoad = createRoadPlane(1,  true)
    const island    = createRoadPlane(0,  false)

    const carLightsFragment = `
      #define USE_FOG;
      ${THREE.ShaderChunk['fog_pars_fragment']}
      varying vec3 vColor;
      varying vec2 vUv;
      uniform vec2 uFade;
      void main() {
        float alpha = smoothstep(uFade.x, uFade.y, vUv.x);
        gl_FragColor = vec4(vColor, alpha);
        if (gl_FragColor.a < 0.0001) discard;
        ${THREE.ShaderChunk['fog_fragment']}
      }
    `
    const carLightsVertex = `
      #define USE_FOG;
      ${THREE.ShaderChunk['fog_pars_vertex']}
      attribute vec3 aOffset;
      attribute vec3 aMetrics;
      attribute vec3 aColor;
      uniform float uTravelLength;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vColor;
      #include <getDistortion_vertex>
      void main() {
        vec3 transformed = position.xyz;
        float radius = aMetrics.r; float myLength = aMetrics.g; float speed = aMetrics.b;
        transformed.xy *= radius;
        transformed.z *= myLength;
        transformed.z += myLength - mod(uTime * speed + aOffset.z, uTravelLength);
        transformed.xy += aOffset.xy;
        float progress = abs(transformed.z / uTravelLength);
        transformed.xyz += getDistortion(progress);
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
        gl_Position = projectionMatrix * mvPosition;
        vUv = uv; vColor = aColor;
        ${THREE.ShaderChunk['fog_vertex']}
      }
    `

    function createCarLights(colors: number[], speed: [number,number], fade: THREE.Vector2, offsetX: number) {
      const curve = new THREE.LineCurve3(new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1))
      const geometry = new THREE.TubeGeometry(curve, 40, 1, 8, false)
      const instanced = new THREE.InstancedBufferGeometry().copy(geometry)
      instanced.instanceCount = options.lightPairsPerRoadWay * 2
      const laneWidth = options.roadWidth / options.lanesPerRoad
      const aOffset: number[] = [], aMetrics: number[] = [], aColor: number[] = []
      const colorArray = colors.map(c => new THREE.Color(c))
      for (let i = 0; i < options.lightPairsPerRoadWay; i++) {
        const radius = random(options.carLightsRadius)
        const length = random(options.carLightsLength)
        const spd    = random(speed)
        const carLane = i % options.lanesPerRoad
        let laneX = carLane * laneWidth - options.roadWidth / 2 + laneWidth / 2
        laneX += random(options.carShiftX) * laneWidth
        const carWidth = random(options.carWidthPercentage) * laneWidth
        const offsetY  = random(options.carFloorSeparation) + radius * 1.3
        const offsetZ  = -random(options.length)
        aOffset.push(laneX - carWidth/2, offsetY, offsetZ, laneX + carWidth/2, offsetY, offsetZ)
        aMetrics.push(radius, length, spd, radius, length, spd)
        const color = pickRandom(colorArray)
        aColor.push(color.r, color.g, color.b, color.r, color.g, color.b)
      }
      instanced.setAttribute('aOffset',  new THREE.InstancedBufferAttribute(new Float32Array(aOffset),  3, false))
      instanced.setAttribute('aMetrics', new THREE.InstancedBufferAttribute(new Float32Array(aMetrics), 3, false))
      instanced.setAttribute('aColor',   new THREE.InstancedBufferAttribute(new Float32Array(aColor),   3, false))
      const uTime = { value: 0 }
      const material = new THREE.ShaderMaterial({
        fragmentShader: carLightsFragment, vertexShader: carLightsVertex,
        transparent: true,
        uniforms: { uTime, uTravelLength: { value: options.length }, uFade: { value: fade }, ...fogUniforms, ...options.distortion.uniforms }
      })
      material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader.replace('#include <getDistortion_vertex>', options.distortion.getDistortion)
      }
      const mesh = new THREE.Mesh(instanced, material)
      mesh.frustumCulled = false
      mesh.position.setX(offsetX)
      scene.add(mesh)
      return uTime
    }

    const leftLightsTime  = createCarLights(options.colors.leftCars,  options.movingAwaySpeed,   new THREE.Vector2(0, 1 - options.carLightsFade), -options.roadWidth / 2 - options.islandWidth / 2)
    const rightLightsTime = createCarLights(options.colors.rightCars, options.movingCloserSpeed, new THREE.Vector2(1, 0 + options.carLightsFade),  options.roadWidth  / 2 + options.islandWidth / 2)

    const sideSticksVertex = `
      #define USE_FOG;
      ${THREE.ShaderChunk['fog_pars_vertex']}
      attribute float aOffset;
      attribute vec3 aColor;
      attribute vec2 aMetrics;
      uniform float uTravelLength;
      uniform float uTime;
      varying vec3 vColor;
      mat4 rotationY(in float angle){return mat4(cos(angle),0,sin(angle),0,0,1,0,0,-sin(angle),0,cos(angle),0,0,0,0,1);}
      #include <getDistortion_vertex>
      void main(){
        vec3 transformed = position.xyz;
        float width = aMetrics.x; float height = aMetrics.y;
        transformed.xy *= vec2(width, height);
        float time = mod(uTime * 60. * 2. + aOffset, uTravelLength);
        transformed = (rotationY(3.14/2.) * vec4(transformed,1.)).xyz;
        transformed.z += -uTravelLength + time;
        float progress = abs(transformed.z / uTravelLength);
        transformed.xyz += getDistortion(progress);
        transformed.y += height / 2.; transformed.x += -width / 2.;
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.);
        gl_Position = projectionMatrix * mvPosition;
        vColor = aColor;
        ${THREE.ShaderChunk['fog_vertex']}
      }
    `
    const sideSticksFragment = `
      #define USE_FOG;
      ${THREE.ShaderChunk['fog_pars_fragment']}
      varying vec3 vColor;
      void main(){ gl_FragColor = vec4(vColor,1.); ${THREE.ShaderChunk['fog_fragment']} }
    `
    const stickGeom = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1,1))
    stickGeom.instanceCount = options.totalSideLightSticks
    const stickoffset = options.length / (options.totalSideLightSticks - 1)
    const sAOffset: number[] = [], sAColor: number[] = [], sAMetrics: number[] = []
    const sticksColorArray = [new THREE.Color(options.colors.sticks)]
    for (let i = 0; i < options.totalSideLightSticks; i++) {
      sAOffset.push((i-1) * stickoffset * 2 + stickoffset * Math.random())
      const c = pickRandom(sticksColorArray)
      sAColor.push(c.r, c.g, c.b)
      sAMetrics.push(random(options.lightStickWidth), random(options.lightStickHeight))
    }
    stickGeom.setAttribute('aOffset',  new THREE.InstancedBufferAttribute(new Float32Array(sAOffset),  1, false))
    stickGeom.setAttribute('aColor',   new THREE.InstancedBufferAttribute(new Float32Array(sAColor),   3, false))
    stickGeom.setAttribute('aMetrics', new THREE.InstancedBufferAttribute(new Float32Array(sAMetrics), 2, false))
    const sticksUTime = { value: 0 }
    const sticksMaterial = new THREE.ShaderMaterial({
      fragmentShader: sideSticksFragment, vertexShader: sideSticksVertex,
      side: THREE.DoubleSide,
      uniforms: { uTravelLength: { value: options.length }, uTime: sticksUTime, ...fogUniforms, ...options.distortion.uniforms }
    })
    sticksMaterial.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <getDistortion_vertex>', options.distortion.getDistortion)
    }
    const sticksMesh = new THREE.Mesh(stickGeom, sticksMaterial)
    sticksMesh.frustumCulled = false
    sticksMesh.position.setX(-(options.roadWidth + options.islandWidth / 2))
    scene.add(sticksMesh)

    const onResize = () => {
      const w = container.offsetWidth, h = container.offsetHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    // Animate
    const clock = new THREE.Clock()
    let timeOffset = 0
    let animFrameId = 0
    let fading = false

    const CURTAIN_END   = 4.5
    const RAMP_DURATION = 0.75
    const STOP_AFTER    = 8.5
    const SLOW_DURATION = 2.5

    function tick() {
      animFrameId = requestAnimationFrame(tick)
      const delta   = clock.getDelta()
      const elapsed = clock.elapsedTime

      let speedMultiplier: number
      if (elapsed < CURTAIN_END) {
        speedMultiplier = 0.3
      } else if (elapsed < CURTAIN_END + RAMP_DURATION) {
        const t = (elapsed - CURTAIN_END) / RAMP_DURATION
        speedMultiplier = 0.3 + t * t * (3 - 2 * t) * 0.7
      } else if (elapsed > STOP_AFTER) {
        const t = Math.min((elapsed - STOP_AFTER) / SLOW_DURATION, 1.0)
        speedMultiplier = 1.0 - t * t * (3 - 2 * t)
        if (speedMultiplier <= 0.001 && !fading) {
          fading = true
          renderer.domElement.style.transition = 'opacity 1.5s ease'
          renderer.domElement.style.opacity = '0'
        }
      } else {
        speedMultiplier = 1.0
      }

      timeOffset += delta * speedMultiplier
      const time = timeOffset

      leftRoad.uTime.value  = time
      rightRoad.uTime.value = time
      island.uTime.value    = time
      leftLightsTime.value  = time
      rightLightsTime.value = time
      sticksUTime.value     = time

      if (options.distortion.getJS) {
        const d = options.distortion.getJS(0.025, time)
        camera.lookAt(camera.position.x + d.x, camera.position.y + d.y, camera.position.z + d.z)
      }

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(animFrameId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none',
        ...style
      }}
    />
  )
}
