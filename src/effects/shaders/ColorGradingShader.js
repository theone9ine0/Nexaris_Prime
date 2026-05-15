import * as THREE from 'three';

/**
 * Full-screen color grading pass (saturation, contrast, tint, vignette).
 */
export const ColorGradingShader = {
  name: 'ColorGradingShader',
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 1.1 },
    contrast: { value: 1.05 },
    brightness: { value: 0.0 },
    tint: { value: new THREE.Color(0x88aacc) },
    tintStrength: { value: 0.12 },
    vignette: { value: 0.3 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float contrast;
    uniform float brightness;
    uniform vec3 tint;
    uniform float tintStrength;
    uniform float vignette;
    varying vec2 vUv;

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 color = tex.rgb + brightness;

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, saturation);

      color = (color - 0.5) * contrast + 0.5;
      color = mix(color, color * tint, tintStrength);

      vec2 uv = vUv * 2.0 - 1.0;
      float vig = 1.0 - dot(uv, uv) * vignette;
      color *= clamp(vig, 0.0, 1.0);

      gl_FragColor = vec4(color, tex.a);
    }
  `,
};
