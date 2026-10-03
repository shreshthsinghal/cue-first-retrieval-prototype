// Phase 1: download candidate photos from Unsplash CDN (Unsplash License).
// Each entry: unsplash photo id -> theme hint used later for manual review.
// Failures (404 etc.) are recorded and skipped; the script is resumable.

const CANDIDATES: Array<[string, string]> = [
  // trek / mountains / snow
  ['1506905925346-21bda4d32df4', 'mountains'],
  ['1464822759023-fed622ff2c3b', 'mountains'],
  ['1454496522488-7a8e488e8606', 'misty-mountains'],
  ['1519681393784-d120267933ba', 'starry-mountains'],
  ['1486870591958-9b9d0d1dda99', 'hiking'],
  ['1551632811-561732d1e306', 'hiking-trail'],
  ['1470071459604-3b5ec3a7fe05', 'foggy-hills'],
  ['1441974231531-c6227db76b6e', 'forest'],
  ['1448375240586-882707db888b', 'forest'],
  ['1426604966848-d7adac402bff', 'landscape'],
  ['1501785888041-af3ef285b470', 'lake-mountains'],
  ['1476514525535-07fb3b4ae5f1', 'canoe-lake'],
  ['1439066615861-d1af74d74000', 'lake'],
  ['1433086966358-54859d0ed716', 'waterfall'],
  ['1465311440653-ba9b1d9b0f5b', 'forest-path'],
  ['1510784722466-f2aa9c52fff6', 'mountain-sunset'],
  ['1458668383970-8ddd3927deed', 'snow-mountains'],
  ['1483728642387-6c3bdd6c93e5', 'mountains'],
  ['1491555103944-7c647fd857e6', 'snow-mountains'],
  ['1517299321609-52687d1bc55a', 'snow'],
  ['1491002052546-bf38f186af56', 'snow-cabin'],
  ['1418985991508-e47386d96a71', 'winter'],
  ['1457269449834-928af64c684d', 'winter-road'],
  ['1478265409131-1f65c88f965c', 'snow-forest'],
  ['1483664852095-d6cc6870702d', 'snow'],
  // beach / sea / sunset
  ['1507525428034-b723cf961d3e', 'beach'],
  ['1519046904884-53103b34b206', 'beach'],
  ['1502680390469-be75c86b636f', 'surf'],
  ['1510414842594-a61c69b5ae57', 'ocean'],
  ['1473116763249-2faaef81ccda', 'beach'],
  ['1468413253725-0d5181091126', 'beach-sunset'],
  ['1493558103817-58b2924bce98', 'beach'],
  ['1476673160081-cf065607f449', 'beach-sunset'],
  ['1520942702018-0862200e6873', 'ocean'],
  ['1471922694854-ff1b63b20054', 'beach-aerial'],
  ['1477346611705-65d1883cee1e', 'mountain-sunset'],
  ['1414073875831-b47709631146', 'sunset'],
  ['1505118380757-91f5f5632de0', 'ocean'],
  ['1499678329028-101435549a4e', 'boat'],
  // city / night / concert
  ['1470229722913-7c0e2dbbafd3', 'concert'],
  ['1493225457124-a3eb161ffa5f', 'concert'],
  ['1459749411175-04bf5292ceea', 'concert'],
  ['1501281668745-f7f57925c3b4', 'crowd-concert'],
  ['1524368535928-5b5e00ddc76b', 'concert'],
  ['1429962714451-bb934ecdc4ec', 'concert-lights'],
  ['1516450360452-9312f5e86fc7', 'concert'],
  ['1470019693664-1d202d2c0907', 'concert-crowd'],
  ['1533174072545-7a4b6ad7a6c3', 'night-festival'],
  ['1514565131-fce0801e5785', 'city-night'],
  ['1519501025264-65ba15a82390', 'city-night'],
  ['1449824913935-59a10b8d2000', 'city'],
  ['1444723121867-7a241cacace9', 'skyline'],
  ['1480714378408-67cf0d13bc1b', 'city'],
  ['1514924013411-cbf25faa35bb', 'city-night'],
  ['1526481280693-3bfa7568e0f3', 'street-night'],
  ['1516738901171-8eb4fc13bd20', 'neon'],
  ['1477959858617-67f85cf4f1df', 'skyline-night'],
  ['1480796927426-f609979314bd', 'street'],
  ['1493397212122-2b85dda8106b', 'architecture'],
  // birthday / cake / party
  ['1530103862676-de8c9debad1d', 'birthday'],
  ['1464349153735-7db50ed83c84', 'birthday-cake'],
  ['1578985545062-69928b1d9587', 'cake'],
  ['1542826438-bd32f43d626f', 'balloons'],
  ['1558636508-e0db3814bd1d', 'balloons'],
  ['1527529482837-4698179dc6ce', 'party-lights'],
  ['1467810563316-b5476525c0f9', 'party'],
  ['1481162854517-d9e353af153d', 'sparkler'],
  ['1530023367847-a683933f4172', 'party'],
  ['1513151233558-d860c5398176', 'confetti'],
  ['1543807535-eceef0bc6599', 'balloons'],
  ['1602631985686-1bb0e6a8696e', 'cake-candles'],
  ['1515169067868-5387ec356754', 'sparkler'],
  ['1518623489648-a173ef7824f3', 'candles'],
  // wedding
  ['1519741497674-611481863552', 'wedding-couple'],
  ['1465495976277-4387d4b0b4c6', 'wedding-hands'],
  ['1511285560929-80b456fea0bc', 'wedding'],
  ['1583939003579-730e3918a45a', 'wedding-couple'],
  ['1522673607200-164d1b6ce486', 'wedding-table'],
  ['1519225421980-715cb0215aed', 'wedding-table'],
  ['1520854221256-17451cc331bf', 'bride'],
  ['1529636798458-92182e662485', 'wedding-dance'],
  ['1469371670807-013ccf25f16a', 'wedding'],
  ['1532712938310-34cb3982ef74', 'rings'],
  ['1591604466107-ec97de577aff', 'indian-wedding'],
  ['1587271636175-90d58cdad458', 'indian-wedding'],
  ['1610173826608-8e2dc30e0b48', 'indian-wedding'],
  ['1558584673-c834fb1cc3ca', 'mehndi'],
  ['1613905684240-33895fa40699', 'mehndi'],
  // food / chai / cafe
  ['1504674900247-0877df9cc836', 'food'],
  ['1512621776951-a57141f2eefd', 'salad'],
  ['1540189549336-e6e99c3679fe', 'food-bowl'],
  ['1565299624946-b28f40a0ae38', 'pizza'],
  ['1567620905732-2d1ec7ab7445', 'pancakes'],
  ['1565958011703-44f9829ba187', 'dessert'],
  ['1482049016688-2d3e1b311543', 'toast'],
  ['1414235077428-338989a2e8c0', 'restaurant'],
  ['1517248135467-4c7edcad34c4', 'restaurant'],
  ['1554118811-1e0d58224f24', 'cafe'],
  ['1501339847302-ac426a4a7cbb', 'coffee-shop'],
  ['1495474472287-4d71bcdd2085', 'coffee'],
  ['1509042239860-f550ce710b93', 'coffee'],
  ['1461023058943-07fcbe16d735', 'coffee'],
  ['1497935586351-b67a49e012bf', 'barista'],
  ['1521017432531-fbd92d768814', 'cafe'],
  ['1559925393-8be0ec4767c8', 'cafe'],
  ['1442512595331-e89e73853f31', 'coffee-pour'],
  ['1525351484163-7529414344d8', 'breakfast'],
  ['1555396273-367ea4eb4db5', 'restaurant'],
  ['1504754524776-8f4f37790ca0', 'food-table'],
  // dog / home
  ['1543466835-00a7907e9de1', 'dog'],
  ['1552053831-71594a27632d', 'dog'],
  ['1587300003388-59208cc962cb', 'dog'],
  ['1518717758536-85ae29035b6d', 'dog'],
  ['1477884213360-7e9d7dcc1e48', 'dog'],
  ['1601758228041-f3b2795255f1', 'dog-home'],
  ['1544568100-847a948585b9', 'dog'],
  ['1450778869180-41d0601e046e', 'dog-sofa'],
  // rain / monsoon
  ['1515694346937-94d85e41e6f0', 'rain-window'],
  ['1428592953211-077101b2021b', 'rain-window'],
  ['1519692933481-e162a57d6721', 'rain'],
  ['1438449805896-28a666819a20', 'rain'],
  ['1501691223387-dd0500403074', 'rain-umbrella'],
  ['1534274988757-a28bf1a57c45', 'rain-city'],
  // street / metro / train
  ['1533900298318-6b8da08a523e', 'street'],
  ['1502920514313-52581002a659', 'station'],
  ['1474487548417-781cb71495f3', 'train-platform'],
  ['1544620347-c4fd4a3d5957', 'metro'],
  ['1568393691622-c7ba131d63b4', 'train'],
  ['1474447976065-67d23accb1e3', 'train-window'],
  ['1519178614-68673b201f36', 'street-food'],
  // graduation
  ['1523050854058-8df90110c9f1', 'graduation'],
  ['1541339907198-e08756dedf3f', 'graduation'],
  ['1594312915251-48db9280c8f1', 'graduation-cap'],
  ['1523580494863-6f3031224c94', 'graduation-throw'],
  ['1627556704290-2b1f5853ff78', 'graduation'],
  ['1564981797816-1043664bf78d', 'graduation'],
  // camping / trail
  ['1504280390367-361c6d9f38f4', 'camping'],
  ['1478131143081-80f7f84ca84d', 'camping'],
  ['1517824806704-9040b037703b', 'camping'],
  ['1523987355523-c7b5b0dd90a7', 'camping'],
  ['1508873696983-2dfd5898f08b', 'tent'],
  ['1470246973918-29a93221c455', 'campfire'],
  ['1475483768296-6163e08872a1', 'campfire'],
  ['1513836279014-a89f7a76ae86', 'trees'],
  ['1425913397330-cf8af2ff40a1', 'forest'],
  ['1473448912268-2022ce9509d8', 'forest-road'],
  ['1511497584788-876760111969', 'forest'],
  // portraits / people / groups
  ['1511895426328-dc8714191300', 'family'],
  ['1529156069898-49953e39b3ac', 'friends'],
  ['1521737604893-d14cc237f11d', 'team'],
  ['1522202176988-66273c2fd55f', 'people'],
  ['1511632765486-a01980e01a18', 'friends'],
  ['1539635278303-d4002c07eae3', 'friends-travel'],
  ['1506869640319-fe1a24fd76dc', 'friends'],
  ['1508215885820-4585e56135c8', 'friends'],
  ['1494790108377-be9c29b29330', 'woman'],
  ['1507003211169-0a1dd7228f2d', 'man'],
  ['1500648767791-00dcc994a43e', 'man'],
  ['1534528741775-53994a69daeb', 'woman'],
  ['1524504388940-b1c1722653e1', 'woman'],
  ['1517841905240-472988babdf9', 'woman'],
  ['1539571696357-5a69c17a67c6', 'man'],
  // books / study
  ['1481627834876-b7833e8f5570', 'library'],
  ['1507842217343-583bb7270b66', 'library'],
  ['1524995997946-a1c2e315a42f', 'books'],
  ['1519682337058-a94d519337bc', 'books'],
  ['1456513080510-7bf3a84b82f8', 'study'],
  ['1434030216411-0b793f4b4173', 'notes'],
  ['1455390582262-044cdead277a', 'writing'],
  ['1552664730-d307ca884978', 'whiteboard'],
  ['1532153975070-2e9ab71f1b14', 'whiteboard'],
]

