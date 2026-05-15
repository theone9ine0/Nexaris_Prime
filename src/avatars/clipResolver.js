/**
 * Resolve animation clip names from a loaded GLB (fuzzy match).
 * @param {string[]} clipNames
 * @param {Record<string, string[]>} patterns
 * @returns {Record<string, string>}
 */
export function resolveAnimationClips(clipNames, patterns) {
  /** @type {Record<string, string>} */
  const resolved = {};

  const find = (keys) => {
    for (const key of keys) {
      const lower = key.toLowerCase();
      const exact = clipNames.find((n) => n === key);
      if (exact) return exact;
      const partial = clipNames.find((n) => n.toLowerCase().includes(lower));
      if (partial) return partial;
    }
    return clipNames[0] ?? '';
  };

  for (const [state, keys] of Object.entries(patterns)) {
    resolved[state] = find(keys);
  }

  return resolved;
}

/** Default patterns for humanoid / robot sample models. */
export const HUMANOID_CLIP_PATTERNS = {
  idle: ['Idle', 'idle'],
  walk: ['Walk', 'Walking', 'walk'],
  run: ['Run', 'Running', 'run'],
  jump: ['Jump', 'jump'],
  emote: ['Punch', 'Wave', 'ThumbsUp', 'thumbs', 'emote'],
  light: ['Punch', 'Attack', 'Strike', 'light'],
  heavy: ['Kick', 'Heavy', 'Smash', 'heavy'],
  dash: ['Dash', 'Roll', 'Dodge', 'Jump', 'jump'],
  hitReact: ['Hit', 'Stagger', 'Hurt', 'Damage'],
};
