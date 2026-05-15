/**
 * Combines base render with bloom texture.
 */
export const BloomMixShader = {
  name: 'BloomMixShader',
  uniforms: {
    baseTexture: { value: null },
    bloomTexture: { value: null },
    bloomStrength: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    uniform float bloomStrength;
    varying vec2 vUv;

    void main() {
      vec4 base = texture2D(baseTexture, vUv);
      vec4 bloom = texture2D(bloomTexture, vUv);
      gl_FragColor = base + bloom * bloomStrength;
    }
  `,
};
