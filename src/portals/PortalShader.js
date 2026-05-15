import * as THREE from 'three';

/**
 * Lightweight swirling portal surface shader (PR14).
 * @param {{ colorInner?: number, colorOuter?: number }} [options]
 */
export function createPortalSurfaceMaterial(options = {}) {
  const colorInner = new THREE.Color(options.colorInner ?? 0x66ccff);
  const colorOuter = new THREE.Color(options.colorOuter ?? 0xaa44ff);

  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uOpen: { value: 1 },
      uGlow: { value: 0.65 },
      uColorInner: { value: colorInner },
      uColorOuter: { value: colorOuter },
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
      uniform float uOpen;
      uniform float uGlow;
      uniform vec3 uColorInner;
      uniform vec3 uColorOuter;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv - 0.5;
        float r = length(uv) * 2.0;
        float angle = atan(uv.y, uv.x);
        float swirl = sin(angle * 3.0 + uTime * 2.2 - r * 6.0) * 0.5 + 0.5;
        float pulse = sin(uTime * 1.6) * 0.08 + 0.92;
        float edge = smoothstep(0.95, 0.35, r);
        float hole = smoothstep(0.15, 0.45, r);
        vec3 col = mix(uColorInner, uColorOuter, swirl);
        col += vec3(0.15, 0.25, 0.45) * (1.0 - hole);
        float alpha = edge * hole * uOpen * pulse;
        float emissive = (swirl * 0.6 + 0.4) * uGlow * uOpen;
        gl_FragColor = vec4(col * (1.0 + emissive), alpha);
      }
    `,
  });
}
