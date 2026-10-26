// Архив исходных вакансий. active=false до подтверждения актуальности заказчиком.
import {source_text} from './content-texts.ts';
export const vacancygroups = [
  {
    "id": "workers",
    "title": source_text[76],
    "vacancies": [
      {
        "id": "workers-1",
        "title": source_text[77],
        "paragraphs": [
          source_text[78],
          source_text[79],
          source_text[80],
          source_text[81],
          source_text[82],
          source_text[83],
          source_text[84],
          source_text[85],
          source_text[86],
          source_text[87],
          source_text[88],
          source_text[89],
          source_text[90],
          source_text[91],
          source_text[92],
          source_text[93],
          source_text[94]
        ],
        "active": false
      },
      {
        "id": "workers-2",
        "title": source_text[95],
        "paragraphs": [
          source_text[78],
          source_text[79],
          source_text[80],
          source_text[81],
          source_text[96],
          source_text[84],
          source_text[97],
          source_text[98],
          source_text[99],
          source_text[89],
          source_text[90],
          source_text[91],
          source_text[92],
          source_text[93],
          source_text[94]
        ],
        "active": false
      }
    ]
  },
  {
    "id": "engineers",
    "title": source_text[100],
    "vacancies": [
      {
        "id": "engineers-1",
        "title": source_text[101],
        "paragraphs": [
          source_text[78],
          source_text[102],
          source_text[80],
          source_text[81],
          source_text[103],
          source_text[104],
          source_text[105],
          source_text[106],
          source_text[107],
          source_text[108],
          source_text[109],
          source_text[110],
          source_text[111],
          source_text[84],
          source_text[112],
          source_text[113],
          source_text[114],
          source_text[115],
          source_text[89],
          source_text[90],
          source_text[91],
          source_text[116],
          source_text[93],
          source_text[117],
          source_text[94]
        ],
        "active": false
      }
    ]
  }
] as const;

export const vacanciesheading = {text:'ВАКАНСИИ',src:'vacancies.md#rec596856322/1'} as const;
