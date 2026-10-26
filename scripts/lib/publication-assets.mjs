// Проверка файлов выполняется только при сборке; Node-модули не попадают в клиентский слой.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';

/** @param {readonly { src: string; bytes: number; sha256: string }[]} assets */
export function verify_publication_assets(assets, public_root = resolve('public')) {
  const root = resolve(public_root);
  for (const asset of assets) {
    const target = resolve(root, '.' + asset.src);
    if (!target.startsWith(root + sep)) throw new Error('Недопустимый путь файла: ' + asset.src);
    const data = readFileSync(target);
    if (data.byteLength !== asset.bytes || createHash('sha256').update(data).digest('hex') !== asset.sha256) {
      throw new Error('Метаданные файла не совпадают: ' + asset.src);
    }
  }
}
