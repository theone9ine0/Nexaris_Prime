import * as THREE from 'three';

/**
 * Animated holographic beam material (PR44).
 * @param {{ color?: THREE.Color }} [options]
 */
export function createScanBeamMaterial(options = {}) {
  const color = options.color ?? new THREE.Color(0x66ccff);

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uIntensity: { value: 0.6 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec2 vUv;

      void main() {
        float scan = sin(vUv.y * 12.0 - uTime * 4.0) * 0.5 + 0.5;
        float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        float alpha = edge * scan * uIntensity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

/**
 * Reflective dark floor with animated scan lines.
 */
export function createScanFloorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x0a1020) },
      uAccent: { value: new THREE.Color(0x2244aa) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uAccent;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        float grid = abs(sin(vWorldPos.x * 0.8 + uTime * 0.5)) * abs(sin(vWorldPos.z * 0.8));
        float ring = sin(length(vWorldPos.xz) * 0.6 - uTime * 1.2) * 0.5 + 0.5;
        vec3 col = mix(uColor, uAccent, grid * 0.08 + ring * 0.06);
        float fresnel = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 2.0);
        col += uAccent * fresnel * 0.15;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/**
 * Holographic ring with scrolling UV noise.
 * @param {{ color?: THREE.Color }} [options]
 */
export function createHoloRingMaterial(options = {}) {
  const color = options.color ?? new THREE.Color(0x44ccff);

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uPulse: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uPulse;
      varying vec2 vUv;

      void main() {
        float n = sin(vUv.x * 40.0 + uTime * 2.0) * sin(vUv.y * 20.0 - uTime);
        float alpha = (0.35 + n * 0.25) * uPulse;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}
