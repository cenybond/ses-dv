// Адреса проектов (решение владельца 2026-11-20, PROD-22): короткие, русские названия латиницей (транслит): /projects/nadezhda.
// Это адрес в строке браузера, а не текст страницы: `slug` проекта остаётся именем файлов снимков (src/assets/projects/<slug>.webp),
// а в адрес идёт короткое имя отсюда. Латиница без кодирования: адрес одинаково копируется и открывается в любом мессенджере и на любом хостинге.
export const projectUrlName: Record<string, string> = {
  hope: 'nadezhda',
  hc: 'dk-zheleznodorozhnikov',
  'residential-complex': 'severnyy-zhiloy-rayon',
  clap: 'klep-10kv',
  'pumping-station': 'nasosnaya-stantsiya-374',
  ktp: 'ktp-195-479',
  akik: 'akik',
  chp: 'tets',
  philharmonic: 'filarmoniya',
  'tp-10': 'tp-10',
  'smr-kalinina': 'vodoprovod-kalinina',
  pns: 'pns',
  aks: 'aks',
  tlt: 'tlt',
};
export const projectPath = (slug: string) => `/projects/${projectUrlName[slug] ?? slug}`;
