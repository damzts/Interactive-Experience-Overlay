export enum STATE {
  LOBBY = 'LOBBY',
  GAMEPLAY = 'GAMEPLAY',
  TV = 'TV',
  MUSIC = 'MUSIC',
  ARCHIVE = 'ARCHIVE',
  TRANSITIONING = 'TRANSITIONING',
}

export enum OVERLAY_EVENT {
  DEATH = 'death',
  VICTORY = 'victory',
  REVIVE = 'revive',
  NETWORK_GLITCH = 'network_glitch',
}

/** Valid target states from each source state */
export const VALID_TRANSITIONS: Partial<Record<STATE, STATE[]>> = {
  [STATE.LOBBY]: [STATE.GAMEPLAY, STATE.TV, STATE.MUSIC, STATE.ARCHIVE],
  [STATE.GAMEPLAY]: [STATE.LOBBY],
  [STATE.TV]: [STATE.LOBBY],
  [STATE.MUSIC]: [STATE.LOBBY],
  [STATE.ARCHIVE]: [STATE.LOBBY],
}

/** Maps a from→to pair to the named transition animation */
export const TRANSITION_TYPE: Record<string, string> = {
  [`${STATE.LOBBY}->${STATE.GAMEPLAY}`]: 'lobby-to-gameplay',
  [`${STATE.GAMEPLAY}->${STATE.LOBBY}`]: 'gameplay-to-lobby',
  [`${STATE.LOBBY}->${STATE.TV}`]: 'lobby-to-tv',
  [`${STATE.TV}->${STATE.LOBBY}`]: 'tv-to-lobby',
}
