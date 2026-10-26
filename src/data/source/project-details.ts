// Текст всех проектов, кроме ТЛТ: источники неизменяемы, названия не сокращены.
import {projects} from './projects.ts';
import {source_text} from './content-texts.ts';

export const projectdetails = [
  {
    "id": "prj-01",
    "heading": projects[0]?.title!,
    "sections": [],
    "galleries": [
      {
        "id": "rec811139426",
        "title": source_text[0]
      },
      {
        "id": "rec811139429",
        "title": source_text[1]
      }
    ],
    "src": "hope.md"
  },
  {
    "id": "prj-02",
    "heading": projects[1]?.title!,
    "sections": [],
    "galleries": [
      {
        "id": "rec811130982",
        "title": source_text[0]
      },
      {
        "id": "rec811133020",
        "title": source_text[1]
      }
    ],
    "src": "hc.md"
  },
  {
    "id": "prj-03",
    "heading": source_text[2],
    "sections": [],
    "galleries": [],
    "src": "residential-complex.md"
  },
  {
    "id": "prj-04",
    "heading": projects[3]?.serviceLinks[0]?.evidence!,
    "sections": [],
    "galleries": [],
    "src": "clap.md"
  },
  {
    "id": "prj-05",
    "heading": projects[4]?.title!,
    "sections": [],
    "galleries": [],
    "src": "pumping-station.md"
  },
  {
    "id": "prj-06",
    "heading": projects[5]?.title!,
    "sections": [],
    "galleries": [],
    "src": "ktp.md"
  },
  {
    "id": "prj-07",
    "heading": source_text[3],
    "sections": [],
    "galleries": [
      {
        "id": "rec800673096",
        "title": source_text[4]
      }
    ],
    "src": "akik.md"
  },
  {
    "id": "prj-08",
    "heading": source_text[5],
    "sections": [
      {
        "id": "rec800671219",
        "paragraphs": [
          source_text[6],
          source_text[7],
          source_text[8],
          source_text[9],
          source_text[10],
          source_text[11]
        ]
      }
    ],
    "galleries": [],
    "src": "chp.md"
  },
  {
    "id": "prj-09",
    "heading": source_text[12],
    "sections": [
      {
        "id": "rec699840460",
        "paragraphs": [
          source_text[14],
          source_text[15],
          source_text[16],
          source_text[17],
          source_text[18],
          source_text[19],
          source_text[20],
          source_text[21],
          source_text[22]
        ],
        "heading": source_text[13]
      }
    ],
    "galleries": [
      {
        "id": "rec699844558",
        "title": source_text[4]
      },
      {
        "id": "rec699844712",
        "title": source_text[23]
      }
    ],
    "src": "philharmonic.md"
  },
  {
    "id": "prj-10",
    "heading": projects[9]?.serviceLinks[0]?.evidence!,
    "sections": [
      {
        "id": "rec659904252",
        "paragraphs": [
          source_text[25],
          source_text[26],
          source_text[27],
          source_text[28]
        ],
        "heading": source_text[24]
      },
      {
        "id": "rec659906417",
        "paragraphs": [
          source_text[30],
          source_text[31],
          source_text[32],
          source_text[33]
        ],
        "heading": source_text[29]
      },
      {
        "id": "rec659906822",
        "paragraphs": [
          source_text[35],
          source_text[36],
          source_text[37],
          source_text[32],
          source_text[33]
        ],
        "heading": source_text[34]
      },
      {
        "id": "rec659907578",
        "paragraphs": [
          source_text[39],
          source_text[26],
          source_text[27],
          source_text[28]
        ],
        "heading": source_text[38]
      }
    ],
    "galleries": [],
    "src": "tp-10.md"
  },
  {
    "id": "prj-11",
    "heading": projects[10]?.title!,
    "sections": [],
    "galleries": [],
    "src": "smr-kalinina.md"
  },
  {
    "id": "prj-12",
    "heading": source_text[40],
    "sections": [
      {
        "id": "rec659889681",
        "paragraphs": [
          source_text[42],
          source_text[43],
          source_text[44],
          source_text[45],
          source_text[46],
          source_text[47],
          source_text[48]
        ],
        "heading": source_text[41]
      },
      {
        "id": "rec659889680",
        "paragraphs": [
          source_text[50],
          source_text[51],
          source_text[52],
          source_text[53],
          source_text[54],
          source_text[55],
          source_text[56],
          projects[11]?.serviceLinks[0]?.evidence!,
          source_text[57],
          source_text[58]
        ],
        "heading": source_text[49]
      }
    ],
    "galleries": [],
    "src": "pns.md"
  },
  {
    "id": "prj-13",
    "heading": source_text[59],
    "sections": [
      {
        "id": "rec632910681",
        "paragraphs": [
          source_text[61]
        ],
        "heading": source_text[60]
      },
      {
        "id": "rec632910872",
        "paragraphs": [
          projects[12]?.serviceLinks[0]?.evidence!
        ],
        "heading": source_text[62]
      }
    ],
    "galleries": [],
    "src": "aks.md"
  }
] as const;
