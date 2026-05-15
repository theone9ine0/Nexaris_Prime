/**
 * Removes and disposes all objects in a THREE.Scene graph.
 * @param {THREE.Scene | THREE.Object3D} root
 */
export function disposeSceneGraph(root) {
  const toRemove = [...root.children];
  for (const child of toRemove) {
    root.remove(child);
    disposeObject3D(child);
  }
}

/**
 * @param {THREE.Object3D} object
 */
export function disposeObject3D(object) {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
    const mat = child.material;
    if (!mat) return;
    if (Array.isArray(mat)) {
      for (const m of mat) {
        m.dispose();
        if (m.map) m.map.dispose();
      }
    } else {
      mat.dispose();
      if (mat.map) mat.map.dispose();
    }
  });
}
