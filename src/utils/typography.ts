// Типографика названий на карточках (текст не меняется, добавляются только невидимые символы; общий для карточек услуг и плиток проектов):
// после предлога или союза — неразрывный пробел, чтобы он не оставался в конце строки; в длинных словах — мягкие переносы по слогам.
const VOWELS = 'аеёиоуыэюя';
const isVowel = (ch: string) => VOWELS.includes(ch);
function softHyphens(word: string) {
  const letters = [...word];
  const cuts: number[] = [];
  for (let i = 0; i < letters.length - 1; i += 1) {
    if (!isVowel(letters[i].toLowerCase())) continue;
    let j = i + 1;
    while (j < letters.length && !isVowel(letters[j].toLowerCase())) j += 1;
    if (j >= letters.length) break;
    const consonants = j - i - 1;
    // гласная + одна согласная: перенос перед согласной; две и больше: после первой; й, ь, ъ остаются с предыдущей гласной
    let cut = i + 1;
    if (consonants >= 2 || 'йьъ'.includes(letters[i + 1].toLowerCase())) cut = i + 2;
    // группа «согласная + р/л» уходит на следующий слог целиком: со-про-вож-дение
    if (consonants >= 2 && 'рл'.includes(letters[j - 1].toLowerCase()) && !'рлйьъ'.includes(letters[j - 2].toLowerCase())) cut = j - 2;
    while ('йьъ'.includes(letters[cut]?.toLowerCase() ?? ' ') && cut < letters.length) cut += 1;
    if (cut >= 3 && letters.length - cut >= 3 && !cuts.includes(cut)) cuts.push(cut);
  }
  return letters.map((ch, index) => (cuts.includes(index) ? '\u00ad' : '') + ch).join('');
}
export const glue = (text: string, hyphenate: boolean) => {
  const glued = text
    .replace(/(^|\s)(в|во|на|и|а|по|к|ко|с|со|у|о|об|от|до|из|за|для|при|под|над|без|про|не|ни)\s+(?=\S)/giu, '$1$2\u00a0')
  return hyphenate ? glued.replace(/[а-яё]{7,}/giu, softHyphens) : glued;
};
