import { registerPlugin } from '../core/registry.js';
import { aiTaggerHandler } from './handler.js';
import { AI_TAGGER_PLUGIN_TYPE } from './types.js';

registerPlugin(AI_TAGGER_PLUGIN_TYPE, aiTaggerHandler);
