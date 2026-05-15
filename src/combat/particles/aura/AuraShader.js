import * as THREE from 'three';

/**
 * Stylized noise aura shell material (additive, GPU-friendly).
 * @param {{ color?: THREE.Color, colorSecondary?: THREE.Color }} [options]
 */
export function createAuraShellMaterial(options = {}) {
  const color = options.color ?? new THREE.Color(0x66aaff);
  const colorSecondary = options.colorSecondary ?? new THREE.Color(0xaa44ff);

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.5 },
      uPulse: { value: 0 },
      uColor: { value: color },
      uColorSecondary: { value: colorSecondary },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uPulse;
      uniform vec3 uColor;
      uniform vec3 uColorSecondary;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main() {
        float n = noise(vUv * 8.0 + uTime * 1.5);
        n += noise(vUv * 16.0 - uTime * 2.2) * 0.5;

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 2.2);

        float pulse = 0.65 + 0.35 * sin(uTime * 4.0 + uPulse * 6.28);
        float alpha = fresnel * (0.25 + n * 0.35) * uIntensity * pulse;
        vec3 col = mix(uColor, uColorSecondary, n + fresnel * 0.5);
        col *= 1.0 + pulse * 0.35;

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}
