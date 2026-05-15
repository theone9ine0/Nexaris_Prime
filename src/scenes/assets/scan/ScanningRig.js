import * as THREE from 'three';
import {
  createScanBeamMaterial,
  createHoloRingMaterial,
} from './ScanShader.js';

/**
 * PR44 — cinematic holographic scanning rig (rings, beams, columns).
 */
export class ScanningRig {
  /**
   * @param {{ platformY?: number }} [options]
   */
  constructor(options = {}) {
    this.root = new THREE.Group();
    this.root.name = 'scanning_rig';
    this.platformY = options.platformY ?? 0.08;

    /** @type {THREE.ShaderMaterial[]} */
    this._shaderMaterials = [];
    /** @type {THREE.Mesh[]} */
    this._beams = [];

    this._buildRings();
    this._buildBeams();
    this._buildColumns();
    this._buildPlatformGlow();
  }

  _buildRings() {
    this.rings = new THREE.Group();
    const radii = [1.4, 1.85, 2.35, 2.85, 3.35];
    const speeds = [0.6, -0.45, 0.55, -0.35, 0.5];
    const colors = [0x44ccff, 0x66aaff, 0xaa66ff, 0x44ddff, 0x88eeff];

    for (let i = 0; i < radii.length; i++) {
      const mat = createHoloRingMaterial({ color: new THREE.Color(colors[i]) });
      this._shaderMaterials.push(mat);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radii[i], 0.04 + i * 0.008, 12, 64),
        mat,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.9 + i * 0.22;
      ring.userData.spinSpeed = speeds[i];
      this.rings.add(ring);
    }

    this.root.add(this.rings);
  }

  _buildBeams() {
    this.beams = new THREE.Group();
    const beamCount = 6;
    const beamGeo = new THREE.PlaneGeometry(0.12, 2.8);

    for (let i = 0; i < beamCount; i++) {
      const mat = createScanBeamMaterial({
        color: new THREE.Color(i % 2 === 0 ? 0x66ccff : 0xaa88ff),
      });
      this._shaderMaterials.push(mat);

      const beam = new THREE.Mesh(beamGeo, mat);
      const angle = (i / beamCount) * Math.PI * 2;
      beam.position.set(Math.cos(angle) * 2.2, 1.5, Math.sin(angle) * 2.2);
      beam.lookAt(0, 1.5, 0);
      this.beams.add(beam);
      this._beams.push(beam);
    }

    this.root.add(this.beams);
  }

  _buildColumns() {
    this.columns = new THREE.Group();
    const colMat = new THREE.MeshStandardMaterial({
      color: 0x112233,
      emissive: 0x2266cc,
      emissiveIntensity: 0.55,
      metalness: 0.85,
      roughness: 0.15,
      transparent: true,
      opacity: 0.85,
    });

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.1, 3.2, 8),
        colMat,
      );
      col.position.set(Math.cos(angle) * 3.6, 1.6, Math.sin(angle) * 3.6);
      this.columns.add(col);
    }

    this.root.add(this.columns);
  }

  _buildPlatformGlow() {
    const glow = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.1, 48),
      new THREE.MeshBasicMaterial({
        color: 0x44aaff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = this.platformY + 0.02;
    this.root.add(glow);
    this._platformGlow = glow;
  }

  /**
   * @param {number} deltaTime
   * @param {{ scanning?: boolean, intensity?: number }} [state]
   */
  update(deltaTime, state = {}) {
    const t = performance.now() * 0.001;
    const intensity = state.scanning
      ? 0.85 + (state.intensity ?? 0.5) * 0.5
      : 0.45 + Math.sin(t * 1.5) * 0.1;

    for (const mat of this._shaderMaterials) {
      if (mat.uniforms.uTime) mat.uniforms.uTime.value = t;
      if (mat.uniforms.uIntensity) mat.uniforms.uIntensity.value = intensity;
      if (mat.uniforms.uPulse) mat.uniforms.uPulse.value = intensity;
    }

    if (this.rings) {
      this.rings.children.forEach((ring) => {
        ring.rotation.z += (ring.userData.spinSpeed ?? 0.4) * deltaTime;
      });
    }

    if (this._platformGlow) {
      const s = 1 + Math.sin(t * 3) * 0.03 * intensity;
      this._platformGlow.scale.set(s, s, s);
      this._platformGlow.material.opacity = 0.2 + intensity * 0.25;
    }
  }

  dispose() {
    this.root.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (child.material && !Array.isArray(child.material)) {
          child.material.dispose();
        }
      }
    });
  }
}
