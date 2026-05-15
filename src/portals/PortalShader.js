import * as THREE from 'three';

/**
 * @param {{
 *   colorInner?: number,
 *   colorOuter?: number,
 *   shaderVariant?: number,
 * }} [options]
 */
export function createPortalSurfaceMaterial(options = {}) {
  const colorInner = new THREE.Color(options.colorInner ?? 0x66ccff);
  const colorOuter = new THREE.Color(options.colorOuter ?? 0xaa44ff);
  const variant = options.shaderVariant ?? 0;

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
      uVariant: { value: variant },
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
      uniform float uVariant;
      uniform vec3 uColorInner;
      uniform vec3 uColorOuter;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv - 0.5;
        float r = length(uv) * 2.0;
        float angle = atan(uv.y, uv.x);

        float swirl = sin(angle * 3.0 + uTime * 2.2 - r * 6.0) * 0.5 + 0.5;

        if (uVariant > 0.5 && uVariant < 1.5) {
          swirl = sin(angle * 6.0 + uTime * 3.0 - r * 10.0) * 0.5 + 0.5;
        } else if (uVariant > 1.5 && uVariant < 2.5) {
          float scan = step(0.5, fract(uv.y * 24.0 + uTime * 4.0));
          swirl = mix(swirl, scan, 0.35);
        } else if (uVariant > 2.5 && uVariant < 3.5) {
          float grid = step(0.85, abs(sin(uv.x * 40.0)) * abs(sin(uv.y * 40.0)));
          swirl = mix(swirl, grid, 0.4);
        } else if (uVariant > 3.5) {
          swirl = 1.0 - smoothstep(0.0, 0.7, r);
        }

        float pulse = sin(uTime * 1.6) * 0.08 + 0.92;
        float edge = smoothstep(0.95, 0.35, r);
        float hole = smoothstep(0.15, 0.45, r);
        if (uVariant > 3.5) {
          hole = smoothstep(0.05, 0.55, r);
        }

        vec3 col = mix(uColorInner, uColorOuter, swirl);
        if (uVariant > 3.5) {
          col = mix(vec3(0.02, 0.02, 0.06), col, swirl);
        } else {
          col += vec3(0.15, 0.25, 0.45) * (1.0 - hole);
        }

        float alpha = edge * hole * uOpen * pulse;
        float emissive = (swirl * 0.6 + 0.4) * uGlow * uOpen;
        gl_FragColor = vec4(col * (1.0 + emissive), alpha);
      }
    `,
  });
}
