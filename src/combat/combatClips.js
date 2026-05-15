/** Combat animation clip name patterns (fallback to emote/jump when missing). */
export const COMBAT_CLIP_PATTERNS = {
  light: ['Punch', 'Attack', 'Hit', 'Strike', 'light', 'emote'],
  heavy: ['Kick', 'Heavy', 'Smash', 'Strong', 'heavy', 'Punch'],
  dash: ['Dash', 'Roll', 'Dodge', 'Jump', 'jump'],
  abilityCharge: ['Charge', 'Power', 'Cast', 'emote'],
  hitReact: ['Hit', 'Stagger', 'Hurt', 'Damage', 'emote'],
  block: ['Block', 'Guard', 'idle'],
  charge: ['Charge', 'PowerUp', 'Cast', 'emote'],
  transform: ['Transform', 'Power', 'emote', 'Jump'],
  poweredIdle: ['Idle', 'Power', 'idle'],
  poweredMove: ['Run', 'Walk', 'run'],
};

/**
 * Merge combat clips into resolved clip map.
 * @param {Record<string, string>} base
 * @param {string[]} clipNames
 * @returns {Record<string, string>}
 */
export function resolveCombatClips(base, clipNames) {
  const find = (keys) => {
    for (const key of keys) {
      const lower = key.toLowerCase();
      const exact = clipNames.find((n) => n === key);
      if (exact) return exact;
      const partial = clipNames.find((n) => n.toLowerCase().includes(lower));
      if (partial) return partial;
    }
    return base.emote ?? base.idle ?? clipNames[0] ?? '';
  };

  const combat = {};
  for (const [state, keys] of Object.entries(COMBAT_CLIP_PATTERNS)) {
    combat[state] = find(keys);
  }
  return { ...base, ...combat };
}