const RAW_DIR = './library-raw'
const META_PATH = './library-raw/manifest-candidates.json'

import { mkdirSync, existsSync, statSync, writeFileSync, readFileSync } from 'fs'

mkdirSync(RAW_DIR, { recursive: true })

interface Rec { id: string; theme: string; ok: boolean; bytes: number; file: string }

async function download(id: string): Promise<boolean> {
  const file = `${RAW_DIR}/${id}.jpg`
  if (existsSync(file) && statSync(file).size > 15000) return true
  const url = `https://images.unsplash.com/photo-${id}?w=800&q=72&fm=jpg&fit=max`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) return false
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 15000) return false
    // JPEG magic check
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return false
    writeFileSync(file, buf)
    return true
  } catch {
    return false
  }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]) }
  }))
  return out
}

const prev: Rec[] = existsSync(META_PATH) ? JSON.parse(readFileSync(META_PATH, 'utf8')) : []
const prevOk = new Set(prev.filter((r) => r.ok).map((r) => r.id))

const results = await pool(CANDIDATES, 8, async ([id, theme]): Promise<Rec> => {
  if (prevOk.has(id)) return { id, theme, ok: true, bytes: statSync(`${RAW_DIR}/${id}.jpg`).size, file: `${id}.jpg` }
  const ok = await download(id)
  return { id, theme, ok, bytes: ok ? statSync(`${RAW_DIR}/${id}.jpg`).size : 0, file: ok ? `${id}.jpg` : '' }
})

writeFileSync(META_PATH, JSON.stringify(results, null, 2))
const okCount = results.filter((r) => r.ok).length
console.log(`downloaded ${okCount}/${CANDIDATES.length} unsplash candidates`)
const failed = results.filter((r) => !r.ok)
if (failed.length) console.log('failed ids:', failed.map((f) => `${f.id}(${f.theme})`).join(' '))
const totalBytes = results.filter((r) => r.ok).reduce((s, r) => s + r.bytes, 0)
console.log(`total raw size: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`)
