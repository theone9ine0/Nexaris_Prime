/**
 * @typedef {'online' | 'offline'} OnlineStatus
 */

/**
 * @typedef {'in_dimension' | 'in_combat' | 'in_academy' | 'in_my_place' | 'in_scan' | 'idle'} PresenceTag
 */

/**
 * @typedef {{
 *   username: string,
 *   avatarReference: string | null,
 *   online: boolean,
 *   lastVisitedDimension: string,
 *   yourPlaceSceneId: string,
 *   presenceTag: PresenceTag,
 *   dimensionLabel?: string,
 * }} FriendRecord
 */

/**
 * @typedef {{
 *   username: string,
 *   avatarReference: string | null,
 *   yourPlaceSceneId: string,
 *   displayTitle?: string,
 * }} SocialIdentityProfile
 */

/**
 * @typedef {{
 *   leader: string,
 *   members: string[],
 *   destination: string | null,
 * }} PartyState
 */

/**
 * @typedef {{
 *   username: string,
 *   isOwnPlace: boolean,
 *   ownerDisplayName?: string,
 * }} VisitTarget
 */

export const YOUR_PLACE_SCENE_ID = 'your_place';

export const SCENE_PRESENCE_MAP = {
  chamber: { tag: 'in_dimension', label: 'Nexaris Chamber' },
  example: { tag: 'in_dimension', label: 'Main World' },
  void: { tag: 'in_dimension', label: 'Void' },
  crystal_cave: { tag: 'in_dimension', label: 'Crystal Cavern' },
  retro_console: { tag: 'in_dimension', label: 'Retro Console' },
  combat_zone: { tag: 'in_combat', label: 'Combat Zone' },
  scan_chamber: { tag: 'in_scan', label: 'Scan Chamber' },
  academy: { tag: 'in_academy', label: 'Nexaris Academy' },
  academy_flashcards: { tag: 'in_academy', label: 'Flashcard Chamber' },
  academy_lessons: { tag: 'in_academy', label: 'Lesson Hall' },
  academy_quiz: { tag: 'in_academy', label: 'Quiz Arena' },
  your_place: { tag: 'in_my_place', label: 'Your Place' },
};
