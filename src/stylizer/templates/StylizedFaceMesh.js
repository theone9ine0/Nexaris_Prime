import * as THREE from 'three';

/**
 * Predefined anime-style face mesh (large eyes, simple nose/mouth).
 * Parented to VRM head bone at runtime — does not replace humanoid rig.
 */
export class StylizedFaceMesh {
  /**
   * @param {import('../types.js').StylizedFaceParams} params
   */
  constructor(params) {
    this.params = params;
    this.root = new THREE.Group();
    this.root.name = 'NexarisStylizedFace';

    this._buildHeadShell();
    this._buildEyes();
    this._buildFeatures();
  }

  _buildHeadShell() {
    const { base, shadow } = this.params.skinGradient;
    const geo = new THREE.SphereGeometry(0.11, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.85);
    const mat = new THREE.MeshToonMaterial({
      color: base,
      emissive: shadow,
      emissiveIntensity: 0.08,
    });
    const shell = new THREE.Mesh(geo, mat);
    shell.position.set(0, 0.02, 0.02);
    shell.scale.set(
      this.params.faceShape === 'round' ? 1.05 : 1,
      this.params.faceShape === 'heart' ? 1.08 : 1,
      0.92,
    );
    shell.castShadow = false;
    shell.receiveShadow = false;
    this.root.add(shell);
    this._headShell = shell;
  }

  _buildEyes() {
    const eyeColor = this.params.eyeColor;
    const scale =
      this.params.eyeVariant === 'wide' ? 1.15 : this.params.eyeVariant === 'round' ? 1.08 : 1;
    const spacing = this.params.eyeVariant === 'wide' ? 0.038 : 0.034;

    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(side * spacing, 0.04, 0.09);

      const white = new THREE.Mesh(
        new THREE.SphereGeometry(0.018 * scale, 12, 10),
        new THREE.MeshToonMaterial({ color: 0xffffff }),
      );
      white.scale.set(1.2, 0.85, 0.5);

      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.01 * scale, 10, 8),
        new THREE.MeshToonMaterial({
          color: eyeColor,
          emissive: eyeColor,
          emissiveIntensity: 0.15,
        }),
      );
      iris.position.z = 0.006;

      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.004 * scale, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x0a0a12 }),
      );
      pupil.position.set(-0.002 * side, 0.001, 0.01);

      eye.add(white, iris, pupil);
      this.root.add(eye);
    }
  }

  _buildFeatures() {
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.004, 0.012, 4),
      new THREE.MeshToonMaterial({ color: this.params.skinGradient.shadow, transparent: true, opacity: 0.5 }),
    );
    nose.position.set(0, 0.01, 0.1);
    nose.rotation.x = Math.PI;
    this.root.add(nose);

    const mouthCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.012, -0.02, 0.095),
      new THREE.Vector3(0, -0.025, 0.1),
      new THREE.Vector3(0.012, -0.02, 0.095),
    );
    const mouthGeo = new THREE.TubeGeometry(mouthCurve, 8, 0.0015, 4, false);
    const mouth = new THREE.Mesh(
      mouthGeo,
      new THREE.MeshToonMaterial({ color: 0xcc6677 }),
    );
    this.root.add(mouth);
  }

  /**
   * @param {THREE.Object3D} headBone
   */
  attachToHead(headBone) {
    this.root.position.set(0, 0.06, 0.04);
    this.root.rotation.set(0, 0, 0);
    headBone.add(this.root);
  }

  dispose() {
    this.root.traverse((c) => {
      if (c.isMesh) {
        c.geometry?.dispose();
        if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
        else c.material?.dispose();
      }
    });
    this.root.removeFromParent();
  }
}
