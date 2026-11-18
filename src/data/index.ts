// Точка входа слоя данных: страницы импортируют отсюда и не знают о файлах-источниках.
// Здесь только выборки (главная берёт подмножества, ТЛТ — связанные услуги); тексты не создаются.
import { advantages, homeAdvantageIds } from './source/advantages.ts';
import { projects, homeProjects } from './source/projects.ts';
import { services } from './source/services.ts';

export { company, hero, departments, departmentsHeading, documents } from './source/company.ts';
export { phones, email, address, contactsPageTitle, contactsLead } from './source/contacts.ts';
export { advantages, advantagesHeading, homeAdvantageIds } from './source/advantages.ts';
export { services, servicesPageTitle } from './source/services.ts';
export { projects, projectsPageTitle, projectsPageLead, homeProjects } from './source/projects.ts';
export { tlt, tltWorkTypes } from './source/tlt.ts';
export { privacyTitle, privacyParagraphs } from './source/privacy.ts';
export { ui } from './ui.ts';
export { routes, mainNav, privacyRoute, vacanciesExternalUrl, currentState, normalizePath } from './nav.ts';
export type * from './types.ts';

type ProjectItem = (typeof projects)[number];

export const getService = (id: string) => services.find((s) => s.id === id);
export const getProject = (id: string) => projects.find((p) => p.id === id);

/** Шесть проектов главной (H-03), порядок временный (Q-21). */
export const getHomeProjects = (): ProjectItem[] =>
  homeProjects.ids.map((id) => projects.find((p) => p.id === id)).filter((p): p is ProjectItem => p !== undefined);

/** Преимущества для главной (H-04): подмножество общего списка, а не его копия. */
export const getHomeAdvantages = () =>
  homeAdvantageIds.ids.map((id) => advantages.find((a) => a.id === id)).filter((a) => a !== undefined);

/** Порядок пунктов блока «О нас» главной — по макету Figma (Frame 4), тексты те же, что в списке преимуществ. */
const homeAboutAdvantageIds = ['adv-05', 'adv-02', 'adv-01', 'adv-03', 'adv-04'] as const;
export const getHomeAboutAdvantages = () =>
  homeAboutAdvantageIds.map((id) => advantages.find((a) => a.id === id)).filter((a) => a !== undefined);

export { projectdetails } from './source/project-details.ts';
export { workdetails } from './source/work-details.ts';
export { vacancygroups, vacanciesheading } from './source/vacancies.ts';
