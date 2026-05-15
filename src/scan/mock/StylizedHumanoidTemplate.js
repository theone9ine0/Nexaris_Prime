import * as THREE from 'three';

/**
 * Stylized placeholder humanoid for scan preview (non-realistic).
 * @param {{ stylization?: number, accent?: number }} [options]
 * @returns {THREE.Group}
 */
export function createStylizedPlaceholderMesh(options = {}) {
  const stylization = options.stylization ?? 0.75;
  const accent = options.accent ?? 0x66aaff;

  const group = new THREE.Group();
  group.name = 'scan_placeholder';

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8899bb,
    emissive: accent,
    emissiveIntensity: 0.25 * stylization,
    metalness: 0.15,
    roughness: 0.75,
    flatShading: true,
  });

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.7, 6, 12),
    mat,
  );
  torso.position.y = 1.05;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), mat);
  head.position.y = 1.65;
  group.add(head);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.45, 4, 8), mat);
    arm.position.set(0.42 * side, 1.15, 0);
    arm.rotation.z = side * 0.25;
    group.add(arm);

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.55, 4, 8), mat);
    leg.position.set(0.14 * side, 0.35, 0);
    group.add(leg);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.03, 8, 32),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.45,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);

  group.userData.isScanPlaceholder = true;
  return group;
}
