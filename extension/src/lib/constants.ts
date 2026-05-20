import type { Provider } from './types';

export const DEFAULT_BACKEND_URL = 'https://promptenhancer-backend.onrender.com';
export const FRONTEND_URL = 'https://promptenhancer-frontend.vercel.app';

export const GROQ_MODELS: { value: string; label: string }[] = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Recommended)' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Fastest)' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
];

export const GEMINI_MODELS: { value: string; label: string }[] = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Recommended)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Smartest)' },
  { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
];

export const MODELS_FOR: Record<Provider, { value: string; label: string }[]> = {
  groq: GROQ_MODELS,
  gemini: GEMINI_MODELS,
};

export const DEFAULT_MODEL: Record<Provider, string> = {
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.0-flash',
};

export interface ModeDef {
  mode: 'Enhance' | 'Professional' | 'Shorten' | 'Code' | 'Creative';
  color: string;
  desc: string;
}

export const MODES: ModeDef[] = [
  { mode: 'Enhance', color: '#8B5CF6', desc: 'Adds structure, context & detail — 3-5x better AI output' },
  { mode: 'Professional', color: '#3B82F6', desc: 'Rewrites in formal, corporate language' },
  { mode: 'Shorten', color: '#10B981', desc: 'Cuts to the point, preserves all key info' },
  { mode: 'Code', color: '#F59E0B', desc: 'Technical precision for programming tasks' },
  { mode: 'Creative', color: '#EC4899', desc: 'Adds imagination, emotion & vivid language' },
];

export const CATEGORIES = [
  'coding', 'writing', 'analysis', 'learning',
  'creative', 'business', 'marketing', 'social', 'custom',
];
