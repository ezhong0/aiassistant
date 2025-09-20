
/**
 * Personality configuration interface
 */
export interface PersonalityConfig {
  personality: 'cute' | 'professional' | 'friendly' | 'casual';
  useEmojis: boolean;
  enthusiasmLevel: 'low' | 'medium' | 'high';
  cacheResponses: boolean;
}

/**
 * Personality configuration based on environment
 */
export const getPersonalityConfig = (): PersonalityConfig => {
  const personality = (process.env.ASSISTANT_PERSONALITY || 'cute') as PersonalityConfig['personality'];
  const useEmojis = process.env.ASSISTANT_USE_EMOJIS !== 'false'; // Default true
  const enthusiasmLevel = (process.env.ASSISTANT_ENTHUSIASM || 'high') as PersonalityConfig['enthusiasmLevel'];
  const cacheResponses = process.env.ASSISTANT_CACHE_RESPONSES !== 'false'; // Default true

  return {
    personality,
    useEmojis,
    enthusiasmLevel,
    cacheResponses
  };
};

/**
 * Personality presets for easy switching
 */
export const PERSONALITY_PRESETS: Record<string, PersonalityConfig> = {
  cute: {
    personality: 'cute',
    useEmojis: true,
    enthusiasmLevel: 'high',
    cacheResponses: true
  },

  professional: {
    personality: 'professional',
    useEmojis: false,
    enthusiasmLevel: 'low',
    cacheResponses: true
  },

  friendly: {
    personality: 'friendly',
    useEmojis: true,
    enthusiasmLevel: 'medium',
    cacheResponses: true
  },

  casual: {
    personality: 'casual',
    useEmojis: true,
    enthusiasmLevel: 'medium',
    cacheResponses: true
  }
};

/**
 * Get personality config by preset name
 */
export const getPersonalityPreset = (presetName: string): PersonalityConfig => {
  if (presetName in PERSONALITY_PRESETS) {
    return PERSONALITY_PRESETS[presetName] as PersonalityConfig;
  }
  return PERSONALITY_PRESETS.cute as PersonalityConfig;
};