// Все виды работ ТЛТ. Слаги соответствуют docs/URL-MIGRATION.md.
import {tltWorkTypes} from './tlt.ts';
import {source_text} from './content-texts.ts';

export const workdetails = [
  {
    "id": "prj-14-01",
    "slug": "gnb-d-1",
    "title": tltWorkTypes[0]?.title!,
    "paragraphs": [
      source_text[63]
    ],
    "src": "1.md"
  },
  {
    "id": "prj-14-02",
    "slug": "naruzhnoe-elektrosnabzhenie",
    "title": tltWorkTypes[1]?.title!,
    "paragraphs": [
      source_text[64]
    ],
    "src": "2.md"
  },
  {
    "id": "prj-14-03",
    "slug": "naruzhnoe-elektroosveshchenie",
    "title": tltWorkTypes[2]?.title!,
    "paragraphs": [
      source_text[65]
    ],
    "src": "3.md"
  },
  {
    "id": "prj-14-04",
    "slug": "bktp",
    "title": tltWorkTypes[3]?.title!,
    "paragraphs": [
      source_text[66]
    ],
    "src": "4.md"
  },
  {
    "id": "prj-14-05",
    "slug": "vnutrennee-elektrosnabzhenie-abk",
    "title": tltWorkTypes[4]?.title!,
    "paragraphs": [
      source_text[67]
    ],
    "src": "5.md"
  },
  {
    "id": "prj-14-06",
    "slug": "vnutrennee-elektrosnabzhenie-peretarochnye",
    "title": tltWorkTypes[5]?.title!,
    "paragraphs": [
      source_text[68]
    ],
    "src": "6.md"
  },
  {
    "id": "prj-14-07",
    "slug": "naruzhnye-seti-svyazi",
    "title": tltWorkTypes[6]?.title!,
    "paragraphs": [
      source_text[71]
    ],
    "src": "7.md"
  },
  {
    "id": "prj-14-08",
    "slug": "videonablyudenie",
    "title": tltWorkTypes[7]?.title!,
    "paragraphs": [
      tltWorkTypes[7]?.serviceLinks[0]?.evidence!
    ],
    "src": "8.md"
  },
  {
    "id": "prj-14-09",
    "slug": "vneploshchadochnye-seti",
    "title": tltWorkTypes[8]?.title!,
    "paragraphs": [
      source_text[72]
    ],
    "src": "9.md"
  },
  {
    "id": "prj-14-10",
    "slug": "elektroobogrev-setey",
    "title": tltWorkTypes[9]?.title!,
    "paragraphs": [
      source_text[73]
    ],
    "src": "10.md"
  },
  {
    "id": "prj-14-11",
    "slug": "zazemlenie-azs",
    "title": tltWorkTypes[10]?.title!,
    "paragraphs": [
      source_text[74]
    ],
    "src": "11.md"
  },
  {
    "id": "prj-14-12",
    "slug": "fermy-dymokhoda",
    "title": tltWorkTypes[11]?.title!,
    "paragraphs": [
      source_text[75]
    ],
    "src": "12.md"
  }
] as const;
