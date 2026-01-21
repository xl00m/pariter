export type RoleId = 'warrior' | 'amazon';

export const ROLE_META: Record<RoleId, { id: RoleId; emoji: string; ru: string; la: string }> = {
  warrior: { id: 'warrior', emoji: '⚔️', ru: 'Воин', la: 'Bellātor' },
  amazon: { id: 'amazon', emoji: '🏹', ru: 'Амазонка', la: 'Amazon' },
};

export type Theme = {
  id: string;
  role: RoleId;
  emoji: string;
  ru: string;
  la: string;
  light: boolean;
  colors: {
    bg: string;
    bgSecondary: string;
    text: string;
    textMuted: string;
    accent: string;
    accentHover: string;
    border: string;
    victory: string;
    lesson: string;
  };
};

export const THEMES: Theme[] = [
  // Warrior
  { id: 'dark_warrior', role: 'warrior', emoji: '⚔️', ru: 'Тёмный воин', la: 'Bellātor Nocturnus', light: false, colors: {
    bg: '#0b1020', bgSecondary: '#0f1730', text: '#e7eaf3', textMuted: '#9aa4c3', accent: '#7c5cff', accentHover: '#6a4ff0', border: 'rgba(255,255,255,.10)', victory: 'rgba(124,92,255,.12)', lesson: 'rgba(46,212,167,.12)'
  } },
  { id: 'guardian', role: 'warrior', emoji: '🛡️', ru: 'Несокрушимый страж', la: 'Custōs Invictus', light: false, colors: {
    bg: '#0a1214', bgSecondary: '#0e1d21', text: '#e9f4f4', textMuted: '#98b2b5', accent: '#2ed4a7', accentHover: '#23c39a', border: 'rgba(255,255,255,.11)', victory: 'rgba(46,212,167,.12)', lesson: 'rgba(124,92,255,.10)'
  } },
  { id: 'fire_heart', role: 'warrior', emoji: '🔥', ru: 'Огненное сердце', la: 'Cor Igneum', light: false, colors: {
    bg: '#140a0a', bgSecondary: '#201010', text: '#ffe9e6', textMuted: '#d2a39c', accent: '#ff4d6d', accentHover: '#ff335a', border: 'rgba(255,255,255,.12)', victory: 'rgba(255,77,109,.14)', lesson: 'rgba(255,190,84,.12)'
  } },
  { id: 'ocean_son', role: 'warrior', emoji: '🌊', ru: 'Сын океана', la: 'Fīlius Ōceanī', light: false, colors: {
    bg: '#071018', bgSecondary: '#0b1a26', text: '#e9f6ff', textMuted: '#9bb4c6', accent: '#2aa7ff', accentHover: '#148fe8', border: 'rgba(255,255,255,.11)', victory: 'rgba(42,167,255,.14)', lesson: 'rgba(46,212,167,.10)'
  } },
  { id: 'thunderer', role: 'warrior', emoji: '⚡', ru: 'Громовержец', la: 'Domitor Fulminis', light: false, colors: {
    bg: '#0f0c1b', bgSecondary: '#17112b', text: '#f0ecff', textMuted: '#b0a9d6', accent: '#ffd166', accentHover: '#f1c04e', border: 'rgba(255,255,255,.12)', victory: 'rgba(255,209,102,.16)', lesson: 'rgba(124,92,255,.10)'
  } },
  { id: 'forest_hunter', role: 'warrior', emoji: '🌲', ru: 'Лесной охотник', la: 'Venātor Silvae', light: false, colors: {
    bg: '#08130c', bgSecondary: '#0e2014', text: '#e9fff2', textMuted: '#9bc4aa', accent: '#41d36f', accentHover: '#2fbe5b', border: 'rgba(255,255,255,.11)', victory: 'rgba(65,211,111,.14)', lesson: 'rgba(46,212,167,.10)'
  } },
  { id: 'mountain_wolf', role: 'warrior', emoji: '🏔️', ru: 'Горный волк', la: 'Lupus Montium', light: false, colors: {
    bg: '#0c0f14', bgSecondary: '#141a22', text: '#eef3ff', textMuted: '#a8b4c8', accent: '#8bd3ff', accentHover: '#67c5ff', border: 'rgba(255,255,255,.12)', victory: 'rgba(139,211,255,.14)', lesson: 'rgba(255,209,102,.10)'
  } },

  // Amazon
  { id: 'dark_amazon', role: 'amazon', emoji: '🌙', ru: 'Тёмная воительница', la: 'Bellātrix Nocturna', light: false, colors: {
    bg: '#0b0c16', bgSecondary: '#11142a', text: '#eef0ff', textMuted: '#a7abd6', accent: '#b392ff', accentHover: '#a47fff', border: 'rgba(255,255,255,.11)', victory: 'rgba(179,146,255,.14)', lesson: 'rgba(46,212,167,.10)'
  } },
  { id: 'serene_amazon', role: 'amazon', emoji: '🌿', ru: 'Светлая амазонка', la: 'Amazon Serēna', light: true, colors: {
    bg: '#f6fbf8', bgSecondary: '#ffffff', text: '#101419', textMuted: '#5f6b75', accent: '#1fb981', accentHover: '#17a874', border: 'rgba(16,20,25,.12)', victory: 'rgba(31,185,129,.12)', lesson: 'rgba(124,92,255,.10)'
  } },
  { id: 'tender_strength', role: 'amazon', emoji: '🌸', ru: 'Нежная сила', la: 'Fortitūdo Tenera', light: false, colors: {
    bg: '#140a12', bgSecondary: '#201020', text: '#ffeef9', textMuted: '#d3a2c0', accent: '#ff77c8', accentHover: '#ff5bbb', border: 'rgba(255,255,255,.12)', victory: 'rgba(255,119,200,.14)', lesson: 'rgba(255,209,102,.10)'
  } },
  { id: 'ocean_daughter', role: 'amazon', emoji: '🌊', ru: 'Дочь океана', la: 'Fīlia Ōceanī', light: false, colors: {
    bg: '#07101a', bgSecondary: '#0b1a28', text: '#eaf6ff', textMuted: '#9db4c8', accent: '#41c7ff', accentHover: '#1eb6f5', border: 'rgba(255,255,255,.11)', victory: 'rgba(65,199,255,.14)', lesson: 'rgba(46,212,167,.10)'
  } },
  { id: 'clear_blade', role: 'amazon', emoji: '🔮', ru: 'Ясный клинок', la: 'Ensis Clārus', light: true, colors: {
    bg: '#f7f9ff', bgSecondary: '#ffffff', text: '#101629', textMuted: '#5f6a86', accent: '#4c6fff', accentHover: '#365cff', border: 'rgba(16,22,41,.12)', victory: 'rgba(76,111,255,.12)', lesson: 'rgba(31,185,129,.10)'
  } },
  { id: 'dawn_guard', role: 'amazon', emoji: '🌅', ru: 'Рассветная стража', la: 'Custōs Aurōrae', light: false, colors: {
    bg: '#140c07', bgSecondary: '#21130b', text: '#fff2e8', textMuted: '#d0ad95', accent: '#ff9f43', accentHover: '#ff8a1f', border: 'rgba(255,255,255,.12)', victory: 'rgba(255,159,67,.16)', lesson: 'rgba(255,77,109,.10)'
  } },
  { id: 'quiet_storm', role: 'amazon', emoji: '🦋', ru: 'Тихая буря', la: 'Tempestās Tacita', light: false, colors: {
    bg: '#0b1014', bgSecondary: '#0f1a22', text: '#eef8ff', textMuted: '#9ab3c2', accent: '#7dd3fc', accentHover: '#5ec7f8', border: 'rgba(255,255,255,.11)', victory: 'rgba(125,211,252,.14)', lesson: 'rgba(179,146,255,.10)'
  } },

  // Synchronization (shared palette for both roles)
  { id: 'sync_warrior', role: 'warrior', emoji: '🖤', ru: 'Синхронизация', la: 'Synchronizatio', light: false, colors: {
    bg: '#0a0a0f', bgSecondary: '#14141f', text: '#d4dbe8', textMuted: '#7a8599', accent: '#8fa4c9', accentHover: '#b8c8e8', border: 'rgba(150,160,180,.12)', victory: 'rgba(143,164,201,.12)', lesson: 'rgba(255,190,225,.10)'
  } },
  { id: 'sync_amazon', role: 'amazon', emoji: '🖤', ru: 'Синхронизация', la: 'Synchronizatio', light: false, colors: {
    bg: '#0a0a0f', bgSecondary: '#14141f', text: '#d4dbe8', textMuted: '#7a8599', accent: '#8fa4c9', accentHover: '#b8c8e8', border: 'rgba(150,160,180,.12)', victory: 'rgba(143,164,201,.12)', lesson: 'rgba(255,190,225,.10)'
  } },
];

export function themeById(id: string){
  return THEMES.find(t => t.id === id) || THEMES[0];
}

export function defaultThemeForRole(role: RoleId){
  return THEMES.find(t => t.role === role)?.id || 'dark_warrior';
}
